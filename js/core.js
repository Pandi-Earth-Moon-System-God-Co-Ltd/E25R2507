'use strict';

/* ══════════════════════════════════════════════════════════
   基础常量
   ══════════════════════════════════════════════════════════ */
const W = 480, H = 270;
let renderScale = 4;
const ATTACK_ANIM_DURATION = 0.28;
const TILE = 16;
const MAP_W = 56, MAP_H = 56;
const WORLD_W = MAP_W * TILE;
const WORLD_H = MAP_H * TILE;
const CAVE_LINE = Math.floor(MAP_H * 0.58) * TILE;
const CHUNK_TILES = 16;
const CHUNK_SIZE = CHUNK_TILES * TILE;
const ACTIVE_CHUNK_RADIUS = 2;
const MAP_TERRAIN = [
  {id:'grass',name:'草地',color:'#78a158'},
  {id:'forest',name:'森林',color:'#456b43'},
  {id:'stone',name:'岩地',color:'#818b83'},
  {id:'cave',name:'洞穴',color:'#5c5350'},
  {id:'water',name:'水域',color:'#548da0'},
  {id:'desert',name:'沙地',color:'#c6a567'},
  {id:'snow',name:'雪地',color:'#c3d0c8'},
];
const MAP_OBJECTS = [
  {id:'tree',name:'树木'},
  {id:'rock',name:'岩石'},
  {id:'bush',name:'浆果灌木'},
  {id:'water',name:'饮水点'},
  {id:'chest',name:'宝箱'},
  {id:'ruin',name:'遗迹'},
  {id:'cave',name:'洞穴入口'},
];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W * renderScale; canvas.height = H * renderScale;
ctx.scale(renderScale, renderScale);
ctx.imageSmoothingEnabled = false;
ctx.textBaseline = 'top';

const lightCv = document.createElement('canvas');
lightCv.width = W * renderScale; lightCv.height = H * renderScale;
const lctx = lightCv.getContext('2d');
lctx.scale(renderScale, renderScale);

const worldCv = document.createElement('canvas');
worldCv.width = WORLD_W; worldCv.height = WORLD_H;
const wctx = worldCv.getContext('2d');
wctx.imageSmoothingEnabled = false;
function setRenderQuality(scale){
  if(![2,3,4].includes(scale))throw new Error('画面质量无效');
  if(renderScale===scale)return;
  renderScale=scale;
  canvas.width=W*scale;canvas.height=H*scale;
  lightCv.width=W*scale;lightCv.height=H*scale;
  ctx.setTransform(scale,0,0,scale,0,0);
  lctx.setTransform(scale,0,0,scale,0,0);
  ctx.imageSmoothingEnabled=false;lctx.imageSmoothingEnabled=false;
  ctx.textBaseline='top';
}

/* ══════════════════════════════════════════════════════════
   工具
   ══════════════════════════════════════════════════════════ */
const rnd  = (a,b) => a + Math.random()*(b-a);
const rndi = (a,b) => Math.floor(a + Math.random()*(b-a+1));
const clamp = (v,a,b) => v<a?a:(v>b?b:v);
const R = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); };
const RG = (c,x,y,w,h,col) => { c.fillStyle=col; c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); };

