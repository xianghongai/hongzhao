import { useEffect, useRef } from 'react';

import { useTheme } from '@/lib/theme';

// A perspective floor: dots on a grid that recedes to a horizon and flows toward the viewer.
const GRID_SPACING = 0.25; // world units between neighbouring dots, across and in depth
const GRID_HALF_WIDTH = 20; // world units from the centre to the outermost column
const Z_NEAR = 2; // depth of the nearest row, which sits on the bottom edge of the viewport
const Z_FAR = 16; // rows past this depth have faded out
const FLOW_SPEED = 0.08; // world units per second, towards the viewer
const HORIZON_RATIO = 0.32; // the horizon's height as a share of the viewport
const WAVE_HEIGHT = 0.12; // how far the floor undulates, in world units
const COLUMNS = Math.round((GRID_HALF_WIDTH * 2) / GRID_SPACING);

/**
 * Three layers over the page:
 * - two large warm glows that drift slowly, shifted by the pointer and by scrolling (far);
 * - a perspective dot floor on a canvas, flowing toward the viewer with a soft horizon glow (middle);
 * - a grain texture on top, so the gradients never band.
 *
 * Users who prefer reduced motion get a single still frame, with no flow and no pointer parallax.
 */
export function HomeBackground() {
  const theme = useTheme();
  const themeRef = useRef(theme);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const far = farRef.current;
    const near = nearRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !far || !near || !ctx) {
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // The pointer offset is eased, so the layers glide instead of snapping.
    let targetX = 0;
    let targetY = 0;
    let pointerX = 0;
    let pointerY = 0;

    const render = (time: number) => {
      pointerX += (targetX - pointerX) * 0.06;
      pointerY += (targetY - pointerY) * 0.06;
      const scroll = reduced ? 0 : window.scrollY;

      far.style.transform = `translate3d(${pointerX * -18}px, ${pointerY * -12 - scroll * 0.05}px, 0)`;
      near.style.transform = `translate3d(${pointerX * -36}px, ${pointerY * -24 - scroll * 0.12}px, 0)`;

      ctx.clearRect(0, 0, width, height);
      const dark = themeRef.current === 'dark';

      const baseHorizon = height * HORIZON_RATIO;
      const horizon = baseHorizon + pointerY * 10;
      const centreX = width / 2 + pointerX * 24;
      // Chosen so the nearest row lands exactly on the bottom edge when the pointer is still.
      const focal = height - baseHorizon;

      // Soft glow sitting on the horizon, drawn beneath the dots.
      ctx.save();
      ctx.translate(centreX, horizon);
      ctx.scale(1, 0.3);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.6);
      glow.addColorStop(0, dark ? 'rgba(250, 200, 110, 0.22)' : 'rgba(200, 120, 40, 0.14)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, width * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Rows step toward the viewer; the offset wraps seamlessly because each row hands over to the next.
      const offset = reduced ? 0 : (time * FLOW_SPEED) % GRID_SPACING;
      const halfViewport = width / 2 + 8;

      for (let z = Z_NEAR - offset; z <= Z_FAR; z += GRID_SPACING) {
        const fade = Math.min(1, Math.max(0, 1 - (z - Z_NEAR) / (Z_FAR - Z_NEAR)));
        if (fade <= 0) {
          continue;
        }

        const alpha = 0.6 * Math.pow(fade, 1.5);
        ctx.fillStyle = dark ? `rgba(250, 200, 110, ${alpha})` : `rgba(150, 85, 20, ${alpha * 0.8})`;
        const size = 0.35 + 0.45 * fade;

        // Only columns inside the viewport at this depth need drawing.
        const visible = (halfViewport * z) / focal;
        const first = Math.max(0, Math.floor(COLUMNS / 2 - visible / GRID_SPACING));
        const last = Math.min(COLUMNS, Math.ceil(COLUMNS / 2 + visible / GRID_SPACING));

        for (let j = first; j <= last; j++) {
          const x = (j - COLUMNS / 2) * GRID_SPACING;
          const wave = WAVE_HEIGHT * Math.sin(x * 1.5 + time * 1.1) * Math.cos(z * 0.7 - time * 0.6);
          const sx = centreX + (x * focal) / z;
          const sy = horizon + ((Z_NEAR - wave) * focal) / z;
          if (sy < horizon || sy > height + size) {
            continue;
          }
          ctx.fillRect(sx - size, sy - size, size * 2, size * 2);
        }
      }
    };

    resize();
    render(0);

    const handlePointerMove = (e: PointerEvent) => {
      targetX = (e.clientX / width) * 2 - 1;
      targetY = (e.clientY / height) * 2 - 1;
    };
    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };
    const handleResize = () => {
      resize();
      if (reduced) {
        render(0);
      }
    };

    window.addEventListener('resize', handleResize);
    if (!reduced) {
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      document.addEventListener('pointerleave', handlePointerLeave);
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      render((now - start) / 1000);
      frame = requestAnimationFrame(tick);
    };
    if (!reduced) {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div ref={farRef} className="absolute inset-0">
        <div className="absolute -top-[15vmax] -left-[15vmax] size-[75vmax] animate-drift-a rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand)_22%,transparent),transparent_70%)] motion-reduce:animate-none" />
      </div>
      <div ref={nearRef} className="absolute inset-0">
        <div className="absolute -right-[20vmax] -bottom-[20vmax] size-[85vmax] animate-drift-b rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand)_16%,transparent),transparent_70%)] motion-reduce:animate-none" />
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <svg className="absolute inset-0 size-full opacity-[0.06] mix-blend-overlay" aria-hidden="true">
        <filter id="home-grain">
          <feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#home-grain)" />
      </svg>
    </div>
  );
}
