const express=require('express');
const {z}=require('zod');
const querySchema=z.strictObject({areaId:z.uuid(),q:z.string().trim().max(100).default('')});
function createBusinessRouter({pool,logger=console}) {
    const router=express.Router();
    router.get('/',async(req,res)=>{
        const parsed=querySchema.safeParse(req.query);
        if(!parsed.success)return res.status(400).json({error:{code:'INVALID_VENUE_SEARCH',message:'Choose an area and a search of at most 100 characters.'}});
        const pattern='%'+parsed.data.q.replace(/[\\%_]/g,'\\$&')+'%';
        try{
            const result=await pool.query(`SELECT b.id,b.name,b.address,b.city,a.time_zone AS "timeZone"
                FROM businesses b JOIN discovery_areas a ON a.id=b.area_id
                WHERE b.is_active AND a.is_active AND a.id=$1 AND b.name ILIKE $2 ORDER BY b.name,b.id LIMIT 51`,[parsed.data.areaId,pattern]);
            res.json({items:result.rows.slice(0,50),hasMore:result.rows.length>50});
        }catch(error){logger.error('Venue search failed:',error.message);res.status(500).json({error:{code:'VENUES_FAILED',message:'Unable to load venues.'}});}
    });
    return router;
}
module.exports=createBusinessRouter;
