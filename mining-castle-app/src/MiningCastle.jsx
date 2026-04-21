import { useEffect, useRef } from "react";

// Persists across game switches, resets on full page refresh
let savedLevel = 0;

// === CONSTANTS ===
const CELL = 24;
const GRAVITY = 0.4;
const BOUNCE = 0.2;
const FRICTION = 0.985;
const MAX_PARTICLES = 800;
const MINE_INTERVAL = 350;
const MINE_COUNT = 6;
const PLOW_RADIUS = 75;
const SCOOP_RADIUS = 110;
const BUCKET_CAPACITY = 30;
const GROUND_H = 0.15;
const CLIFF_W = 0.18;
const KITTY_SCALE = 3.0;
const SHRINK_DELAY = 180; // ms before shrinking starts

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
      "01111111100111111111000",
      "01111111100111111111000",
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
      "0111111111111001111111111111000",
      "0111111111111001111111111111000",
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
      "01111111111111111111001111111111111111111111110",
      "01111111111111111111001111111111111111111111110",
      "01111111111111111111001111111111111111111111110",
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
  const colors = { 1: "#000", 2: "#D4809A", 3: "#8B6914" };
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

// === SHOVEL SPRITE (blade at bottom, flat top edge, rounded bottom) ===
function createShovelCanvas() {
  const grid = [
    [0,0,0,0,0,1,0,0,0,0,0],
    [0,0,0,0,1,3,1,0,0,0,0],
    [0,0,0,0,1,3,1,0,0,0,0],
    [0,0,0,0,1,3,1,0,0,0,0],
    [0,0,0,0,1,3,1,0,0,0,0],
    [0,0,0,0,1,3,1,0,0,0,0],
    [0,0,0,0,1,3,1,0,0,0,0],
    [0,0,0,0,1,3,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,1,1,1,1,2,1,1,1,1,0],
    [0,1,2,2,2,2,2,2,2,1,0],
    [0,1,2,2,2,2,2,2,2,1,0],
    [0,1,2,2,2,2,2,2,2,1,0],
    [0,1,2,2,2,2,2,2,2,1,0],
    [0,1,2,2,2,2,2,2,2,1,0],
    [0,0,1,2,2,2,2,2,1,0,0],
    [0,0,0,1,2,2,2,1,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
  ];
  const colors = { 1: "#000", 2: "#D4809A", 3: "#8B6914" };
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
export default function MiningCastle() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const sprite = createSpriteCanvas();
    const sw = sprite.width, sh = sprite.height;
    const pickSprite = createPickCanvas();
    const bucketSprite = createBucketCanvas();
    const shovelSprite = createShovelCanvas();
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
      savedLevel = n;
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
      st.tool = "pick";
      st.particles = [];
      st.bucket.count = 0;
      st.bucket.shovelCount = 0;
      st.bucket.phase = "placing";
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
      bucket: {
        phase: "placing", // "placing" | "shoveling" | "carrying" | "pouring"
        pos: { x: 0, y: 0 }, // placed bucket position
        count: 0, // kitties in bucket
        shovelCount: 0, // kitties on shovel
        shovelMax: 8,
        pourRemaining: 0,
        pourAngle: 0,
        scoopDip: 0,
      },
    };

    initLevel(savedLevel);

    // Layout helpers
    const cliffRight = () => Math.floor(canvas.width * CLIFF_W);
    const groundY = () => Math.floor(canvas.height * (1 - GROUND_H));
    const castleX = () => {
      const rightAligned = canvas.width - 60 - CW * CELL;
      const maxX = cliffRight() + (canvas.width - cliffRight()) * 0.5;
      return Math.min(rightAligned, maxX);
    };
    const castleY = () => groundY() - CH * CELL;

    // Tool toggle button bounds
    const btnH = 56, btnPad = 14;
    const btnW = () => st.tool === "pick" ? 78 : 58;
    const btnX = () => canvas.width - btnW() - 100;
    const btnY = () => btnPad;
    const hitBtn = (px, py) => px >= btnX() && px <= btnX() + btnW() && py >= btnY() && py <= btnY() + btnH;
    const hitBucket = (px, py) => {
      if (st.bucket.phase !== "shoveling") return false;
      return Math.hypot(px - st.bucket.pos.x, py - st.bucket.pos.y) < 80;
    };

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

    const spawn = (x, y, vx, vy, opts) => {
      if (st.particles.length >= MAX_PARTICLES) st.particles.shift();
      st.particles.push({
        x, y, vx, vy,
        scale: (opts && opts.scale) || KITTY_SCALE,
        ts: (opts && opts.ts) || (0.5 + Math.random() * 1.5),
        born: (opts && opts.noDelay) ? -9999 : performance.now(),
        noStack: (opts && opts.noStack) || false,
        gMul: (opts && opts.gMul) || 1,
        angle: 0, av: (Math.random() - 0.5) * 0.1,
        frozen: false, settled: false, sf: 0, opacity: 1,
      });
    };

    const damageCliff = (mx, my) => {
      if (!cliffTex) return;
      const tctx = cliffTex.getContext("2d");
      const bs = 4;
      const radius = 45 + Math.random() * 35;
      const chunks = 25 + Math.floor(Math.random() * 20);
      for (let i = 0; i < chunks; i++) {
        const ox = (Math.random() - 0.5) * radius * 2;
        const oy = (Math.random() - 0.5) * radius * 2;
        if (Math.hypot(ox, oy) > radius) continue;
        const bx = Math.floor((mx + ox) / bs) * bs;
        const by = Math.floor((my + oy) / bs) * bs;
        const bw = bs * (1 + Math.floor(Math.random() * 3));
        const bh = bs * (1 + Math.floor(Math.random() * 3));
        tctx.clearRect(bx, by, bw, bh);
      }
    };

    const mineAt = (y) => {
      const cx = cliffRight();
      // Damage cliff at click point
      const mx = cx - 10 - Math.random() * 20;
      damageCliff(mx, y);
      // Max vx: let them fly across most of the field
      const maxVx = 55;
      for (let i = 0; i < MINE_COUNT; i++) {
        const angle = (Math.random() - 0.4) * 2.2;
        const spd = 6 + Math.random() * 14 + Math.pow(Math.random(), 2) * 10;
        let vx = Math.cos(angle) * spd + Math.random() * 6;
        vx = Math.min(vx, maxVx); // clamp so they don't reach the castle
        spawn(
          cx + 2 + Math.random() * 8,
          y + (Math.random() - 0.5) * 50,
          vx,
          Math.sin(angle) * spd - 1 - Math.random() * 4
        );
      }
      st.swingAngle = -0.9;
    };

    const shovelScoop = (px, py) => {
      if (st.bucket.phase !== "shoveling") return 0;
      if (st.bucket.shovelCount >= st.bucket.shovelMax) return 0;
      const candidates = [];
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const pt = st.particles[i];
        if (!pt.settled) continue;
        const dist = Math.hypot(pt.x - px, pt.y - py);
        if (dist < SCOOP_RADIUS) candidates.push({ idx: i, dist, sz: pt.scale });
      }
      candidates.sort((a, b) => a.dist - b.dist);
      let scooped = 0;
      const toRemove = [];
      for (const c of candidates) {
        if (st.bucket.shovelCount >= st.bucket.shovelMax) break;
        toRemove.push(c.idx);
        st.bucket.shovelCount++;
        scooped++;
      }
      toRemove.sort((a, b) => b - a);
      for (const idx of toRemove) st.particles.splice(idx, 1);
      if (scooped > 0) st.bucket.scoopDip = 1;
      return scooped;
    };

    const depositInBucket = () => {
      if (st.bucket.shovelCount <= 0) return;
      st.bucket.count += st.bucket.shovelCount;
      st.bucket.count = Math.min(st.bucket.count, BUCKET_CAPACITY);
      st.bucket.shovelCount = 0;
    };

    const pickUpBucket = () => {
      if (st.bucket.count <= 0) return;
      st.bucket.phase = "carrying";
    };

    const startPour = () => {
      if (st.bucket.count <= 0 || st.bucket.phase !== "carrying") return;
      st.bucket.phase = "pouring";
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
          Math.cos(a) * spd, Math.sin(a) * spd,
          { scale: 1.6, ts: 0.2 + Math.pow(Math.random(), 2) * 0.5, noDelay: true, noStack: true });
      }
    };

    // === UPDATE ===
    const update = () => {
      const W = canvas.width, H = canvas.height;
      const gy = groundY();
      const cr = cliffRight();
      const cxPos = castleX();
      const cyPos = castleY();

      // Swing decay
      st.swingAngle *= 0.82;
      if (Math.abs(st.swingAngle) < 0.01) st.swingAngle = 0;

      // Particles
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        if (p.settled) continue;

        p.vy += GRAVITY * p.gMul;
        p.x += p.vx; p.y += p.vy;
        p.angle += p.av; p.vx *= FRICTION;

        if (p.scale > p.ts && performance.now() - p.born > SHRINK_DELAY)
          p.scale = Math.max(p.ts, p.scale - 0.035);

        const hh = sh * p.scale * 0.35;
        const hw = sw * p.scale * 0.35;

        // Ground
        if (p.y + hh > gy) {
          p.y = gy - hh;
          p.vy *= -BOUNCE;
          p.vx *= 0.8;
          p.av *= 0.7;
        }
        // Deflect off settled particles (creates natural piling)
        if (!p.noStack) {
          for (let j = 0; j < st.particles.length; j++) {
            if (j === i) continue;
            const q = st.particles[j];
            if (!q.settled) continue;
            const qhh = sh * q.scale * 0.35;
            const qhw = sw * q.scale * 0.35;
            const dx = p.x - q.x, dy = p.y - q.y;
            const overlapX = (hw + qhw) - Math.abs(dx);
            const overlapY = (hh + qhh) - Math.abs(dy);
            if (overlapX > 0 && overlapY > 0) {
              if (overlapX < overlapY) {
                // Horizontal deflection - gentle nudge
                const dir = dx > 0 ? 1 : -1;
                p.x += dir * overlapX;
                p.vx = dir * Math.max(0.5, Math.abs(p.vx) * 0.2);
                p.vy *= 0.8;
              } else if (dy < 0) {
                // Landing on top
                p.y = q.y - qhh - hh;
                p.vy *= -BOUNCE * 0.2;
                p.vx *= 0.6;
                p.vx += (Math.random() - 0.5) * 1.5;
              }
            }
          }
        }
        // Walls
        if (p.x - hw < cr) { p.x = cr + hw; p.vx = Math.abs(p.vx) * BOUNCE; }
        if (p.x + hw > W) { p.x = W - hw; p.vx = -Math.abs(p.vx) * BOUNCE; }
        // Ceiling
        if (p.y - hh < 0) { p.y = hh; p.vy = Math.abs(p.vy) * BOUNCE; }

        // Settle (on ground or on other particles)
        const nearGround = p.y + hh >= gy - 2;
        let onStack = false;
        if (!nearGround && !p.noStack) {
          for (let j = 0; j < st.particles.length; j++) {
            if (j === i) continue;
            const q = st.particles[j];
            if (!q.settled) continue;
            const qhh = sh * q.scale * 0.35;
            const qhw = sw * q.scale * 0.35;
            if (Math.abs(p.x - q.x) < (hw + qhw) && Math.abs(p.y - (q.y - qhh - hh)) < 4) {
              onStack = true; break;
            }
          }
        }
        if (Math.abs(p.vx) + Math.abs(p.vy) < 1.2 && (nearGround || onStack)) {
          p.sf++;
          if (p.sf > 8) {
            p.settled = true; p.vx = p.vy = p.av = 0; p.scale = p.ts;
          }
        } else {
          p.sf = 0;
        }

        // Absorb into castle cell on contact (with tolerance + overflow)
        if (!complete) {
          const margin = CELL * 0.6;
          let absorbed = false;
          // First try: nearby cells
          for (let dr = -1; dr <= 1 && !absorbed; dr++) {
            for (let dc = -1; dc <= 1 && !absorbed; dc++) {
              const col = Math.floor((p.x - cxPos + dc * margin) / CELL);
              const row = Math.floor((p.y - cyPos + dr * margin) / CELL);
              if (row >= 0 && row < CH && col >= 0 && col < CW) {
                if (castleFilled[row][col] === false) {
                  castleFilled[row][col] = true;
                  filledCount++;
                  st.particles.splice(i, 1);
                  absorbed = true;
                }
              }
            }
          }
          // Overflow: if we're in/near the castle area but all nearby cells full, find nearest unfilled
          if (!absorbed) {
            const col0 = Math.floor((p.x - cxPos) / CELL);
            const row0 = Math.floor((p.y - cyPos) / CELL);
            if (col0 >= -2 && col0 <= CW + 1 && row0 >= -2 && row0 <= CH + 1) {
              let bestDist = Infinity, bestR = -1, bestC = -1;
              for (let r = 0; r < CH; r++) {
                for (let c = 0; c < CW; c++) {
                  if (castleFilled[r][c] !== false) continue;
                  const d = Math.abs(r - row0) + Math.abs(c - col0);
                  if (d < bestDist) { bestDist = d; bestR = r; bestC = c; }
                }
              }
              if (bestR >= 0 && bestDist < 8) {
                castleFilled[bestR][bestC] = true;
                filledCount++;
                st.particles.splice(i, 1);
                absorbed = true;
              }
            }
          }
          if (absorbed && filledCount >= totalCells) {
            complete = true;
            celebrationTime = Date.now();
            fireworkCelebration();
          }
        }
      }

      // Support check: unsettle particles that lost support
      for (const p of st.particles) {
        if (!p.settled || p.noStack) continue;
        const hh = sh * p.scale * 0.35;
        const hw = sw * p.scale * 0.35;
        const nearGround = p.y + hh >= gy - 3;
        if (nearGround) continue;
        // Check if any settled particle supports from below
        let supported = false;
        for (const q of st.particles) {
          if (q === p || !q.settled) continue;
          const qhh = sh * q.scale * 0.35;
          const qhw = sw * q.scale * 0.35;
          if (Math.abs(p.x - q.x) < (hw + qhw) && q.y > p.y && q.y - p.y < (hh + qhh + 5)) {
            supported = true; break;
          }
        }
        if (!supported) {
          p.settled = false;
          p.sf = 0;
          // Tumble sideways with some randomness instead of falling straight
          p.vx = (Math.random() - 0.5) * 4;
          p.vy = 0.5; // start falling
          p.av = (Math.random() - 0.5) * 0.2;
        }
      }

      // Bucket pour emission
      if (st.bucket.phase === "pouring") {
        st.bucket.pourAngle = Math.min(st.bucket.pourAngle + 0.06, 1.3);
        if (st.bucket.pourAngle > 0.4 && st.bucket.pourRemaining > 0) {
          // Try multiple emissions per frame - smaller ones more likely
          const attempts = 3;
          for (let a = 0; a < attempts && st.bucket.pourRemaining > 0; a++) {
            const pourScale = 0.6 + Math.random() * 2.0;
            // Smaller = higher chance of emitting this frame
            const emitChance = 0.15 + (1 - pourScale / 2.6) * 0.35;
            if (Math.random() > emitChance) continue;
            const rimOff = 18;
            const rimX = st.mouse.x + Math.cos(st.bucket.pourAngle - 0.3) * rimOff;
            const rimY = st.mouse.y + Math.sin(st.bucket.pourAngle - 0.3) * rimOff;
            spawn(
              rimX + (Math.random() - 0.5) * 14,
              rimY + (Math.random() - 0.5) * 8,
              (Math.random() - 0.5) * 3,
              0.2 + Math.random() * 0.6,
              { scale: pourScale, ts: pourScale, noDelay: true, noStack: true,
                gMul: 0.5 + (1 - pourScale / 2.6) * 1.2 }
            );
            st.bucket.pourRemaining--;
          }
        }
        if (st.bucket.pourRemaining <= 0 && st.bucket.pourAngle >= 1.2) {
          st.bucket.phase = "shoveling";
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

      // Tool toggle button
      const bx = btnX(), by = btnY(), bw2 = btnW();
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.beginPath();
      ctx.roundRect(bx, by, bw2, btnH, 8);
      ctx.fill();
      ctx.strokeStyle = "#C07088";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw2, btnH, 8);
      ctx.stroke();
      // Draw icon for the OTHER tool (what you'd switch to)
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (st.tool === "pick") {
        // Show shovel + bucket icon in wider button
        const ss = 2.5;
        ctx.save();
        ctx.translate(bx + 18, by + 30);
        ctx.rotate(-0.4);
        ctx.drawImage(shovelSprite, -shovelSprite.width*ss/2, -shovelSprite.height*ss*0.55, shovelSprite.width*ss, shovelSprite.height*ss);
        ctx.restore();
        const bs = 2.8;
        ctx.drawImage(bucketSprite, bx + 36, by + 20, bucketSprite.width*bs, bucketSprite.height*bs);
      } else {
        // Show pick icon (switch to pick)
        const ps = 3.0;
        ctx.save();
        ctx.translate(bx + 29, by + 28);
        ctx.rotate(-0.3);
        ctx.drawImage(pickSprite, -pickSprite.width*ps/2, -pickSprite.height*ps*0.4, pickSprite.width*ps, pickSprite.height*ps);
        ctx.restore();
      }
      ctx.restore();

      // Cursor tool
      if (st.tool === "pick") {
        const pickScale = 4.5;
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
        const bCursorScale = 4;
        const bPlacedScale = 10;

        // Draw placed bucket on ground (shoveling or pouring phase)
        if (st.bucket.phase === "shoveling" || st.bucket.phase === "pouring") {
          const bw = bucketSprite.width * bPlacedScale;
          const bh = bucketSprite.height * bPlacedScale;
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.translate(st.bucket.pos.x, st.bucket.pos.y);
          ctx.drawImage(bucketSprite, -bw/2, -bh, bw, bh);
          // Progress bar above placed bucket
          if (st.bucket.count > 0) {
            const barW = 36, barH = 5;
            const fillPct = st.bucket.count / BUCKET_CAPACITY;
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.fillRect(-barW/2, -bh - 12, barW, barH);
            ctx.fillStyle = fillPct >= 1 ? "#FF6B9D" : "#C47A9A";
            ctx.fillRect(-barW/2, -bh - 12, barW * fillPct, barH);
            ctx.strokeStyle = "rgba(0,0,0,0.4)";
            ctx.lineWidth = 1;
            ctx.strokeRect(-barW/2, -bh - 12, barW, barH);
          }
          ctx.restore();
        }

        // Cursor
        const bcw = bucketSprite.width * bCursorScale;
        const bch = bucketSprite.height * bCursorScale;
        if (st.bucket.phase === "placing") {
          // Show bucket at cursor for placement
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = 0.6;
          ctx.translate(st.mouse.x, st.mouse.y);
          ctx.drawImage(bucketSprite, -bcw/2, -bch*0.6, bcw, bch);
          ctx.restore();
        } else if (st.bucket.phase === "shoveling") {
          // Shovel cursor (angled with blade toward ground)
          const sScale = 6;
          const dipY = st.bucket.scoopDip * 14;
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.translate(st.mouse.x, st.mouse.y + dipY);
          ctx.rotate(-0.7); // ~-40 degrees
          ctx.drawImage(shovelSprite,
            -shovelSprite.width * sScale * 0.5,
            -shovelSprite.height * sScale * 0.72,
            shovelSprite.width * sScale,
            shovelSprite.height * sScale);
          ctx.restore();
          // Show shovel load count
          if (st.bucket.shovelCount > 0) {
            const barW = 36, barH = 5;
            const fillPct = st.bucket.shovelCount / st.bucket.shovelMax;
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.fillRect(st.mouse.x - barW/2, st.mouse.y - 70, barW, barH);
            ctx.fillStyle = fillPct >= 1 ? "#FF6B9D" : "#C47A9A";
            ctx.fillRect(st.mouse.x - barW/2, st.mouse.y - 70, barW * fillPct, barH);
            ctx.strokeStyle = "rgba(0,0,0,0.4)";
            ctx.lineWidth = 1;
            ctx.strokeRect(st.mouse.x - barW/2, st.mouse.y - 70, barW, barH);
          }
        } else if (st.bucket.phase === "carrying") {
          // Bucket cursor (full, ready to pour)
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.translate(st.mouse.x, st.mouse.y);
          ctx.drawImage(bucketSprite, -bcw/2, -bch*0.6, bcw, bch);
          ctx.restore();
        } else if (st.bucket.phase === "pouring") {
          // Tipping bucket at cursor
          const tipAngle = st.bucket.pourAngle;
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.translate(st.mouse.x, st.mouse.y);
          ctx.rotate(tipAngle);
          ctx.drawImage(bucketSprite, -bcw/2, -bch*0.6, bcw, bch);
          ctx.restore();
        }
      }

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
        if (st.tool === "pick") {
          st.tool = "bucket";
          st.bucket.phase = "placing";
          st.bucket.count = 0;
          st.bucket.shovelCount = 0;
        } else {
          // Spill any kitties in bucket/shovel back onto ground
          const spillCount = st.bucket.count + st.bucket.shovelCount;
          if (spillCount > 0) {
            const sx = st.bucket.phase === "placing" ? p.x : st.bucket.pos.x;
            const sy = groundY() - 10;
            for (let s = 0; s < spillCount; s++) {
              const pourScale = 0.6 + Math.random() * 2.0;
              spawn(
                sx + (Math.random() - 0.5) * 40,
                sy - Math.random() * 20,
                (Math.random() - 0.5) * 5,
                -1 - Math.random() * 3,
                { scale: pourScale, ts: pourScale, noDelay: true }
              );
            }
          }
          st.bucket.count = 0;
          st.bucket.shovelCount = 0;
          st.tool = "pick";
        }
        e.preventDefault();
        return;
      }

      if (st.tool === "pick") {
        // Mine if on cliff (with pick reach tolerance)
        if (p.x < cliffRight() + 12 && !complete) {
          mineAt(p.y);
          st.lastMine = Date.now();
        }
      } else {
        // Bucket tool - phase-based
        const b = st.bucket;
        if (b.phase === "placing") {
          // Place bucket on ground
          b.pos.x = p.x;
          b.pos.y = groundY();
          b.phase = "shoveling";
        } else if (b.phase === "shoveling") {
          if (hitBucket(p.x, p.y)) {
            if (b.shovelCount > 0) {
              // Deposit shovel into bucket
              depositInBucket();
            } else if (b.count > 0) {
              // Pick up bucket
              pickUpBucket();
            }
          } else {
            // Scoop with shovel
            shovelScoop(p.x, p.y);
          }
        } else if (b.phase === "carrying") {
          startPour();
        }
        // pouring phase ignores clicks
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
        // Plow/knock over settled particles with velocity-based force
        const speed = Math.hypot(st.mouse.vx, st.mouse.vy);
        if (speed > 0.5) {
          const dirX = st.mouse.vx / speed;
          const dirY = st.mouse.vy / speed;
          for (const pt of st.particles) {
            if (!pt.settled) continue;
            const dx = pt.x - p.x, dy = pt.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist < PLOW_RADIUS && dist > 1) {
              const f = 1 - dist / PLOW_RADIUS;
              // Force scales with drag speed: slow = nudge, fast = launch
              const force = Math.min(speed * 1.8, 25);
              const nx = dx / dist, ny = dy / dist;
              pt.vx += (dirX * 0.7 + nx * 0.3) * force * f;
              pt.vy += (dirY * 0.7 + ny * 0.3) * force * f - speed * 0.3 * f;
              pt.settled = false;
              pt.sf = 0;
              pt.av = (Math.random() - 0.5) * 0.15;
            }
          }
        }
      } else if (st.tool === "bucket" && st.mouse.down && st.bucket.phase === "shoveling") {
        // Continuous scooping while dragging with shovel
        if (!hitBucket(p.x, p.y)) {
          shovelScoop(p.x, p.y);
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
