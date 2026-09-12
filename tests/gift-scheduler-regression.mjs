import assert from 'node:assert/strict';
import '../public/gift-scheduler.js';
function simulate(select,cost){
 const last={hands:-1000,face:-1000,hair:-1000,pose:-1000},count={hands:0,face:0,hair:0,pose:0},times={hair:[],pose:[]};let budget=700,previous=0,busy=0,next=0,video=-1,total=0;
 for(let now=0;now<7000;now+=1000/60){budget=Math.min(700,budget+(now-previous)*.7);previous=now;if(now<busy||now<next||Math.floor(now/33.333)===video)continue;
  const r=select(now,'playing',false,last,cost,new Set(),budget);next=r.nextCaptureAt;if(!r.task)continue;
  if(r.task==='hair'||r.task==='pose'){
   let finish=now+cost[r.task]*1.15;
   for(const b of ['hands','face'].sort((a,b)=>last[a]+(a==='hands'?200:250)-last[b]-(b==='hands'?200:250))){finish+=34+cost[b]*1.15;assert(finish<=last[b]+(b==='hands'?200:250),'segmentation must reserve base-result freshness');}
   times[r.task].push(now);
  }
  assert(budget>=cost[r.task]);video=Math.floor(now/33.333);last[r.task]=now;count[r.task]++;budget-=cost[r.task];total+=cost[r.task];busy=now+cost[r.task];
 }
 assert(total<=700+7000*.7,'unchanged token envelope');return {count,times,total};
}
const r=simulate(GiftScheduler.select,{hands:26,face:18,hair:34,pose:23});assert(r.count.hair>=20&&r.count.pose>=20,'neither segmentation task starves');
const last={hands:100,face:100,hair:0,pose:0},cost={hands:20,face:15,hair:30,pose:20};
assert.equal(GiftScheduler.select(170,'preparing',false,last,cost,new Set(),700,0).task,'hair');
assert.equal(GiftScheduler.select(170,'preparing',false,last,cost,new Set(),0,0).reason,'budget-exhausted');
const slow=simulate(GiftScheduler.select,{hands:35,face:25,hair:60,pose:30});
assert.equal(GiftScheduler.select(170,'preparing',false,last,{...cost,hair:300,pose:300},new Set(),700).reason,'freshness-reserve');
console.log(JSON.stringify({scenario:'synthetic, not device benchmark',normal:r.count,inferenceMs:r.total,slow:slow.count}));
