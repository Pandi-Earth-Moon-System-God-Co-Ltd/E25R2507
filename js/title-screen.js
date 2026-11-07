'use strict';

/* ══════════════════════════════════════════════════════════
   主菜单 · 《我的世界》式标题画面（方案 A）
   真正的绘制函数是 panels.js 的 drawMainMenu()，这里在脚本
   末尾重新赋值覆盖；若发现缺少必要的面板函数，则自动回退到原版。
   ══════════════════════════════════════════════════════════ */
const __origMainMenu = typeof window !== 'undefined' ? window.drawMainMenu : null;

function drawMainMenuV2(){
  const canFull = typeof openSavePanel === 'function' && typeof toggleGameLanguage === 'function';
  if (!canFull && __origMainMenu){ __origMainMenu(); return; }

  // 背景：泥土底纹 + 暖色径向光 + 暗角
  drawMcBackdrop(0.6);
  const glow = ctx.createRadialGradient(W / 2, H * 0.34, 20, W / 2, H * 0.34, H * 1.05);
  glow.addColorStop(0, 'rgba(40,52,38,0.35)');
  glow.addColorStop(1, 'rgba(6,8,7,0.86)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 标题
  const titleY = Math.round(H * 0.17);
  ctx.textAlign = 'center';
  setFont(28, true);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText('像素生存', W / 2 + 2, titleY + 3);
  const grad = ctx.createLinearGradient(0, titleY - 24, 0, titleY + 10);
  grad.addColorStop(0, '#fff2c0');
  grad.addColorStop(1, '#d99b2e');
  ctx.fillStyle = grad;
  ctx.fillText('像素生存', W / 2, titleY);
  ctx.textAlign = 'left';
  const mt = typeof menuText === 'function' ? menuText : (zh) => zh;
  txt('PIXEL SURVIVAL · ' + mt('建造 · 探索 · 生存','Build · Explore · Survive','建築 · 探索 · 生存'), W / 2, titleY + 30,
    { size:6, bold:true, color:'#cfc39a', align:'center' });
  R(W / 2 - 62, titleY + 40, 124, 1, 'rgba(216,188,138,0.55)');

  // 竖排按钮（全部功能都保留）
  const items = [];
  if (typeof titleMenuHasSave !== 'undefined' && titleMenuHasSave){
    items.push([mt('继续旅程','Continue Journey','旅を続ける'), () => { panel = null; clearInput(); if (typeof syncPointerLock === 'function') syncPointerLock(); }]);
  } else {
    items.push([mt('开始生存','Start Survival','サバイバル開始'), () => startNewGameFromMenu()]);
  }
  items.push([mt('开启新世界','New World','新しい世界'), () => startNewGameFromMenu()]);
  items.push([mt('存档 / 读档','Saves / Load','セーブ / ロード'), () => openSavePanel('title')]);
  items.push([mt('帮助中心','Help','ヘルプ'), () => openGuidePanel('title')]);
  items.push([mt('创作工坊','Game Studio','ゲームスタジオ'), () => openGameStudio()]);
  items.push([mt('画面与性能','Video & Performance','画質と性能'), () => openSettingsPanel('title')]);
  const langLabel = mt('语言','Language','言語') + ': ' + (typeof gameLanguage !== 'undefined'
    ? (gameLanguage === 'zh-CN' ? '简体中文' : gameLanguage === 'ja' ? '日本語' : 'English')
    : '简体中文');
  items.push([langLabel, () => toggleGameLanguage()]);

  const bw = 172, bh = 17, gap = 4;
  const total = items.length * bh + (items.length - 1) * gap;
  let by = Math.round(H * 0.58 - total / 2);
  for (const [label, action] of items){
    const bx = Math.round((W - bw) / 2);
    uiButton(bx, by, bw, bh, label, { kind: (label === mt('开始生存','Start Survival','サバイバル開始') || label === mt('继续旅程','Continue Journey','旅を続ける')) ? 'green' : 'stone', size:8 });
    uiButtons.push({ x:bx, y:by, w:bw, h:bh, fn:action });
    by += bh + gap;
  }

  txt(mt('本地存档 · 无需联网 · 按 J 查看帮助','Local saves · Offline · Press J for help','ローカルセーブ · オフライン · J でヘルプ'), W / 2, H - 15, { size:6, bold:true, color:'#b8b09a', align:'center' });
  txt(mt('Minecraft 风格 UI · 2233 材质包','Minecraft-style UI · 2233 pack','Minecraft 風 UI · 2233 パック'), W / 2, H - 7, { size:5, bold:false, color:'#8a8578', align:'center' });
}

/* 关键：在脚本末尾覆盖全局函数（此时已捕获原版引用） */
if (typeof window !== 'undefined' && typeof window.drawMainMenu === 'function'){
  window.drawMainMenu = drawMainMenuV2;
}

/* ── 把自定义技能效果注册挂到 Mod API 上（本文件在 mod-api 之后加载） ── */
if (typeof window !== 'undefined' && window.PixelSurvivalModAPI && typeof registerSkillEffect === 'function'){
  window.PixelSurvivalModAPI.registerSkillEffect = registerSkillEffect;
  window.PixelSurvivalModAPI.skillEffects = function(){
    return typeof SKILL_EFFECTS !== 'undefined' ? SKILL_EFFECTS.slice() : [];
  };
}
