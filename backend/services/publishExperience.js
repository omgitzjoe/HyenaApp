const { venueTimeZone } = require('./venueLocation');
const { randomUUID } = require('node:crypto');
class ReviewError extends Error {constructor(status,code,message){super(message);this.status=status;this.code=code;}}
async function publishExperience(client,data,existingId=null){
 const result=await client.query('SELECT id,name,address,city,state,latitude,longitude FROM businesses WHERE id=$1 AND is_active FOR SHARE',[data.businessId]);
 if(!result.rows.length)throw new ReviewError(400,'INVALID_BUSINESS','Choose an active venue.');
 const categories=await client.query('SELECT id FROM categories WHERE id=ANY($1::uuid[]) FOR KEY SHARE',[data.categoryIds]);
 if(categories.rows.length!==data.categoryIds.length)throw new ReviewError(400,'INVALID_CATEGORIES','Choose existing categories.');
 const s={...data.schedule,timeZone:data.schedule.timeZone || venueTimeZone(result.rows[0])};
 const duplicate=await require('./duplicateEvents').findDuplicate(client,{...data,schedule:s},result.rows[0],existingId);
 if(duplicate)return {id:duplicate,title:data.title,duplicate:true};
 const id=existingId || randomUUID();
 await client.query(`INSERT INTO experiences(id,business_id,title,description,type,price_amount,source_url)
 VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET
 business_id=EXCLUDED.business_id,title=EXCLUDED.title,description=EXCLUDED.description,type=EXCLUDED.type,
 price_amount=EXCLUDED.price_amount,source_url=EXCLUDED.source_url,is_active=TRUE,updated_at=CURRENT_TIMESTAMP`,[id,data.businessId,data.title,data.description || null,data.type,data.priceAmount,data.sourceUrl]);
 await client.query(`INSERT INTO experience_schedules(experience_id,kind,start_date,end_date,start_time,end_time,all_day,time_zone)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(experience_id) DO UPDATE SET
 kind=EXCLUDED.kind,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,start_time=EXCLUDED.start_time,
 end_time=EXCLUDED.end_time,all_day=EXCLUDED.all_day,time_zone=EXCLUDED.time_zone`,[id,s.kind,s.startDate,s.endDate,s.startTime,s.endTime,s.allDay,s.timeZone || venueTimeZone(result.rows[0])]);
 if(existingId){await client.query('DELETE FROM experience_categories WHERE experience_id=$1',[id]);await client.query('DELETE FROM experience_schedule_days WHERE experience_id=$1',[id]);}
 if(data.categoryIds.length)await client.query('INSERT INTO experience_categories(experience_id,category_id) SELECT $1::uuid,unnest($2::uuid[])',[id,data.categoryIds]);
 if(s.weekdays.length)await client.query('INSERT INTO experience_schedule_days(experience_id,iso_weekday) SELECT $1::uuid,unnest($2::smallint[])',[id,s.weekdays]);
 return {id,title:data.title};
}
module.exports={publishExperience,ReviewError};
