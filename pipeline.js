(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PanPipeline=api;})(globalThis,function(){
 const gate=()=>{let tail=Promise.resolve();return fn=>{const next=tail.then(fn);tail=next.catch(()=>{});return next;};};
 function limiter(wait,stopped){const enter=gate();return ms=>enter(async()=>{if(stopped())throw Object.assign(Error('已暂停'),{paused:true});await wait(ms);if(stopped())throw Object.assign(Error('已暂停'),{paused:true});});}
 function isolate(api,sourceGate,writeGate){return new Proxy(api,{get(target,name){const value=target[name];if(typeof value!=='function')return value;if(['source','transfer','verifyTree'].includes(name))return (...args)=>sourceGate(()=>value.apply(target,args));if(name==='mkdir')return (...args)=>writeGate(()=>value.apply(target,args));return value.bind(target);}});}
 function overlaps(a,b){a=a.replace(/\/$/,'');b=b.replace(/\/$/,'');return a===b||a.startsWith(b+'/')||b.startsWith(a+'/');}
 async function run(tasks,work,stopped=()=>false){const pending=[...tasks],active=new Map();let failure;
   while(pending.length||active.size){
     if(!stopped()&&!failure){while(active.size<2){const index=pending.findIndex(t=>![...active.keys()].some(a=>overlaps(a.target,t.target)));if(index<0)break;const task=pending.splice(index,1)[0];const promise=Promise.resolve().then(()=>work(task)).catch(e=>{failure=e;}).finally(()=>active.delete(task));active.set(task,promise);}}
     if(!active.size)break;await Promise.race(active.values());
   }
   if(failure)throw failure;
 }
 return {gate,limiter,isolate,run};
});
