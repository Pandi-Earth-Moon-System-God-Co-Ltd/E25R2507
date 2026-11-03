'use strict';

const STUDIO_MODULES = [
  {id:'block',name:'方块工坊',description:'创建可在游戏中放置的建筑方块，并保存耐久、碰撞和掉落设定。',mode:'runtime',
    fields:[['id','内容 ID','studio:my_block','idSelect'],['name','名称','新方块'],['desc','描述','由 Game Studio 创建'],['texture','上传像素贴图（PNG/JPG/WebP）','','file'],['color','主色','#8db15d','color'],['color2','阴影色','#3d7049','color'],
      ['hardness','硬度',3,'number'],['drop','掉落物 ID','wood']]},
  {id:'item',name:'物品与配方工坊',description:'创建或修改物品，并在同一页面配置其制作配方、贴图、音效和动画资源。',mode:'runtime',
    fields:[['id','内容 ID','studio:my_item','idSelect'],['name','名称','新物品'],['desc','描述','由 Game Studio 创建'],['texture','上传像素贴图（PNG/JPG/WebP）','','file'],['kind','类型','material','select',['material','food','weapon','tool','armor']],
      ['color','主色','#b58cff','color'],['color2','阴影色','#644a8b','color'],['hunger','饱食恢复',10,'number'],['hydration','水分恢复',0,'number'],
      ['heal','生命恢复',0,'number'],['dmg','武器伤害',5,'number'],['range','攻击距离',16,'number'],['def','护甲减伤 0-1',0.2,'number'],['mine','采集效率',1,'number']]},
  {id:'industry',name:'工业工坊',description:'在同一工坊编辑机器加工配方、机器方块资源，以及游戏中实际使用的机器 UI。',mode:'runtime',
    fields:[['id','机器 ID','studio:my_machine','idSelect'],['blockId','机器方块 ID','studio:my_machine_block','idSelect'],['name','机器名称','新机器'],['desc','描述','Game Studio 加工机器'],
      ['texture','上传机器方块贴图（PNG/JPG/WebP）','','file'],
      ['fuelItem','燃料物品','wood','itemSelect'],['fuelPerCraft','每批燃料数量',1,'number'],
      ['uiTitle','机器界面标题','新机器 · 加工'],['uiStatusLabel','状态栏文字','状态'],
      ['uiInputLabel','输入栏文字','输入'],['uiOutputLabel','产物栏文字','产物'],
      ['uiFuelLabel','燃料栏文字','燃料'],['uiFooter','界面说明','加工时间与电力状态'],
      ['uiBackground','界面底色','#f3e5c2','color'],['uiAccent','界面强调色','#65964d','color'],
      ['uiText','界面文字色','#5b4a32','color']]},
  {id:'character',name:'角色外观',description:'在工作室直接编辑角色外观，并可上传游戏内使用的角色像素立绘。',mode:'runtime',
    fields:[['appearance_skin','肤色','0','select',PLAYER_CUSTOMIZATION.skin.map((option,index)=>[String(index),option.name])],
      ['appearance_hairStyle','发型','0','select',PLAYER_CUSTOMIZATION.hairStyle.map((option,index)=>[String(index),option])],
      ['appearance_hairColor','发色','0','select',PLAYER_CUSTOMIZATION.hairColor.map((option,index)=>[String(index),option.name])],
      ['appearance_outfit','服装','0','select',PLAYER_CUSTOMIZATION.outfit.map((option,index)=>[String(index),option.name])],
      ['appearance_outfitStyle','服装款式','0','select',PLAYER_CUSTOMIZATION.outfitStyle.map((option,index)=>[String(index),option])],
      ['appearance_eyes','眼睛','0','select',PLAYER_CUSTOMIZATION.eyes.map((option,index)=>[String(index),option.name])],
      ['appearance_faceDetail','面部细节','0','select',PLAYER_CUSTOMIZATION.faceDetail.map((option,index)=>[String(index),option])],
      ['appearance_hat','头饰','0','select',PLAYER_CUSTOMIZATION.hat.map((option,index)=>[String(index),option])],
      ['appearance_back','背饰','0','select',PLAYER_CUSTOMIZATION.back.map((option,index)=>[String(index),option])],
      ['spriteAsset','上传角色立绘 PNG/JPG/WebP','','spriteFile']]},
  {id:'creature',name:'生物设计',description:'编辑生物属性与行为蓝图。当前版本保存并导出设计；游戏尚未提供自定义生物 AI 运行时。',mode:'blueprint',
    fields:[['id','生物 ID','studio:my_creature'],['name','名称','新生物'],['desc','图鉴描述','在此描述生物特征'],['hp','生命值',30,'number'],
      ['speed','移动速度',24,'number'],['damage','攻击伤害',6,'number'],['ai','行为类型','追击玩家','select',['巡逻','追击玩家','远程攻击','守卫区域']],
      ['drop','掉落物 ID','meat','itemSelect']]},
  {id:'world',name:'地图与生存工坊',description:'绘制实际可玩的 56×56 地图，摆放资源与出生点，并配置昼夜、季节、生存消耗和敌袭。',mode:'runtime',
    fields:[['id','地图 ID','studio:my_world'],['name','地图名称','新生存世界'],['desc','地图说明','描述地图主题与生存目标'],
      ['seed','地形种子',1,'number'],['dayLength','昼夜周期（秒/天；默认10分钟）',600,'number'],
      ['seasonDays','每季天数（2-32）',8,'number'],['hungerRate','饥饿消耗倍率（0-3）',1,'number'],
      ['thirstRate','口渴消耗倍率（0-3）',1,'number'],['enemyRate','夜间威胁倍率（0-3；0关闭）',1,'number'],
      ['startingFood','初始浆果（0-99）',3,'number'],['startingWater','初始空瓶（0-99）',2,'number']]},
  {id:'skills',name:'技能树工坊',description:'添加或调整技能节点、效果类型、经验成本、等级要求与前置节点；定义会进入 MOD 包并能在游戏内购买。',mode:'runtime',
    fields:[['id','技能 ID','studio:skill','idSelect'],['name','技能名称','新技能'],['desc','技能说明','描述技能效果'],['effect','预设战斗效果','wave','select',['spin','dash','wave','ward','nova']],
      ['level','角色等级要求',1,'number'],['xpCost','技能经验成本',25,'number'],['cost','体力消耗',20,'number'],
      ['cd','冷却秒数',6,'number'],['requires','前置技能（可多选）','','skillSelect']]},
  {id:'logic',name:'事件逻辑',description:'用受限事件与动作积木编排逻辑蓝图；不执行任意脚本，当前仅保存并导出。',mode:'blueprint',
    fields:[['id','逻辑 ID','studio:my_logic'],['name','逻辑名称','新逻辑'],['desc','说明','描述触发条件与效果'],['event','触发事件','newDay','select',['newDay','itemAdded','crafted','ruinExplored']],
      ['action','动作','提示消息','select',['提示消息','掉落物品','生成敌人','改变天气']],['value','参数','准备好迎接新的一天']]},
  {id:'media',name:'声音与画质',description:'调整程序生成的背景音乐、操作音效与动态环境特效；设置会保存在此浏览器。',mode:'settings',fields:[]},
  {id:'mods',name:'MOD 工坊',description:'查看本地内容，导出完整 MOD 包，或导入 Game Studio JSON 包。',mode:'manager',fields:[]},
];
const STUDIO_MODULE_GROUPS=[
  {name:'蓝图工坊',members:['creature','logic']},
  {name:'角色与视听',members:['character','media']},
];
const studioRoot=document.getElementById('game-studio');
const studioFileInput=document.getElementById('studio-file-input');
let studioTab='block';
let studioReturnPanel=null;
let studioWorldTiles=createStudioStarterTerrain();
let studioWorldObjects=[];
let studioWorldSpawn={x:MAP_W>>1,y:MAP_H>>1};
let studioWorldBrush='terrain:0';
let studioPendingTexture=null;
let studioPendingAssets={};
let studioEditing=null;
let studioTextureRemoval=false;
const studioTextureImages=Object.create(null);
const studioAnimationImages=Object.create(null);
let studioPlayerSpriteImage=null;

