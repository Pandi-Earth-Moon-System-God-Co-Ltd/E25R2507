function updateTutorial(){
  const conditions = [G.tutorialWood >= 8, G.tutorialSword, G.tutorialTorch, G.day >= 2];
  const rewards = [['berry',2],['fiber',3],['bandage',1],['cooked',2]];
  const names = ['收集8个木头','制作木剑','制作火把','度过第一夜'];
  for (let i=0;i<4;i++){
    if (i > 0 && !G.tutorialDone[i-1]) break;
    if (!G.tutorialDone[i] && conditions[i]){
      G.tutorialDone[i] = true;
      const [id,n] = rewards[i]; addItem(id,n);
      showToast('任务完成：'+names[i]+' · '+ITEMS[id].name+' ×'+n, '#a5efb2');
      saveGame();
    }
  }
}
function drawTutorial(){
  if (panel || G.gameOver) return;
  const index = G.tutorialDone.indexOf(false);
  const objectives = [
    { title:'收集木头', progress:Math.min(1,G.tutorialWood/8), detail:'靠近树，按住左键采集' },
    { title:'制作木剑', progress:0, detail:'按 C 制作 · 需要木头×8' },
    { title:'制作火把', progress:0, detail:'木头×2 + 纤维×1 · Q 放置' },
    { title:'度过第一夜', progress:0, detail:'准备食物和火把，活到第2天' },
  ];
  if (index === 1 && G.tutorialSword) objectives[index].progress = 1;
  if (index === 2 && G.tutorialTorch) objectives[index].progress = 1;
  if (index === 3 && G.day >= 2) objectives[index].progress = 1;

  const w = 120, h = 36, x = W - w - 7, y = 92;
  R(x-1,y-1,w+2,h+2,'rgba(8,18,18,0.78)');
  R(x,y,w,1,'rgba(229,216,168,0.38)');
  ctx.textAlign = 'left';
  ctx.font = 'bold 7px '+UI_FONT;
  ctx.fillStyle = '#e5d8a8';
  ctx.fillText(localizeGameText(index < 0 ? '生存目标 · 自由探索' : '新手任务 '+(index+1)+'/4'),x+5,y+4);
  if (index < 0){
    ctx.font = '6px '+UI_FONT;
    ctx.fillStyle = '#afc6bb';
    const goal=G.annualBossDefeated?'建造世界之门 · 挑战最终守护者'
      :G.day>=32?'年度巨像苏醒 · 击败它获取遗迹碎片'
        :'探索遗迹 · 升级科技';
    ctx.fillText(localizeGameText(goal),x+5,y+17);
    ctx.fillText(localizeGameText('第5天巨像 · 第7天血月 · J查看生态'),x+5,y+26);
    return;
  }
  const objective = objectives[index];
  ctx.fillStyle = '#afc6bb';
  ctx.font = 'bold 6px '+UI_FONT;
  ctx.fillText(localizeGameText(objective.title),x+5,y+15);
  ctx.font = '6px '+UI_FONT;
  ctx.fillText(localizeGameText(objective.detail),x+5,y+24);
  R(x+5,y+32,w-10,2,'rgba(0,0,0,0.6)');
  R(x+5,y+32,Math.round((w-10)*objective.progress),2,'#a5efb2');
}

let lastTime = performance.now();

function loop(now){
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.05) dt = 0.05;

  fpsSmooth += (1/Math.max(dt, 0.001) - fpsSmooth) * 0.05;

  if (!G.gameOver){
    update(dt);
    if (!G.gameOver){
      updateTutorial();
      if (!panel){ saveClock += dt; if (saveClock >= 15) saveGame(); }
    }
  } else {
    G.overT += dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 24);
    updateParticles(dt, true);
  }

  render();
  requestAnimationFrame(loop);
}
