"use client";
import {Confetti, type ConfettiPacket} from "../../lib/confetti";
import type {ConfettiRenderer} from "../../lib/confetti-renderer";
import {matchHandTracks} from "../../lib/hand-tracks";
import {orderBubbles} from '../../lib/bubble-stream';

import { useCallback, useEffect, useRef, useState } from "react";
import { orderHearts } from '../../lib/heart-presentation';
import {coverPoint} from "../../lib/coordinates";
import { readHead } from "../../lib/head";
import { Interaction, readHand } from "../../lib/interaction";
import type { BubbleRenderer } from '../../lib/bubble-renderer';
import type { HeartRenderer } from '../../lib/heart-renderer';
import {heartBodyScale,heartCenter,heartSquash} from '../../lib/heart-response';
import {HEART_LIFETIME} from '../../lib/heart-flow';

const cameraConstraints = (orientation: "landscape" | "portrait"): MediaTrackConstraints => orientation === "portrait"
  ? { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30 } }
  : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 }, ...{ resizeMode: "none" }, frameRate: { ideal: 30 } };

type Scene = "hearts" | "bubble" | "confetti";
type Blendshape = { name: string; score: number };
type TrackingResult = { faceLandmarks: number[] | null; blendshapes: Blendshape[]; hands: number[][]; handedness: string[] };
const SCENES: Record<Scene, { label: string; hint: string; color: string }> = {
  confetti: { label: "捂嘴彩带", hint: "双手捂嘴，彩带落在头发和肩膀上。", color: "#f1b848" },
  hearts: { label: "指尖爱心", hint: "用拇指和食指做小比心，左右手都可以。", color: "#a981ff" },
  bubble: { label: "托举泡泡", hint: "拇指、食指伸直张开，其余三指收拢，连续发射泡泡。", color: "#4ac7c2" },
};

