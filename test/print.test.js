import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JSDOM} from 'jsdom';
import {PDFDocument} from 'pdf-lib';
import {draft} from '../tax.js';
import {complete} from './helpers.js';
import {checkSnapshot,makePrintPdf} from '../print-pdf.js';
// Loads the page, fills a schedule figure, presses Download, and returns the snapshot it sent.
async function capture(answers){
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 global.window=dom.window;global.document=dom.window.document;let sent;
 global.fetch=async(url,options={})=>{if(url==='/api/print'){sent=JSON.parse(options.body).doc;return {ok:true,status:200,blob:async()=>new dom.window.Blob(['%PDF'])};}return {ok:true,status:200,json:async()=>({answers,step:0,updated:null,draft:draft(answers)})};};
 dom.window.URL.createObjectURL=()=>'blob:x';dom.window.URL.revokeObjectURL=()=>{};
 try{
  await import('../public/app.js?print'+Math.random());await new Promise(r=>setTimeout(r,30));
  const c1=document.getElementById('f-c-1');c1.value='70000';c1.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await document.getElementById('download').onclick();
  return sent;
 }finally{await new Promise(r=>setTimeout(r,600));dom.window.close();Object.assign(global,previous);}
}
test('Download sends the form exactly as shown, including template figures and schedules, for any year',async()=>{
 const doc=await capture(complete({reviewW2:'Yes',reviewBusiness:'Yes',taxYear:'2026'}));
 assert.equal(doc.year,'2026');assert.match(doc.notice,/template figures/);
 const row=l=>doc.rows.find(r=>r.line===l);
 assert.deepEqual(row('1a'),{line:'1a',label:'Total amount from Form(s) W-2, box 1',value:'$55,000',state:'template',strong:false});
 assert.equal(row('8').value,'$60,000');assert.equal(row('8').state,'form');
 assert.equal(row('9').state,'calc');assert.equal(row('9').strong,true);assert.match(row('9').value,/^\$/);
 assert.equal(row('16').state,'auto');
 assert.ok(doc.rows.some(r=>r.heading&&r.label==='Income'));
 assert.equal(doc.checks[0].title,'Filing Status');assert.equal(doc.checks[0].answer,'Single');assert.equal(doc.checks[0].template,true);
 const c=doc.forms.find(f=>f.title==='Schedule C');assert.ok(c);assert.match(c.stamp,/TEMPLATE/);
 assert.deepEqual(c.rows.find(r=>r.line==='1'),{line:'1',label:'Gross receipts or sales',value:'$70,000',state:'user',strong:false});
 assert.equal(c.rows.find(r=>r.line==='31').value,'$60,000');
 assert.deepEqual(doc.forms.map(f=>f.title),['Schedule 1','Schedule 2','Schedule C','Schedule SE','Form 8995']);
 // The snapshot renders to a multi-page PDF.
 const pdf=await PDFDocument.load(await makePrintPdf(doc));assert.ok(pdf.getPageCount()>=2);assert.match(pdf.getTitle(),/2026/);
});
test('the print endpoint returns a PDF and rejects malformed snapshots',async()=>{
 assert.throws(()=>checkSnapshot({year:'2030'}),/Invalid/);
 assert.throws(()=>checkSnapshot({year:'2025',rows:[{state:'evil'}]}),/Invalid/);
 assert.throws(()=>checkSnapshot({year:'2025',rows:Array(201).fill({})}),/Invalid/);
 const dir=await mkdtemp(join(tmpdir(),'filetax-print-'));const port=31894,base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DB_PATH:join(dir,'t.sqlite')},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('exit',c=>reject(Error('exit '+c)));});
  const headers={'Content-Type':'application/json',origin:base};
  let r=await fetch(base+'/api/print',{method:'POST',headers,body:JSON.stringify({doc:{year:'2026',rows:[{line:'1a',label:'Wages − W-2 → box 1',value:'$1',state:'template'}],forms:[{title:'Schedule C',rows:[]}]}})});
  assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/pdf');assert.match(r.headers.get('content-disposition'),/form1040-2026\.pdf/);
  assert.equal((await PDFDocument.load(await r.arrayBuffer())).getPageCount(),1);
  r=await fetch(base+'/api/print',{method:'POST',headers,body:JSON.stringify({doc:{year:'1999'}})});assert.equal(r.status,400);
 }finally{await new Promise(r=>{child.once('exit',r);child.kill();});await rm(dir,{recursive:true,force:true});}
});
