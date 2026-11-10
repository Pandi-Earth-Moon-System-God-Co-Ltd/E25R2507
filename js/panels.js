'use strict';

function drawMainMenu(){
  R(0,0,W,H,'#172a2a');
  for(let i=0;i<36;i++){
    const x=(i*83+19)%W,y=(i*47+11)%126;
    R(x,y,2,2,i%3?'#b8c89c':'#f1dfaa');
  }
  ctx.fillStyle='#283c38';ctx.beginPath();
  ctx.moveTo(0,137);ctx.lineTo(58,91);ctx.lineTo(92,119);ctx.lineTo(146,73);
  ctx.lineTo(206,131);ctx.lineTo(264,85);ctx.lineTo(324,133);ctx.lineTo(390,91);
  ctx.lineTo(480,139);ctx.lineTo(480,270);ctx.lineTo(0,270);ctx.closePath();ctx.fill();
  ctx.fillStyle='#355344';ctx.beginPath();
  ctx.moveTo(0,169);ctx.lineTo(74,126);ctx.lineTo(127,165);ctx.lineTo(196,117);
  ctx.lineTo(265,173);ctx.lineTo(342,128);ctx.lineTo(411,169);ctx.lineTo(480,134);
  ctx.lineTo(480,270);ctx.lineTo(0,270);ctx.closePath();ctx.fill();
  R(0,197,W,73,'#263f35');
  ctx.fillStyle='#416d68';ctx.beginPath();ctx.moveTo(0,225);ctx.lineTo(158,202);
  ctx.lineTo(260,220);ctx.lineTo(368,198);ctx.lineTo(480,215);ctx.lineTo(480,270);
  ctx.lineTo(0,270);ctx.closePath();ctx.fill();
  for(let i=0;i<24;i++){
    const x=(i*67+11)%W,y=173+(i*29)%92;
    R(x,y,3,7+i%4*2,i%2?'#172b27':'#1c322b');
    R(x-2,y-5,7,8,i%3?'#203a30':'#304c38');
  }
  R(34,35,3,3,'#e7d99d');R(39,35,3,3,'#e7d99d');R(34,40,3,3,'#e7d99d');
  R(220,0,1,H,'rgba(239,221,167,0.18)');
  txt('像 素',40,70,{size:27,bold:true,color:'#f0e2b8'});
  txt('生 存',40,101,{size:27,bold:true,color:'#b7d29a'});
  R(40,143,125,2,'#d7bd7d');
  txt('PIXEL SURVIVAL',42,153,{size:8,bold:true,color:'#e6d4a9'});
  txt(gameLanguage==='en'?'Build · Explore · Survive':gameLanguage==='ja'?'建築 · 探索 · 生存':'建造 · 探索 · 生存',42,171,
    {size:7,bold:true,color:'#c6d0b1'});
  txt(gameLanguage==='en'?'A new world is waiting.':gameLanguage==='ja'?'新しい世界が待っています。':'新的世界正在等待你。',42,187,
    {size:6,color:'#aebda9'});

  const x=246,y=20,width=216,height=230;
  uiPanel(x-3,y-3,width+6,234,{});
  uiPanel(x,y,width,228,{});
  txt(gameLanguage==='en'?'MAIN MENU':gameLanguage==='ja'?'メインメニュー':'主 菜 单',x+width/2,y+11,
    {size:10,bold:true,color:'#3f3f3f',align:'center'});
  R(x+12,y+29,width-24,1,'#8b8b8b');
  R(x+12,y+30,width-24,1,'rgba(255,255,255,0.55)');
  const buttonX=x+20,buttonWidth=176,buttonHeight=18,gap=4;
  const menuItems=[
    [titleMenuHasSave?menuText('继续旅程','Continue Journey','旅を続ける'):menuText('开始生存','Start Survival','サバイバル開始'),
      'green',()=>{if(titleMenuHasSave){panel=null;clearInput();}else startNewGameFromMenu();}],
    [menuText('开启新世界','New World','新しい世界'),'wood',startNewGameFromMenu],
    [menuText('存档 / 读档','Saves / Load','セーブ / ロード'),'blue',()=>openSavePanel('title')],
    [menuText('帮助中心','Help','ヘルプ'),'wood',()=>openGuidePanel('title')],
    [menuText('创作中心','Game Studio','ゲームスタジオ'),'gold',openGameStudio],
    [menuText('画面与性能','Video & Performance','画質と性能'),'blue',()=>openSettingsPanel('title')],
    [menuText('语言 / Language: ','Language: ','言語: ')+(gameLanguage==='zh-CN'?'简体中文':gameLanguage==='ja'?'日本語':'English'),
      'blue',toggleGameLanguage],
  ];
  menuItems.forEach(([label,kind,action],index)=>{
    const buttonY=y+37+index*(buttonHeight+gap);
    uiButton(buttonX,buttonY,buttonWidth,buttonHeight,label,{kind});
    uiButtons.push({x:buttonX,y:buttonY,w:buttonWidth,h:buttonHeight,fn:action});
  });
  R(x+12,y+196,width-24,1,'#8b8b8b');
  txt(gameLanguage==='en'?'Local saves · No account required':gameLanguage==='ja'?'ローカルセーブ · アカウント不要':'本地存档 · 无需联网',x+width/2,y+204,
    {size:6,color:'#555555',align:'center'});
}

