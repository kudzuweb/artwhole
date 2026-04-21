import { useEffect, useRef } from "react";

// === CONSTANTS ===
const CELL = 10;
const GRAVITY = 0.4;
const BOUNCE = 0.2;
const FRICTION = 0.985;
const MAX_PARTICLES = 800;
const MINE_INTERVAL = 350;
const MINE_COUNT = 12;
const PLOW_RADIUS = 55;
const SCOOP_RADIUS = 35;
const BUCKET_CAPACITY = 30;
const GROUND_H = 0.15;
const CLIFF_W = 0.18;
const KITTY_SCALE = 1.6;

// === CASTLE LEVELS ===
const LEVELS = [
  { // Level 1 - single bucket tower
    name: "bucket tower",
    shape: [
      "1010101",
      "1111111",
      "0111110",
      "0111110",
      "0111110",
      "0111110",
    ],
  },
  { // Level 2 - two turrets + wall + gate
    name: "twin turret",
    shape: [
      "10101010000000101010100",
      "11111110000000111111100",
      "00111100000000011110000",
      "00111100000000011110000",
      "00111100000000011110000",
      "00111111111111111110000",
      "01111111111111111111000",
      "01111111111111111111000",
      "01111111110111111111000",
      "01111111110111111111000",
    ],
  },
  { // Level 3 - three turrets
    name: "triple keep",
    shape: [
      "1010101000010101010000101010100",
      "1111111000011111110000111111100",
      "0011110000001111000000011110000",
      "0011110000001111000000011110000",
      "0011111111111111111111111110000",
      "0111111111111111111111111111000",
      "0111111111111111111111111111000",
      "0111111111111111111111111111000",
      "0111111111111101111111111111000",
      "0111111111111101111111111111000",
    ],
  },
  { // Level 4 - wide fortress, four towers
    name: "fortress",
    shape: [
      "101010100000000000000001010101",
      "111111100000000000000001111111",
      "001111000000000000000000111100",
      "001111000000000000000000111100",
      "001111111111111111111111111100",
      "101010101010101010101010101010",
      "011111111111111111111111111110",
      "011111111111111111111111111110",
      "011111111111111111111111111110",
      "011111111111100011111111111110",
      "011111111111100011111111111110",
      "011111111111111111111111111110",
    ],
  },
  { // Level 5 - grand castle
    name: "grand castle",
    shape: [
      "10101010001010101000101010100010101010001010101",
      "11111110001111111000111111100011111110001111111",
      "00111100000111100000011110000001111000000111100",
      "00111100000111100000011110000001111000000111100",
      "00111111111111111111111111111111111111111111100",
      "10101010101010101010101010101010101010101010101",
      "01111111111111111111111111111111111111111111110",
      "01111111111111111111111111111111111111111111110",
      "01111111111111111111111111111111111111111111110",
      "01111111111111111111111111111111111111111111110",
      "01111111111111111111101111111111111111111111110",
      "01111111111111111111101111111111111111111111110",
      "01111111111111111111101111111111111111111111110",
      "01111111111111111111111111111111111111111111110",
    ],
  },
];

// === KITTY PALETTE ===
const PALETTE = { 1: "#000000", 2: "#FFFFFF", 3: "#FF6B9D", 4: "#FFD93D", 5: "#e8507a" };

// === KITTY SPRITE ===
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

