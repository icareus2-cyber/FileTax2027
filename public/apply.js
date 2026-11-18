// Applies a Key Points benefit to the answers and records it so it can be listed and undone.
// A record keeps what it changed: the target line, the amount, and the value it replaced.
const split=target=>{const [kind,a,b]=target.split(':');return kind==='1040'?{key:a}:{form:a,line:b};};
// The value a line shows now: the user's own entry, or else the template/calculated value.
export function currentValue(answers,built,target){
 const t=split(target);
 if(t.key)return answers[t.key]??built?.merged?.[t.key];
 return answers._forms?.[t.form]?.[t.line]??built?.forms.find(f=>f.id===t.form)?.lines.find(l=>l.line===t.line)?.value;
}
const owned=(a,target)=>{const t=split(target);return t.key?a[t.key]!==undefined:a._forms?.[t.form]?.[t.line]!==undefined;};
function write(a,target,value){
 const t=split(target);
 if(t.key){if(value===undefined)delete a[t.key];else a[t.key]=value;return;}
 const forms={...a._forms},lines={...forms[t.form]};
 if(value===undefined)delete lines[t.line];else lines[t.line]=value;
 if(Object.keys(lines).length)forms[t.form]=lines;else delete forms[t.form];
 a._forms=forms;
}
// The amount written for an option: square feet × $5 for a home office, miles × rate, or the amount itself.
// The limit applies to what the user enters (square feet, miles, or dollars), before converting.
export const optionAmount=(option,input)=>{const n=Math.min(Math.max(0,Number(input)||0),option.max??Infinity);return Math.round(option.factor?n*option.factor:n);};
export function applyBenefit(answers,built,strategy,option,input){
 let a=structuredClone(answers);
 // Applying the same option again replaces the earlier entry.
 const earlier=(a._applied||[]).findIndex(r=>r.option===option.id);
 if(earlier>=0)a=removeBenefit(a,earlier);
 const amount=option.mode==='status'?0:optionAmount(option,input);
 const rec={strategy:strategy.id,option:option.id,label:option.label,amount,mode:option.mode,target:option.target};
 if(option.mode==='set'){rec.prev=owned(a,option.target)?currentValue(a,built,option.target):null;write(a,option.target,amount);}
 else if(option.mode==='add'){
  const base=Number(currentValue(a,built,option.target)??0),next=Math.max(0,base+(option.sign??1)*amount);
  rec.base=base;rec.baseOwned=owned(a,option.target);rec.delta=next-base;write(a,option.target,next);
 }else if(option.mode==='status'){rec.prev=a.status??null;rec.status=option.status;a.status=option.status;}
 a._applied=[...(a._applied||[]),rec];
 return a;
}
export function removeBenefit(answers,index){
 const a=structuredClone(answers),rec=a._applied?.[index];if(!rec)return a;
 if(rec.mode==='set'&&owned(a,rec.target)&&currentValue(a,null,rec.target)===rec.amount)write(a,rec.target,rec.prev??undefined);
 else if(rec.mode==='add'&&owned(a,rec.target)){
  const now=Number(currentValue(a,null,rec.target)),back=now-rec.delta;
  // If nothing else changed and the line was a template figure before, let the template return.
  write(a,rec.target,!rec.baseOwned&&back===rec.base?undefined:Math.max(0,back));
 }else if(rec.mode==='status'&&a.status===rec.status){if(rec.prev)a.status=rec.prev;else delete a.status;}
 a._applied.splice(index,1);if(!a._applied.length)delete a._applied;
 return a;
}
