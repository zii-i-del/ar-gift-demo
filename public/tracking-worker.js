let preparationSamples = 0;
/* The classic Worker keeps the MediaPipe runtime out of the React/RSC bundle. */
importScripts(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.js',
);

importScripts('/confetti-surfaces.js');
importScripts('/gift-scheduler.js');
let automatic=false,sessionId=0,tokens=700,tokenTime=0;
const post=self.postMessage.bind(self);self.postMessage=(message,...args)=>post({...message,sessionId},...args);
let frameRunning=false;
let faceLandmarker = null;
let handLandmarker = null;
let initPromise = null;
const WASM_ROOT =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let mainOrigin = performance.timeOrigin;
let confetti = false,
  phase = 'idle',
  low = false,
  visionRuntime = null,
  hairSegmenter = null,
  poseLandmarker = null;
let lastFace = null,
  lastFaceTime = 0;
const handCrop = new OffscreenCanvas(512, 512),
  handCropContext = handCrop.getContext('2d');
const tasks = ['face', 'hands', 'hair', 'pose'],
  lastRun = { face: 0, hands: 0, hair: 0, pose: 0 },
  cost = { face: 15, hands: 20, hair: 60, pose: 35 };
const failed = new Set();
async function extraModels(only) {
  for (const task of (only?[only]:['hair', 'pose'])) {
    const loadStarted=performance.now();
    try {
      if (task === 'hair')
        hairSegmenter = await Vision.ImageSegmenter.createFromOptions(
          visionRuntime,
          {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite',
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
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            outputSegmentationMasks: true,
          },
        );
      self.postMessage({ type: 'model', task, ready: true, loadMs:performance.now()-loadStarted });
    } catch (error) {
      failed.add(task);
      self.postMessage({
        type: 'model',
        task,
        loadMs:performance.now()-loadStarted,
        ready: false,
        message: error?.message || '模型加载失败',
      });
    }
  }
}
function rates() {
  if(automatic)return GiftScheduler.rates(phase,low);
  return {
    face: 12,
    hands: phase === 'playing' ? 0 : phase === 'finishing' ? 6 : 12,
    hair:
      phase === 'finishing'
        ? 5
        : phase === 'playing'
          ? low
            ? 5
            : 8
          : phase === 'candidate'
            ? 6
            : 2,
    pose:
      phase === 'finishing'
        ? 4
        : phase === 'playing'
          ? low
            ? 5
            : 6
          : phase === 'candidate'
            ? 6
            : 2,
  };
}
// Keep one shared schedule for capture admission and inference selection.
// 700 ms/s is a wall-time estimate, not a CPU/GPU utilization measurement.
function schedule(timestamp) {
  if(automatic){
    const now=timestamp || performance.timeOrigin+performance.now()-mainOrigin;
    if(!tokenTime)tokenTime=now;
    tokens=Math.min(700,tokens+Math.max(0,now-tokenTime)*.7);tokenTime=now;
    const unavailable=new Set(failed);if(!hairSegmenter)unavailable.add('hair');if(!poseLandmarker)unavailable.add('pose');
    return GiftScheduler.select(now,phase,low,lastRun,cost,unavailable,tokens,preparationSamples);
  }
  const hz = rates();
  let load = 0;
  for (const t of tasks) if (!failed.has(t)) load += hz[t] * cost[t];
  const slowdown = Math.max(1, load / 700);
  let task = null,
    nextCaptureAt = Infinity,
    best = -Infinity;
  for (const t of tasks) {
    if (!hz[t] || failed.has(t)) continue;
    const interval = (1000 / hz[t]) * slowdown;
    const due = lastRun[t] + interval;
    nextCaptureAt = Math.min(nextCaptureAt, due);
    // Prioritize the oldest deadline. Freshness includes inference latency;
    // expired results are still rejected, never granted an extended lifetime.
    const deadline = lastRun[t] + 250 - cost[t];
    const urgency = timestamp - (phase === 'playing' ? deadline : due);
    if (timestamp >= due && urgency > best) {
      task = t;
      best = urgency;
    }
  }
  return { task, nextCaptureAt };
}
function announceSchedule() {
  if (confetti && faceLandmarker && (automatic || hairSegmenter))
    self.postMessage({
      type: 'capture-schedule',
      ...schedule(0),
    });
}
async function inferConfetti(image, timestamp) {
  const { task } = schedule(timestamp);
  if (!task) return;
  const started = performance.now();
  lastRun[task] = timestamp;
  let result;
  try {
    if (task === 'face') {
      const f = faceLandmarker.detectForVideo(image, timestamp);
      lastFace = f.faceLandmarks[0] ? compact(f.faceLandmarks[0]) : null;
      lastFaceTime = timestamp;
      result = { faceLandmarks: lastFace };
    }
    if (task === 'hands') {
      let input = image,
        roi = null;
      if (!automatic && lastFace && timestamp - lastFaceTime < 250) {
        const fw =
            Math.abs(lastFace[234 * 3] - lastFace[454 * 3]) * image.width,
          cx = ((lastFace[234 * 3] + lastFace[454 * 3]) / 2) * image.width,
          my =
            ((lastFace[13 * 3 + 1] + lastFace[14 * 3 + 1]) / 2) * image.height;
        const size = Math.min(Math.max(image.width, image.height), fw * 2.8),
          x = Math.max(0, Math.min(image.width - size, cx - size / 2)),
          y = Math.max(0, Math.min(image.height - size, my - size * 0.32));
        roi = {
          x,
          y,
          w: Math.min(size, image.width - x),
          h: Math.min(size, image.height - y),
        };
        handCropContext.clearRect(0, 0, 512, 512);
        handCropContext.drawImage(
          image,
          roi.x,
          roi.y,
          roi.w,
          roi.h,
          0,
          0,
          512,
          512,
        );
        input = handCrop;
      }
      const h = handLandmarker.detectForVideo(input, timestamp);
      result = {
        hands: h.landmarks.map((points) =>
          compact(
            points.map((p) =>
              roi
                ? {
                    x: (roi.x + p.x * roi.w) / image.width,
                    y: (roi.y + p.y * roi.h) / image.height,
                    z: (p.z * roi.w) / image.width,
                  }
                : p,
            ),
          ),
        ),
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
          ...(Array.isArray(regions)
            ? { lines: regions, patches: [] }
            : regions),
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
    if (task === 'hair') preparationSamples++;
    const duration = performance.now() - started;
    cost[task] = cost[task] * 0.8 + duration * 0.2;
    if(automatic)tokens-=duration;
    self.postMessage({
      type: 'confetti-result',
      task,
      timestamp,
      duration,
      valid:
        task === 'face'
          ? !!lastFace
          : task === 'hands'
            ? result.hands.length > 0
            : task === 'hair'
              ? result.lines.length > 0
              : !!result.pose,
      ...result,
    });
  } catch (error) {
    self.postMessage({
      type: 'confetti-result',
      task,
      timestamp,
      duration: performance.now() - started,
      valid: false,
      error: error?.message || '识别失败',
    });
  }
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
        outputFaceBlendshapes: !confetti && !automatic,
      }),
      Vision.HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        minHandDetectionConfidence: confetti ? 0.35 : 0.5,
        minHandPresenceConfidence: confetti ? 0.35 : 0.5,
        numHands: 2,
      }),
    ]);
    if (confetti && !automatic) await extraModels();
  })();
  return initPromise;
}

