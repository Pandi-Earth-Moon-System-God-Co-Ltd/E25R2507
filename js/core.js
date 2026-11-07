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
  if(![1,2,3,4].includes(scale))throw new Error('画面质量无效');
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

/* ── 我的世界风格：木材加工 / 矿物 / 工作台 ────────── */
Object.assign(ITEMS, {
  plank:     { name:'木板',  icon:'block', color:'#c49a6c', color2:'#8c6a3f', kind:'material', desc:'原木加工成的木板，制作工具与建筑的基础材料' },
  stick:     { name:'木棍',  icon:'stick', color:'#b08b52', color2:'#7a5736', kind:'material', desc:'工具与武器的握柄，也能当燃料' },
  coal:      { name:'煤炭',  icon:'coal',  color:'#3f3f42', color2:'#26262a', kind:'material', desc:'洞穴岩层中开采的燃料，可制作火把' },
  charcoal:  { name:'木炭',  icon:'coal',  color:'#4a4038', color2:'#2e2620', kind:'material', desc:'熔炉里烧木头的产物，可替代煤炭制作火把' },
  craftingTable:{name:'工作台',icon:'block',color:'#c49a6c',color2:'#6b4a2e',kind:'placeable',desc:'右键放置；站在附近才能合成工具、护甲与机器'},
  stonePickaxe:{name:'石镐',icon:'pickaxe',color:'#9da89a',color2:'#6b7470',kind:'tool',mine:2,cd:0.36,desc:'比木镐更快，可开采所有矿脉' },
  ironPickaxe:{name:'铁镐',icon:'pickaxe',color:'#dce0d2',color2:'#818b83',kind:'tool',mine:3,cd:0.26,desc:'铁锭锻造的高级挖掘工具' },
  ironArmor: {name:'铁甲',icon:'armor',color:'#c1c8b9',color2:'#818b83',kind:'armor',armorSlot:'chestplate',def:0.6,desc:'铁锭打造的重甲，受到伤害减少60%' },
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
  pistol:{name:'短铳',ammoItem:'ammo',icon:'gun',color:'#c1c8b9',color2:'#545959',kind:'weapon',dmg:12,range:15,cd:.34,firearm:true,gunRange:180,pellets:1,spread:0,desc:'每发12伤害，射程180，消耗1弹药'},
  shotgun:{name:'铁砂铳',icon:'gun',color:'#c49a6c',color2:'#645552',kind:'weapon',dmg:8,range:15,cd:.85,firearm:true,gunRange:110,pellets:5,spread:.28,desc:'每发5颗弹丸，每颗8伤害，消耗1弹药'},
  hoe:{name:'锄头',icon:'tool',color:'#a8763f',color2:'#5a3f22',kind:'tool',mine:1,hoe:true,cd:0.45,desc:'右键空地开垦耕地，再右键种子播种'},
  bow:{name:'长弓',icon:'gun',color:'#8a6a3f',color2:'#4a3620',kind:'weapon',dmg:14,range:15,cd:.9,firearm:true,gunRange:220,pellets:1,spread:.02,ammoItem:'arrow',charge:true,desc:'按住左键蓄力约 1.1 秒，蓄满伤害 1.75 倍，射程 220'},
crossbow:{name:'弩',icon:'gun',color:'#7a6a52',color2:'#3d3324',kind:'weapon',dmg:22,range:15,cd:1.5,firearm:true,gunRange:260,pellets:1,spread:0,ammoItem:'arrow',charge:true,chargeTime:1.6,desc:'蓄力 1.6 秒射出重弩，单发 22 伤害、射程 260'},
arrow:{name:'箭',icon:'ammo',color:'#d8cbb0',color2:'#7a6a4a',kind:'material',desc:'弓箭与弩通用，由木棍和羽毛/纤维制作'},
ammo:{name:'弹药',icon:'ammo',color:'#eeba77',color2:'#a16159',kind:'material',desc:'短铳与铁砂铳通用，由铁锭和铜锭加工'},
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
  steamBoiler:{name:'蒸汽锅炉',icon:'block',color:'#a8834f',color2:'#5a4530',kind:'placeable',machineType:'steamBoiler',desc:'燃烧煤炭产出电力，蒸汽时代的基础动力'},
  steamForge:{name:'蒸汽锻造机',icon:'block',color:'#8c8f96',color2:'#4a4d52',kind:'placeable',machineType:'steamForge',desc:'消耗电力，把矿石快速锻成锭'},
  arcFurnace:{name:'电弧炉',icon:'block',color:'#c98a4b',color2:'#5b3a20',kind:'placeable',machineType:'arcFurnace',desc:'大电流熔炼矿石，速度远超熔炉'},
  electrolyzer:{name:'电解机',icon:'block',color:'#7fc0c8',color2:'#3b5b62',kind:'placeable',machineType:'electrolyzer',desc:'用电解把锭拆成粉，也能净化污水'},
  centrifuge:{name:'高压离心机',icon:'block',color:'#b08fb8',color2:'#54405c',kind:'placeable',machineType:'centrifuge',desc:'高速离心分离，一份矿石能多出一份粉'},
  highCompressor:{name:'高压压缩机',icon:'block',color:'#8aa0b8',color2:'#41505f',kind:'placeable',machineType:'highCompressor',desc:'高压压制成锭，一次处理整组矿粉'},
  assembler:{name:'组装机',icon:'block',color:'#9aa0a6',color2:'#4f5559',kind:'placeable',machineType:'assembler',desc:'自动把材料组装成成品，省去手工摆放'},
  mixer:{name:'搅拌机',icon:'block',color:'#b8a06a',color2:'#5c4d2e',kind:'placeable',machineType:'mixer',desc:'搅拌混合，把污水过滤成净水、纤维搅成木料'},
  chemicalReactor:{name:'化学反应釜',icon:'block',color:'#7fb2a8',color2:'#3d5a55',kind:'placeable',machineType:'chemicalReactor',desc:'高压化学反应，可把荧晶提纯翻倍'},
  washer:{name:'洗矿机',icon:'block',color:'#7fa8c9',color2:'#3f5f78',kind:'placeable',machineType:'washer',desc:'用水洗矿，主产物之外再分离出副产物粉'},
  transformer:{name:'变压器',icon:'block',color:'#c9a84b',color2:'#6b5622',kind:'placeable',machineType:'transformer',desc:'把电网电压提升一档，让低时代也能带动高压机器'},
  batteryBuffer:{name:'电池仓',icon:'block',color:'#6fa88f',color2:'#38584a',kind:'placeable',machineType:'batteryBuffer',desc:'大容量储电，烧煤充电供周围机器取用'},
  bender:{name:'弯曲机',icon:'block',color:'#9aa3aa',color2:'#525a60',kind:'placeable',machineType:'bender',desc:'把金属锭压成板材，供机器与电路使用'},
  wiremill:{name:'线材轧机',icon:'block',color:'#c2a86a',color2:'#6b5a2f',kind:'placeable',machineType:'wiremill',desc:'把金属锭拉成细线，高压电路必需品'},
  miner:{name:'采矿机',icon:'block',color:'#a08a72',color2:'#4d4136',kind:'placeable',machineType:'miner',desc:'从石头里慢慢挖出矿石，适合挂机产矿'},
  relicShard:{name:'遗迹碎片',icon:'crystal',color:'#dcb98a',color2:'#8c7369',kind:'material',desc:'从地下遗迹回收的古代合金碎片'},
});
const CROPS = {
  carrot:{name:'胡萝卜',seedItem:'carrotSeed',output:'carrot',yield:2,growthSeconds:480,color:'#d79e61'},
  wheat:{name:'小麦',seedItem:'wheatSeed',output:'wheat',yield:2,growthSeconds:600,color:'#eae178'},
};
/* 电网电压：低压 → 中压 → 高压，机器需要对应电压才能运转 */
const VOLTAGE_LEVELS = [
  { id:'lv', name:'低压', tier:0 },
  { id:'mv', name:'中压', tier:3 },
  { id:'hv', name:'高压', tier:5 },
];
const MACHINE_VOLTAGE = {
  copperFurnace:'lv', crusher:'lv', solarPanel:'lv', powerGenerator:'lv', steamBoiler:'lv',
  automaticHarvester:'mv', logisticsRouter:'mv', steamForge:'mv', arcFurnace:'mv', electrolyzer:'mv',
  centrifuge:'hv', highCompressor:'hv', assembler:'mv', mixer:'mv', bender:'mv', wiremill:'hv',
  washer:'mv', transformer:'lv', batteryBuffer:'lv',
  chemicalReactor:'hv', miner:'hv',
};
function machineVoltage(typeId){ return MACHINE_VOLTAGE[typeId] || 'lv'; }
function voltageName(id){ const entry = VOLTAGE_LEVELS.find(v => v.id === id) || VOLTAGE_LEVELS[0]; return entry.name; }
function currentVoltage(){
  let index = 0;
  for (let i = 0; i < VOLTAGE_LEVELS.length; i++){
    if (G && G.tech >= VOLTAGE_LEVELS[i].tier) index = i;
  }
  // 电力网里的变压器可以把电压再提一档
  if (typeof machines !== 'undefined' && Array.isArray(machines) &&
      machines.some(m => m && m.type === 'transformer' && (m.fuel || m.power))) index = Math.min(VOLTAGE_LEVELS.length - 1, index + 1);
  return VOLTAGE_LEVELS[index].id;
}
function machineVoltageOk(typeId){
  const order = VOLTAGE_LEVELS.map(v => v.id);
  return order.indexOf(currentVoltage()) >= order.indexOf(machineVoltage(typeId));
}

