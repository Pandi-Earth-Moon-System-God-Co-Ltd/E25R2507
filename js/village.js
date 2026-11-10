'use strict';

const VILLAGE_TRADES=[
  {kind:'buy',id:'bandage',count:1,price:5},
  {kind:'buy',id:'emptyBottle',count:1,price:2},
  {kind:'buy',id:'carrotSeed',count:2,price:4},
  {kind:'buy',id:'purifiedWater',count:1,price:6},
  {kind:'sell',id:'berry',count:1,price:2},
  {kind:'sell',id:'wood',count:5,price:3},
  {kind:'sell',id:'copperIngot',count:1,price:8},
];

function generateVillage(){
  villagers=[];
  villageHouses=[];
  const cx=Math.round(player.x/TILE)*TILE,cy=Math.round(player.y/TILE)*TILE;
  const layout=[
    {dx:48,dy:-32,name:'阿禾',job:'农夫'},
    {dx:-48,dy:-32,name:'石叔',job:'采集商'},
    {dx:0,dy:48,name:'小满',job:'村庄商人'},
  ];
  for(let i=0;i<layout.length;i++){
    const spot=layout[i];
    const x=G.mapId?clamp(cx+spot.dx,32,WORLD_W-32):cx+spot.dx;
    const y=G.mapId?clamp(cy+spot.dy,32,CAVE_LINE-32):cy+spot.dy;
    villageHouses.push({x,y,type:i});
    villagers.push({id:'village-'+i,x:x+4,y:y+TILE*1.9,name:spot.name,job:spot.job});
  }
}

function drawVillageHouse(house,x,y){
  const palette=[['#b88655','#704c36'],['#9d744e','#5b4938'],['#c29b64','#725537']][house.type%3];
  R(x-15,y-3,30,4,'rgba(0,0,0,0.25)');
  R(x-12,y-19,24,17,'#d7c79b');
  R(x-10,y-17,20,13,'#bba77b');
  R(x-15,y-21,30,5,palette[0]);
  R(x-12,y-25,24,5,palette[1]);
  R(x-8,y-28,16,4,palette[0]);
  R(x-3,y-11,6,9,'#69452f');
  R(x-2,y-9,1,1,'#e6c877');
  R(x-9,y-16,4,4,'#8dc1c1');
  R(x+5,y-16,4,4,'#8dc1c1');
  R(x-1,y-16,2,4,'#f3e7c2');
}

function drawVillager(villager,x,y){
  const idle=Math.sin(G.time*2+villager.x*.03)*.3;
  R(x-6,y-1,12,3,'rgba(0,0,0,0.25)');
  R(x-4,y-8+idle,3,7,'#485a45');R(x+1,y-8-idle,3,7,'#485a45');
  R(x-5,y-18,10,11,villager.job==='村庄商人'?'#477a78':'#67834e');
  R(x-4,y-26,8,8,'#d4a579');
  R(x-5,y-28,10,4,'#76563a');
  R(x-3,y-23,1,1,'#342b26');R(x+2,y-23,1,1,'#342b26');
  if(villager.job==='村庄商人'){
    R(x-6,y-30,12,3,'#c79b55');R(x-3,y-33,6,4,'#e4c27a');
  }
}

function openVillageTrade(villager){
  selectedVillager=villager;
  clearInput();
  panel='trade';
}

function completeVillageTrade(trade){
  if(!selectedVillager||panel!=='trade')return;
  if(trade.kind==='buy'){
    if((inv.coin||0)<trade.price){showToast('金币不足：需要 '+trade.price+' 枚','#ffc080');return;}
    takeItem('coin',trade.price);
    addItem(trade.id,trade.count);
    showToast('购买 '+ITEMS[trade.id].name+' ×'+trade.count,'#a8efaa');
  }else{
    if((inv[trade.id]||0)<trade.count){showToast('没有足够的 '+ITEMS[trade.id].name+' 可出售','#ffc080');return;}
    takeItem(trade.id,trade.count);
    addItem('coin',trade.price);
    showToast('出售 '+ITEMS[trade.id].name+'，获得 '+trade.price+' 枚金币','#f3d28b');
  }
  saveGame();
}

function drawTradePanel(){
  uiButtons=[];
  drawMcBackdrop(0.64);
  const name=selectedVillager?selectedVillager.name+' · '+selectedVillager.job:'村庄交易';
  uiPanel(54,18,372,200,{title:name+'  ·  金币 '+(inv.coin||0),accent:PAL.gold});
  txt('购买 · 花金币换物品',70,40,{size:6,bold:true,color:'#555555'});
  txt('出售 · 物品换金币',254,40,{size:6,bold:true,color:'#555555'});
  const buys=VILLAGE_TRADES.filter(trade=>trade.kind==='buy');
  const sells=VILLAGE_TRADES.filter(trade=>trade.kind==='sell');
  const drawTradeRow=(trade,x,y,action,kind)=>{
    const item=ITEMS[trade.id];
    if(!item)return;
    uiPanel(x,y,168,26,{fill:'#b9b9b9'});
    drawItemIcon(ctx,trade.id,x+6,y+5,16);
    txt(item.name+' ×'+trade.count,x+28,y+4,{size:6,bold:true,color:'#3f3f3f'});
    txt((trade.kind==='buy'?'-':'+')+trade.price+' 金',x+28,y+14,{size:6,bold:true,
      color:trade.kind==='buy'?'#8a3a2a':'#2f6b2f'});
    uiButton(x+128,y+5,34,16,action,{kind,size:6});
    uiButtons.push({x:x+128,y:y+5,w:34,h:16,fn:()=>completeVillageTrade(trade)});
  };
  buys.forEach((trade,index)=>drawTradeRow(trade,66,52+index*30,'买','green'));
  sells.forEach((trade,index)=>drawTradeRow(trade,246,52+index*30,'换','gold'));
  txt('右键村民交易 · Esc 关闭',W/2,232,{size:6,bold:true,color:'#e7e7e7',align:'center'});
}
