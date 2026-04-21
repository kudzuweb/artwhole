import { useEffect, useRef } from "react";

// === CONSTANTS ===
const CELL = 10;
const GRAVITY = 0.4;
const BOUNCE = 0.2;
const FRICTION = 0.985;
const MAX_PARTICLES = 800;
const MINE_INTERVAL = 60;
const MINE_COUNT = 4;
const PLOW_RADIUS = 60;
const GROUND_H = 0.15;
const CLIFF_W = 0.18;
const KITTY_SCALE = 1.6;

// === CASTLE SHAPE ===
const CASTLE_SHAPE = [
  "01010000001010",
  "01110000001110",
  "01110000001110",
  "01110000001110",
  "01111111111110",
  "11111111111111",
  "11111111111111",
  "11111100111111",
  "11111100111111",
];
const CW = CASTLE_SHAPE[0].length;
const CH = CASTLE_SHAPE.length;

// === KITTY PALETTE ===
const PALETTE = { 1: "#000000", 2: "#FFFFFF", 3: "#FF6B9D", 4: "#FFD93D", 5: "#e8507a" };

// === KITTY SPRITE (reused) ===
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
  fillTri(8, 2, 5, 15, 20, 11, 1);
  fillTri(9, 4, 7, 14, 19, 11, 2);
  fillTri(30, 2, 18, 11, 33, 15, 1);
  fillTri(30, 4, 19, 11, 32, 14, 2);
  fillEllipse(19, 18, 14, 11, 1);
  fillEllipse(19, 18, 13, 10, 2);
  fillCircle(28, 9, 4, 1);
  fillCircle(28, 9, 3, 3);
  fillCircle(32, 12, 3, 1);
  fillCircle(32, 12, 2, 3);
  fillCircle(30, 10, 2, 1);
  fillCircle(30, 10, 1, 5);
  fillRect(13, 16, 2, 3, 1);
  fillRect(23, 16, 2, 3, 1);
  fillRect(18, 21, 3, 2, 4);
  [[4,18],[3,17],[2,17],[1,16]].forEach(([x,y]) => set(x, y, 1));
  [[4,20],[3,20],[2,20],[1,20]].forEach(([x,y]) => set(x, y, 1));
  [[4,22],[3,23],[2,23],[1,24]].forEach(([x,y]) => set(x, y, 1));
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

// === CLIFF TEXTURE ===
function createCliffTexture(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const colors = ["#7A6548", "#8B7355", "#9C8A6E", "#6B5A3E", "#7F7050"];
  const edgeColors = ["#5C4A35", "#4A3C2B", "#695738"];
  const bs = 4;
  for (let y = 0; y < h; y += bs) {
    for (let x = 0; x < w; x += bs) {
      const isEdge = x >= w - bs * 3;
      const palette = isEdge ? edgeColors : colors;
      ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      ctx.fillRect(x, y, bs, bs);
    }
  }
  // Occasional pink sparkles hinting at kitties inside
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#FFD4E8" : "#FFF0F5";
    ctx.fillRect(
      Math.floor(Math.random() * (w - 20) / bs) * bs + 4,
      Math.floor(Math.random() * h / bs) * bs,
      bs, bs
    );
  }
  return c;
}

// === PICK SPRITE ===
function createPickCanvas() {
  const grid = [
    [0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,2,1,0,0],
    [0,0,1,2,2,2,2,1,1,2,2,2,2,2,1,0],
    [0,0,0,1,2,2,2,1,1,2,2,2,2,1,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,1,3,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,3,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,3,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,3,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,3,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,3,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,3,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,3,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  ];
  const colors = { 1: "#000", 2: "#A0A0A0", 3: "#8B6914" };
  const c = document.createElement("canvas");
  c.width = grid[0].length; c.height = grid.length;
  const ctx = c.getContext("2d");
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[0].length; x++) {
      const v = grid[y][x];
      if (v && colors[v]) { ctx.fillStyle = colors[v]; ctx.fillRect(x, y, 1, 1); }
    }
  return c;
}

