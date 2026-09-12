'use client';
import {useEffect,useRef,useState} from 'react';
import {confettiCount} from '../lib/confetti-config';
import {Confetti,type ConfettiPacket} from '../lib/confetti';
import {Interaction,readHand,type Hand} from '../lib/interaction';
import {readHead} from '../lib/head';
import {matchHandTracks} from '../lib/hand-tracks';
import {GiftCoordinator} from '../lib/gift-coordinator';
import {GiftPerformance,GiftGpuTimer} from '../lib/gift-performance';
import type {GiftRenderer} from '../lib/gift-renderer';

type Orientation='landscape'|'portrait';
const constraints=(o:Orientation):MediaTrackConstraints=>o==='portrait'
 ? {facingMode:'user',width:{ideal:720},height:{ideal:1280},frameRate:{ideal:30}}
 : {facingMode:'user',width:{ideal:1280},height:{ideal:720},aspectRatio:{ideal:16/9},...{resizeMode:'none'},frameRate:{ideal:30}};
const gifts=[['✧','捂嘴彩带','双手捂嘴，星星彩带飘落并停留在头发和肩膀上。'],['♡','指尖爱心','拇指与食指比心，保持手势可连续生成爱心。'],['◌','托举泡泡','拇指和食指伸直，其余三指收拢；张开手掌可拨动泡泡。']];
export default function Home(){
 const video=useRef<HTMLVideoElement>(null),host=useRef<HTMLDivElement>(null),debugCanvas=useRef<HTMLCanvasElement>(null);
 const [orientation,setOrientation]=useState<Orientation>('landscape'),[running,setRunning]=useState(false),[retry,setRetry]=useState(0),[debug,setDebug]=useState(false);
 const [status,setStatus]=useState('开启摄像头后，直接做手势即可'),[error,setError]=useState(''),[ready,setReady]=useState<Record<string,boolean>>({});
 const stream=useRef<MediaStream|null>(null),request=useRef(0),session=useRef(0),orientationRef=useRef(orientation),debugRef=useRef(debug);
 const resetRef=useRef(()=>{}),configQueue=useRef<Promise<void>>(Promise.resolve());
 orientationRef.current=orientation;debugRef.current=debug;
 useEffect(()=>{const p=new URLSearchParams(location.search);setOrientation(p.get('orientation')==='portrait'?'portrait':'landscape');if(p.has('debug')||p.has('scene')){p.delete('debug');p.delete('scene');const query=p.toString();history.replaceState(null,'',`${location.pathname}${query?'?'+query:''}${location.hash}`);}},[]);
 const toggleDebug=()=>{const enabled=!debugRef.current;debugRef.current=enabled;setDebug(enabled);const u=new URL(location.href);if(enabled)u.searchParams.set('debug','1');else u.searchParams.delete('debug');history.replaceState(null,'',u);};
 const stop=()=>{setStatus("开启摄像头后，直接做手势即可");request.current++;resetRef.current();stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current){video.current.srcObject=null;}setRunning(false);setReady({});};
 async function start(){stop();setError('');const id=++request.current;setStatus('正在连接摄像头…');try{const s=await navigator.mediaDevices.getUserMedia({audio:false,video:constraints(orientationRef.current)});if(id!==request.current){s.getTracks().forEach(t=>t.stop());return;}stream.current=s;video.current!.srcObject=s;await video.current!.play();if(id===request.current)setRunning(true);}catch{if(id===request.current){setError('摄像头未能开启，请检查权限或占用情况');stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;}}}
 useEffect(()=>()=>{request.current++;stream.current?.getTracks().forEach(t=>t.stop());},[]);
 useEffect(()=>{resetRef.current();const track=stream.current?.getVideoTracks()[0];if(!track)return;let cancelled=false;configQueue.current=configQueue.current.catch(()=>{}).then(async()=>{if(cancelled||track.readyState!=='live')return;try{await track.applyConstraints(constraints(orientation));if(!cancelled)resetRef.current();}catch{if(!cancelled)setError('取景方向切换失败，请重新开启摄像头');}});return()=>{cancelled=true;};},[orientation]);
 useEffect(()=>{
  if(!running)return;
  const v=video.current!,root=host.current!,id=++session.current,c=new Confetti(),i=new Interaction(true),g=new GiftCoordinator(),perf=new GiftPerformance();
  c.externalGestures=true;i.scene='auto';i.autoReady={hearts:false,bubble:false};
  let disposed=false,worker:Worker|null=null,renderer:GiftRenderer|null=null,gpu:GiftGpuTimer|null=null,frame=0,busy=false,next=Infinity,lastVideo=-1,lastFrame=0,lastUi=0,config='',workerReady=false,readyAt=0,faceAt=-Infinity,handsAt=-Infinity,handSeq=0,minimumTimestamp=0,contextLosses=0,recoveries=0,recoveryTimer:ReturnType<typeof setTimeout>|undefined;
  const warmups=['hair','pose'];
  let tracks:Array<{id:string;label:string;wrist:{x:number;y:number};seen:number}>=[];
  const metrics:Record<string,{timestamp:number;duration:number;valid:boolean;error?:string;count:number}>={};
  const reset=()=>{minimumTimestamp=performance.now();c.invalidate();g.reset();i.reset('auto');tracks=[];faceAt=handsAt=-Infinity;lastFrame=0;};resetRef.current=reset;
  const size=()=>{const b=root.getBoundingClientRect();if(b.width&&b.height){if(c.width!==b.width||c.height!==b.height||(v.videoWidth&&c.sourceW!==v.videoWidth)||(v.videoHeight&&c.sourceH!==v.videoHeight))reset();c.resize(b.width,b.height,v.videoWidth||b.width,v.videoHeight||b.height);i.width=b.width;i.height=b.height;}};
  const resize=new ResizeObserver(size);resize.observe(root);
  const visibility=()=>{reset();};document.addEventListener('visibilitychange',visibility);
  const syncConfig=(now:number)=>{const phase=g.phase(c,now),value=phase+':'+perf.low;if(config!==value){worker?.postMessage({type:'configure',sessionId:id,phase,low:perf.low});config=value;}};
  const receive=(event:MessageEvent)=>{
    const p=event.data;if(disposed||p.sessionId!==id)return;
    if(p.type==='frame-done'){busy=false;return;}
    if(p.type==='capture-schedule'){next=p.nextCaptureAt;return;}
    if(p.type==='model'){if(p.task==='hair'){c.modelReady=!!p.ready;c.modelError=p.ready?'':p.message;}if(p.task==='pose')c.poseError=p.ready?'':p.message;return;}
    if(p.type==='ready'){workerReady=true;readyAt=performance.now();setStatus('直接做手势即可');return;}
    if(p.type==='error'){busy=false;next=Infinity;workerReady=false;setError('识别中断，请重试识别');return;}
    if(p.type!=='confetti-result'||p.timestamp<minimumTimestamp||document.hidden)return;
    const now=performance.now();metrics[p.task]={timestamp:p.timestamp,duration:p.duration,valid:p.valid,error:p.error,count:(metrics[p.task]?.count??0)+1};c.accept(p as ConfettiPacket,now);
    if(p.task==='hair'){g.surfaceReady(c,now,!perf.protected&&!!renderer?.ready.confetti&&!renderer.renderer.getContext().isContextLost());syncConfig(now);}
    if(p.task==='face'){faceAt=p.timestamp;i.acceptHead(p.valid&&now-p.timestamp<=200?readHead(p.faceLandmarks,c.width,c.height,c.sourceW,c.sourceH,p.timestamp,i.head):null);}
    if(p.task==='hands'){
      handsAt=p.timestamp;
      const parsed=(p.valid&&!p.error&&now-p.timestamp<=200?p.hands:[]).map((raw:number[],index:number)=>({hand:readHand(raw,`candidate-${index}`,c.width,c.height,c.sourceW,c.sourceH,p.worldHands?.[index]),label:p.handedness?.[index]??'Unknown'})).filter((x:any)=>x.hand);
      const matches=matchHandTracks(parsed,tracks,p.timestamp);
      const hands:Hand[]=parsed.map(({hand,label}:any,index:number)=>{hand.id=matches[index]??`hand-${handSeq++}`;const prior=tracks.find(t=>t.id===hand.id);if(prior){prior.wrist=hand.wrist;prior.seen=p.timestamp;}else tracks.push({id:hand.id,label,wrist:hand.wrist,seen:p.timestamp});return hand;});
      tracks=tracks.filter(t=>p.timestamp-t.seen<=200);
      g.sample(c,hands,p.timestamp,now,!perf.protected&&!!renderer?.ready.confetti&&!renderer.renderer.getContext().isContextLost());
      i.autoBlocked=perf.protected||g.blocked||!renderer||renderer.disposed||renderer.renderer.getContext().isContextLost();i.autoLow=perf.low;i.autoConfetti=c.playing;
      i.acceptHands(g.filter(hands,i.autoBlocked),p.timestamp);syncConfig(now);
    }
  };
  const onLost=(e:Event)=>{e.preventDefault();if(disposed)return;contextLosses++;i.autoBlocked=true;reset();setError('画面恢复中…');clearTimeout(recoveryTimer);recoveryTimer=setTimeout(()=>{if(!disposed&&renderer?.renderer.getContext().isContextLost())void recoverRenderer();},1500);};
  const recoverRenderer=async()=>{if(disposed)return;if(recoveries++>=1){setError('画面恢复失败，请重试识别');return;}clearTimeout(recoveryTimer);gpu?.dispose();gpu=null;const old=renderer;renderer=null;if(old){old.renderer.domElement.removeEventListener('webglcontextlost',onLost);old.dispose();old.renderer.domElement.remove();}await createRenderer();if(!disposed)setError('');};
  const createRenderer=async()=>{const {GiftRenderer}=await import('../lib/gift-renderer');if(disposed)return;const r=new GiftRenderer(v);renderer=r;root.appendChild(r.renderer.domElement);r.renderer.domElement.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';r.renderer.domElement.addEventListener('webglcontextlost',onLost);r.renderer.domElement.addEventListener('webglcontextrestored',()=>{if(!disposed&&renderer===r)void recoverRenderer();});await r.load();if(disposed)return;gpu=new GiftGpuTimer(r.renderer.getContext() as WebGL2RenderingContext);i.autoReady={hearts:r.ready.hearts,bubble:r.ready.bubble};setReady({...r.ready});if(Object.keys(r.errors).length)setError('部分礼物素材未准备好，其余礼物仍可使用');};
  // Sequential material warm-up before inference avoids simultaneous GPU initialization.
  void createRenderer().then(()=>{if(disposed)return;worker=new Worker('/tracking-worker.js');worker.onmessage=receive;worker.onerror=()=>{busy=false;next=Infinity;workerReady=false;setError('识别中断，请重试识别');};worker.postMessage({type:'start',scene:'auto',sessionId:id,timeOrigin:performance.timeOrigin});}).catch(()=>setError('礼物画面准备失败，请重试'));
  const tick=(now:number)=>{
    if(disposed)return;frame=requestAnimationFrame(tick);
    if(document.hidden){lastFrame=0;return;}
    const dt=lastFrame?now-lastFrame:16.67;lastFrame=now;size();
    g.expire(now);const stale=now-handsAt>200;
    i.autoBlocked=perf.protected||g.blocked||stale||!renderer||renderer.disposed||renderer.renderer.getContext().isContextLost();i.autoLow=perf.low;i.autoConfetti=c.playing;
    c.low=perf.low;c.update(dt,now);i.step(Math.min(dt,40)/1000,now);syncConfig(now);
    if(renderer&&!renderer.disposed&&!renderer.renderer.getContext().isContextLost()){gpu?.begin();renderer.draw(c,i,v);gpu?.end();}
    if(workerReady&&!warmups.length&&now-readyAt>4000)perf.update(dt,now,now-faceAt<=250&&now-handsAt<=200);
    if(worker&&workerReady&&!busy&&warmups.length&&now-readyAt>500){busy=true;worker.postMessage({type:'warmup',task:warmups.shift(),sessionId:id});}
    if(worker&&workerReady&&!busy&&now>=next&&v.readyState>=2&&v.currentTime!==lastVideo){busy=true;lastVideo=v.currentTime;const sampled=now;void createImageBitmap(v).then(image=>{if(disposed||document.hidden||sampled<minimumTimestamp){image.close();busy=false;return;}try{worker!.postMessage({type:'frame',sessionId:id,timestamp:sampled,image},[image]);}catch{image.close();busy=false;}}).catch(()=>{busy=false;});}
    if(now-lastUi>500){lastUi=now;
      const confettiStatus=c.playing?'彩带播放中':!g.armed?'任意一只手离嘴片刻，即可准备下一轮':g.message;
      const tierNotice=perf.low?` · 性能低档：下一轮彩带 ${confettiCount(c.height>c.width,true)} 颗，大小不变`:'';
      setStatus((perf.protected?'设备繁忙，暂缓新增礼物':!workerReady?'正在准备识别…':metrics.hands?.error?'手部识别暂不可用，已停止新增礼物':confettiStatus||(!c.modelReady?'彩带识别准备中；可使用已就绪的礼物':c.poseError?'肩膀识别不可用，彩带仅停留在头发':'爱心和泡泡由先确认的手发射，另一只手可拨动礼物'))+tierNotice);
      if(debugRef.current){const canvas=debugCanvas.current;if(canvas){canvas.width=c.width;canvas.height=c.height;const ctx=canvas.getContext('2d');if(ctx)renderer?.confetti.debug(ctx,c,now);}}
    }
  };frame=requestAnimationFrame(tick);
  return()=>{disposed=true;resetRef.current=()=>{};cancelAnimationFrame(frame);clearTimeout(recoveryTimer);resize.disconnect();document.removeEventListener('visibilitychange',visibility);worker?.terminate();gpu?.dispose();if(renderer){renderer.renderer.domElement.removeEventListener('webglcontextlost',onLost);renderer.dispose();renderer.renderer.domElement.remove();}c.invalidate();i.reset();};
 },[running,retry]);
 return <main className="shell"><header className="topbar"><div className="brand">✦ Gift Lab</div><span>{running?'手势互动已开启':'等待开启摄像头'}</span></header><section className="workspace"><div className="intro"><div><p className="eyebrow">GESTURE GIFTS</p><h1>做个手势，礼物自然出现</h1><p>比心、发射泡泡，或双手捂嘴唤起星星彩带。</p></div><div className="scope-note"><strong>本地处理</strong><span>视频不会录制或上传</span></div></div><div className="stage-grid"><section className="camera-card"><div className={`camera-stage ${orientation}`}><video ref={video} className="camera-video" muted playsInline aria-label="摄像头画面"/><div ref={host} style={{position:'absolute',inset:0}}/>{debug&&<canvas ref={debugCanvas} className="debug-layer"/>}{!running&&<div className="camera-empty">开启摄像头，直接做手势</div>}<div className="stage-label"><span className="scene-chip" style={{background:'#a981ff'}}>手势礼物</span><span className="debug-chip">实时互动</span></div></div><p role="status">{status}</p>{error&&<p role="alert" className="error-text">{error}</p>}<div className="camera-actions"><button className="primary-button" onClick={running?stop:start}>{running?'关闭摄像头':'开启摄像头'}</button>{running&&<><button className="secondary-button" onClick={()=>{resetRef.current();setError('');setRetry(n=>n+1);}}>重试识别</button></>}<button className="secondary-button" aria-pressed={debug} onClick={toggleDebug}>{debug?'隐藏识别信息':'显示识别信息'}</button></div></section><aside className="control-panel"><section className="orientation-select"><p className="eyebrow">01 · 画面方向</p><h2>选择横屏或竖屏</h2><div className="orientation-options">{(['landscape','portrait'] as const).map(o=><button key={o} className={`orientation-option ${orientation===o?'selected':''}`} aria-pressed={orientation===o} onClick={()=>{setOrientation(o);const u=new URL(location.href);u.searchParams.set('orientation',o);history.replaceState(null,'',u);}}><span className={`format-icon ${o}`}/><strong>{o==='landscape'?'横屏':'竖屏'}</strong><small>{o==='landscape'?'16:9':'9:16'}</small></button>)}</div></section><div className="panel-divider"/><p className="eyebrow">02 · 手势介绍</p><h2>作出对应手势，触发互动特效（完整露出整个手部，更容易识别）</h2><div className="scene-list">{gifts.map(([icon,name,hint],n)=><article className="scene-option" key={name} style={{cursor:'default'}}><span className="scene-swatch" style={{background:['#f1b848','#a981ff','#4ac7c2'][n]}}>{icon}</span><div className="scene-text"><strong>{name}</strong><small>{hint}</small>{running&&!ready[['confetti','hearts','bubble'][n]]&&<small>准备中</small>}</div></article>)}</div></aside></div></section></main>;
}
