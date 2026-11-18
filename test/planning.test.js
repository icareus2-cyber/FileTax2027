import test from 'node:test';
import assert from 'node:assert/strict';
import {planningSummary} from '../public/planning.js';
import {quickGroups} from '../public/screening.js';
import {validate,draft} from '../tax.js';
test('quick assessment excludes technical planning questions',()=>{
 const keys=quickGroups.flatMap(g=>g.fields).map(f=>f[0]);
 for(const k of ['planMAGI','planEntity','reviewResident','strategyBusinessExpenses','strategyIRABudget'])assert.ok(!keys.includes(k));
});
test('operating balances preserve blanks and losses without affecting tax lines',()=>{
 assert.equal(planningSummary({}).businessOperatingSurplus,null);
 const a=validate({strategyBusinessReceipts:100000,strategyBusinessExpenses:25000,strategyRentalReceipts:10000,strategyRentalExpenses:12000,strategyIRABudget:5000});
 assert.deepEqual(planningSummary(a),{businessOperatingSurplus:75000,rentalOperatingSurplus:-2000});
 assert.deepEqual(draft(a).lines,draft({}).lines);
 assert.throws(()=>validate({strategyBusinessExpenses:-1}));
 assert.ok(draft(a).strategies.some(s=>s.id==='ira'));
});