function hash2(x, y){
  let h = Math.imul(x|0, 374761393) + Math.imul(y|0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise2(x, y, s){
  const fx = x/s, fy = y/s;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx-x0, ty = fy-y0;
  const sx = tx*tx*(3-2*tx), sy = ty*ty*(3-2*ty);
  const a = hash2(x0,y0), b = hash2(x0+1,y0);
  const c = hash2(x0,y0+1), d = hash2(x0+1,y0+1);
  return (a*(1-sx)+b*sx)*(1-sy) + (c*(1-sx)+d*sx)*sy;
}

/* ══════════════════════════════════════════════════════════
   物品定义
   ══════════════════════════════════════════════════════════ */
const EQUIPMENT_ARMOR_SLOTS = Object.freeze([
  {id:'helmet',label:'头盔'},
  {id:'chestplate',label:'胸甲'},
  {id:'leggings',label:'护腿'},
  {id:'boots',label:'鞋子'},
]);
const ITEMS = {
  wood:      { name:'木头',  icon:'log',   color:'#ba7c54', color2:'#865161', kind:'material', desc:'基础建造材料' },
  stone:     { name:'石头',  icon:'rock',  color:'#818b83', color2:'#545959', kind:'material', desc:'坚硬的石块' },
  copperOre: { name:'铜矿',  icon:'copper',color:'#d79e61', color2:'#a16159', kind:'material', desc:'可用于锻造工具的铜矿' },
  ironOre: {name:'铁矿',icon:'copper',color:'#9da89a',color2:'#6b7470',kind:'material',desc:'地下深处发现的工业金属矿石'},
  ironIngot:{name:'铁锭',icon:'copper',color:'#c1c8b9',color2:'#818b83',kind:'material',desc:'由铁矿在熔炉中冶炼的金属'},
  copperDust:{name:'铜粉',icon:'copper',color:'#eeba77',color2:'#a16159',kind:'material',desc:'粉碎铜矿得到，可在熔炉中烧结成铜锭'},
  ironDust:{name:'铁粉',icon:'copper',color:'#c1c8b9',color2:'#818b83',kind:'material',desc:'粉碎铁矿得到，可在熔炉中烧结成铁锭'},
  stoneDust:{name:'石粉',icon:'rock',color:'#9da89a',color2:'#6b7470',kind:'material',desc:'粉碎石头得到的建筑原料'},
  crystal:   { name:'荧晶',  icon:'crystal',color:'#92b2d4',color2:'#4a588e', kind:'material', desc:'在地下发光的稀有矿物' },
  copperIngot:{name:'铜锭',icon:'copper',color:'#eeba77',color2:'#ba7c54',kind:'material',desc:'由铜矿在熔炉中冶炼，可制作铜器装备'},
  bloodCore: { name:'血月核心',icon:'crystal',color:'#bd757e',color2:'#713970',kind:'material',desc:'血月骑士的核心，可锻造稀有装备' },
  fiber:     { name:'纤维',  icon:'fiber', color:'#c0d470', color2:'#78a158', kind:'material', desc:'柔韧的植物纤维' },
  berry:     { name:'浆果',  icon:'berry', color:'#a35b70', color2:'#713970', kind:'food', hunger:18, heal:0,  desc:'恢复18点饱食' },
  water:     { name:'河水',  icon:'potion',color:'#83c7dc', color2:'#3d7894', kind:'food', hunger:0, hydration:28, heal:0, bottleReturn:true, desc:'未经加热的河水，恢复28点水分；饮用后返还空瓶' },
  purifiedWater:{name:'纯净水',icon:'potion',color:'#9de9f0',color2:'#4ca3ba',kind:'food',hunger:0,hydration:65,heal:0,bottleReturn:true,desc:'熔炉烧开的纯净水，恢复65点水分；饮用后返还空瓶'},
  meat:      { name:'生肉',  icon:'meat',  color:'#bd757e', color2:'#865161', kind:'food', hunger:8,  heal:-6, desc:'生吃会损失生命' },
  cooked:    { name:'烤肉',  icon:'meat',  color:'#d79e61', color2:'#a16159', kind:'food', hunger:45, heal:15, desc:'恢复45饱食 +15生命' },
  bandage:   { name:'绷带',  icon:'band',  color:'#f3f2c0', color2:'#b2a486', kind:'food', hunger:0,  heal:35, desc:'恢复35点生命' },
  woodSword: { name:'木剑',  icon:'sword', color:'#c49a6c', color2:'#8c7369', kind:'weapon', dmg:4, range:15, cd:0.34, desc:'攻击力 +4' },
  stoneSword:{ name:'石剑',  icon:'sword', color:'#9da89a', color2:'#6b7470', kind:'weapon', dmg:8, range:17, cd:0.40, desc:'攻击力 +8' },
  steelSword:{ name:'铁剑',icon:'sword', color:'#dce0d2', color2:'#818b83', kind:'weapon', dmg:14,range:19, cd:0.46, desc:'铁锭锻造，攻击力 +14' },
  copperSword:{name:'铜刃', icon:'sword', color:'#eeba77', color2:'#a16159', kind:'weapon', dmg:11, range:18, cd:0.38, desc:'铜器时代武器，攻击力 +11' },
  crystalSword:{name:'荧晶刃',icon:'sword',color:'#d6f1cd',color2:'#4a588e',kind:'weapon',dmg:19,range:21,cd:0.34,desc:'晶核共鸣武器，攻击力 +19' },
  bloodSword:{name:'血月巨刃',icon:'sword',color:'#d99a9a',color2:'#713970',kind:'weapon',dmg:26,range:23,cd:0.48,desc:'血月核心锻造的重刃，攻击力 +26' },
  woodPickaxe:{name:'木镐',  icon:'pickaxe',color:'#c49a6c',color2:'#8c7369',kind:'tool',mine:1,cd:0.42,desc:'挖掘矿石与建材' },
  copperPickaxe:{name:'铜镐',icon:'pickaxe',color:'#eeba77',color2:'#a16159',kind:'tool',mine:2,cd:0.32,desc:'效率更高的挖掘工具' },
  woodArmor: { name:'木甲',  icon:'armor', color:'#b68962', color2:'#865161', kind:'armor', def:0.25, desc:'受到伤害减少25%' },
  stoneArmor:{ name:'石甲',  icon:'armor', color:'#818b83', color2:'#545959', kind:'armor', def:0.45, desc:'受到伤害减少45%' },
  copperArmor:{name:'铜甲',icon:'armor',color:'#d79e61',color2:'#a16159',kind:'armor',def:0.55,desc:'铜器时代护甲，受到伤害减少55%' },
  crystalArmor:{name:'荧晶甲',icon:'armor',color:'#92b2d4',color2:'#4a588e',kind:'armor',def:0.68,desc:'晶核护甲，受到伤害减少68%' },
  woodHelmet:{name:'木制头盔',icon:'armor',color:'#b68962',color2:'#865161',kind:'armor',armorSlot:'helmet',def:0.08,desc:'基础头部防具，受到伤害减少8%'},
  woodChestplate:{name:'木制胸甲',icon:'armor',color:'#ba7c54',color2:'#865161',kind:'armor',armorSlot:'chestplate',def:0.18,desc:'基础身体防具，受到伤害减少18%'},
  woodLeggings:{name:'木制护腿',icon:'armor',color:'#9b7555',color2:'#684b3e',kind:'armor',armorSlot:'leggings',def:0.1,desc:'基础腿部防具，受到伤害减少10%'},
  woodBoots:{name:'木制鞋子',icon:'armor',color:'#8e6549',color2:'#563f37',kind:'armor',armorSlot:'boots',def:0.06,desc:'基础脚部防具，受到伤害减少6%'},
  torch:     { name:'火把',  icon:'torch', color:'#eeba77', color2:'#865161', kind:'placeable', desc:'按 Q 放置，照亮夜晚' },
  woodBlock: { name:'木方块',icon:'block', color:'#ba7c54', color2:'#865161', kind:'placeable', desc:'右键放置，可再挖回' },
  stoneBlock:{ name:'石方块',icon:'block', color:'#818b83', color2:'#545959', kind:'placeable', desc:'坚固的建筑方块' },
};

Object.assign(ITEMS, {
  smallPotion:{name:'小型生命药水',icon:'potion',color:'#bd757e',color2:'#713970',kind:'food',medicine:true,heal:40,desc:'立即恢复40生命；H 快速使用'},
  largePotion:{name:'大型生命药水',icon:'potion',color:'#a35b70',color2:'#713970',kind:'food',medicine:true,heal:90,desc:'立即恢复90生命；H 快速使用'},
  regenPotion:{name:'再生药剂',icon:'potion',color:'#aed499',color2:'#67835c',kind:'food',medicine:true,effect:'regen',duration:15,desc:'15秒内每秒恢复3生命'},
  powerPotion:{name:'力量药剂',icon:'potion',color:'#eeba77',color2:'#a16159',kind:'food',medicine:true,effect:'power',duration:45,desc:'45秒内攻击力增加30%'},
  hastePotion:{name:'疾行药剂',icon:'potion',color:'#92b2d4',color2:'#4a588e',kind:'food',medicine:true,effect:'haste',duration:45,desc:'45秒内移动速度增加25%'},
});
const GROWTH = [
  {id:'vitality',name:'强健体魄',desc:'生命上限 +15，并恢复15生命',cap:10},
  {id:'power',name:'武器精通',desc:'所有武器攻击力 +2',cap:10},
  {id:'guard',name:'坚韧皮肤',desc:'护甲结算后再减伤4% / 级',cap:8},
  {id:'agility',name:'轻盈步伐',desc:'基础移速 +4%',cap:5},
  {id:'regeneration',name:'生命再生',desc:'饱食大于20时每秒回血0.15',cap:5},
  {id:'endurance',name:'充沛体力',desc:'体力上限 +10，恢复速度 +2/秒',cap:8},
  {id:'reach',name:'长臂挥击',desc:'普攻与旋风斩距离 +3像素',cap:8},
  {id:'mastery',name:'技能精通',desc:'技能伤害 +12%，冷却 -6%',cap:5},
];
Object.assign(ITEMS, {
  pistol:{name:'手枪',icon:'gun',color:'#c1c8b9',color2:'#545959',kind:'weapon',dmg:12,range:15,cd:.34,firearm:true,gunRange:180,pellets:1,spread:0,desc:'每发12伤害，射程180，消耗1弹药'},
  shotgun:{name:'霰弹枪',icon:'gun',color:'#c49a6c',color2:'#645552',kind:'weapon',dmg:8,range:15,cd:.85,firearm:true,gunRange:110,pellets:5,spread:.28,desc:'每发5颗弹丸，每颗8伤害，消耗1弹药'},
  ammo:{name:'弹药',icon:'ammo',color:'#eeba77',color2:'#a16159',kind:'material',desc:'手枪与霰弹枪通用，由铁锭和铜锭加工'},
  coin:{name:'金币',icon:'copper',color:'#f0c85e',color2:'#9e7134',kind:'material',desc:'村庄交易货币，可出售资源获得'},
  emptyBottle:{name:'空瓶',icon:'potion',color:'#d5eef0',color2:'#7da8ab',kind:'material',desc:'对准河流右键装入河水；饮用后会返还空瓶'},
  dirtyWater:{name:'瓶装河水',icon:'potion',color:'#78b7bc',color2:'#46737a',kind:'food',hunger:0,hydration:28,heal:0,bottleReturn:true,desc:'未经处理的河水；恢复28点水分，饮用后返还空瓶'},
  carrotSeed:{name:'胡萝卜种子',icon:'seed',color:'#a4c263',color2:'#67835c',kind:'seed',crop:'carrot',desc:'开垦后播种；收获胡萝卜时会返还种子'},
  wheatSeed:{name:'小麦种子',icon:'seed',color:'#d4c169',color2:'#957a4b',kind:'seed',crop:'wheat',desc:'开垦后播种；收获小麦时会返还种子'},
  carrot:{name:'胡萝卜',icon:'berry',color:'#d79e61',color2:'#a16159',kind:'food',hunger:28,heal:3,desc:'恢复28饱食与3生命'},
  wheat:{name:'小麦',icon:'fiber',color:'#eae178',color2:'#b09643',kind:'material',desc:'可制作面包，也可补充种子'},
  bread:{name:'面包',icon:'fiber',color:'#c49a6c',color2:'#8c7369',kind:'food',hunger:38,heal:5,desc:'恢复38饱食与5生命'},
  copperFurnace:{name:'铜矿熔炉',icon:'block',color:'#a16159',color2:'#645552',kind:'placeable',machineType:'copperFurnace',desc:'右键打开；放入铜矿与木头，冶炼铜锭'},
  powerGenerator:{name:'燃木发电机',icon:'block',color:'#818b83',color2:'#474a4b',kind:'placeable',machineType:'powerGenerator',desc:'燃烧木头发电；为附近机器充能'},
  solarPanel:{name:'太阳能板',icon:'block',color:'#8cbfc2',color2:'#505e77',kind:'placeable',machineType:'solarPanel',desc:'白天持续发电并为附近机器充能'},
  conveyorBelt:{name:'输送带',icon:'block',color:'#9da89a',color2:'#545959',kind:'placeable',beltType:true,desc:'按放置方向运送地面掉落物，右键现有输送带可转向'},
  powerWire:{name:'电线',icon:'block',color:'#d79e61',color2:'#645552',kind:'placeable',powerWire:true,desc:'连接发电机与机器，铺设相邻电线组成共享电网'},
  ecoGarden:{name:'生态花园',icon:'block',color:'#8db15d',color2:'#3d7049',kind:'placeable',desc:'接近放置的花园可缓慢吸收工业污染'},
  worldGate:{name:'世界核心之门',icon:'crystal',color:'#a09dd4',color2:'#4a3e72',kind:'placeable',desc:'击败巨像并研究荧晶时代后，右键开启终局挑战'},
  crusher:{name:'粉碎机',icon:'block',color:'#818b83',color2:'#474a4b',kind:'placeable',machineType:'crusher',desc:'消耗电力粉碎矿石，产出矿粉'},
  automaticHarvester:{name:'自动收割机',icon:'block',color:'#8db15d',color2:'#566560',kind:'placeable',machineType:'automaticHarvester',desc:'接入电网后自动收割附近成熟作物'},
  logisticsRouter:{name:'物流转运器',icon:'block',color:'#7ba6b4',color2:'#4a588e',kind:'placeable',machineType:'logisticsRouter',desc:'消耗电力，将背向机器的缓存转运至朝向机器'},
  relicShard:{name:'遗迹碎片',icon:'crystal',color:'#dcb98a',color2:'#8c7369',kind:'material',desc:'从地下遗迹回收的古代合金碎片'},
});
const CROPS = {
  carrot:{name:'胡萝卜',seedItem:'carrotSeed',output:'carrot',yield:2,growthSeconds:480,color:'#d79e61'},
  wheat:{name:'小麦',seedItem:'wheatSeed',output:'wheat',yield:2,growthSeconds:600,color:'#eae178'},
};
const MACHINE_TYPES = {
  copperFurnace:{
    name:'铜矿熔炉',blockItem:'copperFurnace',fuelItem:'wood',fuelPerCraft:1,
    recipes:[
      {id:'boilWater',name:'烧开河水',input:{dirtyWater:1},output:{purifiedWater:1},duration:5,energy:1},
      {id:'smeltCopper',name:'冶炼铜锭',input:{copperOre:2},output:{copperIngot:1},duration:8,energy:1},
      {id:'smeltIron',name:'冶炼铁锭',input:{ironOre:2},output:{ironIngot:1},duration:12,energy:2},
      {id:'sinterCopper',name:'烧结铜粉',input:{copperDust:4},output:{copperIngot:1},duration:7,energy:2},
      {id:'sinterIron',name:'烧结铁粉',input:{ironDust:4},output:{ironIngot:1},duration:10,energy:3},
    ],
  },
  powerGenerator:{name:'燃木发电机',blockItem:'powerGenerator',fuelItem:'wood',fuelPerCraft:0,recipes:[],generator:'fuel',capacity:100,powerPerFuel:25,fuelInterval:10},
  solarPanel:{name:'太阳能板',blockItem:'solarPanel',fuelItem:'wood',fuelPerCraft:0,recipes:[],generator:'solar',capacity:100,powerRate:0.8},
  crusher:{
    name:'粉碎机',blockItem:'crusher',fuelItem:'wood',fuelPerCraft:0,capacity:100,
    recipes:[
      {id:'crushCopper',name:'粉碎铜矿',input:{copperOre:2},output:{copperDust:4},duration:6,energy:4},
      {id:'crushIron',name:'粉碎铁矿',input:{ironOre:2},output:{ironDust:4},duration:8,energy:5},
      {id:'crushStone',name:'粉碎石头',input:{stone:3},output:{stoneDust:2},duration:5,energy:3},
    ],
  },
  automaticHarvester:{
    name:'自动收割机',blockItem:'automaticHarvester',fuelItem:'wood',fuelPerCraft:0,capacity:100,
    recipes:[],harvester:true,range:TILE*4,harvestInterval:3,harvestEnergy:2,
  },
  logisticsRouter:{
    name:'物流转运器',blockItem:'logisticsRouter',fuelItem:'wood',fuelPerCraft:0,capacity:100,
    recipes:[],itemRouter:true,transferInterval:1,transferEnergy:1,
  },
};
const BASE_MELEE_REACH = 24;
const HOTBAR_SIZE = 9;
let hotbar = Array(HOTBAR_SIZE).fill(null);
const SEASONS = [
  {name:'春季',short:'春',temp:0,thirst:1,crop:1.2},
  {name:'夏季',short:'夏',temp:2,thirst:1.45,crop:1.5},
  {name:'秋季',short:'秋',temp:-1,thirst:1,crop:1.1},
  {name:'冬季',short:'冬',temp:-5,thirst:1.15,crop:0},
];
const WEATHER_NAMES = {clear:'晴',rain:'春雨',heatwave:'热浪',drought:'干旱',harvest:'丰收',blizzard:'暴雪'};
function getSeasonLength(){ return G&&G.rules&&Number.isInteger(G.rules.seasonDays)?G.rules.seasonDays:8; }
function getYearLength(){ return getSeasonLength()*SEASONS.length; }
function getSeasonIndex(day=G.day){ return Math.floor(((day-1)%getYearLength())/getSeasonLength()); }
function getSeasonDay(day=G.day){ return ((day-1)%getSeasonLength())+1; }
function getEcology(){ return clamp(100-(G.pollution||0)/15,0,100); }
const TECH_LEVELS = [
  { name:'原始时代', unlock:'木石工具、基础装备、建材、农业种子与面包' },
  { name:'铜器时代', unlock:'铜镐、铜器装备、铁剑、霰弹枪与铜阶药剂', day:3, kills:6, cost:{ copperOre:8, wood:12 } },
  { name:'荧晶时代', unlock:'荧晶武器、荧晶护甲与血月巨刃', day:7, kills:15, cost:{ crystal:5, copperIngot:18 } },
];

const RECIPES = [
  { out:'woodPickaxe', need:{ wood:6, stone:3 }, tier:0 },
  { out:'copperPickaxe', need:{ wood:2, copperIngot:3 }, tier:1 },
  { out:'woodSword',  need:{ wood:8 }, tier:0 },
  { out:'stoneSword', need:{ wood:4, stone:10 }, tier:0 },
  { out:'woodArmor',  need:{ wood:6, fiber:4 }, tier:0 },
  { out:'stoneArmor', need:{ stone:12, fiber:6 }, tier:0 },
  { out:'woodHelmet',need:{wood:3,fiber:2},tier:0 },
  { out:'woodChestplate',need:{wood:6,fiber:3},tier:0 },
  { out:'woodLeggings',need:{wood:4,fiber:2},tier:0 },
  { out:'woodBoots',need:{wood:2,fiber:2},tier:0 },
  { out:'copperSword', need:{ wood:5, copperIngot:4 }, tier:1 },
  { out:'copperArmor', need:{ copperIngot:6, fiber:6 }, tier:1 },
  { out:'steelSword', need:{ wood:4, ironIngot:4 }, tier:1 },
  { out:'crystalSword', need:{ crystal:6, copperIngot:5 }, tier:2 },
  { out:'crystalArmor', need:{ crystal:8, copperIngot:6, fiber:8 }, tier:2 },
  { out:'bloodSword', need:{ bloodCore:3, crystal:6 }, tier:2 },
  { out:'torch',      need:{ wood:2, fiber:1 }, tier:0 },
  { out:'bandage',    need:{ fiber:3 }, tier:0 },
  { out:'cooked',     need:{ meat:1, wood:1 }, tier:0 },
  { out:'woodBlock',  count:4, need:{ wood:1 }, tier:0 },
  { out:'stoneBlock', count:4, need:{ stone:1 }, tier:0 },
];

RECIPES.push(
  {out:'smallPotion',need:{berry:3,fiber:2},tier:0},
  {out:'largePotion',need:{smallPotion:2,crystal:1},tier:1},
  {out:'regenPotion',need:{berry:2,fiber:4},tier:0},
  {out:'powerPotion',need:{meat:2,copperOre:2},tier:1},
  {out:'hastePotion',need:{berry:3,copperOre:1},tier:1},
  {out:'pistol',need:{wood:6,ironIngot:2,copperIngot:2},tier:1},
  {out:'shotgun',need:{wood:8,ironIngot:5,copperIngot:3,fiber:4},tier:1},
  {out:'ammo',count:12,need:{ironIngot:1,copperIngot:1},tier:1},
  {out:'bread',need:{wheat:3},tier:0},
  {out:'copperFurnace',need:{wood:10,stone:12},tier:0},
  {out:'powerGenerator',need:{wood:12,stone:10,copperIngot:4},tier:1},
  {out:'solarPanel',need:{wood:6,stone:8,copperIngot:5,crystal:2},tier:2},
  {out:'conveyorBelt',count:4,need:{wood:3,stone:2,copperIngot:1},tier:1},
  {out:'powerWire',count:8,need:{copperIngot:1,fiber:2},tier:1},
  {out:'crusher',need:{wood:12,stone:14,copperIngot:3},tier:1},
  {out:'automaticHarvester',need:{wood:12,stone:8,copperIngot:4},tier:1},
  {out:'logisticsRouter',need:{wood:8,stone:6,copperIngot:2},tier:1},
  {out:'ecoGarden',need:{wood:10,fiber:8,copperIngot:2},tier:1},
  {out:'worldGate',need:{relicShard:8,crystal:10,bloodCore:3},tier:2},
  {out:'stoneBlock',count:4,need:{stoneDust:4},tier:0},
);

/* ══════════════════════════════════════════════════════════
   全局状态
   ══════════════════════════════════════════════════════════ */
let trees, rocks, bushes, pickups, enemies, particles, texts, torches, placedBlocks, machines, belts, ruins, waterSources, animals, pets;
let villagers=[],villageHouses=[],selectedVillager=null;
let player, cam, inv, G;
let caveEntrances = [];
let worldTerrain = [];
let loadedChunkKeys = new Set();
let activeWorldSeed = 137;
let enemyShots = [];
let combatFx = [];
let playerBullets = [];
let showMap = false;
const SKILLS = [
  {id:'spin',key:'Z',name:'旋风斩',level:1,cost:24,cd:6,xpCost:25,requires:[],effect:'spin',desc:'周围范围攻击，造成160%攻击伤害，并可砍树采石'},
  {id:'dash',key:'Y',name:'疾冲',level:2,cost:20,cd:5,xpCost:35,requires:['spin'],effect:'dash',desc:'向瞄准方向冲刺并穿透伤害，沿途采集，短暂无敌'},
  {id:'wave',key:'X',name:'剑气',level:3,cost:30,cd:9,xpCost:45,requires:['dash'],effect:'wave',desc:'朝瞄准方向发出剑气，造成220%伤害，可贯穿资源'},
  {id:'ward',key:'V',name:'守护',level:5,cost:25,cd:16,xpCost:55,requires:['spin'],effect:'ward',desc:'4秒内额外减伤50%，立即回血10%'},
  {id:'nova',key:'U',name:'震地',level:7,cost:40,cd:14,xpCost:75,requires:['wave','ward'],effect:'nova',desc:'大范围冲击，造成300%伤害并击退，大范围采集资源'},
];
let inventoryOrder = [];
let spawnTimer = 0, shake = 0, timeAcc = 0;
let comboCount = 0, comboT = 0, airdropT = 90;
let chests = [];
let farmPlots = [];
const FARM_TILE = 16;
const FARM_TECH = [
  {name:'基础农业',desc:'作物成熟时间缩短15%',growthReduction:0.15,cost:{wood:8,fiber:6}},
  {name:'速生育种',desc:'成熟时间再缩短25%（累计40%）',growthReduction:0.25,cost:{stone:12,copperOre:4}},
  {name:'留种选育',desc:'成熟作物额外掉落1颗种子的概率提高35%',seedReturnChance:0.35,cost:{crystal:3,wheat:8}},
];
const modHooks = Object.create(null);
const MOD_DEFS_KEY = 'pixel-survival-v2-mod-definitions';
const modDefinitions = {
  items:{},blocks:{},crops:{},machines:{},machineRecipes:[],recipes:[],techs:[],skillNodes:[],
  maps:{},assets:{},
  studioBlueprints:[],textures:{},modInfo:{name:'',author:'',version:'1.0.0',description:''},
};
const ACHS = [
  ['first','初次见血','击杀1只怪物',()=>G.kills>=1],
  ['slayer','屠夫','累计击杀100只怪物',()=>G.kills>=100],
  ['combo10','连杀大师','达成10连杀',()=>comboCount>=10],
  ['elite','猎杀精英','击败1只精英怪',()=>(G.eliteKills||0)>=1],
  ['boss','巨像终结者','击败巨像守卫',()=>(G.bossKills||0)>=1],
  ['chest5','寻宝人','开启5个宝箱',()=>(G.chestsOpened||0)>=5],
  ['day7','生存者','存活到第7天',()=>G.day>=7],
  ['lv10','身经百战','到达 Lv.10',()=>G.growth.level>=10],
];
const keys = {};
const mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, active: false };
let uiButtons = [];
let panel = null;
let titleMenuHasSave = false;
let savePanelReturn = 'pause';
let guideReturnPanel = null;
let guidePage = 0;
let gameLanguage = 'zh-CN';
let characterReturnPanel = null;
let selectedMachine = null;
let machinePanelTab = 'input';
let machinePanelPage = 0;
let selectedRecipe = 0;
let techPage = 0;
let selectedHotbar = 0;
let inventoryDragSource = null;
let hoverSlot = -1;
let toast = { text:'', t:0, color:'#ffe680' };
let fpsSmooth = 60;
let saveClock = 0;
const protectedSaveKeys = new Set();
const SAVE_KEY = 'pixel-survival-v2';
let saveFailureNotified = false;
let pendingImportSlot = null;
const saveFileInput = document.getElementById('save-file-input');
const PLAYER_CUSTOMIZATION = {
  skin: [
    {name:'暖沙', base:'#b68962', shadow:'#90625d', light:'#dcb98a'},
    {name:'麦色', base:'#c49a6c', shadow:'#a16159', light:'#e8cfa6'},
    {name:'浅桃', base:'#dcb98a', shadow:'#aa7959', light:'#f3e5c2'},
    {name:'古铜', base:'#aa7959', shadow:'#865161', light:'#c49a6c'},
  ],
  hairStyle: ['短发','侧分','长发','束发'],
  hairColor: [
    {name:'栗棕', color:'#645552', light:'#8c7369'},
    {name:'夜黑', color:'#353738', light:'#545959'},
    {name:'赤褐', color:'#a16159', light:'#ba7c54'},
    {name:'麦金', color:'#b09643', light:'#d4c169'},
    {name:'雾紫', color:'#766daa', light:'#a09dd4'},
  ],
  outfit: [
    {name:'远行蓝', base:'#4a588e', light:'#658ca1', shadow:'#353738', trim:'#7ba6b4'},
    {name:'林地绿', base:'#67835c', light:'#8db15d', shadow:'#474a4b', trim:'#a4c263'},
    {name:'赤陶红', base:'#a16159', light:'#ba7c54', shadow:'#6b4b5b', trim:'#d79e61'},
    {name:'暮光紫', base:'#5c4e92', light:'#867fb8', shadow:'#4c468b', trim:'#a09dd4'},
    {name:'沙漠黄', base:'#b09643', light:'#d4c169', shadow:'#795e53', trim:'#eae178'},
  ],
  eyes: [
    {name:'深棕', color:'#353738', shine:'#f3e5c2'},
    {name:'海蓝', color:'#4a588e', shine:'#d6f1cd'},
    {name:'翠绿', color:'#566560', shine:'#e8eeaa'},
    {name:'琥珀', color:'#a16159', shine:'#f7ebaa'},
  ],
  faceDetail: ['无','雀斑','伤疤','圆框眼镜'],
  outfitStyle: ['探险外套','轻型背心','长摆风衣'],
  hat: ['无','探险帽','软兜帽','发带'],
  back: ['皮革背包','轻装','短斗篷'],
};
const DEFAULT_PLAYER_APPEARANCE = Object.freeze({
  skin:0, hairStyle:0, hairColor:0, outfit:0, outfitStyle:0, eyes:0,
  faceDetail:0, hat:0, back:0,
});
function newPlayerAppearance(){
  return {...DEFAULT_PLAYER_APPEARANCE};
}
