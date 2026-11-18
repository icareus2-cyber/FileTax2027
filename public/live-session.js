import {TaxReturn} from './return-model.js';
// A monotonically increasing edit number prevents older async work from becoming current.
export class LiveSession {
 constructor(){this.revision=0;this.savedRevision=-1;this.queue=Promise.resolve();}
 evaluate(answers){this.revision++;this.snapshot=new TaxReturn(answers).snapshot();return this.snapshot;}
 persist(answers,step,write){
  const revision=this.revision,payload=structuredClone({answers,step});
  const task=this.queue.catch(()=>{}).then(()=>write(payload));
  this.queue=task;
  return task.then(result=>{this.savedRevision=Math.max(this.savedRevision,revision);return {result,current:revision===this.revision};});
 }
}
