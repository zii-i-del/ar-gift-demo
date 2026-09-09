"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Interaction, readHand } from "../lib/interaction";

type Scene = "fireworks" | "hearts" | "bubble";
type Blendshape = { name: string; score: number };
type TrackingResult = { faceLandmarks: number[] | null; blendshapes: Blendshape[]; hands: number[][]; handedness: string[] };
type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number; bounced: boolean; flash: number };
type Firework = { particles: Particle[] };
const SCENES: Record<Scene, { label: string; hint: string; color: string }> = {
  fireworks: { label: "大笑烟花", hint: "保持自然大笑，烟花会在头顶绽放。", color: "#ff6b8a" },
  hearts: { label: "指尖爱心", hint: "用拇指和食指做小比心，左右手都可以。", color: "#a981ff" },
  bubble: { label: "托举泡泡", hint: "食指停留生成泡泡，再从下方用手掌托住。", color: "#4ac7c2" },
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastFpsUpdateRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const captureFrameRef = useRef<number | null>(null);
  const inferenceBusyRef = useRef(false);
  const lastCaptureRef = useRef(0);
  const latestTrackingRef = useRef<TrackingResult>({ faceLandmarks: null, blendshapes: [], hands: [], handedness: [] });
  const fireworksRef = useRef<Firework[]>([]);
  const laughActiveRef = useRef(false);
  const lastBurstRef = useRef(0);
  const sparkImageRef = useRef<HTMLImageElement | null>(null);
  const heartImageRef = useRef<HTMLImageElement | null>(null);
  const bubbleImageRef = useRef<HTMLImageElement | null>(null);
  const interactionRef = useRef(new Interaction());
  const handTracksRef = useRef<Array<{ id: string; label: string; wrist: { x: number; y: number }; seen: number }>>([]);
  const handSequenceRef = useRef(0);
  const [scene, setScene] = useState<Scene>("fireworks");
  const [isCameraOn, setCameraOn] = useState(false);
  const [isPaused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState("未接入");
  const debugModeRef = useRef(false);

  useEffect(() => {
    debugModeRef.current = new URLSearchParams(window.location.search).get("debug") === "1";
  }, []);

  useEffect(() => {
    const image = new Image();
    image.src = "/assets/firework-spark.svg";
    sparkImageRef.current = image;
    const heart = new Image(); heart.src = "/assets/heart-gift.svg"; heartImageRef.current = heart;
    const bubble = new Image(); bubble.src = "/assets/bubble-gift.svg"; bubbleImageRef.current = bubble;
  }, []);

  const resizeCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const rect = video.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    const renderFrame = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const dt = now - lastFrameRef.current;
      const interaction = interactionRef.current;
      if (interaction) { interaction.width = width; interaction.height = height; interaction.scene = scene; interaction.step(dt / 1000, now); }
      if (debugModeRef.current && isCameraOn && !isPaused) {
        ctx.save();
        ctx.globalAlpha = 0.72;
        ctx.strokeStyle = SCENES[scene].color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 7]);
        const tracking = latestTrackingRef.current;
        const indexTip = tracking.hands[0] ? [tracking.hands[0][8 * 3], tracking.hands[0][8 * 3 + 1]] : null;
        if (indexTip && Number.isFinite(indexTip[0]) && Number.isFinite(indexTip[1])) {
          ctx.setLineDash([]);
          ctx.fillStyle = SCENES[scene].color;
          ctx.beginPath();
          ctx.arc((1 - indexTip[0]) * width, indexTip[1] * height, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (scene === "fireworks" && isCameraOn && !isPaused) {
        const shape = Object.fromEntries(latestTrackingRef.current.blendshapes.map(({ name, score }) => [name, score]));
        const laughing = ((shape.mouthSmileLeft ?? 0) + (shape.mouthSmileRight ?? 0)) / 2 > 0.48 && (shape.jawOpen ?? 0) > 0.2;
        const face = latestTrackingRef.current.faceLandmarks;
        const hx = face ? 1 - (face[3] ?? 0.5) : 0.5;
        const hy = face ? (face[4] ?? 0.38) : 0.38;
        if (laughing && (!laughActiveRef.current || now - lastBurstRef.current > 2800) && now - lastBurstRef.current > 1200) {
          if (fireworksRef.current.length >= 3) fireworksRef.current.shift();
          fireworksRef.current.push({ particles: Array.from({ length: 30 }, (_, index) => { const angle = index / 30 * Math.PI * 2; const speed = 0.2 + index % 4 * 0.01; return { x: hx, y: Math.max(0.08, hy - 0.24), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.05, age: 0, life: 1.8, bounced: false, flash: 0 }; }) });
          lastBurstRef.current = now;
        }
        laughActiveRef.current = laughing;
        const rx = width * 0.2;
        const ry = height * 0.24;
        ctx.save();
        for (let i = fireworksRef.current.length - 1; i >= 0; i -= 1) {
          const firework = fireworksRef.current[i];
          for (const particle of firework.particles) {
            particle.age += dt / 1000;
            particle.vy += 0.14 * dt / 1000;
            particle.x += particle.vx * dt / 1000;
            particle.y += particle.vy * dt / 1000;
            const dx = (particle.x - hx) * width;
            const dy = (particle.y - hy) * height;
            if (!particle.bounced && (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) < 1 && particle.vy > 0) {
              particle.vy = -Math.abs(particle.vy) * 0.72;
              particle.vx *= 0.82;
              particle.bounced = true;
              particle.flash = 0.12;
            }
            const alpha = Math.max(0, 1 - particle.age / particle.life);
            const image = sparkImageRef.current;
            if (image?.complete) { ctx.globalAlpha = alpha; ctx.drawImage(image, particle.x * width - 11, particle.y * height - 11, 22, 22); }
            if (particle.flash > 0) { particle.flash -= dt / 1000; ctx.globalAlpha = Math.min(1, particle.flash * 8); ctx.fillStyle = "#fff4a8"; ctx.beginPath(); ctx.arc(particle.x * width, particle.y * height, 13, 0, Math.PI * 2); ctx.fill(); }
          }
          if (firework.particles.every((particle) => particle.age >= particle.life)) fireworksRef.current.splice(i, 1);
        }
        ctx.restore();
      }
      if (interaction && isCameraOn && !isPaused && scene !== "fireworks") {
        ctx.save();
        for (const heart of interaction.hearts) {
          if (!heart.active || !heartImageRef.current?.complete) continue;
          ctx.globalAlpha = Math.max(0, 1 - Math.max(0, heart.age - 1.7) / .9);
          ctx.drawImage(heartImageRef.current, heart.x - heart.size / 2, heart.y - heart.size / 2, heart.size, heart.size);
        }
        for (const bubble of interaction.bubbles) {
          if (!bubble.active || !bubbleImageRef.current?.complete) continue;
          const scale = bubble.pop >= 0 ? Math.max(0, 1 - bubble.pop / .32) : 1;
          ctx.globalAlpha = bubble.pop >= 0 ? scale : Math.min(1, bubble.age * 4);
          ctx.drawImage(bubbleImageRef.current, bubble.x - bubble.r * scale, bubble.y - bubble.r * scale, bubble.r * 2 * scale, bubble.r * 2 * scale);
        }
        ctx.restore();
      }
      if (dt > 0 && now - lastFpsUpdateRef.current > 500) {
        setFps(Math.round(1000 / dt));
        lastFpsUpdateRef.current = now;
      }
      lastFrameRef.current = now;
      frameRef.current = requestAnimationFrame(renderFrame);
    };
    frameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [resizeCanvas, isCameraOn, isPaused, scene]);

  useEffect(() => {
    if (!isCameraOn) {
      workerRef.current?.terminate();
      workerRef.current = null;
      return;
    }
    const worker = new Worker("/tracking-worker.js");
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ type: string; message?: string; timestamp?: number; faceLandmarks?: number[] | null; blendshapes?: Blendshape[]; hands?: number[][]; handedness?: string[] }>) => {
      if (event.data.type === "ready") setTrackingStatus("模型就绪");
      if (event.data.type === "error") {
        console.error("tracking worker", event.data.message);
        setTrackingStatus(event.data.message ? `模型错误 · ${event.data.message.slice(0, 18)}` : "模型错误");
      }
      if (event.data.type === "result") {
        latestTrackingRef.current = { faceLandmarks: event.data.faceLandmarks ?? null, blendshapes: event.data.blendshapes ?? [], hands: event.data.hands ?? [], handedness: event.data.handedness ?? [] };
        const video = videoRef.current;
        const interaction = interactionRef.current;
        if (video && interaction && event.data.hands && typeof event.data.timestamp === "number" && performance.now() - event.data.timestamp <= 200) {
          const sw = video.videoWidth || 640, sh = video.videoHeight || 480;
          const parsed = event.data.hands.map((raw, index) => ({ hand: readHand(raw, `candidate-${index}`, video.clientWidth || 640, video.clientHeight || 400, sw, sh), label: event.data.handedness?.[index] ?? "Unknown" })).filter((item): item is { hand: NonNullable<typeof item.hand>; label: string } => Boolean(item.hand));
          const used = new Set<string>();
          const stableHands = parsed.map(({ hand, label }) => {
            const match = handTracksRef.current.filter(track => track.label === label && !used.has(track.id)).sort((a, b) => Math.hypot(a.wrist.x - hand.wrist.x, a.wrist.y - hand.wrist.y) - Math.hypot(b.wrist.x - hand.wrist.x, b.wrist.y - hand.wrist.y))[0];
            const id = match && Math.hypot(match.wrist.x - hand.wrist.x, match.wrist.y - hand.wrist.y) < Math.max(80, hand.span * 2) ? match.id : `${label}-${handSequenceRef.current++}`;
            used.add(id); hand.id = id;
            const current = handTracksRef.current.find(track => track.id === id);
            if (current) { current.wrist = hand.wrist; current.seen = event.data.timestamp ?? performance.now(); }
            else handTracksRef.current.push({ id, label, wrist: hand.wrist, seen: event.data.timestamp ?? performance.now() });
            return hand;
          });
          handTracksRef.current = handTracksRef.current.filter(track => (event.data.timestamp ?? performance.now()) - track.seen < 400);
          interaction.acceptHands(stableHands, event.data.timestamp);
        }
        inferenceBusyRef.current = false;
        setTrackingStatus("追踪中");
      }
    };
    worker.postMessage({ type: "start" });
    return () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      inferenceBusyRef.current = false;
    };
  }, [isCameraOn]);

  useEffect(() => {
    if (!isCameraOn || isPaused) {
      if (captureFrameRef.current !== null) cancelAnimationFrame(captureFrameRef.current);
      captureFrameRef.current = null;
      return;
    }
    const capture = async (now: number) => {
      const video = videoRef.current;
      const worker = workerRef.current;
      if (video && worker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && now - lastCaptureRef.current >= 66 && !inferenceBusyRef.current) {
        lastCaptureRef.current = now;
        inferenceBusyRef.current = true;
        try {
          const image = await createImageBitmap(video);
          worker.postMessage({ type: "frame", image, timestamp: now }, [image]);
        } catch {
          inferenceBusyRef.current = false;
        }
      }
      captureFrameRef.current = requestAnimationFrame(capture);
    };
    captureFrameRef.current = requestAnimationFrame(capture);
    return () => {
      if (captureFrameRef.current !== null) cancelAnimationFrame(captureFrameRef.current);
      captureFrameRef.current = null;
    };
  }, [isCameraOn, isPaused]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setPaused(false);
    setTrackingStatus("未接入");
    latestTrackingRef.current = { faceLandmarks: null, blendshapes: [], hands: [], handedness: [] };
    interactionRef.current.reset();
  }, []);

  const startCamera = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("当前页面没有可用的摄像头能力，请使用 HTTPS 浏览器打开。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraOn(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "UnknownError";
      setError(name === "NotAllowedError" ? "摄像头权限未开启，请在浏览器地址栏允许访问。" : "摄像头暂时不可用，请关闭其他占用摄像头的页面后重试。");
      stopCamera();
    }
  };

  return (
    <main className="shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">✦</span><span>Gift Lab</span></div><div className="status-pill"><span className={isCameraOn ? "status-dot live" : "status-dot"} />{isCameraOn ? "本地摄像头已连接" : "等待开启摄像头"}</div></header>
      <section className="workspace">
        <div className="intro"><div><p className="eyebrow">AR INTERACTION PROTOTYPE · T2</p><h1>让动作成为一份看得见的礼物</h1><p className="subcopy">爱心和泡泡已进入行为验证，正式美术素材随后替换。</p></div><div className="scope-note"><strong>本地处理</strong><span>视频不会录制或上传</span></div></div>
        <div className="stage-grid">
          <section className="camera-card" aria-label="摄像头预览"><div className="camera-stage"><video ref={videoRef} className="camera-video" muted playsInline aria-label="摄像头画面" /><canvas ref={canvasRef} className="debug-layer" aria-hidden="true" />{!isCameraOn && <div className="camera-empty"><div className="camera-icon">◉</div><p>开启摄像头开始体验</p><span>首次使用时浏览器会请求权限</span></div>}{isPaused && isCameraOn && <div className="paused-cover"><span>互动已暂停</span><small>预览仍在运行，恢复后会重新建立追踪</small></div>}<div className="stage-label"><span className="scene-chip" style={{ background: SCENES[scene].color }}>{SCENES[scene].label}</span><span className="debug-chip">实时互动</span></div></div>{error && <p className="error-text" role="alert">{error}</p>}<div className="camera-actions">{!isCameraOn ? <button className="primary-button" onClick={startCamera}>开启摄像头</button> : <button className="secondary-button" onClick={stopCamera}>关闭摄像头</button>}{isCameraOn && <button className="secondary-button" onClick={() => setPaused((value) => { if (!value) { latestTrackingRef.current = { faceLandmarks: null, blendshapes: [], hands: [], handedness: [] }; fireworksRef.current = []; interactionRef.current.reset(); } return !value; })}>{isPaused ? "恢复互动" : "暂停互动"}</button>}</div></section>
          <aside className="control-panel"><div className="panel-heading"><div><p className="eyebrow">SCENE SELECT</p><h2>选择互动礼物</h2></div><span className="version-tag">P0</span></div><div className="scene-list">{(Object.keys(SCENES) as Scene[]).map((key) => <button key={key} className={`scene-option ${scene === key ? "selected" : ""}`} onClick={() => { setScene(key); setPaused(false); interactionRef.current.reset(key); }} aria-pressed={scene === key}><span className="scene-swatch" style={{ background: SCENES[key].color }}>{key === "fireworks" ? "✹" : key === "hearts" ? "♡" : "◌"}</span><span className="scene-text"><strong>{SCENES[key].label}</strong><small>{SCENES[key].hint}</small></span><span className="scene-arrow">↗</span></button>)}</div><div className="panel-divider" /><div className="readiness"><span className="readiness-icon">⌁</span><div><strong>{isCameraOn ? trackingStatus : "需要摄像头输入"}</strong><span>{isCameraOn ? "单 Worker · 单帧在途 · 15 FPS 上限" : "开启后将进入本地实验"}</span></div></div><div className="metrics"><div><span>渲染 FPS</span><strong>{isCameraOn ? fps : "—"}</strong></div><div><span>推理状态</span><strong>{trackingStatus}</strong></div><div><span>活跃实例</span><strong>≤ 240</strong></div></div></aside>
        </div>
      </section>
      <footer className="footer"><span>原型状态：T2 爱心与泡泡行为验证</span><span>当前视觉为测试素材，正式美术将独立替换</span></footer>
    </main>
  );
}
