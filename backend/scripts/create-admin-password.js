const readline=require('node:readline');
const {Writable}=require('node:stream');
const {hashPassword}=require('../services/adminPasswords');
let muted=false;
const output=new Writable({write(chunk,encoding,next){if(!muted)process.stdout.write(chunk);next();}});
const reader=readline.createInterface({input:process.stdin,output,terminal:true});
process.stdout.write('New administrator password (12–256 characters; input hidden): ');
muted=true;
reader.question('',async password=>{
    reader.close();process.stdout.write('\n');
    if(password.length<12||password.length>256){console.error('Use 12–256 characters.');process.exitCode=1;return;}
    try{console.log('Set ADMIN_PASSWORD_HASH to the following value privately:\n'+await hashPassword(password));}
    catch{console.error('Unable to generate the password hash.');process.exitCode=1;}
});
