const express=require('express');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {z}=require('zod');
const {verifyPassword,configured,hashToken}=require('../services/adminPasswords');
const {reviewSubmission}=require('../services/submissions');
const {ReviewError}=require('../services/publishExperience');
const {scheduleBounds}=require('../validation/submission');
const {venueTimeZone}=require('../services/venueLocation');
const {createVenueLookup}=require('../services/venueLookup');
const {requestLimit}=require('../middleware/requestLimits');
const {createEventImports,sources}=require('../services/eventImports');
const cookieName='hyena_admin';
function sessionToken(req){const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));const token=value?.slice(cookieName.length+1);return /^[a-f0-9]{64}$/.test(token||'')?token:null;}
function sameOrigin(req,res,next){
    try{const origin=new URL(req.get('Origin'));if(origin.origin!==`${req.protocol}://${req.get('host')}`)throw Error();}
    catch{return res.status(403).json({error:{code:'ORIGIN_REQUIRED',message:'Use the dashboard on this server.'}});}
    if(!req.is('application/json'))return res.status(415).json({error:{code:'JSON_REQUIRED',message:'Send application/json.'}});
    next();
}
const approval=z.strictObject({businessId:z.uuid().optional(),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional(),venue:z.record(z.string(),z.unknown()).optional(),event:z.record(z.string(),z.unknown()).optional(),note:z.string().trim().max(2000).optional(),revision:z.number().int().min(0).optional()})
    .refine(x=>(x.latitude===undefined)===(x.longitude===undefined),{message:'Provide both latitude and longitude.'});
