const { distanceMiles } = require('./venueLocation');
function normalized(value){return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');}
function sameVenue(a,b){
 if(a.id===b.id)return true;
 if(a.state && b.state && normalized(a.state)!==normalized(b.state))return false;
 const sameCity=normalized(a.city) && normalized(a.city)===normalized(b.city);
 const name=normalized(a.name)===normalized(b.name);
 const address=normalized(a.address) && normalized(a.address)===normalized(b.address) && sameCity;
 const coordinates=[a.latitude,a.longitude,b.latitude,b.longitude].every(v=>v!=null);
 if(coordinates && distanceMiles(a,b)>0.05)return false;
 return Boolean(address || (name && coordinates && distanceMiles(a,b)<=0.02));
}
async function findDuplicate(client,data,venue,excludeId){
 const {scheduleBounds}=require('../validation/submission');
 const title=normalized(data.title);
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['hyena-event:'+title]);
 const result=await client.query(`SELECT e.id,e.title,b.id AS venue_id,b.name,b.address,b.city,b.state,b.latitude,b.longitude,
 s.kind,s.start_date::text AS "startDate",s.end_date::text AS "endDate",s.start_time AS "startTime",s.end_time AS "endTime",s.all_day AS "allDay",s.time_zone AS "timeZone",
 ARRAY(SELECT iso_weekday FROM experience_schedule_days d WHERE d.experience_id=e.id ORDER BY iso_weekday) AS weekdays
 FROM experiences e JOIN businesses b ON b.id=e.business_id JOIN experience_schedules s ON s.experience_id=e.id
 WHERE e.is_active AND b.is_active AND s.kind=$1 AND ($2::uuid IS NULL OR e.id<>$2)`,[data.schedule.kind,excludeId || null]);
 for(const row of result.rows){
  if(normalized(row.title)!==title || !sameVenue(venue,{...row,id:row.venue_id}))continue;
  if(Boolean(row.allDay)!==Boolean(data.schedule.allDay))continue;
  try{
   if(data.schedule.kind==='ONCE'){
    if(scheduleBounds(row).startsAt===scheduleBounds(data.schedule).startsAt)return row.id;
   }else if(['startDate','endDate','startTime','endTime','timeZone'].every(k=>(row[k] || null)===(data.schedule[k] || null)) && JSON.stringify(row.weekdays)===JSON.stringify([...data.schedule.weekdays].sort()))return row.id;
  }catch{continue;}
 }
 return null;
}
module.exports={findDuplicate,normalized,sameVenue};
