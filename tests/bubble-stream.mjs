import assert from 'node:assert/strict';
import {Interaction,readHand} from '../lib/interaction.ts';
import {bubbleRadius,orderBubbles,BUBBLE_CAPACITY} from '../lib/bubble-stream.ts';
const points=[[.5,.85],[.44,.76],[.4,.68],[.32,.65],[.23,.62],[.5,.6],[.5,.46],[.5,.36],[.5,.26],[.56,.61],[.57,.57],[.57,.68],[.56,.72],[.62,.63],[.63,.59],[.63,.7],[.62,.74],[.68,.65],[.69,.62],[.69,.72],[.68,.76]];
for(const mirror of [false,true]){
 const read=p=>readHand(p.flatMap(([x,y])=>[mirror?1-x:x,y,0]),mirror?'right':'left',600,600,600,600,p.flatMap(([x,y])=>[x*.2,y*.2,0]));
 const gun=read(points);assert.equal(gun.gun,true);
 const negatives=[];
 const bentIndex=points.map(p=>[...p]);bentIndex[8]=[.55,.29];negatives.push(bentIndex);
 const bentThumb=points.map(p=>[...p]);bentThumb[4]=[.36,.55];negatives.push(bentThumb);
 // Fingers directed toward wrist can satisfy the old !extended test while remaining straight.
 for(const mcp of [9,13,17]){
   const open=points.map(p=>[...p]),[x,y]=open[mcp];
   open[mcp+1]=[x,y+.04];open[mcp+2]=[x,y+.08];open[mcp+3]=[x,y+.12];negatives.push(open);
 }
 for(const pose of negatives){
   const bad=read(pose);assert.equal(bad.gun,false,'bent firing fingers or unclosed supporting finger rejected');
   const engine=new Interaction();engine.reset();
   for(let i=0;i<60;i++){const t=i*1000/60;if(i%4===0)engine.acceptHands([gun],t);engine.step(1/60,t);}
   const before=engine.emittedBubbles;engine.acceptHands([bad],1000);
   for(let i=0;i<60;i++){const t=1000+i*1000/60;if(i%4===0)engine.acceptHands([bad],t);engine.step(1/60,t);}
   assert.equal(engine.emittedBubbles,before,'nonstandard pose immediately stops new emission');
 }

 const narrow=points.map(p=>[...p]);narrow[2]=[.43,.70];narrow[3]=[.44,.57];narrow[4]=[.445,.44];
 for(const rotation of [-.45,0,.45]){
   const turned=narrow.map(([x,y])=>[.5+(x-.5)*Math.cos(rotation)-(y-.6)*Math.sin(rotation),.6+(x-.5)*Math.sin(rotation)+(y-.6)*Math.cos(rotation)]);
   assert.equal(read(turned).gun,true,'narrow extended thumb accepted in both hands and orientations');
 }
 const foldedThumb=narrow.map(p=>[...p]);foldedThumb[3]=[.46,.68];foldedThumb[4]=[.48,.65];
 assert.equal(read(foldedThumb).gun,false,'thumb resting over fist cannot emit');

 const index=points.map(p=>[...p]);index[3]=[.43,.66];index[4]=[.47,.66];
 assert.equal(read(index).gun,false,'index alone cannot emit');
 const e=new Interaction();e.reset();
 for(let i=0;i<240;i++){
  const t=i*1000/60;if(i%4===0)e.acceptHands([gun],t);e.step(1/60,t);
 }
 assert.ok(e.emittedBubbles>=27 && e.emittedBubbles<=31,'dense 8 Hz stream independent of inference sampling');
 assert.equal(e.bubbles.length,BUBBLE_CAPACITY);
 const moving=e.bubbles.find(b=>b.active&&b.age>.5&&b.age<.8);assert.ok(moving.vy<0);
 const count=e.emittedBubbles;e.acceptHands([read(index)],4000);e.step(1/60,4017);
 assert.equal(e.emittedBubbles,count,'thumb retracted stops emission immediately');
 const stale=new Interaction();stale.reset();stale.acceptHands([gun],0);stale.step(1/60,1000);assert.equal(stale.emittedBubbles,0);
 const noPoke=new Interaction();noPoke.reset();Object.assign(noPoke.bubbles[0],{active:true,x:200,y:150,r:30,age:1,pop:-1});
 const h=read(index);noPoke.acceptHands([{...h,tip:{x:150,y:150}}],0);noPoke.acceptHands([{...h,tip:{x:210,y:150}}],67);assert.equal(noPoke.bubbles[0].pop,-1);
}
assert.equal(bubbleRadius(30,0),6.6);assert.equal(bubbleRadius(30,.45),30);
assert.deepEqual(orderBubbles([{active:true,birthOrder:9},{active:true,birthOrder:2},{active:true,birthOrder:4}],[]),[1,2,0]);
const h={id:'left',tip:{x:300,y:250},wrist:{x:300,y:350},anchor:{x:300,y:300},span:80,heart:false,pointing:false,palm:false,reach:0,gun:true,gunDirection:{x:1,y:0}};
const full=new Interaction();full.reset();
for(let i=0;i<7200;i++){const t=i*1000/60;if(i%4===0)full.acceptHands([h,{...h,id:'right'}],t);full.step(1/60,t);assert.ok(full.bubbles.filter(b=>b.active).length<=32);}
assert.ok(full.emittedBubbles>700&&full.dropped.bubble>0&&full.emittedBubbles+full.dropped.bubble>=890&&full.emittedBubbles+full.dropped.bubble<=900,'32-active cap skips shared opportunities without a backlog');
console.log('PASS: gun vs index, dense stream, stale/stop, no poke, growth, stable overlap ordering, 2-minute bounded simulation');
// The active cap includes ruptures; a tighter confetti cap must not evict them.
for(const [width,height] of [[1280,720],[720,1280]]){
 const e=new Interaction();e.width=width;e.height=height;
 for(const t of [0,100,200,300])e.acceptHands([h],t);
 const slots=e.bubbles.slice(0,32);
 for(let index=0;index<slots.length;index++)Object.assign(slots[index],{active:true,x:width/2,y:height/2,r:20,targetR:20,age:1,pop:-1,vx:0,vy:0,birthOrder:index});
 e.popBubble(slots[0]);e.step(.01,300);
 assert.equal(e.emittedBubbles,0,'rupturing slot still occupies capacity');
 e.autoConfetti=true;e.acceptHands([h],400);e.step(.01,400);
 assert.equal(slots.filter(b=>b.active).length,32,'tightening cap does not remove existing bubbles');
 for(const t of [500,600,700])e.acceptHands([h],t);
 e.step(.04,750,.35);assert.equal(slots[0].active,false);
 e.autoConfetti=false;for(const t of [800,900,1000])e.acceptHands([h],t);e.step(.01,1000);
 assert.equal(e.emittedBubbles,1);assert.equal(e.bubbles[0],slots[0]);assert.equal(slots[0].pop,-1,'reused slot clears rupture');
 assert.equal(e.bubbles.filter(b=>b.active).length,32);
 e.reset();assert.equal(e.bubbles.some(b=>b.active),false);
}
