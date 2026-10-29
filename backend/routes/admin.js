const express=require('express');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {z}=require('zod');
const {verifyPassword,configured,hashToken}=require('../services/adminPasswords');
const {reviewSubmission}=require('../services/submissions');
const {ReviewError}=require('../services/publishExperience');
const {requestLimit}=require('../middleware/requestLimits');
const cookieName='hyena_admin';
function sessionToken(req){const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));const token=value?.slice(cookieName.length+1);return /^[a-f0-9]{64}$/.test(token||'')?token:null;}
function sameOrigin(req,res,next){
    try{const origin=new URL(req.get('Origin'));if(origin.origin!==`${req.protocol}://${req.get('host')}`)throw Error();}
    catch{return res.status(403).json({error:{code:'ORIGIN_REQUIRED',message:'Use the dashboard on this server.'}});}
    if(!req.is('application/json'))return res.status(415).json({error:{code:'JSON_REQUIRED',message:'Send application/json.'}});
    next();
}
const approval=z.strictObject({businessId:z.uuid().optional(),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional(),note:z.string().trim().max(2000).optional()})
    .refine(x=>(x.latitude===undefined)===(x.longitude===undefined),{message:'Provide both latitude and longitude.'});
const rejection=z.strictObject({note:z.string().trim().min(1).max(2000)});
function createAdminRouter({pool,env=process.env,logger=console,clock=()=>new Date(),loginLimiter=requestLimit(5,15*60*1000)}){
    const router=express.Router();
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
    router.get('/api/session',(req,res)=>res.json({username:req.admin.username,csrfToken:req.admin.csrfToken}));
    router.post('/api/logout',async(req,res)=>{
        try{await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1',[req.admin.tokenHash]);res.clearCookie(cookieName,{httpOnly:true,sameSite:'strict',secure:env.NODE_ENV==='production',path:'/admin'});res.json({status:'signed-out'});}
        catch(error){logger.error('Admin logout failed:',error.message);res.status(500).json({error:{code:'LOGOUT_FAILED',message:'Unable to sign out. Retry.'}});}
    });
    router.get('/api/submissions',async(req,res)=>{
        const parsed=z.strictObject({status:z.enum(['PENDING','APPROVED','REJECTED']).default('PENDING'),before:z.uuid().optional()}).safeParse(req.query);
        if(!parsed.success)return res.status(400).json({error:{code:'INVALID_QUEUE_FILTER',message:'Choose a valid status and page cursor.'}});
        try{
            let cursor=null;
            if(parsed.data.before){const r=await pool.query('SELECT created_at::text AS created_at,id FROM event_submissions WHERE id=$1',[parsed.data.before]);if(!r.rows.length)return res.status(400).json({error:{code:'INVALID_CURSOR',message:'Reload the queue.'}});cursor=r.rows[0];}
            const result=await pool.query(`SELECT s.id,s.payload,s.status,s.published_experience_id AS "experienceId",s.created_at AS "createdAt",s.reviewed_at AS "reviewedAt",s.reviewed_by AS "reviewedBy",s.review_note AS "reviewNote",
                CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object('id',b.id,'name',b.name,'address',b.address,'city',b.city,'areaId',b.area_id,'isActive',b.is_active) END AS business
                FROM event_submissions s LEFT JOIN businesses b ON b.id::text=s.payload#>>'{venue,businessId}'
                WHERE s.status=$1 AND ($2::timestamptz IS NULL OR (s.created_at,s.id)<($2::timestamptz,$3::uuid))
                ORDER BY s.created_at DESC,s.id DESC LIMIT 51`,[parsed.data.status,cursor?.created_at??null,cursor?.id??null]);
            const items=result.rows.slice(0,50);res.json({items,nextCursor:result.rows.length>50?items[items.length-1].id:null});
        }catch(error){logger.error('Queue failed:',error.message);res.status(500).json({error:{code:'QUEUE_UNAVAILABLE',message:'Unable to load submissions. Check that migration 002 is applied.'}});}
    });
    for(const [route,status,schema] of [['approve','APPROVED',approval],['reject','REJECTED',rejection]]){
        router.post('/api/submissions/:id/'+route,async(req,res)=>{
            const id=z.uuid().safeParse(req.params.id),body=schema.safeParse(req.body);
            if(!id.success||!body.success)return res.status(400).json({error:{code:'INVALID_REVIEW',message:'Check the review note, venue ID, and coordinates.'}});
            try{res.json({item:await reviewSubmission(pool,id.data,status,req.admin.username,body.data,clock())});}
            catch(error){if(error instanceof ReviewError)return res.status(error.status).json({error:{code:error.code,message:error.message}});logger.error('Review failed:',error.message);res.status(500).json({error:{code:'REVIEW_FAILED',message:'Unable to complete review. Reload and retry.'}});}
        });
    }
    router.use('/api',(req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Unknown administrator endpoint.'}}));
    router.use(express.static(path.join(__dirname,'../public/admin'),{index:'index.html',etag:false}));
    return router;
}
module.exports={createAdminRouter};
