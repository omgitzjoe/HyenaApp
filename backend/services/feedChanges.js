const {createHash,randomUUID}=require('node:crypto');
const {ReviewError}=require('./publishExperience');
const {reviewSubmission}=require('./submissions');
function snapshot(item){
 const s=item.schedule || {};
 const time=v=>v?(v.length===5?v+':00':v):null;
 return {title:String(item.title || '').trim(),schedule:{kind:s.kind || 'ONCE',startDate:s.startDate || null,endDate:s.endDate || s.startDate || null,
  startTime:s.allDay?null:time(s.startTime),endTime:s.allDay?null:time(s.endTime),allDay:Boolean(s.allDay),timeZone:s.timeZone || 'America/Denver'},
  venue:{name:item.venueName || item.venue || 'Event location',address:item.address || item.venue || null,city:item.city || null,state:'ID',latitude:item.latitude??null,longitude:item.longitude??null},
  cancelled:item.issue==='Cancelled by the source'};
}
const canonical=value=>Array.isArray(value)?value.map(canonical):value && typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const signature=value=>JSON.stringify(canonical(value));
async function observe(pool,item){
 const current=snapshot(item);
 let previous=item.sourceSnapshot;
 if(!previous){
  const event=(item.requestPayload || item.storedPayload).event;
  previous=snapshot({title:event.title,schedule:event.schedule});
  previous.venue=current.venue;
  await pool.query('UPDATE event_submissions SET source_snapshot=$2::jsonb WHERE id=$1 AND source_snapshot IS NULL',[item.submissionId,JSON.stringify(previous)]);
 }
 if(signature(previous)===signature(current)){
  await pool.query("UPDATE feed_changes SET status='RESOLVED',resolved_at=CURRENT_TIMESTAMP,resolved_by='Source reverted' WHERE submission_id=$1 AND status='OPEN'",[item.submissionId]);return false;
 }
 const hash=createHash('sha256').update(signature(current)).digest('hex');
 const kind=current.cancelled?'CANCELLATION':signature(previous.schedule)!==signature(current.schedule)?'RESCHEDULE':'DETAILS';
 await pool.query("UPDATE feed_changes SET status='RESOLVED',resolved_at=CURRENT_TIMESTAMP,resolved_by='Superseded by source' WHERE submission_id=$1 AND fingerprint<>$2 AND status='OPEN'",[item.submissionId,hash]);
 await pool.query(`INSERT INTO feed_changes(id,submission_id,fingerprint,kind,previous,incoming) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)
 ON CONFLICT(submission_id,fingerprint) DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP,status='OPEN',previous=EXCLUDED.previous,incoming=EXCLUDED.incoming,resolved_at=NULL,resolved_by=NULL`,[randomUUID(),item.submissionId,hash,kind,JSON.stringify(previous),JSON.stringify(current)]);
 return true;
}
async function resolveChange(pool,id,action,username,{submissionRevision},venueLookup,now){
 const client=await pool.connect();let releaseError;
 try{
  await client.query('BEGIN');
  const result=await client.query("SELECT * FROM feed_changes WHERE id=$1 FOR UPDATE",[id]);const change=result.rows[0];
  if(!change || change.status!=='OPEN')throw new ReviewError(409,'CHANGE_CLOSED','Refresh the feed changes; this alert is no longer open.');
  const stored=await client.query('SELECT * FROM event_submissions WHERE id=$1 FOR UPDATE',[change.submission_id]);const row=stored.rows[0];
  if(row.revision!==submissionRevision)throw new ReviewError(409,'EDIT_CONFLICT','This listing changed. Refresh before applying a source update.');
  if(action==='apply'){
   if(row.payload.event.schedule?.kind==='WEEKLY' && change.incoming.schedule?.kind!=='WEEKLY' &&
      (change.kind==='CANCELLATION' || signature(change.previous.schedule)!==signature(change.incoming.schedule))){
    throw new ReviewError(409,'RECURRING_SERIES_REVIEW',
     'This update applies to one source occurrence, not the weekly series. Review the series before changing it.');
   }
   if(change.kind==='CANCELLATION'){
    if(row.status==='APPROVED')await reviewSubmission(pool,row.id,'PENDING',username,{},now,client);
    if(row.status!=='REJECTED')await reviewSubmission(pool,row.id,'REJECTED',username,{},now,client);
   }else{
    const {previous,incoming}=change;
    const event={};
    if(previous.title!==incoming.title)event.title=incoming.title;
    if(signature(previous.schedule)!==signature(incoming.schedule)){
     if(!incoming.schedule?.startDate)throw new ReviewError(400,'SOURCE_SCHEDULE_MISSING','The feed did not provide a usable schedule. Edit the listing manually, then dismiss this alert.');
     event.schedule=incoming.schedule;
    }
    const options={revision:row.revision,event};
    if(signature(previous.venue)!==signature(incoming.venue)){
     options.venue=await venueLookup.venue({proposal:incoming.venue});
    }
    await reviewSubmission(pool,row.id,'EDIT',username,options,now,client);
   }
  }
  await client.query('UPDATE event_submissions SET source_snapshot=$2::jsonb WHERE id=$1',[row.id,JSON.stringify(change.incoming)]);
  await client.query('UPDATE feed_changes SET status=$2,resolved_at=CURRENT_TIMESTAMP,resolved_by=$3 WHERE id=$1',[id,action==='apply'?'RESOLVED':'IGNORED',username]);
  await client.query('COMMIT');return {id,status:action==='apply'?'RESOLVED':'IGNORED'};
 }catch(error){try{await client.query('ROLLBACK');}catch(e){releaseError=e;}throw error;}finally{client.release(releaseError);}
}
module.exports={snapshot,observe,resolveChange};
