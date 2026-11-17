const { Temporal } = require('@js-temporal/polyfill');
const { occurrenceBounds, asInstant } = require('./recurrence');
const { venueTimeZone } = require('./venueLocation');
function isPastSchedule(schedule, now=new Date(), location) {
 try {
  const s={...schedule,timeZone:schedule.timeZone || venueTimeZone(location)};
  const kind=s.kind || s.scheduleKind;
  if(kind!=='ONCE' && kind!=='WEEKLY')return false;
  let last=s.startDate;
  if(kind==='WEEKLY') {
   if(!s.endDate || !s.weekdays?.length)return false;
   const end=Temporal.PlainDate.from(s.endDate);
   const dates=s.weekdays.map(day=>end.subtract({days:(end.dayOfWeek-day+7)%7})).filter(d=>Temporal.PlainDate.compare(d,s.startDate)>=0);
   if(!dates.length)return true;
   last=dates.sort(Temporal.PlainDate.compare).at(-1).toString();
  }
  return Temporal.Instant.compare(occurrenceBounds(s,last).endsAt,asInstant(now))<=0;
 }catch{return false;} // Incomplete drafts need review, rather than disappearing.
}
module.exports={isPastSchedule};
