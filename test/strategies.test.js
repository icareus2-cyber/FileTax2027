import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendStrategies,planningGroup} from '../public/strategies.js';
import {validate,draft} from '../tax.js';
const ids=a=>recommendStrategies(a).map(s=>s.id);
test('unknown residency permits record review but blocks advanced strategies',()=>{
 assert.deepEqual(ids({planBusinessHigh:'Yes'}),['business-expenses','residency']);
 assert.deepEqual(ids({reviewResident:'Yes'}),[]);
});
test('high net business profit prompts entity review only for sole proprietors',()=>{
 const a={reviewResident:'Yes',reviewBusiness:'Yes',planBusinessHigh:'Yes',planEntity:'Sole proprietor / disregarded single-member LLC'};
 assert.ok(ids(a).includes('entity'));
 for(const v of ['No','Not sure / skip',undefined])assert.ok(!ids({...a,planBusinessHigh:v}).includes('entity'));
 assert.ok(!ids({...a,planEntity:'S corporation'}).includes('entity'));
 assert.ok(!ids({...a,planEntity:'C corporation'}).includes('qbi'));
});
test('rental receipt threshold does not imply rental loss deduction',()=>{
 const a={reviewResident:'Yes',planRentalGrossHigh:'Yes'};
 assert.ok(ids(a).includes('rental-records'));assert.ok(!ids(a).includes('rental-loss'));
 const s=recommendStrategies({...a,planRentalLoss:'Yes',planMAGI:'$150,000 or more'}).find(s=>s.id==='rental-loss');
 assert.match(s.action,/generally unavailable/);assert.match(s.action,/married-filing-separately/i);
});
test('retirement suggestions account for employees and other employer plans',()=>{
 const s=recommendStrategies({reviewResident:'Yes',reviewBusiness:'Yes',planRetirement:'Yes',planEmployees:'Yes',planWorkPlan:'Yes'}).find(s=>s.id==='retirement');
 assert.match(s.action,/employee-inclusive/);assert.match(s.action,/Coordinate employee deferrals/);assert.match(s.action,/deadlines/);
});
test('all new planning responses validate, export recommendations, and leave amounts unchanged',()=>{
 const a={reviewResident:'Yes',reviewBusiness:'Yes'};
 for(const [key,,type,options]of planningGroup.fields){for(const value of options)assert.equal(validate({[key]:value})[key],value);assert.throws(()=>validate({[key]:'invalid'}));}
 const b=validate({...a,planBusinessHigh:'Yes',planRentalGrossHigh:'Not sure / skip'});
 assert.deepEqual(draft(a).lines,draft(b).lines);assert.ok(draft(b).strategies.length>0);
 for(const s of draft(b).strategies)assert.ok(s.url.startsWith('https://www.irs.gov/'));
});
