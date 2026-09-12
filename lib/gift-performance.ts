export class GiftPerformance {
  low=false;protected=false;protections=0;p50=0;p95=0;badSince=-1;goodSince=-1;lastStats=0;
  frames:number[]=[];
  update(dt:number,now:number,fresh:boolean){
    this.frames.push(dt);if(this.frames.length>180)this.frames.shift();
    if(now-this.lastStats<500||this.frames.length<30)return;this.lastStats=now;
    const sorted=[...this.frames].sort((a,b)=>a-b);this.p50=sorted[Math.floor(sorted.length*.5)];this.p95=sorted[Math.floor(sorted.length*.95)];
    const bad=this.p95>33.3||!fresh;
    if(bad){this.goodSince=-1;if(this.badSince<0)this.badSince=now;
      if(now-this.badSince>=3000){if(!this.low){this.low=true;this.badSince=now;}else if(!this.protected){this.protected=true;this.protections++;}}}
    else {this.badSince=-1;if(this.goodSince<0)this.goodSince=now;if(this.protected&&now-this.goodSince>=3000)this.protected=false;}
  }
}
/** Nonblocking GPU timer. CPU timings must never be labelled GPU timings. */
export class GiftGpuTimer {
  private gl:WebGL2RenderingContext;private ext:any;private pending:WebGLQuery[]=[];private current:WebGLQuery|null=null;
  ms:number|null=null;
  constructor(gl:WebGL2RenderingContext){this.gl=gl;this.ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');}
  get available(){return !!this.ext;}
  begin(){const g=this.gl;if(!this.ext)return;
    if(g.getParameter(this.ext.GPU_DISJOINT_EXT)){this.pending.forEach(q=>g.deleteQuery(q));this.pending=[];this.ms=null;return;}
    const q=this.pending[0];if(q&&g.getQueryParameter(q,g.QUERY_RESULT_AVAILABLE)){this.ms=g.getQueryParameter(q,g.QUERY_RESULT)/1e6;g.deleteQuery(q);this.pending.shift();}
    if(this.pending.length>=4)return;this.current=g.createQuery();if(this.current)g.beginQuery(this.ext.TIME_ELAPSED_EXT,this.current);
  }
  end(){if(this.current){this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.pending.push(this.current);this.current=null;}}
  dispose(){this.pending.forEach(q=>this.gl.deleteQuery(q));this.pending=[];}
}
