'use strict';

/* ══════════════════════════════════════════════════════════
   Pixel Survival 3D —— 轻量 WebGL 体素渲染引擎（零依赖）
   · 地形按区块缓存为实例化方块，随玩家移动只重建新区块
   · 生物 / 树木 / 机器 / 玩家均由方块模型拼装（我的世界风格）
   · 前向光照：太阳方向光 + 火把点光源 + 烘焙环境遮蔽
   · 水面动画、距离雾、昼夜色调、洞穴黑暗
   对外接口挂在 window.Pixel3D，2D 侧只负责贴图与投影换算。
   ══════════════════════════════════════════════════════════ */

(function(){
  const CHUNK = (typeof CHUNK_TILES === 'number') ? CHUNK_TILES : 16;
  const MAX_LIGHTS = 6;
  const FLOATS = 19;          // 每个实例的 float 数量
  const STRIDE = FLOATS * 4;  // 字节
  /* ── 图集单元编号（4×4） ───────────────────────────── */
  const CELL = {
    grassTop: 0, grassSide: 1, dirt: 2, stone: 3,
    cobble: 4, sand: 5, snow: 6, water: 7,
    logSide: 8, logTop: 9, leaves: 10, planks: 11,
    metal: 12, crystal: 13, cave: 14, plain: 15,
  };

  /* ── 颜色工具 ─────────────────────────────────────── */
  const colorCache = new Map();
  function rgb(hex){
    let cached = colorCache.get(hex);
    if (cached) return cached;
    let n = parseInt(hex.replace('#', ''), 16);
    cached = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    colorCache.set(hex, cached);
    return cached;
  }
  function shade(hex, factor){
    const c = rgb(hex);
    const to = v => Math.max(0, Math.min(255, Math.round(v * 255 * factor)));
    return 'rgb(' + to(c[0]) + ',' + to(c[1]) + ',' + to(c[2]) + ')';
  }
  function mixHex(a, b, t){
    const ca = rgb(a), cb = rgb(b);
    return '#' + [0, 1, 2].map(i => {
      const v = Math.round((ca[i] * (1 - t) + cb[i] * t) * 255);
      return v.toString(16).padStart(2, '0');
    }).join('');
  }
  function mixRgb(a, b, t){
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  /* ── 状态 ──────────────────────────────────────────── */
  const S = {
    ok: false, failed: false, tried: false,
    gl: null, cv: null, inst: null,
    prog: null, tex: null,
    loc: {}, buffers: {},
    atlasCv: null,
    chunks: new Map(),
    chunkLayer: '',
    lights: [],
    cam: null,
    time: 0,
    gfx: null,
    stats: { cubes: 0, chunks: 0, draws: 0 },
    groundCache: new Map(),
  };

  const orbit = { yaw: 0, pitch: 0, zoom: 1 };
  /* 第一人称视角状态：yaw 为水平朝向，pitch > 0 表示向下看 */
  const look = { yaw: Math.PI * 0.25 + Math.PI, pitch: 0.16 };
  let viewMode = 'third';

  function gfx(){
    if (window.PixelGfx) return PixelGfx.get();
    return {
      resolution: 4, viewDistance: 30, lighting: true, shadows: true, water: true,
      particles: 1, fog: 1, animatedWater: true, engine: '3d', camera: 'iso', aimAssist: true,
    };
  }

  /* ── 实例批次 ─────────────────────────────────────── */
  function makeBatch(faces){
    return { data: new Float32Array(FLOATS * faces), n: 0 };
  }
  const opaque = makeBatch(9000);
  const trans = makeBatch(2600);

  function ensure(batch, extra){
    const need = (batch.n + extra) * FLOATS;
    if (need <= batch.data.length) return;
    let cap = batch.data.length > 0 ? batch.data.length * 2 : FLOATS * 64;
    while (cap < need) cap *= 2;
    const next = new Float32Array(cap);
    next.set(batch.data);
    batch.data = next;
  }

  /* 共享的实例参数（避免每帧产生大量临时对象） */
  const O = {
    top: CELL.plain, side: CELL.plain, rotY: 0, rotX: 0,
    light: 1, alpha: 1, emiss: 0, wave: 0,
  };
  function resetO(){
    O.top = CELL.plain; O.side = CELL.plain;
    O.rotY = 0; O.rotX = 0; O.light = 1; O.alpha = 1; O.emiss = 0; O.wave = 0;
  }
  function cells(top, side){
    O.top = top;
    O.side = side === undefined ? top : side;
  }
  const ATLAS_UV = [];
  for (let i = 0; i < 16; i++) ATLAS_UV.push([(i % 4) / 4, Math.floor(i / 4) / 4]);

  function pushCube(batch, cx, cy, cz, sx, sy, sz, tint, o){
    ensure(batch, 1);
    const d = batch.data;
    let p = batch.n * FLOATS;
    d[p] = cx; d[p + 1] = cy; d[p + 2] = cz;
    d[p + 3] = sx; d[p + 4] = sy; d[p + 5] = sz;
    d[p + 6] = o.rotY; d[p + 7] = o.rotX;
    const top = ATLAS_UV[o.top], side = ATLAS_UV[o.side];
    d[p + 8] = top[0]; d[p + 9] = top[1];
    d[p + 10] = side[0]; d[p + 11] = side[1];
    d[p + 12] = tint[0]; d[p + 13] = tint[1]; d[p + 14] = tint[2];
    d[p + 15] = o.light; d[p + 16] = o.alpha; d[p + 17] = o.emiss; d[p + 18] = o.wave;
    batch.n++;
  }

  /* ── 模型变换（局部坐标：+Z 为正面） ───────────────── */
  const T = { x: 0, z: 0, y: 0, yaw: 0, scale: 1 };
  function modelAt(x, z, y, yaw, scale){
    T.x = x; T.z = z; T.y = y; T.yaw = yaw || 0; T.scale = scale || 1;
  }
  /* 局部方块：lx 左右 / ly 离地高度 / lz 前后（+ 为正面） */
  function lbox(lx, ly, lz, sx, sy, sz, tint, batch){
    const s = T.scale;
    const c = Math.cos(T.yaw), n = Math.sin(T.yaw);
    const wx = T.x + (lx * c - lz * n) * s;
    const wz = T.z + (lx * n + lz * c) * s;
    const wy = T.y + ly * s;
    const target = batch || ((O.alpha !== undefined && O.alpha < 1) ? trans : opaque);
    O.rotY += T.yaw;
    pushCube(target, wx, wy, wz, sx * s, sy * s, sz * s, tint, O);
    O.rotY -= T.yaw;
  }

  /* ══════════════════════════════════════════════════
     矩阵
     ══════════════════════════════════════════════════ */
  function mat4(){
    return new Float32Array(16);
  }
  function perspective(out, fovy, aspect, near, far){
    const f = 1 / Math.tan(fovy / 2);
    out.fill(0);
    out[0] = f / aspect; out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    return out;
  }
  function lookAt(out, eye, center, up){
    let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    let len = Math.hypot(zx, zy, zz) || 1;
    zx /= len; zy /= len; zz /= len;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz) || 1;
    xx /= len; xy /= len; xz /= len;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }
  function mul4(out, a, b){
    for (let c = 0; c < 4; c++){
      const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return out;
  }

  /* ══════════════════════════════════════════════════
     图集（程序化像素贴图，16×16 × 4×4）
     ══════════════════════════════════════════════════════════ */
  function mulberry32(seed){
    return function(){
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildAtlas(){
    const TILE_PX = 16, N = 4, SIZE = TILE_PX * N;
    const cv = document.createElement('canvas');
    cv.width = SIZE; cv.height = SIZE;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rng = mulberry32(20261105);
    const ox = cell => (cell % N) * TILE_PX;
    const oy = cell => Math.floor(cell / N) * TILE_PX;
    const px = (cell, x, y, color) => { g.fillStyle = color; g.fillRect(ox(cell) + x, oy(cell) + y, 1, 1); };
    const fill = (cell, color) => { g.fillStyle = color; g.fillRect(ox(cell), oy(cell), TILE_PX, TILE_PX); };
    const noiseTile = (cell, base, palette, opt) => {
      fill(cell, base);
      const density = opt && opt.density ? opt.density : 0.55;
      for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++){
        if (rng() > density) continue;
        const c = palette[Math.floor(rng() * palette.length)];
        px(cell, x, y, c);
      }
    };

    // 0 草顶
    noiseTile(CELL.grassTop, '#5f9c46', ['#6aa94d', '#548c3d', '#74b357', '#4c8038'], { density:0.62 });
    for (let i = 0; i < 10; i++) px(CELL.grassTop, Math.floor(rng() * 16), Math.floor(rng() * 16), '#86c266');

    // 1 草侧面（上方草皮 + 下方泥土）

    noiseTile(CELL.grassSide, '#8a6642', ['#7c5a38', '#96714a', '#6f5033'], { density:0.6 });
    for (let x = 0; x < TILE_PX; x++){
      const h = 3 + Math.floor(rng() * 3);
      for (let y = 0; y < h; y++) px(CELL.grassSide, x, y, y === 0 ? '#6aa94d' : (rng() > 0.4 ? '#5f9c46' : '#548c3d'));
    }

    // 2 泥土
    noiseTile(CELL.dirt, '#8a6642', ['#7c5a38', '#96714a', '#6f5033', '#a07a52'], { density:0.7 });

    // 3 石头
    noiseTile(CELL.stone, '#8d918c', ['#7d817c', '#9a9e99', '#6f7370', '#a8aca7'], { density:0.65 });
    for (let i = 0; i < 4; i++){
      let x = Math.floor(rng() * 14), y = Math.floor(rng() * 14);
      for (let k = 0; k < 4; k++) px(CELL.stone, Math.min(15, x + k), Math.min(15, y + (k % 2)), '#6a6e6a');
    }

    // 4 圆石
    noiseTile(CELL.cobble, '#7c807b', ['#6e726d', '#8a8e89', '#62665f'], { density:0.5 });
    for (let i = 0; i < 6; i++){
      const bx = Math.floor(rng() * 12), by = Math.floor(rng() * 12), w = 3 + Math.floor(rng() * 3), h = 2 + Math.floor(rng() * 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
        px(CELL.cobble, bx + x, by + y, y === 0 ? '#95998f' : (rng() > 0.5 ? '#83877f' : '#75796f'));
      }
    }

    // 5 沙子
    noiseTile(CELL.sand, '#d9c68c', ['#e2d29a', '#cdb87c', '#efe0aa'], { density:0.7 });

    // 6 雪

    noiseTile(CELL.snow, '#e9f1ee', ['#f4fbf8', '#d8e4e2', '#cfdcda'], { density:0.6 });

    // 7 水

    noiseTile(CELL.water, '#3f7fa8', ['#4789b2', '#38749b', '#4f94bd'], { density:0.5 });
    for (let y = 2; y < 16; y += 5) for (let x = 0; x < 16; x++) if (rng() > 0.45) px(CELL.water, x, y, '#5fa3c4');

    // 8 原木侧面
    noiseTile(CELL.logSide, '#6b4a2e', ['#5c3f26', '#7a5736', '#63432a'], { density:0.7 });
    for (let x = 0; x < 16; x++) if (x % 5 === 2) for (let y = 0; y < 16; y++) if (rng() > 0.25) px(CELL.logSide, x, y, '#4d331e');
    for (let x = 0; x < 16; x++) if (x % 5 === 0) for (let y = 0; y < 16; y++) if (rng() > 0.6) px(CELL.logSide, x, y, '#8a6440');

    // 9 原木顶面（年轮）
    noiseTile(CELL.logTop, '#b08a58', ['#a5814f', '#bb9667', '#997745'], { density:0.5 });
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++){
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 6.4) px(CELL.logTop, x, y, '#6b4a2e');
      else if (Math.abs(d - 2) < 0.7 || Math.abs(d - 4.4) < 0.6) px(CELL.logTop, x, y, '#8f6b3e');
    }

    // 10 树叶
    noiseTile(CELL.leaves, '#3d7a3a', ['#478b41', '#316b30', '#549c4a', '#2b5f2a'], { density:0.8 });
    for (let i = 0; i < 14; i++) px(CELL.leaves, Math.floor(rng() * 16), Math.floor(rng() * 16), '#63aa52');

    // 11 木板
    noiseTile(CELL.planks, '#b08b52', ['#a5814b', '#bb9667', '#9a7744'], { density:0.55 });
    for (let y = 0; y < 16; y += 4){
      for (let x = 0; x < 16; x++) px(CELL.planks, x, y, '#84623a');
      const seam = 2 + Math.floor(rng() * 12);
      for (let k = 0; k < 3; k++) px(CELL.planks, seam, Math.min(15, y + k), '#8d6a3f');
    }

    // 12 金属
    noiseTile(CELL.metal, '#aab2b4', ['#9ba3a5', '#bcc4c6', '#8c9496'], { density:0.5 });
    for (let x = 1; x < 16; x += 5) for (let y = 1; y < 16; y += 5){
      px(CELL.metal, x, y, '#d6dee0'); px(CELL.metal, x + 1, y, '#7d8588'); px(CELL.metal, x, y + 1, '#7d8588');
    }

    // 13 荧晶
    noiseTile(CELL.crystal, '#6fc8d8', ['#8ee0ec', '#5cb3c4', '#a8f0f4'], { density:0.6 });
    for (let i = 0; i < 5; i++){
      const x = Math.floor(rng() * 12), y = Math.floor(rng() * 12);
      for (let k = 0; k < 4; k++) px(CELL.crystal, x + k, y + k, '#d8fbff');
    }

    // 14 洞穴岩壁
    noiseTile(CELL.cave, '#57504b', ['#4a4440', '#635b55', '#3d3835', '#6d645d'], { density:0.75 });
    for (let i = 0; i < 6; i++) px(CELL.cave, Math.floor(rng() * 16), Math.floor(rng() * 16), '#2e2a28');

    // 15 基础色（实体使用，靠 iTint 上色）

    fill(CELL.plain, '#ffffff');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++){
      if (rng() > 0.82) px(CELL.plain, x, y, rng() > 0.5 ? '#f2f2f2' : '#ffffff');
    }
    S.atlasCv = cv;
    return cv;
  }

  /* 把 2233 材质包里的方块贴图贴进图集（贴图加载完成后调用） */
  let atlasTintCanvas = null;
  function paintAtlasTextures(cv){
    if (!window.MCTextures || !cv) return false;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const N = 4, TILE_PX = 16;
    let painted = 0;
    for (let cell = 0; cell < 15; cell++){
      const img = MCTextures.atlasImage(cell);
      if (!img) continue;
      const ox = (cell % N) * TILE_PX, oy = Math.floor(cell / N) * TILE_PX;
      const base = MCTextures.atlasBase(cell);
      const tint = MCTextures.atlasTint(cell);
      let source = img;
      if (tint){
        // 灰度贴图（草、水）按生物群系颜色上色：保留像素明暗，只乘上颜色
        if (!atlasTintCanvas){
          atlasTintCanvas = document.createElement('canvas');
          atlasTintCanvas.width = 16; atlasTintCanvas.height = 16;
        }
        const tg = atlasTintCanvas.getContext('2d');
        tg.imageSmoothingEnabled = false;
        tg.clearRect(0, 0, 16, 16);
        tg.globalCompositeOperation = 'source-over';
        tg.drawImage(img, 0, 0, 16, 16, 0, 0, 16, 16);
        tg.globalCompositeOperation = 'multiply';
        tg.fillStyle = tint;
        tg.fillRect(0, 0, 16, 16);
        tg.globalCompositeOperation = 'source-over';
        source = atlasTintCanvas;
      }
      if (base){ g.fillStyle = base; g.fillRect(ox, oy, TILE_PX, TILE_PX); }
      // 只取第一帧：水面等贴图是 16×N 的动画长条，直接缩放会变成条纹
      g.drawImage(source, 0, 0, 16, 16, ox, oy, TILE_PX, TILE_PX);
      painted++;
    }
    return painted > 0;
  }

  function uploadAtlas(cv){
    if (!S.gl || !S.tex || !cv) return;
    const gl = S.gl;
    try{
      gl.bindTexture(gl.TEXTURE_2D, S.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      S.atlasComplete = !!(window.MCTextures && MCTextures.allLoaded());
    }catch(error){
      console.warn('[Pixel3D] 材质包图集上传失败，继续使用程序化贴图', error);
      S.atlasComplete = true;
    }
  }

  /* ══════════════════════════════════════════════════
     GL 初始化
     ══════════════════════════════════════════════════════════ */
  const VERT = [
    'attribute vec3 aPos;',
    'attribute vec3 aNormal;',
    'attribute vec2 aUV;',
    'attribute vec3 iPos;',
    'attribute vec3 iSize;',
    'attribute float iRotY;',
    'attribute float iRotX;',
    'attribute vec2 iUVtop;',
    'attribute vec2 iUVside;',
    'attribute vec3 iTint;',
    'attribute float iLight;',
    'attribute float iAlpha;',
    'attribute float iEmiss;',
    'attribute float iWave;',
    'uniform mat4 uMVP;',
    'uniform vec3 uCamPos;',
    'uniform vec3 uSunDir;',
    'uniform vec3 uSunColor;',
    'uniform vec3 uAmbient;',
    'uniform vec3 uLightPos[6];',
    'uniform float uLightPower[6];',
    'uniform float uLightCount;',
    'uniform float uFogNear;',
    'uniform float uFogDensity;',
    'uniform float uTime;',
    'uniform float uAnim;',
    'varying vec3 vColor;',
    'varying vec2 vUV;',
    'varying float vFog;',
    'varying float vAlpha;',
    'varying float vEmiss;',
    'void main(){',
    '  vec3 p = aPos * iSize;',
    '  float cx = cos(iRotX);',
    '  float sx = sin(iRotX);',
    '  p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);',
    '  float cy = cos(iRotY);',
    '  float sy = sin(iRotY);',
    '  p = vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);',
    '  vec3 world = iPos + p;',
    '  if (iWave > 0.5) world.y += sin(uTime * 1.7 + world.x * 0.85 + world.z * 0.6) * 0.035 * uAnim;',
    '  vec3 n = aNormal;',
    '  n = vec3(n.x, n.y * cx - n.z * sx, n.y * sx + n.z * cx);',
    '  n = vec3(n.x * cy - n.z * sy, n.y, n.x * sy + n.z * cy);',
    '  float ndl = max(dot(n, uSunDir), 0.0);',
    '  vec3 light = uAmbient + uSunColor * ndl;',
    '  for (int i = 0; i < 6; i++){',
    '    float w = step(float(i) + 0.5, uLightCount);',
    '    vec3 d = uLightPos[i] - world;',
    '    float dist = length(d);',
    '    float att = clamp(1.0 - dist / max(uLightPower[i], 0.001), 0.0, 1.0);',
    '    float up = clamp(0.7 + d.y * 0.3 / (dist + 0.001), 0.0, 1.0);',
    '    float falloff = att * (0.35 + 0.65 * att);',
    '    light += vec3(1.0, 0.72, 0.42) * falloff * up * 1.7 * w;',
    '  }',
    '  vColor = iTint * light * iLight;',
    '  vec2 cell = (aNormal.y > 0.5) ? iUVtop : iUVside;',
    '  vUV = cell + (aUV * 15.0 + 0.5) / 64.0;',
    '  float dist = length(world - uCamPos);',
    '  vFog = clamp((dist - uFogNear) * uFogDensity, 0.0, 1.0);',
    '  vAlpha = iAlpha;',
    '  vEmiss = iEmiss;',
    '  gl_Position = uMVP * vec4(world, 1.0);',
    '}'
  ].join('\n');

  const FRAG = [
    'precision mediump float;',
    'uniform sampler2D uTex;',
    'uniform vec3 uFogColor;',
    'varying vec3 vColor;',
    'varying vec2 vUV;',
    'varying float vFog;',
    'varying float vAlpha;',
    'varying float vEmiss;',
    'void main(){',
    '  vec4 tex = texture2D(uTex, vUV);',
    '  vec3 col = tex.rgb * vColor;',
    '  col = mix(col, vColor * 1.8 + vec3(0.22, 0.15, 0.06), vEmiss);',
    '  col = mix(col, uFogColor, vFog);',
    '  gl_FragColor = vec4(col, tex.a * vAlpha);',
    '}'
  ].join('\n');

  function compile(gl, type, source){
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
      const log = gl.getShaderInfoLog(sh);
      console.error('[Pixel3D] 着色器编译失败', log);
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function createCubeGeometry(){
    // 每个面：4 顶点（位置 / 法线 / UV），外部视角 CCW
    const faces = [
      { n:[1,0,0], v:[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]] },
      { n:[-1,0,0], v:[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]] },
      { n:[0,1,0], v:[[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]] },
      { n:[0,-1,0], v:[[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]] },
      { n:[0,0,1], v:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]] },
      { n:[0,0,-1], v:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]] },
    ];
    // 侧面：v 越大越靠下（图集 v 向下），顶面按平面展开
    const uvs = [
      [[0,1],[1,1],[1,0],[0,0]],
      [[0,1],[1,1],[1,0],[0,0]],
      [[0,0],[0,1],[1,1],[1,0]],
      [[0,0],[0,1],[1,1],[1,0]],
      [[0,1],[1,1],[1,0],[0,0]],
      [[0,1],[1,1],[1,0],[0,0]],
    ];
    const verts = [], indices = [];
    let base = 0;
    for (let f = 0; f < 6; f++){
      const face = faces[f];
      for (let i = 0; i < 4; i++){
        const v = face.v[i], uv = uvs[f][i];
        verts.push(v[0], v[1], v[2], face.n[0], face.n[1], face.n[2], uv[0], uv[1]);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      base += 4;
    }
    return { verts: new Float32Array(verts), indices: new Uint16Array(indices) };
  }

  function createGL(){
    if (S.tried) return S.ok;
    S.tried = true;
    try{
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl', {
        alpha: false, antialias: false, depth: true, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      }) || cv.getContext('experimental-webgl');
      if (!gl) return false;
      const inst = gl.getExtension('ANGLE_instanced_arrays');
      if (!inst){
        console.warn('[Pixel3D] 浏览器不支持实例化绘制，退回 2.5D 渲染');
        return false;
      }
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)){
        console.error('[Pixel3D] 程序链接失败', gl.getProgramInfoLog(prog));
        return false;
      }
      gl.useProgram(prog);

      const loc = {};
      ['aPos', 'aNormal', 'aUV', 'iPos', 'iSize', 'iRotY', 'iRotX', 'iUVtop', 'iUVside',
        'iTint', 'iLight', 'iAlpha', 'iEmiss', 'iWave'].forEach(name => {
        loc[name] = gl.getAttribLocation(prog, name);
      });
      ['uMVP', 'uCamPos', 'uSunDir', 'uSunColor', 'uAmbient', 'uLightPos', 'uLightPower',
        'uLightCount', 'uFogNear', 'uFogDensity', 'uFogColor', 'uTime', 'uAnim', 'uTex'].forEach(name => {
        loc[name] = gl.getUniformLocation(prog, name);
      });

      const geo = createCubeGeometry();
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, geo.verts, gl.STATIC_DRAW);
      const ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);

      const buffers = {};
      buffers.vert = vbo;
      buffers.index = ibo;
      buffers.opaque = gl.createBuffer();
      buffers.trans = gl.createBuffer();

      const atlas = buildAtlas();
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.frontFace(gl.CCW);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0.5, 0.7, 0.85, 1);

      cv.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        S.failed = true;
        S.ok = false;
        console.warn('[Pixel3D] WebGL 上下文丢失，已切回 2.5D 渲染');
      });

      S.gl = gl; S.cv = cv; S.inst = inst; S.prog = prog;
      S.loc = loc; S.buffers = buffers; S.tex = tex; S.atlasCv = atlas;
      S.atlasComplete = false;
      S.ok = true;
      return true;
    }catch(error){
      console.error('[Pixel3D] 初始化失败', error);
      S.ok = false;
      return false;
    }
  }

  function resize(){
    if (!S.ok) return;
    const scale = (typeof renderScale === 'number') ? renderScale : 4;
    const w = Math.max(1, Math.round(W * scale));
    const h = Math.max(1, Math.round(H * scale));
    if (S.cv.width !== w || S.cv.height !== h){
      S.cv.width = w;
      S.cv.height = h;
      const gl = S.gl;
      gl.viewport(0, 0, w, h);
    }
  }

  /* ══════════════════════════════════════════════════
     地形
     ══════════════════════════════════════════════════ */
  const STYLE = {
    surface: [
      { top:CELL.grassTop, side:CELL.grassSide, tint:rgb('#f2fbe9'), h:1.00 },           // 0 草地
      { top:CELL.grassTop, side:CELL.grassSide, tint:rgb('#d6e8c6'), h:1.03 },           // 1 森林
      { top:CELL.stone, side:CELL.stone, tint:rgb('#eef2ef'), h:1.28 },                  // 2 岩地
      { top:CELL.cave, side:CELL.cave, tint:rgb('#d9d1c8'), h:0.92 },                    // 3 洞穴地表
      { top:CELL.sand, side:CELL.sand, tint:rgb('#d5c39b'), h:0.56, water:true },        // 4 水域
      { top:CELL.sand, side:CELL.sand, tint:rgb('#dccda8'), h:0.98 },                    // 5 沙地
      { top:CELL.snow, side:CELL.snow, tint:rgb('#c3d4d7'), h:1.05 },                    // 6 雪地
    ],
    cave: [
      { top:CELL.cave, side:CELL.cave, tint:rgb('#d4cec8'), h:0.34 },
      { top:CELL.cave, side:CELL.cave, tint:rgb('#c8c2bc'), h:0.36 },
      { top:CELL.stone, side:CELL.stone, tint:rgb('#d8d4cc'), h:1.62 },
      { top:CELL.cave, side:CELL.cave, tint:rgb('#cdc6be'), h:0.28 },
      { top:CELL.cave, side:CELL.cave, tint:rgb('#bdb7b2'), h:0.3 },
      { top:CELL.cave, side:CELL.cave, tint:rgb('#c4beb8'), h:0.32 },
      { top:CELL.cave, side:CELL.cave, tint:rgb('#c9c3bd'), h:0.34 },
    ],
  };
  const FALLBACK_STYLE = { top:CELL.dirt, side:CELL.dirt, tint:rgb('#ffffff'), h:1 };

  function styleFor(terrain, layer){
    if (terrain < 0) return null;
    const table = layer === 'cave' ? STYLE.cave : STYLE.surface;
    return table[terrain] || FALLBACK_STYLE;
  }

  function groundAt(xPx, yPx){
    const tx = Math.floor(xPx / TILE), ty = Math.floor(yPx / TILE);
    const layer = (G && G.worldLayer) || 'surface';
    const key = tx + ',' + ty + ',' + layer;
    let h = S.groundCache.get(key);
    if (h === undefined){
      const style = styleFor(getWorldTerrainIndex(tx, ty, layer), layer);
      h = style ? style.h : 1;
      S.groundCache.set(key, h);
    }
    return h;
  }

  /* 单个区块的实例数据（缓存） */
  function buildChunk(cx, cy, layer){
    const size = CHUNK + 2;
    const heights = new Float32Array(size * size);
    const terrains = new Int8Array(size * size);
    for (let y = -1; y <= CHUNK; y++){
      for (let x = -1; x <= CHUNK; x++){
        const tx = cx * CHUNK + x, ty = cy * CHUNK + y;
        const terrain = getWorldTerrainIndex(tx, ty, layer);
        const style = terrain < 0 ? null : styleFor(terrain, layer);
        const idx = (y + 1) * size + (x + 1);
        terrains[idx] = terrain;
        if (!style){ heights[idx] = -1; continue; }
        const jitter = 0;
        heights[idx] = style.h + jitter;
      }
    }
    const op = { data: new Float32Array(0), n: 0 };
    const tr = { data: new Float32Array(0), n: 0 };
    const tmpO = { top:0, side:0, rotY:0, rotX:0, light:1, alpha:1, emiss:0, wave:0 };

    for (let y = 0; y < CHUNK; y++){
      for (let x = 0; x < CHUNK; x++){
        const idx = (y + 1) * size + (x + 1);
        const terrain = terrains[idx];
        const style = terrain < 0 ? null : styleFor(terrain, layer);
        if (!style) continue;
        const tx = cx * CHUNK + x, ty = cy * CHUNK + y;
        const h = heights[idx];
        const wx = tx + 0.5, wz = ty + 0.5;

        const n0 = heights[idx - size], n1 = heights[idx + size], n2 = heights[idx - 1], n3 = heights[idx + 1];
        const tallest = Math.max(n0, n1, n2, n3);
        const ao = tallest > h ? clamp(1 - (tallest - h) * 0.16, 0.72, 1) : 1;
        const variation = 0.94 + hash2(tx * 31, ty * 17) * 0.12;

        tmpO.top = style.top; tmpO.side = style.side;
        tmpO.rotY = 0; tmpO.rotX = 0;
        tmpO.light = ao * variation;
        tmpO.alpha = 1; tmpO.emiss = 0; tmpO.wave = 0;
        pushCube(op, wx, h / 2, wz, 1, Math.max(0.2, h), 1, style.tint, tmpO);

        if (style.water){
          // 水面用薄板而不是整块水柱，避免多层叠加出现条纹
          tmpO.top = CELL.water; tmpO.side = CELL.water;
          tmpO.light = 1; tmpO.alpha = 0.78;
          tmpO.wave = gfx().animatedWater ? 1 : 0;
          pushCube(tr, wx, 0.9, wz, 1, 0.05, 1, rgb('#ffffff'), tmpO);
        }
      }
    }
    return { op, tr, key: layer + ':' + cx + ',' + cy };
  }

  function getChunk(cx, cy, layer){
    const key = layer + ':' + cx + ',' + cy;
    let chunk = S.chunks.get(key);
    if (!chunk){
      chunk = buildChunk(cx, cy, layer);
      S.chunks.set(key, chunk);
      // 简单淘汰：缓存超过上限时丢弃最早写入的区块
      if (S.chunks.size > 90){
        for (const oldKey of S.chunks.keys()){
          S.chunks.delete(oldKey);
          if (S.chunks.size <= 70) break;
        }
      }
    }
    return chunk;
  }

  /* ══════════════════════════════════════════════════
     相机 / 光照
     ══════════════════════════════════════════════════ */
  const CAM = {
    eye: [0, 0, 0], target: [0, 0, 0], fwd: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0],
    yaw: Math.PI * 0.25, pitch: 0.66, dist: 15, fov: 55 * Math.PI / 180, aspect: W / H,
    tanHalf: Math.tan((55 * Math.PI / 180) / 2),
  };

  function cameraBase(){
    const config = (window.PixelGfx && PixelGfx.cameraConfig()) || { yaw: Math.PI * 0.25, pitch: 0.66, distance: 15 };
    return config;
  }

  /* 第一人称：眼睛位于角色头部，视角由鼠标控制 */
  function updateFirstPersonCamera(){
    const ground = groundAt(player.x, player.y);
    const eyeHeight = 1.62;
    let jitterX = 0, jitterY = 0, jitterZ = 0;
    if (typeof shake === 'number' && shake > 0.1){
      const amount = Math.min(0.4, shake * 0.04);
      jitterX = (Math.random() * 2 - 1) * amount;
      jitterY = (Math.random() * 2 - 1) * amount * 0.5;
      jitterZ = (Math.random() * 2 - 1) * amount;
    }
    const yaw = look.yaw + orbit.yaw;
    const pitch = clamp(look.pitch + orbit.pitch, -1.25, 1.2);
    const cosPitch = Math.cos(pitch);
    const fwd = [Math.sin(yaw) * cosPitch, -Math.sin(pitch), Math.cos(yaw) * cosPitch];
    const eye = [
      player.x / TILE + jitterX,
      ground + eyeHeight + (player.jumpHeight || 0) + jitterY,
      player.y / TILE + jitterZ,
    ];
    const target = [eye[0] + fwd[0] * 8, eye[1] + fwd[1] * 8, eye[2] + fwd[2] * 8];
    let right = [-fwd[2], 0, fwd[0]];
    const rl = Math.hypot(right[0], right[1], right[2]) || 1;
    right = [right[0] / rl, right[1] / rl, right[2] / rl];
    const up = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0],
    ];
    CAM.fov = 70 * Math.PI / 180;
    CAM.tanHalf = Math.tan(CAM.fov / 2);
    const camera = {
      eye, target, fwd, right, up, yaw, pitch, dist: 0,
      near: 0.08, far: Math.max(60, gfx().viewDistance * 1.6),
    };
    camera.view = lookAt(mat4(), eye, target, [0, 1, 0]);
    camera.proj = perspective(mat4(), CAM.fov, W / H, camera.near, camera.far);
    camera.vp = mul4(mat4(), camera.proj, camera.view);
    CAM.eye = eye; CAM.target = target; CAM.fwd = fwd; CAM.right = right; CAM.up = up;
    CAM.yaw = yaw; CAM.pitch = pitch; CAM.dist = 0; CAM.vp = camera.vp;
    S.cam = camera;
    return camera;
  }

  function updateCamera(){
    if (viewMode === 'first') return updateFirstPersonCamera();
    CAM.fov = 55 * Math.PI / 180;
    CAM.tanHalf = Math.tan(CAM.fov / 2);
    const config = cameraBase();
    const yaw = config.yaw + orbit.yaw;
    const pitch = clamp(config.pitch + orbit.pitch, 0.08, 1.4);
    const ground = groundAt(player.x, player.y);
    const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const targetX = player.x / TILE + forwardX * 1.8 + rightX * 0.8;
    const targetZ = player.y / TILE + forwardZ * 1.8 + rightZ * 0.8;
    const targetY = ground + 1.35;
    const dist = (config.distance * orbit.zoom) * (1 - Math.min(0.18, (CAM.aspect < 1.5 ? 0.1 : 0)));
    // 受击 / 爆炸时的镜头抖动
    let jitterX = 0, jitterY = 0, jitterZ = 0;
    if (typeof shake === 'number' && shake > 0.1){
      const amount = Math.min(0.55, shake * 0.05);
      jitterX = (Math.random() * 2 - 1) * amount;
      jitterY = (Math.random() * 2 - 1) * amount * 0.6;
      jitterZ = (Math.random() * 2 - 1) * amount;
    }
    const targetXj = targetX + jitterX, targetZj = targetZ + jitterZ;
    const eye = [
      targetXj + Math.sin(yaw) * Math.cos(pitch) * dist - rightX * 0.45,
      targetY + jitterY + Math.sin(pitch) * dist,
      targetZj + Math.cos(yaw) * Math.cos(pitch) * dist - rightZ * 0.45,
    ];
    const target = [targetXj, targetY + jitterY, targetZj];
    const fwd = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
    fwd[0] /= fl; fwd[1] /= fl; fwd[2] /= fl;
    // 右方向 = normalize(cross(forward, up))
    let right = [-fwd[2], 0, fwd[0]];
    const rl = Math.hypot(right[0], right[1], right[2]) || 1;
    right = [right[0] / rl, right[1] / rl, right[2] / rl];
    const up = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0],
    ];
    const camera = { eye, target, fwd, right, up, yaw, pitch, dist, near: 0.35, far: Math.max(60, gfx().viewDistance * 1.6) };
    camera.view = lookAt(mat4(), eye, target, [0, 1, 0]);
    camera.proj = perspective(mat4(), CAM.fov, W / H, camera.near, camera.far);
    camera.vp = mul4(mat4(), camera.proj, camera.view);
    CAM.eye = eye; CAM.target = target; CAM.fwd = fwd; CAM.right = right; CAM.up = up;
    CAM.yaw = yaw; CAM.pitch = pitch; CAM.dist = dist; CAM.vp = camera.vp;
    S.cam = camera;
    return camera;
  }

  function sunDirection(){
    const t = (G && G.dayTime) || 0;
    const angle = t * Math.PI * 2;
    const x = Math.cos(angle) * 0.35 + 0.35;
    const y = 0.72 + Math.sin(angle) * 0.18;
    const z = 0.4;
    const len = Math.hypot(x, y, z) || 1;
    return [x / len, y / len, z / len];
  }

  function dayPalette(){
    const dark = clamp(G ? G.darkness : 0, 0, 1);
    const day = 1 - dark;
    // 全部使用数值颜色，避免每帧生成新的十六进制字符串（颜色缓存会无限增长）
    const skyDay = [0.576, 0.722, 0.812], skyNight = [0.051, 0.082, 0.149];
    const fogDay = [0.663, 0.776, 0.839], fogNight = [0.051, 0.082, 0.149];
    let sky = mixRgb(skyNight, skyDay, day);
    let fogColor = mixRgb(fogNight, fogDay, day);
    let ambient = mixRgb([0.26, 0.30, 0.42], [0.52, 0.56, 0.55], day);
    let sun = mixRgb([0.10, 0.13, 0.22], [0.88, 0.80, 0.62], day);
    if (G && G.weather === 'rain'){
      sky = mixRgb(sky, [0.36, 0.44, 0.49], 0.45);
      fogColor = mixRgb(fogColor, [0.42, 0.50, 0.55], 0.4);
      ambient = mixRgb(ambient, [0.42, 0.46, 0.52], 0.5);
      sun = [sun[0] * 0.6, sun[1] * 0.65, sun[2] * 0.75];
    }
    if (G && G.weather === 'blizzard'){
      sky = mixRgb(sky, [0.76, 0.83, 0.85], 0.5);
      fogColor = mixRgb(fogColor, [0.80, 0.86, 0.88], 0.55);
      ambient = mixRgb(ambient, [0.66, 0.72, 0.78], 0.6);
    }
    if (G && G.weather === 'heatwave'){
      sky = mixRgb(sky, [0.78, 0.64, 0.45], 0.25);
      fogColor = mixRgb(fogColor, [0.82, 0.70, 0.52], 0.3);
      sun = [sun[0] * 1.15, sun[1] * 1.0, sun[2] * 0.75];
    }
    if (G && G.weather === 'drought'){
      sky = mixRgb(sky, [0.71, 0.60, 0.45], 0.2);
      fogColor = mixRgb(fogColor, [0.74, 0.64, 0.50], 0.2);
    }
    if (G && G.inCave){
      sky = [0.039, 0.035, 0.031];
      fogColor = [0.115, 0.105, 0.095];
      ambient = [0.24, 0.23, 0.22];
      sun = [0.05, 0.05, 0.06];
    }
    return { dark, day, sky, ambient, sun, sunDir: sunDirection(), fogColor };
  }

  function collectLights(palette){
    const lights = S.lights;
    lights.length = 0;
    const equip = gfx();
    if (!equip.lighting) return lights;
    const px = player.x / TILE, pz = player.y / TILE;
    const candidates = [];
    const consider = (x, y, z, power) => {
      const d = Math.hypot(x - px, z - pz);
      if (d > (equip.viewDistance || 28)) return;
      candidates.push({ x, y, z, power, d });
    };
    for (const torch of torches){
      consider(torch.x / TILE, groundAt(torch.x, torch.y) + 0.9, torch.y / TILE, 6.2);
    }
    for (const machine of machines){
      const type = MACHINE_TYPES[machine.type];
      if (!type) continue;
      if (machine.type === 'copperFurnace' && machine.activeRecipe !== null){
        consider(machine.x / TILE, groundAt(machine.x, machine.y) + 0.9, machine.y / TILE, 4.2);
      } else if (type.generator === 'fuel' && machine.fuel > 0){
        consider(machine.x / TILE, groundAt(machine.x, machine.y) + 0.9, machine.y / TILE, 3.6);
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    const count = Math.min(MAX_LIGHTS, candidates.length);
    for (let i = 0; i < count; i++) lights.push(candidates[i]);
    return lights;
  }

  /* ══════════════════════════════════════════════════
     实体模型
     ══════════════════════════════════════════════════ */
  const now = () => (G ? G.time : 0);

  function facingYaw(dx, dy){
    const len = Math.hypot(dx, dy) || 1;
    return Math.atan2(-(dx / len), dy / len);
  }

  /* 投影：朝背光方向偏移，并叠三层做出柔和边缘（比一块死黑更自然） */
  function shadow(x, z, y, size, alpha){
    const base = alpha === undefined ? 0.26 : alpha;
    const sun = S.sun || [0.3, 0.7, 0.2];
    const ox = -sun[0] * size * 0.55;
    const oz = -sun[2] * size * 0.55;
    const layers = [[1, base * 0.5], [0.72, base * 0.66], [0.44, base * 0.8]];
    for (let i = 0; i < layers.length; i++){
      const scale = layers[i][0], layerAlpha = layers[i][1];
      resetO();
      O.alpha = layerAlpha;
      O.light = 1;
      pushCube(trans, x + ox * scale, y + 0.011 + i * 0.002, z + oz * scale,
        size * scale, 0.008, size * scale, rgb('#0b1210'), O);
    }
  }

  // 场景物件的投影（可在画面设置里关闭，节省填充率）
  function propShadow(x, z, y, size, alpha){
    if (gfx().shadows === false) return;
    shadow(x, z, y, size, alpha);
  }

  /* 判断某个点是否挡在相机与玩家之间，用于让树冠淡出 */
  function occludesCamera(x, y, z){
    const cam = S.cam;
    if (!cam) return false;
    const px = player.x / TILE, pz = player.y / TILE;
    const py = groundAt(player.x, player.y) + 1;
    const ax = x - cam.eye[0], ay = y - cam.eye[1], az = z - cam.eye[2];
    const bx = px - cam.eye[0], by = py - cam.eye[1], bz = pz - cam.eye[2];
    const bl2 = bx * bx + by * by + bz * bz || 1;
    const t = (ax * bx + ay * by + az * bz) / bl2;
    if (t < 0.03 || t > 0.95) return false;
    const cx = ax - bx * t, cy = ay - by * t, cz = az - bz * t;
    return Math.hypot(cx, cy, cz) < 2.2;
  }

  function drawTree(tree){
    const x = tree.x / TILE, z = tree.y / TILE;
    const base = groundAt(tree.x, tree.y);
    const sway = Math.sin((tree.sway || 0) + now() * 0.8) * 0.09;
    const shake = tree.shake > 0 ? Math.sin(now() * 30) * tree.shake * 0.06 : 0;
    // 挡住镜头或贴着镜头时淡出，避免树冠糊满屏幕
    const cam = S.cam;
    const nearCamera = cam ? Math.hypot(x - cam.eye[0], base + 3.2 - cam.eye[1], z - cam.eye[2]) < 6 : false;
    // 第一人称视线就在树旁边，这时不做淡出，避免整片树发虚
    const fade = (viewMode !== 'first' &&
      (nearCamera || occludesCamera(x, base + 3.2, z) || occludesCamera(x, base + 1.4, z))) ? 0.34 : 1;
    modelAt(x, z, base, 0, 1);
    // 树干：侧面树皮 + 顶面年轮，全部走材质包贴图
    resetO(); O.light = 0.9; O.alpha = fade;
    O.top = CELL.logTop; O.side = CELL.logSide;
    lbox(0, 1.8, 0, 0.46, 3.6, 0.46, rgb('#ffffff'));
    resetO(); O.light = 0.86; O.alpha = fade;
    O.top = CELL.logTop; O.side = CELL.logSide;
    lbox(0, 0.18, 0, 0.66, 0.36, 0.66, rgb('#c9b48f'));
    // 树冠：用一格大小的树叶方块拼出来（贴图不会被拉伸，更像《我的世界》）
    const leafTint = rgb('#9fce74');
    const leaf = (lx, ly, lz, light) => {
      resetO();
      O.top = CELL.leaves; O.side = CELL.leaves;
      O.alpha = fade;
      O.light = light;
      lbox(sway * (0.2 + ly * 0.12) + shake, ly, sway * (0.12 + ly * 0.08), 1, 1, 1, leafTint);
    };
    // 下层 3×3，中层满格 3×3，上层去掉四角，最顶端一格 —— 上半部分更大更饱满
    for (let lx = -1; lx <= 1; lx++) for (let lz = -1; lz <= 1; lz++)
      leaf(lx, 3.0, lz, 0.8 + hash2(x * 7 + lx, z * 7 + lz) * 0.18);
    for (let lx = -1; lx <= 1; lx++) for (let lz = -1; lz <= 1; lz++)
      leaf(lx, 4.0, lz, 0.88 + hash2(x * 5 + lx, z * 5 + lz) * 0.2);
    for (let lx = -1; lx <= 1; lx++) for (let lz = -1; lz <= 1; lz++){
      if (Math.abs(lx) === 1 && Math.abs(lz) === 1) continue;
      leaf(lx, 5.0, lz, 0.98 + hash2(x * 3 + lx, z * 3 + lz) * 0.18);
    }
    leaf(0, 6.0, 0, 1.1);
    propShadow(x, z, base, 2.0, 0.32);
  }

  function drawRock(rock){
    const x = rock.x / TILE, z = rock.y / TILE;
    const base = groundAt(rock.x, rock.y);
    const oreColor = rock.ore && ITEMS[rock.ore] ? rgb(ITEMS[rock.ore].color) : null;
    modelAt(x, z, base, hash2(rock.x, rock.y) * 6.28, 1);
    resetO(); O.light = 0.95;
    lbox(0, 0.42, 0, 1.15, 0.84, 1.0, rgb('#8b8f8a'));
    resetO(); O.light = 1.0;
    lbox(0.22, 0.78, 0.16, 0.62, 0.36, 0.6, rgb('#9da29c'));
    if (rock.ore){
      resetO(); O.emiss = 0.35; O.light = 1.1;
      lbox(-0.18, 0.88, -0.12, 0.24, 0.3, 0.24, oreColor);
      lbox(0.3, 0.7, -0.22, 0.18, 0.2, 0.18, oreColor);
      lbox(-0.32, 0.6, 0.24, 0.16, 0.18, 0.16, oreColor);
    }
    // 洞穴石笋：细高的锥形柱（三段递减）
    if (rock.spike){
      resetO(); O.light = 0.88;
      lbox(0, 1.2, 0, 0.52, 0.9, 0.52, rgb('#7c827e'));
      resetO(); O.light = 0.98;
      lbox(0, 1.85, 0, 0.3, 0.6, 0.3, rgb('#8d938e'));
      resetO(); O.light = 1.06;
      lbox(0, 2.24, 0, 0.14, 0.3, 0.14, rgb('#9aa09b'));
    }
    propShadow(x, z, base, 1.25, 0.24);
  }

  function drawBush(bush){
    const x = bush.x / TILE, z = bush.y / TILE;
    const base = groundAt(bush.x, bush.y);
    modelAt(x, z, base, 0, 1);
    resetO(); O.light = 0.9;
    lbox(0, 0.26, 0, 0.9, 0.52, 0.9, rgb('#4f8f43'));
    resetO(); O.light = 1;
    lbox(-0.16, 0.55, 0.1, 0.6, 0.4, 0.6, rgb('#63a852'));
    if (bush.berries){
      resetO(); O.emiss = 0.15;
      const berries = rgb('#d0405c');
      lbox(0.22, 0.5, 0.24, 0.12, 0.12, 0.12, berries);
      lbox(-0.1, 0.62, 0.3, 0.11, 0.11, 0.11, berries);
      lbox(0.02, 0.36, -0.3, 0.1, 0.1, 0.1, berries);
    }
    propShadow(x, z, base, 0.95, 0.2);
  }

  function drawPickup(pickup){
    const x = pickup.x / TILE, z = pickup.y / TILE;
    const base = groundAt(pickup.x, pickup.y);
    const item = ITEMS[pickup.type] || ITEMS.wood;
    const bob = Math.sin((pickup.t || 0) * 6) * 0.09;
    resetO();
    O.rotY = now() * 2.2;
    O.emiss = 0.18;
    const size = 0.26;
    modelAt(x, z, base + 0.32 + bob + 0.14, 0, 1);
    lbox(0, 0, 0, size, size, size, rgb(item.color || '#cccccc'));
    resetO(); O.alpha = 0.22;
    pushCube(trans, x, base + 0.015, z, 0.4, 0.01, 0.4, rgb('#000000'), O);
  }

  function drawPlacedBlock(block){
    const x = block.x / TILE, z = block.y / TILE;
    const base = groundAt(block.x, block.y);
    const item = ITEMS[block.type] || ITEMS.woodBlock;
    if (block.type === 'powerWire'){
      resetO(); O.emiss = 0.2;
      modelAt(x, z, base, 0, 1);
      lbox(0, 0.06, 0, 0.95, 0.12, 0.16, rgb('#e1b06d'));
      resetO(); O.rotY = Math.PI / 2;
      lbox(0, 0.06, 0, 0.95, 0.12, 0.16, rgb('#c28b53'));
      return;
    }
    if (block.type === 'worldGate'){
      modelAt(x, z, base, 0, 1);
      const pulse = 0.55 + Math.sin(now() * 2.4) * 0.15;
      resetO(); O.light = 0.8;
      lbox(-0.42, 1.05, 0, 0.2, 2.1, 0.28, rgb('#665b8e'));
      lbox(0.42, 1.05, 0, 0.2, 2.1, 0.28, rgb('#665b8e'));
      lbox(0, 2.1, 0, 1.05, 0.24, 0.3, rgb('#9f91ce'));
      resetO(); O.emiss = pulse; O.alpha = 0.72;
      pushCube(trans, x, base + 1.05, z, 0.62, 1.9, 0.1, rgb('#c8aaff'), O);
      return;
    }
    if (block.type === 'ecoGarden'){
      modelAt(x, z, base, 0, 1);
      resetO(); O.light = 0.95;
      lbox(0, 0.1, 0, 0.92, 0.2, 0.92, rgb('#6f5a3d'));
      resetO(); O.light = 1;
      lbox(0, 0.3, 0, 0.8, 0.24, 0.8, rgb('#5da24f'));
      resetO(); O.emiss = 0.1;
      lbox(-0.2, 0.54, 0.14, 0.18, 0.28, 0.18, rgb('#9bcb66'));
      lbox(0.18, 0.6, -0.1, 0.16, 0.36, 0.16, rgb('#b3d773'));
      return;
    }
    // 普通方块
    const known = block.type === 'stoneBlock' || block.type === 'woodBlock' ||
      block.type === 'copperFurnace' || block.type === 'craftingTable';
    const cellTop = block.type === 'stoneBlock' ? CELL.cobble
      : block.type === 'copperFurnace' ? CELL.metal : CELL.planks;
    modelAt(x, z, base, 0, 1);
    resetO(); O.light = 1;
    O.top = cellTop; O.side = cellTop;
    // 模组 / 自定义方块没有专属贴图，用物品配色区分
    lbox(0, 0.5, 0, 1, 1, 1, known ? rgb('#ffffff') : rgb(item.color || '#ffffff'));
    if (block.type === 'copperFurnace'){
      resetO(); O.emiss = 0.25;
      lbox(0, 0.45, 0.51, 0.5, 0.42, 0.04, rgb(item.color));
    }
    if (block.type === 'craftingTable'){
      resetO(); O.light = 1.05;
      lbox(0, 1.02, 0, 1.0, 0.06, 1.0, rgb('#d9b37a'));
      resetO(); O.light = 0.7;
      lbox(0, 1.06, 0, 0.06, 0.02, 0.9, rgb('#7a5a3c'));
      lbox(0, 1.06, 0, 0.9, 0.02, 0.06, rgb('#7a5a3c'));
      resetO(); O.light = 0.9; O.emiss = 0.05;
      lbox(-0.28, 1.1, 0.28, 0.16, 0.16, 0.16, rgb('#c1c8b9'));
      lbox(0.3, 1.1, -0.26, 0.12, 0.22, 0.12, rgb('#8c6a3f'));
    }
    propShadow(x, z, base, 1.1, 0.22);
  }

  function drawMachine(machine){
    const x = machine.x / TILE, z = machine.y / TILE;
    const base = groundAt(machine.x, machine.y);
    const type = MACHINE_TYPES[machine.type] || {};
    const active = machine.activeRecipe !== null && machine.activeRecipe !== undefined;
    modelAt(x, z, base, 0, 1);
    resetO(); O.light = 0.96;
    O.top = CELL.metal; O.side = CELL.metal;
    lbox(0, 0.45, 0, 0.92, 0.9, 0.92, rgb('#c8cfd0'));
    resetO(); O.light = 1;
    let panel = rgb('#6b7470');
    if (type.generator === 'solar') panel = rgb('#6e9a9d');
    else if (type.generator === 'fuel') panel = rgb('#777c72');
    else if (machine.type === 'crusher') panel = rgb('#59636a');
    else if (type.harvester) panel = rgb('#73955b');
    else if (type.itemRouter) panel = rgb('#728c90');
    lbox(0, 0.6, 0.28, 0.62, 0.5, 0.36, panel);
    if (active || machine.fuel > 0 || machine.power > 0){
      resetO(); O.emiss = 0.35 + Math.sin(now() * 8) * 0.1;
      lbox(0, 0.52, 0.48, 0.3, 0.24, 0.06, rgb('#ffb052'));
    }
    if (type.generator === 'solar'){
      resetO(); O.light = 1.1;
      lbox(0, 1.02, 0, 0.9, 0.1, 0.9, rgb('#8cbfc2'));
    }
    propShadow(x, z, base, 1.1, 0.24);
  }

  function drawBelt(belt){
    const x = belt.x / TILE, z = belt.y / TILE;
    const base = groundAt(belt.x, belt.y);
    modelAt(x, z, base, 0, 1);
    resetO(); O.light = 0.98;
    lbox(0, 0.08, 0, 0.92, 0.16, 0.92, rgb('#777a61'));
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const d = dirs[belt.dir || 0] || dirs[0];
    const phase = (now() * 0.6) % 1;
    resetO(); O.emiss = 0.18;
    for (let i = 0; i < 3; i++){
      const t = (phase + i / 3) % 1 - 0.5;
      pushCube(trans, x + d[0] * t * 0.8, base + 0.17, z + d[1] * t * 0.8, 0.16, 0.03, 0.16, rgb('#e1cf9c'), O);
    }
  }

  function drawRuin(ruin){
    const x = ruin.x / TILE, z = ruin.y / TILE;
    const base = groundAt(ruin.x, ruin.y);
    modelAt(x, z, base, 0, 1);
    resetO(); O.light = 0.9;
    lbox(-0.4, 0.35, 0.2, 0.8, 0.7, 0.3, rgb('#82704f'));
    lbox(0.42, 0.55, -0.16, 0.3, 1.1, 0.3, rgb('#8a7856'));
    lbox(0.1, 0.2, 0.46, 1.0, 0.4, 0.3, rgb('#6f6249'));
    if (!ruin.opened){
      resetO(); O.emiss = 0.3;
      lbox(0, 0.75, 0, 0.26, 0.26, 0.26, rgb('#e1bd73'));
    }
    propShadow(x, z, base, 1.2, 0.22);
  }

  function drawVillageHouse(house){
    const x = house.x / TILE, z = house.y / TILE;
    const base = groundAt(house.x, house.y);
    modelAt(x, z, base, 0, 1);
    resetO(); O.light = 0.95;
    lbox(0, 1.1, 0, 2.6, 2.2, 2.4, rgb('#b08b52'));
    resetO(); O.light = 0.85;
    lbox(0, 2.45, 0, 3.0, 0.5, 2.8, rgb('#8a5a3a'));
    lbox(0, 2.9, 0, 2.2, 0.45, 2.0, rgb('#7a4d31'));
    lbox(0, 3.3, 0, 1.2, 0.4, 1.1, rgb('#6b422a'));
    resetO(); O.light = 0.7;
    lbox(0, 0.62, 1.21, 0.7, 1.24, 0.06, rgb('#5b3a22'));
    resetO(); O.emiss = 0.4;
    lbox(-0.8, 1.35, 1.22, 0.4, 0.4, 0.05, rgb('#ffd58a'));
    lbox(0.8, 1.35, 1.22, 0.4, 0.4, 0.05, rgb('#ffd58a'));
    propShadow(x, z, base, 2.8, 0.24);
  }

  function drawVillager(villager){
    const x = villager.x / TILE, z = villager.y / TILE;
    const base = groundAt(villager.x, villager.y);
    const yaw = facingYaw(player.x - villager.x, player.y - villager.y);
    const swing = Math.sin(now() * 2 + villager.x) * 0.2;
    modelAt(x, z, base, yaw, 1);
    resetO(); O.light = 0.95;
    lbox(-0.14, 0.34, 0, 0.2, 0.68, 0.24, rgb('#6b5a44'), undefined);
    lbox(0.14, 0.34, 0, 0.2, 0.68, 0.24, rgb('#6b5a44'));
    resetO(); O.light = 1;
    lbox(0, 0.9, 0, 0.52, 0.85, 0.34, rgb('#6b8e5a'));
    lbox(0, 1.42, 0, 0.36, 0.36, 0.36, rgb('#c49a6c'));
    lbox(0, 1.36, 0.2, 0.1, 0.1, 0.1, rgb('#a87f56'));
    resetO(); O.rotX = swing * 0.4;
    lbox(-0.34, 1.02, 0, 0.14, 0.5, 0.16, rgb('#6b8e5a'));
    lbox(0.34, 1.02, 0, 0.14, 0.5, 0.16, rgb('#6b8e5a'));
    shadow(x, z, base, 0.8, 0.22);
  }

  function drawChest(chest){
    const x = chest.x / TILE, z = chest.y / TILE;
    const base = groundAt(chest.x, chest.y);
    modelAt(x, z, base, 0, 1);
    resetO(); O.light = 0.95;
    O.side = CELL.planks;
    lbox(0, 0.26, 0, 0.72, 0.52, 0.56, rgb('#c49a6c'));
    resetO(); O.light = 1;
    O.side = CELL.planks;
    if (chest.open){
      O.rotX = -1.9;
      lbox(0, 0.72, -0.2, 0.74, 0.16, 0.58, rgb('#d9b37a'));
      resetO(); O.light = 0.5;
      lbox(0, 0.44, 0, 0.6, 0.2, 0.44, rgb('#302416'));
    }else{
      lbox(0, 0.58, 0, 0.74, 0.16, 0.58, rgb('#d9b37a'));
      resetO(); O.emiss = 0.3;
      lbox(0, 0.42, 0.29, 0.14, 0.16, 0.04, rgb('#e0c050'));
    }
    shadow(x, z, base, 0.8, 0.22);
  }

  function drawFarmPlot(plot){
    const x = plot.x / TILE, z = plot.y / TILE;
    const base = groundAt(plot.x, plot.y);
    modelAt(x, z, base, 0, 1);
    resetO(); O.light = 0.9;
    O.top = CELL.dirt; O.side = CELL.dirt;
    pushCube(opaque, x, base + 0.05, z, 0.98, 0.1, 0.98, rgb('#7a5a3a'), O);
    if (plot.crop && plot.growth > 0){
      const growth = clamp(plot.growth, 0, 1);
      const crop = CROPS[plot.crop] || { color:'#9acb70' };
      resetO(); O.light = 1;
      const h = 0.25 + growth * 0.65;
      lbox(0, h / 2 + 0.1, 0, 0.08, h, 0.08, rgb('#5a9f45'));
      if (growth > 0.35){
        resetO(); O.light = 1;
        lbox(0.12, h * 0.62, 0.05, 0.26, 0.06, 0.2, rgb('#6fb550'));
        lbox(-0.12, h * 0.78, -0.05, 0.24, 0.06, 0.18, rgb('#6fb550'));
      }
      if (growth >= 0.98){
        resetO(); O.emiss = 0.12;
        lbox(0.1, h * 0.85, 0.1, 0.18, 0.18, 0.18, rgb(crop.color));
        lbox(-0.1, h * 0.7, -0.08, 0.16, 0.16, 0.16, rgb(crop.color));
      }
    }
  }

  function drawCaveEntrance(entrance){
    const x = entrance.x / TILE, z = entrance.y / TILE;
    const base = groundAt(entrance.x, entrance.y);
    const inCave = G.inCave;
    resetO(); O.light = 0.45;
    O.top = CELL.cave; O.side = CELL.cave;
    pushCube(opaque, x, base - 0.18, z, 0.95, 0.12, 0.95, rgb('#1a1714'), O);
    resetO(); O.light = 0.9;
    O.top = CELL.stone; O.side = CELL.stone;
    const frame = inCave ? rgb('#9cc8a0') : rgb('#b88c57');
    pushCube(opaque, x - 0.45, base + 0.1, z, 0.2, 0.5, 0.9, rgb('#6d6862'), O);
    pushCube(opaque, x + 0.45, base + 0.1, z, 0.2, 0.5, 0.9, rgb('#6d6862'), O);
    resetO(); O.emiss = 0.6 + Math.sin(now() * 3) * 0.15;
    pushCube(opaque, x, base - 0.1, z, 0.9, 0.04, 0.9, frame, O);
    // 发光光柱：远远就能看见洞口
    resetO(); O.emiss = 0.85;
    for (let i = 0; i < 5; i++){
      const t = i / 5;
      pushCube(opaque, x, base + 0.5 + i * 0.6, z, 0.36 - t * 0.2, 0.52, 0.36 - t * 0.2, frame, O);
    }
    resetO(); O.emiss = 1;
    pushCube(opaque, x, base + 3.5 + Math.sin(now() * 2) * 0.12, z, 0.28, 0.28, 0.28, frame, O);
  }

  function drawEnemy(enemy){
    if (window.MOB_SPRITES_OK) return;   // 改用 UV 部件精灵绘制
    const x = enemy.x / TILE, z = enemy.y / TILE;
    const base = groundAt(enemy.x, enemy.y);
    const dx = player.x - enemy.x, dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const yaw = facingYaw(dx, dy);
    const walk = Math.sin(enemy.wobble || 0);
    const isKnight = enemy.type === 'bloodKnight';
    const isWarden = enemy.type === 'caveWarden';
    const isBrute = enemy.type === 'brute';
    const isSpitter = enemy.type === 'spitter';
    const scale = enemy.boss ? 1.55 : isBrute ? 1.22 : isWarden ? 1.12 : enemy.fast ? 0.78 : 1;
    // 皮肤平均色：来自材质包 entity/ 里的 MC 皮肤（构建时提取）
    const mobKey = isKnight ? null : isWarden ? 'skeleton' : enemy.fast ? 'spider' : isSpitter ? 'creeper' : isBrute ? 'zombie' : 'zombie';
    const mobPal = mobKey && window.MC_MOB_COLORS && MC_MOB_COLORS[mobKey] ? MC_MOB_COLORS[mobKey] : null;
    const body = rgb(isKnight ? '#693447' : mobPal ? mobPal.body : isWarden ? '#67583d' : isSpitter ? '#526c48' : isBrute ? '#4a5340' : '#4a6b3a');
    const head = rgb(isKnight ? '#bb5065' : mobPal ? mobPal.head : isWarden ? '#b59a62' : isSpitter ? '#91a85d' : isBrute ? '#68704c' : '#7aa85a');
    const limb = rgb(isKnight ? '#5a2d3d' : mobPal ? mobPal.limb : isWarden ? '#8a7448' : '#6b8a4a');
    const flash = enemy.hitFlash > 0;
    const tintBody = flash ? rgb('#e08a8a') : body;
    modelAt(x, z, base, yaw, scale);
    resetO(); O.light = 0.92;
    // 模型部件
    O.rotX = walk * 0.5;
    lbox(-0.13, 0.36, 0, 0.2, 0.72, 0.24, limb);
    O.rotX = -walk * 0.5;
    lbox(0.13, 0.36, 0, 0.2, 0.72, 0.24, limb);
    // 身体
    resetO(); O.light = 1;
    lbox(0, 1.02, 0, 0.52, 0.58, 0.32, tintBody);
    // 手臂（僵尸前伸）
    resetO(); O.light = 1;
    O.rotX = -1.25 + walk * 0.12;
    lbox(-0.34, 1.18, 0.12, 0.16, 0.54, 0.18, flash ? rgb('#d08080') : limb);
    O.rotX = -1.25 - walk * 0.12;
    lbox(0.34, 1.18, 0.12, 0.16, 0.54, 0.18, flash ? rgb('#d08080') : limb);
    // 模型部件
    resetO(); O.light = 1;
    lbox(0, 1.48, 0, 0.4, 0.4, 0.4, flash ? rgb('#e0a0a0') : head);
    resetO(); O.emiss = 0.85;
    lbox(-0.09, 1.52, 0.2, 0.07, 0.07, 0.03, rgb('#ff3020'));
    lbox(0.09, 1.52, 0.2, 0.07, 0.07, 0.03, rgb('#ff3020'));
    if (isKnight){
      resetO(); O.light = 1.1;
      lbox(0, 1.74, 0, 0.44, 0.12, 0.44, rgb('#e8b866'));
      lbox(-0.24, 1.9, 0, 0.08, 0.22, 0.08, rgb('#f08091'));
      lbox(0.24, 1.9, 0, 0.08, 0.22, 0.08, rgb('#f08091'));
    }else if (isWarden){
      resetO(); O.light = 1.1;
      lbox(0, 1.72, 0, 0.46, 0.1, 0.46, rgb('#e1bd73'));
      resetO(); O.emiss = 0.5;
      lbox(0, 1.44, 0.2, 0.24, 0.06, 0.03, rgb('#f1d78f'));
    }else if (isBrute){
      resetO(); O.light = 1;
      lbox(-0.3, 1.2, 0, 0.14, 0.5, 0.4, rgb('#697158'));
      lbox(0.3, 1.2, 0, 0.14, 0.5, 0.4, rgb('#697158'));
    }else if (isSpitter){
      resetO(); O.emiss = 0.4;
      lbox(0.18, 1.3, 0.14, 0.16, 0.16, 0.16, rgb('#a9e77a'));
    }
    if (enemy.elite){
      resetO(); O.emiss = 0.55 + Math.sin(now() * 6) * 0.2;
      pushCube(trans, x, base + 0.02, z, 1.1, 0.01, 1.1, rgb('#ffd34a'), O);
    }
    if (enemy.boss){
      resetO(); O.emiss = 0.5;
      pushCube(trans, x, base + 0.02, z, 1.7, 0.01, 1.7, rgb('#ff4060'), O);
    }
    shadow(x, z, base, 1.0 * scale, 0.26);
  }

  function animalPalette(type){
    if (type === 'chicken') return { body: rgb('#e5dfc9'), head: rgb('#f1e7cf'), leg: rgb('#c28b50'), beak: rgb('#d7a958') };
    if (type === 'sheep') return { body: rgb('#eee8d8'), head: rgb('#a78e82'), leg: rgb('#615348'), beak: rgb('#322c2c') };
    return { body: rgb('#9b6157'), head: rgb('#86534c'), leg: rgb('#59403a'), beak: rgb('#62433d') };
  }

  function drawAnimal(animal, isPet){
    const x = animal.x / TILE, z = animal.y / TILE;
    const base = groundAt(animal.x, animal.y);
    const palette = animalPalette(animal.type);
    const yaw = facingYaw(Math.cos(animal.facing || animal.direction || 0), Math.sin(animal.facing || animal.direction || 0));
    const scale = (animal.age < 1 ? 0.62 : 1) * (animal.type === 'chicken' ? 0.8 : 1);
    const gait = animal.walking ? Math.sin(animal.wobble || 0) : 0;
    modelAt(x, z, base, yaw, scale);
    if (animal.type === 'chicken'){
      resetO(); O.light = 1;
      lbox(0, 0.32, 0, 0.42, 0.38, 0.56, palette.body);
      lbox(0, 0.62, 0.24, 0.24, 0.24, 0.24, palette.head);
      resetO(); O.light = 1; O.emiss = 0.05;
      lbox(0, 0.63, 0.38, 0.1, 0.07, 0.12, palette.beak);
      lbox(0, 0.5, 0.34, 0.07, 0.1, 0.07, rgb('#bf5b51'));
      O.rotX = gait * 0.5;
      lbox(-0.13, 0.09, 0, 0.06, 0.18, 0.06, palette.leg);
      O.rotX = -gait * 0.5;
      lbox(0.13, 0.09, 0, 0.06, 0.18, 0.06, palette.leg);
    }else if (animal.type === 'sheep'){
      resetO(); O.light = 1;
      lbox(0, 0.46, 0, 0.62, 0.52, 0.9, palette.body);
      lbox(0, 0.74, -0.08, 0.68, 0.2, 0.86, rgb('#fff9eb'));
      lbox(0, 0.56, 0.52, 0.3, 0.3, 0.3, palette.head);
      resetO(); O.emiss = 0.05;
      lbox(-0.07, 0.6, 0.68, 0.06, 0.06, 0.04, rgb('#2a2626'));
      lbox(0.07, 0.6, 0.68, 0.06, 0.06, 0.04, rgb('#2a2626'));
      resetO(); O.light = 1;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]){
        O.rotX = sx * gait * 0.4;
        lbox(sx * 0.2, 0.12, sz * 0.28, 0.1, 0.24, 0.1, palette.leg);
      }
    }else{
      resetO(); O.light = 1;
      lbox(0, 0.46, 0, 0.6, 0.5, 0.88, palette.body);
      lbox(0, 0.7, -0.1, 0.64, 0.16, 0.8, rgb('#bb7b69'));
      lbox(0, 0.56, 0.52, 0.32, 0.3, 0.32, palette.head);
      resetO(); O.light = 1; O.emiss = 0.08;
      lbox(-0.15, 0.5, 0.68, 0.06, 0.12, 0.06, rgb('#e8e0d0'));
      lbox(0.15, 0.5, 0.68, 0.06, 0.12, 0.06, rgb('#e8e0d0'));
      resetO(); O.light = 1;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]){
        O.rotX = sx * gait * 0.4;
        lbox(sx * 0.19, 0.12, sz * 0.26, 0.1, 0.24, 0.1, palette.leg);
      }
    }
    if (animal.love > 0){
      resetO(); O.emiss = 0.6 + Math.sin(now() * 8) * 0.2;
      lbox(0, 1.05, 0, 0.12, 0.12, 0.12, rgb('#ef8195'));
    }
    if (animal.tamed || isPet){
      resetO(); O.light = 1.1;
      lbox(0, 0.62, 0.22, 0.4, 0.06, 0.4, rgb('#e5b84f'));
    }
    shadow(x, z, base, 0.9 * scale, 0.22);
  }

  function drawTorch(torch){
    const x = torch.x / TILE, z = torch.y / TILE;
    const base = groundAt(torch.x, torch.y);
    resetO(); O.light = 0.95;
    modelAt(x, z, base, 0, 1);
    lbox(0, 0.3, 0, 0.08, 0.6, 0.08, rgb('#5a3a1e'));
    const flicker = 0.75 + Math.sin((torch.t || 0) * 9) * 0.12;
    resetO(); O.emiss = flicker;
    lbox(0, 0.68, 0, 0.15, 0.18, 0.15, rgb('#ffb040'));
    resetO(); O.emiss = 1;
    lbox(0, 0.8, 0, 0.08, 0.1, 0.08, rgb('#fff0a0'));
  }

  function drawProjectiles(){
    for (const bullet of playerBullets){
      resetO(); O.emiss = 0.9;
      pushCube(opaque, bullet.x / TILE, groundAt(bullet.x, bullet.y) + 0.6, bullet.y / TILE,
        0.12, 0.12, 0.3, rgb('#ffe7a0'), O);
    }
    for (const shot of enemyShots){
      resetO(); O.emiss = 0.8;
      pushCube(opaque, shot.x / TILE, groundAt(shot.x, shot.y) + 0.5, shot.y / TILE,
        0.14, 0.14, 0.14, rgb(shot.color || '#a9e77a'), O);
    }
  }

  function drawParticles(){
    if (!particles || !particles.length) return;
    const factor = window.PixelGfx ? PixelGfx.particleFactor() : 1;
    if (factor <= 0) return;
    const step = factor < 0.75 ? 2 : 1;
    for (let i = 0; i < particles.length; i += step){
      const particle = particles[i];
      if (!particle) continue;
      const size = clamp(particle.size * 0.055, 0.04, 0.2);
      resetO(); O.emiss = 0.15; O.alpha = clamp(particle.life / particle.max, 0, 1);
      const y = groundAt(particle.x, particle.y) + 0.25 + Math.sin(i * 1.7) * 0.05;
      pushCube(trans, particle.x / TILE, y, particle.y / TILE,
        size, size, size, rgb(particle.color || '#ffffff'), O);
    }
  }

  function drawPlayerModel(){
    const p = player;
    const appearance = p.appearance || DEFAULT_PLAYER_APPEARANCE;
    const skin = (PLAYER_CUSTOMIZATION.skin[appearance.skin] || PLAYER_CUSTOMIZATION.skin[0]);
    const outfit = (PLAYER_CUSTOMIZATION.outfit[appearance.outfit] || PLAYER_CUSTOMIZATION.outfit[0]);
    const hair = (PLAYER_CUSTOMIZATION.hairColor[appearance.hairColor] || PLAYER_CUSTOMIZATION.hairColor[0]);
    const eye = (PLAYER_CUSTOMIZATION.eyes[appearance.eyes] || PLAYER_CUSTOMIZATION.eyes[0]);
    const x = p.x / TILE, z = p.y / TILE;
    const base = groundAt(p.x, p.y);
    const yaw = facingYaw(p.aimX || 0, p.aimY || 1);
    const gait = playerMoveBlend();
    const stride = Math.sin(p.walkPhase * 2.5) * gait;
    const bob = Math.abs(stride) * 0.03 + Math.sin(now() * 3) * 0.012 * (1 - gait);
    const attack = p.swing > 0 ? 1 - p.swing / ATTACK_ANIM_DURATION : -1;
    const punch = attack >= 0 ? Math.sin(Math.min(1, attack) * Math.PI) : 0;
    // 拉弓：蓄力时双臂后拉
    const chargeNeed = (((ITEMS[p.weapon] || {}).chargeTime) || 1.1) * 1000;
    const drawBack = p.chargeStart ? Math.min(1, (performance.now() - p.chargeStart) / chargeNeed) : 0;

    modelAt(x, z, base + (p.jumpHeight || 0) + bob, yaw, 1);
    // 模型部件
    resetO(); O.light = 0.94;
    const legRootY = 0.72;
    const legHalfLength = 0.36;
    const leftLegAngle = stride * 0.55;
    const rightLegAngle = -stride * 0.55;
    const leftLegY = legRootY - legHalfLength * Math.cos(leftLegAngle);
    const leftLegZ = -legHalfLength * Math.sin(leftLegAngle);
    const rightLegY = legRootY - legHalfLength * Math.cos(rightLegAngle);
    const rightLegZ = -legHalfLength * Math.sin(rightLegAngle);
    O.rotX = leftLegAngle;
    lbox(-0.13, leftLegY, leftLegZ, 0.2, 0.72, 0.24, rgb(outfit.shadow));
    O.rotX = rightLegAngle;
    lbox(0.13, rightLegY, rightLegZ, 0.2, 0.72, 0.24, rgb(outfit.shadow));
    resetO(); O.light = 0.8;
    const footOffsetY = 0.06 - legRootY;
    const footOffsetZ = 0.04;
    const leftFootY = legRootY + footOffsetY * Math.cos(leftLegAngle) - footOffsetZ * Math.sin(leftLegAngle);
    const leftFootZ = footOffsetY * Math.sin(leftLegAngle) + footOffsetZ * Math.cos(leftLegAngle);
    const rightFootY = legRootY + footOffsetY * Math.cos(rightLegAngle) - footOffsetZ * Math.sin(rightLegAngle);
    const rightFootZ = footOffsetY * Math.sin(rightLegAngle) + footOffsetZ * Math.cos(rightLegAngle);
    O.rotX = leftLegAngle;
    lbox(-0.13, leftFootY, leftFootZ, 0.22, 0.14, 0.3, rgb('#4a3a2e'));
    O.rotX = rightLegAngle;
    lbox(0.13, rightFootY, rightFootZ, 0.22, 0.14, 0.3, rgb('#4a3a2e'));
    // 身体
    resetO(); O.light = 1;
    lbox(0, 1.02, 0, 0.5, 0.58, 0.3, rgb(outfit.base));
    resetO(); O.light = 1.08;
    lbox(0, 1.12, 0.16, 0.34, 0.3, 0.04, rgb(outfit.light));
    // 手臂
    resetO(); O.light = 0.98;
    const leftArmAngle = -stride * 0.5 - punch * 1.5 - drawBack * 0.85;
    const rightArmAngle = stride * 0.5 - punch * 0.4 - drawBack * 0.85;
    const shoulderY = 1.3;
    const shoulderZ = -drawBack * 0.2;
    const armHalfLength = 0.25;
    const handOffset = 0.28;
    const handCenterOffset = armHalfLength + handOffset;
    const leftArmY = shoulderY - armHalfLength * Math.cos(leftArmAngle);
    const leftArmZ = shoulderZ - armHalfLength * Math.sin(leftArmAngle);
    const rightArmY = shoulderY - armHalfLength * Math.cos(rightArmAngle);
    const rightArmZ = shoulderZ - armHalfLength * Math.sin(rightArmAngle);
    O.rotX = leftArmAngle;
    lbox(-0.33, leftArmY, leftArmZ, 0.16, armHalfLength * 2, 0.18, rgb(outfit.base));
    O.rotX = rightArmAngle;
    lbox(0.33, rightArmY, rightArmZ, 0.16, armHalfLength * 2, 0.18, rgb(outfit.base));
    // 模型部件
    resetO(); O.light = 1;
    O.rotX = leftArmAngle;
    lbox(-0.33, shoulderY - handCenterOffset * Math.cos(leftArmAngle),
      shoulderZ - handCenterOffset * Math.sin(leftArmAngle),
      0.15, 0.15, 0.15, rgb(skin.base));
    O.rotX = rightArmAngle;
    lbox(0.33, shoulderY - handCenterOffset * Math.cos(rightArmAngle),
      shoulderZ - handCenterOffset * Math.sin(rightArmAngle),
      0.15, 0.15, 0.15, rgb(skin.base));
    // 模型部件
    resetO(); O.light = 1;
    lbox(0, 1.5, 0, 0.4, 0.4, 0.4, rgb(skin.base));
    resetO(); O.light = 0.92;
    lbox(0, 1.72, -0.02, 0.42, 0.11, 0.42, rgb(hair.color));
    lbox(0, 1.62, -0.2, 0.36, 0.22, 0.08, rgb(hair.color));
    resetO(); O.light = 1;
    lbox(-0.09, 1.53, 0.19, 0.07, 0.07, 0.02, rgb('#f3f4e0'));
    lbox(0.09, 1.53, 0.19, 0.07, 0.07, 0.02, rgb('#f3f4e0'));
    resetO(); O.light = 0.9;
    lbox(-0.09, 1.52, 0.2, 0.04, 0.04, 0.02, rgb(eye.color));
    lbox(0.09, 1.52, 0.2, 0.04, 0.04, 0.02, rgb(eye.color));
    // 帽子 / 背饰
    if (appearance.hat === 1){
      resetO(); O.light = 1.05;
      lbox(0, 1.78, 0, 0.5, 0.06, 0.5, rgb('#b68962'));
      lbox(0, 1.83, 0, 0.34, 0.14, 0.34, rgb('#c49a6c'));
    }else if (appearance.hat === 2){
      resetO(); O.light = 0.95;
      lbox(0, 1.75, -0.02, 0.44, 0.2, 0.44, rgb(outfit.shadow));
    }else if (appearance.hat === 3){
      resetO(); O.emiss = 0.08;
      lbox(0, 1.74, 0, 0.44, 0.06, 0.44, rgb('#c8453c'));
    }
    if (appearance.back === 0){
      resetO(); O.light = 0.85;
      lbox(0, 1.02, -0.26, 0.34, 0.42, 0.16, rgb('#7a5a3c'));
    }else if (appearance.back === 2){
      resetO(); O.light = 0.8;
      lbox(0, 0.95, -0.24, 0.44, 0.62, 0.1, rgb(outfit.trim || outfit.shadow));
    }
    // 武器
    const weaponId = p.weapon;
    if (weaponId && ITEMS[weaponId]){
      const item = ITEMS[weaponId];
      resetO(); O.light = 1; O.emiss = 0.05;
      if (item.firearm){
        lbox(0.36, 1.02, 0.34, 0.1, 0.12, 0.5, rgb(item.color2));
        lbox(0.36, 1.05, 0.12, 0.08, 0.1, 0.2, rgb(item.color));
      }else{
        lbox(0.36, 1.18, 0.34, 0.07, 0.62, 0.07, rgb(item.color));
        lbox(0.36, 0.92, 0.34, 0.16, 0.06, 0.16, rgb(item.color2));
      }
    }
    // 护甲光泽
    if (p.armorId && ITEMS[p.armorId]){
      resetO(); O.light = 1.15; O.emiss = 0.06;
      lbox(0, 1.24, 0, 0.54, 0.14, 0.34, rgb(ITEMS[p.armorId].color));
    }
    shadow(x, z, base, 0.85, 0.3);
  }

  /* ══════════════════════════════════════════════════
     场景构建
     ══════════════════════════════════════════════════ */
  function buildScene(camera, palette){
    opaque.n = 0;
    trans.n = 0;
    S.groundCache.clear();
    S.stats.chunks = 0;

    const equip = gfx();
    const layer = (G && G.worldLayer) || 'surface';
    const view = clamp(equip.viewDistance || 28, 10, 48);
    const pxTile = player.x / TILE, pzTile = player.y / TILE;
    const chunkRadius = Math.ceil(view / CHUNK) + 1;
    const pcx = Math.floor(player.x / (CHUNK * TILE));
    const pcy = Math.floor(player.y / (CHUNK * TILE));
    const built = [];
    for (let cy = pcy - chunkRadius; cy <= pcy + chunkRadius; cy++){
      for (let cx = pcx - chunkRadius; cx <= pcx + chunkRadius; cx++){
        const centerX = cx * CHUNK + CHUNK / 2, centerZ = cy * CHUNK + CHUNK / 2;
        const dx = centerX - pxTile, dz = centerZ - pzTile;
        const dist = Math.hypot(dx, dz);
        if (dist > view + CHUNK) continue;
        // 背向相机的区块直接跳过
        if (dist > CHUNK && (dx * camera.fwd[0] + dz * camera.fwd[2]) < -CHUNK * 1.4) continue;
        built.push({ cx, cy, dist });
      }
    }
    built.sort((a, b) => a.dist - b.dist);
    // 首帧一次建好全部区块，避免开局出现空洞；之后每帧最多补 4 个新区块
    let budget = S.warmedUp ? 4 : 4096;
    for (const item of built){
      const key = layer + ':' + item.cx + ',' + item.cy;
      if (!S.chunks.has(key) && budget <= 0) continue;
      if (!S.chunks.has(key)) budget--;
      const chunk = getChunk(item.cx, item.cy, layer);
      if (chunk.op.n){
        ensure(opaque, chunk.op.n);
        opaque.data.set(chunk.op.data.subarray(0, chunk.op.n * FLOATS), opaque.n * FLOATS);
        opaque.n += chunk.op.n;
      }
      if (chunk.tr.n){
        ensure(trans, chunk.tr.n);
        trans.data.set(chunk.tr.data.subarray(0, chunk.tr.n * FLOATS), trans.n * FLOATS);
        trans.n += chunk.tr.n;
      }
      S.stats.chunks++;
    }
    S.warmedUp = true;

    // 实体
    const maxDist = view + 6;
    const near = (object) => Math.hypot(object.x / TILE - pxTile, object.y / TILE - pzTile) < maxDist;
    for (const entrance of caveEntrances) if (near(entrance)) drawCaveEntrance(entrance);
    for (const plot of farmPlots) if (near(plot)) drawFarmPlot(plot);
    for (const torch of torches) if (near(torch)) drawTorch(torch);
    for (const tree of trees) if (near(tree)) drawTree(tree);
    for (const rock of rocks) if (near(rock)) drawRock(rock);
    for (const bush of bushes) if (near(bush)) drawBush(bush);
    for (const pickup of pickups) if (near(pickup)) drawPickup(pickup);
    for (const block of placedBlocks) if (near(block)) drawPlacedBlock(block);
    for (const machine of machines) if (near(machine)) drawMachine(machine);
    for (const belt of belts) if (near(belt)) drawBelt(belt);
    for (const ruin of ruins) if (near(ruin)) drawRuin(ruin);
    for (const house of villageHouses) if (near(house)) drawVillageHouse(house);
    for (const villager of villagers) if (near(villager)) drawVillager(villager);
    for (const enemy of enemies) if (near(enemy)) drawEnemy(enemy);
    for (const animal of animals) if (near(animal)) drawAnimal(animal, false);
    for (const pet of pets) if (near(pet)) drawAnimal(pet, true);
    for (const chest of chests) if (near(chest)) drawChest(chest);
    drawProjectiles();
    drawParticles();
    if (viewMode !== 'first') drawPlayerModel();

    S.stats.cubes = opaque.n + trans.n;
  }

  /* ══════════════════════════════════════════════════
     绘制
     ══════════════════════════════════════════════════ */
  function bindAttributes(gl, inst, buffer, stride, divisors){
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const set = (name, size, offset, divisor) => {
      const loc = S.loc[name];
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      inst.vertexAttribDivisorANGLE(loc, divisor);
    };
    set('iPos', 3, 0, 1);
    set('iSize', 3, 12, 1);
    set('iRotY', 1, 24, 1);
    set('iRotX', 1, 28, 1);
    set('iUVtop', 2, 32, 1);
    set('iUVside', 2, 40, 1);
    set('iTint', 3, 48, 1);
    set('iLight', 1, 60, 1);
    set('iAlpha', 1, 64, 1);
    set('iEmiss', 1, 68, 1);
    set('iWave', 1, 72, 1);
  }

  function drawBatch(batch, transparent){
    if (!batch.n) return;
    const gl = S.gl, inst = S.inst;
    gl.bindBuffer(gl.ARRAY_BUFFER, S.buffers.vert);
    const pLoc = S.loc.aPos;
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 3, gl.FLOAT, false, 32, 0);
    inst.vertexAttribDivisorANGLE(pLoc, 0);
    const nLoc = S.loc.aNormal;
    gl.enableVertexAttribArray(nLoc);
    gl.vertexAttribPointer(nLoc, 3, gl.FLOAT, false, 32, 12);
    inst.vertexAttribDivisorANGLE(nLoc, 0);
    const uLoc = S.loc.aUV;
    gl.enableVertexAttribArray(uLoc);
    gl.vertexAttribPointer(uLoc, 2, gl.FLOAT, false, 32, 24);
    inst.vertexAttribDivisorANGLE(uLoc, 0);

    const buffer = transparent ? S.buffers.trans : S.buffers.opaque;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, batch.data.subarray(0, batch.n * FLOATS), gl.DYNAMIC_DRAW);
    bindAttributes(gl, inst, buffer, STRIDE, 1);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, S.buffers.index);
    if (transparent){
      gl.enable(gl.BLEND);
      gl.depthMask(false);
    }else{
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
    inst.drawElementsInstancedANGLE(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, batch.n);
    S.stats.draws++;
    if (transparent) gl.depthMask(true);
  }

  function render(){
    if (!S.ok && !createGL()) return false;
    try{
      resize();
      const gl = S.gl;
      S.time = now();
      S.groundCache.clear();
      if (!S.atlasComplete && S.atlasCv){
        S.atlasTries = (S.atlasTries || 0) + 1;
        if (paintAtlasTextures(S.atlasCv)) uploadAtlas(S.atlasCv);
        // 贴图迟迟没解码完时最多重试 3 秒，避免每帧重复上传图集
        if (S.atlasTries > 180) S.atlasComplete = true;
      }
      const camera = updateCamera();
      const palette = dayPalette();
      S.sun = palette.sunDir;
      const equip = gfx();
      buildScene(camera, palette);
      const lights = collectLights(palette);

      gl.viewport(0, 0, S.cv.width, S.cv.height);
      gl.clearColor(palette.sky[0], palette.sky[1], palette.sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(S.prog);

      const viewDist = clamp(equip.viewDistance || 28, 10, 48);
      const fogStrength = [0, 0.55, 1, 1.6][clamp(equip.fog === undefined ? 1 : equip.fog, 0, 3)];
      // 雾从「相机到玩家的距离」之外才开始，否则近处角色也会被雾吞掉
      const fogNear = Math.max(6, camera.dist * 0.92 + viewDist * 0.3);
      const fogFar = Math.max(fogNear + 6, camera.dist + viewDist + 6);
      const fogDensity = fogStrength / Math.max(4, fogFar - fogNear);
      const lightPos = new Float32Array(MAX_LIGHTS * 3);
      const lightPower = new Float32Array(MAX_LIGHTS);
      for (let i = 0; i < MAX_LIGHTS; i++){
        const light = lights[i];
        if (!light) continue;
        lightPos[i * 3] = light.x;
        lightPos[i * 3 + 1] = light.y;
        lightPos[i * 3 + 2] = light.z;
        lightPower[i] = light.power;
      }
      gl.uniformMatrix4fv(S.loc.uMVP, false, camera.vp);
      gl.uniform3f(S.loc.uCamPos, camera.eye[0], camera.eye[1], camera.eye[2]);
      const sun = palette.sunDir;
      gl.uniform3f(S.loc.uSunDir, sun[0], sun[1], sun[2]);
      gl.uniform3f(S.loc.uSunColor, palette.sun[0], palette.sun[1], palette.sun[2]);
      gl.uniform3f(S.loc.uAmbient, palette.ambient[0], palette.ambient[1], palette.ambient[2]);
      gl.uniform3fv(S.loc.uLightPos, lightPos);
      gl.uniform1fv(S.loc.uLightPower, lightPower);
      gl.uniform1f(S.loc.uLightCount, lights.length);
      gl.uniform1f(S.loc.uFogNear, fogNear);
      gl.uniform1f(S.loc.uFogDensity, fogDensity);
      gl.uniform3fv(S.loc.uFogColor, palette.fogColor);
      gl.uniform1f(S.loc.uTime, S.time);
      gl.uniform1f(S.loc.uAnim, equip.animatedWater ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, S.tex);
      gl.uniform1i(S.loc.uTex, 0);

      drawBatch(opaque, false);
      if (equip.water !== false) drawBatch(trans, true);
      S.stats.lights = lights.length;
      return true;
    }catch(error){
      console.error('[Pixel3D] 渲染失败，切回 2.5D', error);
      S.failed = true;
      S.ok = false;
      return false;
    }
  }

  /* ══════════════════════════════════════════════════
     投影 / 拾取
     ══════════════════════════════════════════════════ */
  function ensureCamera(){
    if (!S.cam) updateCamera();
    return S.cam;
  }

  function project(xPx, yPx, heightPx){
    const camera = ensureCamera();
    if (!camera) return { x:0, y:0, visible:false };
    const h = (heightPx === undefined ? 10 : heightPx) / TILE;
    const wx = xPx / TILE, wy = groundAt(xPx, yPx) + h, wz = yPx / TILE;
    const rx = wx - camera.eye[0], ry = wy - camera.eye[1], rz = wz - camera.eye[2];
    const depth = rx * camera.fwd[0] + ry * camera.fwd[1] + rz * camera.fwd[2];
    if (depth <= 0.05) return { x:-9999, y:-9999, visible:false };
    const right = rx * camera.right[0] + ry * camera.right[1] + rz * camera.right[2];
    const up = rx * camera.up[0] + ry * camera.up[1] + rz * camera.up[2];
    const tanHalf = Math.tan(CAM.fov / 2);
    const ndcX = right / (depth * tanHalf * (W / H));
    const ndcY = up / (depth * tanHalf);
    return {
      x: (ndcX * 0.5 + 0.5) * W,
      y: (1 - (ndcY * 0.5 + 0.5)) * H,
      visible: true,
    };
  }

  function pick(screenX, screenY){
    const camera = ensureCamera();
    const tanHalf = Math.tan(CAM.fov / 2);
    const ndcX = (screenX / W) * 2 - 1;
    const ndcY = 1 - (screenY / H) * 2;
    const dir = [
      camera.fwd[0] + camera.right[0] * ndcX * tanHalf * (W / H) + camera.up[0] * ndcY * tanHalf,
      camera.fwd[1] + camera.right[1] * ndcX * tanHalf * (W / H) + camera.up[1] * ndcY * tanHalf,
      camera.fwd[2] + camera.right[2] * ndcX * tanHalf * (W / H) + camera.up[2] * ndcY * tanHalf,
    ];
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    dir[0] /= len; dir[1] /= len; dir[2] /= len;
    const planeY = groundAt(player.x, player.y) + 0.02;
    if (Math.abs(dir[1]) < 0.0001) return { x:player.x, y:player.y };
    const t = (planeY - camera.eye[1]) / dir[1];
    if (t <= 0 || t > 200) return { x:player.x, y:player.y };
    const wx = camera.eye[0] + dir[0] * t;
    const wz = camera.eye[2] + dir[2] * t;
    return { x: wx * TILE, y: wz * TILE };
  }

  function aimPoint(screenX, screenY){
    const equip = gfx();
    if (!equip.aimAssist) return pick(screenX, screenY);
    let best = null, bestDist = 22;
    const test = (list) => {
      for (const object of list){
        const p = project(object.x, object.y, 12);
        if (!p.visible) continue;
        const d = Math.hypot(p.x - screenX, p.y - screenY);
        if (d < bestDist){ bestDist = d; best = object; }
      }
    };
    test(enemies);
    test(animals);
    if (best) return { x:best.x, y:best.y };
    return pick(screenX, screenY);
  }

  /* ══════════════════════════════════════════════════
     对外接口
     ══════════════════════════════════════════════════ */
  function available(){
    if (S.failed) return false;
    if (!S.tried) createGL();
    return S.ok;
  }

  function active(){
    // 先看设置，避免 2.5D 模式下无谓地创建 WebGL 上下文
    if (window.PixelGfx && PixelGfx.get().engine !== '3d') return false;
    return available();
  }

  function applyGfx(settings){
    S.gfx = settings;
    // 相机或分辨率变化后需要重建尺寸
    if (S.cv) resize();
  }

  function invalidate(){
    S.chunks.clear();
    S.warmedUp = false;
  }

  function orbitCamera(dx, dy){
    const turn = dx || 0;
    orbit.yaw = ((orbit.yaw + turn + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (viewMode === 'first'){
      orbit.pitch = clamp(orbit.pitch + (dy || 0), -0.42, 0.62);
    }else{
      const basePitch = cameraBase().pitch;
      orbit.pitch = clamp(orbit.pitch + (dy || 0), 0.08 - basePitch, 1.4 - basePitch);
    }
  }

  /* 第一人称：鼠标转动视角 */
  function lookBy(dx, dy){
    look.yaw -= (dx || 0) * 0.0026;
    look.pitch = clamp(look.pitch + (dy || 0) * 0.0022, -1.25, 1.2);
  }

  function setViewMode(mode){
    const next = mode === 'first' ? 'first' : 'third';
    if (next === viewMode) return viewMode;
    if (next === 'first'){
      const facing = (player && (player.aimX || player.aimY))
        ? Math.atan2(player.aimX, player.aimY)
        : (S.cam ? S.cam.yaw + Math.PI : Math.PI * 0.25);
      look.yaw = facing;
      look.pitch = 0.16;
      orbit.yaw = 0; orbit.pitch = 0;
    } else {
      orbit.pitch = 0;
    }
    viewMode = next;
    return viewMode;
  }

  function resetOrbit(){
    orbit.yaw = 0;
    orbit.pitch = 0;
    orbit.zoom = 1;
  }

  function zoom(delta){
    orbit.zoom = clamp(orbit.zoom * delta, 0.62, 1.7);
  }

  window.Pixel3D = {
    available,
    active,
    render,
    project,
    pick,
    aimPoint,
    applyGfx,
    resize,
    invalidate,
    orbitCamera,
    resetOrbit,
    zoom,
    look: lookBy,
    setViewMode,
    viewMode(){ return viewMode; },
    firstPerson(){ return viewMode === 'first' && active(); },
    lookState(){ return { ...look }; },
    cameraYaw(){
      if (viewMode === 'first') return look.yaw + orbit.yaw + Math.PI;
      return (S.cam ? S.cam.yaw : cameraBase().yaw + orbit.yaw);
    },
    cameraPitch(){ return (S.cam ? S.cam.pitch : cameraBase().pitch); },
    orbitState(){ return { ...orbit }; },
    canvas(){ return S.cv; },
    atlas(){ return S.atlasCv; },
    stats(){ return { ...S.stats }; },
    _debug: S,
  };
})();