const MACHINE_TYPES = {
  steamBoiler:{name:'蒸汽锅炉',blockItem:'steamBoiler',fuelItem:'coal',fuelPerCraft:0,recipes:[],
    generator:'fuel',capacity:220,powerPerFuel:45,fuelInterval:9},
  steamForge:{
    name:'蒸汽锻造机',blockItem:'steamForge',fuelItem:'coal',fuelPerCraft:0,capacity:160,
    recipes:[
      {id:'forgeIron',name:'蒸汽锻铁',input:{ironOre:1},output:{ironIngot:1},duration:5,energy:2},
      {id:'forgeCopper',name:'蒸汽锻铜',input:{copperOre:1},output:{copperIngot:1},duration:4,energy:1},
      {id:'forgeDust',name:'蒸汽压块',input:{ironDust:3},output:{ironIngot:1},duration:7,energy:2},
    ],
  },
  arcFurnace:{
    name:'电弧炉',blockItem:'arcFurnace',fuelItem:'coal',fuelPerCraft:0,capacity:260,
    recipes:[
      {id:'arcIron',name:'电弧熔铁',input:{ironOre:2},output:{ironIngot:1},duration:3,energy:4},
      {id:'arcCopper',name:'电弧熔铜',input:{copperOre:2},output:{copperIngot:1},duration:2,energy:3},
      {id:'arcDust',name:'电弧烧结',input:{ironDust:2},output:{ironIngot:1},duration:3,energy:3},
      {id:'arcSilver',name:'电弧熔银',input:{silverOre:2},output:{silverIngot:1},duration:4,energy:4},
      {id:'arcGold',name:'电弧熔金',input:{goldOre:2},output:{goldIngot:1},duration:5,energy:5},
      {id:'arcTinDust',name:'熔锡粉',input:{tinDust:2},output:{tinIngot:1},duration:4,energy:3},
      {id:'arcLeadDust',name:'熔铅粉',input:{leadDust:2},output:{leadIngot:1},duration:4,energy:3},
      {id:'arcSilverDust',name:'熔银粉',input:{silverDust:4},output:{silverIngot:1},duration:6,energy:5},
      {id:'arcGoldDust',name:'熔金粉',input:{goldDust:4},output:{goldIngot:1},duration:7,energy:6},
    ],
  },
  electrolyzer:{
    name:'电解机',blockItem:'electrolyzer',fuelItem:'coal',fuelPerCraft:0,capacity:200,
    recipes:[
      {id:'electroWater',name:'电解净化',input:{dirtyWater:1},output:{purifiedWater:1},duration:2,energy:1},
      {id:'electroIron',name:'电解铁锭',input:{ironIngot:1},output:{ironDust:2},duration:6,energy:4},
      {id:'electroCopper',name:'电解铜锭',input:{copperIngot:1},output:{copperDust:2},duration:5,energy:3},
    ],
  },
  centrifuge:{
    name:'高压离心机',blockItem:'centrifuge',fuelItem:'coal',fuelPerCraft:0,capacity:320,
    recipes:[
      {id:'centrifugeCopper',name:'离心铜矿',input:{copperOre:3},output:{copperIngot:1,copperDust:2},duration:8,energy:6},
      {id:'centrifugeIron',name:'离心铁矿',input:{ironOre:3},output:{ironIngot:1,ironDust:2},duration:9,energy:7},
      {id:'centrifugeCopperDust',name:'离心铜粉',input:{copperDust:3},output:{copperIngot:1,silverDust:2},duration:7,energy:6},
      {id:'centrifugeIronDust',name:'离心铁粉',input:{ironDust:3},output:{ironIngot:1,tinDust:2},duration:8,energy:7},
      {id:'centrifugeGoldDust',name:'离心金粉',input:{goldDust:3},output:{goldIngot:1,leadDust:2},duration:9,energy:8},
    ],
  },
  highCompressor:{
    name:'高压压缩机',blockItem:'highCompressor',fuelItem:'coal',fuelPerCraft:0,capacity:300,
    recipes:[
      {id:'pressIron',name:'压制铁粉',input:{ironDust:9},output:{ironIngot:3},duration:6,energy:6},
      {id:'pressCopper',name:'压制铜粉',input:{copperDust:9},output:{copperIngot:3},duration:5,energy:5},
    ],
  },
  assembler:{
    name:'组装机',blockItem:'assembler',fuelItem:'coal',fuelPerCraft:0,capacity:260,
    recipes:[
      {id:'assembleTable',name:'组装工作台',input:{plank:4,stick:2},output:{craftingTable:1},duration:4,energy:3},
      {id:'assembleTorch',name:'组装火把',input:{coal:1,stick:1},output:{torch:4},duration:3,energy:2},
      {id:'assembleCircuit',name:'组装电路板',input:{copperPlate:2,goldWire:1,fiber:2,crystal:1},output:{circuitBoard:1},duration:8,energy:6},
    ],
  },
  mixer:{
    name:'搅拌机',blockItem:'mixer',fuelItem:'coal',fuelPerCraft:0,capacity:220,
    recipes:[
      {id:'mixWater',name:'过滤污水',input:{dirtyWater:2,fiber:1},output:{purifiedWater:2},duration:5,energy:3},
      {id:'mixFeed',name:'搅拌饲料',input:{fiber:2,berry:1},output:{cooked:1},duration:6,energy:2},
      {id:'mixBronze',name:'熔炼青铜',input:{copperIngot:3,tinIngot:1},output:{bronzeIngot:1},duration:8,energy:4},
      {id:'mixSteel',name:'熔炼钢锭',input:{ironIngot:2,coal:1},output:{steelIngot:1},duration:10,energy:5},
    ],
  },
  chemicalReactor:{
    name:'化学反应釜',blockItem:'chemicalReactor',fuelItem:'coal',fuelPerCraft:0,capacity:340,
    recipes:[
      {id:'chemCrystal',name:'荧晶提纯',input:{crystal:1,purifiedWater:1},output:{crystal:2},duration:12,energy:8},
      {id:'chemIron',name:'化学还原铁',input:{ironOre:2,coal:1},output:{ironIngot:2},duration:7,energy:6},
    ],
  },
  washer:{
    name:'洗矿机',blockItem:'washer',fuelItem:'coal',fuelPerCraft:0,capacity:260,
    recipes:[
      {id:'washIron',name:'洗铁矿',input:{ironOre:2,purifiedWater:1},output:{ironDust:2,tinDust:1},duration:7,energy:4},
      {id:'washCopper',name:'洗铜矿',input:{copperOre:2,purifiedWater:1},output:{copperDust:2,silverDust:1},duration:6,energy:3},
      {id:'washIronDust',name:'洗铁粉',input:{ironDust:2,purifiedWater:1},output:{ironDust:2,tinDust:1},duration:4,energy:3},
      {id:'washCopperDust',name:'洗铜粉',input:{copperDust:2,purifiedWater:1},output:{copperDust:2,silverDust:1},duration:4,energy:3},
      {id:'washGoldDust',name:'洗金粉',input:{goldDust:2,purifiedWater:1},output:{goldDust:2,leadDust:1},duration:5,energy:4},
      {id:'washGold',name:'洗金矿',input:{goldOre:2,purifiedWater:1},output:{goldDust:2,leadDust:1},duration:8,energy:5},
      {id:'washSilver',name:'洗银矿',input:{silverOre:2,purifiedWater:1},output:{silverDust:2,goldDust:1},duration:8,energy:5},
    ],
  },
  transformer:{
    name:'变压器',blockItem:'transformer',fuelItem:'coal',fuelPerCraft:0,capacity:120,recipes:[],
  },
  batteryBuffer:{
    name:'电池仓',blockItem:'batteryBuffer',fuelItem:'coal',fuelPerCraft:0,recipes:[],
    generator:'fuel',capacity:800,powerPerFuel:60,fuelInterval:10,
  },
  bender:{
    name:'弯曲机',blockItem:'bender',fuelItem:'coal',fuelPerCraft:0,capacity:240,
    recipes:[
      {id:'bendIron',name:'压制铁板',input:{ironIngot:1},output:{ironPlate:1},duration:4,energy:3},
      {id:'bendCopper',name:'压制铜板',input:{copperIngot:1},output:{copperPlate:1},duration:3,energy:2},
      {id:'bendSteel',name:'压制钢板',input:{steelIngot:1},output:{ironPlate:2},duration:6,energy:5},
    ],
  },
  wiremill:{
    name:'线材轧机',blockItem:'wiremill',fuelItem:'coal',fuelPerCraft:0,capacity:300,
    recipes:[
      {id:'wireCopper',name:'拉制铜线',input:{copperIngot:1},output:{copperWire:2},duration:5,energy:4},
      {id:'wireGold',name:'拉制金线',input:{goldIngot:1},output:{goldWire:2},duration:6,energy:5},
    ],
  },
  miner:{
    name:'采矿机',blockItem:'miner',fuelItem:'coal',fuelPerCraft:0,capacity:320,
    recipes:[
      {id:'mineCopper',name:'开采铜矿',input:{stone:2},output:{copperOre:1},duration:10,energy:5},
      {id:'mineIron',name:'开采铁矿',input:{stone:3},output:{ironOre:1},duration:14,energy:7},
    ],
  },
  copperFurnace:{
    name:'铜矿熔炉',blockItem:'copperFurnace',fuelItem:'wood',fuelPerCraft:1,
    recipes:[
      {id:'boilWater',name:'烧开河水',input:{dirtyWater:1},output:{purifiedWater:1},duration:5,energy:1},
      {id:'charcoal',name:'烧制木炭',input:{wood:1},output:{charcoal:1},duration:6,energy:1},
      {id:'cookMeat',name:'烤熟生肉',input:{meat:1},output:{cooked:1},duration:6,energy:1},
      {id:'smeltCopper',name:'冶炼铜锭',input:{copperOre:2},output:{copperIngot:1},duration:8,energy:1},
      {id:'smeltIron',name:'冶炼铁锭',input:{ironOre:2},output:{ironIngot:1},duration:12,energy:2},
      {id:'smeltTin',name:'冶炼锡锭',input:{tinOre:2},output:{tinIngot:1},duration:9,energy:2},
      {id:'smeltLead',name:'冶炼铅锭',input:{leadOre:2},output:{leadIngot:1},duration:10,energy:2},
      {id:'sinterCopper',name:'烧结铜粉',input:{copperDust:4},output:{copperIngot:1},duration:7,energy:2},
      {id:'sinterIron',name:'烧结铁粉',input:{ironDust:4},output:{ironIngot:1},duration:10,energy:3},
    ],
  },
  powerGenerator:{name:'燃木发电机',blockItem:'powerGenerator',fuelItem:'wood',fuelPerCraft:0,recipes:[],generator:'fuel',capacity:100,powerPerFuel:25,fuelInterval:10},
  solarPanel:{name:'太阳能板',blockItem:'solarPanel',fuelItem:'wood',fuelPerCraft:0,recipes:[],generator:'solar',capacity:100,powerRate:0.8},
  crusher:{
    name:'粉碎机',blockItem:'crusher',fuelItem:'wood',fuelPerCraft:0,capacity:100,
    recipes:[
      {id:'crushTin',name:'粉碎锡矿',input:{tinOre:1},output:{tinDust:2},duration:4,energy:2},
      {id:'crushLead',name:'粉碎铅矿',input:{leadOre:1},output:{leadDust:2},duration:4,energy:2},
      {id:'crushSilver',name:'粉碎银矿',input:{silverOre:1},output:{silverDust:2},duration:5,energy:3},
      {id:'crushGold',name:'粉碎金矿',input:{goldOre:1},output:{goldDust:2},duration:5,energy:3},
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
/* 技能效果注册表：编辑器的下拉从这里生成 */
const SKILL_EFFECTS = [
  { id:'spin',  name:'回旋斩' },
  { id:'dash',  name:'冲刺' },
  { id:'wave',  name:'剑气' },
  { id:'ward',  name:'守护' },
  { id:'nova',  name:'震地' },
  { id:'orbit', name:'环绕弹' },
  { id:'chain', name:'连锁闪电' },
  { id:'heal',  name:'治疗波' },
];

const TECH_LEVELS = [
  { name:'原始时代', unlock:'木板、木棍、工作台、石制工具与木石护甲' },
  { name:'铜器时代', unlock:'铜镐、铁镐、铁剑、铁甲、熔炉工业与枪械', day:3, kills:6, cost:{ copperOre:8, plank:12 } },
  { name:'荧晶时代', unlock:'荧晶武器、荧晶护甲、太阳能与世界之门', day:7, kills:15, cost:{ crystal:5, ironIngot:8 } },
  { name:'蒸汽时代', unlock:'蒸汽锅炉、蒸汽锻造机与蒸汽动力电网', day:10, kills:22, cost:{ ironIngot:6, copperIngot:4 } },
  { name:'电力时代', unlock:'电弧炉、电解机与电力电网', day:14, kills:32, cost:{ ironIngot:10, coal:8 } },
  { name:'高压时代', unlock:'高压离心机、高压压缩机与高压电网', day:20, kills:45, cost:{ crystal:6, ironIngot:12 } },
];

/* ── 我的世界风格配方：原木 → 木板 → 木棍 → 工作台 → 工具/护甲 ──
   table:true 表示需要站在工作台附近才能制作
   grid + key：有形状的配方（工作台 3×3，和《我的世界》一样按格子摆放）
   没有 grid 的配方为「无序配方」：把材料放进任意格子即可
   shape:'2x2' 表示这个形状也能在背包的 2×2 合成格中摆放 */
const RECIPES = [
  // 基础加工（徒手即可）
  { out:'plank',     count:4, need:{ wood:1 }, tier:0 },
  { out:'stick',     count:4, need:{ plank:2 }, tier:0, grid:['p','p','.'], key:{p:'plank'} },
  { out:'craftingTable', need:{ plank:4 }, tier:0, grid:['pp','pp'], key:{p:'plank'} },
  { out:'torch',     count:2, need:{ coal:1, stick:1 }, tier:0, grid:['c','s'], key:{c:'coal',s:'stick'} },
  { out:'torch',     count:2, need:{ charcoal:1, stick:1 }, tier:0, grid:['c','s'], key:{c:'charcoal',s:'stick'} },
  { out:'cooked',    need:{ meat:1, wood:1 }, tier:0 },
  { out:'bread',     need:{ wheat:3 }, tier:0, grid:['www'], key:{w:'wheat'} },
  { out:'bandage',   need:{ fiber:3 }, tier:0 },
  { out:'woodBlock', count:4, need:{ plank:1 }, tier:0 },
  { out:'stoneBlock',count:4, need:{ stone:1 }, tier:0 },
  { out:'smallPotion', need:{ berry:3, fiber:2 }, tier:0 },
  { out:'regenPotion', need:{ berry:2, fiber:4 }, tier:0 },

  // 工作台：基础工具与护甲
  { out:'woodPickaxe',  need:{ plank:3, stick:2 }, tier:0, table:true, grid:['ppp','.k.','.k.'], key:{p:'plank',k:'stick'} },
  { out:'stonePickaxe', need:{ stone:3, stick:2 }, tier:0, table:true, grid:['sss','.k.','.k.'], key:{s:'stone',k:'stick'} },
  { out:'woodSword',    need:{ plank:2, stick:1 }, tier:0, table:true, grid:['p','p','k'], key:{p:'plank',k:'stick'} },
  { out:'stoneSword',   need:{ stone:2, stick:1 }, tier:0, table:true, grid:['s','s','k'], key:{s:'stone',k:'stick'} },
  { out:'woodHelmet',   need:{ plank:5 }, tier:0, table:true, grid:['ppp','p.p'], key:{p:'plank'} },
  { out:'woodChestplate',need:{ plank:8 }, tier:0, table:true, grid:['p.p','ppp','ppp'], key:{p:'plank'} },
  { out:'woodLeggings', need:{ plank:7 }, tier:0, table:true, grid:['ppp','p.p','p.p'], key:{p:'plank'} },
  { out:'woodBoots',    need:{ plank:4 }, tier:0, table:true, grid:['p.p','p.p'], key:{p:'plank'} },
  { out:'woodArmor',    need:{ plank:8, fiber:4 }, tier:0, table:true },
  { out:'stoneArmor',   need:{ stone:8, fiber:4 }, tier:0, table:true },
  { out:'copperFurnace',need:{ stone:8 }, tier:0, table:true, grid:['sss','s.s','sss'], key:{s:'stone'} },

  // 铜器 / 铁器时代
  { out:'copperPickaxe',need:{ copperIngot:3, stick:2 }, tier:1, table:true, grid:['iii','.k.','.k.'], key:{i:'copperIngot',k:'stick'} },
  { out:'copperSword',  need:{ copperIngot:2, stick:1 }, tier:1, table:true, grid:['i','i','k'], key:{i:'copperIngot',k:'stick'} },
  { out:'steelSword',   need:{ ironIngot:2, stick:1 }, tier:1, table:true, grid:['i','i','k'], key:{i:'ironIngot',k:'stick'} },
  { out:'ironPickaxe',  need:{ ironIngot:3, stick:2 }, tier:1, table:true, grid:['iii','.k.','.k.'], key:{i:'ironIngot',k:'stick'} },
  { out:'copperArmor',  need:{ copperIngot:8 }, tier:1, table:true, grid:['iii','i.i','iii'], key:{i:'copperIngot'} },
  { out:'ironArmor',    need:{ ironIngot:8 }, tier:1, table:true, grid:['iii','i.i','iii'], key:{i:'ironIngot'} },
  { out:'pistol',       need:{ ironIngot:2, copperIngot:2, plank:4 }, tier:1, table:true },
  { out:'shotgun',      need:{ ironIngot:4, copperIngot:3, plank:6, stick:2 }, tier:1, table:true },
  { out:'hoe',          need:{ plank:2, stick:3 }, tier:0, table:true },
  { out:'bow',          need:{ stick:6, fiber:4 }, tier:0, table:false },
  { out:'crossbow',     need:{ stick:8, ironIngot:2, fiber:6 }, tier:1, table:true },
  { out:'arrow',        need:{ stick:1, fiber:1 }, tier:0, table:false, count:4 },
  { out:'ammo',         count:12, need:{ ironIngot:1, copperIngot:1 }, tier:1, table:true },
  { out:'largePotion',  need:{ smallPotion:2, crystal:1 }, tier:1 },
  { out:'powerPotion',  need:{ meat:2, copperOre:2 }, tier:1 },
  { out:'hastePotion',  need:{ berry:3, copperOre:1 }, tier:1 },

  // 工业与机器
  { out:'powerGenerator', need:{ ironIngot:3, stone:6, plank:4 }, tier:1, table:true },
  { out:'conveyorBelt', count:4, need:{ plank:3, stone:2, ironIngot:1 }, tier:1, table:true },
  { out:'powerWire',    count:8, need:{ copperIngot:1, fiber:2 }, tier:1, table:true },
  { out:'crusher',      need:{ ironIngot:3, stone:12, plank:4 }, tier:1, table:true },
  { out:'automaticHarvester', need:{ ironIngot:4, plank:10, stone:6 }, tier:1, table:true },
  { out:'logisticsRouter', need:{ ironIngot:2, plank:6, stone:4 }, tier:1, table:true },
  { out:'ecoGarden',    need:{ plank:8, fiber:8, copperIngot:2 }, tier:1, table:true },

  // 荧晶时代
  { out:'crystalSword', need:{ crystal:2, stick:1 }, tier:2, table:true, grid:['c','c','k'], key:{c:'crystal',k:'stick'} },
  { out:'crystalArmor', need:{ crystal:8 }, tier:2, table:true, grid:['ccc','c.c','ccc'], key:{c:'crystal'} },
  { out:'solarPanel',   need:{ crystal:2, ironIngot:2, plank:4 }, tier:2, table:true },
  { out:'steamBoiler',  need:{ ironIngot:4, copperIngot:2, stone:10 }, tier:3, table:true },
  { out:'steamForge',   need:{ ironIngot:6, copperIngot:3, stone:14, plank:6 }, tier:3, table:true },
  { out:'arcFurnace',   need:{ ironIngot:8, copperIngot:4, stone:16 }, tier:4, table:true },
  { out:'electrolyzer', need:{ ironIngot:6, crystal:3, stone:12 }, tier:4, table:true },
  { out:'centrifuge',   need:{ ironIngot:12, copperIngot:6, crystal:5 }, tier:5, table:true },
  { out:'highCompressor', need:{ ironIngot:14, crystal:4, stone:20 }, tier:5, table:true },
  { out:'assembler',    need:{ ironIngot:8, plank:8, stone:10 }, tier:4, table:true },
  { out:'mixer',        need:{ ironIngot:6, plank:6, stone:8 }, tier:4, table:true },
  { out:'chemicalReactor', need:{ crystal:5, ironIngot:10, stone:16 }, tier:5, table:true },
  { out:'miner',        need:{ ironIngot:16, copperIngot:8, crystal:3 }, tier:5, table:true },
  { out:'bender',       need:{ ironIngot:8, copperIngot:6, stone:12 }, tier:4, table:true },
  { out:'washer',       need:{ ironPlate:4, copperPlate:2, stone:10 }, tier:4, table:true },
  { out:'transformer',  need:{ ironPlate:6, copperWire:4, steelIngot:2 }, tier:5, table:true },
  { out:'batteryBuffer',need:{ ironPlate:8, copperWire:6, steelIngot:3 }, tier:5, table:true },
  { out:'wiremill',     need:{ steelIngot:2, copperIngot:8, crystal:4 }, tier:5, table:true },
  { out:'bloodSword',   need:{ bloodCore:3, crystal:2 }, tier:2, table:true },
  { out:'worldGate',    need:{ relicShard:8, crystal:10, bloodCore:3 }, tier:2, table:true },
];

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
  {id:'spin',itemCost:{circuitBoard:1},key:'Z',name:'旋风斩',level:1,cost:24,cd:6,xpCost:25,requires:[],effect:'spin',desc:'周围范围攻击，造成160%攻击伤害，并可砍树采石'},
  {id:'dash',itemCost:{circuitBoard:1},key:'Y',name:'疾冲',level:2,cost:20,cd:5,xpCost:35,requires:['spin'],effect:'dash',desc:'向瞄准方向冲刺并穿透伤害，沿途采集，短暂无敌'},
  {id:'wave',itemCost:{circuitBoard:2},key:'X',name:'剑气',level:3,cost:30,cd:9,xpCost:45,requires:['dash'],effect:'wave',desc:'朝瞄准方向发出剑气，造成220%伤害，可贯穿资源'},
  {id:'ward',itemCost:{circuitBoard:2},key:'V',name:'守护',level:5,cost:25,cd:16,xpCost:55,requires:['spin'],effect:'ward',desc:'4秒内额外减伤50%，立即回血10%'},
  {id:'nova',itemCost:{circuitBoard:3},key:'U',name:'震地',level:7,cost:40,cd:14,xpCost:75,requires:['wave','ward'],effect:'nova',desc:'大范围冲击，造成300%伤害并击退，大范围采集资源'},
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
/* 背包固定槽位：3 页 × 27 格，物品可以放在任意一格（和《我的世界》一样） */
const BAG_SLOT_SIZE = 27, BAG_SLOT_PAGES = 3, BAG_SLOTS = BAG_SLOT_SIZE * BAG_SLOT_PAGES;
let bagSlots = [];
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
