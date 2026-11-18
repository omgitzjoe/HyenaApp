const {evaluateCandidates}=require('./recurrence');
const {isPastSchedule}=require('./eventLifecycle');
const {venueTimeZone}=require('./venueLocation');
async function experienceDetails(pool,ids,now=new Date()){
    const result = await pool.query(`
                SELECT
                    e.id,
                    e.title,
                    e.description,
                    e.type,
                    e.price_amount AS "priceAmount",

                    e.source_url AS "sourceUrl",
                    b.id AS "businessId",
                    b.name AS "businessName",
                    b.address,
                    b.city,
                    b.state,
                    b.postal_code AS "postalCode",
                    b.latitude,
                    b.longitude,

                    s.all_day AS "allDay",
                    s.kind AS "scheduleKind",
                    s.start_date::text AS "startDate",
                    s.end_date::text AS "endDate",
                    s.start_time AS "startTime",
                    s.end_time AS "endTime",

                    s.time_zone AS "timeZone",
                    ARRAY(
                        SELECT sd.iso_weekday
                        FROM experience_schedule_days sd
                        WHERE sd.experience_id = s.experience_id
                        ORDER BY sd.iso_weekday
                    ) AS "weekdays",
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'id', c.id,
                                    'name', c.name,
                                    'slug', c.slug
                                )
                                ORDER BY c.name, c.id
                            )
                            FROM experience_categories ec
                            JOIN categories c ON c.id = ec.category_id
                            WHERE ec.experience_id = e.id
                        ),
                        '[]'::json
                    ) AS "categories"
                FROM experiences e
                JOIN businesses b ON b.id = e.business_id
                JOIN experience_schedules s ON s.experience_id = e.id
                WHERE e.id = ANY($1::uuid[])
                    AND e.is_active = TRUE
                    AND b.is_active = TRUE
            `, [ids]);


    return result.rows.flatMap(row=>{
        row.timeZone ||= venueTimeZone(row);
        if(isPastSchedule(row,now,row))return [];
        const next=evaluateCandidates([row],{window:'all',timeZone:row.timeZone,limit:1},now).items[0];
        return next?[next]:[];
    });
}
module.exports={experienceDetails};
