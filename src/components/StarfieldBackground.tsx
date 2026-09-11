import { useEffect, useRef } from 'react';

type Star = {
  x: number;
  y: number;
  z: number;
  r: number;
  a: number;
  vy: number;
};

/**
 * 深空粒子星空背景（自研 Canvas 2D，零依赖）。
 * - 尊重 prefers-reduced-motion：降级为静态单帧
 * - 移动端按面积降低粒子密度
 */
export function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const c = ctx;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let raf = 0;
    let running = !reduce;
    const stars: Star[] = [];

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * DPR));
      canvas.height = Math.max(1, Math.floor(height * DPR));
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.min(220, Math.max(60, Math.floor((width * height) / 7000)));
      stars.length = 0;
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          z: Math.random() * 0.8 + 0.2,
          r: Math.random() * 1.4 + 0.3,
          a: Math.random() * 0.6 + 0.2,
          vy: Math.random() * 0.12 + 0.02,
        });
      }
    }

    function draw() {
      c.clearRect(0, 0, width, height);
      const now = performance.now() / 1000;
      for (const s of stars) {
        if (running) {
          s.y += s.vy * s.z;
          if (s.y > height + 2) {
            s.y = -2;
            s.x = Math.random() * width;
          }
        }
        const tw = 0.55 + 0.45 * Math.sin(now + s.x * 0.02);
        c.beginPath();
        c.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2);
        c.fillStyle = `rgba(214, 207, 224, ${s.a * tw})`;
        c.fill();
      }
      if (running) raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);
    if (!running) {
      cancelAnimationFrame(raf);
      draw();
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield-bg" aria-hidden="true" />;
}