// === CLIFF TEXTURE (deep magenta pinks) ===
function createCliffTexture(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const colors = ["#8B2252", "#9B3060", "#7A1B48", "#A33A6E", "#8E2858"];
  const edgeColors = ["#6B1540", "#7A1E4D", "#5C1035"];
  const bs = 4;
  for (let y = 0; y < h; y += bs) {
    for (let x = 0; x < w; x += bs) {
      const isEdge = x >= w - bs * 3;
      const palette = isEdge ? edgeColors : colors;
      ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      ctx.fillRect(x, y, bs, bs);
    }
  }
  // Sparkles hinting at kitties inside
  for (let i = 0; i < 15; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#FFB0D0" : "#FFC8E0";
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

// === BUCKET SPRITE ===
function createBucketCanvas() {
  // 0=empty, 1=outline, 2=bucket body, 3=handle, 4=shovel
  const grid = [
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0],
    [0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
  ];
  const colors = { 1: "#000", 2: "#C47A9A", 3: "#666" };
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
    const bucketSprite = createBucketCanvas();
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

    // === LEVEL SYSTEM ===
    let level = 0;
    let castleFilled, totalCells, filledCount, CW, CH;
    let complete = false;
    let celebrationTime = 0;
    let advanceTimer = 0;

    function initLevel(n) {
      level = n;
      const shape = LEVELS[n].shape;
      CW = shape[0].length;
      CH = shape.length;
      totalCells = 0;
      filledCount = 0;
      complete = false;
      castleFilled = shape.map(row =>
        row.split("").map(c => {
          if (c === "1") { totalCells++; return false; }
          return null;
        })
      );
      // Clear particles between levels
      st.particles = [];
      st.bucket.count = 0;
      st.bucket.pouring = false;
      st.bucket.pourRemaining = 0;
      st.bucket.pourAngle = 0;
      st.bucket.scoopDip = 0;
      // Reset cliff
      cliffTex = createCliffTexture(
        Math.floor(canvas.width * CLIFF_W),
        canvas.height
      );
    }

    const st = {
      particles: [],
      mouse: { x: 0, y: 0, down: false, vx: 0, vy: 0 },
      lastMine: 0,
      swingAngle: 0,
      tool: "pick",
      bucket: { count: 0, pouring: false, pourRemaining: 0, pourAngle: 0, scoopDip: 0 },
    };

    initLevel(0);

    // Layout helpers
    const cliffRight = () => Math.floor(canvas.width * CLIFF_W);
    const groundY = () => Math.floor(canvas.height * (1 - GROUND_H));
    const castleX = () => canvas.width - 60 - CW * CELL;
    const castleY = () => groundY() - CH * CELL;

    // Tool toggle button bounds
    const btnW = 44, btnH = 44, btnPad = 14;
    const btnX = () => canvas.width - btnW - btnPad;
    const btnY = () => btnPad;
    const hitBtn = (px, py) => px >= btnX() && px <= btnX() + btnW && py >= btnY() && py <= btnY() + btnH;

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

    const damageCliff = (mx, my) => {
      if (!cliffTex) return;
      const tctx = cliffTex.getContext("2d");
      const bs = 4;
      const radius = 20 + Math.random() * 15;
      const chunks = 8 + Math.floor(Math.random() * 8);
      for (let i = 0; i < chunks; i++) {
        const ox = (Math.random() - 0.5) * radius * 2;
        const oy = (Math.random() - 0.5) * radius * 2;
        if (Math.hypot(ox, oy) > radius) continue;
        const bx = Math.floor((mx + ox) / bs) * bs;
        const by = Math.floor((my + oy) / bs) * bs;
        const bw = bs * (1 + Math.floor(Math.random() * 2));
        const bh = bs * (1 + Math.floor(Math.random() * 2));
        tctx.clearRect(bx, by, bw, bh);
      }
    };

    const mineAt = (y) => {
      const cx = cliffRight();
      // Damage cliff at click point
      const mx = cx - 10 - Math.random() * 20;
      damageCliff(mx, y);
      for (let i = 0; i < MINE_COUNT; i++) {
        const angle = (Math.random() - 0.3) * 1.2;
        const spd = 5 + Math.random() * 10;
        spawn(
          cx + 2 + Math.random() * 8,
          y + (Math.random() - 0.5) * 40,
          Math.cos(angle) * spd,
          Math.sin(angle) * spd - 2
        );
      }
      st.swingAngle = -0.9;
    };

    const scoopAt = (px, py) => {
      if (st.bucket.pouring) return 0;
      // Gather nearby settled candidates
      const candidates = [];
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const pt = st.particles[i];
        if (!pt.settled) continue;
        const dist = Math.hypot(pt.x - px, pt.y - py);
        if (dist < SCOOP_RADIUS) candidates.push({ idx: i, dist, sz: pt.scale });
      }
      candidates.sort((a, b) => a.dist - b.dist);

      // Smaller kitties = more per scoop
      const maxScoop = 2 + Math.floor(Math.random() * 4);
      let scooped = 0;
      let sizeBank = 1.5; // size budget per scoop
      const toRemove = [];
      for (const c of candidates) {
        if (scooped >= maxScoop || st.bucket.count >= BUCKET_CAPACITY) break;
        if (sizeBank <= 0) break;
        toRemove.push(c.idx);
        st.bucket.count++;
        scooped++;
        sizeBank -= c.sz;
      }
      toRemove.sort((a, b) => b - a);
      for (const idx of toRemove) st.particles.splice(idx, 1);
      if (scooped > 0) st.bucket.scoopDip = 1;
      return scooped;
    };

    const startPour = () => {
      if (st.bucket.count <= 0 || st.bucket.pouring) return;
      st.bucket.pouring = true;
      st.bucket.pourRemaining = st.bucket.count;
      st.bucket.count = 0;
      st.bucket.pourAngle = 0;
    };

    const fireworkCelebration = () => {
      const cx = castleX() + (CW * CELL) / 2;
      const cy = castleY();
      for (let i = 0; i < 40; i++) {
        const a = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.2;
        const spd = 6 + Math.random() * 10;
        spawn(cx + (Math.random() - 0.5) * CW * CELL * 0.5, cy,
          Math.cos(a) * spd, Math.sin(a) * spd);
      }
    };

    // === UPDATE ===
    const update = () => {
      const W = canvas.width, H = canvas.height;
      const gy = groundY();
      const cr = cliffRight();
      const cxPos = castleX();
      const cyPos = castleY();

      // Mining (pick tool only)
      if (st.tool === "pick" && st.mouse.down && st.mouse.x < cr && !complete) {
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
          }
        } else {
          p.sf = 0;
        }

        // Absorb into castle cell on contact (with tolerance)
        if (!complete) {
          const margin = CELL * 0.6;
          for (let dr = -1; dr <= 1; dr++) {
            let absorbed = false;
            for (let dc = -1; dc <= 1; dc++) {
              const col = Math.floor((p.x - cxPos + dc * margin) / CELL);
              const row = Math.floor((p.y - cyPos + dr * margin) / CELL);
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
                  absorbed = true;
                  break;
                }
              }
            }
            if (absorbed) break;
          }
        }
      }

      // Bucket pour emission
      if (st.bucket.pouring) {
        st.bucket.pourAngle = Math.min(st.bucket.pourAngle + 0.06, 1.3);
        if (st.bucket.pourAngle > 0.4 && st.bucket.pourRemaining > 0) {
          const emit = Math.min(st.bucket.pourRemaining, 1 + Math.floor(Math.random() * 2));
          for (let i = 0; i < emit; i++) {
            const rimOff = 18;
            const rimX = st.mouse.x + Math.cos(st.bucket.pourAngle - 0.3) * rimOff;
            const rimY = st.mouse.y + Math.sin(st.bucket.pourAngle - 0.3) * rimOff;
            spawn(
              rimX + (Math.random() - 0.5) * 4,
              rimY,
              (Math.random() - 0.3) * 0.8,
              0.5 + Math.random() * 0.8
            );
            st.bucket.pourRemaining--;
          }
        }
        if (st.bucket.pourRemaining <= 0 && st.bucket.pourAngle >= 1.2) {
          st.bucket.pouring = false;
          st.bucket.pourAngle = 0;
        }
      }

      // Scoop dip decay
      if (st.bucket.scoopDip > 0.01) {
        st.bucket.scoopDip *= 0.82;
      } else {
        st.bucket.scoopDip = 0;
      }

      // Celebration fireworks + level advance
      if (complete) {
        const elapsed = Date.now() - celebrationTime;
        if (elapsed < 3000) {
          if (Math.random() < 0.08) fireworkCelebration();
        } else if (advanceTimer === 0) {
          advanceTimer = Date.now();
        } else if (Date.now() - advanceTimer > 1500) {
          // Advance to next level
          if (level < LEVELS.length - 1) {
            initLevel(level + 1);
          }
          advanceTimer = 0;
        }
      }
    };

    // === RENDER ===
    const render = () => {
      const W = canvas.width, H = canvas.height;
      const gy = groundY();
      const cr = cliffRight();
      const cxPos = castleX();
      const cyPos = castleY();

      // Sky - palest pink gradient
      const grad = ctx.createLinearGradient(0, 0, 0, gy);
      grad.addColorStop(0, "#FFF0F5");
      grad.addColorStop(1, "#FFE8EF");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, gy);

      // Ground - medium pink
      ctx.fillStyle = "#D4899E";
      ctx.fillRect(0, gy, W, H - gy);
      // Ground top edge
      ctx.fillStyle = "#C07088";
      ctx.fillRect(cr, gy, W - cr, 3);

      // Cliff - deep rock interior + surface texture
      ctx.fillStyle = "#3D0F20";
      ctx.fillRect(0, 0, cr, H);
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
            ctx.fillStyle = "#F5C6D6";
            ctx.fillRect(x, y, CELL, CELL);
            ctx.fillStyle = "#E0AABB";
            ctx.fillRect(x, y + CELL - 1, CELL, 1);
            ctx.fillRect(x + CELL - 1, y, 1, CELL);
          } else {
            ctx.strokeStyle = "rgba(180,100,130,0.35)";
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
            ctx.setLineDash([]);
          }
        }
      }

      // Castle outline around filled cells
      if (filledCount > 0 || complete) {
        for (let r = 0; r < CH; r++) {
          for (let c = 0; c < CW; c++) {
            if (castleFilled[r][c] !== true) continue;
            const x = cxPos + c * CELL;
            const y = cyPos + r * CELL;
            ctx.fillStyle = "#A0607A";
            if (r === 0 || castleFilled[r-1]?.[c] !== true) ctx.fillRect(x,y,CELL,2);
            if (r === CH-1 || castleFilled[r+1]?.[c] !== true) ctx.fillRect(x,y+CELL-2,CELL,2);
            if (c === 0 || castleFilled[r][c-1] !== true) ctx.fillRect(x,y,2,CELL);
            if (c === CW-1 || castleFilled[r][c+1] !== true) ctx.fillRect(x+CELL-2,y,2,CELL);
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

      // Cursor tool
      if (st.tool === "pick") {
        const pickScale = 2.5;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(st.mouse.x, st.mouse.y);
        ctx.rotate(st.swingAngle - 0.3);
        ctx.drawImage(pickSprite,
          -pickSprite.width * pickScale / 2,
          -pickSprite.height * pickScale * 0.1,
          pickSprite.width * pickScale,
          pickSprite.height * pickScale);
        ctx.restore();
      } else {
        // Bucket cursor
        const bScale = 3;
        const tipAngle = st.bucket.pouring ? st.bucket.pourAngle : 0;
        const dipY = st.bucket.scoopDip * 12;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(st.mouse.x, st.mouse.y + dipY);
        ctx.rotate(tipAngle);
        ctx.drawImage(bucketSprite,
          -bucketSprite.width * bScale / 2,
          -bucketSprite.height * bScale * 0.3,
          bucketSprite.width * bScale,
          bucketSprite.height * bScale);
        // Fill level indicator (only when not pouring)
        if (st.bucket.count > 0 && !st.bucket.pouring) {
          const fillPct = st.bucket.count / BUCKET_CAPACITY;
          const bw = bucketSprite.width * bScale;
          const bh = bucketSprite.height * bScale;
          const fillH = bh * 0.45 * fillPct;
          const fillY = bh * 0.65 - fillH + (-bucketSprite.height * bScale * 0.3);
          ctx.fillStyle = "rgba(255,180,200,0.7)";
          ctx.fillRect(-bw * 0.3, fillY, bw * 0.6, fillH);
        }
        ctx.restore();
        // Progress bar above bucket
        if (st.bucket.count > 0 && !st.bucket.pouring) {
          const barW = 32, barH = 5;
          const bx = st.mouse.x - barW / 2;
          const by = st.mouse.y - 26;
          const fillPct = st.bucket.count / BUCKET_CAPACITY;
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillRect(bx, by, barW, barH);
          ctx.fillStyle = fillPct >= 1 ? "#FF6B9D" : "#C47A9A";
          ctx.fillRect(bx, by, barW * fillPct, barH);
          ctx.strokeStyle = "rgba(0,0,0,0.4)";
          ctx.lineWidth = 1;
          ctx.strokeRect(bx, by, barW, barH);
        }
      }

      // Tool toggle button
      const bx = btnX(), by = btnY();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.roundRect(bx, by, btnW, btnH, 8);
      ctx.fill();
      ctx.strokeStyle = "#C07088";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, btnW, btnH, 8);
      ctx.stroke();
      // Draw icon for the OTHER tool (what you'd switch to)
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (st.tool === "pick") {
        // Show bucket icon (switch to bucket)
        ctx.drawImage(bucketSprite, bx + 6, by + 6, 32, 32);
      } else {
        // Show pick icon (switch to pick)
        ctx.drawImage(pickSprite, bx + 14, by + 4, 16, 36);
      }
      ctx.restore();

      // Progress text
      const lvlName = LEVELS[level].name;
      const lvlLabel = `level ${level + 1}/${LEVELS.length}: ${lvlName}`;
      if (!complete) {
        const pct = Math.floor((filledCount / totalCells) * 100);
        ctx.fillStyle = "rgba(139,34,82,0.45)";
        ctx.font = "13px monospace";
        ctx.textAlign = "center";
        if (filledCount === 0) {
          ctx.fillText(`${lvlLabel} \u00b7 mine the cliff \u00b7 scoop & fill`, canvas.width / 2 + cr / 2, 24);
        } else {
          ctx.fillText(`${lvlLabel} \u00b7 ${pct}%`, cxPos + CW * CELL / 2, cyPos - 10);
        }
      } else {
        ctx.fillStyle = "#8B2252";
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        if (level < LEVELS.length - 1) {
          ctx.fillText(`\u2654 ${lvlName} complete! \u2654`, cxPos + CW * CELL / 2, cyPos - 14);
        } else {
          ctx.fillText("\u2654 all castles complete! \u2654", cxPos + CW * CELL / 2, cyPos - 14);
        }
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

      // Check tool toggle button
      if (hitBtn(p.x, p.y)) {
        st.tool = st.tool === "pick" ? "bucket" : "pick";
        e.preventDefault();
        return;
      }

      if (st.tool === "pick") {
        // Mine if on cliff
        if (p.x < cliffRight() && !complete) {
          mineAt(p.y);
          st.lastMine = Date.now();
        }
      } else {
        // Bucket mode
        if (st.bucket.pouring) {
          // Ignore clicks while pouring
        } else if (st.bucket.count > 0) {
          // Check if near any settled particles to scoop more
          let nearSettled = false;
          for (const pt of st.particles) {
            if (pt.settled && Math.hypot(pt.x - p.x, pt.y - p.y) < SCOOP_RADIUS) {
              nearSettled = true;
              break;
            }
          }
          if (nearSettled && st.bucket.count < BUCKET_CAPACITY) {
            scoopAt(p.x, p.y);
          } else {
            startPour();
          }
        } else {
          scoopAt(p.x, p.y);
        }
      }
      e.preventDefault();
    };

    const onMove = e => {
      const p = pos(e);
      st.mouse.vx = p.x - prevMouse.x;
      st.mouse.vy = p.y - prevMouse.y;
      st.mouse.x = p.x; st.mouse.y = p.y;
      prevMouse = { x: p.x, y: p.y };

      if (st.tool === "pick" && st.mouse.down) {
        // Plow settled particles when dragging
        const speed = Math.hypot(st.mouse.vx, st.mouse.vy);
        if (speed > 0.3) {
          const dirX = st.mouse.vx / speed;
          const dirY = st.mouse.vy / speed;
          for (const pt of st.particles) {
            if (!pt.settled) continue;
            const dx = pt.x - p.x, dy = pt.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist < PLOW_RADIUS && dist > 1) {
              const force = Math.min(speed * 1.4, 20);
              const f = 1 - dist / PLOW_RADIUS;
              const nx = dx / dist, ny = dy / dist;
              pt.vx += (dirX * 0.8 + nx * 0.2) * force * f;
              pt.vy += (dirY * 0.8 + ny * 0.2) * force * f - 1.5;
              pt.settled = false;
              pt.sf = 0;
              pt.av = (Math.random() - 0.5) * 0.15;
            }
          }
        }
      } else if (st.tool === "bucket" && st.mouse.down && st.bucket.count < BUCKET_CAPACITY && !st.bucket.pouring) {
        // Continuous scooping while dragging with bucket
        scoopAt(p.x, p.y);
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