function openGameStudio(){
  if(G.gameOver)return;
  clearInput();
  studioReturnPanel=panel;
  panel='studio';
  renderGameStudio();
  studioRoot.setAttribute('aria-hidden','false');
}
function closeGameStudio(){
  studioRoot.setAttribute('aria-hidden','true');
  studioRoot.replaceChildren();
  panel=studioReturnPanel;
  studioReturnPanel=null;
  clearInput();
}
function studioEscape(value){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function createStudioStarterTerrain(){
  return Array.from({length:MAP_W*MAP_H},(_,index)=>{
    const x=index%MAP_W,y=Math.floor(index/MAP_W);
    if(y>=Math.floor(MAP_H*.62))return 3;
    if(x>=6&&x<20&&y>=5&&y<24)return 1;
    if(x>=38&&x<51&&y>=7&&y<24)return 2;
    if(x>=5&&x<12&&y>=30&&y<35)return 4;
    if(x>=40&&x<50&&y>=28&&y<34)return 5;
    return 0;
  });
}
function studioNormalizeMap(data){
  if(!Array.isArray(studioWorldTiles)||studioWorldTiles.length!==MAP_W*MAP_H||
     !studioWorldTiles.every(tile=>Number.isInteger(tile)&&tile>=0&&tile<MAP_TERRAIN.length))
    throw new Error('地图地形格数据无效');
  if(!Array.isArray(studioWorldObjects)||studioWorldObjects.length>2048||
     studioWorldObjects.some(object=>!object||!Number.isInteger(object.x)||!Number.isInteger(object.y)||
       object.x<0||object.x>=MAP_W||object.y<0||object.y>=MAP_H||
       !MAP_OBJECTS.some(type=>type.id===object.type)))
    throw new Error('地图资源摆放数据无效');
  if(!studioWorldSpawn||!Number.isInteger(studioWorldSpawn.x)||!Number.isInteger(studioWorldSpawn.y)||
     studioWorldSpawn.x<0||studioWorldSpawn.x>=MAP_W||studioWorldSpawn.y<0||studioWorldSpawn.y>=MAP_H)
    throw new Error('玩家出生点无效');
  if(studioWorldTiles[studioWorldSpawn.y*MAP_W+studioWorldSpawn.x]===4)
    throw new Error('玩家出生点不能放在水域上');
  if(!Number.isInteger(data.seed)||data.seed<0||data.seed>4294967295||
     !Number.isInteger(data.dayLength)||data.dayLength<30||data.dayLength>1800||
     !Number.isInteger(data.seasonDays)||data.seasonDays<2||data.seasonDays>32||
     !Number.isFinite(data.hungerRate)||data.hungerRate<0||data.hungerRate>3||
     !Number.isFinite(data.thirstRate)||data.thirstRate<0||data.thirstRate>3||
     !Number.isFinite(data.enemyRate)||data.enemyRate<0||data.enemyRate>3||
     !Number.isInteger(data.startingFood)||data.startingFood<0||data.startingFood>99||
     !Number.isInteger(data.startingWater)||data.startingWater<0||data.startingWater>99)
    throw new Error('生存规则超出允许范围');
  return {
    id:data.id,name:data.name.trim(),description:String(data.desc||'').slice(0,200),
    seed:data.seed,terrain:studioWorldTiles.slice(),
    objects:studioWorldObjects.map(object=>({x:object.x,y:object.y,type:object.type})),
    spawn:{x:studioWorldSpawn.x,y:studioWorldSpawn.y},
    rules:{dayLength:data.dayLength,seasonDays:data.seasonDays,
      hungerRate:data.hungerRate,thirstRate:data.thirstRate,enemyRate:data.enemyRate,
      startingFood:data.startingFood,startingWater:data.startingWater},
  };
}
function studioValidateMapDefinition(id,map){
  if(!isRecord(map)||map.id!==id||typeof map.name!=='string'||!map.name.trim()||map.name.length>48||
     typeof map.description!=='string'||map.description.length>200||
     !Number.isInteger(map.seed)||map.seed<0||map.seed>4294967295||
     !Array.isArray(map.terrain)||map.terrain.length!==MAP_W*MAP_H||
     !map.terrain.every(tile=>Number.isInteger(tile)&&tile>=0&&tile<MAP_TERRAIN.length)||
     !Array.isArray(map.objects)||map.objects.length>2048||
     map.objects.some(object=>!isRecord(object)||!Number.isInteger(object.x)||object.x<0||object.x>=MAP_W||
       !Number.isInteger(object.y)||object.y<0||object.y>=MAP_H||!MAP_OBJECTS.some(type=>type.id===object.type))||
     !isRecord(map.spawn)||!Number.isInteger(map.spawn.x)||map.spawn.x<0||map.spawn.x>=MAP_W||
     !Number.isInteger(map.spawn.y)||map.spawn.y<0||map.spawn.y>=MAP_H||!isRecord(map.rules))
    throw new Error('地图定义无效：'+id);
  if(map.terrain[map.spawn.y*MAP_W+map.spawn.x]===4)
    throw new Error('地图出生点不能位于水域：'+id);
  const rules=map.rules;
  if(!Number.isInteger(rules.dayLength)||rules.dayLength<30||rules.dayLength>1800||
     !Number.isInteger(rules.seasonDays)||rules.seasonDays<2||rules.seasonDays>32||
     !Number.isFinite(rules.hungerRate)||rules.hungerRate<0||rules.hungerRate>3||
     !Number.isFinite(rules.thirstRate)||rules.thirstRate<0||rules.thirstRate>3||
     !Number.isFinite(rules.enemyRate)||rules.enemyRate<0||rules.enemyRate>3||
     !Number.isInteger(rules.startingFood)||rules.startingFood<0||rules.startingFood>99||
     !Number.isInteger(rules.startingWater)||rules.startingWater<0||rules.startingWater>99)
    throw new Error('地图生存规则无效：'+id);
}
function studioGenerateTerrain(seed){
  const terrain=Array(MAP_W*MAP_H).fill(0);
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    const index=y*MAP_W+x;
    if(y>=Math.floor(MAP_H*.62)){
      const caveNoise=noise2(x+seed,y+seed,9);
      terrain[index]=caveNoise>.36?3:2;
      continue;
    }
    const biome=noise2(x+seed*3,y-seed*2,15);
    const water=noise2(x+seed*7,y+seed*5,4.2);
    terrain[index]=water>.79?4:biome>.78?1:biome<.12?5:biome>.68?6:0;
  }
  const spawn={x:MAP_W>>1,y:Math.floor(MAP_H*.28)};
  for(let y=spawn.y-2;y<=spawn.y+2;y++)for(let x=spawn.x-2;x<=spawn.x+2;x++)
    terrain[y*MAP_W+x]=0;
  return {terrain,spawn};
}
function studioPaintWorldCell(event,canvas){
  const rect=canvas.getBoundingClientRect();
  const x=Math.floor((event.clientX-rect.left)/rect.width*MAP_W);
  const y=Math.floor((event.clientY-rect.top)/rect.height*MAP_H);
  if(x<0||x>=MAP_W||y<0||y>=MAP_H)return;
  const index=y*MAP_W+x;
  if(studioWorldBrush==='spawn'){
    studioWorldSpawn={x,y};
  }else if(studioWorldBrush.startsWith('terrain:')){
    studioWorldTiles[index]=Number(studioWorldBrush.slice(8));
  }else{
    const type=studioWorldBrush.slice(7);
    studioWorldObjects=studioWorldObjects.filter(object=>object.x!==x||object.y!==y);
    if(type!=='erase')studioWorldObjects.push({x,y,type});
  }
  renderStudioWorldCanvas();
  renderStudioPreview();
}
function studioSetStatus(message,isError=false){
  const status=studioRoot.querySelector('.studio-status');
  if(status){status.textContent=localizeGameText(message);status.style.color=isError?'#a43e32':'#42673c';}
}
function studioItems(){
  return Object.entries(ITEMS).filter(([,item])=>item.kind!=='placeable')
    .map(([id,item])=>({id,name:item.name}));
}
function studioAllItems(){
  return Object.entries(ITEMS).map(([id,item])=>({id,name:item.name}));
}
function studioIdCatalog(){
  const entries=[];
  for(const [id,item] of Object.entries(ITEMS))
    entries.push({id,name:item.name,category:item.kind==='placeable'?'方块':'物品'});
  for(const [id,machine] of Object.entries(MACHINE_TYPES))
    entries.push({id,name:machine.name,category:'机器'});
  for(const skill of SKILLS)entries.push({id:skill.id,name:skill.name,category:'技能'});
  for(const [id,crop] of Object.entries(CROPS))entries.push({id,name:crop.name,category:'作物'});
  for(const [id,map] of Object.entries(modDefinitions.maps||{}))
    entries.push({id,name:map.name,category:'地图'});
  for(const entry of modDefinitions.studioBlueprints||[])
    entries.push({id:entry.id,name:entry.name,category:'蓝图'});
  return entries;
}
function renderStudioIdCatalog(parent){
  const details=document.createElement('details');details.className='studio-id-catalog';
  const summary=document.createElement('summary');summary.textContent='内容 ID 总览 · 点击查看可选内容';
  details.append(summary);
  const entries=studioIdCatalog();
  if(!entries.length){
    const empty=document.createElement('p');empty.className='studio-note';empty.textContent='还没有已注册内容 ID。';
    details.append(empty);
  }else{
    const groups=new Map();
    for(const entry of entries){
      if(!groups.has(entry.category))groups.set(entry.category,[]);
      groups.get(entry.category).push(entry);
    }
    for(const [category,items] of groups){
      const heading=document.createElement('strong');heading.textContent=category+'（'+items.length+'）';
      const list=document.createElement('ul');list.className='studio-id-list';
      for(const entry of items){
        const row=document.createElement('li');
        row.textContent=entry.name+' · '+entry.id;list.append(row);
      }
      details.append(heading,list);
    }
  }
  parent.append(details);
}
function drawCustomTexture(context,id,x,y,size){
  const image=studioAnimationImages[id]||studioTextureImages[id];
  if(!image||!image.complete||!image.naturalWidth)return false;
  context.save();
  context.imageSmoothingEnabled=false;
  context.drawImage(image,x,y,size,size);
  context.restore();
  return true;
}
function loadStudioTexture(id,dataUrl){
  const image=new Image();
  image.onload=()=>{studioTextureImages[id]=image;};
  image.onerror=()=>{console.warn('[Game Studio] 贴图加载失败：'+id);};
  image.src=dataUrl;
}
function studioLoadPlayerSprite(dataUrl){
  if(!dataUrl){studioPlayerSpriteImage=null;return;}
  const image=new Image();
  image.onerror=()=>console.warn('[Game Studio] 角色立绘加载失败');
  image.onload=()=>{studioPlayerSpriteImage=image;};
  image.src=dataUrl;
}
function drawCustomPlayerSprite(context,x,y){
  if(!studioPlayerSpriteImage||!studioPlayerSpriteImage.complete||!studioPlayerSpriteImage.naturalWidth)return false;
  context.save();context.imageSmoothingEnabled=false;
  context.drawImage(studioPlayerSpriteImage,Math.round(x-16),Math.round(y-45),32,48);
  context.restore();
  return true;
}
function studioApplyAssets(){
  const assets=modDefinitions.assets||{};
  const actions={},content={};
  for(const [key,value] of Object.entries(assets)){
    const action=key.match(/^action:(.+)$/);
    const item=key.match(/^content:(.+):(sound|animation)$/);
    if(action)actions[action[1]]=value;
    else if(item){
      if(!content[item[1]])content[item[1]]={};
      content[item[1]][item[2]]=value;
    }
  }
  PixelSurvivalAudio.setCustomAssets({music:assets.music||'',sound:assets.sound||'',actions,content});
  PixelSurvivalAnimations.setCustomAsset(assets.animation||'');
  studioLoadPlayerSprite(assets.playerSprite||'');
  for(const id of Object.keys(studioAnimationImages))delete studioAnimationImages[id];
  for(const [contentId,resources] of Object.entries(content)){
    if(!resources.animation)continue;
    const itemId=ITEMS[contentId]?contentId:MACHINE_TYPES[contentId]&&MACHINE_TYPES[contentId].blockItem;
    if(!itemId)continue;
    const image=new Image();
    image.onerror=()=>console.warn('[Game Studio] 内容动画加载失败：'+contentId);
    image.onload=()=>{studioAnimationImages[itemId]=image;};
    image.src=resources.animation;
  }
}
function studioAssetDefinition(key){
  const fixed={
    music:{pattern:/^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+=*$/i,max:360000},
    sound:{pattern:/^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+=*$/i,max:360000},
    animation:{pattern:/^data:image\/(?:gif|png|webp);base64,[A-Za-z0-9+/]+=*$/i,max:700000},
    playerSprite:{pattern:/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/i,max:40000},
  };
  if(fixed[key])return fixed[key];
  const action=key.match(/^action:(attack|eat|feed|breed|cave|collect|craft|machine)$/);
  if(action)return {pattern:/^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+=*$/i,max:360000};
  const content=key.match(/^content:(.+):(sound|animation)$/);
  if(content&&/^[a-zA-Z][a-zA-Z0-9_-]{1,47}:[a-zA-Z][a-zA-Z0-9_-]{1,47}$/.test(content[1]))
    return content[2]==='sound'
      ?{pattern:/^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+=*$/i,max:360000}
      :{pattern:/^data:image\/(?:gif|png|webp);base64,[A-Za-z0-9+/]+=*$/i,max:700000};
  return null;
}
function studioRestoreAssets(assets){
  modDefinitions.assets={};
  for(const [key,value] of Object.entries(assets)){
    const spec=studioAssetDefinition(key);
    if(spec&&typeof value==='string'&&value.length<=spec.max&&spec.pattern.test(value))
      modDefinitions.assets[key]=value;
    else console.warn('[Game Studio] 忽略无效或过大的资源：'+key);
  }
  studioApplyAssets();
}
function studioValidatePackageAssets(assets){
  if(assets===undefined)return {};
  if(!isRecord(assets))throw new Error('MOD 自定义资源结构无效');
  const normalized={};
  for(const [key,value] of Object.entries(assets)){
    const definition=studioAssetDefinition(key);
    if(!definition||typeof value!=='string'||value.length>definition.max||!definition.pattern.test(value))
      throw new Error('MOD 自定义资源无效：'+key);
    normalized[key]=value;
  }
  return normalized;
}
function studioStoreAsset(key,dataUrl){
  if(!studioAssetDefinition(key))throw new Error('未知资源类型：'+key);
  const previous=modDefinitions.assets[key];
  if(dataUrl)modDefinitions.assets[key]=dataUrl;
  else delete modDefinitions.assets[key];
  try{
    persistModDefinitions();
    studioApplyAssets();
  }catch(error){
    if(previous===undefined)delete modDefinitions.assets[key];
    else modDefinitions.assets[key]=previous;
    studioApplyAssets();
    throw error;
  }
}
function studioReadFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('读取文件失败'));
    reader.onload=()=>resolve(reader.result);
    reader.readAsDataURL(file);
  });
}
async function studioNormalizePlayerSprite(file){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))
    throw new Error('角色立绘请选择 PNG、JPG 或 WebP 图片');
  if(file.size>4*1024*1024)throw new Error('角色立绘原图不能超过 4 MB');
  const sourceUrl=await studioReadFile(file);
  const image=await new Promise((resolve,reject)=>{
    const source=new Image();source.onload=()=>resolve(source);
    source.onerror=()=>reject(new Error('无法解码角色立绘'));
    source.src=sourceUrl;
  });
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth>4096||image.naturalHeight>4096)
    throw new Error('角色立绘尺寸无效或超过 4096 × 4096');
  const tile=document.createElement('canvas');tile.width=32;tile.height=48;
  const context=tile.getContext('2d');context.imageSmoothingEnabled=false;
  const scale=Math.min(32/image.naturalWidth,48/image.naturalHeight);
  const width=Math.max(1,Math.round(image.naturalWidth*scale));
  const height=Math.max(1,Math.round(image.naturalHeight*scale));
  context.drawImage(image,Math.floor((32-width)/2),Math.floor((48-height)/2),width,height);
  const normalized=tile.toDataURL('image/png');
  if(normalized.length>40000)throw new Error('压缩后的角色立绘超过 40 KB');
  return normalized;
}
function restoreStudioTextures(textures){
  modDefinitions.textures={};
  for(const [id,dataUrl] of Object.entries(textures)){
    if(typeof dataUrl!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(dataUrl)||dataUrl.length>20000){
      console.warn('[Game Studio] 忽略无效或过大的贴图：'+id);
      continue;
    }
    modDefinitions.textures[id]=dataUrl;
    loadStudioTexture(id,dataUrl);
  }
}
function studioStoreTexture(id,dataUrl){
  if(!dataUrl)return;
  if(!ITEMS[id])
    throw new Error('贴图只能绑定到有效物品或方块');
  const previous=modDefinitions.textures[id];
  modDefinitions.textures[id]=dataUrl;
  try{
    persistModDefinitions();
    loadStudioTexture(id,dataUrl);
  }catch(error){
    if(previous===undefined)delete modDefinitions.textures[id];
    else modDefinitions.textures[id]=previous;
    throw error;
  }
}
function studioRemoveTexture(id){
  if(!modDefinitions.textures[id])return;
  const previous=modDefinitions.textures[id];
  delete modDefinitions.textures[id];
  try{
    persistModDefinitions();
    delete studioTextureImages[id];
  }catch(error){
    modDefinitions.textures[id]=previous;
    throw error;
  }
}
async function studioNormalizeTexture(file){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))
    throw new Error('请选择 PNG、JPG 或 WebP 图片');
  if(file.size>4*1024*1024)throw new Error('原始贴图不能超过 4 MB');
  const dataUrl=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('读取贴图失败'));
    reader.onload=()=>resolve(reader.result);
    reader.readAsDataURL(file);
  });
  const image=await new Promise((resolve,reject)=>{
    const source=new Image();
    source.onload=()=>resolve(source);
    source.onerror=()=>reject(new Error('无法解码该图片'));
    source.src=dataUrl;
  });
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth>4096||image.naturalHeight>4096)
    throw new Error('贴图尺寸无效或超过 4096 × 4096');
  const tile=document.createElement('canvas');
  tile.width=32;tile.height=32;
  const tileContext=tile.getContext('2d');
  tileContext.imageSmoothingEnabled=false;
  const scale=Math.min(32/image.naturalWidth,32/image.naturalHeight);
  const width=Math.max(1,Math.round(image.naturalWidth*scale));
  const height=Math.max(1,Math.round(image.naturalHeight*scale));
  tileContext.drawImage(image,Math.floor((32-width)/2),Math.floor((32-height)/2),width,height);
  const normalized=tile.toDataURL('image/png');
  if(normalized.length>20000)throw new Error('压缩后的贴图超过 20 KB');
  return normalized;
}
function studioField(def){
  const [key,label,value,type='text',options=[]]=def;
  const wrapper=document.createElement('label');
  wrapper.className='studio-field'+(['desc','resources','value'].includes(key)?' studio-span':'');
  const title=document.createElement('span');title.textContent=label;wrapper.append(title);
  let control;
  if(type==='select'||type==='itemSelect'||type==='craftOutputSelect'||type==='skillSelect'){
    control=document.createElement('select');
    if(type==='skillSelect')control.multiple=true;
    const values=type==='itemSelect'?studioItems().map(item=>[item.id,item.id+' · '+item.name]):
      type==='craftOutputSelect'?studioAllItems().map(item=>[item.id,item.name+' · '+item.id]):
      type==='skillSelect'?SKILLS.map(skill=>[skill.id,skill.name+' · '+skill.id]):
      options.map(option=>Array.isArray(option)?option:[option,option]);
    const selected=type==='skillSelect'
      ?new Set(Array.isArray(value)?value:String(value||'').split(',').map(entry=>entry.trim()).filter(Boolean))
      :null;
    for(const [optionValue,optionLabel] of values){
      const option=document.createElement('option');option.value=optionValue;option.textContent=optionLabel;
      option.selected=type==='skillSelect'?selected.has(optionValue):optionValue===value;control.append(option);
    }
    if(type==='skillSelect')control.addEventListener('change',()=>{
      if(control.selectedOptions.length<=5)return;
      const newest=control.selectedOptions[control.selectedOptions.length-1];newest.selected=false;
      studioSetStatus('每个技能最多选择 5 个前置技能。',true);
    });
    if(['itemSelect','craftOutputSelect'].includes(type)&&!values.some(entry=>entry[0]===value)){
      const option=document.createElement('option');option.value=value;option.textContent=value+' · 未注册';control.append(option);
    }
  }else if(type==='idSelect'){
    control=document.createElement('input');control.type='text';control.value=value;
    control.setAttribute('list','studio-id-options');
    let datalist=studioRoot.querySelector('#studio-id-options');
    if(!datalist){
      datalist=document.createElement('datalist');datalist.id='studio-id-options';
      for(const entry of studioIdCatalog()){
        const option=document.createElement('option');option.value=entry.id;
        option.label=entry.category+' · '+entry.name;datalist.append(option);
      }
      studioRoot.append(datalist);
    }
  }else if(['file','spriteFile','audioFile','animationFile'].includes(type)){
    control=document.createElement('input');control.type='file';control.accept='image/png,image/jpeg,image/webp';
    if(type==='audioFile')control.accept='audio/*';
    if(type==='animationFile')control.accept='image/gif,image/png,image/webp';
    control.setAttribute('aria-describedby','studio-texture-help');
  }else if(type==='textarea'){
    control=document.createElement('textarea');control.value=value;
  }else{
    control=document.createElement('input');control.type=type==='color'?'color':type==='number'?'number':'text';
    control.value=value;
    if(type==='number'){
      control.min='0';
      control.max=({tier:String(TECH_LEVELS.length-1),seed:'4294967295',dayLength:'1800',
        seasonDays:'32',hungerRate:'3',thirstRate:'3',enemyRate:'3',
        startingFood:'99',startingWater:'99'})[key]||'9999';
      control.step=['def','hungerRate','thirstRate','enemyRate'].includes(key)?'0.1':'1';
    }
  }
  control.name=key;control.id='studio-'+key;
  if(['file','spriteFile','audioFile','animationFile'].includes(type)){
    const help=document.createElement('small');help.id='studio-texture-help';
    help.textContent=type==='spriteFile'?'最多 4 MB；自动缩放为 32×48 PNG，随 MOD 包分享。':
      type==='audioFile'?'支持浏览器可播放的音频，最多 256 KB，保存在 MOD 包中。':
        type==='animationFile'?'支持动图 GIF、PNG、WebP，最多 512 KB；会在游戏环境中播放。':
          '最多 4 MB；自动缩放为 32×32 PNG，随 MOD 包分享。';
    wrapper.append(help);
  }
  wrapper.append(control);
  return wrapper;
}
function studioFormData(){
  const data=Object.fromEntries(new FormData(studioRoot.querySelector('form')).entries());
  const form=studioRoot.querySelector('form');
  const skillSelect=form.querySelector('[name="requires"][multiple]');
  if(skillSelect)data.requires=[...skillSelect.selectedOptions].map(option=>option.value);
  for(const key of ['texture','spriteAsset','customMusic','customSound','customAnimation','contentSound','contentAnimation'])
    delete data[key];
  for(const key of ['hardness','hunger','hydration','heal','dmg','range','def','mine','hp','speed','damage','threat',
    'duration','count','tier','craftCount','craftTier','seed','dayLength','seasonDays',
    'hungerRate','thirstRate','enemyRate','startingFood','startingWater','level','xpCost','cost','cd',
    'fuelPerCraft','recipeIndex','appearance_skin','appearance_hairStyle','appearance_hairColor','appearance_outfit',
    'appearance_outfitStyle','appearance_eyes','appearance_faceDetail','appearance_hat','appearance_back']){
    if(data[key]!==undefined)data[key]=Number(data[key]);
  }
  return data;
}
function studioValidateId(id){
  if(!/^[a-zA-Z][a-zA-Z0-9_-]{1,47}:[a-zA-Z][a-zA-Z0-9_-]{1,47}$/.test(id))
    throw new Error('ID 请使用 namespace:name 格式，例如 studio:my_item');
}
function studioBlueprintExists(kind,id){
  return modDefinitions.studioBlueprints.some(entry=>entry.kind===kind&&entry.id===id);
}
function getStudioBlockProperties(id){
  const entry=modDefinitions.studioBlueprints.find(item=>item.kind==='block-properties'&&item.id===id);
  return entry&&entry.definition||null;
}
function studioSaveCraftingRecipe(output,need,count,tier,index=''){
  if(!ITEMS[output])throw new Error('配方产物必须是已注册物品');
  studioValidateCraftingRecipe(need,count,tier,output,index);
  const definition={out:output,count,need:{...need},tier};
  if(index!==''){
    const position=Number(index),prior=modDefinitions.recipes[position];
    if(!Number.isInteger(position)||!prior)throw new Error('要编辑的配方已不存在。');
    const runtimeIndex=studioRecipeRuntimeIndex(prior);
    if(runtimeIndex<0)throw new Error('找不到游戏中对应的配方。');
    const previousRuntime=RECIPES[runtimeIndex],previousDefinition=prior;
    RECIPES[runtimeIndex]=definition;modDefinitions.recipes[position]=definition;
    try{persistModDefinitions();}
    catch(error){RECIPES[runtimeIndex]=previousRuntime;modDefinitions.recipes[position]=previousDefinition;throw error;}
    return '制作配方已更新。';
  }
  PixelSurvivalModAPI.registerRecipe(definition);
  return '制作配方已加入游戏。';
}
function studioRecipeRuntimeIndex(definition){
  return RECIPES.findIndex(recipe=>recipe.out===definition.out&&
    (recipe.count||1)===(definition.count||1)&&recipe.tier===definition.tier&&
    JSON.stringify(recipe.need)===JSON.stringify(definition.need));
}
function studioDeleteDefinition(entry){
  if(entry.kind==='配方'){
    studioRemoveCraftingRecipe(entry.recipeIndex);
    return;
  }
  const previous={
    items:{...modDefinitions.items},blocks:{...modDefinitions.blocks},
    machines:{...modDefinitions.machines},maps:modDefinitions.maps,
    recipes:modDefinitions.recipes,skillNodes:modDefinitions.skillNodes,
    machineRecipes:modDefinitions.machineRecipes,studioBlueprints:modDefinitions.studioBlueprints,
    runtimeItems:{...ITEMS},runtimeMachines:{...MACHINE_TYPES},
    runtimeRecipes:[...RECIPES],runtimeSkills:SKILLS.map(skill=>({...skill,requires:[...skill.requires]})),
    skillState:G&&G.skills?{...G.skills}:null,
    unlockedSkills:G&&G.unlockedSkills?[...G.unlockedSkills]:null,
    skillSlots:G&&G.skillSlots?[...G.skillSlots]:null,
  };
  const restoreMap=(target,snapshot)=>{
    for(const key of Object.keys(target))if(!Object.hasOwn(snapshot,key))delete target[key];
    Object.assign(target,snapshot);
  };
  const removeItem=id=>{
    delete ITEMS[id];delete modDefinitions.items[id];delete modDefinitions.blocks[id];
    const removed=modDefinitions.recipes.filter(recipe=>recipe.out===id||Object.hasOwn(recipe.need,id));
    modDefinitions.recipes=modDefinitions.recipes.filter(recipe=>!removed.includes(recipe));
    for(const recipe of removed){const index=studioRecipeRuntimeIndex(recipe);if(index>=0)RECIPES.splice(index,1);}
    modDefinitions.studioBlueprints=modDefinitions.studioBlueprints.filter(item=>
      !(item.kind==='block-properties'&&item.id===id));
  };
  try{
    if(entry.kind==='地图'){
      modDefinitions.maps={...modDefinitions.maps};delete modDefinitions.maps[entry.id];
    }else if(entry.kind==='技能'){
      SKILLS.splice(0,SKILLS.length,...SKILLS.filter(skill=>skill.id!==entry.id));
      modDefinitions.skillNodes=modDefinitions.skillNodes.filter(skill=>skill.id!==entry.id)
        .map(skill=>({...skill,requires:skill.requires.filter(id=>id!==entry.id)}));
      for(const skill of SKILLS)skill.requires=skill.requires.filter(id=>id!==entry.id);
      if(G&&G.skills)delete G.skills[entry.id];
      if(G&&G.unlockedSkills)G.unlockedSkills=G.unlockedSkills.filter(id=>id!==entry.id);
      if(G&&G.skillSlots)G.skillSlots=G.skillSlots.map(id=>id===entry.id?null:id);
    }else if(entry.kind==='机器'){
      const machine=modDefinitions.machines[entry.id];
      delete MACHINE_TYPES[entry.id];delete modDefinitions.machines[entry.id];
      modDefinitions.machineRecipes=modDefinitions.machineRecipes.filter(item=>item.machine!==entry.id);
      if(machine)removeItem(machine.blockItem);
    }else if(entry.kind==='方块'||entry.kind==='物品'){
      const machine=Object.values(modDefinitions.machines).find(item=>item.blockItem===entry.id);
      if(machine){delete MACHINE_TYPES[machine.id];delete modDefinitions.machines[machine.id];
        modDefinitions.machineRecipes=modDefinitions.machineRecipes.filter(item=>item.machine!==machine.id);}
      removeItem(entry.id);
    }
    persistModDefinitions();
  }catch(error){
    restoreMap(ITEMS,previous.runtimeItems);restoreMap(MACHINE_TYPES,previous.runtimeMachines);
    RECIPES.splice(0,RECIPES.length,...previous.runtimeRecipes);
    SKILLS.splice(0,SKILLS.length,...previous.runtimeSkills);
    Object.assign(modDefinitions,{items:previous.items,blocks:previous.blocks,machines:previous.machines,
      maps:previous.maps,recipes:previous.recipes,skillNodes:previous.skillNodes,
      machineRecipes:previous.machineRecipes,studioBlueprints:previous.studioBlueprints});
    if(G&&previous.skillState)G.skills=previous.skillState;
    if(G&&previous.unlockedSkills)G.unlockedSkills=previous.unlockedSkills;
    if(G&&previous.skillSlots)G.skillSlots=previous.skillSlots;
    throw error;
  }
}
function studioValidateCraftingRecipe(need,count,tier,output='',index=''){
  if(!Number.isInteger(count)||count<1||count>99||
     !Number.isInteger(tier)||tier<0||tier>=TECH_LEVELS.length)
    throw new Error('配方产出数量或科技等级无效');
  validateItemMap(need,'配方材料');
  if(output&&ITEMS[output]){
    const candidate={out:output,count,need,tier};
    const editing=index===''?-1:studioRecipeRuntimeIndex(modDefinitions.recipes[Number(index)]||{});
    if(RECIPES.some((recipe,position)=>position!==editing&&recipe.out===candidate.out&&
      (recipe.count||1)===candidate.count&&JSON.stringify(recipe.need)===JSON.stringify(candidate.need)))
      throw new Error('相同产物与材料组合的配方已存在。');
  }
}
function studioRemoveCraftingRecipe(index){
  const position=Number(index),definition=modDefinitions.recipes[position];
  if(!Number.isInteger(position)||!definition)throw new Error('要移除的配方已不存在。');
  const runtimeIndex=studioRecipeRuntimeIndex(definition);
  if(runtimeIndex<0)throw new Error('找不到游戏中对应的配方。');
  const previousRecipes=modDefinitions.recipes,previousRuntime=RECIPES[runtimeIndex];
  modDefinitions.recipes=previousRecipes.filter((_,entryIndex)=>entryIndex!==position);
  RECIPES.splice(runtimeIndex,1);
  try{persistModDefinitions();}
  catch(error){modDefinitions.recipes=previousRecipes;RECIPES.splice(runtimeIndex,0,previousRuntime);throw error;}
  return '制作配方已移除。';
}
function studioSaveBlueprint(kind,data,isEditing=false){
  studioValidateId(data.id);
  if(typeof data.name!=='string'||!data.name.trim()||data.name.length>48)throw new Error('请输入不超过 48 个字符的名称');
  if(data.desc!==undefined&&(typeof data.desc!=='string'||data.desc.length>200))throw new Error('说明不能超过 200 个字符');
  const existingIndex=modDefinitions.studioBlueprints.findIndex(entry=>entry.kind===kind&&entry.id===data.id);
  if(existingIndex>=0&&!isEditing)throw new Error('该蓝图 ID 已存在');
  if(isEditing&&existingIndex<0)throw new Error('要编辑的蓝图已不存在');
  data.name=data.name.trim();
  if(kind==='world'){
    try{data.terrain=JSON.parse(data.terrain);}
    catch(error){throw new Error('地形画布数据无效');}
    if(!Array.isArray(data.terrain)||data.terrain.length!==40||!data.terrain.every(tile=>tile===0||tile===1))
      throw new Error('地形画布数据无效');
  }
  if(kind==='creature'&&(!Number.isFinite(data.hp)||data.hp<1||data.hp>9999||
     !Number.isFinite(data.speed)||data.speed<0||data.speed>500||
     !Number.isFinite(data.damage)||data.damage<0||data.damage>999||!ITEMS[data.drop]||
     !['巡逻','追击玩家','远程攻击','守卫区域'].includes(data.ai)))
    throw new Error('生物属性或掉落物无效');
  if(kind==='logic'&&(!['newDay','itemAdded','crafted','ruinExplored'].includes(data.event)||
     !['提示消息','掉落物品','生成敌人','改变天气'].includes(data.action)||
     typeof data.value!=='string'||data.value.length>160))
    throw new Error('逻辑蓝图的事件、动作或参数无效');
  if(kind==='world'&&(!Number.isInteger(data.threat)||data.threat<1||data.threat>5||
     !/^#[0-9a-f]{6}$/i.test(data.color)||String(data.resources).length>200))
    throw new Error('生态区参数无效');
  const previous=modDefinitions.studioBlueprints;
  const now=Date.now();
  const blueprint={kind,id:data.id,name:data.name,description:data.desc||'',definition:data,
    createdAt:existingIndex>=0?previous[existingIndex].createdAt:now,updatedAt:now};
  if(existingIndex>=0)modDefinitions.studioBlueprints=previous.map((entry,index)=>index===existingIndex?blueprint:entry);
  else modDefinitions.studioBlueprints=[...previous,blueprint];
  try{persistModDefinitions();}
  catch(error){modDefinitions.studioBlueprints=previous;throw error;}
  return true;
}
function studioCreate(data){
  const module=STUDIO_MODULES.find(entry=>entry.id===studioTab);
  if(!module)throw new Error('未知创作模块');
  if(studioTab==='item'&&studioEditing&&studioEditing.recipeOnly){
    const message=data.craftRecipe
      ?studioSaveCraftingRecipe(data.id,data.need,data.craftCount,data.craftTier,studioEditing.id)
      :studioRemoveCraftingRecipe(studioEditing.id);
    studioEditing=null;
    return message;
  }
  const isEditing=studioEditing&&studioEditing.tab===studioTab&&studioEditing.id===data.id;
  if(studioTab!=='character'&&
     (typeof data.name!=='string'||!data.name.trim()||data.name.length>48))
    throw new Error('请输入不超过 48 个字符的名称');
  if(studioTab==='skills'){
    const requires=Array.isArray(data.requires)?data.requires:
      String(data.requires||'').split(',').map(value=>value.trim()).filter(Boolean);
    PixelSurvivalModAPI.configureSkillNode(data.id,{name:data.name.trim(),desc:data.desc,effect:data.effect,
      level:data.level,xpCost:data.xpCost,cost:data.cost,cd:data.cd,requires});
    studioEditing=null;
    return '技能节点已注册；玩家可在 N 技能树中消耗 XP 解锁。';
  }
  if(studioTab==='world'){
    studioValidateId(data.id);
    if(modDefinitions.maps[data.id]&&!isEditing)throw new Error('该地图 ID 已存在');
    const map=studioNormalizeMap(data);
    const previous=modDefinitions.maps[data.id];
    modDefinitions.maps[data.id]=map;
    try{persistModDefinitions();}
    catch(error){
      if(previous)modDefinitions.maps[data.id]=previous;
      else delete modDefinitions.maps[data.id];
      throw error;
    }
    studioEditing=null;
    return '地图和生存规则已保存；可在地图列表中开始试玩。';
  }
  if(studioTab==='block'){
    studioValidateId(data.id);
    if(ITEMS[data.id]&&!isEditing)throw new Error('该内容 ID 已被占用');
    if(!/^#[0-9a-f]{6}$/i.test(data.color)||!/^#[0-9a-f]{6}$/i.test(data.color2))throw new Error('颜色格式无效');
    if(!Number.isFinite(data.hardness)||data.hardness<1||data.hardness>100)throw new Error('硬度必须在 1 至 100 之间');
    if(!ITEMS[data.drop])throw new Error('掉落物 ID 未注册');
    const definition={name:data.name,desc:data.desc,icon:'block',color:data.color,color2:data.color2,kind:'placeable'};
    if(isEditing){
      Object.assign(ITEMS[data.id],definition);
      modDefinitions.items[data.id]={...ITEMS[data.id]};
      modDefinitions.blocks[data.id]={...ITEMS[data.id]};
      const properties={kind:'block-properties',id:data.id,name:data.name,
        definition:{hardness:data.hardness,drop:data.drop,collision:'solid'}};
      const index=modDefinitions.studioBlueprints.findIndex(entry=>entry.kind==='block-properties'&&entry.id===data.id);
      if(index<0)modDefinitions.studioBlueprints.push(properties);else modDefinitions.studioBlueprints[index]=properties;
      persistModDefinitions();
      studioEditing=null;
      return '方块属性已更新。';
    }
    PixelSurvivalModAPI.registerBlock(data.id,definition);
    PixelSurvivalModAPI.registerRecipe({out:data.id,need:{wood:4},tier:0});
    modDefinitions.studioBlueprints.push({kind:'block-properties',id:data.id,name:data.name,
      definition:{hardness:data.hardness,drop:data.drop,collision:'solid'}});
    persistModDefinitions();
    return '方块已注册，可在制作面板中制作并放置。硬度和掉落设定已保存。';
  }
  if(studioTab==='item'){
    studioValidateId(data.id);
    if(ITEMS[data.id]&&!isEditing)throw new Error('该内容 ID 已被占用');
    if(!['material','food','weapon','tool','armor'].includes(data.kind))throw new Error('物品类型无效');
    if(!/^#[0-9a-f]{6}$/i.test(data.color)||!/^#[0-9a-f]{6}$/i.test(data.color2))throw new Error('颜色格式无效');
    if(!['hunger','hydration','heal','dmg','range','def','mine'].every(key=>Number.isFinite(data[key])&&data[key]>=0))
      throw new Error('物品属性必须为非负数');
    if(data.def>0.9||data.range>200||data.dmg>999)throw new Error('伤害、距离或护甲数值超出安全范围');
    const recipeIndex=data.craftRecipeIndex||'';
    if(data.craftRecipe)studioValidateCraftingRecipe(data.need,data.craftCount,data.craftTier,data.id,recipeIndex);
    const definition={name:data.name,desc:data.desc,kind:data.kind,color:data.color,color2:data.color2,icon:'crystal'};
    if(data.kind==='food')Object.assign(definition,{hunger:data.hunger,hydration:data.hydration,heal:data.heal});
    if(data.kind==='weapon')Object.assign(definition,{dmg:data.dmg,range:data.range,cd:.45});
    if(data.kind==='tool')Object.assign(definition,{mine:data.mine,cd:.42});
    if(data.kind==='armor')definition.def=Math.min(.9,data.def);
    if(isEditing){
      Object.assign(ITEMS[data.id],definition);
      modDefinitions.items[data.id]={...ITEMS[data.id]};
      persistModDefinitions();
      const recipeMessage=data.craftRecipe?studioSaveCraftingRecipe(data.id,data.need,
        data.craftCount,data.craftTier,recipeIndex):recipeIndex?studioRemoveCraftingRecipe(recipeIndex):'';
      studioEditing=null;
      return '物品属性已更新。'+(recipeMessage?' '+recipeMessage:'');
    }
    PixelSurvivalModAPI.registerItem(data.id,definition);
    const recipeMessage=data.craftRecipe?studioSaveCraftingRecipe(data.id,data.need,data.craftCount,data.craftTier):'';
    return '物品已注册到游戏内容。'+(recipeMessage?' '+recipeMessage:'');
  }
  if(studioTab==='character'){
    const appearance={};
    for(const key of Object.keys(DEFAULT_PLAYER_APPEARANCE)){
      const value=data['appearance_'+key];
      if(!Number.isInteger(value)||value<0||value>=PLAYER_CUSTOMIZATION[key].length)
        throw new Error('人物外观选项无效：'+key);
      appearance[key]=value;
    }
    player.appearance=appearance;
    saveGame();
    studioEditing=null;
    return '人物外观已应用并保存。';
  }
  if(studioTab==='industry'){
    studioValidateId(data.id);studioValidateId(data.blockId);
    const machineDefinition=modDefinitions.machines[data.id];
    if(isEditing){
      if(!machineDefinition||!MACHINE_TYPES[data.id])throw new Error('要编辑的自定义机器不存在');
      if(machineDefinition.blockItem!==data.blockId)
        throw new Error('机器方块 ID 在创建后不能更改');
    }else if(MACHINE_TYPES[data.id]||ITEMS[data.blockId])throw new Error('机器或方块 ID 已被占用');
    if(!ITEMS[data.fuelItem]||ITEMS[data.fuelItem].kind==='placeable')throw new Error('燃料物品无效');
    if(!Number.isInteger(data.fuelPerCraft)||data.fuelPerCraft<1||data.fuelPerCraft>99||
       !Number.isFinite(data.duration)||data.duration<=0||data.duration>3600)
      throw new Error('燃料数量或加工时间无效');
    const additionalRecipes=data.extraRecipes||[];
    if(!Array.isArray(additionalRecipes)||additionalRecipes.length>12)
      throw new Error('每台机器最多支持 13 个加工配方');
    const normalizedRecipes=additionalRecipes.map(recipe=>normalizeMachineRecipe(recipe));
    const firstRecipe=normalizeMachineRecipe({id:'studio_process',name:data.name+'加工',
      input:data.mainInput,output:data.mainOutput,duration:data.duration});
    const ui=normalizeMachineUi({title:data.uiTitle,statusLabel:data.uiStatusLabel,
      inputLabel:data.uiInputLabel,outputLabel:data.uiOutputLabel,fuelLabel:data.uiFuelLabel,
      footer:data.uiFooter,background:data.uiBackground,accent:data.uiAccent,text:data.uiText});
    if(isEditing){
      const oldType=MACHINE_TYPES[data.id],oldBlock=ITEMS[data.blockId];
      const updatedBlock={...oldBlock,name:data.name,desc:data.desc};
      const oldDefinition=modDefinitions.machines[data.id];
      const oldItem=modDefinitions.items[data.blockId],oldBlockDefinition=modDefinitions.blocks[data.blockId];
      const first=oldType.recipes[0];
      if(!first)throw new Error('机器没有可编辑的加工配方');
      const recipes=[{...first,...firstRecipe,id:first.id},
        ...normalizedRecipes];
      const updated={...oldType,name:data.name,fuelItem:data.fuelItem,
        fuelPerCraft:data.fuelPerCraft,recipes,ui};
      MACHINE_TYPES[data.id]=updated;
      modDefinitions.machines[data.id]=JSON.parse(JSON.stringify(updated));
      ITEMS[data.blockId]=updatedBlock;
      modDefinitions.items[data.blockId]={...updatedBlock};
      modDefinitions.blocks[data.blockId]={...updatedBlock};
      try{persistModDefinitions();}
      catch(error){
        MACHINE_TYPES[data.id]=oldType;modDefinitions.machines[data.id]=oldDefinition;
        ITEMS[data.blockId]=oldBlock;
        if(oldItem)modDefinitions.items[data.blockId]=oldItem;
        else delete modDefinitions.items[data.blockId];
        if(oldBlockDefinition)modDefinitions.blocks[data.blockId]=oldBlockDefinition;
        else delete modDefinitions.blocks[data.blockId];
        throw error;
      }
      studioEditing=null;
      return '机器加工设置与实际游戏界面已更新。';
    }
    PixelSurvivalModAPI.registerBlock(data.blockId,{name:data.name,desc:data.desc,icon:'block',color:'#818b83',color2:'#545959'});
    PixelSurvivalModAPI.registerMachine(data.id,{name:data.name,blockItem:data.blockId,fuelItem:data.fuelItem,
      fuelPerCraft:data.fuelPerCraft,ui,
      recipes:[firstRecipe,...normalizedRecipes]});
    PixelSurvivalModAPI.registerRecipe({out:data.blockId,need:{wood:8,stone:8},tier:0});
    return '机器已注册；制作机器方块并放置，即可使用自定义机器界面加工。';
  }
  studioSaveBlueprint(studioTab,data,isEditing);
  studioEditing=null;
  return isEditing?'设计蓝图已更新。':'设计蓝图已保存至本地 MOD 数据，可在 MOD 工坊导出。该蓝图暂未接入游戏运行时。';
}
function studioCountDefinitions(){
  const defs=modDefinitions;
  return Object.entries({物品:defs.items,方块:defs.blocks,机器:defs.machines,作物:defs.crops})
    .map(([name,value])=>name+' '+Object.keys(value||{}).length)
    .concat('地图 '+Object.keys(defs.maps||{}).length,
      '贴图 '+Object.keys(modDefinitions.textures||{}).length,
      '音画资源 '+Object.keys(modDefinitions.assets||{}).length).join(' · ');
}
function studioBeginEdit(id,tab){
  const item=ITEMS[id];
  if(!item||!modDefinitions.items[id])return;
  studioEditing={id,tab};
  studioTab=tab;
  studioPendingTexture=null;
  studioTextureRemoval=false;
  renderGameStudio();
  const blockProperties=getStudioBlockProperties(id);
  const values=tab==='block'?{...item,...(blockProperties&&blockProperties.definition||{})}:item;
  for(const [key,value] of Object.entries({
    id,name:item.name,desc:item.desc,kind:item.kind,color:item.color,color2:item.color2,
    hardness:values.hardness||3,drop:values.drop||'wood',hunger:item.hunger||0,
    hydration:item.hydration||0,heal:item.heal||0,dmg:item.dmg||0,range:item.range||16,
    def:item.def||0,mine:item.mine||1,
  })){
    const control=studioRoot.querySelector('[name="'+key+'"]');
    if(control&&control.type!=='file'&&value!==undefined)control.value=value;
  }
  const idField=studioRoot.querySelector('[name="id"]');
  if(idField)idField.readOnly=true;
  if(recipeOnly){
    for(const field of STUDIO_MODULES.find(module=>module.id==='item').fields){
      const control=studioRoot.querySelector('[name="'+field[0]+'"]');
      if(control&&field[0]!=='id')control.disabled=true;
    }
    const name=studioRoot.querySelector('[name="name"]');
    if(name)name.closest('.studio-field').hidden=true;
  }
  const fileField=studioRoot.querySelector('[name="texture"]');
  if(fileField&&modDefinitions.textures[id]){
    studioPendingTexture=modDefinitions.textures[id];
    renderStudioPreview();
    studioPendingTexture=null;
    const preview=studioRoot.querySelector('.studio-texture-preview');
    if(preview)preview.src=modDefinitions.textures[id];
    addRemoveTextureButton(id);
  }
  studioSetStatus('编辑模式 · 保存后会更新本地内容库。');
  renderStudioPreview();
}
function studioBeginMapEdit(id){
  const map=modDefinitions.maps[id];
  if(!map)return;
  studioEditing={id,tab:'world'};
  studioTab='world';
  studioWorldTiles=map.terrain.slice();
  studioWorldObjects=map.objects.map(object=>({...object}));
  studioWorldSpawn={...map.spawn};
  renderGameStudio();
  for(const [key,value] of Object.entries({
    id:map.id,name:map.name,desc:map.description,seed:map.seed,
    dayLength:map.rules.dayLength,seasonDays:map.rules.seasonDays,
    hungerRate:map.rules.hungerRate,thirstRate:map.rules.thirstRate,
    enemyRate:map.rules.enemyRate,startingFood:map.rules.startingFood,
    startingWater:map.rules.startingWater,
  })){
    const field=studioRoot.querySelector('[name="'+key+'"]');
    if(field)field.value=value;
  }
  const idField=studioRoot.querySelector('[name="id"]');
  if(idField)idField.readOnly=true;
  renderStudioWorldCanvas();
  renderStudioPreview();
  studioSetStatus('编辑地图中 · 修改后保存会更新地图包。');
}
function studioStartMap(id){
  const map=modDefinitions.maps[id];
  if(!map)return studioSetStatus('找不到这张地图。',true);
  if(!window.confirm('开始试玩「'+map.name+'」？当前生存存档将被新地图覆盖。'))return;
  reset(map);
  saveGame();
  studioRoot.setAttribute('aria-hidden','true');
  studioRoot.replaceChildren();
  studioReturnPanel=null;
  panel=null;
  clearInput();
  showToast('已开始地图试玩：'+map.name,'#a8e0ff');
}
function addRemoveTextureButton(id){
  const field=studioRoot.querySelector('[name="texture"]')?.closest('.studio-field');
  if(!field||field.querySelector('.studio-remove-texture'))return;
  const button=document.createElement('button');button.type='button';
  button.className='studio-button studio-remove-texture';button.textContent='移除已上传贴图';
  button.addEventListener('click',()=>{
    try{
      studioRemoveTexture(id);
      studioTextureRemoval=true;
      studioPendingTexture=null;
      studioRoot.querySelector('.studio-texture-preview')?.remove();
      button.remove();studioSetStatus('贴图已从内容库移除。');
    }catch(error){studioSetStatus(error.message,true);}
  });
  field.append(button);
}
function studioExport(){
  const pkg={format:'PixelSurvivalGameStudioMod',version:1,apiVersion:PixelSurvivalModAPI.version,
    exportedAt:new Date().toISOString(),metadata:{...modDefinitions.modInfo},
    definitions:JSON.parse(JSON.stringify(modDefinitions))};
  const blob=new Blob([JSON.stringify(pkg,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  const modName=(modDefinitions.modInfo.name||'pixel-survival-mod').toLowerCase()
    .replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'')||'pixel-survival-mod';
  link.href=url;link.download=modName+'-'+(modDefinitions.modInfo.version||'1.0.0')+'.json';
  document.body.append(link);link.click();setTimeout(()=>{URL.revokeObjectURL(url);link.remove();},1000);
}
function studioImportPackage(defs,metadata){
  if(!isRecord(defs)||!isRecord(defs.items)||!isRecord(defs.blocks)||!isRecord(defs.machines)||
     !Array.isArray(defs.recipes)||!Array.isArray(defs.machineRecipes)||!Array.isArray(defs.studioBlueprints)||
     (defs.textures!==undefined&&!isRecord(defs.textures))||
     (defs.assets!==undefined&&!isRecord(defs.assets))||
     (defs.maps!==undefined&&!isRecord(defs.maps))||
     (defs.skillNodes!==undefined&&!Array.isArray(defs.skillNodes)))
    throw new Error('MOD 定义结构无效');
  const packageAssets=studioValidatePackageAssets(defs.assets);
  for(const [key,value] of Object.entries(packageAssets))
    if(modDefinitions.assets[key]&&modDefinitions.assets[key]!==value)
      throw new Error('自定义资源冲突：'+key);
  const plannedIds=[...Object.keys(defs.items),...Object.keys(defs.machines)];
  for(const id of plannedIds)studioValidateId(id);
  for(const [id,dataUrl] of Object.entries(defs.textures||{})){
    studioValidateId(id);
    if((!defs.items[id]&&!defs.blocks[id]&&!ITEMS[id])||typeof dataUrl!=='string'||
       !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(dataUrl)||dataUrl.length>20000)
      throw new Error('MOD 贴图无效或未关联到物品：'+id);
    if(modDefinitions.textures[id]&&modDefinitions.textures[id]!==dataUrl)
      throw new Error('贴图 ID 冲突：'+id);
  }
  if(metadata!==undefined&&(!isRecord(metadata)||
     ['name','author','version','description'].some(key=>metadata[key]!==undefined&&
       (typeof metadata[key]!=='string'||metadata[key].length>120))))
    throw new Error('MOD 团队信息无效');
  for(const [id,map] of Object.entries(defs.maps||{})){
    studioValidateId(id);
    studioValidateMapDefinition(id,map);
    if(modDefinitions.maps[id]&&!sameDefinition(modDefinitions.maps[id],map))
      throw new Error('地图 ID 冲突：'+id);
  }
  if(!window.confirm('导入 MOD 内容？现有定义不会被覆盖；导入失败前已注册的内容可能需要手动处理。'))return false;
  for(const [id,definition] of Object.entries(defs.items)){
    if(definition.kind==='placeable')continue;
    if(ITEMS[id]){
      if(!modDefinitions.items[id]||!sameDefinition(modDefinitions.items[id],definition))
        throw new Error('物品 ID 冲突：'+id);
      continue;
    }
    PixelSurvivalModAPI.registerItem(id,definition);
  }
  for(const [id,definition] of Object.entries(defs.blocks)){
    if(ITEMS[id]){
      if(!modDefinitions.blocks[id]||!sameDefinition(modDefinitions.blocks[id],definition))
        throw new Error('方块 ID 冲突：'+id);
      continue;
    }
    const blockDefinition={...definition};delete blockDefinition.machineType;
    PixelSurvivalModAPI.registerBlock(id,blockDefinition);
  }
  for(const [id,definition] of Object.entries(defs.machines)){
    if(MACHINE_TYPES[id]){
      if(!modDefinitions.machines[id]||!sameDefinition(modDefinitions.machines[id],definition))
        throw new Error('机器 ID 冲突：'+id);
      continue;
    }
    PixelSurvivalModAPI.registerMachine(id,definition);
  }
  for(const [id,definition] of Object.entries(defs.crops||{})){
    if(!modDefinitions.crops[id])PixelSurvivalModAPI.registerCrop(id,definition);
  }
  for(const recipe of defs.recipes)PixelSurvivalModAPI.registerRecipe(recipe);
  for(const entry of defs.machineRecipes||[])PixelSurvivalModAPI.registerMachineRecipe(entry.machine,entry.recipe);
  for(const tech of defs.techs||[])PixelSurvivalModAPI.registerTechnology(tech);
  const pendingSkills=[...(defs.skillNodes||[])];
  while(pendingSkills.length){
    const index=pendingSkills.findIndex(node=>node&&Array.isArray(node.requires)&&
      node.requires.every(id=>SKILLS.some(skill=>skill.id===id)));
    if(index<0)throw new Error('MOD 技能节点存在无效或循环前置关系');
    const [node]=pendingSkills.splice(index,1);
    PixelSurvivalModAPI.configureSkillNode(node.id,node);
  }
  for(const [id,dataUrl] of Object.entries(defs.textures||{})){
    modDefinitions.textures[id]=dataUrl;
    loadStudioTexture(id,dataUrl);
  }
  for(const [id,map] of Object.entries(defs.maps||{})){
    if(!modDefinitions.maps[id])modDefinitions.maps[id]=JSON.parse(JSON.stringify(map));
  }
  Object.assign(modDefinitions.assets,packageAssets);
  studioApplyAssets();
  for(const blueprint of defs.studioBlueprints||[]){
    if(!blueprint||typeof blueprint.kind!=='string'||typeof blueprint.id!=='string'||!blueprint.definition)
      throw new Error('蓝图数据无效');
    studioValidateId(blueprint.id);
    if((!STUDIO_MODULES.some(module=>module.id===blueprint.kind)&&
        !['ui','block-properties'].includes(blueprint.kind))||
       typeof blueprint.name!=='string'||blueprint.name.length>48||
       !isRecord(blueprint.definition))throw new Error('蓝图数据无效');
    if(blueprint.kind==='block-properties'&&(!Number.isFinite(blueprint.definition.hardness)||
       blueprint.definition.hardness<1||blueprint.definition.hardness>100||!ITEMS[blueprint.definition.drop]))
      throw new Error('方块属性蓝图无效');
    if(blueprint.kind==='world'&&(!Array.isArray(blueprint.definition.terrain)||
       blueprint.definition.terrain.length!==40||!blueprint.definition.terrain.every(tile=>tile===0||tile===1)))
      throw new Error('世界地形蓝图无效');
    if(!studioBlueprintExists(blueprint.kind,blueprint.id))modDefinitions.studioBlueprints.push(blueprint);
  }
  if(metadata)modDefinitions.modInfo={name:metadata.name||'',author:metadata.author||'',
    version:metadata.version||'1.0.0',description:metadata.description||''};
  persistModDefinitions();
  return true;
}
function studioBlueprintSummary(){
  const list=studioRoot.querySelector('.studio-list');
  list.replaceChildren();
  const entries=[
    ...Object.entries(modDefinitions.items).map(([id,item])=>({kind:item.kind==='placeable'?'方块':'物品',id,name:item.name,active:true})),
    ...Object.entries(modDefinitions.machines).map(([id,item])=>({kind:'机器',id,name:item.name,active:true})),
    ...Object.entries(modDefinitions.maps||{}).map(([id,map])=>({kind:'地图',id,name:map.name,active:true})),
    ...modDefinitions.recipes.map((recipe,index)=>({kind:'配方',id:'第'+(index+1)+'项',
      name:ITEMS[recipe.out]?.name||recipe.out,active:true,recipeIndex:index})),
    ...modDefinitions.skillNodes.map(skill=>({kind:'技能',id:skill.id,name:skill.name,active:true})),
    ...modDefinitions.studioBlueprints.map(entry=>({kind:entry.kind,id:entry.id,name:entry.name,active:false})),
  ];
  if(!entries.length){const empty=document.createElement('p');empty.textContent='尚无自定义内容。选择其他工坊开始创作。';list.append(empty);return;}
  for(const entry of entries){
    const row=document.createElement('li');
    const label=document.createElement('span');
    label.textContent=entry.kind+' · '+entry.name+' · '+entry.id+(entry.active?' · 已注册':' · 蓝图');
    row.append(label);
    if(!entry.active){
      if(['creature','logic'].includes(entry.kind)){
        const edit=document.createElement('button');edit.type='button';edit.className='studio-button';
        edit.textContent='编辑蓝图';edit.addEventListener('click',()=>studioBeginBlueprintEdit(entry.kind,entry.id));
        row.append(document.createTextNode(' '),edit);
      }
      const remove=document.createElement('button');remove.type='button';remove.className='studio-button';
      remove.textContent='删除蓝图';
      remove.addEventListener('click',()=>{
        const previous=modDefinitions.studioBlueprints;
        modDefinitions.studioBlueprints=previous.filter(item=>!(item.kind===entry.kind&&item.id===entry.id));
        try{persistModDefinitions();renderGameStudio();}
        catch(error){modDefinitions.studioBlueprints=previous;studioSetStatus(error.message,true);}
      });
      row.append(document.createTextNode(' '),remove);
    }else if(entry.kind==='地图'){
      const edit=document.createElement('button');edit.type='button';edit.className='studio-button';
      edit.textContent='编辑地图';edit.addEventListener('click',()=>studioBeginMapEdit(entry.id));
      const play=document.createElement('button');play.type='button';play.className='studio-button primary';
      play.textContent='试玩';play.addEventListener('click',()=>studioStartMap(entry.id));
      row.append(document.createTextNode(' '),edit,document.createTextNode(' '),play);
    }else if(entry.kind==='技能'){
      const edit=document.createElement('button');edit.type='button';edit.className='studio-button';
      edit.textContent='编辑技能';edit.addEventListener('click',()=>studioBeginSkillEdit(entry.id));
      row.append(document.createTextNode(' '),edit);
    }else if(entry.kind==='配方'){
      const edit=document.createElement('button');edit.type='button';edit.className='studio-button';
      edit.textContent='编辑配方';edit.addEventListener('click',()=>studioBeginRecipeEdit(entry.recipeIndex));
      row.append(document.createTextNode(' '),edit);
    }else if(entry.kind==='机器'){
      const edit=document.createElement('button');edit.type='button';edit.className='studio-button';
      edit.textContent='编辑机器与界面';edit.addEventListener('click',()=>studioBeginMachineEdit(entry.id));
      row.append(document.createTextNode(' '),edit);
    }else if(entry.kind==='方块'||entry.kind==='物品'){
      const edit=document.createElement('button');edit.type='button';edit.className='studio-button';
      edit.textContent='编辑内容';
      edit.addEventListener('click',()=>studioBeginEdit(entry.id,entry.kind==='方块'?'block':'item'));
      row.append(document.createTextNode(' '),edit);
    }
    if(entry.active){
      const remove=document.createElement('button');remove.type='button';remove.className='studio-button';
      remove.textContent='删除';remove.addEventListener('click',()=>{
        const confirmation=localizeGameText('确定删除 {name} 吗？此操作无法撤销。').replace('{name}',entry.name);
        if(!window.confirm(confirmation))return;
        try{studioDeleteDefinition(entry);renderGameStudio();studioSetStatus(entry.kind+'已删除。');}
        catch(error){studioSetStatus(error.message,true);}
      });
      row.append(document.createTextNode(' '),remove);
    }
    list.append(row);
  }
}
function studioBeginSkillEdit(id){
  if(!SKILLS.some(skill=>skill.id===id))throw new Error('技能节点不存在：'+id);
  studioTab='skills';studioEditing={tab:'skills',id};renderGameStudio();
}
function studioBeginRecipeEdit(index){
  if(!Number.isInteger(index)||!modDefinitions.recipes[index])throw new Error('自定义配方不存在。');
  const recipe=modDefinitions.recipes[index],item=ITEMS[recipe.out];
  if(!item)throw new Error('配方产物不存在：'+recipe.out);
  const recipeOnly=!modDefinitions.items[recipe.out];
  studioTab='item';studioEditing={tab:'item',id:recipe.out,recipeOnly,recipeIndex:index};renderGameStudio();
  for(const [key,value] of Object.entries({
    id:recipe.out,name:item.name,desc:item.desc||'',kind:item.kind||'material',
    color:item.color||'#b58cff',color2:item.color2||'#644a8b',
    hunger:item.hunger||0,hydration:item.hydration||0,heal:item.heal||0,
    dmg:item.dmg||5,range:item.range||16,def:item.def||0.2,mine:item.mine||1,
  })){
    const field=studioRoot.querySelector('[name="'+key+'"]');
    if(field&&field.type!=='file')field.value=String(value);
  }
  const idField=studioRoot.querySelector('[name="id"]');
  if(idField)idField.readOnly=true;
  const recipeIndex=studioRoot.querySelector('[name="craftRecipeIndex"]');
  if(recipeIndex)recipeIndex.value=String(index);
  const recipeToggle=studioRoot.querySelector('[name="craftRecipe"]');
  if(recipeToggle)recipeToggle.checked=true;
  for(const [key,value] of Object.entries({craftCount:recipe.count||1,craftTier:recipe.tier||0})){
    const field=studioRoot.querySelector('[name="'+key+'"]');if(field)field.value=String(value);
  }
  const rows=studioRoot.querySelector('.studio-crafting-recipe .studio-recipe-ingredients');
  if(rows){rows.replaceChildren();studioCreateIngredientRows(rows,'craft-input',recipe.need);}
  studioSetStatus('编辑物品与制作配方中 · 配方在物品工坊内管理。');
}
function studioCreateMachineRecipeRow(container,recipe={}){
  const row=document.createElement('div');row.className='studio-machine-recipe';
  row.dataset.recipeId=recipe.id||'studio_process_extra_'+Date.now()+'_'+container.children.length;
  const makeField=(title,name,value,type='text')=>{
    const label=document.createElement('label');label.className='studio-field';
    const caption=document.createElement('span');caption.textContent=title;label.append(caption);
    const control=document.createElement('input');control.type=type;
    if(type==='number'){control.min='1';control.max=name==='recipeDuration'?'3600':'99';control.step='1';}
    control.name=name;control.value=String(value);label.append(control);return label;
  };
  row.append(makeField('配方名称','recipeName',recipe.name||'新加工配方'));
  const input=document.createElement('div');input.className='studio-recipe-ingredients';
  const output=document.createElement('div');output.className='studio-recipe-ingredients';
  studioCreateIngredientRows(input,'recipe-input',recipe.input||{stone:1});
  studioCreateIngredientRows(output,'recipe-output',recipe.output||{stoneDust:1});
  row.append(ingredientGroup('输入材料',input,'recipe-input'),
    ingredientGroup('产物',output,'recipe-output'),
    makeField('加工秒数','recipeDuration',recipe.duration||5,'number'));
  row.dataset.recipeName=recipe.name||'';
  const remove=document.createElement('button');remove.type='button';remove.className='studio-button';
  remove.textContent='移除此配方';remove.addEventListener('click',()=>row.remove());
  row.append(remove);container.append(row);
}
function ingredientGroup(title,rows,prefix){
  const group=document.createElement('section');group.className='studio-ingredient-group';
  const heading=document.createElement('strong');heading.textContent=title;
  const add=document.createElement('button');add.type='button';add.className='studio-button';
  add.textContent='添加材料';
  add.addEventListener('click',()=>{
    if(rows.children.length>=12){studioSetStatus('一条配方最多支持 12 种材料。',true);return;}
    studioCreateIngredientRows(rows,prefix,{},true);
    renderStudioPreview();
  });
  group.append(heading,rows,add);return group;
}
function studioCreateIngredientRows(container,prefix,items,appendEmpty=false){
  const entries=Object.entries(items);
  if(appendEmpty||!entries.length)entries.push([studioItems()[0]?.id||'wood',1]);
  for(const [id,count] of entries){
    const row=document.createElement('div');row.className='studio-item-count-row';
    const select=document.createElement('select');select.name=prefix+'Item';
    for(const item of studioAllItems()){
      const option=document.createElement('option');option.value=item.id;
      option.textContent=item.name+' · '+item.id;option.selected=item.id===id;select.append(option);
    }
    if(!studioAllItems().some(item=>item.id===id)){
      const option=document.createElement('option');option.value=id;option.textContent=id+' · 未注册';
      option.selected=true;select.append(option);
    }
    const amount=document.createElement('input');amount.type='number';amount.name=prefix+'Count';
    amount.min='1';amount.max='99';amount.step='1';amount.value=String(count);
    const remove=document.createElement('button');remove.type='button';remove.className='studio-button';
    remove.textContent='×';remove.setAttribute('aria-label','移除此材料');
    remove.addEventListener('click',()=>{row.remove();renderStudioPreview();});
    row.append(select,amount,remove);container.append(row);
  }
}
function studioCollectIngredientMap(container,prefix,label){
  const rows=[...container.querySelectorAll('.studio-item-count-row')];
  if(!rows.length||rows.length>12)throw new Error(label+'需要 1 至 12 种材料');
  const result={};
  for(const row of rows){
    const id=row.querySelector('select').value,count=Number(row.querySelector('input').value);
    if(!ITEMS[id]||!Number.isInteger(count)||count<1||count>99)
      throw new Error(label+'包含无效物品或数量');
    result[id]=(result[id]||0)+count;
    if(result[id]>99)throw new Error(label+'中同种物品的总数量不能超过 99');
  }
  return result;
}
function renderStudioRecipeIngredientEditor(form){
  const section=document.createElement('section');section.className='studio-machine-recipes studio-span studio-crafting-recipe';
  const title=document.createElement('h3');title.textContent='制作配方';
  const rows=document.createElement('div');rows.className='studio-recipe-ingredients';
  const itemId=studioEditing&&studioEditing.tab==='item'?studioEditing.id:
    form.querySelector('[name="id"]')?.value;
  const current=studioEditing&&studioEditing.recipeOnly
    ?modDefinitions.recipes[studioEditing.recipeIndex]
    :modDefinitions.recipes.find(recipe=>recipe.out===itemId);
  const toggleLabel=document.createElement('label');toggleLabel.className='studio-recipe-toggle';
  const toggle=document.createElement('input');toggle.type='checkbox';toggle.name='craftRecipe';
  toggle.checked=Boolean(current)||!studioEditing;
  toggleLabel.append(toggle,document.createTextNode(' 同时设置此物品的制作配方'));
  const settings=document.createElement('div');settings.className='studio-recipe-settings';
  const count=studioField(['craftCount','制作产出数量',current&&current.count||1,'number']);
  const countInput=count.querySelector('input');countInput.min='1';countInput.max='99';
  const tier=studioField(['craftTier','所需科技等级',current&&current.tier||0,'number']);
  const tierInput=tier.querySelector('input');tierInput.min='0';tierInput.max=String(TECH_LEVELS.length-1);
  const hiddenIndex=document.createElement('input');hiddenIndex.type='hidden';hiddenIndex.name='craftRecipeIndex';
  hiddenIndex.value=studioEditing&&studioEditing.recipeOnly?String(studioEditing.recipeIndex):
    current?String(modDefinitions.recipes.indexOf(current)):'';
  const materials=ingredientGroup('所需材料',rows,'craft-input');
  studioCreateIngredientRows(rows,'craft-input',current&&current.need||{stone:1});
  const updateVisibility=()=>{settings.hidden=!toggle.checked;materials.hidden=!toggle.checked;};
  toggle.addEventListener('change',updateVisibility);updateVisibility();
  settings.append(count,tier);
  section.append(title,hiddenIndex,toggleLabel,settings,materials);form.append(section);
}
function studioReadContentAsset(file,type){
  if(type==='sound'){
    if(!file.type.startsWith('audio/'))throw new Error('音效请选择音频文件');
    if(file.size>256*1024)throw new Error('单个内容音效不能超过 256 KB');
    return studioReadFile(file);
  }
  if(!['image/gif','image/png','image/webp'].includes(file.type))
    throw new Error('动画请选择 GIF、PNG 或 WebP 文件');
  if(file.size>512*1024)throw new Error('单个内容动画不能超过 512 KB');
  return studioReadFile(file).then(source=>new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>{
      if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth>512||image.naturalHeight>512)
        reject(new Error('动画尺寸不能超过 512 × 512'));
      else resolve(source);
    };
    image.onerror=()=>reject(new Error('无法解码动画图片'));image.src=source;
  }));
}
function renderStudioContentAssets(form){
  if(studioEditing&&studioEditing.recipeOnly)return;
  const section=document.createElement('section');section.className='studio-machine-recipes studio-span studio-content-assets';
  const title=document.createElement('h3');title.textContent='内容资源 · 音效与动画';
  const note=document.createElement('p');note.className='studio-note';
  note.textContent='资源绑定到当前内容 ID 并随 MOD 包分享。音效可关联游戏操作；动画作为物品或机器方块贴图。生物仍是蓝图，尚无游戏内 AI。';
  section.append(title,note);
  const editingId=studioEditing&&studioEditing.tab===studioTab?studioEditing.id:'';
  for(const [type,label,accept,description] of [
    ['sound','内容操作音效','audio/*','最多 256 KB'],
    ['animation','内容动画贴图','image/gif,image/png,image/webp','GIF/PNG/WebP，最多 512 KB，尺寸不超过 512 × 512'],
  ]){
    const field=document.createElement('div');field.className='studio-field studio-span studio-content-asset';
    const caption=document.createElement('strong');caption.textContent=label;field.append(caption);
    const input=document.createElement('input');input.type='file';input.accept=accept;
    input.name=type==='sound'?'contentSound':'contentAnimation';
    const currentKey=editingId?'content:'+editingId+':'+type:'';
    const current=currentKey&&modDefinitions.assets[currentKey];
    const help=document.createElement('small');help.className='studio-note';
    help.textContent=(current?'已保存 · ':'未上传 · ')+description;
    const preview=document.createElement('div');preview.className='studio-content-asset-preview';
    const saved=studioPendingAssets[input.name]!==undefined?studioPendingAssets[input.name]:current;
    const showPreview=dataUrl=>{
      preview.replaceChildren();
      if(!dataUrl)return;
      if(type==='sound'){
        const play=document.createElement('button');play.type='button';play.className='studio-button';
        play.textContent='试听音效';
        play.addEventListener('click',()=>new Audio(dataUrl).play().catch(error=>{
          console.warn('[Game Studio] 音效预览失败',error);studioSetStatus('音效无法播放：'+error.message,true);
        }));
        preview.append(play);
      }else{
        const image=document.createElement('img');image.alt='内容动画预览';image.src=dataUrl;preview.append(image);
      }
    };
    showPreview(saved);
    const remove=document.createElement('button');remove.type='button';remove.className='studio-button';
    remove.textContent='移除已保存资源';remove.disabled=!current&&!saved;
    remove.addEventListener('click',()=>{
      studioPendingAssets[input.name]='';help.textContent='保存时将移除已有资源 · '+description;
      remove.disabled=true;preview.replaceChildren();studioSetStatus(label+'将在保存内容时移除。');
    });
    input.addEventListener('change',async()=>{
      const file=input.files&&input.files[0];if(!file)return;
      try{
        const dataUrl=await studioReadContentAsset(file,type);
        studioPendingAssets[input.name]=dataUrl;
        help.textContent='已载入 · '+file.name+' · 保存内容后应用。';
        remove.disabled=false;showPreview(dataUrl);
        studioSetStatus(file.name+'已载入；保存内容后会应用资源。');
      }catch(error){studioSetStatus(error.message,true);}
    });
    field.append(input,help,preview,remove);section.append(field);
  }
  form.append(section);
}
function renderStudioMachineRecipeEditor(form){
  const section=document.createElement('section');section.className='studio-machine-recipes studio-span';
  const title=document.createElement('h3');title.textContent='加工配方';
  const note=document.createElement('p');note.className='studio-note';
  note.textContent='这里编辑机器实际使用的输入、产物与加工时间；每条配方最多支持 12 种输入和 12 种产物。';
  const current=studioEditing&&studioEditing.tab==='industry'?MACHINE_TYPES[studioEditing.id]:null;
  const mainRecipe=current&&current.recipes[0];
  const main=document.createElement('div');main.className='studio-machine-recipe studio-main-recipe';
  const mainTitle=document.createElement('strong');mainTitle.textContent='默认加工配方';
  const inputRows=document.createElement('div');inputRows.className='studio-recipe-ingredients';
  const outputRows=document.createElement('div');outputRows.className='studio-recipe-ingredients';
  studioCreateIngredientRows(inputRows,'main-input',mainRecipe&&mainRecipe.input||{stone:1});
  studioCreateIngredientRows(outputRows,'main-output',mainRecipe&&mainRecipe.output||{stoneDust:1});
  const duration=document.createElement('label');duration.className='studio-field';
  const durationTitle=document.createElement('span');durationTitle.textContent='加工秒数';duration.append(durationTitle);
  const durationInput=document.createElement('input');durationInput.type='number';durationInput.name='duration';
  durationInput.min='1';durationInput.max='3600';durationInput.step='1';
  durationInput.value=String(mainRecipe&&mainRecipe.duration||5);duration.append(durationInput);
  main.append(mainTitle,ingredientGroup('输入材料',inputRows,'main-input'),
    ingredientGroup('产物',outputRows,'main-output'),duration);
  const rows=document.createElement('div');rows.className='studio-machine-recipe-list';
  if(current)for(const recipe of current.recipes.slice(1))
    studioCreateMachineRecipeRow(rows,recipe);
  const add=document.createElement('button');add.type='button';add.className='studio-button';
  add.textContent='添加其他加工配方';
  add.addEventListener('click',()=>{
    if(rows.children.length>=12){studioSetStatus('每台机器最多支持 13 个加工配方。',true);return;}
    studioCreateMachineRecipeRow(rows);
  });
  section.append(title,note,main,rows,add);form.append(section);
}
function studioCollectMachineRecipes(form){
  return [...form.querySelectorAll('.studio-machine-recipe:not(.studio-main-recipe)')].map(row=>{
    const input=row.querySelector('.studio-ingredient-group')&&row.querySelectorAll('.studio-ingredient-group')[0];
    const output=row.querySelectorAll('.studio-ingredient-group')[1];
    const inputMap=studioCollectIngredientMap(input,'recipe-input','机器配方输入');
    const outputMap=studioCollectIngredientMap(output,'recipe-output','机器配方产出');
    const name=row.querySelector('[name="recipeName"]').value.trim();
    const duration=Number(row.querySelector('[name="recipeDuration"]').value);
    if(!name||name.length>48||!Number.isFinite(duration)||duration<=0||duration>3600)
      throw new Error('其他加工配方名称或加工时间无效');
    return normalizeMachineRecipe({id:row.dataset.recipeId,name,input:inputMap,output:outputMap,duration});
  });
}
function studioBeginMachineEdit(id){
  const machine=modDefinitions.machines[id],type=MACHINE_TYPES[id];
  if(!machine||!type)throw new Error('自定义机器不存在：'+id);
  if(!type.recipes[0])throw new Error('此机器没有可编辑的加工配方。');
  studioTab='industry';studioEditing={tab:'industry',id};
  studioPendingTexture=null;
  studioTextureRemoval=false;
  renderGameStudio();
  const values={id,blockId:machine.blockItem,name:machine.name,
    desc:ITEMS[machine.blockItem].desc||'',fuelItem:machine.fuelItem,
    fuelPerCraft:machine.fuelPerCraft,uiTitle:type.ui&&type.ui.title||machine.name+' · 加工',
    uiStatusLabel:type.ui&&type.ui.statusLabel||'状态',uiInputLabel:type.ui&&type.ui.inputLabel||'输入',
    uiOutputLabel:type.ui&&type.ui.outputLabel||'产物',uiFuelLabel:type.ui&&type.ui.fuelLabel||'燃料',
    uiFooter:type.ui&&type.ui.footer||'加工时间与电力状态',
    uiBackground:type.ui&&type.ui.background||'#f3e5c2',
    uiAccent:type.ui&&type.ui.accent||'#65964d',uiText:type.ui&&type.ui.text||'#5b4a32'};
  for(const [key,value] of Object.entries(values)){
    const field=studioRoot.querySelector('[name="'+key+'"]');
    if(field&&field.type!=='file'&&value!==undefined)field.value=value;
  }
  studioPendingTexture=modDefinitions.textures[machine.blockItem]||null;
  for(const key of ['id','blockId']){
    const field=studioRoot.querySelector('[name="'+key+'"]');
    if(field)field.readOnly=true;
  }
  if(studioPendingTexture)addRemoveTextureButton(machine.blockItem);
  renderStudioPreview();
  studioSetStatus('编辑机器中 · 配方、外观和实际使用的机器界面都会更新。');
}
function studioBeginBlueprintEdit(kind,id){
  const blueprint=modDefinitions.studioBlueprints.find(entry=>entry.kind===kind&&entry.id===id);
  if(!blueprint||!['creature','logic'].includes(kind))throw new Error('设计蓝图不存在：'+id);
  studioTab=kind;studioEditing={tab:kind,id};renderGameStudio();
  const values={...blueprint.definition,id:blueprint.id,name:blueprint.name,
    desc:blueprint.description||blueprint.definition.desc||''};
  for(const [key,value] of Object.entries(values)){
    const field=studioRoot.querySelector('[name="'+key+'"]');
    if(field&&field.type!=='file'&&value!==undefined)field.value=Array.isArray(value)?value.join(','):value;
  }
  const idField=studioRoot.querySelector('[name="id"]');
  if(idField)idField.readOnly=true;
  studioSetStatus('编辑蓝图中 · 保存后会更新本地内容库。');
  renderStudioPreview();
}
function renderGameStudio(){
  const module=STUDIO_MODULES.find(entry=>entry.id===studioTab)||STUDIO_MODULES[0];
  studioPendingAssets={};
  studioRoot.replaceChildren();
  const windowEl=document.createElement('section');
  windowEl.className='studio-window';windowEl.setAttribute('role','dialog');windowEl.setAttribute('aria-modal','true');
  windowEl.setAttribute('aria-labelledby','studio-title');
  const header=document.createElement('header');header.className='studio-header';
  const title=document.createElement('div');title.innerHTML='<h1 id="studio-title">GAME STUDIO · 游戏创作中心</h1><p>游戏内创作、保存与分发内容</p>';
  const close=document.createElement('button');close.type='button';close.className='studio-close';close.textContent='关闭 · Esc';close.addEventListener('click',closeGameStudio);
  header.append(title,close);windowEl.append(header);
  const moduleGroup=STUDIO_MODULE_GROUPS.find(group=>group.members.includes(studioTab));
  const nav=document.createElement('nav');nav.className='studio-tabs';nav.setAttribute('aria-label','创作模块');
  const renderedGroups=new Set();
  for(const entry of STUDIO_MODULES){
    const group=STUDIO_MODULE_GROUPS.find(candidate=>candidate.members.includes(entry.id));
    if(group){
      if(renderedGroups.has(group.name))continue;
      renderedGroups.add(group.name);
    }
    const button=document.createElement('button');button.type='button';button.className='studio-tab';
    button.textContent=group?group.name:entry.name;
    button.setAttribute('aria-selected',String(group?group.members.includes(studioTab):entry.id===studioTab));
    button.addEventListener('click',()=>{
      studioTab=group?(group.members.includes(studioTab)?studioTab:group.members[0]):entry.id;
      renderGameStudio();
    });nav.append(button);
  }
  windowEl.append(nav);
  if(moduleGroup){
    const subnav=document.createElement('nav');subnav.className='studio-subtabs';
    subnav.setAttribute('aria-label',moduleGroup.name+'分类');
    for(const memberId of moduleGroup.members){
      const member=STUDIO_MODULES.find(entry=>entry.id===memberId);
      const button=document.createElement('button');button.type='button';button.className='studio-subtab';
      button.textContent=member.name;button.setAttribute('aria-selected',String(memberId===studioTab));
      button.addEventListener('click',()=>{studioTab=memberId;renderGameStudio();});
      subnav.append(button);
    }
    windowEl.append(subnav);
  }
  const content=document.createElement('div');content.className='studio-content';
  const main=document.createElement('main');main.className='studio-main';
  const heading=document.createElement('h2');heading.textContent=module.name;main.append(heading);
  const desc=document.createElement('p');desc.className='studio-description';desc.textContent=module.description;main.append(desc);
  if(module.id==='media'){
    renderStudioMediaSettings(main);
  }else if(module.id==='mods'){
    const metaForm=document.createElement('form');metaForm.className='studio-fields studio-mod-metadata';
    for(const [name,label,value] of [
      ['name','MOD 名称',modDefinitions.modInfo.name||'团队内容包'],
      ['author','作者 / 团队',modDefinitions.modInfo.author||''],
      ['version','版本号',modDefinitions.modInfo.version||'1.0.0'],
      ['description','团队备注',modDefinitions.modInfo.description||''],
    ]){
      const field=document.createElement('label');field.className='studio-field';
      const labelElement=document.createElement('span');labelElement.textContent=label;field.append(labelElement);
      const input=document.createElement('input');input.name=name;input.value=value;input.maxLength=120;
      if(name==='description')input.className='studio-span';
      field.append(input);metaForm.append(field);
    }

    const saveMetadata=document.createElement('button');saveMetadata.type='submit';saveMetadata.className='studio-button';
    saveMetadata.textContent='保存团队信息';metaForm.append(saveMetadata);
    metaForm.addEventListener('submit',event=>{
      event.preventDefault();
      const formData=Object.fromEntries(new FormData(metaForm).entries());
      if(!formData.name.trim()||!formData.author.trim())return studioSetStatus('请填写 MOD 名称和作者 / 团队。',true);
      if(!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(formData.version))return studioSetStatus('版本号请使用语义版本格式，例如 1.0.0。',true);
      const previous={...modDefinitions.modInfo};
      modDefinitions.modInfo={name:formData.name.trim(),author:formData.author.trim(),
        version:formData.version.trim(),description:formData.description.trim()};
      try{persistModDefinitions();studioSetStatus('团队与 MOD 信息已保存。');}
      catch(error){modDefinitions.modInfo=previous;studioSetStatus(error.message,true);}
    });
    main.append(metaForm);
    const list=document.createElement('ul');list.className='studio-list';main.append(list);
    const actions=document.createElement('div');actions.className='studio-actions';
    const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='studio-button primary';
    exportButton.textContent='导出 MOD 包';exportButton.addEventListener('click',()=>{try{studioExport();studioSetStatus('MOD 包已导出。');}catch(error){studioSetStatus(error.message,true);}});
    const importButton=document.createElement('button');importButton.type='button';importButton.className='studio-button blue';
    importButton.textContent='导入 MOD 包';importButton.addEventListener('click',()=>{studioFileInput.value='';studioFileInput.click();});
    actions.append(exportButton,importButton);main.append(actions);
    const note=document.createElement('p');note.className='studio-note';note.textContent='导出的 JSON MOD 包包含团队信息、内容定义和贴图；把文件交给队友后，可从这里导入。游戏内注册的方块、物品、机器和配方可直接使用。';main.append(note);
  }else{
    studioPendingTexture=null;
    const form=document.createElement('form');form.className='studio-fields';form.addEventListener('submit',event=>{
      event.preventDefault();
      try{
        const data=studioFormData();
        if(studioTab==='industry'){
          const groups=form.querySelectorAll('.studio-main-recipe .studio-ingredient-group');
          data.mainInput=studioCollectIngredientMap(groups[0],'main-input','机器配方输入');
          data.mainOutput=studioCollectIngredientMap(groups[1],'main-output','机器配方产出');
          data.extraRecipes=studioCollectMachineRecipes(form);
        }
        const craftRecipe=form.querySelector('[name="craftRecipe"]');
        if(studioTab==='item'&&craftRecipe&&craftRecipe.checked)
          data.need=studioCollectIngredientMap(
            form.querySelector('.studio-crafting-recipe .studio-ingredient-group'),
            'craft-input','配方材料');
        const pendingTexture=studioPendingTexture;
        const pendingAssets={...studioPendingAssets};
        const message=studioCreate(data);
        if(['block','item','industry','creature'].includes(studioTab)){
          for(const [field,type] of [['contentSound','sound'],['contentAnimation','animation']]){
            if(pendingAssets[field]!==undefined){
              pendingAssets['content:'+data.id+':'+type]=pendingAssets[field];
              delete pendingAssets[field];
            }
          }
        }
        const textureId=studioTab==='industry'?data.blockId:data.id;
        if(pendingTexture&&['block','item','industry'].includes(studioTab)){
          studioStoreTexture(textureId,pendingTexture);
          studioPendingTexture=null;
          studioSetStatus(message+' 已上传贴图并应用到游戏内图标。');
        }else studioSetStatus(message);
        for(const [key,value] of Object.entries(pendingAssets))studioStoreAsset(key,value);
        studioPendingAssets={};
        renderStudioPreview();
      }
      catch(error){studioSetStatus(error.message,true);}
    });
    const editingSkill=studioEditing&&studioEditing.tab==='skills'?
      SKILLS.find(skill=>skill.id===studioEditing.id):null;
    const editingBlueprint=studioEditing&&studioEditing.tab===module.id?
      modDefinitions.studioBlueprints.find(entry=>entry.kind===module.id&&entry.id===studioEditing.id):null;
    for(const fieldDef of module.fields){
      if(module.id==='industry'&&fieldDef[0]==='uiTitle'){
        const uiHeading=document.createElement('h3');uiHeading.className='studio-span';
        uiHeading.textContent='机器 UI · 实际游戏面板';
        const uiNote=document.createElement('p');uiNote.className='studio-note studio-span';
        uiNote.textContent='此处配置的是放置机器后真正打开的界面；右侧预览会随下方标题、颜色和标签变化。';
        form.append(uiHeading,uiNote);
      }
      if(editingSkill){
        const values={id:editingSkill.id,name:editingSkill.name,desc:editingSkill.desc,
          effect:editingSkill.effect||editingSkill.id,level:editingSkill.level,xpCost:editingSkill.xpCost,
          cost:editingSkill.cost,cd:editingSkill.cd,requires:editingSkill.requires};
        const [key,label,value,type,options]=fieldDef;
        form.append(studioField([key,label,values[key]===undefined?value:values[key],type,options]));
      }else if(editingBlueprint){
        const values={...editingBlueprint.definition,id:editingBlueprint.id,name:editingBlueprint.name,
          desc:editingBlueprint.description||editingBlueprint.definition.desc||''};
        const [key,label,value,type,options]=fieldDef;
        const fieldValue=values[key]===undefined?value:values[key];
        form.append(studioField([key,label,Array.isArray(fieldValue)?fieldValue.join(','):fieldValue,type,options]));
      }else if(module.id==='character'&&fieldDef[0].startsWith('appearance_')){
        const key=fieldDef[0].slice('appearance_'.length);
        const [name,label,value,type,options]=fieldDef;
        form.append(studioField([name,label,String(player.appearance&&player.appearance[key]||0),type,options]));
      }else form.append(studioField(fieldDef));
    }
    if(module.id==='industry')renderStudioMachineRecipeEditor(form);
    if(module.id==='item')renderStudioRecipeIngredientEditor(form);
    if(['block','item','industry','creature'].includes(module.id))renderStudioContentAssets(form);
    const actions=document.createElement('div');actions.className='studio-actions studio-span';
    const create=document.createElement('button');create.type='submit';create.className='studio-button primary';
    create.textContent=studioEditing&&studioEditing.tab===module.id?'保存修改':
      module.mode==='blueprint'?'保存蓝图':'创建并注册内容';
    actions.append(create);
    const back=document.createElement('button');back.type='button';back.className='studio-button';
    back.textContent='返回游戏';back.addEventListener('click',closeGameStudio);actions.append(back);
    form.append(actions);main.append(form);
    if(module.id==='world')renderStudioWorldEditor(main);
    form.addEventListener('input',renderStudioPreview);
    const textureInput=form.querySelector('[name="texture"]');
    if(textureInput)textureInput.addEventListener('change',async()=>{
      const file=textureInput.files&&textureInput.files[0];
      if(!file)return;
      try{
        studioPendingTexture=await studioNormalizeTexture(file);
        renderStudioPreview();
        studioSetStatus('贴图已载入预览；创建内容后会嵌入 MOD。');
      }catch(error){studioPendingTexture=null;studioSetStatus(error.message,true);}
    });
    const spriteInput=form.querySelector('[name="spriteAsset"]');
    if(spriteInput)spriteInput.addEventListener('change',async()=>{
      const file=spriteInput.files&&spriteInput.files[0];if(!file)return;
      try{
        studioPendingAssets.playerSprite=await studioNormalizePlayerSprite(file);
        renderStudioPreview();studioSetStatus('角色立绘已载入预览；保存人物外观后会应用到游戏。');
      }catch(error){delete studioPendingAssets.playerSprite;studioSetStatus(error.message,true);}
    });
    if(module.id==='character'&&modDefinitions.assets.playerSprite){
      const field=spriteInput.closest('.studio-field');
      const remove=document.createElement('button');remove.type='button';remove.className='studio-button';
      remove.textContent='移除已上传角色立绘';
      remove.addEventListener('click',()=>{
        try{studioStoreAsset('playerSprite','');renderStudioPreview();remove.remove();
          studioSetStatus('角色立绘已移除，恢复程序绘制外观。');}
        catch(error){studioSetStatus(error.message,true);}
      });
      field.append(remove);
    }
  }
  content.append(main);
  const preview=document.createElement('aside');preview.className='studio-preview';
  preview.innerHTML='<h3>预览与内容状态</h3><div class="studio-swatch" aria-label="颜色预览"></div><p class="studio-preview-text"></p><hr style="margin:12px 0;border:0;border-top:1px solid #b08a54"><p class="studio-definition-count">'+studioEscape(studioCountDefinitions())+'</p>';
  if(module.id==='industry'){
    const machinePreview=document.createElement('div');machinePreview.className='studio-machine-ui-preview';
    machinePreview.innerHTML='<strong class="studio-machine-ui-title"></strong><p class="studio-machine-ui-status"></p><p class="studio-machine-ui-input"></p><p class="studio-machine-ui-output"></p><small class="studio-machine-ui-footer"></small>';
    preview.append(machinePreview);
  }
  if(module.id==='world'){
    const mapPreview=document.createElement('canvas');mapPreview.className='studio-map-preview';
    mapPreview.width=112;mapPreview.height=112;mapPreview.setAttribute('aria-label','当前地图缩略图');
    preview.append(mapPreview);
    const note=document.createElement('p');note.className='studio-note';
    note.textContent='左键绘制地图；地图尺寸固定为 56×56，与当前游戏地图一致。';
    preview.append(note);
    const list=document.createElement('ul');list.className='studio-list studio-map-list';
    preview.append(list);renderStudioMapList(list);
  }
  if(module.id==='logic'){
    const graph=document.createElement('div');graph.className='studio-logic-canvas';graph.setAttribute('aria-label','事件逻辑流程预览');
    preview.append(graph);
  }
  renderStudioIdCatalog(preview);
  if(module.mode==='blueprint'){
    const hint=document.createElement('p');hint.className='studio-note';hint.style.marginTop='12px';
    hint.textContent='蓝图将保存在本机浏览器的 MOD 内容库中；从 MOD 工坊导出 JSON 包后即可备份或分享。';preview.append(hint);
  }
  content.append(preview);windowEl.append(content);
  const status=document.createElement('div');status.className='studio-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  status.textContent=module.mode==='blueprint'?'蓝图编辑模式 · 不会执行脚本或改变游戏运行规则。':
    module.id==='media'?'设置保存在当前浏览器 · 浏览器首次操作后启用音频。':'内容会保存到本地 MOD 库。';
  windowEl.append(status);
  studioRoot.append(windowEl);
  if(module.id==='mods')studioBlueprintSummary();
  if(module.id==='world')renderStudioWorldCanvas();
  renderStudioPreview();
  localizeStudioDom(studioRoot);
}

function renderStudioMediaSettings(parent){
  const settings=PixelSurvivalAudio.getSettings();
  const form=document.createElement('form');form.className='studio-fields studio-media-settings';
  const toggles=[
    ['music','背景音乐','程序生成的舒缓像素旋律；浏览器首次操作后开始播放。'],
    ['sound','操作音效','攻击、进食、喂养动物与进入洞穴时播放轻量音效。'],
    ['animations','环境动画','夜间萤火、呼吸光效、天气与物件动画。'],
  ];
  for(const [key,title,description] of toggles){
    const label=document.createElement('label');label.className='studio-field studio-media-toggle';
    const input=document.createElement('input');input.type='checkbox';input.name=key;input.checked=settings[key];
    const titleText=document.createElement('span');titleText.textContent=title;
    const help=document.createElement('small');help.textContent=description;
    label.append(input,titleText,help);form.append(label);
  }
  const volumeLabel=document.createElement('label');volumeLabel.className='studio-field studio-span';
  const volumeTitle=document.createElement('span');volumeTitle.textContent='音乐音量';
  const volume=document.createElement('input');volume.type='range';volume.name='volume';
  volume.min='0';volume.max='0.5';volume.step='0.01';volume.value=String(settings.volume);
  volumeLabel.append(volumeTitle,volume);form.append(volumeLabel);
  const qualityLabel=document.createElement('label');qualityLabel.className='studio-field';
  const qualityTitle=document.createElement('span');qualityTitle.textContent='画面质量';
  const quality=document.createElement('select');quality.name='quality';
  for(const [value,label] of [[2,'流畅 · 低'],[3,'均衡 · 中'],[4,'清晰 · 高']]){
    const option=document.createElement('option');option.value=String(value);option.textContent=label;
    option.selected=settings.quality===value;quality.append(option);
  }
  qualityLabel.append(qualityTitle,quality);form.append(qualityLabel);
  const fogLabel=document.createElement('label');fogLabel.className='studio-field';
  const fogTitle=document.createElement('span');fogTitle.textContent='远景雾效';
  const fog=document.createElement('select');fog.name='fog';
  for(const [value,label] of [[0,'关闭'],[1,'轻雾'],[2,'中雾'],[3,'浓雾']]){
    const option=document.createElement('option');option.value=String(value);option.textContent=label;
    option.selected=settings.fog===value;fog.append(option);
  }
  fogLabel.append(fogTitle,fog);form.append(fogLabel);
  for(const [key,title,accept,description] of [
    ['music','自定义背景音乐','audio/*','上传音频并循环播放；最多 256 KB。'],
    ['sound','自定义操作音效','audio/*','替换攻击、采集等操作音效；最多 256 KB。'],
    ['animation','环境动画','image/gif,image/png,image/webp','上传 GIF/PNG/WebP 动图，在游戏环境中显示；最多 512 KB。'],
  ]){
    const field=document.createElement('label');field.className='studio-field studio-span';
    const label=document.createElement('span');label.textContent=title;field.append(label);
    const input=document.createElement('input');input.type='file';input.accept=accept;input.name='asset_'+key;
    const help=document.createElement('small');help.className='studio-note';
    help.textContent=(modDefinitions.assets[key]?'已上传 · ':'尚未上传 · ')+description;
    const remove=document.createElement('button');remove.type='button';remove.className='studio-button';
    remove.textContent='移除资源';remove.disabled=!modDefinitions.assets[key];
    remove.addEventListener('click',()=>{
      try{studioStoreAsset(key,'');help.textContent='尚未上传 · '+description;remove.disabled=true;
        renderStudioPreview();studioSetStatus('已移除'+title+'。');}
      catch(error){studioSetStatus(error.message,true);}
    });
    input.addEventListener('change',async()=>{
      const file=input.files&&input.files[0];if(!file)return;
      try{
        const maxSize=key==='animation'?512*1024:256*1024;
        if(file.size>maxSize)throw new Error(title+'不能超过 '+(key==='animation'?'512 KB':'256 KB'));
        if(key==='animation'){
          if(!['image/gif','image/png','image/webp'].includes(file.type))
            throw new Error('动画请选择 GIF、PNG 或 WebP 文件');
          const source=await studioReadFile(file);
          const image=await new Promise((resolve,reject)=>{
            const candidate=new Image();candidate.onload=()=>resolve(candidate);
            candidate.onerror=()=>reject(new Error('无法解码动画图片'));
            candidate.src=source;
          });
          if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth>512||image.naturalHeight>512)
            throw new Error('动画尺寸不能超过 512 × 512');
          studioStoreAsset(key,source);
        }else{
          if(!file.type.startsWith('audio/'))throw new Error('请选择音频文件');
          studioStoreAsset(key,await studioReadFile(file));
        }
        help.textContent='已上传 · '+file.name;remove.disabled=false;
        renderStudioPreview();
        studioSetStatus(title+'已保存，并会随 MOD 包分享。');
      }catch(error){studioSetStatus(error.message,true);}
    });
    field.append(input,help,remove);form.append(field);
  }
  const actionSection=document.createElement('section');actionSection.className='studio-machine-recipes studio-span studio-action-assets';
  const actionTitle=document.createElement('h3');actionTitle.textContent='逐项自定义操作音效';
  const actionNote=document.createElement('p');actionNote.className='studio-note';
  actionNote.textContent='每种操作可单独上传音频；若对应物品也设置了专属音效，游戏会优先播放物品音效。';
  actionSection.append(actionTitle,actionNote);
  for(const [action,label] of [
    ['attack','攻击 / 采集'],['eat','进食 / 使用药剂'],['feed','喂养动物'],
    ['breed','动物繁殖'],['cave','进入洞穴'],['collect','拾取物品'],
    ['craft','完成合成'],['machine','机器加工完成'],
  ]){
    const field=document.createElement('div');field.className='studio-field studio-span studio-action-asset';
    const title=document.createElement('strong');title.textContent=label;field.append(title);
    const input=document.createElement('input');input.type='file';input.accept='audio/*';
    const key='action:'+action,existing=modDefinitions.assets[key];
    const help=document.createElement('small');help.className='studio-note';
    help.textContent=(existing?'已上传 · ':'未上传 · ')+'支持浏览器可播放格式，最多 256 KB。';
    const actions=document.createElement('div');actions.className='studio-asset-actions';
    const renderActions=dataUrl=>{
      actions.replaceChildren();
      if(!dataUrl)return;
      const play=document.createElement('button');play.type='button';play.className='studio-button';
      play.textContent='试听';play.addEventListener('click',()=>new Audio(dataUrl).play().catch(error=>{
        console.warn('[Game Studio] 操作音效预览失败',error);studioSetStatus('音效无法播放：'+error.message,true);
      }));
      actions.append(play);
      const remove=document.createElement('button');remove.type='button';remove.className='studio-button';
      remove.textContent='移除';remove.addEventListener('click',()=>{
        try{
          studioStoreAsset(key,'');help.textContent='未上传 · 支持浏览器可播放格式，最多 256 KB。';
          actions.replaceChildren();renderStudioPreview();studioSetStatus(label+'音效已移除。');
        }
        catch(error){studioSetStatus(error.message,true);}
      });
      actions.append(remove);
    };
    renderActions(existing);
    input.addEventListener('change',async()=>{
      const file=input.files&&input.files[0];if(!file)return;
      try{
        if(!file.type.startsWith('audio/'))throw new Error('请选择音频文件');
        if(file.size>256*1024)throw new Error(label+'音效不能超过 256 KB');
        const dataUrl=await studioReadFile(file);
        studioStoreAsset(key,dataUrl);
        help.textContent='已上传 · '+file.name+' · 最多 256 KB。';
        renderActions(dataUrl);renderStudioPreview();
        studioSetStatus(label+'音效已保存，并会随 MOD 包分享。');
      }catch(error){studioSetStatus(error.message,true);}
    });
    field.append(input,help,actions);actionSection.append(field);
  }
  form.append(actionSection);
  const save=document.createElement('button');save.type='submit';save.className='studio-button primary studio-span';
  save.textContent='保存音画设置';form.append(save);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const patch={music:form.elements.music.checked,sound:form.elements.sound.checked,
        animations:form.elements.animations.checked,volume:Number(form.elements.volume.value),
        quality:Number(form.elements.quality.value),fog:Number(form.elements.fog.value)};
      PixelSurvivalAudio.setSettings(patch);
      studioSetStatus('音画设置已保存；音乐会在下一次操作后播放。');
    }catch(error){studioSetStatus(error.message,true);}
  });
  parent.append(form);
}

