'use client';
import {useEffect,useRef,useState} from 'react';
import {GiftRenderer} from '../../lib/gift-renderer';
import {Confetti} from '../../lib/confetti';
import {Interaction} from '../../lib/interaction';
export default function Composition(){
 const host=useRef<HTMLDivElement>(null),[status,setStatus]=useState('正在准备合成验证');
 useEffect(()=>{let disposed=false,frame=0;const video=document.createElement('video');video.muted=true;video.loop=true;video.src='/assets/composition-background.webm';
 const r=new GiftRenderer(video),c=new Confetti(),i=new Interaction(true);video.style.cssText='position:absolute;inset:0;width:100%;height:100%;transform:scaleX(-1)';host.current!.appendChild(video);r.renderer.domElement.style.cssText='position:absolute;inset:0';host.current!.appendChild(r.renderer.domElement);c.width=i.width=640;c.height=i.height=360;
 const paint=()=>{if(disposed)return;for(let n=0;n<160;n++){const p=c.particles[n];Object.assign(p,{state:1,x:20+n%20*31,y:25+Math.floor(n/20)*39,w:14,h:14,angle:n*.5,flip:n*.7,alpha:1,color:n%4});}
 for(let n=0;n<12;n++)Object.assign(i.hearts[n],{active:true,x:50+n*48,y:n>8?250:160,age:.5,size:38,owner:'test',birthOrder:n,colorOrder:n%2});
 for(let n=0;n<32;n++)Object.assign(i.bubbles[n],{active:true,x:30+n%16*38,y:250+Math.floor(n/16)*50,r:22,age:1,pop:-1,birthOrder:n});
 r.draw(c,i,video);frame=requestAnimationFrame(paint);};
 video.play().catch(()=>{});r.load().then(()=>{if(disposed)return;setStatus('三礼物合成 · 160 星星 / 12 爱心 / 32 泡泡 · 单 WebGL 上下文');paint();});
 return()=>{disposed=true;cancelAnimationFrame(frame);video.pause();video.removeAttribute('src');video.load();r.dispose();r.renderer.domElement.remove();video.remove();};},[]);
 return <main style={{padding:24}}><h1>三礼物合成验证</h1><p>{status}</p><div ref={host} style={{position:'relative',width:640,height:360,background:'linear-gradient(135deg,#cce5ed,#f7d8db)'}}/></main>;
}