const rejection=z.strictObject({note:z.string().trim().max(2000).optional(),revision:z.number().int().min(0).optional()});
const editing=approval.safeExtend({revision:z.number().int().min(0)});
function createAdminRouter({pool,env=process.env,logger=console,clock=()=>new Date(),loginLimiter=requestLimit(5,15*60*1000),importFetcher=fetch,venueLookup=createVenueLookup({pool}),eventImports=createEventImports({pool,clock,fetcher:importFetcher,venueLookup})}){
    const router=express.Router();
    function fromFeed(row) {
        return row.sourceKind==='FEED';
    }
    router.use((req,res,next)=>{
        res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
            'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
        next();
    });
    router.use('/api',(req,res,next)=>{
        if(!configured(env))return res.status(503).json({error:{code:'ADMIN_NOT_CONFIGURED',message:'Administrator sign-in is not configured. Follow the setup guide.'}});
        if(env.NODE_ENV==='production'&&!req.secure)return res.status(400).json({error:{code:'HTTPS_REQUIRED',message:'Use HTTPS for administrator sign-in.'}});
        next();
    });
    router.post('/api/login',loginLimiter,sameOrigin,async(req,res)=>{
        const parsed=z.strictObject({username:z.string().trim().min(1).max(100),password:z.string().min(1).max(256)}).safeParse(req.body);
        if(!parsed.success)return res.status(401).json({error:{code:'LOGIN_FAILED',message:'Invalid administrator credentials.'}});
        try{
            const valid=await verifyPassword(parsed.data.password,env.ADMIN_PASSWORD_HASH);
            if(!valid||parsed.data.username!==env.ADMIN_USERNAME)return res.status(401).json({error:{code:'LOGIN_FAILED',message:'Invalid administrator credentials.'}});
            await pool.query('DELETE FROM admin_sessions WHERE expires_at <= CURRENT_TIMESTAMP');
            const old=sessionToken(req);if(old)await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1',[hashToken(old)]);
            const token=randomBytes(32).toString('hex'),csrfToken=randomBytes(32).toString('hex');
            await pool.query(`INSERT INTO admin_sessions(token_hash,username,credential_version,csrf_token,expires_at)
                VALUES ($1,$2,$3,$4,$5)`,[hashToken(token),env.ADMIN_USERNAME,hashToken(env.ADMIN_PASSWORD_HASH),csrfToken,new Date(clock().getTime()+8*60*60*1000)]);
            res.cookie(cookieName,token,{httpOnly:true,sameSite:'strict',secure:env.NODE_ENV==='production',path:'/admin',maxAge:8*60*60*1000});
            res.json({username:env.ADMIN_USERNAME,csrfToken});
        }catch(error){logger.error('Admin sign-in failed:',error.message);res.status(500).json({error:{code:'LOGIN_UNAVAILABLE',message:'Unable to sign in. Check migration and server configuration.'}});}
    });
    router.use('/api',async(req,res,next)=>{
        const token=sessionToken(req);
        if(!token)return res.status(401).json({error:{code:'ADMIN_AUTH_REQUIRED',message:'Sign in to review submissions.'}});
        try{
            const result=await pool.query(`SELECT username,csrf_token AS "csrfToken" FROM admin_sessions
                WHERE token_hash=$1 AND expires_at>$2 AND credential_version=$3 AND username=$4`,[hashToken(token),clock(),hashToken(env.ADMIN_PASSWORD_HASH),env.ADMIN_USERNAME]);
            if(!result.rows.length)return res.status(401).json({error:{code:'SESSION_EXPIRED',message:'Sign in again.'}});
            req.admin={...result.rows[0],tokenHash:hashToken(token)};
            if(req.method!=='GET'){
                if(req.get('X-CSRF-Token')!==req.admin.csrfToken)return res.status(403).json({error:{code:'CSRF_REQUIRED',message:'Reload the dashboard and try again.'}});
                return sameOrigin(req,res,next);
            }
            next();
        }catch(error){logger.error('Admin session failed:',error.message);res.status(500).json({error:{code:'SESSION_UNAVAILABLE',message:'Unable to verify administrator session.'}});}
    });
    router.get('/api/venue-search', requestLimit(20,60*1000), async (req,res) => {
        const query=z.string().trim().min(3).max(250).safeParse(req.query.q);
        if (!query.success) return res.status(400).json({error:{message:'Type at least three characters.'}});
        try {
            const pattern='%'+query.data.replace(/[\\%_]/g,'\\$&')+'%';
            const saved=await pool.query(
                `SELECT id AS "businessId",name,address,city,state,latitude,longitude FROM businesses
                 WHERE is_active
                 AND (name ILIKE $1 OR address ILIKE $1) ORDER BY name LIMIT 8`,[pattern]
            );
            const local=saved.rows.map(place=>({...place,label:[place.name,place.address,place.city].join(', ')}));
            let external=[];
            try { external=await venueLookup.search(query.data); }
            catch(error) { if(!local.length) throw error; }
            res.json({items:[...local,...external]});
        }
        catch(error) {
            res.status(error instanceof ReviewError ? error.status : 503).json({error:{message:error instanceof ReviewError ? error.message : 'Venue search is temporarily unavailable.'}});
        }
    });
    const imports = eventImports;
    router.get('/api/event-imports', async (req, res) => {
        try { res.json({ feeds: await imports.preview() }); }
        catch (error) {
            logger.error('Event import preview failed:', error.message);
            res.status(500).json({ error: { message: 'Unable to preview event feeds.' } });
        }
    });
    router.post('/api/event-imports/sync', async (req, res) => {
        try { res.json(await imports.sync({ refresh: true })); }
        catch (error) {
            logger.error('Event feed sync failed:', error.message);
            res.status(502).json({ error: { message: 'Unable to check feeds right now.' } });
        }
    });
    router.post('/api/event-imports/dismiss', async (req, res) => {
        const parsed = z.strictObject({ source: z.enum(Object.keys(sources)), id: z.uuid() }).safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: { message: 'Choose a feed event to dismiss.' } });
        try {
            await imports.dismiss(parsed.data, req.admin.username);
            res.json({ status: 'REJECTED' });
        } catch (error) {
            if (error instanceof ReviewError) return res.status(error.status).json({ error: { message: error.message } });
            logger.error('Event import dismissal failed:', error.message);
            res.status(502).json({ error: { message: 'Unable to dismiss this feed event.' } });
        }
    });
    router.post('/api/event-imports', async (req, res) => {
        const parsed = z.strictObject({
            source: z.enum(Object.keys(sources)), id: z.uuid(), categoryId: z.uuid().optional(),
            venue: z.record(z.string(), z.unknown())
        }).safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: { message: 'Choose a feed event, category, and venue.' } });
        try {
            const input=parsed.data;
            if (!input.categoryId) {
                const category=await pool.query("SELECT id FROM categories WHERE slug='other' OR lower(name)='other' ORDER BY slug LIMIT 1");
                input.categoryId=category.rows[0]?.id;
            }
            const result = await imports.queue(input);
            res.status(result.created ? 201 : 200).json(result);
        } catch (error) {
            if (error instanceof ReviewError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
            logger.error('Event import failed:', error.message);
            res.status(502).json({ error: { message: 'Unable to queue this feed event. Reload the preview and retry.' } });
        }
    });
    router.get('/api/reports',async(req,res)=>{
        try { const result=await pool.query(`SELECT r.id,r.reason,r.details,r.created_at AS "createdAt",e.id AS "experienceId",e.title,b.name AS "businessName" FROM event_reports r JOIN experiences e ON e.id=r.experience_id JOIN businesses b ON b.id=e.business_id WHERE r.status='OPEN' ORDER BY r.created_at,r.id LIMIT 100`);res.json({items:result.rows}); }
        catch(error){logger.error('Report queue failed:',error.message);res.status(500).json({error:{message:'Unable to load event reports.'}});}
    });
    router.post('/api/reports/:id/resolve',async(req,res)=>{
        if(!z.uuid().safeParse(req.params.id).success)return res.status(400).json({error:{message:'Invalid report ID.'}});
        try {const result=await pool.query("UPDATE event_reports SET status='RESOLVED',reviewed_at=CURRENT_TIMESTAMP,reviewed_by=$2 WHERE id=$1 AND status='OPEN' RETURNING id",[req.params.id,req.admin.username]);if(!result.rows.length)return res.status(404).json({error:{message:'Report is already resolved or unavailable.'}});res.json({status:'RESOLVED'});}
        catch(error){logger.error('Report resolution failed:',error.message);res.status(500).json({error:{message:'Unable to resolve report.'}});}
    });
    router.post('/api/submissions/bulk-edit',async(req,res)=>{
        const schema=z.strictObject({entries:z.array(z.strictObject({id:z.uuid(),revision:z.number().int().min(0)})).min(1).max(50).refine(values=>new Set(values.map(v=>v.id)).size===values.length),event:z.strictObject({
            categoryIds:z.array(z.uuid()).max(20).refine(ids=>new Set(ids).size===ids.length).optional(),
            priceAmount:z.string().regex(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/).nullable().optional()
        }).refine(value=>Object.keys(value).length>0)});
        const parsed=schema.safeParse(req.body);
        if(!parsed.success)return res.status(400).json({error:{message:'Select up to 50 entries and a valid category or price change.'}});
        try{res.json({items:await require('../services/adminBulk').bulkEdit(pool,parsed.data.entries,parsed.data.event,req.admin.username,clock())});}
        catch(error){logger.error('Bulk edit failed:',error.message);res.status(error instanceof ReviewError?error.status:500).json({error:{message:error instanceof ReviewError?error.message:'Unable to save the batch. No changes were applied.'}});}
    });
    router.get('/api/feed-changes',async(req,res)=>{
        try{
            const result=await pool.query(`SELECT c.id,c.kind,c.previous,c.incoming,c.last_seen_at AS "lastSeenAt",s.id AS "submissionId",s.revision AS "submissionRevision",s.status AS "submissionStatus" FROM feed_changes c JOIN event_submissions s ON s.id=c.submission_id WHERE c.status='OPEN' ORDER BY c.last_seen_at DESC,c.id`);
            res.json({items:result.rows});
        }catch(error){logger.error('Feed alerts failed:',error.message);res.status(503).json({error:{message:'Unable to load source updates.'}});}
    });
    for(const action of ['apply','dismiss'])router.post('/api/feed-changes/:id/'+action,async(req,res)=>{
        const id=z.uuid().safeParse(req.params.id),body=z.strictObject({submissionRevision:z.number().int().min(0)}).safeParse(req.body);
        if(!id.success || !body.success)return res.status(400).json({error:{message:'Refresh this source update before reviewing.'}});
        try{res.json({item:await require('../services/feedChanges').resolveChange(pool,id.data,action,req.admin.username,body.data,venueLookup,clock())});}
        catch(error){logger.error('Feed update failed:',error.message);res.status(error instanceof ReviewError?error.status:500).json({error:{message:error instanceof ReviewError?error.message:'Unable to resolve this source update.'}});}
    });
    router.get('/api/session',(req,res)=>res.json({username:req.admin.username,csrfToken:req.admin.csrfToken}));
    router.post('/api/logout',async(req,res)=>{
        try{await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1',[req.admin.tokenHash]);res.clearCookie(cookieName,{httpOnly:true,sameSite:'strict',secure:env.NODE_ENV==='production',path:'/admin'});res.json({status:'signed-out'});}
        catch(error){logger.error('Admin logout failed:',error.message);res.status(500).json({error:{code:'LOGOUT_FAILED',message:'Unable to sign out. Retry.'}});}
    });
    router.get('/api/submissions',async(req,res)=>{
        const parsed=z.strictObject({status:z.enum(['PENDING','APPROVED','REJECTED']).default('PENDING'),before:z.uuid().optional(),q:z.string().trim().max(200).default(''),includePast:z.enum(['true','false']).default('false'),origin:z.enum(['all','USER','FEED']).default('all')}).safeParse(req.query);
        if(!parsed.success)return res.status(400).json({error:{code:'INVALID_QUEUE_FILTER',message:'Check the status and listing filters.'}});
        try{
            let cursor=null;
            if(parsed.data.before){const found=await pool.query('SELECT created_at::text AS created_at,id,source_kind FROM event_submissions WHERE id=$1',[parsed.data.before]);cursor=found.rows[0];if(!cursor)return res.status(400).json({error:{message:'Reload the queue.'}});}
            const pattern='%'+parsed.data.q.replace(/[\\%_]/g,'\\$&')+'%';
            const result=await pool.query(`SELECT s.id,s.payload,s.status,s.source_kind AS "sourceKind",s.revision,s.duplicate_of AS "duplicateOf",s.published_experience_id AS "experienceId",s.created_at AS "createdAt",s.reviewed_at AS "reviewedAt",s.reviewed_by AS "reviewedBy",
                CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object('id',b.id,'name',b.name,'address',b.address,'city',b.city,'state',b.state,'latitude',b.latitude,'longitude',b.longitude,'isActive',b.is_active) END AS business,
                COALESCE(e.is_active,TRUE) AS "listingActive"
                FROM event_submissions s LEFT JOIN experiences e ON e.id=s.published_experience_id
                LEFT JOIN businesses b ON b.id::text=COALESCE(e.business_id::text,s.payload#>>'{venue,businessId}')
                WHERE s.status=$1 AND ($4='all' OR s.source_kind=$4)
                AND (s.payload#>>'{event,title}' ILIKE $5 OR COALESCE(b.name,s.payload#>>'{venue,proposal,name}') ILIKE $5)
                AND ($2::timestamptz IS NULL OR
                    CASE WHEN s.source_kind='USER' THEN 0 ELSE 1 END > $6::int OR
                    (CASE WHEN s.source_kind='USER' THEN 0 ELSE 1 END = $6::int AND (s.created_at,s.id)<($2::timestamptz,$3::uuid)))
                ORDER BY CASE WHEN s.source_kind='USER' THEN 0 ELSE 1 END,s.created_at DESC,s.id DESC`,
                [parsed.data.status,cursor?.created_at??null,cursor?.id??null,parsed.data.origin,pattern,cursor?.source_kind==='FEED'?1:0]);
            const now=clock();
            const candidates=result.rows.map(row=>{
                const location=row.payload.venue.proposal||row.business;
                const past=require('../services/eventLifecycle').isPastSchedule(row.payload.event.schedule || {},now,location);
                let occurrence=null;
                try{occurrence=scheduleBounds({...row.payload.event.schedule,timeZone:row.payload.event.schedule?.timeZone || venueTimeZone(location)});}catch{}
                return {...row,fromFeed:fromFeed(row),past,occurrence};
            }).filter(row=>parsed.data.includePast==='true' || (!row.past && row.listingActive));
            const items=candidates.slice(0,50);
            res.json({items,nextCursor:candidates.length>50?items.at(-1).id:null});
        }catch(error){logger.error('Queue failed:',error.message);res.status(500).json({error:{code:'QUEUE_UNAVAILABLE',message:'Unable to load submissions.'}});}
    });
    for(const [route,status,schema] of [['edit','EDIT',editing],['approve','APPROVED',approval],['reject','REJECTED',rejection],['undo','PENDING',z.strictObject({revision:z.number().int().min(0).optional()})]]){
        router.post('/api/submissions/:id/'+route,async(req,res)=>{
            const id=z.uuid().safeParse(req.params.id),body=schema.safeParse(req.body);
            if(!id.success||!body.success)return res.status(400).json({error:{code:'INVALID_REVIEW',message:'Check the event details and venue.'}});
            try{
                const options=body.data;
                delete options.note;
                if (options.venue) {
                    options.venue=await venueLookup.venue(options.venue);
                    if (options.venue.businessId) {
                        if (!z.uuid().safeParse(options.venue.businessId).success) throw new ReviewError(400,'VENUE_INVALID','Choose a valid venue.');
                        options.businessId=options.venue.businessId;
                        delete options.venue;
                    }
                    const valid=options.venue ? require('../validation/submission').proposalSchema.safeParse(options.venue.proposal) : {success:true};
                    if (!valid.success) throw new ReviewError(400,'VENUE_INVALID','Check the venue details.',
                        valid.error.issues.slice(0,8).map(issue=>({field:['venue',...issue.path].join('.'),message:issue.message})));
                }
                res.json({item:await reviewSubmission(pool,id.data,status,req.admin.username,options,clock())});
            }
            catch(error){if(error instanceof ReviewError)return res.status(error.status).json({error:{code:error.code,message:error.message,fields:error.fields}});logger.error('Review failed:',error.message);res.status(500).json({error:{code:'REVIEW_FAILED',message:'Unable to complete review. Reload and retry.'}});}
        });
    }
    router.use('/api',(req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Unknown administrator endpoint.'}}));
    router.use(express.static(path.join(__dirname,'../public/admin'),{index:'index.html',etag:false}));
    return router;
}
module.exports={createAdminRouter};
