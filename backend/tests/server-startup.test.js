const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
test('hosted startup exposes route hints and shuts down cleanly on SIGTERM',async()=>{
    const code=`
        const express=require('express');
        const file=require.resolve('./db');
        require.cache[file]={id:file,filename:file,loaded:true,exports:{query:async()=>({rows:[]}),end:async()=>{}}};
        process.env.PORT='0';
        const listen=express.application.listen;
        express.application.listen=function(...args){const server=listen.apply(this,args);server.on('listening',()=>console.log('TEST_PORT:'+server.address().port));return server;};
        require('./server');
    `;
    const child=spawn(process.execPath,['-e',code],{cwd:path.join(__dirname,'..'),env:{...process.env,CURATOR_API_KEY:randomBytes(32).toString('hex')}});
    const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
    let errors='';child.stderr.on('data',data=>{errors+=data;});
    try{
        const port=await new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(Error('Startup timed out: '+errors)),10000);
            let output='';
            child.stdout.on('data',data=>{output+=data;const match=output.match(/TEST_PORT:(\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
            child.once('exit',()=>{clearTimeout(timer);reject(Error('Startup failed: '+errors));});
        });
        const base='http://127.0.0.1:'+port;
        assert.equal((await (await fetch(base+'/')).json()).service,'hyena-api');
        assert.equal((await fetch(base+'/health/db')).status,200);
        assert.equal((await fetch(base+'/api/v1/categories')).status,200);
        child.kill('SIGTERM');assert.equal((await exit).code,0);
    }finally{if(child.exitCode===null)child.kill('SIGKILL');}
});
