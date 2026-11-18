import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('HTTP storage, reload, isolation, validation, export and deletion',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'filetax-test-'));const port=31879;const base=`http://127.0.0.1:${port}`;let child;
 async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DB_PATH:join(dir,'test.sqlite')},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));});}
 async function stop(){await new Promise(r=>{child.once('exit',r);child.kill();});}
 try{await start();assert.equal((await fetch(base)).status,200);let r=await fetch(base+'/api/return');const cookie=r.headers.get('set-cookie').split(';')[0];const headers={'Content-Type':'application/json',origin:base,cookie};
 r=await fetch(base+'/api/return',{method:'PUT',headers,body:JSON.stringify({answers:{firstName:'Test',wages:55000},step:2})});assert.equal(r.status,200);
 await stop();await start();r=await fetch(base+'/api/return',{headers:{cookie}});assert.equal((await r.json()).answers.wages,55000);
 r=await fetch(base+'/api/return');assert.deepEqual((await r.json()).answers,{});
 r=await fetch(base+'/api/return',{method:'PUT',headers,body:JSON.stringify({answers:{firstName:'Test',wages:55000,reviewW2:'Not sure / skip',reviewBusiness:'No',reviewCompleted:'Yes'},step:-1})});assert.equal(r.status,200);
 r=await fetch(base+'/api/return',{headers:{cookie}});const reviewed=await r.json();assert.equal(reviewed.step,-1);assert.equal(reviewed.answers.reviewW2,'Not sure / skip');assert.equal(reviewed.answers.wages,55000);
 r=await fetch(base+'/api/return',{method:'PUT',headers,body:JSON.stringify({answers:{firstName:'Test',strategyBusinessExpenses:1200,strategyIRABudget:500},step:6})});assert.equal(r.status,200);
 r=await fetch(base+'/api/return',{headers:{cookie}});const planning=await r.json();assert.equal(planning.step,6);assert.equal(planning.answers.strategyBusinessExpenses,1200);assert.equal(planning.answers.strategyIRABudget,500);
 r=await fetch(base+'/api/return',{method:'PUT',headers,body:JSON.stringify({answers:{wages:-2},step:0})});assert.equal(r.status,400);
 r=await fetch(base+'/api/return',{method:'PUT',headers:{...headers,origin:'https://example.com'},body:'{}'});assert.equal(r.status,403);
 r=await fetch(base+'/api/pdf',{headers:{cookie}});assert.equal(r.status,200);assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0,4).toString(),'%PDF');
 r=await fetch(base+'/api/forms',{method:'POST',headers,body:JSON.stringify({answers:{wages:98765},format:'json'})});assert.equal(r.status,200);assert.equal((await r.json()).lines['1a'],98765);
 r=await fetch(base+'/api/forms',{method:'POST',headers,body:JSON.stringify({answers:{wages:98765},form:'1040'})});assert.equal(r.status,200);assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0,4).toString(),'%PDF');
 r=await fetch(base+'/api/forms',{method:'POST',headers,body:JSON.stringify({answers:{wages:-1},form:'1040'})});assert.equal(r.status,400);
 r=await fetch(base+'/api/forms',{method:'POST',headers,body:JSON.stringify({answers:{wages:1},form:'c'})});assert.equal(r.status,400);
 r=await fetch(base+'/api/return',{headers:{cookie}});assert.equal((await r.json()).answers.strategyBusinessExpenses,1200);
 r=await fetch(base+'/api/export',{headers:{cookie}});assert.equal((await r.json()).answers.firstName,'Test');
 r=await fetch(base+'/api/return',{method:'DELETE',headers});assert.equal(r.status,204);r=await fetch(base+'/api/return',{headers:{cookie}});assert.deepEqual((await r.json()).answers,{});
 }finally{if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});
