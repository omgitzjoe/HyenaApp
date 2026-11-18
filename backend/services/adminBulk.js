const {reviewSubmission}=require('./submissions');
async function bulkEdit(pool,entries,event,username,now){
 const client=await pool.connect();let releaseError;
 try{
  await client.query('BEGIN');const items=[];
  for(const entry of [...entries].sort((a,b)=>a.id.localeCompare(b.id)))items.push(await reviewSubmission(pool,entry.id,'EDIT',username,{revision:entry.revision,event},now,client));
  await client.query('COMMIT');return items;
 }catch(error){try{await client.query('ROLLBACK');}catch(e){releaseError=e;}throw error;}finally{client.release(releaseError);}
}
module.exports={bulkEdit};
