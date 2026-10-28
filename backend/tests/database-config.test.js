const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {databaseConfig}=require('../config/database');
const pem='-----BEGIN CERTIFICATE-----\nTEST-ONLY-NOT-A-REAL-CERTIFICATE\n-----END CERTIFICATE-----';
const env={DB_HOST:'example.invalid',DB_PORT:'12345',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test-only'};
test('hosting PEM contents and escaped-newline values retain TLS verification',()=>{
    for(const ca of [pem,pem.replace(/\n/g,'\\n')]){
        const config=databaseConfig({...env,DB_SSL_CA:ca},__dirname);
        assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.ssl.ca,pem);
    }
});
test('local relative CA files continue to work',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hyena-ca-'));
    try{fs.writeFileSync(path.join(dir,'ca.pem'),pem);assert.equal(databaseConfig({...env,DB_SSL_CA_PATH:'ca.pem'},dir).ssl.ca,pem);}
    finally{fs.rmSync(dir,{recursive:true});}
});
test('hosting configuration fails clearly without credentials or valid CA input',()=>{
    assert.throws(()=>databaseConfig({...env,DB_PASSWORD:''},__dirname),/DB_PASSWORD/);
    assert.throws(()=>databaseConfig(env,__dirname),/DB_SSL_CA/);
    assert.throws(()=>databaseConfig({...env,DB_SSL_CA:'not a PEM'},__dirname),/PEM/);
    assert.throws(()=>databaseConfig({...env,DB_PORT:'oops',DB_SSL_CA:pem},__dirname),/DB_PORT/);
});
