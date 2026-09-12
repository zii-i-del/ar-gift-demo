export type GunPose3D={state:'valid'|'invalid'|'uncertain';reason:string;index:[number,number];thumb:number;closed:[boolean,boolean,boolean]};
const clamp=(v:number)=>Math.max(-1,Math.min(1,v));
export function gunPose3D(raw:number[]|null|undefined, projectedStraight=false):GunPose3D{
 const result:GunPose3D={state:'uncertain',reason:'三维关键点缺失或异常',index:[0,0],thumb:0,closed:[false,false,false]};
 if(!raw || raw.length!==63 || !raw.every(Number.isFinite))return result;
 const d=(a:number,b:number)=>Math.hypot(raw[a*3]-raw[b*3],raw[a*3+1]-raw[b*3+1],raw[a*3+2]-raw[b*3+2]);
 const angle=(a:number,b:number,c:number)=>{
  const ab=d(a,b),bc=d(b,c);if(ab<.001||bc<.001)return NaN;
  let dot=0;for(let k=0;k<3;k++)dot+=(raw[b*3+k]-raw[a*3+k])*(raw[c*3+k]-raw[b*3+k]);
  return Math.acos(clamp(dot/(ab*bc)))*180/Math.PI;
 };
 const ratio=(a:number,b:number,c:number,e:number)=>d(a,e)/(d(a,b)+d(b,c)+d(c,e));
 const i1=angle(5,6,7),i2=angle(6,7,8),thumb=angle(2,3,4);
 if(!Number.isFinite(i1+i2+thumb) || d(5,17)<.01)return result;
 result.index=[i1,i2];result.thumb=thumb;
 const r=ratio(5,6,7,8);
 if(Math.max(i1,i2)>45 || i1+i2>75 || r<.88){result.state=projectedStraight && Math.max(i1,i2)<65 && r>.8?'uncertain':'invalid';result.reason=result.state==='uncertain'?'二维三维食指证据冲突':'三维食指明确弯曲';return result;}
 // Consecutive small bends also form a hook; do not test each joint alone.
 if(!projectedStraight && (Math.max(i1,i2)>32 || i1+i2>42 || r<.95)){result.reason='食指伸直证据不足';return result;}
 if(thumb>55){result.state='invalid';result.reason='三维拇指弯曲';return result;}
 if(thumb>40){result.reason='拇指伸直证据不足';return result;}
 for(let j=0;j<3;j++){
  const a=9+j*4,pip=angle(a,a+1,a+2),dip=angle(a+1,a+2,a+3),r=ratio(a,a+1,a+2,a+3);
  if(!Number.isFinite(pip+dip+r))return result;
  if(pip<25 && dip<25 && r>.94){result.state='invalid';result.reason='其他手指仍伸出';return result;}
  result.closed[j]=Math.max(pip,dip)>45 && pip+dip>70 && r<.86;
 }
 if(!result.closed.every(Boolean)){result.reason='三维收拢证据不足';return result;}
 result.state='valid';result.reason='三维手势通过';return result;
}
