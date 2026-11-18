import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,draft} from '../tax.js';
import {screeningFields,screeningNotes} from '../public/screening.js';

test('review allows explicit unknown, no, yes, or entirely skipped answers',()=>{
 for(const value of ['Yes','No','Not sure / skip'])assert.equal(validate({reviewW2:value}).reviewW2,value);
 assert.deepEqual(validate({reviewW2:''}),{});
 assert.throws(()=>validate({reviewW2:true}));
 assert.throws(()=>validate({reviewW2:'Maybe'}));
 assert.equal(validate({reviewJoint:'Yes, jointly with my spouse'}).reviewJoint,'Yes, jointly with my spouse');
 assert.equal(new Set(screeningFields.map(f=>f[0])).size,screeningFields.length);
});
test('review does not infer tax amounts or overwrite detailed filing choices',()=>{
 const a={status:'Single',wages:20000};
 const b=validate({...a,reviewJoint:'Yes, jointly with my spouse',reviewW2:'No',reviewBusiness:'Yes',reviewCompleted:'Yes'});
 assert.equal(b.status,'Single');assert.equal(b.wages,20000);
 assert.deepEqual(draft(a).lines,draft(b).lines);
});
test('unknown answers remain follow-up items and yes answers produce relevant review guidance',()=>{
 assert.ok(screeningNotes({}).some(n=>n.includes('unanswered')));
 const a=Object.fromEntries(screeningFields.map(([key])=>[key,'No']));a.reviewResident='Yes';
 assert.equal(screeningNotes(a).length,0);
 a.reviewHousehold='Yes';a.reviewForeign='Yes';a.reviewIRA='Yes';
 const notes=screeningNotes(a).join(' ');
 assert.match(notes,/Schedule H/);assert.match(notes,/Schedule B/);assert.match(notes,/Roth IRA contributions are not deductible/);
});
