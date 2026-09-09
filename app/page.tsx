"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Scene = "fireworks" | "hearts" | "bubble";
type TrackingResult = { faceLandmarks: number[] | null; hands: number[][]; handedness: string[] };
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
  const latestTrackingRef = useRef<TrackingResult>({ faceLandmarks: null, hands: [], handedness: [] });
  const [scene, setScene] = useState<Scene>("fireworks");
  const [isCameraOn, setCameraOn] = useState(false);
  const [isPaused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState("未接入");

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
      if (isCameraOn && !isPaused) {
        ctx.save();
        ctx.globalAlpha = 0.72;
        ctx.strokeStyle = SCENES[scene].color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 7]);
        if (scene === "fireworks") {
          ctx.beginPath();
          ctx.ellipse(width / 2, height * 0.36, width * 0.17, height * 0.2, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (scene === "bubble") {
          ctx.beginPath();
          ctx.arc(width * 0.52, height * 0.44, Math.min(width, height) * 0.1, 0, Math.PI * 2);
          ctx.stroke();
        }
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
      const dt = now - lastFrameRef.current;
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
    const worker = new Worker(new URL("./tracking.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ type: string; message?: string; faceLandmarks?: number[] | null; hands?: number[][]; handedness?: string[] }>) => {
      if (event.data.type === "ready") setTrackingStatus("模型就绪");
      if (event.data.type === "error") setTrackingStatus("模型错误");
      if (event.data.type === "result") {
        latestTrackingRef.current = { faceLandmarks: event.data.faceLandmarks ?? null, hands: event.data.hands ?? [], handedness: event.data.handedness ?? [] };
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
    latestTrackingRef.current = { faceLandmarks: null, hands: [], handedness: [] };
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
        <div className="intro"><div><p className="eyebrow">AR INTERACTION PROTOTYPE · T1</p><h1>让动作成为一份看得见的礼物</h1><p className="subcopy">先用真实摄像头验证动作、位置和性能，再加载正式美术素材。</p></div><div className="scope-note"><strong>本地处理</strong><span>视频不会录制或上传</span></div></div>
        <div className="stage-grid">
          <section className="camera-card" aria-label="摄像头预览"><div className="camera-stage"><video ref={videoRef} className="camera-video" muted playsInline aria-label="摄像头画面" /><canvas ref={canvasRef} className="debug-layer" aria-hidden="true" />{!isCameraOn && <div className="camera-empty"><div className="camera-icon">◉</div><p>开启摄像头开始体验</p><span>首次使用时浏览器会请求权限</span></div>}{isPaused && isCameraOn && <div className="paused-cover"><span>互动已暂停</span><small>预览仍在运行，恢复后会重新建立追踪</small></div>}<div className="stage-label"><span className="scene-chip" style={{ background: SCENES[scene].color }}>{SCENES[scene].label}</span><span className="debug-chip">调试轮廓</span></div></div>{error && <p className="error-text" role="alert">{error}</p>}<div className="camera-actions">{!isCameraOn ? <button className="primary-button" onClick={startCamera}>开启摄像头</button> : <button className="secondary-button" onClick={stopCamera}>关闭摄像头</button>}{isCameraOn && <button className="secondary-button" onClick={() => setPaused((value) => !value)}>{isPaused ? "恢复互动" : "暂停互动"}</button>}</div></section>
          <aside className="control-panel"><div className="panel-heading"><div><p className="eyebrow">SCENE SELECT</p><h2>选择互动礼物</h2></div><span className="version-tag">P0</span></div><div className="scene-list">{(Object.keys(SCENES) as Scene[]).map((key) => <button key={key} className={`scene-option ${scene === key ? "selected" : ""}`} onClick={() => { setScene(key); setPaused(false); }} aria-pressed={scene === key}><span className="scene-swatch" style={{ background: SCENES[key].color }}>{key === "fireworks" ? "✹" : key === "hearts" ? "♡" : "◌"}</span><span className="scene-text"><strong>{SCENES[key].label}</strong><small>{SCENES[key].hint}</small></span><span className="scene-arrow">↗</span></button>)}</div><div className="panel-divider" /><div className="readiness"><span className="readiness-icon">⌁</span><div><strong>{isCameraOn ? trackingStatus : "需要摄像头输入"}</strong><span>{isCameraOn ? "单 Worker · 单帧在途 · 15 FPS 上限" : "开启后将进入本地实验"}</span></div></div><div className="metrics"><div><span>渲染 FPS</span><strong>{isCameraOn ? fps : "—"}</strong></div><div><span>推理状态</span><strong>{trackingStatus}</strong></div><div><span>活跃实例</span><strong>0 / 240</strong></div></div></aside>
        </div>
      </section>
      <footer className="footer"><span>原型状态：T1 摄像头与坐标实验</span><span>动作识别与正式素材将在验证通过后接入</span></footer>
    </main>
  );
}
