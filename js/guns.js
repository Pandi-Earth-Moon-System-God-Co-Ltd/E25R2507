'use strict';

/* ══════════════════════════════════════════════════════════
   主循环
   ══════════════════════════════════════════════════════════ */




/* 枪械、弹道与精简界面 */
function migrateGuns(s){
  if(s.version>=5)return;
  // 升级已有存档时补发一套枪械，只执行一次。
  if(!s.inv.pistol){
    s.inv.pistol=1;
    if(!s.inventoryOrder.includes('pistol'))s.inventoryOrder.push('pistol');
    const slot=s.hotbar.indexOf(null);if(slot>=0)s.hotbar[slot]='pistol';
  }
  s.inv.ammo=(s.inv.ammo||0)+24;
  if(!s.inventoryOrder.includes('ammo'))s.inventoryOrder.push('ammo');
}
function shootGun(){
  if(panel || G.gameOver || player.atkCd>0)return false;
  const gun=ITEMS[player.weapon];
  if(!gun || !gun.firearm || player.toolId)return false;
  // 弓/弩：按住蓄力，蓄满才发射（倍率随蓄力提升）
  let chargeScale=1;
  if(gun.charge){
    if(!player.chargeStart) player.chargeStart=performance.now();
    const need=(gun.chargeTime||1.1)*1000;
    const ratio=Math.min(1,(performance.now()-player.chargeStart)/need);
    player.chargeRatio=ratio;
    if(ratio<1){
      player.atkCd=0.05;
      // 轻微推近镜头 + 阶段提示音
      if(window.Pixel3D && typeof Pixel3D.zoom==='function') Pixel3D.zoom(1 + ratio*0.05);
      const stage=Math.min(3,Math.floor(ratio*3));
      if(stage>=(player.chargeStage===undefined?-1:player.chargeStage)){
        if(player.chargeStage!==stage && window.PixelSurvivalCharge) window.PixelSurvivalCharge.tick(stage);
        player.chargeStage=stage;
      }
      return false;
    }
    if(window.Pixel3D && typeof Pixel3D.zoom==='function') Pixel3D.zoom(1);
    shake = Math.max(shake, 0.8);   // 蓄满瞬间轻震
    player.chargeStage=-1;
    chargeScale=0.55+ratio*1.2;   // 蓄满 1.75 倍
    player.chargeStart=0; player.chargeRatio=0;
  }
  const ammoId=gun.ammoItem||'ammo';
  if(!(inv[ammoId]>0)){
    player.atkCd=.25;
    showToast((ITEMS[ammoId]||{name:'弹药'}).name+'不足 · 先在合成台补充','#ffc080');
    return false;
  }
  takeItem(ammoId,1);
  player.atkCd=gun.cd;player.swing=.1;player.attackAngle=Math.atan2(player.aimY,player.aimX);
  player.combo=0;player.comboWindow=0;
  const angle=player.attackAngle;
  const muzzleX=player.x+Math.cos(angle)*10,muzzleY=player.y-10+Math.sin(angle)*10;
  for(let i=0;i<gun.pellets;i++){
    const a=angle+(gun.pellets===1?0:(i/(gun.pellets-1)-.5)*gun.spread*2);
    playerBullets.push({x:player.x,y:player.y-10,angle:a,remaining:gun.gunRange+G.growth.ranks.reach*3,
      damage:Math.max(1,Math.round(player.damage*chargeScale)),speed:320,fromBow:ammoId==='arrow'});
  }
  combatFx.push({id:'muzzle',x:muzzleX,y:muzzleY,life:.07,max:.07});
  shake=Math.max(shake,gun.pellets>1?2:0.6);
  return true;
}
function updatePlayerBullets(dt){
  for(let i=playerBullets.length-1;i>=0;i--){
    const b=playerBullets[i],distance=Math.min(b.remaining,b.speed*dt);
    const steps=Math.max(1,Math.ceil(distance/3));
    let stopped=false;
    for(let step=0;step<steps && !stopped;step++){
      b.x+=Math.cos(b.angle)*distance/steps;b.y+=Math.sin(b.angle)*distance/steps;
      // 箭矢拖尾
      if (b.fromBow && Math.random() < 0.55){
        spawnParticles(b.x - Math.cos(b.angle)*4, b.y - Math.sin(b.angle)*4, '#efe4c4', 1);
      }
      if((G.mapId&&(b.x<0||b.x>WORLD_W||b.y<0||b.y>WORLD_H))||
        Math.abs(b.x)>1e9||Math.abs(b.y)>1e9||blockedByPlacedBlock(b.x,b.y,1)){stopped=true;break;}
      // 地形挡弹，但射击不会消耗采集物或穿过建筑。
      if(trees.some(o=>Math.hypot(b.x-o.x,b.y-(o.y-10))<o.r) ||
         rocks.some(o=>Math.hypot(b.x-o.x,b.y-(o.y-7))<o.r)){stopped=true;break;}
      // 动物也能被箭矢/子弹打中
      for(let j=animals.length-1;j>=0;j--){
        const a=animals[j];
        if(pets.includes(a)) continue;   // 已驯服的宠物不受伤
        if(Math.hypot(b.x-a.x,b.y-(a.y-6))<a.r+3){
          a.hp=(a.hp||6)-b.damage;
          for(let k=0;k<6;k++) spawnParticles(b.x+rnd(-3,3), b.y+rnd(-3,3), '#ff9a9a', 1);
          if(a.hp<=0){
            for(let count=0;count<(a.type==='chicken'?1:2);count++) dropPickup(a.x,a.y-5,'meat');
            if(a.type==='chicken'&&Math.random()<0.45) dropPickup(a.x,a.y-7,'fiber');
            animals.splice(j,1);
            showToast('猎到了动物 · 获得生肉','#e6c6a0');
          }
          stopped=true;break;
        }
      }
      if(stopped) break;
      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j];
        if(Math.hypot(b.x-e.x,b.y-(e.y-9))<e.r+2){
          skillDamageEnemy(e,j,b.damage,b.angle);
          // 命中溅射
          for (let k = 0; k < 8; k++){
            spawnParticles(b.x + rnd(-4, 4), b.y + rnd(-4, 4), '#ffe9b0', 1);
          }
          // 弓箭/弩：命中后有概率把箭捡回来
          if(b.fromBow && Math.random()<0.4){
            dropPickup(e.x+(Math.random()-.5)*8, e.y-4, 'arrow');
          }
          stopped=true;break;
        }
      }
    }
    b.remaining-=distance;
    if(stopped || b.remaining<=0) playerBullets.splice(i,1);
  }
}
function drawCompactHud(){
  if (comboT > 0 && comboCount >= 2){
    txt('连杀 ×'+comboCount, 122, 29, { size:9, bold:true, color: comboCount >= 10 ? '#ff7a5a' : '#ffd060' });
    R(122, 40, Math.round(50*comboT/4), 2, '#ffd060');
  }
  const bs = enemies.find(e => e.boss);
  if (bs){
    R(140, 46, 200, 7, 'rgba(20,12,6,0.8)');
    R(141, 47, Math.round(198*clamp(bs.hp/bs.maxHp,0,1)), 5, '#d04060');
    const bossName=bs.finalBoss?'世界核心守护者':bs.annualBoss?'年度巨像':'巨像守卫';
    txt(bossName, 240, 38, { size:6, bold:true, color:bs.finalBoss?'#d9c8ff':'#ffd0d8', align:'center' });
  }
  R(115, 7, 195, 17, G.bloodMoon ? 'rgba(96,30,42,0.92)' : 'rgba(36,27,16,0.86)');
  R(115, 7, 195, 1, G.bloodMoon ? '#e85a72' : 'rgba(216,188,138,0.35)');
  R(115, 23, 195, 1, 'rgba(0,0,0,0.4)');
  const season=SEASONS[getSeasonIndex()];
  const weather=WEATHER_NAMES[G.weather]||WEATHER_NAMES.clear;
  const gameMinutes=(360+Math.floor(G.dayTime*1440))%1440;
  const clock=String(Math.floor(gameMinutes/60)).padStart(2,'0')+':'+String(gameMinutes%60).padStart(2,'0');
  txt('第'+G.day+'天 '+clock+' · '+(G.inCave?'地下洞穴':season.short+' '+weather)+(G.bloodMoon?' · 血月':''),
    119, 11,
    { size:6, bold:true, color:G.pollution>=600?'#d89bd2':G.bloodMoon?'#ff9caa':'#e7dcc0' });
  if(!panel && !G.gameOver) uiButtons.push({x:115, y:7, w:195, h:17, fn:() => {clearInput(); panel='growth';}});
  R(115, 25, 195, 2, 'rgba(20,29,28,0.8)');
  R(115, 25, Math.round(195*clamp(G.growth.xp/xpNeeded(G.growth.level),0,1)), 2, PAL.xpLight);
  const gun = player.weapon && ITEMS[player.weapon].firearm;
  const weaponText = player.toolId ? ITEMS[player.toolId].name : player.weapon ? ITEMS[player.weapon].name : '徒手';
  R(4, 63, 108, 17, 'rgba(36,27,16,0.86)');
  R(4, 63, 108, 1, 'rgba(216,188,138,0.35)');
  R(4, 79, 108, 1, 'rgba(0,0,0,0.4)');
  txt(weaponText + (gun ? ' · 弹药 '+(inv.ammo||0) : ' · 距离 '+player.range), 8, 65, { size:6, bold:true, color:'#e7dcc0' });
  const labels = {regen:'再生', power:'力量', haste:'疾行'};
  const active = Object.keys(labels).filter(k => G.effects[k] > 0).map(k => labels[k] + Math.ceil(G.effects[k]) + 's');
  if(G.wardTime > 0) active.push('守护' + Math.ceil(G.wardTime) + 's');
  txt(active.join('  '), 8, 72, { size:6, bold:true, color:'#9fd8cc' });
}
function drawGuidePanel(){
  const english=gameLanguage==='en';
  const japanese=gameLanguage==='ja';
  drawMcBackdrop(0.66);
  const x=22,y=12,w=436,h=246;
  uiPanel(x-3,y-3,w+6,h+6,{});
  uiPanel(x,y,w,h,{title:english?'HELP CENTER · CONTROLS':japanese?'ヘルプ · 操作方法':'帮助中心 · 按键与操作'});
  const pages=english?[
    [
      ['Move in 8 directions','W A S D / Arrow keys'],['Sprint','Left / Right Shift'],['Attack / gather','Left mouse / Space'],
      ['Use / interact','Right mouse'],['Hotbar','1–9 / Mouse wheel'],['Inventory','E'],
      ['Crafting','C / Tab'],['Technology','T'],['Eat best food','H'],['Cave / eat','F'],
      ['Place torch','Q'],['Save game','K'],['Pause / resume','P / Esc'],['Minimap','M'],
      ['Help center','J / F1'],['Character appearance','O'],['Skill tree','N'],
      ['Growth upgrades','B / 1–8'],['Achievements','G'],['Skills','Z X V Y U'],
      ['Game Studio','F2'],['Restart (confirmation)','R in pause / game over'],
    ],
    [
      ['Left click','Attack, gather, select UI buttons and items.'],
      ['Right click','Use selected item, feed animals, collect river water, interact.'],
      ['Drag items','Reorder inventory and hotbar; drag a stack to trash to discard.'],
      ['Mouse wheel','Switch hotbar slots; scroll the crafting list while crafting.'],
      ['Pause menu','Continue, restart, save/load, open appearance or Game Studio.'],
      ['Title screen','Continue, new world, saves, language, help and Game Studio.'],
      ['River','Cross water at reduced speed; right-click with an empty bottle to fill.'],
      ['Machines','Interact with a placed machine to set input, output and recipes.'],
      ['Touch screen','Tap for pointer actions; use the keyboard for movement.'],
      ['Survival time','One in-game day lasts 10 minutes by default.'],
      ['Video & performance','L / F3 sets presets, resolution, draw distance, particles, FPS cap and auto quality.'],
      ['3D camera','WASD moves relative to the camera; middle-drag rotates, Shift+wheel zooms.'],
      ['More help','J / F1 opens this center; Esc closes it.'],
    ],
    [
      ['Title buttons','Continue resumes the auto-save; New World starts over after confirmation.'],
      ['Save / Load','Open Saves to read or write the auto-save and three manual slots.'],
      ['Backup buttons','Import and export JSON backups from the matching save slot.'],
      ['Language button','Switches Simplified Chinese / English for title, saves and help.'],
      ['Pause buttons','Continue, restart, appearance, Game Studio, saves or return to title.'],
      ['HUD technology','Click the technology / day indicator to open technology.'],
      ['HUD growth','Click the growth / XP bar or press B for permanent upgrades.'],
      ['Skill slots','Click the skill HUD to open skills; click a slot to select it.'],
      ['Inventory buttons','Drag armor to the matching equipment slot; drag other items to arrange or discard.'],
      ['Machine panel','Choose input / output pages and select a recipe to process.'],
      ['Studio controls','Use workshop tabs, item selectors, upload, preview and save buttons.'],
    ],
  ]:japanese?[
    [
      ['8方向移動','W A S D / 矢印キー'],['ダッシュ','左 / 右 Shift'],['攻撃 / 採集','マウス左 / Space'],
      ['使用 / 操作','マウス右'],['アイテム欄','1–9 / マウスホイール'],['持ち物','E'],
      ['クラフト','C / Tab'],['テクノロジー','T'],['食事','H'],['洞窟 / 食事','F'],
      ['たいまつ設置','Q'],['ゲーム保存','K'],['一時停止 / 再開','P / Esc'],['ミニマップ','M'],
      ['ヘルプ','J / F1'],['外見変更','O'],['スキルツリー','N'],
      ['成長強化','B / 1–8'],['実績','G'],['スキル','Z X V Y U'],
      ['ゲームスタジオ','F2'],['再スタート（確認）','一時停止 / ゲームオーバー中に R'],
    ],
    [
      ['マウス左ボタン','攻撃、採集、UIボタンやアイテムの選択。'],
      ['マウス右ボタン','選択アイテムの使用、動物への餌やり、水の採取、操作。'],
      ['アイテムをドラッグ','持ち物やアイテム欄を整理。ゴミ箱へドラッグすると破棄。'],
      ['マウスホイール','アイテム欄を切替。クラフト画面ではレシピ一覧をスクロール。'],
      ['一時停止メニュー','再開、再スタート、セーブ / ロード、外見変更、スタジオ。'],
      ['タイトル画面','続ける、新しい世界、セーブ、言語、ヘルプ、スタジオ。'],
      ['川','水中では移動速度が低下。空のボトルを持って右クリックで水を汲む。'],
      ['機械','設置済みの機械を操作して、投入物、出力、レシピを設定。'],
      ['タッチ操作','タップでポインター操作。移動にはキーボードを使用。'],
      ['生存時間','ゲーム内の1日は、初期設定で現実の10分。'],
      ['画質と性能','L / F3で画質プリセット、解像度、描画距離、粒子、FPS上限、自動調整を設定。'],
      ['3D 視点','WASDは視点方向へ移動。中ボタンドラッグで回転、Shift＋ホイールで拡大縮小。'],
      ['ヘルプを開く','J / F1で表示、Escで閉じる。'],
    ],
    [
      ['タイトル画面のボタン','続けるは自動セーブを読込。新しい世界は確認後に開始。'],
      ['セーブ / ロード','自動セーブと3つの手動スロットを保存・読込。'],
      ['バックアップ','各スロットのJSONバックアップをインポート / エクスポート。'],
      ['言語ボタン','簡体字中国語、英語、日本語を切替。'],
      ['一時停止ボタン','再開、再スタート、外見、スタジオ、セーブ、タイトルへ戻る。'],
      ['テクノロジー','画面上部のテクノロジー / 日付をクリックして表示。'],
      ['成長ボタン','成長 / 経験値バーをクリック、またはBで恒久強化を表示。'],
      ['スキル欄','スキルHUDをクリックして開き、スロットからスキルを選択。'],
      ['持ち物ボタン','防具を対応する装備スロットへドラッグ。他のアイテムはドラッグで整理・破棄。'],
      ['機械パネル','投入物 / 出力を切替え、レシピを選んで加工。'],
      ['ゲームスタジオ','工房タブ、アイテム選択、アップロード、プレビュー、保存を使用。'],
    ],
  ]:[
    [
      ['八方向移动','W A S D / 方向键'],['冲刺','左 Shift / 右 Shift'],['攻击 / 采集','鼠标左键 / 空格'],
      ['使用 / 交互','鼠标右键'],['快捷栏','1–9 / 鼠标滚轮'],['背包','E'],
      ['合成','C / Tab'],['科技','T'],['快速进食','H'],['洞穴 / 进食','F'],
      ['放置火把','Q'],['保存游戏','K'],['暂停 / 继续','P / Esc'],['小地图','M'],
      ['帮助中心','J / F1'],['人物外观','O'],['技能树','N'],
      ['成长强化','B / 1–8'],['成就','G'],['技能','Z X V Y U'],
      ['游戏创作中心','F2'],['输入锁定','F6（屏蔽浏览器右键与快捷键）'],['重新开始（需确认）','暂停 / 结束时按 R'],
    ],
    [
      ['鼠标左键','攻击、采集、点击界面按钮和物品。'],
      ['鼠标右键','使用选中物品、喂养动物、河流取水或交互。'],
      ['拿放物品','左键拿起整组、右键拿一半；拖到垃圾桶可丢弃整组。'],
      ['合成界面','工作台 3×3 / 背包 2×2；右侧配方手册可一键摆放材料。'],
      ['第一人称','F5 切换第一 / 第三人称，第一人称会锁定鼠标。'],
      ['鼠标滚轮','切换快捷栏；合成界面中可滚动配方列表。'],
      ['暂停菜单','继续、重开、存档读档、人物外观或创作中心。'],
      ['主菜单','继续、新世界、存档、语言、帮助和创作中心。'],
      ['河流','涉水会减速；手持空瓶右键河流可装水。'],
      ['机器','靠近已放置的机器交互，管理输入、产物与配方。'],
      ['触屏','点击可执行鼠标操作；移动请使用键盘。'],
      ['生存时间','默认游戏内一天为现实时间 10 分钟。'],
      ['画面设置','L 打开画质预设、分辨率、视距、粒子、FPS 上限与自动降质。'],
      ['3D 操作','WASD 按镜头方向移动；中键拖动旋转，Shift + 滚轮缩放，F5 切换视角。'],
      ['更多帮助','按 J / F1 打开本中心，Esc 关闭。'],
    ],
    [
      ['主菜单按钮','继续旅程读取自动档；开启新世界会在确认后重开。'],
      ['存档 / 读档','管理自动档和 3 个手动槽，可保存或读取进度。'],
      ['备份按钮','对对应槽位导入或导出 JSON 存档备份。'],
      ['语言按钮','切换简体中文 / English（首页、存档页和帮助中心）。'],
      ['暂停菜单','继续、重开、人物外观、创作中心、存档或返回主菜单。'],
      ['科技按钮','点击顶部科技 / 日期信息可打开科技面板。'],
      ['成长按钮','点击成长 / 经验条，或按 B 查看永久强化。'],
      ['技能槽','点击技能 HUD 打开技能树，再点击槽位选择快捷技能。'],
      ['背包按钮','把防具放进对应装备槽穿戴；左键拿起物品、右键拿一半。'],
      ['机器面板','切换输入 / 产物分页，并选择配方进行加工。'],
      ['创作中心','使用工坊分类、物品选择、上传、预览与保存按钮。'],
    ],
  ];
  const rows=pages[guidePage]||pages[0];
  if(guidePage===0){
    const columnWidth=205,columns=[rows.slice(0,11),rows.slice(11)];
    columns.forEach((column,columnIndex)=>column.forEach(([label,key],index)=>{
      const rowY=y+38+index*15,rowX=x+12+columnIndex*columnWidth;
      R(rowX,rowY,columnWidth-8,13,index%2?'#c6c6c6':'#bcbcbc');
      txt(label,rowX+5,rowY+3,{size:6,bold:true,color:'#3f3f3f'});
      txt(key,rowX+columnWidth-12,rowY+3,{size:6,bold:true,color:'#3f5f2c',align:'right'});
    }));
  }else{
    setFont(6,true);
    const labelWidth=Math.max(...rows.map(([label])=>ctx.measureText(label).width));
    const descriptionX=x+17+labelWidth+8;
    // 条目较多时压缩行距，避免压到页码与按钮
    const rowGap=rows.length>11?13:16;
    const rowHeight=rows.length>11?12:14;
    rows.forEach(([label,description],index)=>{
      const rowY=y+38+index*rowGap;
      R(x+12,rowY,w-24,rowHeight,index%2?'#c6c6c6':'#bcbcbc');
      txt(label,x+17,rowY+2,{size:6,bold:true,color:'#3f3f3f'});
      txt(description,descriptionX,rowY+2,{size:6,color:'#3f5f2c'});
    });
  }
  const pageLabel=english?'PAGE '+(guidePage+1)+' / '+pages.length:
    japanese?'ページ '+(guidePage+1)+' / '+pages.length:
    '第 '+(guidePage+1)+' / '+pages.length+' 页';
  txt(pageLabel,W/2,y+221,{size:6,bold:true,color:'#7a6a4e',align:'center'});
  const prevX=x+12,nextX=x+w-78,buttonY=y+218;
  uiButton(prevX,buttonY,62,17,english?'Previous':japanese?'前へ':'上一页',{kind:'wood'});
  uiButtons.push({x:prevX,y:buttonY,w:62,h:17,fn:()=>{guidePage=(guidePage+pages.length-1)%pages.length;}});
  uiButton(nextX,buttonY,62,17,english?'Next':japanese?'次へ':'下一页',{kind:'wood'});
  uiButtons.push({x:nextX,y:buttonY,w:62,h:17,fn:()=>{guidePage=(guidePage+1)%pages.length;}});
  const closeX=x+w-158;
  uiButton(closeX,buttonY,72,17,english?'Close':japanese?'閉じる':'关闭',{kind:'green'});
  uiButtons.push({x:closeX,y:buttonY,w:72,h:17,fn:()=>{
    clearInput();panel=guideReturnPanel;guideReturnPanel=null;
    if(typeof syncPointerLock==='function')syncPointerLock();
  }});
}
