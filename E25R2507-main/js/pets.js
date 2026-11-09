'use strict';

const MAX_PETS = 3;

function tameAnimal(animal){
  if(pets.length>=MAX_PETS){
    showToast('最多只能携带 '+MAX_PETS+' 只宠物','#ffb080');
    return;
  }
  const index=animals.indexOf(animal);
  if(index<0)return;
  animals.splice(index,1);
  const pet={...animal,tamed:true,mode:'follow',attackCooldown:0,
    layer:G.worldLayer||'surface',facing:Number.isFinite(animal.facing)?animal.facing:animal.direction||0};
  delete pet._chunkKey;
  pets.push(pet);
  spawnParticles(pet.x,pet.y-8,'#ffe080',10);
  showToast('驯服成功！宠物会跟随并协助战斗；右键可停留/跟随','#ffe080');
  if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('feed',pet.type);
}

function updatePets(dt){
  for(let index=0;index<pets.length;index++){
    const pet=pets[index];
    pet.wobble=(pet.wobble||0)+dt*5;
    pet.attackCooldown=Math.max(0,(pet.attackCooldown||0)-dt);
    if(pet.layer!==(G.worldLayer||'surface')){
      pet.x=player.x-12*(index+1);
      pet.y=player.y+8*(index%2);
      pet.layer=G.worldLayer||'surface';
    }
    const dx=player.x-pet.x,dy=player.y-pet.y,distance=Math.hypot(dx,dy);
    pet.walking=false;
    if(pet.mode!=='stay'&&distance>260){
      pet.x=player.x-18*(index+1);
      pet.y=player.y+10*(index%2);
    }else if(pet.mode!=='stay'&&distance>28){
      pet.direction=Math.atan2(dy,dx);
      if(!Number.isFinite(pet.facing))pet.facing=pet.direction;
      const turn=Math.atan2(Math.sin(pet.direction-pet.facing),Math.cos(pet.direction-pet.facing));
      pet.facing+=turn*Math.min(1,dt*6);
      const speed=pet.type==='chicken'?78:pet.type==='boar'?64:70;
      pet.x+=Math.cos(pet.facing)*speed*dt;
      pet.y+=Math.sin(pet.facing)*speed*dt;
      pet.walking=true;
    }
    if(pet.attackCooldown>0)continue;
    let targetIndex=-1,targetDistance=Infinity;
    for(let enemyIndex=0;enemyIndex<enemies.length;enemyIndex++){
      const enemy=enemies[enemyIndex];
      const range=pet.mode==='stay'?TILE*5:TILE*5;
      const targetDistanceFromPet=Math.hypot(enemy.x-pet.x,enemy.y-pet.y);
      if(targetDistanceFromPet<=range&&targetDistanceFromPet<targetDistance){
        targetIndex=enemyIndex;
        targetDistance=targetDistanceFromPet;
      }
    }
    if(targetIndex<0)continue;
    const enemy=enemies[targetIndex];
    const damage=pet.type==='boar'?4:pet.type==='sheep'?3:2;
    pet.facing=Math.atan2(enemy.y-pet.y,enemy.x-pet.x);
    pet.attackCooldown=pet.type==='chicken'?1.2:1.55;
    skillDamageEnemy(enemy,targetIndex,damage,pet.facing);
  }
}