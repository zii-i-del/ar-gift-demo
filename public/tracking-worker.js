/* The classic Worker keeps the MediaPipe runtime out of the React/RSC bundle. */
importScripts("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.js");

let faceLandmarker = null;
let handLandmarker = null;
let initPromise = null;
const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const compact = (landmarks) => landmarks.flatMap(({ x, y, z }) => [x, y, z]);
async function initialize() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const vision = await Vision.FilesetResolver.forVisionTasks(WASM_ROOT);
    [faceLandmarker, handLandmarker] = await Promise.all([
      Vision.FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" }, runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true }),
      Vision.HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" }, runningMode: "VIDEO", numHands: 2 }),
    ]);
  })();
  return initPromise;
}

self.onmessage = async ({ data }) => {
  if (data.type === "start") {
    try { await initialize(); self.postMessage({ type: "ready" }); }
    catch (error) { self.postMessage({ type: "error", message: error?.message || "模型加载失败" }); }
    return;
  }
  const { image, timestamp } = data;
  try {
    await initialize();
    const face = faceLandmarker.detectForVideo(image, timestamp);
    const hands = handLandmarker.detectForVideo(image, timestamp);
    self.postMessage({ type: "result", timestamp, faceLandmarks: face.faceLandmarks[0] ? compact(face.faceLandmarks[0]) : null, blendshapes: face.faceBlendshapes?.[0]?.categories.map(({ categoryName, score }) => ({ name: categoryName, score })) || [], hands: hands.landmarks.map(compact), handedness: hands.handedness.map((items) => items[0]?.categoryName || "Unknown") });
  } catch (error) { self.postMessage({ type: "error", message: error?.message || "追踪失败" }); }
  finally { image.close(); }
};