export default function Home() {
  const replayUrlRef=useRef<string|null>(null);
  const [replaying,setReplaying]=useState(false);
  const pausedRef=useRef(false);
  const [initialConfetti]=useState(()=>new Confetti());
  const confettiRef=useRef(initialConfetti);
  const confettiRendererRef=useRef<ConfettiRenderer|null>(null);
  const confettiConfigRef=useRef("");
  const [trackingRetry,setTrackingRetry]=useState(0);
  const [debugVisible,setDebugVisible]=useState(false);
  const heartOrderRef=useRef<number[]>([]);
  const bubbleOrderRef=useRef<number[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraConfigQueue = useRef<Promise<void>>(Promise.resolve());
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const physicsTimeRef = useRef(0);
  const lastFpsUpdateRef = useRef(0);
  const fpsWindowRef = useRef({frames:0,elapsed:0});
  const workerRef = useRef<Worker | null>(null);
  const captureFrameRef = useRef<number | null>(null);
  const inferenceBusyRef = useRef(false);
  const lastCaptureRef = useRef(0);
  const nextCaptureRef = useRef(Infinity);
  const capturedVideoTimeRef = useRef(-1);
  const latestTrackingRef = useRef<TrackingResult>({ faceLandmarks: null, blendshapes: [], hands: [], handedness: [] });
  const heartImageRef = useRef<HTMLImageElement | null>(null);
  const heartRendererRef = useRef<HeartRenderer | null>(null);
  const bubbleRendererRef=useRef<BubbleRenderer | null>(null);
  const bubbleImageRef = useRef<HTMLImageElement | null>(null);
  const interactionRef = useRef<Interaction>(null!);
  if(!interactionRef.current)interactionRef.current=new Interaction(true);
  const petalSampleRef=useRef({x:0,y:0,radius:0,angle:0,alpha:0,kind:0,color:0});
  const handTracksRef = useRef<Array<{ id: string; label: string; wrist: { x: number; y: number }; seen: number }>>([]);
  const handSequenceRef = useRef(0);
  const [orientation,setOrientation]=useState<"landscape"|"portrait">("landscape");
  const [scene, setScene] = useState<Scene>("confetti");
  const [isCameraOn, setCameraOn] = useState(false);
  const [isPaused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);
  const [interactionHint, setInteractionHint] = useState("");
  const [trackingStatus, setTrackingStatus] = useState("未接入");
  const debugModeRef = useRef(false);

  useEffect(() => {
    debugModeRef.current = new URLSearchParams(window.location.search).get("debug") === "1";
    setDebugVisible(debugModeRef.current);
    setOrientation(new URLSearchParams(window.location.search).get("orientation")==="portrait"?"portrait":"landscape");
    const initialScene=new URLSearchParams(window.location.search).get('scene');
    if(initialScene==='fireworks'){const url=new URL(window.location.href);url.searchParams.set('scene','confetti');window.history.replaceState(null,'',url);}
    if(initialScene==='hearts'||initialScene==='bubble'||initialScene==='confetti')setScene(initialScene);
  }, []);

  useEffect(() => {
    let disposed=false;
    if(scene!=='hearts')return;
    import('../../lib/heart-renderer').then(async ({HeartRenderer})=>{
      if(disposed)return;
      const renderer=new HeartRenderer('v5',true,true,true);heartRendererRef.current=renderer;
      try{await renderer.load();}catch(e){console.error('Heart GLB failed; rendered PNG fallback',e);renderer.dispose();}
    }).catch(console.error);
    return ()=>{disposed=true;heartRendererRef.current?.dispose();heartRendererRef.current=null;};
  }, [scene]);

  useEffect(()=>{
    if(scene!=='bubble')return;
    let disposed=false;
    import('../../lib/bubble-renderer').then(async ({BubbleRenderer})=>{
      if(disposed)return;
      const renderer=new BubbleRenderer();bubbleRendererRef.current=renderer;
      try{await renderer.load();}catch(e){console.error('Bubble optical material failed',e);renderer.dispose();if(!disposed)setError('气泡材质加载失败，暂时显示基础泡泡，请刷新重试。');}
    }).catch(e=>{console.error(e);if(!disposed)setError('气泡材质加载失败，请刷新重试。');});
    return ()=>{disposed=true;bubbleRendererRef.current?.dispose();bubbleRendererRef.current=null;};
  },[scene]);

  useEffect(() => {
    const heart = new Image(); heart.src = "/assets/heart-vivid-v5.png"; heartImageRef.current = heart;
    const bubble = new Image(); bubble.src = "/assets/bubble-gift.svg"; bubbleImageRef.current = bubble;
  }, []);

  useEffect(()=>{
    const previous=confettiRef.current;confettiRef.current=new Confetti();confettiRef.current.low=previous.low;confettiConfigRef.current="";
    if(scene!=="confetti")return;
    let disposed=false;
    import('../../lib/confetti-renderer').then(({ConfettiRenderer})=>{if(!disposed)confettiRendererRef.current=new ConfettiRenderer();}).catch(()=>setError("彩带绘制暂不可用，请刷新重试。"));
    return ()=>{disposed=true;confettiRendererRef.current?.dispose();confettiRendererRef.current=null;};
  },[scene]);
  useEffect(()=>{pausedRef.current=isPaused;},[isPaused]);
  useEffect(()=>()=>{streamRef.current?.getTracks().forEach(t=>t.stop());if(replayUrlRef.current)URL.revokeObjectURL(replayUrlRef.current);},[]);
  useEffect(()=>{
    const hide=()=>{lastFrameRef.current=0;fpsWindowRef.current.frames=0;fpsWindowRef.current.elapsed=0;if(document.hidden){confettiRef.current.invalidate();interactionRef.current.reset();}};
    document.addEventListener('visibilitychange',hide);
    return ()=>document.removeEventListener('visibilitychange',hide);
  },[]);
  const resizeCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    confettiRef.current.invalidate();
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
      if (interaction && scene!=="confetti") {
        if(interaction.width!==width || interaction.height!==height) interaction.acceptHead(null);
        interaction.width=width;interaction.height=height;interaction.scene=scene;
        if(isCameraOn && !isPaused && !document.hidden && dt>0 && dt<200) {
          physicsTimeRef.current=Math.min(.05,physicsTimeRef.current+dt/1000);
          while(physicsTimeRef.current>=1/60){interaction.step(1/60,now-physicsTimeRef.current*1000+1000/60);physicsTimeRef.current-=1/60;}
        } else {physicsTimeRef.current=0;interaction.acceptHead(null);}
      }
      if(scene==='confetti' && isCameraOn && !isPaused && !document.hidden){
        const c=confettiRef.current,v=videoRef.current;c.resize(width,height,v?.videoWidth||width,v?.videoHeight||height);c.update(dt,now);
        const config=c.phase+':'+c.low;if(confettiConfigRef.current!==config){workerRef.current?.postMessage({type:'configure',phase:c.phase,low:c.low});confettiConfigRef.current=config;}
        const renderer=confettiRendererRef.current;if(renderer){if(c.active){renderer.draw(c);ctx.drawImage(renderer.renderer.domElement,0,0,width,height);}if(debugModeRef.current)renderer.debug(ctx,c,now);}
      }
      if (interaction && isCameraOn && !isPaused && scene !== "confetti") {
        ctx.save();
        if(scene==='hearts' && heartRendererRef.current?.ready){
          heartRendererRef.current.draw(interaction.hearts,width,height,videoRef.current || undefined,undefined,HEART_LIFETIME,0xf2eeee,interaction.heartTails,interaction.heartPetals);
          ctx.drawImage(heartRendererRef.current.renderer.domElement,0,0,width,height);
        }
        for (const index of orderHearts(interaction.hearts,heartOrderRef.current,HEART_LIFETIME)) {
          const heart=interaction.hearts[index];
          if(heartRendererRef.current?.ready)continue;
          if (!heart.active || !heartImageRef.current?.complete) continue;
          ctx.globalAlpha = 1;
          const drawSize = heart.size * heartBodyScale(heart.age,HEART_LIFETIME);
          const center=heartCenter(heart),squeeze=heartSquash(heart),hit=heart.hitAngle??0;
          ctx.save();ctx.translate(center.x,center.y);ctx.rotate(hit);ctx.scale(1-squeeze,1+squeeze*.65);
          ctx.rotate((heart.appearanceAngle ?? heart.angle ?? 0)+(heart.motionAngle??0)-hit);
          // Tight crop of Blender's transparent render; anchor its bottom.
          ctx.drawImage(heartImageRef.current,62,110,516,429,-drawSize/2,-drawSize*429/1032,drawSize,drawSize*429/516);ctx.restore();
        }
        if(scene==='hearts'&&!heartRendererRef.current?.ready&&interaction.heartPetals)for(const group of interaction.heartPetals.groups)if(group.active){
          for(let j=0;j<group.count;j++){
            const p=interaction.heartPetals.sample(group,j,petalSampleRef.current);if(p.alpha<=0)continue;
            ctx.save();ctx.globalAlpha=p.alpha;ctx.translate(p.x,p.y);ctx.rotate(p.angle);
            ctx.fillStyle=ctx.strokeStyle=p.color?'#ffdf8c':'#ffaac5';ctx.beginPath();
            if(p.kind){ctx.lineWidth=Math.max(1,p.radius*.25);ctx.arc(0,0,p.radius*.7,-1.9,1.9);ctx.stroke();}
            else{ctx.arc(0,0,p.radius*.5,0,Math.PI*2);ctx.fill();}ctx.restore();
          }
        }
        if(scene==='bubble' && bubbleRendererRef.current?.ready && videoRef.current){
          ctx.globalAlpha=1;
          if(bubbleRendererRef.current.draw(interaction.bubbles,width,height,videoRef.current))ctx.drawImage(bubbleRendererRef.current.renderer.domElement,0,0,width,height);
        }
        if(!(scene==='bubble' && bubbleRendererRef.current?.ready)) for (const bubbleIndex of orderBubbles(interaction.bubbles,bubbleOrderRef.current)) {
          const bubble=interaction.bubbles[bubbleIndex];
          if (!bubble.active || !bubbleImageRef.current?.complete) continue;
          const scale = bubble.pop >= 0 ? Math.max(0, 1 - bubble.pop / .32) : 1;
          ctx.globalAlpha = bubble.pop >= 0 ? scale : Math.min(1, bubble.age * 10)*(bubble.targetR ? .55 : 1);
          ctx.save();ctx.translate(bubble.x,bubble.y);ctx.rotate(bubble.hitAngle ?? 0);
          const squeeze=(bubble.squashAmount ?? 0)*Math.sin(Math.PI*Math.max(0,bubble.squash ?? 0)/.18);
          const growth=bubble.targetR ? Math.sin(Math.PI*Math.min(1,bubble.age/.45))*.05 : 0;
          ctx.scale(1-squeeze-growth,1+squeeze+growth);
          ctx.drawImage(bubbleImageRef.current,-bubble.r*scale,-bubble.r*scale,bubble.r*2*scale,bubble.r*2*scale);ctx.restore();
        }
        ctx.restore();
      }
      if (debugModeRef.current && isCameraOn && !isPaused && scene!=="confetti") {
        ctx.save();
        ctx.globalAlpha = 0.72;
        ctx.strokeStyle = SCENES[scene].color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 7]);
        if(scene==='hearts'){
          ctx.setLineDash([]);ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText('青：检测方向  紫：心形朝向',12,75);
          for(const memory of interaction.memories.values())if(now-memory.seen<=200){ctx.strokeStyle='#29dce2';ctx.beginPath();ctx.moveTo(memory.ox,memory.oy);ctx.lineTo(memory.ox+memory.dx*40,memory.oy+memory.dy*40);ctx.stroke();}
          for(const h of interaction.hearts)if(h.active){const a=(h.appearanceAngle ?? h.angle ?? 0)-Math.PI/2;ctx.strokeStyle='#b787ff';ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(h.x+Math.cos(a)*30,h.y+Math.sin(a)*30);ctx.stroke();}
        }
        if(scene==='bubble'){
          ctx.setLineDash([]);ctx.font='14px sans-serif';
          let row=0;
          for(const memory of interaction.memories.values())if(now-memory.seen<=200){
            const h=memory.hand;
            const angles=h.indexBends?.map(a=>Math.round(a)).join('° / ') ?? '—';
            const worldAngles=h.gunPose?.index.map(a=>Math.round(a)).join('/') ?? '—';
            const firing=h.gun && memory.gunSince>=0 && now-memory.gunSince>=250;
            const y=75+row*48;
            ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(12,y,width-24,46);
            ctx.fillStyle=h.gun?'#83ffd8':'#fff';
            ctx.fillText(`${h.id}: ${h.gunReason ?? '未知'}`,18,y+17);
            ctx.fillText(`2D:${angles}  3D:${worldAngles}  ${firing?'允许发射':memory.gunGap>=0?'证据不足，暂停': '重新确认中'}  已生成:${memory.gunSequence} 重置:${memory.gunResets}`,18,y+37);row++;
          }
        }
        const head=interaction.head;
        if(head && now-head.timestamp<=200){ctx.beginPath();ctx.ellipse(head.x,head.y,head.rx,head.ry,head.angle,0,Math.PI*2);ctx.stroke();}
        for(const b of interaction.bubbles) if(b.active && (b.squash ?? 0)>0){ctx.beginPath();ctx.moveTo(b.contactX ?? b.x,b.contactY ?? b.y);ctx.lineTo((b.contactX ?? b.x)+Math.cos(b.hitAngle ?? 0)*30,(b.contactY ?? b.y)+Math.sin(b.hitAngle ?? 0)*30);ctx.stroke();}
        const tracking = latestTrackingRef.current;
        if(scene==='bubble'){
          ctx.setLineDash([]);ctx.lineWidth=2;ctx.font='12px sans-serif';
          ctx.fillStyle='#fff';ctx.fillText('识别检查 G6 · 黄：食指 · 青：拇指',18,64);
          if(!tracking.hands.length)ctx.fillText('本帧未检测到手',18,96);
          for(const raw of tracking.hands){
            for(const chain of [[0,5,6,7,8],[0,1,2,3,4]]){
              ctx.strokeStyle=chain[1]===5?'#ffdb4a':'#40ffe0';ctx.fillStyle=ctx.strokeStyle;
              ctx.beginPath();
              for(let j=0;j<chain.length;j++){
                const i=chain[j],p=coverPoint(raw[i*3],raw[i*3+1],width,height,videoRef.current?.videoWidth||640,videoRef.current?.videoHeight||480);
                if(j===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
                ctx.fillText(String(i),p.x+4,p.y-4);
              }
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }
      const fpsWindow=fpsWindowRef.current;
      if(document.hidden || dt<=0 || lastFrameRef.current===0){fpsWindow.frames=0;fpsWindow.elapsed=0;}
      else {fpsWindow.frames++;fpsWindow.elapsed+=dt;}
      if (dt > 0 && now - lastFpsUpdateRef.current > 500) {
        setFps(fpsWindow.elapsed>0?Math.round(fpsWindow.frames*1000/fpsWindow.elapsed):0);
        fpsWindow.frames=0;fpsWindow.elapsed=0;
        setInteractionHint(scene === "confetti" ? confettiRef.current.hint(now) : interaction.hint);
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
  }, [resizeCanvas, isCameraOn, isPaused, scene, orientation]);

  useEffect(() => {
    if (!isCameraOn) {
      workerRef.current?.terminate();
      workerRef.current = null;
      return;
    }
    confettiRef.current.modelReady=false;confettiRef.current.modelError='';confettiRef.current.poseError='';confettiConfigRef.current='';
    nextCaptureRef.current=Infinity;capturedVideoTimeRef.current=-1;
    const worker = new Worker("/tracking-worker.js");
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<Partial<ConfettiPacket> & { ready?:boolean; nextCaptureAt?:number; type: string; message?: string; timestamp?: number; faceLandmarks?: number[] | null; blendshapes?: Blendshape[]; hands?: number[][]; worldHands?: number[][]; handedness?: string[] }>) => {
      if(workerRef.current!==worker)return;
      if(event.data.type==='capture-schedule'){nextCaptureRef.current=event.data.nextCaptureAt??Infinity;return;}
      if(event.data.type==='frame-done'){inferenceBusyRef.current=false;return;}
      if(event.data.type==='model'){
        if(event.data.task==='hair'){confettiRef.current.modelReady=!!event.data.ready;confettiRef.current.modelError=event.data.ready?'':event.data.message||'加载失败';}
        if(event.data.task==='pose')confettiRef.current.poseError=event.data.ready?'':event.data.message||'加载失败';
        return;
      }
      if(event.data.type==='confetti-result'){
        if(!document.hidden&&!pausedRef.current){const v=videoRef.current;if(v)confettiRef.current.resize(v.clientWidth,v.clientHeight,v.videoWidth,v.videoHeight);confettiRef.current.accept(event.data as ConfettiPacket,performance.now());}
        return;
      }
      if (event.data.type === "ready") setTrackingStatus("模型就绪");
      if (event.data.type === "error") {
        if(scene==='confetti'){confettiRef.current.modelError=event.data.message||"模型加载失败";confettiRef.current.modelReady=false;}
        console.error("tracking worker", event.data.message);
        setTrackingStatus(event.data.message ? `模型错误 · ${event.data.message.slice(0, 18)}` : "模型错误");
      }
      if (event.data.type === "result") {
        if(typeof event.data.timestamp!=="number" || performance.now()-event.data.timestamp>200) {
          interactionRef.current.acceptHead(null);return;
        }
        latestTrackingRef.current = { faceLandmarks: event.data.faceLandmarks ?? null, blendshapes: event.data.blendshapes ?? [], hands: event.data.hands ?? [], handedness: event.data.handedness ?? [] };
        const video = videoRef.current;
        const interaction = interactionRef.current;
        if (video && interaction && event.data.hands && typeof event.data.timestamp === "number" && performance.now() - event.data.timestamp <= 200) {
          const sw = video.videoWidth || 640, sh = video.videoHeight || 480;
          interaction.acceptHead(readHead(event.data.faceLandmarks ?? null,video.clientWidth,video.clientHeight,sw,sh,event.data.timestamp,interaction.head));
          const parsed = event.data.hands.map((raw, index) => ({ hand: readHand(raw, `candidate-${index}`, video.clientWidth || 640, video.clientHeight || 400, sw, sh, event.data.worldHands?.[index] ?? null), label: event.data.handedness?.[index] ?? "Unknown" })).filter((item): item is { hand: NonNullable<typeof item.hand>; label: string } => Boolean(item.hand));
          const matches=matchHandTracks(parsed,handTracksRef.current,event.data.timestamp);
          const stableHands = parsed.map(({ hand, label },index) => {
            const id=matches[index] ?? `${label}-${handSequenceRef.current++}`;
            hand.id = id;
            const current = handTracksRef.current.find(track => track.id === id);
            if (current) { current.wrist = hand.wrist; current.seen = event.data.timestamp ?? performance.now(); }
            else handTracksRef.current.push({ id, label, wrist: hand.wrist, seen: event.data.timestamp ?? performance.now() });
            return hand;
          });
          handTracksRef.current = handTracksRef.current.filter(track => (event.data.timestamp ?? performance.now()) - track.seen < 400);
          interaction.acceptHands(stableHands, event.data.timestamp);
        }
        setTrackingStatus("追踪中");
      }
    };
    worker.onerror=()=>{nextCaptureRef.current=Infinity;inferenceBusyRef.current=false;confettiRef.current.modelError="识别中断";confettiRef.current.modelReady=false;setTrackingStatus("识别中断，请重试");};
    worker.postMessage({ type: "start",scene,timeOrigin:performance.timeOrigin });
    return () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      inferenceBusyRef.current = false;
    };
  }, [isCameraOn,scene,trackingRetry]);

  useEffect(() => {
    if (!isCameraOn || isPaused) {
      if (captureFrameRef.current !== null) cancelAnimationFrame(captureFrameRef.current);
      captureFrameRef.current = null;
      return;
    }
    let cancelled=false;
    const capture = async (now: number) => {
      if(cancelled)return;
      const video = videoRef.current;
      const worker = workerRef.current;
      if (!document.hidden && video && worker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && (scene==='confetti' ? now >= nextCaptureRef.current && video.currentTime !== capturedVideoTimeRef.current : now - lastCaptureRef.current >= 66) && !inferenceBusyRef.current) {
        lastCaptureRef.current = now;
        inferenceBusyRef.current = true;
        try {
          const videoTime=video.currentTime;
          const image = await createImageBitmap(video);
          if(cancelled || document.hidden || pausedRef.current || workerRef.current!==worker){
            image.close();if(workerRef.current===worker)inferenceBusyRef.current=false;
          } else {
            try { worker.postMessage({ type: "frame", image, timestamp: now }, [image]); }
            catch(error) { image.close();throw error; }
            capturedVideoTimeRef.current=videoTime;
          }
        } catch {
          if(workerRef.current===worker)inferenceBusyRef.current = false;
        }
      }
      if(!cancelled)captureFrameRef.current = requestAnimationFrame(capture);
    };
    captureFrameRef.current = requestAnimationFrame(capture);
    return () => {
      cancelled=true;
      if (captureFrameRef.current !== null) cancelAnimationFrame(captureFrameRef.current);
      captureFrameRef.current = null;
    };
  }, [isCameraOn, isPaused,scene]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {videoRef.current.srcObject = null;videoRef.current.removeAttribute("src");videoRef.current.loop=false;}
    if(replayUrlRef.current){URL.revokeObjectURL(replayUrlRef.current);replayUrlRef.current=null;}setReplaying(false);
    setCameraOn(false);
    setPaused(false);
    setTrackingStatus("未接入");
    latestTrackingRef.current = { faceLandmarks: null, blendshapes: [], hands: [], handedness: [] };
    interactionRef.current.reset();confettiRef.current.invalidate();
  }, []);

  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!isCameraOn || !track) return;
    let cancelled = false;
    // Serialize reconfiguration so rapid switches cannot restore an older format.
    cameraConfigQueue.current = cameraConfigQueue.current.catch(() => {}).then(async () => {
      if (cancelled || track.readyState !== "live") return;
      try {
        await track.applyConstraints(cameraConstraints(orientation));
        if (cancelled) return;
        confettiRef.current.invalidate();
        interactionRef.current.reset();
        latestTrackingRef.current = { faceLandmarks: null, blendshapes: [], hands: [], handedness: [] };

      } catch {
        if (!cancelled) setError("摄像头未能切换取景方向，请关闭并重新开启摄像头。");
      }
    });
    return () => { cancelled = true; };
  }, [orientation, isCameraOn]);

  const startCamera = async () => {
    stopCamera();setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("当前页面没有可用的摄像头能力，请使用 HTTPS 浏览器打开。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: cameraConstraints(orientation) });
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
      <header className="topbar"><div className="brand"><span className="brand-mark">✦</span><span>Gift Lab</span></div><div className="status-pill"><span className={isCameraOn ? "status-dot live" : "status-dot"} />{isCameraOn ? (replaying?"本地视频回放":"本地摄像头已连接") : "等待开启摄像头"}</div></header>
      <section className="workspace">
        <div className="intro"><div><p className="eyebrow">AR INTERACTION PROTOTYPE · T2</p><h1>让动作成为一份看得见的礼物</h1><p className="subcopy">用表情和手势触发礼物，彩带可停留在头发和肩膀上。</p></div><div className="scope-note"><strong>本地处理</strong><span>视频不会录制或上传</span></div></div>
        <div className="stage-grid">
          <section className="camera-card" aria-label="摄像头预览"><div className={`camera-stage ${orientation}`}><video ref={videoRef} className="camera-video" muted playsInline aria-label="摄像头画面" /><canvas ref={canvasRef} className="debug-layer" aria-hidden="true" />{!isCameraOn && <div className="camera-empty"><div className="camera-icon">◉</div><p>开启摄像头开始体验</p><span>首次使用时浏览器会请求权限</span></div>}{isPaused && isCameraOn && <div className="paused-cover"><span>互动已暂停</span><small>预览仍在运行，恢复后会重新建立追踪</small></div>}<div className="stage-label"><span className="scene-chip" style={{ background: SCENES[scene].color }}>{SCENES[scene].label}</span><span className="debug-chip">实时互动</span></div></div>{isCameraOn && interactionHint && <output>{interactionHint}</output>}{error && <p className="error-text" role="alert">{error}</p>}<div className="camera-actions">{!isCameraOn ? <button className="primary-button" onClick={startCamera}>开启摄像头</button> : <button className="secondary-button" onClick={stopCamera}>关闭摄像头</button>}{isCameraOn && <button className="secondary-button" onClick={() => setPaused((value) => { if (!value) { latestTrackingRef.current = { faceLandmarks: null, blendshapes: [], hands: [], handedness: [] };  interactionRef.current.reset(); confettiRef.current.invalidate(); } return !value; })}>{isPaused ? "恢复互动" : "暂停互动"}</button>}{scene==='confetti'&&debugVisible&&<label className="secondary-button">本地视频回放<input aria-label="本地视频回放" type="file" accept="video/*" style={{maxWidth:180}} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;stopCamera();confettiRef.current.invalidate();const url=URL.createObjectURL(file);replayUrlRef.current=url;const v=videoRef.current;if(!v)return;v.srcObject=null;v.src=url;v.loop=true;v.muted=true;try{await v.play();setReplaying(true);setCameraOn(true);setTrackingRetry(n=>n+1);}catch{setError('无法播放该视频，请选择浏览器支持的 MP4。');}}}/></label>}
          {scene==='confetti'&&isCameraOn&&<button className="secondary-button" onClick={()=>{confettiRef.current.invalidate();setTrackingRetry(n=>n+1);}}>重试识别</button>}
          {scene==='confetti'&&debugVisible&&isCameraOn&&<><button className="secondary-button" onClick={()=>confettiRef.current.trigger(performance.now(),20)}>验证发区：20 颗慢速</button><button className="secondary-button" onClick={()=>confettiRef.current.trigger(performance.now())}>调试：完整彩带</button><button className="secondary-button" onClick={()=>{const c=confettiRef.current;c.reset();c.trigger(performance.now());c.snapshotAt=performance.now()+4000;}}>调试：第 4 秒快照</button><button className="secondary-button" onClick={()=>{const c=confettiRef.current;c.reset();c.trigger(performance.now());c.snapshotAt=performance.now()+6000;}}>调试：第 6 秒快照</button><button className="secondary-button" onClick={()=>confettiRef.current.reset()}>清空本轮</button><button className="secondary-button" onClick={()=>{const c=confettiRef.current;const blob=new Blob([JSON.stringify({date:new Date().toISOString(),browser:navigator.userAgent,...c.report(performance.now())},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='confetti-metrics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>导出性能记录</button></>}
          </div></section>
          <aside className="control-panel"><section className="orientation-select" aria-labelledby="orientation-title"><p className="eyebrow">01 · 画面方向</p><h2 id="orientation-title">选择横屏或竖屏</h2><div className="orientation-options">{(["landscape","portrait"] as const).map(mode=><button key={mode} className={`orientation-option ${orientation===mode?"selected":""}`} aria-pressed={orientation===mode} onClick={()=>{if(mode===orientation)return;setOrientation(mode);confettiRef.current.invalidate();interactionRef.current.reset(scene==='confetti'?'fireworks':scene);setInteractionHint("");const url=new URL(window.location.href);url.searchParams.set('orientation',mode);url.searchParams.set('scene',scene);window.history.replaceState(null,'',url);}}><span className={`format-icon ${mode}`} aria-hidden="true"/><strong>{mode==="landscape"?"横屏":"竖屏"}</strong><small>{mode==="landscape"?"16:9":"9:16"}</small></button>)}</div></section><div className="panel-divider"/><div className="panel-heading"><div><p className="eyebrow">02 · 互动特效</p><h2>选择互动礼物</h2></div><span className="version-tag">P0</span></div><div className="scene-list">{(Object.keys(SCENES) as Scene[]).map((key) => <button key={key} className={`scene-option ${scene === key ? "selected" : ""}`} onClick={() => { setScene(key); const url=new URL(window.location.href);url.searchParams.set("scene",key);url.searchParams.set("orientation",orientation);window.history.replaceState(null,"",url); setPaused(false); confettiRef.current.invalidate();interactionRef.current.reset(key==='confetti'?'fireworks':key);setError(""); }} aria-pressed={scene === key}><span className="scene-swatch" style={{ background: SCENES[key].color }}>{key === "confetti" ? "✧" : key === "hearts" ? "♡" : "◌"}</span><span className="scene-text"><strong>{SCENES[key].label}</strong><small>{SCENES[key].hint}</small></span><span className="scene-arrow">↗</span></button>)}</div><div className="panel-divider" /><div className="readiness"><span className="readiness-icon">⌁</span><div><strong>{isCameraOn ? trackingStatus : "需要摄像头输入"}</strong><span>{isCameraOn ? (scene==='confetti'?"识别与动画独立运行":"单 Worker · 单帧在途 · 15 FPS 上限") : "开启后将进入本地实验"}</span></div></div><div className="metrics"><div><span>渲染 FPS</span><strong>{isCameraOn ? fps : "—"}</strong></div><div><span>推理状态</span><strong>{trackingStatus}</strong></div><div><span>活跃实例</span><strong>≤ 240</strong></div></div></aside>
        </div>
      </section>
      <footer className="footer"><span>原型状态：彩带接触与停留验证</span><span>单人近景 · 视频仅在本机处理</span></footer>
    </main>
  );
}
