const express = require("express");
const { discoverExperiences } = require("../services/discovery");
const { DiscoveryQueryError } = require("../validation/discovery");

function createExperienceRouter({ pool, clock = () => new Date(), logger = console }) {
    const router = express.Router();

    router.get("/", async (req, res) => {
        try {
            res.json(await discoverExperiences(pool, req.query, clock(), logger));
        } catch (error) {
            if (error instanceof DiscoveryQueryError) {
                return res.status(400).json({ error: { code: error.code, message: error.message } });
            }
            logger.error("Failed to retrieve experiences:", error.message);
            res.status(500).json({ error: {
                code: "EXPERIENCES_FETCH_FAILED", message: "Unable to retrieve experiences."
            } });
        }
    });

    router.get('/saved-refresh',async(req,res)=>{
        const parsed=require('zod').z.string().max(4000).transform(v=>v.split(',')).pipe(require('zod').z.array(require('zod').z.uuid()).min(1).max(100)).safeParse(req.query.ids);
        if(!parsed.success)return res.status(400).json({error:{message:'Provide from 1 to 100 valid event IDs.'}});
        try{
            const ids=[...new Set(parsed.data.map(id=>id.toLowerCase()))];
            const items=await require('../services/experienceDetails').experienceDetails(pool,ids,clock());
            const found=new Set(items.map(i=>i.id));
            res.set('Cache-Control','no-store').json({items,unavailableIds:ids.filter(id=>!found.has(id))});
        }catch(error){logger.error('Saved refresh failed:',error.message);res.status(503).json({error:{message:'Unable to refresh saved events.'}});}
    });
    router.get('/:id',async(req,res)=>{
        if(!require('zod').z.uuid().safeParse(req.params.id).success)return res.status(400).json({error:{code:'INVALID_EXPERIENCE_ID',message:'Provide a valid event ID.'}});
        try{
            const items=await require('../services/experienceDetails').experienceDetails(pool,[req.params.id],clock());
            if(!items.length)return res.status(404).json({error:{code:'EXPERIENCE_NOT_FOUND',message:'This event is unavailable or has ended.'}});
            res.set('Cache-Control','no-store').json({item:items[0]});
        }catch(error){logger.error('Event details failed:',error.message);res.status(500).json({error:{message:'Unable to retrieve experience.'}});}
    });
    return router;
}
module.exports=createExperienceRouter;
