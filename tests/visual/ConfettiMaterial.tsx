import { useEffect, useRef, useState } from 'react';
import { Confetti } from '../../lib/confetti';
export default function ConfettiMaterialPreview() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('加载中');
  useEffect(() => {
    let stopped = false,
      raf = 0;
    let dispose = () => {};
    import('../../lib/confetti-renderer').then(({ ConfettiRenderer }) => {
      if (stopped) return;
      const renderer = new ConfettiRenderer(),
        c = new Confetti();
      c.width = 960;
      c.height = 540;
      host.current?.appendChild(renderer.renderer.domElement);
      for (let i = 0; i < 48; i++) {
        const p = c.particles[i];
        Object.assign(p, {
          state: 1,
          x: 50 + (i % 12) * 78,
          y: 70 + Math.floor(i / 12) * 120,
          w: i < 24 ? 46 : 25,
          h: i < 24 ? 46 : 25,
          angle: ((i % 4) - 0.5) * 0.22,
          flip: 0,
          color: i % 4,
          front: false,
          alpha: 1,
        });
      }
      let frames = 0;
      const tick = (now: number) => {
        for (const p of c.particles)
          if (p.state) p.flip = 0.4 * Math.sin(now * 0.001 + p.id);
        renderer.draw(c);
        if (frames++ === 5)
          setStatus(
            `材质预览 · ${renderer.renderer.info.render.calls} 次绘制 · 上方放大展示，下方实际尺寸参考`,
          );
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      dispose = () => {
        renderer.renderer.domElement.remove();
        renderer.dispose();
      };
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      dispose();
    };
  }, []);
  return (
    <main style={{ padding: 24, maxWidth: 1040, margin: 'auto' }}>
      <h1>彩虹五角星</h1>
      <p>{status}</p>
      <div
        ref={host}
        style={{
          background: 'linear-gradient(110deg,#23232d 50%,#e6e6eb 50%)',
          borderRadius: 20,
          overflow: 'hidden',
        }}
        className="paper-preview"
      />
      <p>只展示材质，不启用摄像头或识别模型。</p>
      <a href="/?scene=confetti">返回互动效果</a>
      <style>
        {
          '.paper-preview canvas{width:100%!important;height:auto!important;display:block}'
        }
      </style>
    </main>
  );
}
