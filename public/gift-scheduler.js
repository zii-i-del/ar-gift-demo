(function(root){
 function rates(phase){const playing=phase==='playing',finish=phase==='finishing',candidate=phase==='candidate'||phase==='preparing';return {hands:12,face:10,hair:playing?8:finish?5:candidate?6:0,pose:playing?6:finish?4:candidate?6:0};}
 function select(now,phase,last,cost,unavailable,budget,preparedSamples=0){
  const hz=rates(phase),base=['hands','face'].filter(t=>!unavailable.has(t));
  const due=t=>last[t]+1000/hz[t],deadline=t=>last[t]+(t==='hands'?200:250);
  const estimate=t=>cost[t]*1.15, gap=34;
  base.sort((a,b)=>deadline(a)-deadline(b));
  // Reserve the next camera-frame wait AND both base inferences after an extra task.
  // Target cadence may slip; result expiry may not be knowingly crossed.
  function fits(t){let end=now+estimate(t),remaining=budget-estimate(t);
   for(const b of base){end+=gap+estimate(b);remaining+=gap*.7-estimate(b);if(end>deadline(b)||remaining<0)return false;}
   return true;
  }
  const extra=['hair','pose'].filter(t=>hz[t]&&!unavailable.has(t)&&due(t)<=now);
  const preparing=phase==='candidate'||phase==='preparing';
  extra.sort((a,b)=>preparing&&preparedSamples<2?(a==='hair'?-1:1):due(a)-due(b));
  for(const t of extra)if(budget>=estimate(t)&&fits(t))return {task:t,nextCaptureAt:now,reason:'segmentation-window'};
  const expired=base.filter(t=>due(t)<=now).sort((a,b)=>due(a)-due(b))[0];
  if(expired&&budget>=estimate(expired))return {task:expired,nextCaptureAt:now,reason:'base-due'};
  const next=base.length?Math.min(...base.map(due)):now+100;
  const reason=extra.length?(extra.every(t=>budget<estimate(t))?'budget-exhausted':'freshness-reserve'):expired?'budget-exhausted':'cadence-wait';
  return {task:null,nextCaptureAt:Math.max(now+10,Math.min(next,now+100)),reason};
 }
 root.GiftScheduler={rates,select};
})(typeof self!=='undefined'?self:globalThis);
