const {scrypt,randomBytes,timingSafeEqual,createHash}=require('node:crypto');
const {promisify}=require('node:util');
const derive=promisify(scrypt);
const pattern=/^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/;
async function hashPassword(password){const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64);return `scrypt:${salt}:${key.toString('hex')}`;}
async function verifyPassword(password,encoded){const match=pattern.exec(encoded||'');if(!match)return false;const key=await derive(password,match[1],64);return timingSafeEqual(key,Buffer.from(match[2],'hex'));}
function configured(env){return typeof env.ADMIN_USERNAME==='string'&&env.ADMIN_USERNAME.trim().length>0&&env.ADMIN_USERNAME===env.ADMIN_USERNAME.trim()&&env.ADMIN_USERNAME.length<=100&&pattern.test(env.ADMIN_PASSWORD_HASH||'');}
const hashToken=value=>createHash('sha256').update(value).digest('hex');
module.exports={hashPassword,verifyPassword,configured,hashToken};
