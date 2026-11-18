import test from 'node:test';
import assert from 'node:assert/strict';
import {TaxReturn} from '../public/return-model.js';
import {LiveSession} from '../public/live-session.js';
import {makeFormPdf,makePacket,scheduleMaps} from '../form-pdf.js';
import {PDFDocument} from 'pdf-lib';
export const fixture={firstName:'Sample',lastName:'Return',strategyBusinessReceipts:120000,strategyBusinessExpenses:20000,businessReturns:0,businessCOGS:0,businessOther:0,businessDepreciation:1000,businessHome:0,strategyRentalReceipts:30000,strategyRentalExpenses:8000,rentalDepreciation:2000,liveIRADeduction:2000,liveOtherIncome:500,liveOtherAdjustments:1000,additionalIncome:999999,adjustments:99999};
test('objects propagate edits through C and E to Schedule 1 and 1040 without double counting',()=>{
 const model=new TaxReturn(fixture);const s=model.snapshot();
 assert.equal(s.forms.find(f=>f.id==='c').lines['31'],99000);
 assert.equal(s.forms.find(f=>f.id==='e').lines['26'],20000);
 assert.equal(s.lines['8'],119500);assert.equal(s.lines['10'],3000);
 const next=model.update({strategyBusinessExpenses:25000,strategyRentalExpenses:9000,liveIRADeduction:2500}).snapshot();
 assert.equal(next.lines['8'],113500);assert.equal(next.lines['10'],3500);
 assert.equal(model.answers.strategyBusinessExpenses,20000);
});
test('missing inputs invalidate dependent totals and excessive losses fail validation',()=>{
 assert.equal(new TaxReturn({...fixture,businessCOGS:undefined}).snapshot().lines['8'],null);
 const loss={...fixture,strategyRentalReceipts:1000};
 assert.equal(new TaxReturn(loss).snapshot().lines['8'],null);
 assert.throws(()=>new TaxReturn({...loss,rentalAllowedLoss:10000}).snapshot(),/cannot exceed/);
 assert.equal(new TaxReturn({...loss,rentalAllowedLoss:0}).snapshot().forms.find(f=>f.id==='e').lines['26'],0);
 assert.throws(()=>new TaxReturn({wages:-1}),/valid amount/);
});
test('each schedule PDF contains the current mapped line values',async()=>{
 const snapshot=new TaxReturn(fixture).snapshot();
 for(const id of ['c','e','1']){const pdf=await PDFDocument.load(await makeFormPdf(fixture,snapshot,id));const fields=pdf.getForm().getFields();for(const [line,name]of Object.entries(scheduleMaps[id]))assert.equal(fields.find(f=>f.getName().endsWith(`.${name}[0]`)).getText(),String(snapshot.forms.find(f=>f.id===id).lines[line]),id+' '+line);}
 const packet=await PDFDocument.load(await makePacket(fixture,snapshot));assert.equal(packet.getPageCount(),8);
});
test('serialized autosave writes newest edits last and identifies stale responses',async()=>{
 const session=new LiveSession();const written=[];let release;
 session.evaluate({wages:10});const first=session.persist({wages:10},0,async p=>{await new Promise(r=>release=r);written.push(p.answers.wages);});
 await Promise.resolve();await Promise.resolve();
 session.evaluate({wages:20});const second=session.persist({wages:20},0,async p=>{written.push(p.answers.wages);});
 release();assert.equal((await first).current,false);assert.equal((await second).current,true);assert.deepEqual(written,[10,20]);
});
