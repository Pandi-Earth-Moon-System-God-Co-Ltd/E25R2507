(function(){
  let customAnimation=null;
  function draw(ctx,width,height,state,player){
    if(!window.PixelSurvivalAudio||!window.PixelSurvivalAudio.getSettings().animations)return;
    if(customAnimation&&customAnimation.complete&&customAnimation.naturalWidth){
      const ratio=Math.min(1,48/customAnimation.naturalWidth,48/customAnimation.naturalHeight);
      const drawWidth=Math.max(1,Math.round(customAnimation.naturalWidth*ratio));
      const drawHeight=Math.max(1,Math.round(customAnimation.naturalHeight*ratio));
      const pos=worldToScreen(player.x+18,player.y+10);
      ctx.globalAlpha=0.85;
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(customAnimation,Math.round(pos.x-drawWidth/2),Math.round(pos.y-drawHeight),drawWidth,drawHeight);
      ctx.globalAlpha=1;
    }
    if(state.darkness<0.24&&!state.inCave)return;
    for(let i=0;i<18;i++){
      const seed=i*137+Math.floor(state.time*2);
      const wx=player.x-120+((hash2(seed,17)*240+state.time*(i%2?5:-4))%240+240)%240;
      const wy=player.y-86+((hash2(seed,83)*172+state.time*(i%3?2:-3))%172+172)%172;
      const pos=worldToScreen(wx,wy);
      const pulse=0.35+0.65*Math.max(0,Math.sin(state.time*2.7+i*1.9));
      ctx.globalAlpha=pulse*0.58;
      ctx.fillStyle=state.inCave?'#9de2cb':'#e7e7a3';
      ctx.fillRect(Math.round(pos.x),Math.round(pos.y),2,2);
      if(i%3===0){
        ctx.fillStyle='rgba(222,239,177,0.22)';
        ctx.fillRect(Math.round(pos.x-2),Math.round(pos.y-2),6,6);
      }
    }
    ctx.globalAlpha=1;
    const glow=0.025+Math.sin(state.time*1.8)*0.012;
    const gradient=ctx.createRadialGradient(width/2,height/2,36,width/2,height/2,height*.78);
    gradient.addColorStop(0,'rgba(255,255,255,0)');
    gradient.addColorStop(1,'rgba(18,26,34,'+glow+')');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  }

  window.PixelSurvivalAnimations={
    draw,
    setCustomAsset(dataUrl){
      if(dataUrl&&(!/^data:image\/(?:gif|png|webp);base64,[A-Za-z0-9+/]+=*$/i.test(dataUrl)||
         dataUrl.length>700000))throw new Error('动画贴图格式无效或文件过大');
      if(!dataUrl){customAnimation=null;return;}
      const image=new Image();
      image.onerror=()=>console.warn('[Game Studio] 自定义动画加载失败');
      image.src=dataUrl;
      customAnimation=image;
    },
  };
})();
