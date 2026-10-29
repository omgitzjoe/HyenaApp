const { randomUUID } = require('node:crypto');
class ReviewError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
// Caller owns the transaction. Used by both direct curation and submission approval.
async function publishExperience(client, data) {
    const business = await client.query(`SELECT b.id FROM businesses b JOIN discovery_areas a ON a.id=b.area_id
        WHERE b.id=$1 AND b.is_active=TRUE AND a.is_active=TRUE FOR SHARE OF b,a`, [data.businessId]);
    if (!business.rows.length) throw new ReviewError(400,'INVALID_BUSINESS','Choose an active business in an active area.');
    const categories = await client.query('SELECT id FROM categories WHERE id=ANY($1::uuid[]) FOR KEY SHARE',[data.categoryIds]);
    if (categories.rows.length !== data.categoryIds.length) throw new ReviewError(400,'INVALID_CATEGORIES','One or more categories no longer exist.');
    const id=randomUUID(), scheduleId=randomUUID();
    await client.query(`INSERT INTO experiences (id,business_id,title,description,type,price_amount,currency,price_label,requirements,image_url,source_url,is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE)`,
        [id,data.businessId,data.title,data.description,data.type,data.priceAmount,data.currency,data.offer,data.requirements,data.imageUrl,data.sourceUrl]);
    const s=data.schedule;
    await client.query(`INSERT INTO experience_schedules (id,experience_id,kind,start_date,end_date,start_time,end_time,ends_next_day,time_zone)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[scheduleId,id,s.kind,s.startDate,s.endDate,s.startTime,s.endTime,s.endsNextDay,s.timeZone]);
    await client.query('INSERT INTO experience_categories (experience_id,category_id) SELECT $1::uuid,unnest($2::uuid[])',[id,data.categoryIds]);
    if(s.weekdays.length) await client.query('INSERT INTO experience_schedule_days (schedule_id,iso_weekday) SELECT $1::uuid,unnest($2::smallint[])',[scheduleId,s.weekdays]);
    return { id, title: data.title };
}
module.exports={publishExperience,ReviewError};
