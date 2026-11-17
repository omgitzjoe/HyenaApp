const { z } = require('zod');
const { createExperienceSchema } = require('./experience');
const { occurrenceBounds } = require('../services/recurrence');
const { asInstant } = require('../services/recurrence');
const { ReviewError } = require('../services/publishExperience');
const { Temporal } = require('@js-temporal/polyfill');
const text=max=>z.string().trim().min(1).max(max);
const optional=max=>z.string().trim().max(max).nullable().default(null);
const proposal=z.preprocess(value=>{if(!value || typeof value!=='object')return value;const p={...value};if(p.region && !p.state)p.state=p.region;delete p.region;return p;},z.strictObject({
 name:text(200),address:optional(300),city:optional(100),state:optional(100),postalCode:optional(20),
 latitude:z.number().min(-90).max(90).nullable().default(null),longitude:z.number().min(-180).max(180).nullable().default(null)
}).refine(p=>(p.latitude===null)===(p.longitude===null),{message:'Provide both coordinates.'})
 .refine(p=>p.latitude!==null || Boolean(p.city && p.state),{message:'Provide city and state, or latitude and longitude.'}));
const envelope=z.strictObject({clientRequestId:z.uuid(),venue:z.union([z.strictObject({businessId:z.uuid()}),z.strictObject({proposal})]),event:z.record(z.string(),z.unknown())});
function parseSubmission(input){
 const parsed=envelope.safeParse(input);if(!parsed.success)return parsed;
 const body=parsed.data;
 if(Object.hasOwn(body.event,'businessId'))return {success:false,error:{issues:[{path:['event','businessId'],message:'Choose the venue separately.'}]}};
 const event=createExperienceSchema.safeParse({...body.event,businessId:body.venue.businessId || '00000000-0000-4000-8000-000000000000'});
 if(!event.success)return {success:false,error:{issues:event.error.issues.map(i=>({...i,path:['event',...i.path]}))}};
 const {businessId,...data}=event.data;
 return {success:true,data:{clientRequestId:body.clientRequestId,payload:{venue:body.venue,event:data}}};
}
function scheduleBounds(schedule){return occurrenceBounds({...schedule,scheduleKind:schedule.kind},schedule.startDate);}
function ensureUnexpired(event,now=new Date()){
 const bounds=scheduleBounds(event.schedule);
 if(Temporal.Instant.compare(bounds.endsAt,asInstant(now))<=0)throw new ReviewError(400,'EVENT_ENDED','The event must be in the future or currently happening.');
}
module.exports={parseSubmission,proposalSchema:proposal,ensureUnexpired,scheduleBounds};
