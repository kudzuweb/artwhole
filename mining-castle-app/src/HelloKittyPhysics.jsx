import { useEffect, useRef } from "react";

const MAIN_SCALE = 1.8;
const GRAVITY = 0.35;
const BOUNCE = 0.3;
const FRICTION = 0.985;
const SPAWN_INTERVAL = 28;
const PLOW_RADIUS = 70;
const MAX_PARTICLES = 1200;
const BG = "#FFE4EC";

const PALETTE = { 1: "#000000", 2: "#FFFFFF", 3: "#FF6B9D", 4: "#FFD93D", 5: "#e8507a" };

function buildSpriteGrid() {
  const W = 44, H = 32;
  const grid = Array.from({ length: H }, () => Array(W).fill(0));
  const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = v; };
  const fillRect = (x, y, w, h, v) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x+i, y+j, v); };
  const fillCircle = (cx, cy, r, v) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if ((x-cx)**2 + (y-cy)**2 <= r*r) set(x, y, v);
  };
  const fillEllipse = (cx, cy, rx, ry, v) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if ((x-cx)**2/(rx*rx) + (y-cy)**2/(ry*ry) <= 1) set(x, y, v);
  };
  const fillTri = (x0,y0,x1,y1,x2,y2,v) => {
    const mnY = Math.max(0, Math.min(y0,y1,y2));
    const mxY = Math.min(H-1, Math.max(y0,y1,y2));
    for (let y = mnY; y <= mxY; y++) {
      const xs = [];
      [[x0,y0,x1,y1],[x1,y1,x2,y2],[x2,y2,x0,y0]].forEach(([ax,ay,bx,by]) => {
        if ((ay <= y && by >= y) || (by <= y && ay >= y)) {
          if (ay === by) { xs.push(ax, bx); } else xs.push(ax + (y-ay)*(bx-ax)/(by-ay));
        }
      });
      if (xs.length >= 2) {
        const lo = Math.max(0, Math.floor(Math.min(...xs)));
        const hi = Math.min(W-1, Math.ceil(Math.max(...xs)));
        for (let x = lo; x <= hi; x++) set(x, y, v);
      }
    }
  };

  // Left ear (outline then fill)
  fillTri(8, 2, 5, 15, 20, 11, 1);
  fillTri(9, 4, 7, 14, 19, 11, 2);
  // Right ear
  fillTri(30, 2, 18, 11, 33, 15, 1);
  fillTri(30, 4, 19, 11, 32, 14, 2);
  // Head - wider than tall
  fillEllipse(19, 18, 14, 11, 1);
  fillEllipse(19, 18, 13, 10, 2);
  // Bow - sits on top of head near right ear
  fillCircle(28, 9, 4, 1);
  fillCircle(28, 9, 3, 3);
  fillCircle(32, 12, 3, 1);
  fillCircle(32, 12, 2, 3);
  fillCircle(30, 10, 2, 1);
  fillCircle(30, 10, 1, 5);
  // Eyes
  fillRect(13, 16, 2, 3, 1);
  fillRect(23, 16, 2, 3, 1);
  // Nose - solid yellow
  fillRect(18, 21, 3, 2, 4);
  // Whiskers - left, fanning out
  [[4,18],[3,17],[2,17],[1,16]].forEach(([x,y]) => set(x, y, 1));
  [[4,20],[3,20],[2,20],[1,20]].forEach(([x,y]) => set(x, y, 1));
  [[4,22],[3,23],[2,23],[1,24]].forEach(([x,y]) => set(x, y, 1));
  // Whiskers - right, fanning out
  [[34,18],[35,17],[36,17],[37,16]].forEach(([x,y]) => set(x, y, 1));
  [[34,20],[35,20],[36,20],[37,20]].forEach(([x,y]) => set(x, y, 1));
  [[34,22],[35,23],[36,23],[37,24]].forEach(([x,y]) => set(x, y, 1));

  return { grid, W, H };
}

function createSpriteCanvas() {
  const { grid, W, H } = buildSpriteGrid();
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = grid[y][x];
      if (v && PALETTE[v]) { ctx.fillStyle = PALETTE[v]; ctx.fillRect(x, y, 1, 1); }
    }
  return c;
}

