import {useEffect,useRef,useState} from 'react';
import {Interaction} from '../../lib/interaction';
export default function HeartMotionPreview(){
 const host=useRef<HTMLDivElement>(null),paused=useRef(false);
 const [mode,setMode]=useState('擦碰'),[revision,setRevision]=useState(0),[status,setStatus]=useState('加载中…'),[playing,setPlaying]=useState(true);
 useEffect(()=>{
  let stopped=false,frame=0,cleanup=()=>{};
  import('../../lib/heart-renderer').then(async({HeartRenderer})=>{
   const r=new HeartRenderer();
   cleanup=()=>{r.renderer.domElement.remove();r.dispose();};
   try{
    await r.load();if(stopped)return;
    host.current?.appendChild(r.renderer.domElement);
    const e=new Interaction();let elapsed=0,last=performance.now(),sequence=0;
    const reset=()=>{elapsed=0;e.reset();e.width=440;e.height=360;
     Object.assign(e.hearts[0],{active:true,x:mode==='收尾'?220:mode==='正碰'?245:205,y:mode==='收尾'?240:105,age:.9,size:100,owner:'preview',vx:0,vy:mode==='收尾'?-20:110,colorOrder:sequence%2,birthOrder:sequence,motionAngle:0,angularVelocity:0,contactAge:undefined,contactBody:undefined,contactReleased:true,motesReleased:false,appearanceAngle:0});
    sequence++;};reset();setStatus('当前直播爱心效果 · 固定碰撞输入');
    const tick=(now:number)=>{const dt=Math.min(.04,(now-last)/1000);last=now;
     if(!paused.current){elapsed+=dt;if(elapsed>1.8)reset();e.acceptHead(mode==='收尾'?null:{x:245,y:170,rx:45,ry:60,angle:0,vx:0,vy:0,omega:0,timestamp:now,reset:false});e.step(dt,now);}
     r.draw(e.hearts,440,360,0,1.9,e.heartPetals);
     frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);
   }catch(e){setStatus('预览加载失败：'+String(e));}
  });return()=>{stopped=true;cancelAnimationFrame(frame);cleanup();};
 },[mode,revision]);
 return <main style={{maxWidth:960,margin:'30px auto',padding:24}}><h1>爱心互动预览</h1><p>{status}</p>
 <div style={{display:'flex',gap:12,margin:'20px 0',flexWrap:'wrap'}}>{['擦碰','正碰','收尾'].map(m=><button key={m} onClick={()=>setMode(m)} style={{padding:'10px 20px',background:mode===m?'#edd7ff':'#eee',border:0,borderRadius:12}}>{m}</button>)}<button onClick={()=>{paused.current=!paused.current;setPlaying(!paused.current);}}>{playing?'暂停':'播放'}</button><button onClick={()=>setRevision(v=>v+1)}>重播</button></div>
 <div style={{display:'grid',gridTemplateColumns:'minmax(0,440px)',gap:16}}><section><h2>当前效果</h2><div style={{position:'relative',aspectRatio:'440 / 360',background:'#252934',borderRadius:20,overflow:'hidden'}}><div ref={host} className="motion-canvas"/>{mode!=='收尾'&&<div style={{position:'absolute',left:'45.45%',top:'30.55%',width:'20.45%',height:'33.33%',border:'1px dashed #85909d',borderRadius:'50%',pointerEvents:'none'}}/>}</div></section></div>
 <p>虚线为碰撞区域示意，不是新增识别。收尾每轮交替粉／黄，散片数量与方向随轮次变化。</p><style>{'.motion-canvas canvas{width:100%!important;height:auto!important;display:block}'}</style></main>;
}
