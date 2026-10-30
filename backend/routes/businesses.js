const express = require('express');
const { z } = require('zod');
const { distanceMiles, venueTimeZone } = require('../services/venueLocation');
const coordinate = (min, max) => z.string().trim().min(1).transform(Number).pipe(z.number().finite().min(min).max(max));
const querySchema = z.strictObject({q:z.string().trim().max(100).default(''),latitude:coordinate(-90,90).optional(),longitude:coordinate(-180,180).optional()})
    .refine(x => (x.latitude === undefined) === (x.longitude === undefined));
function createBusinessRouter({pool,logger=console}) {
    const router = express.Router();
    router.get('/',async(req,res)=>{
        const parsed = querySchema.safeParse(req.query);
        if(!parsed.success)return res.status(400).json({error:{code:'INVALID_VENUE_SEARCH',message:'Provide a search and valid location coordinates.'}});
        const pattern = '%'+parsed.data.q.replace(/[\\%_]/g,'\\$&')+'%';
        try {
            const result = await pool.query(`SELECT id,name,address,city,latitude,longitude FROM businesses
                WHERE is_active AND latitude IS NOT NULL AND longitude IS NOT NULL AND name ILIKE $1 ORDER BY name,id`,[pattern]);
            const items = result.rows.map(row=>({...row,timeZone:venueTimeZone(row),...(parsed.data.latitude!==undefined?{distanceMiles:distanceMiles(parsed.data,row)}:{})}));
            if(parsed.data.latitude!==undefined)items.sort((a,b)=>a.distanceMiles-b.distanceMiles||a.id.localeCompare(b.id));
            res.json({items:items.slice(0,50),hasMore:items.length>50});
        } catch(error) {logger.error('Venue search failed:',error.message);res.status(500).json({error:{code:'VENUES_FAILED',message:'Unable to load venues.'}});}
    });
    return router;
}
module.exports = createBusinessRouter;