self.onmessage = async ({ data }) => {
  if(data.type!=='start' && automatic && data.sessionId!==sessionId){data.image?.close();return;}
  if(data.type==='warmup' && automatic){if(frameRunning)return;frameRunning=true;try{await extraModels(data.task);}finally{frameRunning=false;self.postMessage({type:'frame-done'});announceSchedule();}return;}
  if (data.type === 'configure') {
    if (data.phase === 'candidate' && phase !== 'candidate' && phase !== 'preparing') preparationSamples = 0;
    phase = data.phase;
    low = !!data.low;
    announceSchedule();
    return;
  }
  if (data.type === 'start') {
    automatic=data.scene==='auto';sessionId=data.sessionId??0;if(automatic){cost.hair=30;cost.pose=20;}
    confetti = automatic || data.scene === 'confetti';
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
  if(!image)return;
  if(frameRunning){image.close();self.postMessage({type:'frame-done'});return;}frameRunning=true;
  try {
    await initialize();
    if (confetti) {
      if (
        performance.timeOrigin + performance.now() - mainOrigin - timestamp <
        200
      )
        await inferConfetti(image, timestamp);
      return;
    }
    const face = faceLandmarker.detectForVideo(image, timestamp);
    const hands = handLandmarker.detectForVideo(image, timestamp);
    self.postMessage({
      type: 'result',
      timestamp,
      faceLandmarks: face.faceLandmarks[0]
        ? compact(face.faceLandmarks[0])
        : null,
      blendshapes:
        face.faceBlendshapes?.[0]?.categories.map(
          ({ categoryName, score }) => ({ name: categoryName, score }),
        ) || [],
      hands: hands.landmarks.map(compact),
      worldHands: hands.worldLandmarks.map(compact),
      handedness: hands.handedness.map(
        (items) => items[0]?.categoryName || 'Unknown',
      ),
    });
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || '追踪失败' });
  } finally {
    frameRunning=false;image.close();
    self.postMessage({ type: 'frame-done' });
    announceSchedule();
  }
};
