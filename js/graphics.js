'use strict';

/* ══════════════════════════════════════════════════════════
   画面 / 性能设置（PixelGfx）
   - 统一的画质预设、分辨率、渲染距离、光照、粒子、FPS 上限
   - 3D 体素引擎 / 2.5D 像素引擎 切换
   - 低帧率时自动降质（可关闭）
   设置保存在 localStorage，与音画设置分开存储。
   ══════════════════════════════════════════════════════════ */

const GFX_KEY = 'pixel-survival-graphics';

const GFX_PRESETS = {
  fast: {
    id:'fast', label:'流畅', detail:'低分辨率 · 近距渲染 · 关闭动态光照',
    resolution:2, viewDistance:14, lighting:false, shadows:false,
    water:true, particles:0.4, fog:3, animatedWater:false,
  },
  balanced: {
    id:'balanced', label:'均衡', detail:'标准分辨率 · 中等视距 · 简易光照',
    resolution:2, viewDistance:22, lighting:true, shadows:false,
    water:true, particles:1, fog:2, animatedWater:true,
  },
  high: {
    id:'high', label:'高清', detail:'高分辨率 · 较远视距 · 火把光照与阴影',
    resolution:3, viewDistance:30, lighting:true, shadows:true,
    water:true, particles:1.4, fog:1, animatedWater:true,
  },
  ultra: {
    id:'ultra', label:'极致', detail:'全分辨率 · 最远视距 · 完整光照与水面',
    resolution:4, viewDistance:40, lighting:true, shadows:true,
    water:true, particles:2, fog:0, animatedWater:true,
  },
};

const GFX_DEFAULTS = Object.freeze({
  version: 1,
  engine: '3d',
  preset: 'high',
  resolution: 3,
  viewDistance: 30,
  lighting: true,
  shadows: true,
  water: true,
  particles: 1.4,
  fog: 1,
  animatedWater: true,
  fpsCap: 0,
  autoTune: true,
  aimAssist: true,
  camera: 'iso',
  view: 'third',
});

const GFX_FPS_CAPS = [0, 30, 60, 120, 144];

const GFX_CAMERAS = [
  { id:'iso',   name:'等距 45°', yaw:Math.PI * 0.25, pitch:0.72, distance:6.6 },
  { id:'front', name:'正面',     yaw:0,              pitch:0.72, distance:6.4 },
  { id:'side',  name:'侧面',     yaw:Math.PI * 0.5,  pitch:0.72, distance:6.4 },
  { id:'top',   name:'俯视',     yaw:Math.PI * 0.25, pitch:1.05, distance:7 },
];

function gfxNumber(value, min, max, fallback){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.round(n), min, max);
}

