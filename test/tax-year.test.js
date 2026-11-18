import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JSDOM} from 'jsdom';
import {assessment} from '../public/screening.js';
import {buildReturn,incomeTax,rateScheduleTax} from '../public/template.js';
import {params} from '../public/tax-years.js';
import {TaxReturn} from '../public/return-model.js';
import {draft} from '../tax.js';
import {complete} from './helpers.js';
const line=(b,id,n)=>b.forms.find(f=>f.id===id).lines.find(l=>l.line===n);
test('assessment questions and hints follow the chosen tax year',()=>{
 const labels=a=>assessment(a)[0].items.slice(0,2).map(q=>q.label);
 assert.deepEqual(labels({}),['Was your main home in the U.S. for most of 2025?','Were you married on December 31, 2025?']);
 assert.deepEqual(labels({taxYear:'2026'}),['Was your main home in the U.S. for most of 2026?','Were you married on December 31, 2026?']);
});
test('2026 uses its own rates, standard deduction, and form figures',()=>{
 assert.equal(rateScheduleTax(50000,'Single',2026),1240+(50000-12400)*.12);
 assert.equal(incomeTax(50000,'Single',0,2026),rateScheduleTax(50000,'Single',2026));
 assert.equal(draft({taxYear:'2026',status:'Married filing jointly',special:'No',deductionMethod:'Basic standard deduction'}).lines['12e'],32200);
 const a=complete({reviewW2:'Yes',reviewBusiness:'Yes',reviewHousehold:'Yes',quickFamily:'Yes'});
 const y25=buildReturn(a),y26=buildReturn({...a,taxYear:'2026'});
 assert.equal(new TaxReturn(y25.merged).snapshot().lines['12e'],23625);assert.equal(new TaxReturn(y26.merged).snapshot().lines['12e'],24150);
 assert.equal(line(y25,'se','9').value,176100-55000);assert.equal(line(y26,'se','9').value,184500-55000);
 assert.match(line(y26,'se','9').label,/\$184,500 wage base/);assert.match(line(y25,'se','9').label,/\$176,100 wage base/);
 const h=buildReturn({...a,taxYear:'2026',_forms:{h:{'1':2900}}});assert.equal(line(h,'h','8e').value,0);
 assert.ok(line(buildReturn({...a,_forms:{h:{'1':2900}}}),'h','8e').value>0);
 assert.match(y26.explain.tax,/^2026 Head of household tax rates/);
});
test('2026 dependent care credit uses the 50% to 20% rate schedule',()=>{
 const rate=params[2026].careRate;
 assert.equal(rate(15000,false),.5);assert.equal(rate(43000,false),.36);assert.equal(rate(60000,false),.35);
 assert.equal(rate(79000,false),.33);assert.equal(rate(200000,false),.2);assert.equal(rate(158000,true),.33);
 assert.equal(params[2025].careRate(60000),.2);
});
test('the year dropdown in the first question switches every year-specific label',async()=>{
 const answers=complete({reviewW2:'Yes',reviewBusiness:'Yes'});let stored=answers;
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'http://localhost:3000'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 global.window=dom.window;global.document=dom.window.document;
 global.fetch=async(url,options={})=>{if(options.method==='PUT')stored=JSON.parse(options.body).answers;return {ok:true,status:200,json:async()=>({answers:stored,step:0,updated:null,draft:draft(stored)})};};
 const $=s=>document.querySelector(s);
 try{
  await import('../public/app.js?year');await new Promise(r=>setTimeout(r,30));
  const picker=$('[data-question="reviewUSHome"] select#taxYear');assert.ok(picker);assert.equal(picker.value,'2025');
  assert.equal($('.form-year').textContent,'2025');assert.equal($('.badge').textContent,'2025 FEDERAL RETURN');
  picker.value='2026';picker.dispatchEvent(new dom.window.Event('change'));
  assert.equal($('.form-year').textContent,'2026');assert.equal($('.badge').textContent,'2026 FEDERAL RETURN');
  assert.match($('[data-question="reviewUSHome"]').textContent,/most of\s*20252026\s*\?/);assert.equal($('#taxYear').value,'2026');
  assert.match($('[data-question="quickMarried"]').textContent,/December 31, 2026/);
  assert.match($('label[for="estimated"]').textContent,/from 2025 return/);assert.match(document.body.textContent,/At any time during 2026/);
  assert.match($('[data-form="se"] [data-row="9"]').textContent,/\$184,500/);
  assert.equal($('#deduction').value,'16100');assert.equal($('#download').disabled,false);
  await new Promise(r=>setTimeout(r,600));assert.equal(stored.taxYear,'2026');
 }finally{dom.window.close();Object.assign(global,previous);}
});
test('the server refuses a 2026 PDF because only 2025 IRS forms are bundled',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'filetax-year-'));const port=31893,base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DB_PATH:join(dir,'t.sqlite')},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('exit',c=>reject(Error('exit '+c)));});
  const cookie=(await fetch(base+'/api/return')).headers.get('set-cookie').split(';')[0];const headers={'Content-Type':'application/json',origin:base,cookie};
  let r=await fetch(base+'/api/forms',{method:'POST',headers,body:JSON.stringify({answers:{taxYear:'2026',wages:1},form:'1040'})});
  assert.equal(r.status,400);assert.match((await r.json()).error,/2026 Form 1040/);
  r=await fetch(base+'/api/forms',{method:'POST',headers,body:JSON.stringify({answers:{taxYear:'2025',wages:1},form:'1040'})});assert.equal(r.status,200);
 }finally{await new Promise(r=>{child.once('exit',r);child.kill();});await rm(dir,{recursive:true,force:true});}
});
