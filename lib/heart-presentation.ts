const DEG=Math.PI/180;
export function heartAppearanceAngle(emitterAngle:number,spreadAngle:number){
 const a=Math.atan2(Math.sin(emitterAngle+Math.PI/2),Math.cos(emitterAngle+Math.PI/2));
 return Math.max(-30*DEG,Math.min(30*DEG,Math.max(-27*DEG,Math.min(27*DEG,a))+Math.max(-3*DEG,Math.min(3*DEG,spreadAngle*.25))));
}
type OrderedHeart={active:boolean;age:number;birthOrder?:number};
export function orderHearts(hearts:OrderedHeart[],indices:number[],lifetime:number){
 indices.length=0;for(let i=0;i<hearts.length;i++)if(hearts[i].active&&hearts[i].age<lifetime)indices.push(i);
 indices.sort((a,b)=>{
  const x=hearts[a],y=hearts[b];
  return x.birthOrder!==undefined&&y.birthOrder!==undefined?x.birthOrder-y.birthOrder:y.age-x.age||a-b;
 });return indices;
}
export function heartDepthLayout(radius:number,count:number){
 const spacing=2*radius+2,cameraZ=Math.max(1000,count*spacing+radius+10),backgroundZ=-radius-10;
 return {spacing,cameraZ,backgroundZ,far:cameraZ-backgroundZ+10};
}
