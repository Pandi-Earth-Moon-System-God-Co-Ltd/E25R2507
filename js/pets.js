'use strict';

const MAX_PETS = 3;
const PET_MAX_HP = Object.freeze({boar:50,sheep:40,duck:25,chicken:20});
const PET_DAMAGE_REDUCTION = Object.freeze({boar:0.5,sheep:0.4,duck:0.3,chicken:0.3});

function normalizePetHealth(pet){
  const maxHp=PET_MAX_HP[pet.type];
  if(!maxHp)return;
  if(pet.maxHp===undefined){
    pet.maxHp=maxHp;
    if(Number.isFinite(pet.hp))pet.hp=maxHp;
  }else if(pet.maxHp===12&&Number.isFinite(pet.hp)&&pet.hp>0&&pet.hp<=12){
    pet.hp+=maxHp-12;
    pet.maxHp=maxHp;
  }
}

function tameAnimal(animal){
  if(pets.length>=MAX_PETS){
    showToast('最多只能携带 '+MAX_PETS+' 只宠物','#ffb080');
    return;
  }
  const index=animals.indexOf(animal);
  if(index<0)return;
  animals.splice(index,1);
  const maxHp=PET_MAX_HP[animal.type];
  const pet={...animal,hp:maxHp,maxHp,invuln:0,tamed:true,mode:'follow',attackCooldown:0,
    layer:G.worldLayer||'surface',facing:Number.isFinite(animal.facing)?animal.facing:animal.direction||0};
  delete pet._chunkKey;
  pets.push(pet);
  spawnParticles(pet.x,pet.y-8,'#ffe080',10);
  showToast('驯服成功！宠物会持续跟随并协助战斗','#ffe080');
  if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('feed',pet.type);
}

function updatePets(dt){
  for(let index=0;index<pets.length;index++){
    const pet=pets[index];
    pet.mode='follow';
    normalizePetHealth(pet);
    if(!Number.isFinite(pet.invuln))pet.invuln=0;
    pet.wobble=(pet.wobble||0)+dt*5;
    pet.attackCooldown=Math.max(0,(pet.attackCooldown||0)-dt);
    pet.invuln=Math.max(0,(pet.invuln||0)-dt);
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
      const targetDistanceFromPet=Math.hypot(enemy.x-pet.x,enemy.y-pet.y);
      if(targetDistanceFromPet<=TILE*6&&targetDistanceFromPet<targetDistance){
        targetIndex=enemyIndex;
        targetDistance=targetDistanceFromPet;
      }
    }
    if(targetIndex<0)continue;
    const enemy=enemies[targetIndex];
    const damage=pet.type==='boar'?3:pet.type==='sheep'?3:pet.type==='duck'?2:1;
    pet.facing=Math.atan2(enemy.y-pet.y,enemy.x-pet.x);
    pet.attackCooldown=pet.type==='boar'||pet.type==='sheep'?1.8:0.45;
    skillDamageEnemy(enemy,targetIndex,damage,pet.facing);
  }
  separatePets();
}

function damagePet(pet,damage){
  if(!pets.includes(pet)||pet.invuln>0)return;
  const reduction=PET_DAMAGE_REDUCTION[pet.type]||0;
  const actualDamage=damage*(1-reduction);
  pet.hp-=actualDamage;
  pet.invuln=0.55;
  spawnParticles(pet.x,pet.y-7,'#d04040',5);
  spawnText(pet.x,pet.y-20,'-'+Math.max(1,Math.round(actualDamage)),'#ff7777');
  if(window.PixelSurvivalAudio)PixelSurvivalAudio.play('hurt');
  if(pet.hp>0)return;
  const index=pets.indexOf(pet);
  if(index>=0)pets.splice(index,1);
  spawnParticles(pet.x,pet.y-8,'#ffe080',12);
  showToast('宠物在战斗中倒下了','#ff9090');
}

function separatePets(){
  const minDistance=24;
  for(let pass=0;pass<pets.length*2;pass++){
    for(let i=0;i<pets.length;i++){
      for(let j=i+1;j<pets.length;j++){
        const first=pets[i],second=pets[j];
        let dx=second.x-first.x,dy=second.y-first.y;
        let distance=Math.hypot(dx,dy);
        if(distance>=minDistance)continue;
        if(distance<0.001){
          const angle=(i*MAX_PETS+j+1)*Math.PI*2/7;
          dx=Math.cos(angle)*0.001;
          dy=Math.sin(angle)*0.001;
          distance=0.001;
        }
        const push=(minDistance-distance)/2;
        const offsetX=dx/distance*push,offsetY=dy/distance*push;
        first.x-=offsetX;first.y-=offsetY;
        second.x+=offsetX;second.y+=offsetY;
      }
    }
  }
}