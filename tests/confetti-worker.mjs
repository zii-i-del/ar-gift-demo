import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const messages = [],
  calls = [];
let now = 100,
  failHair = false;
const fake = {
  FaceLandmarker: {
    createFromOptions: async () => ({
      detectForVideo: () => {
        calls.push('face');
        return { faceLandmarks: [], faceBlendshapes: [] };
      },
    }),
  },
  HandLandmarker: {
    createFromOptions: async () => ({
      detectForVideo: () => {
        calls.push('hands');
        return { landmarks: [], worldLandmarks: [], handedness: [] };
      },
    }),
  },
  ImageSegmenter: {
    createFromOptions: async () => ({
      segmentForVideo: (image, t, cb) => {
        calls.push('hair');
        if (failHair) throw Error('test inference failure');
        cb({ confidenceMasks: [null, null] });
      },
    }),
  },
  PoseLandmarker: {
    createFromOptions: async () => ({
      detectForVideo: () => {
        calls.push('pose');
        return {
          landmarks: [],
          segmentationMasks: [],
          close() {
            calls.push('pose-close');
          },
        };
      },
    }),
  },
  FilesetResolver: { forVisionTasks: async () => ({}) },
};
const context = {
  Vision: fake,
  performance: {
    get timeOrigin() {
      return 100000;
    },
    now: () => now,
  },
  importScripts() {},
  ConfettiSurfaces: {
    hair: () => ({lines:[],patches:[]}),
    shoulders: () => ({ left: [], right: [] }),
  },
  self: { postMessage: (m) => messages.push(m) },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('public/gift-scheduler.js','utf8'),context);
context.GiftScheduler=context.self.GiftScheduler;
vm.runInContext(fs.readFileSync('public/tracking-worker.js','utf8'),context);
const send=data=>context.self.onmessage({data:{sessionId:0,...data}});
await send({type:'start',timeOrigin:90000});
assert(messages.some(m=>m.type==='ready'));
assert(!calls.includes('hair')&&!calls.includes('pose'),'segmentation is warmed separately');
for(const task of ['hair','pose'])await send({type:'warmup',task});
assert(messages.filter(m=>m.type==='model'&&m.ready).length===2);
await send({type:'configure',phase:'playing'});
let closed=0;
const frame=(timestamp=now+10000)=>send({type:'frame',timestamp,image:{width:640,height:480,close(){closed++;}}});
for(let n=0;n<200;n++){
 now+=20;const before=calls.filter(t=>t!=='pose-close').length;
 await frame();assert(calls.filter(t=>t!=='pose-close').length-before<=1);
}
for(const task of ['face','hands','hair','pose'])assert(calls.includes(task),task+' runs during playback');
assert.equal(calls.filter(t=>t==='pose').length,calls.filter(t=>t==='pose-close').length);
assert.equal(closed,200);
const before=calls.length;await frame(now+9000);assert.equal(calls.length,before,'stale source frame does not infer');
let oldClosed=0;await send({type:'frame',sessionId:99,timestamp:now+10000,image:{close(){oldClosed++;}}});
assert.equal(oldClosed,1);assert.equal(calls.length,before,'old session does not infer');
failHair=true;
for(let n=0;n<100;n++){now+=20;await frame();}
assert(messages.some(m=>m.task==='hair'&&m.error&&!m.valid));
assert.equal(vm.runInContext('frameRunning',context),false);
failHair=false;
await send({type:'configure',phase:'idle'});
const segmented=calls.filter(t=>t==='hair'||t==='pose').length;
let captures=0;
for(let n=0;n<600;n++){
 now+=1000/60;
 if(now+10000<messages.findLast(m=>m.type==='capture-schedule').nextCaptureAt)continue;
 await frame();captures++;
}
assert.equal(calls.filter(t=>t==='hair'||t==='pose').length,segmented,'idle does not segment');
assert(captures>0&&captures<350,'capture admission remains bounded');
for(const phase of ['idle','candidate','preparing','playing','finishing']){
 await send({type:'configure',phase});assert.equal(context.GiftScheduler.rates(phase).hands,12);
}
console.log('PASS current Worker: one task/frame, both hands during playback, idle segmentation off, cleanup, stale/old sessions and capture budget');

// Deterministic wall-time accounting through the real frame lifecycle.
now=Math.ceil(now);
vm.runInContext('phase="idle"; mainOrigin=100000;',context);
let inferenceMs=40, failInference=true;
vm.runInContext('handLandmarker.detectForVideo = () => testDetection()',context);
context.testDetection=()=>{now+=inferenceMs;if(failInference)throw Error('timed failure');return {landmarks:[],worldLandmarks:[],handedness:[]};};
const sendFrame=async()=>{await context.self.onmessage({data:{type:'frame',sessionId:0,timestamp:now,image:{width:640,height:480,close(){closed++;}}}});};
const prepare=()=>vm.runInContext(`tokens=100;tokenTime=${now};lastRun.hands=0;lastRun.face=${now};cost.hands=20;`,context);
prepare();const beforeClose=closed;await sendFrame();
assert.equal(messages.findLast(m=>m.type==='confetti-result').duration,40);
assert.equal(messages.findLast(m=>m.type==='confetti-result').error,'timed failure');
assert.equal(vm.runInContext('cost.hands',context),24,'failed inference updates the estimate');
assert.equal(vm.runInContext('tokens',context),88,'40ms spent once, 28ms replenished during execution');
assert.equal(closed,beforeClose+1);assert.equal(vm.runInContext('frameRunning',context),false);
// No budget: no execution, no error packet, no imaginary work charged.
vm.runInContext(`tokens=0;tokenTime=${now};lastRun.hands=0;`,context);
const beforeMessages=messages.filter(m=>m.type==='confetti-result').length;
await sendFrame();assert.equal(messages.filter(m=>m.type==='confetti-result').length,beforeMessages);
assert.equal(vm.runInContext('tokens',context),0);
// Refill and a successful empty detection uses the identical accounting path.
now+=200;failInference=false;prepare();await sendFrame();
const recovered=messages.findLast(m=>m.type==='confetti-result');
assert.equal(recovered.error,undefined);assert.equal(recovered.valid,false);assert.equal(recovered.duration,40);
assert.equal(vm.runInContext('cost.hands',context),24);assert.equal(vm.runInContext('tokens',context),88);
// An unexpectedly expensive failure retains debt rather than clearing it.
now+=200;inferenceMs=400;failInference=true;prepare();await sendFrame();
assert.equal(vm.runInContext('tokens',context),-20);
assert.equal(vm.runInContext('frameRunning',context),false);
console.log('PASS failure/success costs, no-budget skip, recovery, overrun debt and frame release');
