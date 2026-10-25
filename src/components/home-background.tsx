import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import { useTheme } from '@/lib/theme';

const MAX_TRAIL_POINTS = 14;
const ACTIVE_SIGNALS_COUNT = 8;
const PULSE_SAMPLE_POINTS = 24;

interface GridPoint {
  c: number;
  r: number;
}

interface CircuitSignal {
  path: GridPoint[];
  totalLength: number;
  segments: { p0: GridPoint; p1: GridPoint; len: number }[];
  progress: number; // 0.0 to 1.0
  speed: number; // Progress increment per second
  tailLength: number; // In grid units
  delay: number; // Countdown before spawning
}

/**
 * Procedurally generates a random 90-degree orthogonal circuit path.
 * Every point strictly lands on integer grid indices (c, r) for 100% exact alignment with crosshairs.
 * Constraint: Number of 90-degree turns is strictly between 4 and 8 inclusive.
 */
function generateRandomCircuit(maxCols: number, maxRows: number): CircuitSignal {
  const minC = 3;
  const maxC = Math.max(minC + 10, maxCols - 4);
  const minR = 3;
  const maxR = Math.max(minR + 10, maxRows - 4);

  // Random start crosshair node
  let curC = minC + Math.floor(Math.random() * (maxC - minC + 1));
  let curR = minR + Math.floor(Math.random() * (maxR - minR + 1));

  const path: GridPoint[] = [{ c: curC, r: curR }];
  let isHorizontal = Math.random() > 0.5;

  // Number of 90-degree turns strictly between 4 and 8
  const numTurns = 4 + Math.floor(Math.random() * 5); // [4, 5, 6, 7, 8]

  for (let s = 0; s < numTurns; s++) {
    const minStep = 2;
    const maxStep = 5;

    if (isHorizontal) {
      const roomRight = maxC - curC;
      const roomLeft = curC - minC;
      let dir = 1;
      if (roomRight < minStep) {
        dir = -1;
      } else if (roomLeft < minStep) {
        dir = 1;
      } else {
        dir = Math.random() > 0.5 ? 1 : -1;
      }

      const available = dir > 0 ? roomRight : roomLeft;
      const actualMaxStep = Math.max(minStep, Math.min(maxStep, available));
      const step = (minStep + Math.floor(Math.random() * (actualMaxStep - minStep + 1))) * dir;
      curC += step;
    } else {
      const roomTop = maxR - curR;
      const roomBottom = curR - minR;
      let dir = 1;
      if (roomTop < minStep) {
        dir = -1;
      } else if (roomBottom < minStep) {
        dir = 1;
      } else {
        dir = Math.random() > 0.5 ? 1 : -1;
      }

      const available = dir > 0 ? roomTop : roomBottom;
      const actualMaxStep = Math.max(minStep, Math.min(maxStep, available));
      const step = (minStep + Math.floor(Math.random() * (actualMaxStep - minStep + 1))) * dir;
      curR += step;
    }

    path.push({ c: curC, r: curR });
    isHorizontal = !isHorizontal; // 90-degree turn
  }

  // Calculate segment lengths
  const segments: { p0: GridPoint; p1: GridPoint; len: number }[] = [];
  let totalLength = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[i];
    const p1 = path[i + 1];
    if (!p0 || !p1) {
      continue;
    }
    const len = Math.hypot(p1.c - p0.c, p1.r - p0.r);
    segments.push({ p0, p1, len });
    totalLength += len;
  }

  if (totalLength === 0) {
    totalLength = 6;
    segments.push({
      p0: { c: curC, r: curR },
      p1: { c: curC + 6, r: curR },
      len: 6,
    });
  }

  // Steady, calm physical velocity: ~2.4 to 3.0 grid cells per second
  const gridCellsPerSec = 2.4 + Math.random() * 0.6;

  return {
    path,
    totalLength,
    segments,
    progress: 0,
    speed: gridCellsPerSec / totalLength,
    tailLength: 3.6 + Math.random() * 1.0, // Natural trailing comet length
    delay: Math.random() * 2.0,
  };
}

/**
 * Samples a continuous position along the grid circuit at a specific distance
 */