// === MAIN COMPONENT ===
export default function MiningCastle() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const sprite = createSpriteCanvas();
    const sw = sprite.width, sh = sprite.height;
    const pickSprite = createPickCanvas();
    let cliffTex = null;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cliffTex = createCliffTexture(
        Math.floor(canvas.width * CLIFF_W),
        canvas.height
      );
    }
    resize();
    window.addEventListener("resize", resize);

    // Castle grid state
    let totalCells = 0;
    const castleFilled = CASTLE_SHAPE.map(row =>
      row.split("").map(c => {
        if (c === "1") { totalCells++; return false; }
        return null; // not part of castle
      })
    );
    let filledCount = 0;
    let complete = false;
    let celebrationTime = 0;

    const st = {
      particles: [],
      mouse: { x: 0, y: 0, down: false, vx: 0, vy: 0 },
      mining: false,
      lastMine: 0,
      swingAngle: 0,
    };

    // Layout helpers
    const cliffRight = () => Math.floor(canvas.width * CLIFF_W);
    const groundY = () => Math.floor(canvas.height * (1 - GROUND_H));
    const castleX = () => canvas.width - 60 - CW * CELL;
    const castleY = () => groundY() - CH * CELL;

    const drawSprite = (x, y, scale, opacity, angle) => {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.imageSmoothingEnabled = false;
      ctx.translate(x, y);
      if (angle) ctx.rotate(angle);
      const w = sw * scale, h = sh * scale;
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
      ctx.restore();
    };

    const spawn = (x, y, vx, vy) => {
      if (st.particles.length >= MAX_PARTICLES) st.particles.shift();
      st.particles.push({
        x, y, vx, vy,
        scale: KITTY_SCALE,
        ts: 0.2 + Math.pow(Math.random(), 2) * 0.5,
        angle: 0, av: (Math.random() - 0.5) * 0.1,
        frozen: false, settled: false, sf: 0, opacity: 1,
      });
    };

    const mineAt = (y) => {
      const cx = cliffRight();
      for (let i = 0; i < MINE_COUNT; i++) {
        spawn(
          cx + 5 + Math.random() * 10,
          y + (Math.random() - 0.5) * 30,
          4 + Math.random() * 8,
          -3 + Math.random() * 4
        );
      }
      st.swingAngle = -0.6;
    };

    const fireworkCelebration = () => {
      const cx = castleX() + (CW * CELL) / 2;
      const cy = castleY();
      for (let i = 0; i < 40; i++) {
        const a = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.2;
        const spd = 6 + Math.random() * 10;
        spawn(
          cx + (Math.random() - 0.5) * CW * CELL * 0.5,
          cy,
          Math.cos(a) * spd,
          Math.sin(a) * spd
        );
      }
    };

    // === UPDATE ===
    const update = () => {
      const W = canvas.width, H = canvas.height;
      const gy = groundY();
      const cr = cliffRight();
      const cxPos = castleX();
      const cyPos = castleY();

      // Mining
      if (st.mouse.down && st.mouse.x < cr && !complete) {
        const now = Date.now();
        if (now - st.lastMine > MINE_INTERVAL) {
          mineAt(st.mouse.y);
          st.lastMine = now;
        }
      }

      // Swing decay
      st.swingAngle *= 0.82;
      if (Math.abs(st.swingAngle) < 0.01) st.swingAngle = 0;

      // Particles
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        if (p.settled) continue;

        p.vy += GRAVITY;
        p.x += p.vx; p.y += p.vy;
        p.angle += p.av; p.vx *= FRICTION;

        if (p.scale > p.ts) p.scale = Math.max(p.ts, p.scale - 0.035);

        const hh = sh * p.scale * 0.35;
        const hw = sw * p.scale * 0.35;

        // Ground
        if (p.y + hh > gy) {
          p.y = gy - hh;
          p.vy *= -BOUNCE;
          p.vx *= 0.8;
          p.av *= 0.7;
        }
        // Walls
        if (p.x - hw < cr) { p.x = cr + hw; p.vx = Math.abs(p.vx) * BOUNCE; }
        if (p.x + hw > W) { p.x = W - hw; p.vx = -Math.abs(p.vx) * BOUNCE; }
        // Ceiling
        if (p.y - hh < 0) { p.y = hh; p.vy = Math.abs(p.vy) * BOUNCE; }

        // Settle
        if (Math.abs(p.vx) + Math.abs(p.vy) < 0.5 && p.y + hh >= gy - 2) {
          p.sf++;
          if (p.sf > 8) {
            p.settled = true; p.vx = p.vy = p.av = 0; p.scale = p.ts;

            // Check if in castle cell
            if (!complete) {
              const col = Math.floor((p.x - cxPos) / CELL);
              const row = Math.floor((p.y - cyPos) / CELL);
              if (row >= 0 && row < CH && col >= 0 && col < CW) {
                if (castleFilled[row][col] === false) {
                  castleFilled[row][col] = true;
                  filledCount++;
                  st.particles.splice(i, 1);
                  if (filledCount >= totalCells) {
                    complete = true;
                    celebrationTime = Date.now();
                    fireworkCelebration();
                  }
                }
              }
            }
          }
        } else {
          p.sf = 0;
        }
      }

      // Celebration fireworks
      if (complete && Date.now() - celebrationTime < 3000) {
        if (Math.random() < 0.08) fireworkCelebration();
      }
    };

    // === RENDER ===
    const render = () => {
      const W = canvas.width, H = canvas.height;
      const gy = groundY();
      const cr = cliffRight();
      const cxPos = castleX();
      const cyPos = castleY();

      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, gy);
      grad.addColorStop(0, "#87CEEB");
      grad.addColorStop(1, "#B8E4F9");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, gy);

      // Ground
      ctx.fillStyle = "#F2D398";
      ctx.fillRect(0, gy, W, H - gy);
      // Ground top edge
      ctx.fillStyle = "#E8C374";
      ctx.fillRect(cr, gy, W - cr, 3);

      // Cliff
      if (cliffTex) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cliffTex, 0, 0);
      }

      // Castle mold
      for (let r = 0; r < CH; r++) {
        for (let c = 0; c < CW; c++) {
          if (castleFilled[r][c] === null) continue;
          const x = cxPos + c * CELL;
          const y = cyPos + r * CELL;
          if (castleFilled[r][c]) {
            // Filled cell
            ctx.fillStyle = "#F5DEB3";
            ctx.fillRect(x, y, CELL, CELL);
            ctx.fillStyle = "#E8D09A";
            ctx.fillRect(x, y + CELL - 1, CELL, 1);
            ctx.fillRect(x + CELL - 1, y, 1, CELL);
          } else {
            // Empty mold - dotted outline
            ctx.strokeStyle = "rgba(139,115,85,0.4)";
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
            ctx.setLineDash([]);
          }
        }
      }

      // Castle outline (solid border around filled shape)
      if (filledCount > 0 || complete) {
        ctx.strokeStyle = "#A0885A";
        ctx.lineWidth = 2;
        // Draw outline around filled regions - simplified: just outline the whole shape
        for (let r = 0; r < CH; r++) {
          for (let c = 0; c < CW; c++) {
            if (castleFilled[r][c] !== true) continue;
            const x = cxPos + c * CELL;
            const y = cyPos + r * CELL;
            // Draw edge where neighbor is empty/outside
            if (r === 0 || castleFilled[r-1]?.[c] !== true) { ctx.fillStyle="#A0885A"; ctx.fillRect(x,y,CELL,2); }
            if (r === CH-1 || castleFilled[r+1]?.[c] !== true) { ctx.fillStyle="#A0885A"; ctx.fillRect(x,y+CELL-2,CELL,2); }
            if (c === 0 || castleFilled[r][c-1] !== true) { ctx.fillStyle="#A0885A"; ctx.fillRect(x,y,2,CELL); }
            if (c === CW-1 || castleFilled[r][c+1] !== true) { ctx.fillStyle="#A0885A"; ctx.fillRect(x+CELL-2,y,2,CELL); }
          }
        }
      }

      // Particles
      for (const p of st.particles) {
        if (p.settled) drawSprite(p.x, p.y, p.scale, 0.9, p.angle);
      }
      for (const p of st.particles) {
        if (!p.settled) drawSprite(p.x, p.y, p.scale, p.opacity, p.angle);
      }

      // Pickaxe cursor
      const pickScale = 2.5;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(st.mouse.x, st.mouse.y);
      ctx.rotate(st.swingAngle - 0.3);
      ctx.drawImage(
        pickSprite,
        -pickSprite.width * pickScale / 2,
        -pickSprite.height * pickScale * 0.1,
        pickSprite.width * pickScale,
        pickSprite.height * pickScale
      );
      ctx.restore();

      // Progress text
      if (!complete) {
        const pct = Math.floor((filledCount / totalCells) * 100);
        ctx.fillStyle = "rgba(90,70,40,0.5)";
        ctx.font = "13px monospace";
        ctx.textAlign = "center";
        if (filledCount === 0) {
          ctx.fillText("mine the cliff \u00b7 push sand into the castle", canvas.width / 2 + cr / 2, 24);
        } else {
          ctx.fillText(`castle: ${pct}%`, cxPos + CW * CELL / 2, cyPos - 10);
        }
      } else {
        ctx.fillStyle = "#8B6914";
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.fillText("\u2654 castle complete! \u2654", cxPos + CW * CELL / 2, cyPos - 14);
      }
    };

    // === LOOP ===
    let raf;
    const loop = () => { update(); render(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);

    // === EVENTS ===
    const pos = e => {
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX, y: t.clientY };
    };

    let prevMouse = { x: 0, y: 0 };

    const onDown = e => {
      const p = pos(e);
      st.mouse.down = true;
      st.mouse.x = p.x; st.mouse.y = p.y;
      prevMouse = { x: p.x, y: p.y };
      st.mouse.vx = 0; st.mouse.vy = 0;
      // Immediate mine if on cliff
      if (p.x < cliffRight() && !complete) {
        mineAt(p.y);
        st.lastMine = Date.now();
      }
      e.preventDefault();
    };

    const onMove = e => {
      const p = pos(e);
      st.mouse.vx = p.x - prevMouse.x;
      st.mouse.vy = p.y - prevMouse.y;
      st.mouse.x = p.x; st.mouse.y = p.y;
      prevMouse = { x: p.x, y: p.y };

      // Plow settled particles when dragging (not on cliff)
      if (st.mouse.down && p.x > cliffRight()) {
        const speed = Math.hypot(st.mouse.vx, st.mouse.vy);
        if (speed > 0.5) {
          for (const pt of st.particles) {
            if (!pt.settled && !pt.frozen) continue;
            if (!pt.settled) continue;
            const dx = pt.x - p.x, dy = pt.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist < PLOW_RADIUS && dist > 1) {
              const force = Math.min(speed * 0.7, 12);
              const nx = dx / dist, ny = dy / dist;
              const f = 1 - dist / PLOW_RADIUS;
              pt.vx += nx * force * f;
              pt.vy += ny * force * f - 1;
              pt.settled = false;
              pt.sf = 0;
              pt.av = (Math.random() - 0.5) * 0.12;
            }
          }
        }
      }
      e.preventDefault();
    };

    const onUp = () => { st.mouse.down = false; };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onUp);
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
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchmove", onMove);
      canvas.removeEventListener("touchend", onUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block", position: "fixed", top: 0, left: 0,
        width: "100vw", height: "100vh",
        cursor: "none", touchAction: "none",
      }}
    />
  );
}
