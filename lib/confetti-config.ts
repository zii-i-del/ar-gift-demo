export const CONFETTI_SIZE_BANDS = [0.0396, 0.0534, 0.0672] as const;
export const CONFETTI_SIZE_JITTER = 0.012;
export const CONFETTI_SETTLED_WIDTH = 1.25;
export function confettiCount(portrait:boolean){return portrait?100:160;}
export function confettiDiameter(height:number,portrait:boolean,index:number,random:number){
 return height*.9*(portrait?.95:1.2)*(CONFETTI_SIZE_BANDS[index%3]+random*CONFETTI_SIZE_JITTER);
}
export function confettiSizeRange(height:number,portrait:boolean){return [confettiDiameter(height,portrait,0,0),confettiDiameter(height,portrait,2,1)];}