function menuText(chinese,english,japanese){
  return gameLanguage==='en'?english:gameLanguage==='ja'?localizeGameText(japanese||chinese):chinese;
}
function toggleGameLanguage(){
  const next=gameLanguage==='zh-CN'?'en':gameLanguage==='en'?'ja':'zh-CN';
  try{
    localStorage.setItem('pixel-survival-language',next);
    gameLanguage=next;
    updateDocumentLanguage();
    showToast(menuText('语言已切换','Language changed','言語を切り替えました'),'#a8efb2');
  }catch(error){
    console.error('[Pixel Survival] 无法保存语言设置',error);
    showToast('语言设置保存失败：'+error.message,'#ff9090');
  }
}
function openSavePanel(returnPanel){
  savePanelReturn=returnPanel;
  panel='saves';
}
function openGuidePanel(returnPanel){
  guideReturnPanel=returnPanel;
  guidePage=0;
  panel='guide';
}
function loadSaveFromPanel(slot){
  if(!hasSavedGame(slot)){showToast(menuText('这个存档槽是空的','This save slot is empty','このセーブスロットは空です'),'#ffb080');return;}
  if(!window.confirm(menuText('读取存档？当前未保存的进度会被替换。','Load this save? Unsaved progress will be replaced.','このセーブを読み込みますか？未保存の進行状況は失われます。')))return;
  if(!loadGame(slot))return;
  titleMenuHasSave=hasSavedGame(0);
  panel=savePanelReturn==='title'?null:'pause';
  clearInput();
}

function startNewGameFromMenu(){
  let hasSavedGame=false;
  try{hasSavedGame=Boolean(localStorage.getItem(SAVE_KEY));}
  catch(error){
    console.error('[Pixel Survival] 无法检查本地存档',error);
    showToast(menuText('无法检查存档状态：','Could not check save status:','セーブ状態を確認できません: ')+error.message,'#ff9090');
    return;
  }
  if(hasSavedGame&&!window.confirm(menuText('开启新世界会覆盖当前自动存档，确定继续吗？',
    'Starting a new world will overwrite the current auto-save. Continue?',
    '新しい世界を始めると現在の自動セーブが上書きされます。続行しますか？')))return;
  protectedSaveKeys.delete(SAVE_KEY);
  reset();
  titleMenuHasSave=saveGame();
  panel=null;
}

/* ══════════════════════════════════════════════════════════
   暂停面板
   ══════════════════════════════════════════════════════════ */
