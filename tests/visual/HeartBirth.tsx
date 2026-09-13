import {useEffect,useRef,useState} from 'react';
import {HeartRenderer} from '../../lib/heart-renderer';
import type {Heart} from '../../lib/interaction';

export default function HeartBirth(){
 const host=useRef<HTMLDivElement>(null),clock=useRef(0),playing=useRef(true);
 const [time,setTime]=useState(0),[play,setPlay]=useState(true),[portrait,setPortrait]=useState(false),[status,setStatus]=useState('加载中…');
 useEffect(()=>{
  const r=new HeartRenderer();let disposed=false,frame=0,last=0;
  const w=portrait?360:640,h=portrait?640:360;
  const heart={active:true,x:w/2,y:h*.7,age:0,size:100,angle:0,appearanceAngle:0,motionAngle:0,colorOrder:0} as Heart;
  host.current!.appendChild(r.renderer.domElement);
  r.load().then(()=>{
   if(disposed)return;setStatus('当前真实模型 · 固定出生位置 · 无碰撞');
   const tick=(now:number)=>{
    if(disposed)return;
    if(playing.current&&last)clock.current=Math.min(.82,clock.current+(now-last)/1000);
    last=now;heart.age=clock.current;r.draw([heart],w,h);setTime(clock.current);
    frame=requestAnimationFrame(tick);
   };frame=requestAnimationFrame(tick);
  }).catch(e=>{if(!disposed)setStatus(String(e));});
  return()=>{disposed=true;cancelAnimationFrame(frame);r.dispose();r.renderer.domElement.remove();};
 },[portrait]);
 const pause=()=>{playing.current=false;setPlay(false);};
 return <main style={{padding:24}}><h1>爱心出生逐帧检查</h1><p>{status}</p>
  <button onClick={()=>{playing.current=!playing.current;setPlay(playing.current);}}>{play?'暂停':'播放'}</button>
  <button onClick={()=>{clock.current=0;playing.current=true;setPlay(true);}}>重播</button>
  <button onClick={()=>{pause();clock.current=Math.min(.82,clock.current+1/60);}}>前进一帧</button>
  <button onClick={()=>setPortrait(!portrait)}>{portrait?'切换横屏':'切换竖屏'}</button>
  <p><input aria-label="出生时间" type="range" min="0" max="0.82" step="0.001" value={time} onChange={e=>{pause();clock.current=Number(e.target.value);setTime(clock.current);}}/> {Math.round(time*1000)} 毫秒</p>
  <div ref={host} style={{width:portrait?360:640,background:'#252934'}}/>
  <p>用于观察模型自身的变大过程；不代表摄像头手势跟随或实机性能验收。</p>
 </main>;
}
