export const BUBBLE_CAPACITY=32;
export const BUBBLE_LIFETIME=5;
export function bubbleRadius(target:number,age:number){
 const t=Math.max(0,Math.min(1,age/.45));
 return target*(.22+.78*t*t*(3-2*t));
}
// Whole bubbles retain a stable order through pool reuse. No pairwise bubble physics.
export function orderBubbles(bubbles:{active:boolean;birthOrder?:number}[],out:number[]){
 out.length=0;
 for(let i=0;i<bubbles.length;i++)if(bubbles[i].active)out.push(i);
 out.sort((a,b)=>(bubbles[a].birthOrder??a)-(bubbles[b].birthOrder??b));
 return out;
}

const BUBBLE_SIZE_WEIGHTS=[.55,.88,.65,1.12,.74,.60,.98];
export function bubbleTargetRadius(span:number,sequence:number){
 return Math.max(18,Math.min(32,span*.32))*BUBBLE_SIZE_WEIGHTS[sequence%BUBBLE_SIZE_WEIGHTS.length];
}
