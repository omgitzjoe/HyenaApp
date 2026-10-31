const express = require('express');
const {z} = require('zod');
const {randomUUID} = require('node:crypto');
const {requestLimit} = require('../middleware/requestLimits');
const reportSchema = z.strictObject({experienceId:z.uuid(),reason:z.enum(['CANCELLED','WRONG_TIME','WRONG_LOCATION','WRONG_PRICE','OTHER']),details:z.string().trim().max(1000).default('')});
function createReportRouter({pool,logger=console,limiter=requestLimit(5,60*60*1000)}) {
 const router=express.Router();
 router.post('/',limiter,async(req,res)=>{
  const parsed=reportSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:{code:'INVALID_REPORT',message:'Choose an event and reason, with details up to 1,000 characters.'}});
  try {
   const {experienceId,reason,details}=parsed.data;
   const result=await pool.query(`INSERT INTO event_reports(id,experience_id,reason,details) SELECT $1,id,$3,$4 FROM experiences WHERE id=$2 AND is_active RETURNING id`,[randomUUID(),experienceId,reason,details]);
   if(!result.rows.length)return res.status(404).json({error:{code:'EVENT_NOT_FOUND',message:'This event is no longer available.'}});
   return res.status(201).json({id:result.rows[0].id,status:'OPEN'});
  }catch(error){logger.error('Event report failed:',error.message);res.status(500).json({error:{code:'REPORT_FAILED',message:'Unable to submit the report. Please retry.'}});}
 });
 return router;
}
module.exports={createReportRouter,reportSchema};
