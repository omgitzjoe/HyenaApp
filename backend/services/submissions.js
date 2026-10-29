const { randomUUID } = require('node:crypto');
const { publishExperience, ReviewError } = require('./publishExperience');
const { ensureUnexpired } = require('../validation/submission');
async function validateReferences(db,payload) {
    if(payload.venue.businessId) {
        const b=await db.query(`SELECT b.id FROM businesses b JOIN discovery_areas a ON a.id=b.area_id
            WHERE b.id=$1 AND b.is_active AND a.is_active`,[payload.venue.businessId]);
        if(!b.rows.length) throw new ReviewError(400,'INVALID_BUSINESS','Choose an active venue.');
    } else {
        const a=await db.query('SELECT id FROM discovery_areas WHERE id=$1 AND is_active',[payload.venue.proposal.areaId]);
        if(!a.rows.length) throw new ReviewError(400,'INVALID_AREA','Choose an active discovery area.');
    }
    const c=await db.query('SELECT id FROM categories WHERE id=ANY($1::uuid[])',[payload.event.categoryIds]);
    if(c.rows.length!==payload.event.categoryIds.length) throw new ReviewError(400,'INVALID_CATEGORIES','Choose existing categories.');
}
async function existingReceipt(pool,key,payload) {
    const result=await pool.query(`SELECT id,status,created_at AS "createdAt",payload=$2::jsonb AS matches
        FROM event_submissions WHERE client_request_id=$1`,[key,JSON.stringify(payload)]);
    if(!result.rows.length) return null;
    const {matches,...item}=result.rows[0];
    if(!matches) throw new ReviewError(409,'REQUEST_REUSED','This request ID was already used for different event details.');
    return {item,created:false};
}
async function submitEvent(pool,data,now) {
    const previous=await existingReceipt(pool,data.clientRequestId,data.payload);
    if(previous) return previous;
    ensureUnexpired(data.payload.event,now);
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
            ensureUnexpired(row.payload.event,now);
            let businessId=options.businessId||row.payload.venue.businessId;
            if(!businessId) {
                const proposed=row.payload.venue.proposal;
                const area=await client.query('SELECT id FROM discovery_areas WHERE id=$1 AND is_active FOR SHARE',[proposed.areaId]);
                if(!area.rows.length) throw new ReviewError(400,'INVALID_AREA','The proposed area is no longer active.');
                businessId=randomUUID();
                await client.query(`INSERT INTO businesses(id,area_id,name,address,city,region,postal_code,latitude,longitude)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[businessId,proposed.areaId,proposed.name,proposed.address,proposed.city,proposed.region,proposed.postalCode,options.latitude??null,options.longitude??null]);
            }
            const published=await publishExperience(client,{...row.payload.event,businessId});experienceId=published.id;
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
