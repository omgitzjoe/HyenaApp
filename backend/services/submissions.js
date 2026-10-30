const { venueTimeZone } = require('./venueLocation');
const { randomUUID } = require('node:crypto');
const { publishExperience, ReviewError } = require('./publishExperience');
const { ensureUnexpired } = require('../validation/submission');
async function validateReferences(db,payload) {
    if(payload.venue.businessId) {
        const b=await db.query(`SELECT b.id FROM businesses b WHERE b.id=$1 AND b.is_active`,[payload.venue.businessId]);
        if(!b.rows.length) throw new ReviewError(400,'INVALID_BUSINESS','Choose an active venue.');
    }
    const c=await db.query('SELECT id FROM categories WHERE id=ANY($1::uuid[])',[payload.event.categoryIds]);
    if(c.rows.length!==payload.event.categoryIds.length) throw new ReviewError(400,'INVALID_CATEGORIES','Choose existing categories.');
}
async function existingReceipt(pool,key,payload) {
    const result=await pool.query(`SELECT id,status,created_at AS "createdAt",(payload #- '{event,schedule,timeZone}')=($2::jsonb #- '{event,schedule,timeZone}') AS matches
        FROM event_submissions WHERE client_request_id=$1`,[key,JSON.stringify(payload)]);
    if(!result.rows.length) return null;
    const {matches,...item}=result.rows[0];
    if(!matches) throw new ReviewError(409,'REQUEST_REUSED','This request ID was already used for different event details.');
    return {item,created:false};
}
async function submitEvent(pool,data,now) {
    const location = data.payload.venue.proposal || (await pool.query("SELECT latitude,longitude FROM businesses WHERE id=$1",[data.payload.venue.businessId])).rows[0];
    const normalized = {...data.payload.event, schedule: {...data.payload.event.schedule, timeZone: venueTimeZone(location)}};
    data.payload = {...data.payload, event: normalized};
    const previous=await existingReceipt(pool,data.clientRequestId,data.payload);
    if(previous) return previous;
    ensureUnexpired(normalized,now);
    await validateReferences(pool,data.payload);
    const result=await pool.query(`INSERT INTO event_submissions(id,client_request_id,payload) VALUES ($1,$2,$3::jsonb)
        ON CONFLICT(client_request_id) DO NOTHING RETURNING id,status,created_at AS "createdAt"`,[randomUUID(),data.clientRequestId,JSON.stringify(data.payload)]);
    return result.rows.length?{item:result.rows[0],created:true}:existingReceipt(pool,data.clientRequestId,data.payload);
}
async function reviewSubmission(pool,id,action,username,options={},now=new Date()) {
    const client=await pool.connect();let started=false,releaseError;
    try {
        await client.query('BEGIN');started=true;
        const result=await client.query('SELECT * FROM event_submissions WHERE id=$1 FOR UPDATE',[id]);
        if(!result.rows.length) throw new ReviewError(404,'SUBMISSION_NOT_FOUND','Submission not found.');
        const row=result.rows[0];
        if(row.status!=='PENDING') {
            if(row.status===action) {await client.query('COMMIT');started=false;return {id:row.id,status:row.status,experienceId:row.published_experience_id};}
            throw new ReviewError(409,'ALREADY_REVIEWED','This submission has already been reviewed. Reload the queue.');
        }
        let experienceId=null;
        if(action==='APPROVED') {
            let businessId=options.businessId||row.payload.venue.businessId;
            if(!businessId) {
                const proposed=row.payload.venue.proposal;
                businessId=randomUUID();
                await client.query(`INSERT INTO businesses(id,name,address,city,region,postal_code,latitude,longitude,time_zone)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[businessId,proposed.name,proposed.address,proposed.city,proposed.region,proposed.postalCode,options.latitude??proposed.latitude,options.longitude??proposed.longitude,venueTimeZone({latitude:options.latitude??proposed.latitude,longitude:options.longitude??proposed.longitude})]);
            }
            const location=(await client.query("SELECT latitude,longitude FROM businesses WHERE id=$1 FOR UPDATE",[businessId])).rows[0];
            if (location && (location.latitude == null || location.longitude == null) && options.latitude !== undefined) {
                location.latitude=options.latitude;location.longitude=options.longitude;
                const zone=venueTimeZone(location);
                await client.query('UPDATE businesses SET latitude=$2,longitude=$3,time_zone=$4 WHERE id=$1',[businessId,location.latitude,location.longitude,zone]);
                await client.query('UPDATE experience_schedules SET time_zone=$2 FROM experiences e WHERE e.id=experience_schedules.experience_id AND e.business_id=$1',[businessId,zone]);
            }
            const event={...row.payload.event,schedule:{...row.payload.event.schedule,timeZone:venueTimeZone(location)}};
            ensureUnexpired(event,now);
            const published=await publishExperience(client,{...event,businessId});experienceId=published.id;
        }
        await client.query(`UPDATE event_submissions SET status=$2,published_experience_id=$3,reviewed_by=$4,
            reviewed_at=CURRENT_TIMESTAMP,review_note=$5 WHERE id=$1`,[id,action,experienceId,username,options.note||null]);
        await client.query('COMMIT');started=false;
        return {id,status:action,experienceId};
    } catch(error) {
        if(started){try{await client.query('ROLLBACK');}catch(rollbackError){releaseError=rollbackError;}}
        throw error;
    } finally {client.release(releaseError);}
}
module.exports={submitEvent,reviewSubmission};
