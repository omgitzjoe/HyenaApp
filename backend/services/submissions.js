const { venueTimeZone } = require('./venueLocation');
const { randomUUID } = require('node:crypto');
const { publishExperience, ReviewError } = require('./publishExperience');
const { ensureUnexpired, parseSubmission } = require('../validation/submission');
async function validateReferences(db,payload) {
    if(payload.venue.businessId) {
        const b=await db.query(`SELECT b.id FROM businesses b WHERE b.id=$1 AND b.is_active`,[payload.venue.businessId]);
        if(!b.rows.length) throw new ReviewError(400,'INVALID_BUSINESS','Choose an active venue.');
    }
    const c=await db.query('SELECT id FROM categories WHERE id=ANY($1::uuid[])',[payload.event.categoryIds]);
    if(c.rows.length!==payload.event.categoryIds.length) throw new ReviewError(400,'INVALID_CATEGORIES','Choose existing categories.');
}
async function existingReceipt(pool,key,payload) {
    const result=await pool.query(`SELECT id,status,created_at AS "createdAt",(COALESCE(request_payload,payload) #- '{event,schedule,timeZone}')=($2::jsonb #- '{event,schedule,timeZone}') AS matches
        FROM event_submissions WHERE client_request_id=$1`,[key,JSON.stringify(payload)]);
    if(!result.rows.length) return null;
    const {matches,...item}=result.rows[0];
    if(!matches) throw new ReviewError(409,'REQUEST_REUSED','This request ID was already used for different event details.');
    return {item,created:false};
}
async function submitEvent(pool,data,now,{sourceKind='USER'}={}) {
    if (data.payload.event.categoryIds.includes('e9d8a249-4259-4b2f-93dc-d75876f293da')) {
        const category=await pool.query("SELECT id FROM categories WHERE slug='other' OR lower(name)='other' ORDER BY slug LIMIT 1");
        if (category.rows.length) data.payload.event.categoryIds=[...new Set(data.payload.event.categoryIds.map(id=>id==='e9d8a249-4259-4b2f-93dc-d75876f293da'?category.rows[0].id:id))];
    }
    const location = data.payload.venue.proposal || (await pool.query("SELECT latitude,longitude FROM businesses WHERE id=$1",[data.payload.venue.businessId])).rows[0];
    const normalized = {...data.payload.event, schedule: {...data.payload.event.schedule, timeZone: data.payload.event.schedule.timeZone || venueTimeZone(location)}};
    data.payload = {...data.payload, event: normalized};
    const previous=await existingReceipt(pool,data.clientRequestId,data.payload);
    if(previous) return previous;
    ensureUnexpired(normalized,now);
    await validateReferences(pool,data.payload);
    const result=await pool.query(`INSERT INTO event_submissions(id,client_request_id,payload,request_payload,source_kind) VALUES ($1,$2,$3::jsonb,$3::jsonb,$4)
        ON CONFLICT(client_request_id) DO NOTHING RETURNING id,status,created_at AS "createdAt"`,[randomUUID(),data.clientRequestId,JSON.stringify(data.payload),sourceKind]);
    return result.rows.length?{item:result.rows[0],created:true}:existingReceipt(pool,data.clientRequestId,data.payload);
}
async function reviewSubmission(pool,id,action,username,options={},now=new Date(),transactionClient=null) {
    const owns=!transactionClient;
    const client=transactionClient || await pool.connect();let started=false,releaseError;
    try {
        if(owns)await client.query('BEGIN');started=true;
        const result=await client.query('SELECT * FROM event_submissions WHERE id=$1 FOR UPDATE',[id]);
        if(!result.rows.length) throw new ReviewError(404,'SUBMISSION_NOT_FOUND','Submission not found.');
        const row=result.rows[0];
        if(options.revision!==undefined && options.revision!==row.revision)throw new ReviewError(409,'EDIT_CONFLICT','This entry changed. Refresh before saving again.');
        const editing=action==='EDIT';
        if(editing && !['PENDING','APPROVED'].includes(row.status))throw new ReviewError(409,'EDIT_NOT_ALLOWED','Restore this entry to Pending before editing.');
        if (action === 'PENDING') {
            if (row.status === 'PENDING') {
                if(owns)await client.query('COMMIT');
                started = false;
                return { id: row.id, status: 'PENDING', experienceId: null };
            }
            let payload = row.payload;
            if (row.status === 'APPROVED') {
                const published = await client.query(
                    'UPDATE experiences SET is_active=FALSE WHERE id=$1 RETURNING business_id',
                    [row.published_experience_id]
                );
                if (published.rows.length) {
                    payload = { ...payload, venue: { businessId: published.rows[0].business_id } };
                }
            }
            await client.query(
                `UPDATE event_submissions SET status='PENDING', payload=$2::jsonb,
                 published_experience_id=NULL, reviewed_by=NULL, reviewed_at=NULL, auto_publish_blocked=TRUE, revision=revision+1,duplicate_of=NULL WHERE id=$1`,
                [id, JSON.stringify(payload)]
            );
            if(owns)await client.query('COMMIT');
            started = false;
            return { id, status: 'PENDING', experienceId: null };
        }
        if (options.automatic && row.auto_publish_blocked) {
            if(owns)await client.query('COMMIT');
            started = false;
            return {id,status:row.status,experienceId:row.published_experience_id};
        }
        if(row.status!=='PENDING' && !editing) {
            if(row.status===action) {if(owns)await client.query('COMMIT');started=false;return {id:row.id,status:row.status,experienceId:row.published_experience_id};}
            throw new ReviewError(409,'ALREADY_REVIEWED','This submission has already been reviewed. Reload the queue.');
        }
        const venueChanged = Boolean(options.venue ||
            (options.businessId && options.businessId !== row.payload.venue.businessId) ||
            options.latitude !== undefined);
        if (options.venue) row.payload = {...row.payload,venue:options.venue};
        let experienceId=editing?row.published_experience_id:null;
        if(action==='APPROVED' || editing) {
            const updated={...row.payload.event,...options.event};
            if (options.event?.schedule && typeof options.event.schedule === 'object' && !Array.isArray(options.event.schedule)) {
                updated.schedule={...row.payload.event.schedule,...options.event.schedule};
            }
            if (venueChanged && updated.schedule && !Object.hasOwn(options.event?.schedule || {},'timeZone')) {
                updated.schedule={...updated.schedule,timeZone:null};
            }
            const valid=parseSubmission({
                clientRequestId:row.client_request_id,
                venue:{businessId:row.payload.venue.businessId || '00000000-0000-4000-8000-000000000000'},
                event:updated
            });
            if (!valid.success) throw new ReviewError(400,'EVENT_DETAILS_REQUIRED','Check the highlighted event details.',
                valid.error.issues.slice(0,8).map(issue=>({field:issue.path.join('.'),message:issue.message})));
            row.payload={...row.payload,event:valid.data.payload.event};
            let createdBusinessId=null;
            let businessId=options.businessId||row.payload.venue.businessId;
            if(!businessId) {
                const validation=require('../validation/submission').proposalSchema.safeParse({
                    ...row.payload.venue.proposal,
                    ...(options.latitude!==undefined?{latitude:options.latitude,longitude:options.longitude}:{})
                });
                if(!validation.success)throw new ReviewError(400,'VENUE_LOCATION_REQUIRED','Check the venue details.',
                    validation.error.issues.slice(0,8).map(issue=>({field:['venue',...issue.path].join('.'),message:issue.message})));
                const proposed=validation.data;
                row.payload.venue={proposal:proposed};
                const key=[proposed.name,proposed.address,proposed.city].map(value=>String(value).trim().toLowerCase()).join('|');
                await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);
                const existingVenue=await client.query(
                    `SELECT id FROM businesses WHERE is_active AND lower(name)=lower($1) AND lower(COALESCE(address,''))=lower(COALESCE($2,'')) AND lower(COALESCE(city,''))=lower(COALESCE($3,'')) AND state IS NOT DISTINCT FROM $4 AND latitude IS NOT DISTINCT FROM $5::numeric(9,6) AND longitude IS NOT DISTINCT FROM $6::numeric(9,6) LIMIT 1`,
                    [proposed.name,proposed.address,proposed.city,proposed.state,options.latitude??proposed.latitude,options.longitude??proposed.longitude]
                );
                businessId=existingVenue.rows[0]?.id;
                if (!businessId) {
                businessId=randomUUID();
                createdBusinessId=businessId;
                await client.query(`INSERT INTO businesses(id,name,address,city,state,postal_code,latitude,longitude)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[businessId,proposed.name,proposed.address,proposed.city,proposed.state,proposed.postalCode,options.latitude??proposed.latitude,options.longitude??proposed.longitude]);
                }
            }
            const location=(await client.query("SELECT latitude,longitude FROM businesses WHERE id=$1 FOR UPDATE",[businessId])).rows[0];
            if (location && (location.latitude == null || location.longitude == null) && options.latitude !== undefined) {
                location.latitude=options.latitude;location.longitude=options.longitude;
                const zone=venueTimeZone(location);
                await client.query('UPDATE businesses SET latitude=$2,longitude=$3 WHERE id=$1',[businessId,location.latitude,location.longitude]);
                await client.query('UPDATE experience_schedules SET time_zone=$2 FROM experiences e WHERE e.id=experience_schedules.experience_id AND e.business_id=$1',[businessId,zone]);
            }
            const event={...row.payload.event,schedule:{...row.payload.event.schedule,timeZone:row.payload.event.schedule.timeZone || venueTimeZone(location)}};
            if(!editing)ensureUnexpired(event,now);
            row.payload={venue:{businessId},event};
            await validateReferences(client,row.payload);
            if(!editing || row.status==='APPROVED') {
                const published=await publishExperience(client,{...event,businessId},editing?experienceId:null);
                if(published.duplicate) {
                    if(!options.automatic)throw Object.assign(new ReviewError(409,'DUPLICATE_EVENT','An event with this title, venue and start time is already published. Edit the existing listing instead.'),{experienceId:published.id});
                    if(createdBusinessId){
                        const canonical=await client.query('SELECT business_id FROM experiences WHERE id=$1',[published.id]);
                        row.payload.venue={businessId:canonical.rows[0].business_id};
                        await client.query('DELETE FROM businesses WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM experiences WHERE business_id=$1)',[createdBusinessId]);
                    }
                    await client.query(`UPDATE event_submissions SET status='REJECTED',published_experience_id=NULL,duplicate_of=$2,reviewed_by=$3,reviewed_at=CURRENT_TIMESTAMP,payload=$4::jsonb,revision=revision+1 WHERE id=$1`,[id,published.id,username,JSON.stringify(row.payload)]);
                    if(owns)await client.query('COMMIT');started=false;
                    return {id,status:'REJECTED',experienceId:null,duplicateOf:published.id};
                }
                experienceId=published.id;
            }
        }
        const status=editing?row.status:action;
        await client.query(`UPDATE event_submissions SET status=$2,published_experience_id=$3,
            reviewed_by=$4,reviewed_at=$5,payload=$6::jsonb,revision=revision+1,
            auto_publish_blocked=auto_publish_blocked OR $7,duplicate_of=NULL WHERE id=$1`,
            [id,status,experienceId,status==='PENDING'?null:username,status==='PENDING'?null:now,JSON.stringify(row.payload),editing]);
        if(owns)await client.query('COMMIT');started=false;
        return {id,status,experienceId};
    } catch(error) {
        if(started && owns){try{await client.query('ROLLBACK');}catch(rollbackError){releaseError=rollbackError;}}
        throw error;
    } finally {if(owns)client.release(releaseError);}
}
module.exports={submitEvent,reviewSubmission};
