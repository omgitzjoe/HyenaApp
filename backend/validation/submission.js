const { z } = require('zod');
const { Temporal } = require('@js-temporal/polyfill');
const { createExperienceSchema } = require('./experience');
const { resolveLocal, asInstant } = require('../services/recurrence');
const { ReviewError } = require('../services/publishExperience');
const text = max => z.string().trim().min(1).max(max);
const proposal = z.strictObject({
    areaId: z.uuid(), name: text(200), address: text(300), city: text(100),
    region: z.string().trim().max(100).nullable().default(null),
    postalCode: z.string().trim().max(20).nullable().default(null)
});
const envelope = z.strictObject({clientRequestId:z.uuid(),venue:z.union([
    z.strictObject({businessId:z.uuid()}),z.strictObject({proposal})
]),event:z.record(z.string(),z.unknown())});
function parseSubmission(input) {
    const result=envelope.safeParse(input);
    if(!result.success) return result;
    const body=result.data;
    if(Object.hasOwn(body.event,'businessId')) return {success:false,error:{issues:[{path:['event','businessId'],message:'Choose the venue separately.'}]}};
    const event=createExperienceSchema.safeParse({...body.event,businessId:body.venue.businessId||'00000000-0000-0000-0000-000000000000'});
    if(!event.success) return {success:false,error:{issues:event.error.issues.map(issue=>({...issue,path:['event',...issue.path]}))}};
    if(event.data.type!=='EVENT'||event.data.schedule.kind!=='ONCE'||(event.data.priceAmount!==null&&event.data.currency!=='USD')) {
        return {success:false,error:{issues:[{path:['event'],message:'Submit a one-time EVENT with USD pricing or an unknown price.'}]}};
    }
    const {businessId,...data}=event.data;
    return {success:true,data:{clientRequestId:body.clientRequestId,payload:{venue:body.venue,event:data}}};
}
function ensureUnexpired(event,now=new Date()) {
    const s=event.schedule;
    const day=Temporal.PlainDate.from(s.startDate);
    const start=resolveLocal(day.toPlainDateTime(s.startTime),s.timeZone,'start').toInstant();
    const end=resolveLocal((s.endsNextDay?day.add({days:1}):day).toPlainDateTime(s.endTime),s.timeZone,'end').toInstant();
    if(Temporal.Instant.compare(end,start)<=0||Temporal.Instant.compare(end,asInstant(now))<=0) {
        throw new ReviewError(400,'EVENT_ENDED','The event must have an end time in the future. Check its date and venue time zone.');
    }
}
module.exports={parseSubmission,ensureUnexpired};