const PixelGfx = (function(){
  let state = { ...GFX_DEFAULTS };
  let lastAutoCheck = 0;
  let slowSeconds = 0;
  let fpsSamples = 0;
  let autoNoticed = false;

  function load(){
    let saved = null;
    try{
      saved = JSON.parse(localStorage.getItem(GFX_KEY) || 'null');
    }catch(error){
      console.warn('[Pixel Survival] 画面设置无法读取，使用默认值', error);
    }
    if (!saved || typeof saved !== 'object') return;
    state.engine = saved.engine === '2d' ? '2d' : '3d';
    state.preset = Object.prototype.hasOwnProperty.call(GFX_PRESETS, saved.preset) ? saved.preset : state.preset;
    state.resolution = gfxNumber(saved.resolution, 2, 8, state.resolution);
    state.viewDistance = gfxNumber(saved.viewDistance, 10, 48, state.viewDistance);
    state.lighting = saved.lighting !== false;
    state.shadows = saved.shadows !== false;
    state.water = saved.water !== false;
    state.particles = Number.isFinite(saved.particles) ? clamp(saved.particles, 0, 2) : state.particles;
    state.fog = gfxNumber(saved.fog, 0, 3, state.fog);
    state.animatedWater = saved.animatedWater !== false;
    state.fpsCap = GFX_FPS_CAPS.includes(Number(saved.fpsCap)) ? Number(saved.fpsCap) : 0;
    state.autoTune = saved.autoTune === true;
    state.aimAssist = saved.aimAssist !== false;
    state.camera = GFX_CAMERAS.some(camera => camera.id === saved.camera) ? saved.camera : 'iso';
    state.view = saved.view === 'first' ? 'first' : 'third';
  }

  function persist(){
    try{
      localStorage.setItem(GFX_KEY, JSON.stringify(state));
    }catch(error){
      console.warn('[Pixel Survival] 画面设置保存失败', error);
    }
  }

  function applyLegacy(){
    // 旧音画设置里的画面质量 / 远景雾效保持同步，避免 Studio 面板显示不一致
    try{
      if (window.PixelSurvivalAudio && typeof PixelSurvivalAudio.setSettings === 'function'){
        const quality = clamp(state.resolution, 2, 8);
        const current = PixelSurvivalAudio.getSettings();
        if (state.resolution < 2){
          // 旧设置只接受 2~4，1× 分辨率时不回写，避免被抬回 2×
          if (current.fog !== state.fog) PixelSurvivalAudio.setSettings({ fog: state.fog });
        }else if (current.quality !== quality || current.fog !== state.fog){
          PixelSurvivalAudio.setSettings({ quality, fog: state.fog });
        }
      }
    }catch(error){
      /* 音画设置不可用时忽略 */
    }
  }

  function apply(){
    // 没有 3D 渲染时第一人称没有意义：自动回到第三人称，避免鼠标被锁在屏幕中心
    if (state.view === 'first' && !(available3D() && state.engine === '3d')){
      state = { ...state, view: 'third' };
      persist();
    }
    if (typeof setRenderQuality === 'function') setRenderQuality(state.resolution);
    if (window.Pixel3D){
      if (typeof Pixel3D.applyGfx === 'function') Pixel3D.applyGfx(state);
      if (typeof Pixel3D.setViewMode === 'function') Pixel3D.setViewMode(state.view);
      if (typeof Pixel3D.resize === 'function') Pixel3D.resize();
    }
    applyLegacy();
  }

  function validate(patch){
    const next = { ...state };
    for (const [key, value] of Object.entries(patch)){
      switch (key){
        case 'engine':
          if (value !== '3d' && value !== '2d') throw new Error('渲染引擎只能是 3D 或 2.5D');
          next.engine = value; break;
        case 'preset':
          if (!Object.prototype.hasOwnProperty.call(GFX_PRESETS, value)) throw new Error('未知画质预设');
          next.preset = value; break;
        case 'resolution':
          next.resolution = gfxNumber(value, 2, 8, state.resolution); break;
        case 'viewDistance':
          next.viewDistance = gfxNumber(value, 10, 48, state.viewDistance); break;
        case 'fog':
          next.fog = gfxNumber(value, 0, 3, state.fog); break;
        case 'fpsCap':
          if (!GFX_FPS_CAPS.includes(Number(value))) throw new Error('FPS 上限无效');
          next.fpsCap = Number(value); break;
        case 'particles':
          if (!Number.isFinite(value)) throw new Error('粒子密度无效');
          next.particles = clamp(value, 0, 2); break;
        case 'lighting': case 'shadows': case 'water': case 'animatedWater':
        case 'autoTune': case 'aimAssist':
          if (typeof value !== 'boolean') throw new Error(key + ' 必须是开关');
          next[key] = value; break;
        case 'camera':
          if (!GFX_CAMERAS.some(camera => camera.id === value)) throw new Error('未知视角');
          next.camera = value; break;
        case 'view':
          if (value !== 'first' && value !== 'third') throw new Error('视角只支持第一人称 / 第三人称');
          next.view = value; break;
        default:
          throw new Error('未知画面设置：' + key);
      }
    }
    return next;
  }

  function set(patch, options){
    const previous = state;
    const next = validate(patch);
    state = next;
    persist();
    apply();
    if (options && options.toast && typeof showToast === 'function'){
      showToast(options.toast, options.color || '#a8e0ff');
    }
    // 手动改动分辨率后重新开始统计，避免自动优化马上又改回去
    if (previous.resolution !== next.resolution || previous.viewDistance !== next.viewDistance){
      slowSeconds = 0;
    }
    return { ...state };
  }

  function usePreset(id, silent){
    const preset = GFX_PRESETS[id];
    if (!preset) throw new Error('未知画质预设');
    state = validate({
      preset: id,
      resolution: preset.resolution,
      viewDistance: preset.viewDistance,
      lighting: preset.lighting,
      shadows: preset.shadows,
      water: preset.water,
      particles: preset.particles,
      fog: preset.fog,
      animatedWater: preset.animatedWater,
    });
    persist();
    apply();
    if (!silent && typeof showToast === 'function'){
      showToast('画质：' + preset.label + ' · ' + preset.detail, '#a8e0ff');
    }
    return { ...state };
  }

  function available3D(){
    return !!(window.Pixel3D && typeof Pixel3D.available === 'function' && Pixel3D.available());
  }

  function is3D(){
    return state.engine === '3d' && available3D();
  }

  function toggleEngine(){
    if (!available3D()){
      if (typeof showToast === 'function') showToast('当前浏览器不支持 WebGL 3D 渲染，已保持 2.5D 像素模式', '#ffb080');
      if (state.engine !== '2d'){ state = { ...state, engine:'2d' }; persist(); apply(); }
      return state.engine;
    }
    return set({ engine: is3D() ? '2d' : '3d' }, {
      toast: is3D() ? '已切换到 2.5D 像素渲染' : '已切换到 3D 体素渲染',
    }).engine;
  }

  function particleFactor(){ return clamp(state.particles, 0, 2); }

  function scaleParticles(count){
    if (!Number.isFinite(count) || count <= 0) return 0;
    return Math.max(1, Math.round(count * particleFactor()));
  }

  /* 帧率统计与自动降质 */
  function noteFrame(dt, now){
    if (!state.autoTune || !Number.isFinite(dt) || dt <= 0 || dt > 0.5) return;
    const fps = 1 / dt;
    fpsSamples++;
    if (fps < 38){
      slowSeconds += dt;
    }else if (fps > 52){
      slowSeconds = Math.max(0, slowSeconds - dt * 0.6);
    }
    if (now - lastAutoCheck < 1500) return;
    lastAutoCheck = now;
    if (slowSeconds < 3.5) return;
    slowSeconds = 0;
    const before = { ...state };
    if (state.resolution > 1){
      state = { ...state, resolution: state.resolution - 1 };
    }else if (state.viewDistance > 16){
      state = { ...state, viewDistance: state.viewDistance - 6 };
    }else if (state.shadows){
      state = { ...state, shadows: false };
    }else if (state.lighting){
      state = { ...state, lighting: false };
    }else if (state.animatedWater){
      state = { ...state, animatedWater: false };
    }else if (state.engine === '3d' && available3D()){
      state = { ...state, engine: '2d' };
    }else{
      return;
    }
    persist();
    apply();
    if (!autoNoticed && typeof showToast === 'function'){
      autoNoticed = true;
      showToast('检测到帧率偏低，已自动降低画质（可在画面设置中关闭自动优化）', '#ffd280');
    }
    console.info('[Pixel Survival] 自动降低画质', before, '→', state);
  }

  function cameraConfig(){
    return GFX_CAMERAS.find(camera => camera.id === state.camera) || GFX_CAMERAS[0];
  }

  function describe(){
    const engine = is3D() ? '3D 体素' : '2.5D 像素';
    const preset = (GFX_PRESETS[state.preset] || GFX_PRESETS.high).label;
    const view = state.view === 'first' ? '第一人称' : '第三人称';
    return engine + ' · ' + view + ' · ' + preset + ' · ' + state.resolution + '× 分辨率 · 视距 ' + state.viewDistance;
  }

  load();

  return {
    get: () => ({ ...state }),
    set,
    usePreset,
    apply,
    toggleEngine,
    available3D,
    is3D,
    particleFactor,
    scaleParticles,
    noteFrame,
    cameraConfig,
    describe,
    presets: GFX_PRESETS,
    cameras: GFX_CAMERAS,
    fpsCaps: GFX_FPS_CAPS,
    defaults: GFX_DEFAULTS,
    reset(){
      state = { ...GFX_DEFAULTS };
      persist();
      apply();
      return { ...state };
    },
    syncLegacy(patch){
      // 由旧音画设置（Studio）反推画质，避免两套数值互相覆盖
      if (!patch || typeof patch !== 'object') return;
      const next = { ...state };
      if (patch.quality !== undefined) next.resolution = gfxNumber(patch.quality, 1, 4, next.resolution);
      if (patch.fog !== undefined) next.fog = gfxNumber(patch.fog, 0, 3, next.fog);
      if (next.resolution === state.resolution && next.fog === state.fog) return;
      state = next;
      persist();
      apply();
    },
  };
})();

window.PixelGfx = PixelGfx;
// 启动时立即应用一次（此后音画设置加载时也会调用 PixelGfx.apply 保持同步）
try{ PixelGfx.apply(); }catch(error){ console.warn('[Pixel Survival] 初始画面设置应用失败', error); }
