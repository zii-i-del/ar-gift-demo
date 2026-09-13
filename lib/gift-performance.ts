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
