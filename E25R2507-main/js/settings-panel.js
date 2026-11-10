'use strict';

/* ══════════════════════════════════════════════════════════
   画面与性能设置面板（L 键 / 暂停菜单 / 主菜单进入）
   ══════════════════════════════════════════════════════════ */
let settingsReturnPanel = 'pause';

function openSettingsPanel(returnPanel){
  clearInput();
  settingsReturnPanel = returnPanel || (panel && panel !== 'settings' ? panel : 'pause');
  panel = 'settings';
}

function closeSettingsPanel(){
  panel = settingsReturnPanel || 'pause';
  if (panel === 'settings') panel = 'pause';
}

function drawSettingsPanel(){
  drawMcBackdrop(0.64);
  const PW=444, PH=250, px=(W-PW)/2, py=(H-PH)/2;
  uiPanel(px-3, py-3, PW+6, PH+6, {});
  uiPanel(px, py, PW, PH, { title:'画面与性能 · 渲染引擎' });
  txt('L / ESC 关闭', px+PW-10, py+10, { size:7, bold:true, color:'#404040', align:'right' });

  const gfx = (window.PixelGfx ? PixelGfx.get() : null);
  if (!gfx){
    txt('画面设置模块未加载', px+16, py+40, { size:8, bold:true, color:'#b0563c' });
    return;
  }
  const threeDSupported = PixelGfx.available3D();
  const colA = px+12, colB = px+232, colW = 200;

  const section = (x, y, label) => {
    txt(label, x, y, { size:7, bold:true, color:'#555555' });
    R(x, y+10, colW, 1, PAL.creamShade);
    R(x, y+11, colW, 1, 'rgba(255,255,255,0.4)');
  };
  const optionButton = (x, y, w, label, active, fn, disabled) => {
    uiButton(x, y, w, 14, label, { kind: active ? 'green' : 'wood', size:6, disabled: !!disabled });
    if (!disabled) uiButtons.push({ x, y, w, h:14, fn });
  };
  const stepRow = (x, y, label, value, onMinus, onPlus, canMinus, canPlus) => {
    txt(label+'：'+value, x, y+3, { size:7, bold:true, color:PAL.ink });
    const bx = x+colW-32;
    uiButton(bx, y, 14, 13, '－', { kind:'wood', size:7, disabled:!canMinus });
    if (canMinus) uiButtons.push({ x:bx, y, w:14, h:13, fn:onMinus });
    uiButton(bx+17, y, 14, 13, '＋', { kind:'wood', size:7, disabled:!canPlus });
    if (canPlus) uiButtons.push({ x:bx+17, y, w:14, h:13, fn:onPlus });
  };
  const toggleRow = (x, y, label, on, fn) => {
    txt(label, x, y+3, { size:7, bold:true, color:PAL.ink });
    const bx = x+colW-40;
    uiButton(bx, y, 40, 14, on?'开启':'关闭', { kind:on?'green':'wood', size:6 });
    uiButtons.push({ x:bx, y, w:40, h:14, fn });
  };

  /* ── 左列 ── */
  let y = py+22;
  section(colA, y, '渲染引擎');
  optionButton(colA, y+14, 95, '3D 像素（WebGL）', gfx.engine==='3d' && threeDSupported, () => {
    PixelGfx.set({ engine:'3d' }, { toast:'已切换到 3D 像素渲染' });
  }, !threeDSupported);
  optionButton(colA+101, y+14, 99, '2.5D 像素（Canvas）', gfx.engine==='2d' || !threeDSupported, () => {
    PixelGfx.set({ engine:'2d' }, { toast:'已切换到 2.5D 像素渲染' });
  });
  if (!threeDSupported){
    txt('当前浏览器不支持 WebGL 实例化，已固定为 2.5D', colA, y+31, { size:6, bold:true, color:'#b0563c' });
  }

  y = py+58;
  section(colA, y, '画质预设');
  const presetIds = ['fast','balanced','high','ultra'];
  presetIds.forEach((id, index) => {
    const preset = GFX_PRESETS[id];
    optionButton(colA + index*50, y+14, 46, preset.label, gfx.preset === id, () => PixelGfx.usePreset(id));
  });

  y = py+94;
  section(colA, y, '观察视角');
  GFX_CAMERAS.forEach((camera, index) => {
    optionButton(colA + index*50, y+14, 46, camera.name, gfx.camera === camera.id, () => {
      PixelGfx.set({ camera: camera.id });
      if (window.Pixel3D) Pixel3D.resetOrbit();
    });
  });

  y = py+130;
  section(colA, y, '分辨率 / 视距 / 粒子 / 帧率');
  stepRow(colA, y+14, '分辨率', gfx.resolution+'×', () => PixelGfx.set({ resolution:gfx.resolution-1 }),
    () => PixelGfx.set({ resolution:gfx.resolution+1 }), gfx.resolution > 1, gfx.resolution < 4);
  stepRow(colA, y+32, '渲染距离', gfx.viewDistance+' 格', () => PixelGfx.set({ viewDistance:gfx.viewDistance-4 }),
    () => PixelGfx.set({ viewDistance:gfx.viewDistance+4 }), gfx.viewDistance > 10, gfx.viewDistance < 48);
  stepRow(colA, y+50, '粒子密度', Math.round(gfx.particles*100)+'%', () => PixelGfx.set({ particles:gfx.particles-0.2 }),
    () => PixelGfx.set({ particles:gfx.particles+0.2 }), gfx.particles > 0, gfx.particles < 2);
  const caps = GFX_FPS_CAPS;
  const capIndex = caps.indexOf(gfx.fpsCap);
  stepRow(colA, y+68, 'FPS 上限', gfx.fpsCap ? gfx.fpsCap+' 帧' : '不限', () => PixelGfx.set({ fpsCap:caps[Math.max(0,capIndex-1)] }),
    () => PixelGfx.set({ fpsCap:caps[Math.min(caps.length-1,capIndex+1)] }), capIndex > 0, capIndex < caps.length-1);

  /* ── 右列 ── */
  y = py+22;
  section(colB, y, '光照 / 阴影 / 水面 / 雾');
  toggleRow(colB, y+14, '动态光照（火把点光源）', gfx.lighting, () => PixelGfx.set({ lighting:!gfx.lighting }));
  toggleRow(colB, y+32, '接触阴影', gfx.shadows, () => PixelGfx.set({ shadows:!gfx.shadows }));
  toggleRow(colB, y+50, '水面动画', gfx.animatedWater, () => PixelGfx.set({ animatedWater:!gfx.animatedWater }));
  toggleRow(colB, y+68, '水体渲染', gfx.water, () => PixelGfx.set({ water:!gfx.water }));
  stepRow(colB, y+86, '远景雾', ['关闭','轻雾','中雾','浓雾'][gfx.fog]||'轻雾',
    () => PixelGfx.set({ fog:gfx.fog-1 }), () => PixelGfx.set({ fog:gfx.fog+1 }), gfx.fog > 0, gfx.fog < 3);

  y = py+134;
  section(colB, y, '辅助与优化');
  toggleRow(colB, y+14, '帧率不足自动降质', gfx.autoTune, () => PixelGfx.set({ autoTune:!gfx.autoTune }));
  toggleRow(colB, y+32, '瞄准吸附（3D）', gfx.aimAssist, () => PixelGfx.set({ aimAssist:!gfx.aimAssist }));
  toggleRow(colB, y+50, '第一人称（F5 切换）', gfx.view === 'first', () => {
    if (!PixelGfx.available3D()){
      showToast('第一人称需要 3D 体素渲染', '#ffb080');
      return;
    }
    const turningOn = gfx.view !== 'first';
    PixelGfx.set({ view: turningOn ? 'first' : 'third' });
    if (turningOn){
      if (typeof requestFirstPersonLock === 'function') requestFirstPersonLock();
    }else if (document.exitPointerLock){
      document.exitPointerLock();
    }
  });
  txt('3D 第三人称：点击画面后鼠标转动视角 · 中键拖动旋转 · 空格跳跃', colB, y+68, { size:6, bold:true, color:'#555555' });
  const stats = window.Pixel3D && Pixel3D.stats ? Pixel3D.stats() : { cubes:0, chunks:0 };
  txt('FPS '+Math.round(fpsSmooth)+' · 方块 '+stats.cubes+' · 区块 '+stats.chunks,
    colB, y+80, { size:6, bold:true, color:'#3f3f3f' });

  /* ── 底部 ── */
  const by = py+PH-26;
  uiButton(px+12, by, 84, 16, '恢复默认设置', { kind:'red', size:6 });
  uiButtons.push({ x:px+12, y:by, w:84, h:16, fn:() => {
    PixelGfx.reset();
    if (window.Pixel3D) Pixel3D.resetOrbit();
    showToast('画面设置已恢复默认', '#a8e0ff');
  }});
  txt(PixelGfx.describe(), px+104, by+4, { size:6, bold:true, color:'#555555' });
  uiButton(px+PW-72, by, 60, 16, '完成', { kind:'green', size:7 });
  uiButtons.push({ x:px+PW-72, y:by, w:60, h:16, fn:closeSettingsPanel });
}