function drawPausePanel(){
  drawMcBackdrop(0.6);
  const PW=260, PH=250, px=(W-PW)/2, py=(H-PH)/2;
  uiPanel(px-3, py-3, PW+6, PH+6, {});
  uiPanel(px, py, PW, PH, { title:'暂 停' });
  const rows=[
    ['存活天数', G.day+' 天'],
    ['击杀僵尸', G.kills+' 只'],
    ['累计收集', G.gathered+' 个'],
    ['饱食 / 口渴', Math.round(player.hunger)+' / '+Math.round(player.thirst)],
    ['当前装备', (player.weapon?ITEMS[player.weapon].name:'徒手')+' · '+(player.armorId?ITEMS[player.armorId].name:'无甲')],
  ];
  let ry=py+42;
  for (const [k, v] of rows){
    txt(k, px+24, ry, { size:8, bold:true, color:'#555555' });
    txt(v, px+PW-24, ry, { size:8, bold:true, color:PAL.ink, align:'right' });
    ry+=15;
  }
  const cbx=W/2-48, cby=py+116;
  uiButton(cbx, cby, 96, 14, '人物外观  O', { kind:'blue' });
  uiButtons.push({x:cbx, y:cby, w:96, h:14, fn:() => { characterReturnPanel='pause'; panel='character'; }});

  const studioX=W/2-55,studioY=py+136;
  uiButton(studioX,studioY,110,15,'创作工坊  F2',{kind:'gold'});
  uiButtons.push({x:studioX,y:studioY,w:110,h:15,fn:openGameStudio});

  const bw=92, bh=22, gap=12;
  const bx1=W/2-bw-gap/2, bx2=W/2+gap/2, by=py+PH-34;
  uiButton(bx1, by, bw, bh, '继续游戏', { kind:'green' });
  uiButtons.push({ x:bx1, y:by, w:bw, h:bh, fn:() => { panel=null; if(typeof syncPointerLock==='function')syncPointerLock(); } });
  uiButton(bx2, by, bw, bh, '重新开始', { kind:'red' });
  uiButtons.push({ x:bx2, y:by, w:bw, h:bh, fn:() => requestRestart() });

  txt('自动保存 · K 快速保存 · 本地存档不会上传', W/2, py+PH-48, { size:7, bold:true, color:'#8a7a5a', align:'center' });
  const sbx=W/2-88, sby=py+PH-90;
  uiButton(sbx, sby, 84, 16, '存档管理 / 读取', { kind:'wood' });
  uiButtons.push({x:sbx,y:sby,w:84,h:16,fn:()=>openSavePanel('pause')});
  uiButton(sbx+90, sby, 84, 16, '画面设置  L', { kind:'blue' });
  uiButtons.push({x:sbx+90,y:sby,w:84,h:16,fn:()=>openSettingsPanel('pause')});
  const menuX=W/2-45,menuY=py+PH-69;
  uiButton(menuX,menuY,90,16,'返回主菜单',{kind:'blue'});
  uiButtons.push({x:menuX,y:menuY,w:90,h:16,fn:()=>{
    if(saveGame()){titleMenuHasSave=true;panel='title';}
  }});
}

