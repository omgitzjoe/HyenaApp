const express=require('express');
const {parseSubmission}=require('../validation/submission');
const {submitEvent}=require('../services/submissions');
const {ReviewError}=require('../services/publishExperience');
const {requestLimit}=require('../middleware/requestLimits');
function createSubmissionRouter({pool,clock=()=>new Date(),logger=console,limiter=requestLimit(10,60*60*1000)}) {
    const router=express.Router();
    router.post('/',limiter,async(req,res)=>{
        if(!req.is('application/json'))return res.status(415).json({error:{code:'JSON_REQUIRED',message:'Send application/json.'}});
        const validation=parseSubmission(req.body);
        if(!validation.success)return res.status(400).json({error:{code:'INVALID_SUBMISSION',message:'Check the submission fields.',details:validation.error.issues.map(x=>({field:x.path.join('.'),message:x.message}))}});
        try{
            const result=await submitEvent(pool,validation.data,clock());
            res.status(result.created?201:200).json({item:result.item});
        }catch(error){
            if(error instanceof ReviewError)return res.status(error.status).json({error:{code:error.code,message:error.message}});
            logger.error('Submission failed:',error.message);
            res.status(500).json({error:{code:'SUBMISSION_FAILED',message:'Unable to submit right now. Retry with the same request ID.'}});
        }
    });
    return router;
}
module.exports=createSubmissionRouter;
