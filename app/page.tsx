import {useEffect,useRef,useState} from 'react';
import {Confetti,type ConfettiPacket} from '../lib/confetti';
import {Interaction,readHand,type Hand} from '../lib/interaction';
import {readHead} from '../lib/head';
import {matchHandTracks} from '../lib/hand-tracks';
import {GiftCoordinator} from '../lib/gift-coordinator';
import type {GiftRenderer} from '../lib/gift-renderer';

type Orientation='landscape'|'portrait';
type CameraConstraints=MediaTrackConstraints & {resizeMode?:'none'};
type TrackingMessage={sessionId:number} & (
 | {type:'frame-done'|'ready'}
 | {type:'capture-schedule';nextCaptureAt:number;reason:string}
 | {type:'model';task:'hair'|'pose';ready:boolean;message?:string}
 | {type:'error';message?:string}
 | ({type:'confetti-result';worldHands?:number[][];handedness?:string[]} & ConfettiPacket)
);
const constraints=(o:Orientation):CameraConstraints=>o==='portrait'
 ? {facingMode:'user',width:{ideal:720},height:{ideal:1280},frameRate:{ideal:30}}
 : {facingMode:'user',width:{ideal:1280},height:{ideal:720},aspectRatio:{ideal:16/9},resizeMode:'none',frameRate:{ideal:30}};
