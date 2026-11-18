import test from 'node:test';
import assert from 'node:assert/strict';
import {assessment,bothSpouses} from '../public/screening.js';
import {buildReturn,templatePlan} from '../public/template.js';
import {keyPoints} from '../public/key-points.js';
import {applyBenefit,removeBenefit} from '../public/apply.js';
import {TaxReturn} from '../public/return-model.js';
import {validate} from '../public/base-tax.js';
// Sweeps random combinations of Quick Assessment answers, tax years, and user figures, and
// checks that every combination produces a complete, consistent return.
let seed=20251;const rand=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
const pick=list=>list[Math.floor(rand()*list.length)];
function randomAnswers(){
 let a={taxYear:pick(['2025','2026'])};
 for(let i=0;i<10;i++){
  const open=assessment(a).flatMap(g=>g.items.flatMap(q=>q.rows.map(r=>[r.key,q]))).filter(([k])=>!(k in a));
  if(!open.length)break;
  for(const [k,q] of open)a[k]=rand()<.08?undefined:pick(q.options);
 }
 a=Object.fromEntries(Object.entries(a).filter(([,v])=>v!==undefined));
 // Sometimes the user has typed their own figures.
 if(rand()<.4)a.wages=Math.round(rand()*400000);
 if(rand()<.2)a.status=pick(['Single','Married filing jointly','Married filing separately','Head of household','Qualifying surviving spouse']);
 if(rand()<.2)a._forms={c:{'1':Math.round(rand()*300000),'28':Math.round(rand()*350000)}};
 if(rand()<.1)a._forms={...a._forms,'8949':{'II-d':1000,'II-e':Math.round(rand()*60000)}};
 return a;
}
const Y=v=>v==='Yes';
test('thousands of answer combinations build a complete, consistent return',()=>{
 const counts={status:{},forms:{}};let checked=0,applied=0;
 for(let n=0;n<2500;n++){
  const a=randomAnswers();
  assert.doesNotThrow(()=>validate(a),JSON.stringify(a));
  let b;assert.doesNotThrow(()=>{b=buildReturn(a);},JSON.stringify(a));
  const l=new TaxReturn(b.merged).snapshot().lines,ids=b.forms.map(f=>f.id),ctx=JSON.stringify(a);
  for(const k of ['9','11a','12e','15','16','24','33'])assert.notEqual(l[k],null,`line ${k} blank: ${ctx}`);
  assert.ok(l['15']>=0&&l['16']>=0&&l['24']>=0,ctx);
  assert.ok(!(l['34']>0&&l['37']>0),ctx);assert.equal(l['34']-l['37'],l['33']-l['24'],ctx);
  // Filing status suggested by the answers.
  const married=a.quickMarried==='Yes',separate=married&&a.reviewJoint==='No',family=Y(a.quickFamily);
  const expected=married?(separate&&Y(a.quickLivedApart)&&family&&a.quickHomeHalf!=='No'?'Head of household':separate?'Married filing separately':'Married filing jointly'):family&&Y(a.quickWidowed)?'Qualifying surviving spouse':family&&a.quickHomeHalf!=='No'?'Head of household':'Single';
  assert.equal(templatePlan(a).status,expected,ctx);
  // Forms follow the answers.
  const expect={b:Y(a.quickInterest)||Y(a.reviewDividends)||Y(a.quickForeign),c:Y(a.reviewBusiness),cSpouse:bothSpouses(a)&&Y(a.reviewBusinessSpouse),d:Y(a.reviewBroker)||Y(a.reviewDigitalSales),e:Y(a.reviewRental)||Y(a.quickK1),'8962':Y(a.quickMarketplace),s1a:Y(a.quickAge65)||Y(a.quickTipsOvertime)||Y(a.quickCarLoan)||bothSpouses(a)&&(Y(a.quickAge65Spouse)||Y(a.quickTipsOvertimeSpouse)),a:Y(a.quickHomeCosts),'8812':Y(a.quickFamily),'8863':Y(a.quickEducation),h:Y(a.reviewHousehold),'2441':Y(a.reviewCare)};
  for(const [id,want] of Object.entries(expect))assert.equal(ids.includes(id),want,`${id}: ${ctx}`);
  assert.equal(ids.includes('se'),ids.includes('c'),ctx);assert.equal(ids.includes('8995'),ids.includes('c')||ids.includes('cSpouse'),ctx);
  counts.status[b.merged.status]=(counts.status[b.merged.status]||0)+1;for(const id of ids)counts.forms[id]=(counts.forms[id]||0)+1;
  // Key Points, and every Apply option on every fifth return, applies and undoes exactly.
  const kp=keyPoints(a,b,l);checked++;
  if(n%5)continue;
  for(const s of kp.strategies)for(const o of s.apply){
   const next=applyBenefit(a,b,s,o,o.input==='count'?2:o.input==='none'?0:1500);
   assert.doesNotThrow(()=>validate(next),o.id);
   const after=new TaxReturn(buildReturn(next).merged).snapshot().lines;assert.notEqual(after['24'],null,o.id);
   const undone=new TaxReturn(buildReturn(removeBenefit(next,next._applied.length-1)).merged).snapshot().lines;
   for(const k of ['9','11a','15','24','33','34','37'])assert.equal(undone[k],l[k],`${o.id} undo line ${k}: ${ctx}`);
   applied++;
  }
 }
 // Every filing status and every form was reached by the sweep.
 for(const s of ['Single','Married filing jointly','Married filing separately','Head of household','Qualifying surviving spouse'])assert.ok(counts.status[s]>0,s);
 for(const id of ['1','s1a','2','3','a','b','c','cSpouse','d','8949','e','se','seSpouse','h','8812','eic','2441','8863','8962','8995'])assert.ok(counts.forms[id]>0,id);
 assert.ok(checked===2500&&applied>1000,`applied ${applied}`);
});
