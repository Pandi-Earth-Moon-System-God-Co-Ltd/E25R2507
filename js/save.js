/* 本地存档、输入保护与新手任务 */
function drawAchPanel(){
  const got=ACHS.filter(a => (G.ach||{})[a[0]]).length;
  drawMcBackdrop(0.64);
  uiPanel(110, 12, 260, 246, { title:'成就 '+got+'/'+ACHS.length+'   G / Esc 关闭', accent:PAL.gold });
  ACHS.forEach((a, i)=>{
    const y=42+i*27, done=(G.ach||{})[a[0]];
    uiPanel(122, y, 236, 23, { fill: done?PAL.cream:PAL.paper, woodMid: done?PAL.leaf:PAL.wood });
    txt((done?'✔ ':'· ')+a[1], 128, y+4, { size:8, bold:true, color: done?'#3c6630':'#6b5b42' });
    txt(a[2]+(done?'':'  (奖励30经验)'), 128, y+13, { size:6, bold:true, color:'#555555' });
  });
}
function checkAchievements(){
  G.ach=G.ach||{};
  for(const a of ACHS){
    if(!G.ach[a[0]] && a[3]()){
      G.ach[a[0]]=true; gainExperience(30);
      showToast('🏆 成就达成：'+a[1]+' (+30经验)','#ffe070');
    }
  }
}
function clearInput(){
  for (const k in keys) keys[k] = false;
  mouse.down = false;
  inventoryDragSource = null;
}
function isRecord(value){
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validateSaveShape(s){
  const arrays = ['trees','rocks','bushes','pickups','enemies','torches','placedBlocks','enemyShots'];
  const validCoordinate=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&
    (s.G&&s.G.mapId?x>=0&&x<=WORLD_W&&y>=0&&y<=WORLD_H:Math.abs(x)<=1e9&&Math.abs(y)<=1e9);
  if (!isRecord(s) || !isRecord(s.player) || !isRecord(s.G) || !isRecord(s.inv) ||
      !Array.isArray(s.inventoryOrder) || !Array.isArray(s.hotbar) || s.hotbar.length !== HOTBAR_SIZE ||
      !Number.isInteger(s.selectedHotbar) || s.selectedHotbar < 0 || s.selectedHotbar >= HOTBAR_SIZE ||
      !Number.isFinite(s.spawnTimer) || s.spawnTimer < 0 || arrays.some(k => !Array.isArray(s[k])) ||
      !['x','y','hp','hunger','stamina','maxHp','maxHunger','maxStamina'].every(k => Number.isFinite(s.player[k])) ||
      (s.player.thirst !== undefined && (!Number.isFinite(s.player.thirst) || s.player.thirst < 0 ||
        !Number.isFinite(s.player.maxThirst) || s.player.maxThirst <= 0 || s.player.thirst > s.player.maxThirst)) ||
      (s.player.bodyTemp !== undefined && (!Number.isFinite(s.player.bodyTemp) || s.player.bodyTemp < 20 || s.player.bodyTemp > 50)) ||
      !validCoordinate(s.player.x,s.player.y) ||
      s.player.maxHp <= 0 || s.player.hp < 0 || s.player.hp > s.player.maxHp ||
      s.player.maxHunger <= 0 || s.player.hunger < 0 || s.player.hunger > s.player.maxHunger ||
      s.player.maxStamina <= 0 || s.player.stamina < 0 || s.player.stamina > s.player.maxStamina ||
      !Number.isInteger(s.G.day) || s.G.day < 1 || !Number.isFinite(s.G.dayTime) || s.G.dayTime < 0 || s.G.dayTime >= 1 ||
      (s.G.dayLength!==undefined&&(!Number.isFinite(s.G.dayLength)||s.G.dayLength<30||s.G.dayLength>1800))||
      !Number.isInteger(s.G.tech) || !TECH_LEVELS[s.G.tech] ||
      !Array.isArray(s.G.tutorialDone) || s.G.tutorialDone.length !== 4 ||
      !s.G.tutorialDone.every(v => typeof v === 'boolean') ||
      !Number.isFinite(s.G.tutorialWood) || s.G.tutorialWood < 0 ||
      Object.entries(s.inv).some(([id,n]) => !ITEMS[id] || !Number.isInteger(n) || n < 0) ||
      (s.bagSlots !== undefined && (!Array.isArray(s.bagSlots) || s.bagSlots.length !== BAG_SLOTS ||
        s.bagSlots.some(id => id !== null && !ITEMS[id]) ||
        new Set(s.bagSlots.filter(Boolean)).size !== s.bagSlots.filter(Boolean).length)) ||
      s.hotbar.some(id => id !== null && !ITEMS[id]) ||
      s.inventoryOrder.some(id => !ITEMS[id]) ||
      (s.player.equipment!==undefined&&(!isRecord(s.player.equipment)||
        EQUIPMENT_ARMOR_SLOTS.some(({id:slot})=>{
          const itemId=s.player.equipment[slot];
          return itemId!==null&&itemId!==undefined&&
            (!ITEMS[itemId]||ITEMS[itemId].kind!=='armor'||
             (ITEMS[itemId].armorSlot||'chestplate')!==slot);
        })))||
      arrays.some(k => s[k].some(o => !isRecord(o)||!validCoordinate(o.x,o.y)))) {
    throw new Error('存档结构或世界实体数据无效');
  }
  if (s.farmPlots !== undefined && (!Array.isArray(s.farmPlots) ||
      s.farmPlots.some(p => !isRecord(p)||!validCoordinate(p.x,p.y)||
        (p.crop !== null && !CROPS[p.crop]) ||
        !Number.isFinite(p.growth) || p.growth < 0 || p.growth > 1 ||
        (p.moisture!==undefined&&(!Number.isFinite(p.moisture)||p.moisture<0||p.moisture>1))))) {
    throw new Error('农田数据无效');
  }
  if (s.placedBlocks.some(b => !ITEMS[b.type] || ITEMS[b.type].kind !== 'placeable' || !Number.isFinite(b.hp) || b.hp <= 0)) {
    throw new Error('建筑数据无效');
  }
  const validMachineStock=stock=>isRecord(stock)&&Object.entries(stock).every(([id,count])=>
    ITEMS[id]&&Number.isInteger(count)&&count>0&&count<=99);
  if(s.machines!==undefined&&(!Array.isArray(s.machines)||s.machines.some(m=>{
    if(!isRecord(m)||!MACHINE_TYPES[m.type]||!validCoordinate(m.x,m.y)||
       !Number.isFinite(m.hp)||m.hp<=0||!validMachineStock(m.input)||
       !validMachineStock(m.output)||!Number.isInteger(m.fuel)||m.fuel<0||m.fuel>99||
       !Number.isFinite(m.progress)||m.progress<0||
       (m.power!==undefined&&(!Number.isFinite(m.power)||m.power<0||
         m.power>(MACHINE_TYPES[m.type].capacity||100)))||
       (m.dir!==undefined&&(!Number.isInteger(m.dir)||m.dir<0||m.dir>3)))return true;
    const active=m.activeRecipe===null?null:MACHINE_TYPES[m.type].recipes.find(r=>r.id===m.activeRecipe);
    if(m.activeRecipe!==null&&!active)return true;
    const type=MACHINE_TYPES[m.type];
    return active?m.progress>active.duration:type.generator==='fuel'
      ?m.progress>type.fuelInterval:type.harvester
        ?m.progress>type.harvestInterval:type.itemRouter
          ?m.progress>type.transferInterval:m.progress!==0;
  })))throw new Error('机器库存或生产状态无效');
  if(s.belts!==undefined&&(!Array.isArray(s.belts)||s.belts.some(b=>
    !isRecord(b)||!validCoordinate(b.x,b.y)||!Number.isInteger(b.dir)||b.dir<0||b.dir>3||
    !Number.isFinite(b.timer)||b.timer<0||b.timer>=0.5)))throw new Error('输送带数据无效');
  if(s.ruins!==undefined&&(!Array.isArray(s.ruins)||s.ruins.some(r=>
    !isRecord(r)||!validCoordinate(r.x,r.y)||typeof r.opened!=='boolean')))throw new Error('遗迹数据无效');
  if (s.chests !== undefined && (!Array.isArray(s.chests) ||
      s.chests.some(c => !isRecord(c)||!validCoordinate(c.x,c.y)||typeof c.open!=='boolean'))) {
    throw new Error('宝箱数据无效');
  }
  if(s.waterSources!==undefined&&(!Array.isArray(s.waterSources)||s.waterSources.some(source=>
    !isRecord(source)||!validCoordinate(source.x,source.y)||
    !Number.isFinite(source.cooldown)||source.cooldown<0||source.cooldown>36))){
    throw new Error('水源数据无效');
  }
  if (s.pickups.some(p => !ITEMS[p.type])) throw new Error('掉落物品 ID 无效');
  if (s.G.farmTech !== undefined && (!Number.isInteger(s.G.farmTech) || s.G.farmTech < 0 || s.G.farmTech > FARM_TECH.length)) {
    throw new Error('农业科技数据无效');
  }
  if(s.G.pollution!==undefined&&(!Number.isFinite(s.G.pollution)||s.G.pollution<0||s.G.pollution>2000))
    throw new Error('污染数据无效');
  if(s.G.weather!==undefined&&!Object.prototype.hasOwnProperty.call(WEATHER_NAMES,s.G.weather))
    throw new Error('天气数据无效');
  if(s.G.weatherTime!==undefined&&(!Number.isFinite(s.G.weatherTime)||s.G.weatherTime<0||s.G.weatherTime>90))
    throw new Error('天气持续时间无效');
  if(s.G.treeGrowthTimer!==undefined&&(!Number.isFinite(s.G.treeGrowthTimer)||s.G.treeGrowthTimer<0||s.G.treeGrowthTimer>45))
    throw new Error('生态恢复计时无效');
  if(s.G.victory!==undefined&&typeof s.G.victory!=='boolean')
    throw new Error('结局数据无效');
  if(s.G.annualBossDefeated!==undefined&&typeof s.G.annualBossDefeated!=='boolean')
    throw new Error('年度首领数据无效');
  if(s.animals!==undefined&&(!Array.isArray(s.animals)||s.animals.some(animal=>
    !isRecord(animal)||!validCoordinate(animal.x,animal.y)||
    !['chicken','sheep','boar'].includes(animal.type)||
    !Number.isFinite(animal.age)||animal.age<0||animal.age>1||
    !Number.isFinite(animal.hp)||animal.hp<=0||
    !Number.isFinite(animal.love)||animal.love<0||
    !Number.isFinite(animal.breedCooldown)||animal.breedCooldown<0)))
    throw new Error('动物数据无效');
  if(s.pets!==undefined&&(!Array.isArray(s.pets)||s.pets.length>3||s.pets.some(pet=>
    !isRecord(pet)||!validCoordinate(pet.x,pet.y)||!['chicken','sheep','boar'].includes(pet.type)||
    pet.tamed!==true||!['follow','stay'].includes(pet.mode)||
    !Number.isFinite(pet.age)||pet.age<0||pet.age>1||
    !Number.isFinite(pet.hp)||pet.hp<=0||
    !Number.isFinite(pet.love)||pet.love<0||
    !Number.isFinite(pet.breedCooldown)||pet.breedCooldown<0||
    (pet.attackCooldown!==undefined&&(!Number.isFinite(pet.attackCooldown)||pet.attackCooldown<0||pet.attackCooldown>2))||
    (pet.layer!==undefined&&!['surface','cave'].includes(pet.layer)))))
    throw new Error('宠物数据无效');
  if(s.G.worldLayer!==undefined&&!['surface','cave'].includes(s.G.worldLayer))
    throw new Error('世界层级数据无效');
  if(s.G.mapSnapshot!==undefined&&s.G.mapSnapshot!==null){
    if(typeof s.G.mapId!=='string'||s.G.mapSnapshot.id!==s.G.mapId||
       typeof studioValidateMapDefinition!=='function')
      throw new Error('自定义地图存档数据无效');
    studioValidateMapDefinition(s.G.mapId,s.G.mapSnapshot);
  }
  if(s.G.mapId!==undefined&&s.G.mapId!==null&&
     (typeof s.G.mapId!=='string'||(!modDefinitions.maps[s.G.mapId]&&!s.G.mapSnapshot)))
    throw new Error('存档依赖的自定义地图不存在');
  if(s.G.chunkStates!==undefined&&(!isRecord(s.G.chunkStates)||Object.keys(s.G.chunkStates).length>100000||
     Object.entries(s.G.chunkStates).some(([key,state])=>{
       if(!/^(surface|cave):-?\d+,-?\d+$/.test(key)||!isRecord(state))return true;
       return Object.entries(state).some(([name,objects])=>
         !['trees','rocks','bushes','pickups','ruins','chests','caveEntrances','animals',
           'enemies','torches','placedBlocks','machines','belts','farmPlots','enemyShots'].includes(name)||
         !Array.isArray(objects)||objects.length>4096||objects.some(object=>
           !isRecord(object)||!validCoordinate(object.x,object.y)));
     })))throw new Error('无限地图区块数据无效');
  if(s.G.rules!==undefined&&(!isRecord(s.G.rules)||
     !Number.isInteger(s.G.rules.seasonDays)||s.G.rules.seasonDays<2||s.G.rules.seasonDays>32||
     !Number.isFinite(s.G.rules.hungerRate)||s.G.rules.hungerRate<0||s.G.rules.hungerRate>3||
     !Number.isFinite(s.G.rules.thirstRate)||s.G.rules.thirstRate<0||s.G.rules.thirstRate>3||
     !Number.isFinite(s.G.rules.enemyRate)||s.G.rules.enemyRate<0||s.G.rules.enemyRate>3))
    throw new Error('世界生存规则无效');
}
function migratePlayerAppearance(s){
  if(s.player.appearance===undefined&&s.version>=11)throw new Error('人物外观数据无效');
  const appearance={...DEFAULT_PLAYER_APPEARANCE,...(isRecord(s.player.appearance)?s.player.appearance:{})};
  const valid=appearance&&isRecord(appearance)&&
    Object.entries(DEFAULT_PLAYER_APPEARANCE).every(([key])=>
      Number.isInteger(appearance[key])&&appearance[key]>=0&&appearance[key]<PLAYER_CUSTOMIZATION[key].length);
  if(!valid)throw new Error('人物外观数据无效');
  s.player.appearance=appearance;
}
function prepareSaveData(rawState){
  const s = JSON.parse(JSON.stringify(rawState));
  if (!Number.isInteger(s.version) || ![2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21].includes(s.version)) throw new Error('不支持的存档版本');
  if(s.version>=9&&(!Array.isArray(s.belts)||!Array.isArray(s.ruins)||
     !Array.isArray(s.machines)||s.machines.some(machine=>!isRecord(machine)||!Number.isFinite(machine.power)))){
    throw new Error('存档缺少能源、输送带或遗迹状态');
  }
  if(s.version>=10&&s.machines.some(machine=>!Number.isInteger(machine.dir)||machine.dir<0||machine.dir>3)){
    throw new Error('存档缺少机器方向状态');
  }
  // 修复旧存档 / 已删除内容留下的脏数据，避免整份存档被判无效
  if (s.inv && typeof s.inv === 'object') for (const id in s.inv){ if (!ITEMS[id]) delete s.inv[id]; }
  if (Array.isArray(s.inventoryOrder)) s.inventoryOrder = s.inventoryOrder.filter(id => ITEMS[id]);
  if (Array.isArray(s.hotbar)) s.hotbar = s.hotbar.map(id => (id && ITEMS[id] ? id : null));
  if (!Array.isArray(s.bagSlots) || s.bagSlots.length !== BAG_SLOTS) s.bagSlots = Array(BAG_SLOTS).fill(null);
  else s.bagSlots = s.bagSlots.map(id => (id && ITEMS[id] ? id : null));
  if (Array.isArray(s.bagSlots)){
    const seenSlots = new Set();
    s.bagSlots = s.bagSlots.map(id => { if (!id || seenSlots.has(id)) return null; seenSlots.add(id); return id; });
  }
  validateSaveShape(s);
  migratePlayerAppearance(s);
  migrateGrowth(s);
  migrateCombat(s);
  migrateGuns(s);
  // 清理已经不存在的物品（删掉的自定义内容 / 旧存档），避免整份存档被判无效
  for (const id in s.inv){ if (!ITEMS[id]) delete s.inv[id]; }
  if (Array.isArray(s.inventoryOrder)) s.inventoryOrder = s.inventoryOrder.filter(id => ITEMS[id]);
  if (Array.isArray(s.hotbar)) s.hotbar = s.hotbar.map(id => (id && ITEMS[id] ? id : null));
  if (Array.isArray(s.bagSlots)) s.bagSlots = s.bagSlots.map(id => (id && ITEMS[id] ? id : null));
  if (!Number.isFinite(s.G.farmTech)) s.G.farmTech = 0;
  if (!Array.isArray(s.bagSlots) || s.bagSlots.length !== BAG_SLOTS) s.bagSlots = [];
  if (!Array.isArray(s.farmPlots)) s.farmPlots = [];
  if (!Array.isArray(s.chests)) s.chests = [];
  if(!Number.isFinite(s.player.thirst))s.player.thirst=100;
  if(!Number.isFinite(s.player.maxThirst))s.player.maxThirst=100;
  if(!Number.isFinite(s.player.bodyTemp))s.player.bodyTemp=36.5;
  if(!Array.isArray(s.animals))s.animals=[];
  if(!Array.isArray(s.pets))s.pets=[];
  for(const pet of s.pets){
    if(!['follow','stay'].includes(pet.mode))pet.mode='follow';
    if(!Number.isFinite(pet.attackCooldown))pet.attackCooldown=0;
    if(!['surface','cave'].includes(pet.layer))pet.layer=s.G.worldLayer||'surface';
  }
  if(s.version<17){
    for(const id of ['carrotSeed','wheatSeed']){
      s.inv[id]=Math.max(2,s.inv[id]||0);
      if(!s.inventoryOrder.includes(id))s.inventoryOrder.push(id);
      if(!s.hotbar.includes(id)){
        const empty=s.hotbar.indexOf(null);
        if(empty>=0)s.hotbar[empty]=id;
      }
    }
  }
  if(s.version<18){
    s.inv.emptyBottle=Math.max(2,s.inv.emptyBottle||0);
    if(!s.inventoryOrder.includes('emptyBottle'))s.inventoryOrder.push('emptyBottle');
    if(!s.hotbar.includes('emptyBottle')){
      const empty=s.hotbar.indexOf(null);
      if(empty>=0)s.hotbar[empty]='emptyBottle';
    }
  }
  if(s.version<20||s.player.equipment===undefined){
    const chestplate=s.player.armorId;
    s.player.equipment={helmet:null,chestplate:null,leggings:null,boots:null};
    if(chestplate&&ITEMS[chestplate]&&ITEMS[chestplate].kind==='armor'&&(s.inv[chestplate]||0)>0)
      s.player.equipment.chestplate=chestplate;
  }else{
    s.player.equipment={helmet:null,chestplate:null,leggings:null,boots:null,...s.player.equipment};
  }
  if(!Number.isInteger(s.G.worldSeed))s.G.worldSeed=137;
  if(!['surface','cave'].includes(s.G.worldLayer))
    s.G.worldLayer=s.G.inCave||s.player.y>=CAVE_LINE?'cave':'surface';
  s.G.inCave=s.G.worldLayer==='cave';
  if(s.G.dayLength===300&&!(s.G.mapSnapshot&&s.G.mapSnapshot.rules&&s.G.mapSnapshot.rules.dayLength===300))
    s.G.dayLength=600;
  s.waterSources=[];
  if(!Number.isFinite(s.G.pollution))s.G.pollution=0;
  if(!Object.prototype.hasOwnProperty.call(WEATHER_NAMES,s.G.weather))s.G.weather='clear';
  if(!Number.isFinite(s.G.weatherTime))s.G.weatherTime=0;
  if(!Number.isFinite(s.G.treeGrowthTimer))s.G.treeGrowthTimer=45;
  if(typeof s.G.victory!=='boolean')s.G.victory=false;
  if(typeof s.G.annualBossDefeated!=='boolean')s.G.annualBossDefeated=false;
  if (!Array.isArray(s.machines)) s.machines = [];
  for(const machine of s.machines){
    if(!Number.isFinite(machine.power))machine.power=0;
    if(!Number.isInteger(machine.dir)||machine.dir<0||machine.dir>3)machine.dir=0;
  }
  if(!Array.isArray(s.belts))s.belts=[];
  if(!Array.isArray(s.ruins))s.ruins=Array.isArray(ruins)?ruins.map(ruin=>({...ruin})):[];
  if(!s.G.mapId){
    const chunkStates=isRecord(s.G.chunkStates)?s.G.chunkStates:{};
    const chunkEntityNames=['trees','rocks','bushes','pickups','ruins','chests','animals','enemies',
      'torches','placedBlocks','machines','belts','farmPlots','enemyShots'];
    for(const name of chunkEntityNames){
      const list=Array.isArray(s[name])?s[name]:[];
      for(const object of list){
        const existingKey=typeof object._chunkKey==='string'&&/^(surface|cave):-?\d+,-?\d+$/.test(object._chunkKey)
          ?object._chunkKey:null;
        const layer=existingKey?existingKey.split(':')[0]:
          s.version<19?(object.y>=CAVE_LINE?'cave':'surface'):s.G.worldLayer||'surface';
        const key=existingKey||worldChunkKey(Math.floor(object.x/CHUNK_SIZE),Math.floor(object.y/CHUNK_SIZE),layer);
        const state=chunkStates[key]||(chunkStates[key]={});
        const stored={...object};delete stored._chunkKey;
        (state[name]||(state[name]=[])).push(stored);
      }
      s[name]=[];
    }
    s.G.chunkStates=chunkStates;
  }else s.G.chunkStates={};
  s.version = 21;
  validateSaveShape(s);
  return s;
}
function saveStorageKey(slot){
  if (!Number.isInteger(slot) || slot < 0 || slot > 3) throw new Error('存档槽位无效');
  return slot > 0 ? SAVE_KEY + '-slot-' + slot : SAVE_KEY;
}
function hasSavedGame(slot){
  try{return Boolean(localStorage.getItem(saveStorageKey(slot)));}
  catch(error){
    console.error('[Pixel Survival] 无法检查存档槽位',error);
    showToast('无法检查存档：'+error.message,'#ff9090');
    return false;
  }
}
function reportSaveFailure(err, manual){
  const message = err && err.name === 'QuotaExceededError'
    ? '存储空间不足，请导出备份并清理浏览器空间'
    : err && /存档|农田|建筑|机器|宝箱|水源|掉落|农业科技|输送带|遗迹|能源|人物外观|技能|区块|无限地图/.test(err.message)
      ? '当前游戏数据无效，未覆盖已有存档'
      : '浏览器本地存储不可用，保存未完成';
  if (manual || !saveFailureNotified){
    showToast((manual ? '保存失败：' : '自动保存失败：') + message, '#ff9090');
    console.error('[Pixel Survival] 保存失败', err);
  }
  saveFailureNotified = true;
}
function saveGame(manual = false, slot = 0){
  try {
    const key = saveStorageKey(slot);
    if (protectedSaveKeys.has(key)){
      if (manual) showToast('该存档无法读取，原记录已保留；确认重开后才能覆盖', '#ff9090');
      return false;
    }
    if (typeof syncBagSlots === 'function') syncBagSlots();
    // 读档时如果存档停在地下，先送回地表：避免卡在洞穴里出不来
    if (G && G.inCave){
      G.worldLayer = 'surface';
      G.inCave = false;
      const entry = (typeof caveEntrances !== 'undefined' && caveEntrances && caveEntrances[0]) || null;
      if (player && typeof TILE === 'number'){
        player.x = entry ? entry.x : MAP_W * TILE / 2;
        player.y = entry ? entry.y + TILE * 2 : MAP_H * TILE / 2;
        player.vx = 0; player.vy = 0;
      }
      if (typeof updateWorldChunks === 'function') updateWorldChunks();
      if (window.Pixel3D && typeof Pixel3D.invalidate === 'function') Pixel3D.invalidate();
      if (window.PixelSurvivalAudio) PixelSurvivalAudio.play('caveOut');
      showToast('存档位于地下，已自动回到地表（按 F 可再次下洞）', '#a8e0ff');
    }
    const invSnapshot = typeof craftGridSnapshot === 'function' ? craftGridSnapshot({ ...inv }) : { ...inv };
    const state = prepareSaveData({version:21, savedAt:Date.now(), player, G, inv:invSnapshot, inventoryOrder,
      bagSlots: Array.isArray(bagSlots) ? bagSlots.slice() : Array(BAG_SLOTS).fill(null),
      hotbar, selectedHotbar, trees, rocks, bushes, pickups, enemies,animals,pets,
      torches, placedBlocks, machines, belts, ruins, enemyShots, spawnTimer, chests, farmPlots, waterSources});
    const serialized = JSON.stringify(state);
    localStorage.setItem(key, serialized);
    if (localStorage.getItem(key) !== serialized) throw new Error('存档写入校验失败');
    saveClock = 0;
    saveFailureNotified = false;
    if (manual) showToast(slot>0 ? '存档槽 '+slot+' 已保存' : '进度已保存 · 当前浏览器', '#9aefbd');
    return true;
  } catch (err){
    reportSaveFailure(err, manual);
    return false;
  }
}
function loadGame(slot = 0){
  let key;
  try {
    key = saveStorageKey(slot);
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const rawState=JSON.parse(raw);
    const initializeWildlife=rawState.version<16||!Array.isArray(rawState.animals);
    const s = prepareSaveData(rawState);
    if(s.G.mapId)generateWorld(s.G.mapSnapshot||modDefinitions.maps[s.G.mapId],s.G.worldSeed);
    else generateWorld(null,s.G.worldSeed);
    player = s.player; G = s.G; inv = s.inv;
    inventoryOrder = s.inventoryOrder; hotbar = s.hotbar; selectedHotbar = s.selectedHotbar;
    bagSlots = Array.isArray(s.bagSlots) && s.bagSlots.length === BAG_SLOTS
      ? s.bagSlots.slice()
      : Array(BAG_SLOTS).fill(null);
    if (typeof syncBagSlots === 'function') syncBagSlots();
    // 读档时如果存档停在地下，先送回地表：避免卡在洞穴里出不来
    if (G && G.inCave){
      G.worldLayer = 'surface';
      G.inCave = false;
      const entry = (typeof caveEntrances !== 'undefined' && caveEntrances && caveEntrances[0]) || null;
      if (player && typeof TILE === 'number'){
        player.x = entry ? entry.x : MAP_W * TILE / 2;
        player.y = entry ? entry.y + TILE * 2 : MAP_H * TILE / 2;
        player.vx = 0; player.vy = 0;
      }
      if (typeof updateWorldChunks === 'function') updateWorldChunks();
      if (window.Pixel3D && typeof Pixel3D.invalidate === 'function') Pixel3D.invalidate();
      if (window.PixelSurvivalAudio) PixelSurvivalAudio.play('caveOut');
      showToast('存档位于地下，已自动回到地表（按 F 可再次下洞）', '#a8e0ff');
    }
    trees = s.trees; rocks = s.rocks; bushes = s.bushes; pickups = s.pickups;
    enemies = s.enemies; animals=s.animals; pets=s.pets; torches = s.torches; placedBlocks = s.placedBlocks; machines=s.machines;
    belts=s.belts;ruins=s.ruins;farmPlots = s.farmPlots;
    enemyShots=s.enemyShots;chests=s.chests;
    waterSources=[];
    G.worldLayer=G.worldLayer|| (G.inCave?'cave':'surface');
    G.inCave=G.worldLayer==='cave';
    loadedChunkKeys=new Set();
    updateWorldChunks();
    if(initializeWildlife)spawnWildlife();
    spawnTimer = s.spawnTimer;
    particles = []; texts = []; combatFx = []; playerBullets = []; showMap=false; shake = 0;
    cam = G.mapId
      ?{x:clamp(player.x-W/2,0,WORLD_W-W),y:clamp(player.y-H/2,0,WORLD_H-H)}
      :{x:player.x-W/2,y:player.y-H/2};
    clearInput(); recalcEquipment(); panel = G.gameOver ? null : 'pause'; selectedMachine=null;
    if(typeof resetCraftingState==='function')resetCraftingState();
    protectedSaveKeys.delete(key);
    showToast(slot>0 ? '已读取存档槽 '+slot : '已恢复进度 · Esc 继续 · K 保存 · P 暂停', '#a8e0ff');
    return true;
  } catch (err){
    if(key) protectedSaveKeys.add(key);
    panel = 'pause';
    showToast('存档不可用：已保留原记录（'+err.message+'），按 R 确认重开', '#ff9090');
    console.error('[Pixel Survival] 读取存档失败', err);
    return false;
  }
}
function exportSave(slot){
  try{
    const key = saveStorageKey(slot);
    const raw = localStorage.getItem(key);
    if(!raw){showToast('没有可导出的存档','#ffb080');return false;}
    const gameSave = prepareSaveData(JSON.parse(raw));
    const backup = {format:'PixelSurvivalPlusSave',formatVersion:1,gameSave};
    const blob = new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pixel-survival-save-slot-'+slot+'-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(link);
    link.click();
    setTimeout(()=>{URL.revokeObjectURL(url);link.remove();},1000);
    showToast('存档已导出为备份文件','#9aefbd');
    return true;
  }catch(err){
    showToast('导出失败：存档不可用或浏览器不支持下载','#ff9090');
    console.error('[Pixel Survival] 导出存档失败',err);
    return false;
  }
}
function requestSaveImport(slot){
  try{saveStorageKey(slot);}catch(err){showToast(err.message,'#ffb080');return;}
  pendingImportSlot = slot;
  saveFileInput.value = '';
  saveFileInput.click();
}
async function importSaveFile(file,slot){
  try{
    if(!file)throw new Error('未选择备份文件');
    const backup = JSON.parse(await file.text());
    if(!isRecord(backup) || backup.format !== 'PixelSurvivalPlusSave' || backup.formatVersion !== 1 || !backup.gameSave){
      throw new Error('备份文件格式不受支持');
    }
    const state = prepareSaveData(backup.gameSave);
    const key = saveStorageKey(slot);
    if(!window.confirm('确认导入并覆盖目标存档？当前目标槽位中的数据将被替换。'))return false;
    const serialized = JSON.stringify(state);
    localStorage.setItem(key,serialized);
    if(localStorage.getItem(key)!==serialized)throw new Error('导入写入校验失败');
    if(slot===0)titleMenuHasSave=true;
    showToast('备份已导入；请在存档管理中读取目标槽位','#9aefbd');
    return true;
  }catch(err){
    showToast('导入失败：'+err.message,'#ff9090');
    console.error('[Pixel Survival] 导入存档失败',err);
    return false;
  }
}
saveFileInput.addEventListener('change',()=>{
  const file=saveFileInput.files && saveFileInput.files[0];
  const slot=pendingImportSlot;
  pendingImportSlot=null;
  if(file)importSaveFile(file,slot);
});
function requestRestart(){
  clearInput();
  const oldPanel = panel;
  panel = 'pause';
  if (!window.confirm('确定重新开始？当前浏览器中的本游戏存档将被新进度覆盖。')){
    panel = oldPanel;
    return;
  }
  protectedSaveKeys.delete(SAVE_KEY);
  reset(); saveGame();
}
function suspendGame(){
  clearInput();
  if(panel==='title')return;
  // 刚点开始游戏的瞬间浏览器会失焦（申请指针锁定等），这 1 秒内不弹暂停
  if (!G.gameOver && !panel && (G.totalTime || 0) > 1) panel = 'pause';
  saveGame();
}
window.addEventListener('blur', suspendGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspendGame(); });
window.addEventListener('pagehide', () => { if(panel!=='title')saveGame(); });
