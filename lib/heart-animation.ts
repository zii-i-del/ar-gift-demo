// Do not uniformly speed up the birth when a consumer uses a shorter lifetime.
export function heartClipTime(age:number,lifetime=3){
  const growth=.82,fade=Math.min(.25,Math.max(0,lifetime-growth));
  if(age<=growth)return Math.max(0,age);
  const fadeStart=lifetime-fade;
  if(age<fadeStart)return growth+(age-growth)/(fadeStart-growth)*(2.35-growth);
  return Math.min(2.999,2.35+(age-fadeStart)/Math.max(.001,fade)*.65);
}
export function heartOpacity(age:number,lifetime=3){
  const duration=Math.min(.25,Math.max(.001,lifetime-.82));
  const t=Math.max(0,Math.min(1,(age-(lifetime-duration))/duration));
  return 1-t*t*(3-2*t);
}
export function heartFallbackScale(age:number,lifetime=3){
  const t=heartClipTime(age,lifetime);
  const keys=[[0,.04],[.12,.15],[.28,.4],[.48,.75],[.68,1.04],[.82,1],[1.5,1],[1.85,1.02],[2.1,1],[2.35,1],[3,.85]];
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
    const [a,x]=keys[i-1],[b,y]=keys[i],q=(t-a)/(b-a);
    return x+(y-x)*q*q*(3-2*q);
  }
  return .85;
}
