let preparationSamples = 0;
/* The classic Worker keeps the MediaPipe runtime out of the React/RSC bundle. */
importScripts(
  './vision/vision_bundle.js',
);

importScripts('./confetti-surfaces.js');
importScripts('./gift-scheduler.js');
let sessionId = 0,
  tokens = 700,
  tokenTime = 0;
const post = self.postMessage.bind(self);
self.postMessage = (message, ...args) =>
  post({ ...message, sessionId }, ...args);
let frameRunning = false;
let faceLandmarker = null;
let handLandmarker = null;
let initPromise = null;
const WASM_ROOT =
  new URL('./vision/wasm', self.location.href).href;
const FACE_MODEL =
  new URL('./vision/face_landmarker.task', self.location.href).href;
const HAND_MODEL =
  new URL('./vision/hand_landmarker.task', self.location.href).href;

let mainOrigin = performance.timeOrigin;
let phase = 'idle',
  visionRuntime = null,
  hairSegmenter = null,
  poseLandmarker = null;
let lastFace = null,
  lastFaceTime = 0;
const lastRun = { face: 0, hands: 0, hair: 0, pose: 0 },
  cost = { face: 15, hands: 20, hair: 30, pose: 20 };
const failed = new Set();
const warmRemaining = {hair:0,pose:0};
const recovery = {hair:{blockedAt:null,used:false},pose:{blockedAt:null,used:false}};
async function loadExtraModel(task) {
  const loadStarted = performance.now();
  try {
    if (task === 'hair')
      hairSegmenter = await Vision.ImageSegmenter.createFromOptions(
        visionRuntime,
        {
          baseOptions: {
            modelAssetPath:
              new URL('./vision/hair_segmenter.tflite', self.location.href).href,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        },
      );
    else
      poseLandmarker = await Vision.PoseLandmarker.createFromOptions(
        visionRuntime,
        {
          baseOptions: {
            modelAssetPath:
              new URL('./vision/pose_landmarker_lite.task', self.location.href).href,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          outputSegmentationMasks: true,
        },
      );
    warmRemaining[task]=2;
  } catch (error) {
    failed.add(task);
    self.postMessage({
      type: 'model',
      task,
      loadMs: performance.now() - loadStarted,
      ready: false,
      message: error?.message || '模型加载失败',
    });
  }
}
// Capture admission and inference share the same bounded schedule.
// 700 ms/s measures inference wall time, not CPU/GPU utilization.
function schedule(timestamp) {
  const now =
    timestamp || performance.timeOrigin + performance.now() - mainOrigin;
  if (!tokenTime) tokenTime = now;
  tokens = Math.min(700, tokens + Math.max(0, now - tokenTime) * 0.7);
  tokenTime = now;
  const unavailable = new Set(failed);
  if (!hairSegmenter) unavailable.add('hair');
  if (!poseLandmarker) unavailable.add('pose');
  for(const task of ['hair','pose'])if(warmRemaining[task])unavailable.add(task);
  const selected = GiftScheduler.select(
    now,
    phase,
    lastRun,
    cost,
    unavailable,
    tokens,
    preparationSamples,
    recovery,
  );
  // Between real inferences the Worker is free; base tasks retain their cadence.
  if(!selected.task && selected.reason==='cadence-wait' && now-lastRun.hands<=100 && now-lastRun.face<=100){
    const task=['hair','pose'].find(t=>warmRemaining[t]&&!failed.has(t)&&tokens>=cost[t]*1.15);
    if(task)return {task,nextCaptureAt:now,reason:'warmup'};
  }
  return selected;
}
function announceSchedule() {
  if (faceLandmarker)
    self.postMessage({
      type: 'capture-schedule',
      ...schedule(0),
    });
}
async function inferConfetti(image, timestamp) {
  const { task, reason } = schedule(timestamp);
  const warming=reason==='warmup',measuring=warming&&warmRemaining[task]===1;
  if(reason==='remeasure')recovery[task].used=true;
  if (!task) return;
  const started = performance.now();
  lastRun[task] = timestamp;
  let result, valid;
  try {
    if (task === 'face') {
      const f = faceLandmarker.detectForVideo(image, timestamp);
      lastFace = f.faceLandmarks[0] ? compact(f.faceLandmarks[0]) : null;
      lastFaceTime = timestamp;
      result = { faceLandmarks: lastFace };
    }
    if (task === 'hands') {
      const h = handLandmarker.detectForVideo(image, timestamp);
      result = {
        hands: h.landmarks.map(compact),
        worldHands: h.worldLandmarks.map(compact),
        handedness: h.handedness.map((a) => a[0]?.categoryName || 'Unknown'),
      };
    }
    if (task === 'hair')
      hairSegmenter.segmentForVideo(image, timestamp, (r) => {
        const regions =
          timestamp - lastFaceTime <= 250
            ? ConfettiSurfaces.hair(
                r.confidenceMasks[1],
                lastFace,
                true,
                timestamp,
              )
            : { lines: [], patches: [] };
        result = {
          ...regions,
          faceLandmarks: lastFace,
        };
      });
    if (task === 'pose') {
      const r = poseLandmarker.detectForVideo(image, timestamp);
      try {
        result = {
          pose: r.landmarks[0] || null,
          lines: ConfettiSurfaces.shoulders(
            r.segmentationMasks?.[0],
            r.landmarks[0],
            timestamp,
            { width: image.width, height: image.height },
          ),
          diagnostics: ConfettiSurfaces.shoulderStats,
        };
      } finally {
        r.close();
      }
    }
    if (task === 'hair' && !warming) preparationSamples++;
    valid =
      task === 'face'
        ? !!lastFace
        : task === 'hands'
          ? result.hands.length > 0
          : task === 'hair'
            ? result.lines.length > 0
            : !!result.pose;
  } catch (error) {
    valid = false;
    result = { error: error?.message || '识别失败' };
  }
  const duration = performance.now() - started;
  if(!warming || measuring)cost[task] = measuring || reason==='remeasure' ? duration : cost[task] * 0.8 + duration * 0.2;
  tokens -= duration;
  if(warming){
    if(result.error){warmRemaining[task]=0;failed.add(task);self.postMessage({type:'model',task,ready:false,message:result.error});}
    else if(--warmRemaining[task]===0)self.postMessage({type:'model',task,ready:true});
    return;
  }
  if(reason==='remeasure' && (result.error || (cost[task]*1.15+34+cost.hands*1.15>200 || cost[task]*1.15+68+(cost.hands+cost.face)*1.15>250))){
    failed.add(task);self.postMessage({type:'model',task,ready:false,message:task==='hair'?'头发识别耗时超出预算，彩带暂不可用，请重试识别':'肩部识别耗时超出预算，仅使用头发停留'});return;
  }
  self.postMessage({
    type: 'confetti-result',
    task,
    timestamp,
    duration,
    valid,
    ...result,
  });
}
const compact = (landmarks) => landmarks.flatMap(({ x, y, z }) => [x, y, z]);
async function initialize() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const vision = await Vision.FilesetResolver.forVisionTasks(WASM_ROOT);
    visionRuntime = vision;
    [faceLandmarker, handLandmarker] = await Promise.all([
      Vision.FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
      }),
      Vision.HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        minHandDetectionConfidence: 0.35,
        minHandPresenceConfidence: 0.35,
        numHands: 2,
      }),
    ]);
  })();
  return initPromise;
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'start' && data.sessionId !== sessionId) {
    data.image?.close();
    return;
  }
  if (data.type === 'load-model') {
    if (frameRunning) return;
    frameRunning = true;
    try {
      await loadExtraModel(data.task);
    } finally {
      frameRunning = false;
      self.postMessage({ type: 'frame-done' });
      announceSchedule();
    }
    return;
  }
  if (data.type === 'configure') {
    if (
      data.phase === 'candidate' &&
      phase !== 'candidate' &&
      phase !== 'preparing'
    )
      preparationSamples = 0;
    phase = data.phase;
    announceSchedule();
    return;
  }
  if (data.type === 'start') {
    sessionId = data.sessionId;
    mainOrigin = data.timeOrigin ?? performance.timeOrigin;
    try {
      await initialize();
      self.postMessage({ type: 'ready' });
      announceSchedule();
    } catch (error) {
      self.postMessage({
        type: 'error',
        message: error?.message || '模型加载失败',
      });
    }
    return;
  }
  const { image, timestamp } = data;
  if (!image) return;
  if (frameRunning) {
    image.close();
    self.postMessage({ type: 'frame-done' });
    return;
  }
  frameRunning = true;
  try {
    await initialize();
    if (
      performance.timeOrigin + performance.now() - mainOrigin - timestamp <
      200
    )
      await inferConfetti(image, timestamp);
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || '追踪失败' });
  } finally {
    frameRunning = false;
    image.close();
    self.postMessage({ type: 'frame-done' });
    announceSchedule();
  }
};