const gifts=[['confetti','感动彩带'],['heart','指尖爱心'],['bubble','为自己打call']];
export default function Home(){
 const video=useRef<HTMLVideoElement>(null),host=useRef<HTMLDivElement>(null),debugCanvas=useRef<HTMLCanvasElement>(null);
 const [orientation,setOrientation]=useState<Orientation>(()=>new URLSearchParams(location.search).get('orientation')==='portrait'?'portrait':'landscape'),[running,setRunning]=useState(false),[retry,setRetry]=useState(0),[debug,setDebug]=useState(false);
 const [status,setStatus]=useState('开启摄像头后，直接做手势即可'),[error,setError]=useState(''),[ready,setReady]=useState<Record<string,boolean>>({});
 const stream=useRef<MediaStream|null>(null),request=useRef(0),session=useRef(0),orientationRef=useRef(orientation),debugRef=useRef(debug);
 const resetRef=useRef(()=>{}),configQueue=useRef<Promise<void>>(Promise.resolve());
 useEffect(()=>{const p=new URLSearchParams(location.search);if(p.has('debug')||p.has('scene')){p.delete('debug');p.delete('scene');const query=p.toString();history.replaceState(null,'',`${location.pathname}${query?'?'+query:''}${location.hash}`);}},[]);
 const toggleDebug=()=>{const enabled=!debugRef.current;debugRef.current=enabled;setDebug(enabled);const u=new URL(location.href);if(enabled)u.searchParams.set('debug','1');else u.searchParams.delete('debug');history.replaceState(null,'',u);};
 const stop=()=>{setStatus("开启摄像头后，直接做手势即可");request.current++;resetRef.current();stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current){video.current.srcObject=null;}setRunning(false);setReady({});};
 async function start(){stop();setError('');const id=++request.current;setStatus('正在连接摄像头…');try{const s=await navigator.mediaDevices.getUserMedia({audio:false,video:constraints(orientationRef.current)});if(id!==request.current){s.getTracks().forEach(t=>t.stop());return;}stream.current=s;video.current!.srcObject=s;await video.current!.play();if(id===request.current)setRunning(true);}catch{if(id===request.current){setError('摄像头未能开启，请检查权限或占用情况');stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;}}}
 useEffect(()=>()=>{request.current++;stream.current?.getTracks().forEach(t=>t.stop());},[]);
 useEffect(()=>{resetRef.current();const track=stream.current?.getVideoTracks()[0];if(!track)return;let cancelled=false;configQueue.current=configQueue.current.catch(()=>{}).then(async()=>{if(cancelled||track.readyState!=='live')return;try{await track.applyConstraints(constraints(orientation));if(!cancelled)resetRef.current();}catch{if(!cancelled)setError('取景方向切换失败，请重新开启摄像头');}});return()=>{cancelled=true;};},[orientation]);
 useEffect(()=>{
  if(!running)return;
  const v=video.current!,root=host.current!,id=++session.current,c=new Confetti(),i=new Interaction(),g=new GiftCoordinator();
  i.autoReady={hearts:false,bubble:false};
  let disposed=false,worker:Worker|null=null,renderer:GiftRenderer|null=null,frame=0,busy=false,next=Infinity,lastVideo=-1,lastFrame=0,lastUi=0,config='',workerReady=false,handsAt=-Infinity,handSeq=0,minimumTimestamp=0,recoveries=0,recoveryTimer:ReturnType<typeof setTimeout>|undefined;
  const modelsToLoad=['hair','pose'];
  let requestTimer:ReturnType<typeof setTimeout>|undefined,waiting='',scheduleReason='',interrupted=false;
  const finishRequest=()=>{clearTimeout(requestTimer);requestTimer=undefined;busy=false;waiting='';};
  const failRequest=()=>{finishRequest();worker?.terminate();workerReady=false;interrupted=true;next=Infinity;handsAt=-Infinity;g.reset();i.autoBlocked=true;setError('识别中断，请重试识别');};
  const beginRequest=(stage:string,timeout:number)=>{busy=true;waiting=stage;requestTimer=setTimeout(failRequest,timeout);};
  let bubbleReasons:string[]=[];
  let tracks:Array<{id:string;label:string;wrist:{x:number;y:number};seen:number}>=[];
  const metrics:Record<string,{timestamp:number;duration:number;valid:boolean;error?:string;count:number}>={};
  const reset=()=>{minimumTimestamp=performance.now();c.invalidate();g.reset();i.reset();tracks=[];bubbleReasons=[];handsAt=-Infinity;lastFrame=0;};resetRef.current=reset;
  const size=()=>{
    if(disposed)return;
    const {width,height}=root.getBoundingClientRect();
    if(!width||!height)return;
    const sourceW=v.videoWidth||width,sourceH=v.videoHeight||height;
    if(c.width===width&&c.height===height&&c.sourceW===sourceW&&c.sourceH===sourceH)return;
    reset();c.resize(width,height,sourceW,sourceH);i.width=width;i.height=height;
  };
  const resize=new ResizeObserver(size);resize.observe(root);
  v.addEventListener('loadedmetadata',size);v.addEventListener('resize',size);size();
  const visibility=()=>{reset();};document.addEventListener('visibilitychange',visibility);
  const syncConfig=(now:number)=>{const value=g.phase(c,now);if(config!==value){worker?.postMessage({type:'configure',sessionId:id,phase:value});config=value;}};
  const receive=(event:MessageEvent<TrackingMessage>)=>{
    const p=event.data;if(disposed||interrupted||p.sessionId!==id)return;
    if(p.type==='frame-done'){finishRequest();return;}
    if(p.type==='capture-schedule'){next=p.nextCaptureAt;scheduleReason=p.reason;return;}
    if(p.type==='model'){if(p.task==='hair'){c.modelReady=!!p.ready;c.modelError=p.ready?'':p.message??'';}if(p.task==='pose')c.poseError=p.ready?'':p.message??'';return;}
    if(p.type==='ready'){finishRequest();workerReady=true;setStatus('直接做手势即可');return;}
    if(p.type==='error'){failRequest();return;}
    if(p.type!=='confetti-result'||p.timestamp<minimumTimestamp||document.hidden)return;
    const now=performance.now();metrics[p.task]={timestamp:p.timestamp,duration:p.duration,valid:p.valid,error:p.error,count:(metrics[p.task]?.count??0)+1};c.accept(p,now);
    if(p.task==='hair'){g.surfaceReady(c,now,c.modelReady&&!!renderer?.ready.confetti&&!renderer.renderer.getContext().isContextLost());syncConfig(now);}
    if(p.task==='face'){i.acceptHead(c.width>c.height&&p.valid&&now-p.timestamp<=200?readHead(p.faceLandmarks??null,c.width,c.height,c.sourceW,c.sourceH,p.timestamp,i.head):null);}
    if(p.task==='hands'){
      handsAt=p.timestamp;
      const parsed=(p.valid&&!p.error&&now-p.timestamp<=200?(p.hands??[]):[]).map((raw:number[],index:number)=>({hand:readHand(raw,`candidate-${index}`,c.width,c.height,c.sourceW,c.sourceH,p.worldHands?.[index]),label:p.handedness?.[index]??'Unknown'})).filter((x):x is {hand:Hand;label:string}=>x.hand!==null);
      if(debugRef.current)bubbleReasons=parsed.map(({hand,label})=>`${label}: ${hand.gunReason}`);
      const matches=matchHandTracks(parsed,tracks,p.timestamp);
      const hands:Hand[]=parsed.map(({hand,label},index:number)=>{hand.id=matches[index]??`hand-${handSeq++}`;const prior=tracks.find(t=>t.id===hand.id);if(prior){prior.wrist=hand.wrist;prior.seen=p.timestamp;}else tracks.push({id:hand.id,label,wrist:hand.wrist,seen:p.timestamp});return hand;});
      tracks=tracks.filter(t=>p.timestamp-t.seen<=200);
      g.sample(c,hands,p.timestamp,now,c.modelReady&&!!renderer?.ready.confetti&&!renderer.renderer.getContext().isContextLost());
      i.autoBlocked=g.blocked||!renderer||renderer.disposed||renderer.renderer.getContext().isContextLost();i.autoConfetti=c.playing;
      i.acceptHands(g.filter(hands,i.autoBlocked),p.timestamp);syncConfig(now);
    }
  };
  const onLost=(e:Event)=>{e.preventDefault();if(disposed)return;i.autoBlocked=true;reset();setError('画面恢复中…');clearTimeout(recoveryTimer);recoveryTimer=setTimeout(()=>{if(!disposed&&renderer?.renderer.getContext().isContextLost())void recoverRenderer();},1500);};
  const recoverRenderer=async()=>{if(disposed)return;if(recoveries++>=1){setError('画面恢复失败，请重试识别');return;}clearTimeout(recoveryTimer);const old=renderer;renderer=null;if(old){old.renderer.domElement.removeEventListener('webglcontextlost',onLost);old.dispose();old.renderer.domElement.remove();}await createRenderer();};
  const createRenderer=async()=>{
    const {GiftRenderer}=await import('../lib/gift-renderer');if(disposed)return;
    const r=new GiftRenderer(v);renderer=r;
    root.appendChild(r.renderer.domElement);
    r.renderer.domElement.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    r.renderer.domElement.addEventListener('webglcontextlost',onLost);
    r.renderer.domElement.addEventListener('webglcontextrestored',()=>{if(!disposed&&renderer===r)void recoverRenderer();});
    await r.load();
    if(disposed||renderer!==r||r.disposed)return;
    i.autoReady={hearts:r.ready.hearts,bubble:r.ready.bubble};setReady({...r.ready});
    setError(Object.keys(r.errors).length?'部分礼物素材未准备好，其余礼物仍可使用':'');
    // Only the current renderer starts inference, once, after material warm-up.
    if(!worker){
      worker=new Worker('./tracking-worker.js');worker.onmessage=receive;
      worker.onerror=failRequest;worker.onmessageerror=failRequest;
      beginRequest('加载脸手模型',30000);
      worker.postMessage({type:'start',sessionId:id,timeOrigin:performance.timeOrigin});
    }
  };
  void createRenderer().catch(()=>{if(!disposed)setError('礼物画面准备失败，请重试');});
  const tick=(now:number)=>{
    if(disposed)return;frame=requestAnimationFrame(tick);
    if(document.hidden){lastFrame=0;return;}
    const dt=lastFrame?now-lastFrame:16.67;lastFrame=now;
    g.expire(now);const stale=now-handsAt>200||!workerReady;
    i.autoBlocked=g.blocked||stale||!renderer||renderer.disposed||renderer.renderer.getContext().isContextLost();i.autoConfetti=c.playing;
    c.update(dt,now,debugRef.current);i.step(Math.min(dt,40)/1000,now,dt/1000);syncConfig(now);
    if(renderer&&!renderer.disposed&&!renderer.renderer.getContext().isContextLost()){renderer.draw(c,i,v);}
    if(worker&&workerReady&&!busy&&now>=next&&v.readyState>=2&&v.currentTime!==lastVideo){
      const canLoad=now-handsAt<=200&&now-(metrics.face?.timestamp??-Infinity)<=250;
      const task=canLoad&&(modelsToLoad[0]==='hair'||c.modelReady||c.modelError)?modelsToLoad.shift():undefined;
      if(task){beginRequest(`加载${task==='hair'?'头发':'肩部'}模型`,30000);try{worker.postMessage({type:'load-model',task,sessionId:id});}catch{failRequest();}}
      else {
      const sampled=now;lastVideo=v.currentTime;beginRequest('取帧',scheduleReason==='warmup'?30000:5000);
      void createImageBitmap(v).then(image=>{
        if(disposed||interrupted){image.close();return;}
        if(document.hidden||sampled<minimumTimestamp){image.close();finishRequest();return;}
        waiting='推理';
        try{worker!.postMessage({type:'frame',sessionId:id,timestamp:sampled,image},[image]);}catch{image.close();failRequest();}
      }).catch(()=>{if(!disposed&&!interrupted)failRequest();});
      }
    }
    if(now-lastUi>500){lastUi=now;
      const landscape=c.width>c.height;
      const kind=!i.autoBlocked&&i.primaryEmitter.reason==='emitting'?i.primaryEmitter.kind:'';
      const giftHint=kind==='hearts'
        ? landscape?'保持比心，持续生成爱心；爱心会与脸部碰撞':'保持比心，持续生成爱心'
        : kind==='bubble'
          ? landscape?'保持发射手势，持续生成泡泡；张开手掌可拨动，泡泡会与脸部和画面边缘碰撞':'保持发射手势，泡泡轻摆上浮；张开手掌可拨动泡泡'
          : '';
      const confettiStatus=c.playing?'彩带播放中':g.preparing>=0?'正在准备头发接触表面…':g.candidate>=0?'正在确认双手捂嘴':giftHint||(!g.armed?'任意一只手离嘴片刻，即可准备下一轮彩带':g.message);
      setStatus((interrupted?'识别中断，请重试识别':!workerReady?'正在准备识别，请稍候…':c.modelError?'彩带识别暂不可用，请重试识别':metrics.hands?.error?'手部识别暂不可用，已停止新增礼物':confettiStatus||(!c.modelReady?'彩带识别准备中，请稍候；爱心和泡泡可正常使用':c.poseError?'肩膀识别不可用，彩带仅停留在头发':'爱心和泡泡由先确认的手发射，张开手掌可拨动泡泡')));
      if(debugRef.current){const canvas=debugCanvas.current;if(canvas){canvas.width=c.width;canvas.height=c.height;const ctx=canvas.getContext('2d');if(ctx){renderer?.confetti.debug(ctx,c,now);ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(`泡泡：${bubbleReasons.join('；')||'未检测到可用手部'}`,12,c.height-32);ctx.fillText(`识别：${waiting||'等待下一帧'} · ${scheduleReason} · ${g.reason}`,12,c.height-14);}}}
    }
  };frame=requestAnimationFrame(tick);
  return()=>{disposed=true;finishRequest();resetRef.current=()=>{};cancelAnimationFrame(frame);clearTimeout(recoveryTimer);resize.disconnect();v.removeEventListener('loadedmetadata',size);v.removeEventListener('resize',size);document.removeEventListener('visibilitychange',visibility);worker?.terminate();if(renderer){renderer.renderer.domElement.removeEventListener('webglcontextlost',onLost);renderer.dispose();renderer.renderer.domElement.remove();}c.invalidate();i.reset();};
 },[running,retry]);
 return <main className="shell"><header className="topbar"><div className="brand">✦ Gift Lab</div><span>{running?'手势互动已开启':'等待开启摄像头'}</span></header><section className="workspace"><div className="intro"><div><p className="eyebrow">GESTURE GIFTS</p><h1>做个手势，礼物自然出现</h1><p className="subcopy">比心、发射泡泡，或双手捂嘴唤起星星彩带</p></div><div className="scope-note"><strong>本地处理</strong><span>视频不会录制或上传</span></div></div><div className="stage-grid"><section className="camera-card"><div className={`camera-stage ${orientation}`}><video ref={video} className="camera-video" muted playsInline aria-label="摄像头画面"/><div ref={host} style={{position:'absolute',inset:0}}/>{debug&&<canvas ref={debugCanvas} className="debug-layer"/>}{!running&&<div className="camera-empty">开启摄像头，直接做手势</div>}<div className="stage-label"><span className="scene-chip" style={{background:'#a981ff'}}>手势礼物</span><span className="debug-chip">实时互动</span></div></div><output className="camera-status">{status}</output>{error&&<p role="alert" className="error-text">{error}</p>}<div className="camera-actions"><button className="primary-button" onClick={running?stop:start}>{running?'关闭摄像头':'开启摄像头'}</button>{running&&<><button className="secondary-button" onClick={()=>{resetRef.current();setError('');setRetry(n=>n+1);}}>重试识别</button></>}<button className="secondary-button" aria-pressed={debug} onClick={toggleDebug}>{debug?'隐藏识别信息':'显示识别信息'}</button></div></section><aside className="control-panel"><section className="orientation-select"><p className="eyebrow">01 · 画面方向</p><h2>选择横屏或竖屏</h2><div className="orientation-options">{(['landscape','portrait'] as const).map(o=><button key={o} className={`orientation-option ${orientation===o?'selected':''}`} aria-pressed={orientation===o} onClick={()=>{orientationRef.current=o;setOrientation(o);const u=new URL(location.href);u.searchParams.set('orientation',o);history.replaceState(null,'',u);}}><span className={`format-icon ${o}`}/><strong>{o==='landscape'?'横屏':'竖屏'}</strong><small>{o==='landscape'?'16:9':'9:16'}</small></button>)}</div></section><section className="gesture-panel"><p className="eyebrow">02 · 手势介绍</p><h2>作出对应手势，触发互动特效</h2><p className="gesture-note">完整露出整个手部，更容易识别</p><div className="scene-list">{gifts.map(([image,name],n)=><article className="scene-option" key={name}><img className="gesture-guide" src={`./assets/gesture-guide/${image}.jpg`} alt={`${name}手势示意`} width={512} height={512} decoding="async"/><div className="scene-text"><strong>{name}</strong>{running&&!ready[['confetti','hearts','bubble'][n]]&&<small>准备中</small>}</div></article>)}</div></section></aside></div></section></main>;
}
