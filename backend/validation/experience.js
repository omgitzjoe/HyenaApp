const { z } = require('zod');
const { Temporal } = require('@js-temporal/polyfill');
const optionalText = z.string().trim().max(10000).nullable().default(null).transform(v=>v || null);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).transform(v=>v.length===5?v+':00':v);
const zone = z.string().trim().max(100).refine(value=>{try {new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}}).nullable().default(null);
const scheduleSchema = z.preprocess(value=>{
 if (!value || typeof value!=='object') return value;
 const s={...value};
 // Accept old installed clients while persisting only explicit dates.
 if (!s.allDay && s.endsNextDay && (s.kind || 'ONCE')==='ONCE' && s.startDate) {
  try {s.endDate=Temporal.PlainDate.from(s.startDate).add({days:1}).toString();}catch{}
 }
 delete s.endsNextDay;
 if(s.allDay) {s.startTime=null;s.endTime=null;}
 return s;
},z.strictObject({kind:z.enum(['ONCE','WEEKLY']).default('ONCE'),startDate:z.iso.date(),endDate:z.iso.date().nullable().default(null),
 startTime:time.nullable().default(null),endTime:time.nullable().default(null),allDay:z.boolean().default(false),timeZone:zone,
 weekdays:z.array(z.number().int().min(1).max(7)).max(7).refine(d=>new Set(d).size===d.length).default([])
}).superRefine((s,ctx)=>{
 const issue=(path,message)=>ctx.addIssue({code:'custom',path:[path],message});
 if(s.endDate && s.endDate<s.startDate)issue('endDate','End date must follow start date.');
 if(!s.allDay && !s.startTime)issue('startTime','Enter a start time or choose All Day.');
 if(!s.allDay && s.endTime && s.kind==='ONCE' && (!s.endDate || s.endDate===s.startDate) && s.endTime<=s.startTime)issue('endTime','Use a later end date for an overnight event.');
 if(s.kind==='WEEKLY' ? !s.weekdays.length : s.weekdays.length)issue('weekdays','Weekly schedules need weekdays; one-time events have none.');
}));
const createExperienceSchema=z.preprocess(value=>{
 if(!value || typeof value!=='object')return value;
 const v={...value};
 // Retired fields from older Android installs are ignored, never stored.
 for(const key of ['currency','offer','requirements','imageUrl'])delete v[key];
 return v;
},z.strictObject({businessId:z.uuid(),title:z.string().trim().min(1).max(200),description:optionalText,
 type:z.enum(['OTHER','OFFER','EVENT','ACTIVITY','SPECIAL']).default('OTHER'),
 priceAmount:z.string().regex(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/).nullable().default(null),
 sourceUrl:z.url().refine(v=>/^https?:\/\//.test(v)).nullable().default(null),
 categoryIds:z.array(z.uuid()).max(20).refine(ids=>new Set(ids).size===ids.length).default([]),schedule:scheduleSchema}));
const updateExperienceSchema=z.strictObject({title:z.string().trim().min(1).max(200).optional(),description:optionalText.optional(),type:z.enum(['OTHER','OFFER','EVENT','ACTIVITY','SPECIAL']).optional()})
 .refine(v=>Object.values(v).some(x=>x!==undefined));
module.exports={createExperienceSchema,updateExperienceSchema};