function drawCharacterPanel(){
  drawMcBackdrop(0.62);
  const x=24, y=18, w=432, h=234;
  uiPanel(x-3, y-3, w+6, h+6, {});
  uiPanel(x, y, w, h, { title:'人物外观', fill:PAL.paper });
  txt('仅更改外观，不影响属性或装备', x+12, y+26, { size:7, bold:true, color:'#7a6a4e' });

  uiPanel(x+12, y+42, 126, 152, { fill:'#33423b', woodMid:'#5c6a55' });
  txt('角色预览', x+75, y+52, { size:7, bold:true, color:'#ddedcf', align:'center' });
  const livePlayer=player;
  ctx.save();
  try{
    ctx.translate(4,4); ctx.scale(1.55,1.55);
    player={...livePlayer,x:0,y:0,swing:0,walkPhase:0,invuln:0};
    drawPlayer(73,98);
  }finally{
    player=livePlayer; ctx.restore();
  }
  txt((player.weapon?ITEMS[player.weapon].name:'徒手')+' · '+(player.armorId?ITEMS[player.armorId].name:'无甲'), x+75, y+176, { size:6, bold:true, color:'#aebfb9', align:'center' });

  const rows=[
    ['skin','肤色',PLAYER_CUSTOMIZATION.skin.map(option=>option.name)],
    ['hairStyle','发型',PLAYER_CUSTOMIZATION.hairStyle],
    ['hairColor','发色',PLAYER_CUSTOMIZATION.hairColor.map(option=>option.name)],
    ['outfit','服装',PLAYER_CUSTOMIZATION.outfit.map(option=>option.name)],
    ['outfitStyle','服装款式',PLAYER_CUSTOMIZATION.outfitStyle],
    ['eyes','眼睛',PLAYER_CUSTOMIZATION.eyes.map(option=>option.name)],
    ['faceDetail','面部细节',PLAYER_CUSTOMIZATION.faceDetail],
    ['hat','头饰',PLAYER_CUSTOMIZATION.hat],
    ['back','背饰',PLAYER_CUSTOMIZATION.back],
  ];
  rows.forEach(([key,label,options], index)=>{
    const rowY=y+48+index*16;
    const current=player.appearance[key];
    txt(label, x+154, rowY+4, { size:7, bold:true, color:'#3f3f3f' });
    const bx=x+w-133;
    uiButton(bx, rowY, 14, 14, '‹', { kind:'wood', size:8 });
    uiButton(bx+84, rowY, 14, 14, '›', { kind:'wood', size:8 });
    txt(options[current], bx+49, rowY+4, { size:7, bold:true, color:'#3c2b1a', align:'center' });
    uiButtons.push({x:bx, y:rowY, w:14, h:14, fn:() => cyclePlayerAppearance(key,-1,options.length)});
    uiButtons.push({x:bx+84, y:rowY, w:14, h:14, fn:() => cyclePlayerAppearance(key,1,options.length)});
  });
  uiButton(x+w-78, y+h-24, 66, 15, '完成', { kind:'green' });
  uiButtons.push({x:x+w-78, y:y+h-24, w:66, h:15, fn:() => { panel=characterReturnPanel; characterReturnPanel=null; }});
  txt('O 打开人物外观 · Esc 返回', x+14, y+h-20, { size:6, bold:true, color:'#7a6a4e' });
}
function cyclePlayerAppearance(key,step,count){
  if(!player.appearance)player.appearance=newPlayerAppearance();
  player.appearance[key]=(player.appearance[key]+step+count)%count;
  saveGame(false);
}