function studioAddToolGroup(parent,title,tools,activeValue,onSelect){
  const group=document.createElement('div');group.className='studio-map-tool-group';
  const heading=document.createElement('strong');heading.textContent=title;group.append(heading);
  const buttons=document.createElement('div');buttons.className='studio-map-tools';
  for(const tool of tools){
    const button=document.createElement('button');button.type='button';
    button.className='studio-button'+(tool.id===activeValue?' active':'');
    button.dataset.toolId=tool.id;
    button.textContent=tool.name;button.setAttribute('aria-pressed',String(tool.id===activeValue));
    button.addEventListener('click',()=>onSelect(tool.id));
    buttons.append(button);
  }
  group.append(buttons);parent.append(group);
}
function renderStudioWorldEditor(parent){
  const editor=document.createElement('section');editor.className='studio-map-editor';
  editor.setAttribute('aria-label','地图绘制工具');
  const toolbar=document.createElement('div');toolbar.className='studio-map-toolbar';
  const terrainTools=MAP_TERRAIN.map((tile,index)=>({id:'terrain:'+index,name:tile.name}));
  studioAddToolGroup(toolbar,'地形笔刷',terrainTools,studioWorldBrush,value=>{
    studioWorldBrush=value;updateStudioWorldBrushButtons(toolbar);
  });
  const objectTools=[{id:'spawn',name:'玩家出生点'},...MAP_OBJECTS.filter(object=>object.id!=='water').map(object=>({id:'object:'+object.id,name:object.name})),
    {id:'object:erase',name:'擦除摆放物'}];
  studioAddToolGroup(toolbar,'对象笔刷',objectTools,studioWorldBrush,value=>{
    studioWorldBrush=value;updateStudioWorldBrushButtons(toolbar);
  });
  const actions=document.createElement('div');actions.className='studio-map-tools';
  const newMap=document.createElement('button');newMap.type='button';newMap.className='studio-button';
  newMap.textContent='新建空白地图';newMap.addEventListener('click',()=>{
    studioEditing=null;studioWorldTiles=createStudioStarterTerrain();
    studioWorldObjects=[];studioWorldSpawn={x:MAP_W>>1,y:MAP_H>>1};
    for(const [key,value] of Object.entries({
      id:'studio:my_world',name:'新生存世界',desc:'描述地图主题与生存目标',
      seed:1,dayLength:600,seasonDays:8,hungerRate:1,thirstRate:1,
      enemyRate:1,startingFood:3,startingWater:2,
    })){
      const field=studioRoot.querySelector('[name="'+key+'"]');
      if(field)field.value=value;
    }
    const idField=studioRoot.querySelector('[name="id"]');
    if(idField)idField.readOnly=false;
    renderStudioWorldCanvas();renderStudioPreview();
    studioSetStatus('新建空白地图草稿。');
  });
  actions.append(newMap);
  const randomize=document.createElement('button');randomize.type='button';randomize.className='studio-button';
  randomize.textContent='生成随机地形';randomize.addEventListener('click',()=>{
    const seedField=studioRoot.querySelector('[name="seed"]');
    const seed=Math.floor(Math.random()*4294967296);
    if(seedField)seedField.value=seed;
    const generated=studioGenerateTerrain(seed);
    studioWorldTiles=generated.terrain;studioWorldSpawn=generated.spawn;
    studioWorldObjects=[];
    renderStudioWorldCanvas();renderStudioPreview();
    studioSetStatus('已生成随机地图草稿；保存地图后即可试玩。');
  });
  const fill=document.createElement('button');fill.type='button';fill.className='studio-button';
  fill.textContent='填充地形';fill.addEventListener('click',()=>{
    if(studioWorldBrush.startsWith('terrain:')){
      studioWorldTiles.fill(Number(studioWorldBrush.slice(8)));
      renderStudioWorldCanvas();renderStudioPreview();
    }
  });
  const clearObjects=document.createElement('button');clearObjects.type='button';clearObjects.className='studio-button';
  clearObjects.textContent='清除摆放物';clearObjects.addEventListener('click',()=>{
    studioWorldObjects=[];renderStudioWorldCanvas();renderStudioPreview();
  });
  actions.append(randomize,fill,clearObjects);
  editor.append(toolbar,actions);
  const canvas=document.createElement('canvas');canvas.className='studio-map-canvas';
  canvas.width=MAP_W*10;canvas.height=MAP_H*10;
  canvas.setAttribute('aria-label','56×56 世界地图绘制画布');
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();canvas.setPointerCapture(event.pointerId);
    studioPaintWorldCell(event,canvas);
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.buttons&1)studioPaintWorldCell(event,canvas);
  });
  editor.append(canvas);
  parent.append(editor);
}
function updateStudioWorldBrushButtons(toolbar){
  toolbar.querySelectorAll('[data-tool-id]').forEach(button=>{
    const active=button.dataset.toolId===studioWorldBrush;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
}
function renderStudioWorldCanvas(){
  const canvas=studioRoot.querySelector('.studio-map-canvas');
  const preview=studioRoot.querySelector('.studio-map-preview');
  for(const target of [canvas,preview]){
    if(!target)continue;
    const context=target.getContext('2d');
    const cellWidth=target.width/MAP_W,cellHeight=target.height/MAP_H;
    for(let index=0;index<studioWorldTiles.length;index++){
      const x=index%MAP_W,y=Math.floor(index/MAP_W);
      context.fillStyle=MAP_TERRAIN[studioWorldTiles[index]]?.color||MAP_TERRAIN[0].color;
      context.fillRect(x*cellWidth,y*cellHeight,cellWidth,cellHeight);
    }
    for(const object of studioWorldObjects){
      context.fillStyle=object.type==='tree'?'#183d2d':object.type==='rock'?'#393d3c':
        object.type==='bush'?'#c06d52':object.type==='water'?'#b8e3ec':
        object.type==='chest'?'#e4b45c':'#d7c28d';
      context.fillRect(object.x*cellWidth+cellWidth*.2,object.y*cellHeight+cellHeight*.2,
        cellWidth*.6,cellHeight*.6);
    }
    context.fillStyle='#ff4d75';
    context.fillRect(studioWorldSpawn.x*cellWidth,studioWorldSpawn.y*cellHeight,cellWidth,cellHeight);
  }
}
function renderStudioMapList(list){
  list.replaceChildren();
  const maps=Object.values(modDefinitions.maps||{});
  if(!maps.length){
    const empty=document.createElement('li');empty.textContent='还没有保存的地图。';
    list.append(empty);return;
  }
  for(const map of maps){
    const row=document.createElement('li');
    const label=document.createElement('span');label.textContent=map.name+' · '+map.id;
    const edit=document.createElement('button');edit.type='button';edit.className='studio-button';
    edit.textContent='编辑';edit.addEventListener('click',()=>studioBeginMapEdit(map.id));
    const play=document.createElement('button');play.type='button';play.className='studio-button primary';
    play.textContent='试玩';play.addEventListener('click',()=>studioStartMap(map.id));
    row.append(label,document.createTextNode(' '),edit,document.createTextNode(' '),play);
    list.append(row);
  }
}
function renderStudioPreview(){
  const text=studioRoot.querySelector('.studio-preview-text');
  if(!text)return;
  const module=STUDIO_MODULES.find(entry=>entry.id===studioTab);
  const form=studioRoot.querySelector('form');
  const values=form?Object.fromEntries(new FormData(form).entries()):{};
  const name=module.id==='media'?'音画设置':(values.name||'未命名内容');
  const id=module.id==='media'?'pixel-survival-media-settings':(values.id||'studio:new_content');
  text.textContent=name+' · '+id+(module.mode==='blueprint'?' · 蓝图':' · 游戏运行时内容');
  const swatch=studioRoot.querySelector('.studio-swatch');
  if(swatch)swatch.style.background=values.color||values.uiBackground||'#8db15d';
  const machinePreview=studioRoot.querySelector('.studio-machine-ui-preview');
  if(machinePreview){
    const groups=form&&form.querySelectorAll('.studio-main-recipe .studio-ingredient-group');
    const ingredientText=group=>group?[...group.querySelectorAll('select')].map(select=>
      select.selectedOptions[0]&&select.selectedOptions[0].textContent).join(' + '):'';
    machinePreview.style.background=values.uiBackground||'#f3e5c2';
    machinePreview.style.borderColor=values.uiAccent||'#65964d';
    machinePreview.style.color=values.uiText||'#5b4a32';
    machinePreview.querySelector('.studio-machine-ui-title').textContent=values.uiTitle||values.name||'新机器';
    machinePreview.querySelector('.studio-machine-ui-status').textContent=(values.uiStatusLabel||'状态')+'：待机';
    machinePreview.querySelector('.studio-machine-ui-input').textContent=(values.uiInputLabel||'输入')+' · '+
      (ingredientText(groups&&groups[0])||'石头 · stone');
    machinePreview.querySelector('.studio-machine-ui-output').textContent=(values.uiOutputLabel||'产物')+' · '+
      (ingredientText(groups&&groups[1])||'石粉 · stoneDust');
    machinePreview.querySelector('.studio-machine-ui-footer').textContent=values.uiFooter||'加工时间与电力状态';
  }
  let texturePreview=studioRoot.querySelector('.studio-texture-preview');
  const storedTextureId=module.id==='industry'
    ?values.blockId||studioEditing&&MACHINE_TYPES[studioEditing.id]&&MACHINE_TYPES[studioEditing.id].blockItem
    :studioEditing&&studioEditing.id;
  const previewTexture=studioPendingTexture||
    (storedTextureId&&!studioTextureRemoval?modDefinitions.textures[storedTextureId]:null);
  if(previewTexture){
    if(!texturePreview){
      texturePreview=document.createElement('img');texturePreview.className='studio-texture-preview';
      texturePreview.alt=module.id==='character'?'角色立绘预览':'游戏内像素贴图预览';
      studioRoot.querySelector('.studio-preview').append(texturePreview);
    }
    texturePreview.src=previewTexture;
  }else if(texturePreview)texturePreview.remove();
  let spritePreview=studioRoot.querySelector('.studio-player-sprite-preview');
  const playerSprite=studioPendingAssets.playerSprite||modDefinitions.assets.playerSprite;
  if(module.id==='character'&&playerSprite){
    if(!spritePreview){
      spritePreview=document.createElement('img');spritePreview.className='studio-player-sprite-preview';
      spritePreview.alt='角色立绘预览';
      studioRoot.querySelector('.studio-preview').append(spritePreview);
    }
    spritePreview.src=playerSprite;
  }else if(spritePreview)spritePreview.remove();
  const count=studioRoot.querySelector('.studio-definition-count');
  if(count)count.textContent=studioCountDefinitions();
  const mapList=studioRoot.querySelector('.studio-map-list');
  if(mapList)renderStudioMapList(mapList);
  if(module.id==='world')renderStudioWorldCanvas();
  const graph=studioRoot.querySelector('.studio-logic-canvas');
  if(graph){
    graph.replaceChildren();
    for(const [label,value] of [['当事件触发',values.event||'newDay'],['执行动作',values.action||'提示消息'],['动作参数',values.value||'']]){
      const node=document.createElement('div');node.className='studio-logic-node';
      const title=document.createElement('strong');title.textContent=label;
      const text=document.createElement('span');text.textContent=value;
      node.append(title,text);graph.append(node);
    }
  }
  localizeStudioDom(studioRoot);
}
studioFileInput.addEventListener('change',async()=>{
  const file=studioFileInput.files&&studioFileInput.files[0];
  if(!file)return;
  try{
    if(file.size>8*1024*1024)throw new Error('MOD 包不能超过 8 MB');
    const pkg=JSON.parse(await file.text());
    if(!isRecord(pkg)||pkg.format!=='PixelSurvivalGameStudioMod'||pkg.version!==1)
      throw new Error('文件不是受支持的 Game Studio MOD 包');
    const imported=studioImportPackage(pkg.definitions,pkg.metadata);
    renderGameStudio();studioSetStatus(imported?'MOD 导入成功。':'已取消导入。');
  }catch(error){studioSetStatus('导入失败：'+error.message,true);console.error('[Game Studio] MOD 导入失败',error);}
});