export default function HelloKittyPhysics() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const sprite = createSpriteCanvas();
    const sw = sprite.width, sh = sprite.height;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const st = {
      particles: [],
      kitty: { x: window.innerWidth / 2, y: window.innerHeight / 2.5 },
      drag: { active: false, lastSpawn: 0, vx: 0, vy: 0 },
    };

    const drawSprite = (x, y, scale, opacity, angle) => {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.imageSmoothingEnabled = false;
      ctx.translate(x, y);
      if (angle) ctx.rotate(angle);
      const w = sw * scale, h = sh * scale;
      ctx.drawImage(sprite, -w/2, -h/2, w, h);
      ctx.restore();
    };

    const spawn = (x, y, vx, vy) => {
      if (st.particles.length >= MAX_PARTICLES) st.particles.shift();
      st.particles.push({
        x, y, vx: vx||0, vy: vy||0,
        scale: MAIN_SCALE,
        ts: 0.15 + Math.pow(Math.random(), 2.2) * 0.55,
        angle: 0, av: (Math.random()-0.5)*0.08,
        frozen: true, ft: 0, fd: 80 + Math.random()*100,
        settled: false, sf: 0, opacity: 1,
      });
    };

    const fireworks = (x, y) => {
      const n = 25 + Math.floor(Math.random() * 15);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI*0.5 + (Math.random()-0.5)*Math.PI;
        const spd = 7 + Math.random()*9;
        if (st.particles.length >= MAX_PARTICLES) st.particles.shift();
        st.particles.push({
          x: x + (Math.random()-0.5)*8, y,
          vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
          scale: MAIN_SCALE*(0.6+Math.random()*0.4),
          ts: 0.15 + Math.pow(Math.random(), 2.2)*0.55,
          angle: 0, av: (Math.random()-0.5)*0.15,
          frozen: false, ft: 999, fd: 0,
          settled: false, sf: 0, opacity: 1,
        });
      }
    };

    const update = () => {
      const W = canvas.width, H = canvas.height;
      for (const p of st.particles) {
        if (p.frozen) { p.ft += 16; if (p.ft >= p.fd) p.frozen = false; continue; }
        if (p.settled) continue;
        p.vy += GRAVITY;
        p.x += p.vx; p.y += p.vy;
        p.angle += p.av; p.vx *= FRICTION;
        if (p.scale > p.ts) p.scale = Math.max(p.ts, p.scale - 0.04);
        const hh = sh*p.scale*0.4, hw = sw*p.scale*0.4;
        if (p.y + hh > H) { p.y = H - hh; p.vy *= -BOUNCE; p.vx *= 0.85; p.av *= 0.7; }
        if (p.x - hw < 0) { p.x = hw; p.vx = Math.abs(p.vx)*BOUNCE; }
        if (p.x + hw > W) { p.x = W - hw; p.vx = -Math.abs(p.vx)*BOUNCE; }
        if (Math.abs(p.vx) + Math.abs(p.vy) < 0.6 && p.y + hh >= H - 2) {
          p.sf++;
          if (p.sf > 8) { p.settled = true; p.vx = p.vy = p.av = 0; p.scale = p.ts; }
        } else p.sf = 0;
      }
    };

    const render = () => {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const p of st.particles) if (p.settled) drawSprite(p.x, p.y, p.scale, 1, p.angle);
      for (const p of st.particles) if (!p.settled) drawSprite(p.x, p.y, p.scale, p.opacity, p.angle);
      drawSprite(st.kitty.x, st.kitty.y, MAIN_SCALE, 1, 0);
      if (st.particles.length === 0 && !st.drag.active) {
        ctx.fillStyle = "rgba(180,120,140,0.3)";
        ctx.font = "13px monospace";
        ctx.textAlign = "center";
        ctx.fillText("drag me \u00b7 double-click or smack the edges", canvas.width/2, canvas.height - 28);
      }
    };

    let raf;
    const loop = () => { update(); render(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);

    const pos = e => { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; };
    const hitKitty = p => Math.hypot(p.x - st.kitty.x, p.y - st.kitty.y) < Math.max(sw,sh)*MAIN_SCALE*0.45;

    const onDown = e => {
      const p = pos(e);
      if (hitKitty(p)) { st.drag.active = true; st.drag.lastSpawn = Date.now(); st.drag.vx = st.drag.vy = 0; e.preventDefault(); }
    };

    let lastEdgeFirework = 0;

    const onMove = e => {
      if (!st.drag.active) return;
      const p = pos(e);
      st.drag.vx = p.x - st.kitty.x;
      st.drag.vy = p.y - st.kitty.y;
      st.kitty.x = p.x; st.kitty.y = p.y;

      // Edge-smack fireworks
      const W = canvas.width, H = canvas.height;
      const margin = Math.max(sw, sh) * MAIN_SCALE * 0.35;
      const speed = Math.hypot(st.drag.vx, st.drag.vy);
      const now2 = Date.now();
      if (speed > 5 && now2 - lastEdgeFirework > 300) {
        let hitEdge = false;
        if (st.kitty.x - margin < 0 || st.kitty.x + margin > W ||
            st.kitty.y - margin < 0) {
          hitEdge = true;
        }
        if (hitEdge) {
          const fx = Math.max(margin, Math.min(W - margin, st.kitty.x));
          const fy = Math.max(margin, Math.min(H - margin, st.kitty.y));
          fireworks(fx, fy);
          lastEdgeFirework = now2;
        }
      }
      if (now2 - st.drag.lastSpawn > SPAWN_INTERVAL) {
        spawn(p.x + (Math.random()-0.5)*4, p.y + (Math.random()-0.5)*4, (Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5);
        st.drag.lastSpawn = now2;
      }
      if (speed > 0.5) {
        for (const pt of st.particles) {
          if (pt.frozen) continue;
          const dx = pt.x - p.x, dy = pt.y - p.y, dist = Math.hypot(dx, dy);
          if (dist < PLOW_RADIUS && dist > 1) {
            const force = Math.min(speed*0.7, 14), nx = dx/dist, ny = dy/dist, f = 1-dist/PLOW_RADIUS;
            pt.vx += nx*force*f; pt.vy += ny*force*f - 1.5;
            pt.settled = false; pt.sf = 0; pt.av = (Math.random()-0.5)*0.15;
          }
        }
      }
      e.preventDefault();
    };

    const onUp = () => { st.drag.active = false; };
    const onDbl = e => { fireworks(pos(e).x, pos(e).y); e.preventDefault(); };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onUp);
    canvas.addEventListener("dblclick", onDbl);
    canvas.addEventListener("touchstart", onDown, { passive: false });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    canvas.addEventListener("touchend", onUp);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onUp);
      canvas.removeEventListener("dblclick", onDbl);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchmove", onMove);
      canvas.removeEventListener("touchend", onUp);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display:"block", position:"fixed", top:0, left:0, width:"100vw", height:"100vh", cursor:"grab", touchAction:"none", background:BG }} />;
}
