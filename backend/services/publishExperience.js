const { venueTimeZone } = require('./venueLocation');
const { randomUUID } = require('node:crypto');
class ReviewError extends Error {constructor(status,code,message){super(message);this.status=status;this.code=code;}}
async function publishExperience(client,data){
 const result=await client.query('SELECT id,latitude,longitude FROM businesses WHERE id=$1 AND is_active FOR SHARE',[data.businessId]);
 if(!result.rows.length)throw new ReviewError(400,'INVALID_BUSINESS','Choose an active venue.');
 const categories=await client.query('SELECT id FROM categories WHERE id=ANY($1::uuid[]) FOR KEY SHARE',[data.categoryIds]);
 if(categories.rows.length!==data.categoryIds.length)throw new ReviewError(400,'INVALID_CATEGORIES','Choose existing categories.');
 const id=randomUUID();
 await client.query(`INSERT INTO experiences(id,business_id,title,description,type,price_amount,source_url)
 VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,data.businessId,data.title,data.description || null,data.type,data.priceAmount,data.sourceUrl]);
 const s=data.schedule;
 await client.query(`INSERT INTO experience_schedules(experience_id,kind,start_date,end_date,start_time,end_time,all_day,time_zone)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,s.kind,s.startDate,s.endDate,s.startTime,s.endTime,s.allDay,s.timeZone || venueTimeZone(result.rows[0])]);
 if(data.categoryIds.length)await client.query('INSERT INTO experience_categories(experience_id,category_id) SELECT $1::uuid,unnest($2::uuid[])',[id,data.categoryIds]);
 if(s.weekdays.length)await client.query('INSERT INTO experience_schedule_days(experience_id,iso_weekday) SELECT $1::uuid,unnest($2::smallint[])',[id,s.weekdays]);
 return {id,title:data.title};
}
module.exports={publishExperience,ReviewError};