function drawSavePanel(){
  drawMcBackdrop(0.62);
  const pw=370, ph=238, px=(W-pw)/2, py=(H-ph)/2;
  uiPanel(px-3, py-3, pw+6, ph+6, {});
  uiPanel(px, py, pw, ph, { title:menuText('本地存档管理','Save Management','セーブ管理') });
  txt(menuText('存档保存在当前浏览器；清理浏览器数据可能删除存档。',
    'Saves are stored in this browser and may be deleted when browser data is cleared.',
    'セーブデータはこのブラウザーに保存されます。ブラウザーデータを消去すると削除される場合があります。'),
    px+12, py+26, { size:7, bold:true, color:'#7a6a4e' });
  for(let i=1;i<=3;i++){
    const y=py+44+(i-1)*35, key=SAVE_KEY+'-slot-'+i; let meta=menuText('空槽','Empty','空きスロット');
    try{
      const d=JSON.parse(localStorage.getItem(key)||'null');
      if(d&&d.savedAt)meta=menuText('已有存档 · ','Saved · ','保存済み · ')+
        new Date(d.savedAt).toLocaleString(gameLanguage==='en'?'en-US':gameLanguage==='ja'?'ja-JP':'zh-CN');
    }catch(error){
      console.error('[Pixel Survival] 无法读取存档槽信息',error);
      meta=menuText('存档无法识别','Invalid save','無効なセーブデータ');
    }
    uiPanel(px+12, y, 346, 29, { fill:PAL.paper, woodMid:PAL.wood });
    txt(menuText('槽位 '+i,'Slot '+i,'スロット '+i), px+20, y+5, { size:8, bold:true, color:PAL.ink });
    txt(meta, px+67, y+7, { size:6, bold:true, color:'#7a6a4e' });
    const sx=px+164, lx=px+210, ex=px+256, ix=px+302;
    uiButton(sx, y+5, 42, 20, menuText('保存','Save','保存'), { kind:'green' });
    uiButtons.push({x:sx,y:y+5,w:42,h:20,fn:()=>{
      if(savePanelReturn==='title'&&!titleMenuHasSave){
        showToast(menuText('请先开始生存，再保存游戏','Start a game before saving','ゲームを開始してから保存してください'),'#ffb080');return;
      }
      saveGame(true,i);
    }});
    uiButton(lx,y+5,42,20,menuText('读取','Load','読込'),{kind:'blue'});
    uiButtons.push({x:lx,y:y+5,w:42,h:20,fn:()=>loadSaveFromPanel(i)});
    uiButton(ex,y+5,50,20,menuText('导出','Export','エクスポート'),{kind:'gold'});
    uiButtons.push({x:ex,y:y+5,w:50,h:20,fn:()=>exportSave(i)});
    uiButton(ix,y+5,42,20,menuText('导入','Import','インポート'),{kind:'blue'});
    uiButtons.push({x:ix,y:y+5,w:42,h:20,fn:()=>requestSaveImport(i)});
  }
  const iy=py+157;
  uiButton(px+12,iy,92,20,menuText('读取自动档','Load Auto','自動セーブ読込'),{kind:'green'});
  uiButtons.push({x:px+12,y:iy,w:92,h:20,fn:()=>loadSaveFromPanel(0)});
  uiButton(px+112,iy,92,20,menuText('导入自动档','Import Auto','自動セーブをインポート'),{kind:'blue'});
  uiButtons.push({x:px+112,y:iy,w:92,h:20,fn:()=>requestSaveImport(0)});
  uiButton(px+212,iy,92,20,menuText('导出自动档','Export Auto','自動セーブをエクスポート'),{kind:'gold'});
  uiButtons.push({x:px+212,y:iy,w:92,h:20,fn:()=>exportSave(0)});
  txt(menuText('可导入 / 导出备份','Backup files supported','バックアップ対応'),px+310,iy+7,
    {size:5,bold:true,color:'#7a6a4e'});
  const returnLabel=savePanelReturn==='title'?menuText('返回主菜单','Main Menu','メインメニューへ'):menuText('返回暂停','Back','戻る');
  uiButton(px+pw-84,py+ph-27,70,17,returnLabel,{kind:'wood'});
  uiButtons.push({x:px+pw-84,y:py+ph-27,w:70,h:17,fn:()=>{panel=savePanelReturn;}});
}

/* ══════════════════════════════════════════════════════════
   游戏结束
   ══════════════════════════════════════════════════════════ */
function drawGameOver(){
  ctx.fillStyle='rgba(18,10,6,0.84)';
  ctx.fillRect(0, 0, W, H);

  const title=G.victory?'远征完成':'你 死 了';
  const titleColor=G.victory?'#d9c8ff':'#d94040';
  txt(title, W/2+2, 62, { size:24, bold:true, color:G.victory?'#332b50':'#3a0a0a', align:'center' });
  txt(title, W/2, 60, { size:24, bold:true, color:titleColor, align:'center' });

  txt(G.victory?'—— 世界核心已恢复 ——':'—— 生存报告 ——', W/2, 96, { size:9, bold:true, color:'#e8dcc0', align:'center' });

  const lines=[
    ['存活天数', G.day+' 天'],
    ['击杀僵尸', G.kills+' 只'],
    ['收集资源', G.gathered+' 个'],
    ['最终装备', (player.weapon?ITEMS[player.weapon].name:'徒手')+' · '+(player.armorId?ITEMS[player.armorId].name:'无甲')],
  ];
  let ly=116;
  for (const [k, v] of lines){
    txt(k, W/2-8, ly, { size:10, bold:true, color:'#b0a888', align:'right' });
    txt(v, W/2+8, ly, { size:10, bold:true, color:'#f2ead2' });
    ly+=16;
  }

  const pulse=0.5+0.5*Math.sin(performance.now()/320);
  ctx.fillStyle='rgba(255,230,128,'+(0.4+pulse*0.6)+')';
  ctx.font='bold 9px '+UI_FONT;
  ctx.textAlign='center';
  ctx.fillText(localizeGameText(G.victory?'按 R 开始新的远征':'按 R 键重新开始'), W/2, 205);
  ctx.textAlign='left';
}
