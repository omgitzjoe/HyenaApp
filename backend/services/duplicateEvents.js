const { Temporal } = require('@js-temporal/polyfill');
const { distanceMiles, venueTimeZone } = require('./venueLocation');
const { occurrenceBounds } = require('./recurrence');

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

function weeklyIncludes(schedule, day) {
 return Temporal.PlainDate.compare(day,schedule.startDate)>=0 &&
  (!schedule.endDate || Temporal.PlainDate.compare(day,schedule.endDate)<=0) &&
  (schedule.weekdays || []).includes(day.dayOfWeek);
}

function sameOccurrence(a,b) {
 if(Boolean(a.allDay)!==Boolean(b.allDay))return false;
 if(a.kind==='ONCE' && b.kind==='ONCE'){
  return occurrenceBounds(a,a.startDate).startsAt===occurrenceBounds(b,b.startDate).startsAt;
 }
 if(a.kind==='ONCE' || b.kind==='ONCE'){
  const [once,weekly]=a.kind==='ONCE'?[a,b]:[b,a];
  const startsAt=occurrenceBounds(once,once.startDate).startsAt;
  const day=Temporal.Instant.from(startsAt).toZonedDateTimeISO(weekly.timeZone).toPlainDate();
  return weeklyIncludes(weekly,day) && occurrenceBounds(weekly,day).startsAt===startsAt;
 }
 // Weekly series at the same venue are compared in their stored local time.
 // End time and series start dates can differ without making an overlapping start unique.
 if(a.timeZone!==b.timeZone || (!a.allDay &&
  Temporal.PlainTime.compare(a.startTime,b.startTime)!==0))return false;
 const start=Temporal.PlainDate.from(a.startDate>b.startDate?a.startDate:b.startDate);
 for(let offset=0;offset<7;offset++){
  const day=start.add({days:offset});
  if(weeklyIncludes(a,day)&&weeklyIncludes(b,day))return true;
 }
 return false;
}

async function findDuplicate(client,data,venue,excludeId){
 const title=normalized(data.title);
 const schedule={...data.schedule,timeZone:data.schedule.timeZone || venueTimeZone(venue)};
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['hyena-event:'+title]);
 const result=await client.query(`SELECT e.id,e.title,b.id AS venue_id,b.name,b.address,b.city,b.state,b.latitude,b.longitude,
 s.kind,s.start_date::text AS "startDate",s.end_date::text AS "endDate",s.start_time AS "startTime",s.end_time AS "endTime",s.all_day AS "allDay",s.time_zone AS "timeZone",
 ARRAY(SELECT iso_weekday FROM experience_schedule_days d WHERE d.experience_id=e.id ORDER BY iso_weekday) AS weekdays
 FROM experiences e JOIN businesses b ON b.id=e.business_id JOIN experience_schedules s ON s.experience_id=e.id
 WHERE e.is_active AND b.is_active AND s.all_day=$1 AND ($2::uuid IS NULL OR e.id<>$2)
 ORDER BY (s.kind = 'WEEKLY') DESC, e.id`,[Boolean(schedule.allDay),excludeId || null]);
 for(const row of result.rows){
  if(normalized(row.title)!==title || !sameVenue(venue,{...row,id:row.venue_id}))continue;
  try{
   if(sameOccurrence(schedule,{...row,timeZone:row.timeZone || venueTimeZone(row)}))return row.id;
  }catch(error){if(!(error instanceof RangeError || error instanceof TypeError))throw error;}
 }
 return null;
}
module.exports={findDuplicate,normalized,sameVenue};
