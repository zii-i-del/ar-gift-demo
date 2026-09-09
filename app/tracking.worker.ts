import { FaceLandmarker, FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

type StartMessage = { type: "start" };
type FrameMessage = { type: "frame"; image: ImageBitmap; timestamp: number };
type WorkerMessage = StartMessage | FrameMessage;

let faceLandmarker: FaceLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;
let initPromise: Promise<void> | null = null;

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

function compactLandmarks(landmarks: Array<{ x: number; y: number; z: number }>) {
  return landmarks.flatMap(({ x, y, z }) => [x, y, z]);
}

async function initialize() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
    [faceLandmarker, handLandmarker] = await Promise.all([
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      }),
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
      }),
    ]);
  })();
  return initPromise;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type === "start") {
    try {
      await initialize();
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({ type: "error", message: error instanceof Error ? error.message : "模型加载失败" });
    }
    return;
  }

  const { image, timestamp } = event.data;
  try {
    await initialize();
    if (!faceLandmarker || !handLandmarker) throw new Error("模型尚未就绪");
    const face = faceLandmarker.detectForVideo(image, timestamp);
    const hands = handLandmarker.detectForVideo(image, timestamp);
    const blendshapes = face.faceBlendshapes?.[0]?.categories.map((category) => ({ name: category.categoryName, score: category.score })) ?? [];
    self.postMessage({
      type: "result",
      timestamp,
      faceLandmarks: face.faceLandmarks[0] ? compactLandmarks(face.faceLandmarks[0]) : null,
      blendshapes,
      hands: hands.landmarks.map(compactLandmarks),
      handedness: hands.handedness.map((items) => items[0]?.categoryName ?? "Unknown"),
    });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "追踪失败" });
  } finally {
    image.close();
  }
};
