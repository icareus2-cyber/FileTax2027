import {assessment} from '../public/screening.js';
// Answers every visible question with No (or its last option), repeating as follow-ups appear.
export function complete(a){
 a={...a};for(let i=0;i<10;i++){const open=assessment(a).flatMap(g=>g.items.flatMap(q=>q.rows.map(r=>[r.key,q]))).filter(([k])=>!a[k]);if(!open.length)break;for(const [k,q] of open)a[k]=k==='quickHomeHalf'?'Yes':q.options.includes('No')?'No':q.options.at(-1);}
 return a;
}