function sampleCircuit(signal: CircuitSignal, dist: number): { c: number; r: number } {
  let accumulated = 0;
  for (const seg of signal.segments) {
    if (dist <= accumulated + seg.len) {
      const t = Math.max(0, Math.min(1, (dist - accumulated) / seg.len));
      return {
        c: seg.p0.c + (seg.p1.c - seg.p0.c) * t,
        r: seg.p0.r + (seg.p1.r - seg.p0.r) * t,
      };
    }
    accumulated += seg.len;
  }
  const last = signal.path[signal.path.length - 1];
  return last ? { c: last.c, r: last.r } : { c: 0, r: 0 };
}

/**
 * "瑞士工程点阵 · 随机电路板慢速折线流光" (Random Procedural PCB Signal Traces & Crosshair Matrix)
 *
 * Concepts:
 * - Direct, 100% geometric alignment: Start, turn, and end nodes strictly overlap with crosshair centers.
 * - Procedural routing with 4 to 8 orthogonal 90° bends per trace.
 * - Constant, slow soothing pace (~2.6 cells/sec) regardless of trace length.
 */
export function HomeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Orthographic Camera with EXACT 1:1 Pixel Mapping
    let width = window.innerWidth;
    let height = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, width, height, 0, -10, 10);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Uniforms for Cursor, Time & Grid
    const trailPositions = new Float32Array(MAX_TRAIL_POINTS * 2);
    const trailTimes = new Float32Array(MAX_TRAIL_POINTS);
    const trailVectors: THREE.Vector2[] = [];
    for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
      trailVectors.push(new THREE.Vector2(-999, -999));
    }
    let trailHead = 0;

    const cellSize = width < 640 ? 22.0 : 28.0;

    const uniforms = {
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(-999, -999) },
      u_isDark: { value: themeRef.current === 'dark' ? 1.0 : 0.0 },
      u_trailPos: { value: trailVectors },
      u_trailTimes: { value: trailTimes },
      u_cellSize: { value: cellSize },
    };

    // 3. Fullscreen Precision Reticle Matrix Shader
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      varying vec2 vUv;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform float u_isDark;
      uniform vec2 u_trailPos[${MAX_TRAIL_POINTS}];
      uniform float u_trailTimes[${MAX_TRAIL_POINTS}];
      uniform float u_cellSize;

      void main() {
        vec2 pixelCoord = vUv * u_resolution;

        // Grid cell index & local coordinate within grid cell [0.0, u_cellSize]
        vec2 cellIndex = floor(pixelCoord / u_cellSize);
        vec2 localPos = fract(pixelCoord / u_cellSize) * u_cellSize;

        // Position of crosshair at the cell center: (cellIndex + 0.5) * cellSize
        vec2 cellCenter = (cellIndex + 0.5) * u_cellSize;

        float distToMouse = length(cellCenter - u_mouse);
        float spotlightRadius = u_cellSize * 4.6;
        float broadGlow = clamp(1.0 - (distToMouse / spotlightRadius), 0.0, 1.0);
        broadGlow = pow(broadGlow, 1.8);
        float centerFocus = smoothstep(u_cellSize * 1.5, 0.0, distToMouse);
        float mouseEnergy = broadGlow * 0.70 + centerFocus * 0.55;

        float trailEnergy = 0.0;
        for (int i = 0; i < ${MAX_TRAIL_POINTS}; i++) {
          float t = u_trailTimes[i];
          if (t <= 0.0) continue;
          float age = u_time - t;
          if (age > 0.85 || age < 0.0) continue;
          float fade = pow(1.0 - (age / 0.85), 2.0);
          float d = length(cellCenter - u_trailPos[i]);
          float g = clamp(1.0 - (d / (u_cellSize * 2.4)), 0.0, 1.0);
          trailEnergy += g * fade * 0.35;
        }

        float cursorBoost = min(mouseEnergy + trailEnergy, 1.5);

        // --- Hairline Crosshairs (+) ---
        vec2 fromCenter = abs(localPos - vec2(u_cellSize * 0.5));
        float armLength = 4.2 + cursorBoost * 1.2;
        float halfLineWidth = 0.75;

        float crossH = (1.0 - smoothstep(0.0, halfLineWidth, fromCenter.y)) *
                       (1.0 - smoothstep(armLength - 0.75, armLength, fromCenter.x));
        float crossV = (1.0 - smoothstep(0.0, halfLineWidth, fromCenter.x)) *
                       (1.0 - smoothstep(armLength - 0.75, armLength, fromCenter.y));
        float crosshair = max(crossH, crossV);

        // Center micro-dot at corners
        vec2 cornerOffset = abs(localPos - vec2(0.0));
        cornerOffset = min(cornerOffset, abs(localPos - vec2(u_cellSize)));
        float cornerDist = length(cornerOffset);
        float centerDot = 1.0 - smoothstep(0.4, 1.2, cornerDist);

        // Cursor range ring
        float ringDist = abs(distToMouse - u_cellSize * 2.2);
        float rangeRing = (1.0 - smoothstep(0.0, 1.2, ringDist)) *
                          (1.0 - smoothstep(u_cellSize * 0.5, u_cellSize * 3.5, distToMouse)) * 0.28;

        float markShape = max(crosshair, centerDot * 0.85);

        if (markShape <= 0.001 && rangeRing <= 0.001) {
          gl_FragColor = vec4(0.0);
          return;
        }

        vec3 darkAmber = vec3(0.96, 0.68, 0.22);
        vec3 lightAmber = vec3(0.74, 0.44, 0.14);
        vec3 brandAmber = mix(lightAmber, darkAmber, u_isDark);

        vec3 darkGlint = vec3(1.0, 0.88, 0.60);
        vec3 lightGlint = vec3(0.88, 0.60, 0.25);
        vec3 glintColor = mix(lightGlint, darkGlint, u_isDark);

        float baseLuminosity = u_isDark > 0.5 ? 0.46 : 0.38;
        float totalAlpha = baseLuminosity + cursorBoost * (u_isDark > 0.5 ? 0.45 : 0.40);

        vec3 finalColor = mix(brandAmber, glintColor, clamp(cursorBoost * 0.8, 0.0, 1.0));
        float finalAlpha = markShape * totalAlpha + rangeRing * (u_isDark > 0.5 ? 0.50 : 0.35);

        gl_FragColor = vec4(finalColor, clamp(finalAlpha, 0.0, 0.95));
      }
    `;

    const gridMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
    });

    const gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), gridMaterial);
    gridMesh.position.set(width * 0.5, height * 0.5, 0);
    scene.add(gridMesh);

    // 4. Dynamic Random Circuit System with 4 to 8 Turns
    let maxGridCols = Math.floor(width / cellSize);
    let maxGridRows = Math.floor(height / cellSize);

    const signals: CircuitSignal[] = [];
    for (let i = 0; i < ACTIVE_SIGNALS_COUNT; i++) {
      signals.push(generateRandomCircuit(maxGridCols, maxGridRows));
    }

    const circuitGroup = new THREE.Group();
    scene.add(circuitGroup);

    const isDarkInitial = themeRef.current === 'dark';

    // Materials for static trace line and via pads
    const traceWireMaterial = new THREE.LineBasicMaterial({
      color: isDarkInitial ? 0xf59e0b : 0xb45309,
      transparent: true,
      opacity: isDarkInitial ? 0.18 : 0.15,
      depthWrite: false,
    });

    const viaPadMaterial = new THREE.PointsMaterial({
      color: isDarkInitial ? 0xf5ba5d : 0x92400e,
      size: 5,
      sizeAttenuation: false,
      transparent: true,
      opacity: isDarkInitial ? 0.5 : 0.4,
      depthWrite: false,
    });

    // Material for the moving amber comet pulse
    const pulseLineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: isDarkInitial ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });

    interface SignalRenderObject {
      wireMesh: THREE.Line;
      wireGeo: THREE.BufferGeometry;
      viaMesh: THREE.Points;
      viaGeo: THREE.BufferGeometry;
      pulseMesh: THREE.Line;
      pulseGeo: THREE.BufferGeometry;
      posArray: Float32Array;
      colArray: Float32Array;
    }

    const renderObjects: SignalRenderObject[] = [];

    // Helper: grid (c, r) strictly maps to crosshair center: (c + 0.5) * cellSize
    const gridToPixel = (c: number, r: number, cs: number) => {
      return new THREE.Vector3((c + 0.5) * cs, (r + 0.5) * cs, 0.05);
    };

    const updateSignalGeometry = (index: number) => {
      const sig = signals[index];
      const robj = renderObjects[index];
      if (!sig || !robj) {
        return;
      }

      const wireVertices: number[] = [];
      const viaPoints: THREE.Vector3[] = [];

      for (let i = 0; i < sig.path.length; i++) {
        const pt = sig.path[i];
        if (!pt) {
          continue;
        }
        const v = gridToPixel(pt.c, pt.r, uniforms.u_cellSize.value);
        wireVertices.push(v.x, v.y, v.z);
        viaPoints.push(v);
      }

      robj.wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wireVertices, 3));
      robj.viaGeo.setFromPoints(viaPoints);
    };

    // Build initial render objects
    for (let i = 0; i < ACTIVE_SIGNALS_COUNT; i++) {
      const wireGeo = new THREE.BufferGeometry();
      const viaGeo = new THREE.BufferGeometry();

      const posArray = new Float32Array((PULSE_SAMPLE_POINTS + 1) * 3);
      const colArray = new Float32Array((PULSE_SAMPLE_POINTS + 1) * 3);
      const pulseGeo = new THREE.BufferGeometry();
      pulseGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3).setUsage(THREE.DynamicDrawUsage));
      pulseGeo.setAttribute('color', new THREE.BufferAttribute(colArray, 3).setUsage(THREE.DynamicDrawUsage));

      const wireMesh = new THREE.Line(wireGeo, traceWireMaterial);
      const viaMesh = new THREE.Points(viaGeo, viaPadMaterial);
      const pulseMesh = new THREE.Line(pulseGeo, pulseLineMaterial);

      circuitGroup.add(wireMesh);
      circuitGroup.add(viaMesh);
      circuitGroup.add(pulseMesh);

      renderObjects.push({
        wireMesh,
        wireGeo,
        viaMesh,
        viaGeo,
        pulseMesh,
        pulseGeo,
        posArray,
        colArray,
      });

      updateSignalGeometry(i);
    }

    // 5. Cursor Tracking
    let currentTime = 0;
    let lastRecordedX = -999;
    let lastRecordedY = -999;

    const handlePointerMove = (e: PointerEvent) => {
      const px = e.clientX;
      const py = height - e.clientY;

      uniforms.u_mouse.value.set(px, py);

      if (Math.hypot(px - lastRecordedX, py - lastRecordedY) > 16) {
        lastRecordedX = px;
        lastRecordedY = py;

        const idx = trailHead;
        trailPositions[idx * 2] = px;
        trailPositions[idx * 2 + 1] = py;
        trailTimes[idx] = currentTime;

        const vec = trailVectors[idx];
        if (vec) {
          vec.set(px, py);
        }

        trailHead = (trailHead + 1) % MAX_TRAIL_POINTS;
      }
    };

    const handlePointerLeave = () => {
      uniforms.u_mouse.value.set(-999, -999);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', handlePointerLeave);

    // 6. Responsive Resize
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      camera.right = width;
      camera.top = height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      gridMesh.geometry.dispose();
      gridMesh.geometry = new THREE.PlaneGeometry(width, height);
      gridMesh.position.set(width * 0.5, height * 0.5, 0);

      const newCellSize = width < 640 ? 22.0 : 28.0;
      uniforms.u_cellSize.value = newCellSize;
      uniforms.u_resolution.value.set(width, height);

      maxGridCols = Math.floor(width / newCellSize);
      maxGridRows = Math.floor(height / newCellSize);

      for (let i = 0; i < ACTIVE_SIGNALS_COUNT; i++) {
        signals[i] = generateRandomCircuit(maxGridCols, maxGridRows);
        updateSignalGeometry(i);
      }
    };
    window.addEventListener('resize', handleResize);

    // 7. Animation Loop with Organic Random Spawning
    let animationFrameId: number;
    let isVisible = true;

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) {
        return;
      }

      const delta = 0.016;
      currentTime += delta;
      uniforms.u_time.value = currentTime;

      const currentDark = themeRef.current === 'dark';
      uniforms.u_isDark.value = currentDark ? 1.0 : 0.0;

      // Sync materials with current theme
      if (currentDark) {
        traceWireMaterial.color.setHex(0xf59e0b);
        traceWireMaterial.opacity = 0.18;
        viaPadMaterial.color.setHex(0xf5ba5d);
        viaPadMaterial.opacity = 0.5;
        pulseLineMaterial.blending = THREE.AdditiveBlending;
      } else {
        traceWireMaterial.color.setHex(0xb45309);
        traceWireMaterial.opacity = 0.15;
        viaPadMaterial.color.setHex(0x92400e);
        viaPadMaterial.opacity = 0.38;
        pulseLineMaterial.blending = THREE.NormalBlending;
      }

      const cs = uniforms.u_cellSize.value;
      const speedScale = prefersReducedMotion ? 0.15 : 1.0;

      // Update and animate each random signal pulse
      for (let i = 0; i < ACTIVE_SIGNALS_COUNT; i++) {
        const sig = signals[i];
        const robj = renderObjects[i];
        if (!sig || !robj) {
          continue;
        }

        // Delay timer before spawning
        if (sig.delay > 0) {
          sig.delay -= delta;
          robj.pulseMesh.visible = false;
          robj.wireMesh.visible = false;
          robj.viaMesh.visible = false;
          continue;
        }

        robj.pulseMesh.visible = true;
        robj.wireMesh.visible = true;
        robj.viaMesh.visible = true;

        // Progress along circuit path
        sig.progress += sig.speed * delta * speedScale;

        // If completed: retire and spawn a completely new random circuit!
        if (sig.progress >= 1.0) {
          signals[i] = generateRandomCircuit(maxGridCols, maxGridRows);
          updateSignalGeometry(i);
          continue;
        }

        const totalDist = sig.progress * sig.totalLength;

        // Update pulse comet vertices
        for (let s = 0; s <= PULSE_SAMPLE_POINTS; s++) {
          const frac = s / PULSE_SAMPLE_POINTS; // 0 = head, 1 = tail
          const sampleDist = Math.max(0, totalDist - frac * sig.tailLength);

          const pt = sampleCircuit(sig, sampleDist);
          const v = gridToPixel(pt.c, pt.r, cs);

          const idx = s * 3;
          robj.posArray[idx] = v.x;
          robj.posArray[idx + 1] = v.y;
          robj.posArray[idx + 2] = v.z + 0.05;

          // Non-linear comet fade
          const intensity = Math.pow(1.0 - frac, 2.0);

          // Fade in at start, fade out at end of track
          const trackEnvelope = Math.sin(sig.progress * Math.PI);
          const finalIntensity = intensity * trackEnvelope;

          if (currentDark) {
            robj.colArray[idx] = 1.0 * finalIntensity; // Warm white-gold head
            robj.colArray[idx + 1] = 0.8 * finalIntensity;
            robj.colArray[idx + 2] = 0.3 * finalIntensity;
          } else {
            robj.colArray[idx] = 0.82 * finalIntensity;
            robj.colArray[idx + 1] = 0.48 * finalIntensity;
            robj.colArray[idx + 2] = 0.15 * finalIntensity;
          }
        }

        const posAttr = robj.pulseGeo.attributes.position;
        const colAttr = robj.pulseGeo.attributes.color;
        if (posAttr) {
          posAttr.needsUpdate = true;
        }
        if (colAttr) {
          colAttr.needsUpdate = true;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 8. Resource Teardown on Route Change
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      gridMesh.geometry.dispose();
      gridMaterial.dispose();

      renderObjects.forEach((robj) => {
        robj.wireGeo.dispose();
        robj.viaGeo.dispose();
        robj.pulseGeo.dispose();
      });

      traceWireMaterial.dispose();
      viaPadMaterial.dispose();
      pulseLineMaterial.dispose();

      renderer.dispose();
      renderer.forceContextLoss();

      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Soft radial vignette so grid fades comfortably towards page edges */}
      <div className="absolute inset-0 bg-radial-[circle_at_50%_35%] from-transparent via-transparent to-background/60" />
    </div>
  );
}
