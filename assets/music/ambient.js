(function(){
  const KEY='pixel-survival-media-settings';
  const defaults={music:true,sound:true,animations:true,volume:0.18,quality:4,fog:1};
  let settings={...defaults};
  let audioContext=null,musicGain=null,soundGain=null,musicTimer=0,step=0;
  let customMusicData='',customSoundData='',customMusicPlayer=null;
  let customActionSounds={},customContentSounds={};

  function readSettings(){
    try{
      const saved=JSON.parse(localStorage.getItem(KEY)||'null');
      if(!saved||typeof saved!=='object')return;
      if(typeof saved.music==='boolean')settings.music=saved.music;
      if(typeof saved.sound==='boolean')settings.sound=saved.sound;
      if(typeof saved.animations==='boolean')settings.animations=saved.animations;
      if(Number.isFinite(saved.volume))settings.volume=Math.max(0,Math.min(0.5,saved.volume));
      if([2,3,4].includes(saved.quality))settings.quality=saved.quality;
      if([0,1,2,3].includes(saved.fog))settings.fog=saved.fog;
    }catch(error){
      console.warn('[Pixel Survival] 音画设置无法读取，使用默认值',error);
    }
  }

  function tone(frequency,duration,type,volume,destination){
    if(!audioContext||!destination)return;
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,audioContext.currentTime);
    gain.gain.setValueAtTime(0.0001,audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002,volume),audioContext.currentTime+0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001,audioContext.currentTime+duration);
    oscillator.connect(gain);gain.connect(destination);
    oscillator.start();oscillator.stop(audioContext.currentTime+duration+0.04);
  }

  function playMusicStep(){
    if(!settings.music||!audioContext||audioContext.state!=='running')return;
    const notes=[0,3,7,10,7,3,5,10,12,10,7,3,5,7,10,14];
    const scale=[196,220,246.94,293.66,329.63,392,440,493.88];
    const note=scale[notes[step%notes.length]%scale.length]*(step%2?1:0.5);
    tone(note,0.72,'triangle',settings.volume*0.42,musicGain);
    if(step%4===0)tone(note/2,1.35,'sine',settings.volume*0.24,musicGain);
    if(step%8===0)tone(note*1.5,0.48,'sine',settings.volume*0.12,musicGain);
    step++;
  }

  function apply(){
    if(!audioContext)return;
    musicGain.gain.setTargetAtTime(settings.music?settings.volume:0,audioContext.currentTime,0.15);
    soundGain.gain.setTargetAtTime(settings.sound?0.35:0,audioContext.currentTime,0.1);
    if(typeof setRenderQuality==='function')setRenderQuality(settings.quality);
    if(customMusicPlayer){
      if(musicTimer){window.clearInterval(musicTimer);musicTimer=0;}
      customMusicPlayer.volume=settings.music?Math.min(1,settings.volume*2):0;
      if(settings.music&&customMusicPlayer.paused)
        customMusicPlayer.play().catch(error=>console.warn('[Pixel Survival] 自定义背景音乐无法播放',error));
      else if(!settings.music&&!customMusicPlayer.paused)customMusicPlayer.pause();
    }else if(settings.music&&!musicTimer){
      playMusicStep();
      musicTimer=window.setInterval(playMusicStep,720);
    }else if(!settings.music&&musicTimer){
      window.clearInterval(musicTimer);musicTimer=0;
    }
  }

  function unlock(){
    const AudioContextType=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextType)return;
    if(!audioContext){
      audioContext=new AudioContextType();
      musicGain=audioContext.createGain();soundGain=audioContext.createGain();
      musicGain.connect(audioContext.destination);soundGain.connect(audioContext.destination);
    }
    if(audioContext.state==='suspended')audioContext.resume().then(apply);
    else apply();
  }

  function setSettings(patch){
    if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('音画设置无效');
    const next={...settings};
    for(const [key,value] of Object.entries(patch)){
      if(!Object.prototype.hasOwnProperty.call(defaults,key))throw new Error('未知音画设置：'+key);
      if(key==='volume'){
        if(!Number.isFinite(value)||value<0||value>0.5)throw new Error('音乐音量需在 0 到 0.5 之间');
      }else if(key==='quality'){
        if(![2,3,4].includes(value))throw new Error('画面质量必须选择低、中或高');
      }else if(key==='fog'){
        if(![0,1,2,3].includes(value))throw new Error('远景雾效设置无效');
      }else if(typeof value!=='boolean')throw new Error(key+' 必须是开关');
      next[key]=value;
    }
    try{
      localStorage.setItem(KEY,JSON.stringify(next));
      settings=next;
      if(typeof setRenderQuality==='function')setRenderQuality(settings.quality);
      apply();
      return {...settings};
    }catch(error){
      throw new Error('音画设置保存失败：'+error.message);
    }
  }

  function play(name,contentId){
    if(!settings.sound||!audioContext||audioContext.state!=='running')return;
    const source=(contentId&&customContentSounds[contentId])||customActionSounds[name]||customSoundData;
    if(source){
      const player=new Audio(source);
      player.volume=0.35;
      player.play().catch(error=>console.warn('[Pixel Survival] 自定义操作音效无法播放',error));
      return;
    }
    const sounds={
      attack:[220,0.07,'square'],eat:[520,0.11,'sine'],feed:[660,0.14,'triangle'],
      breed:[784,0.2,'triangle'],cave:[146,0.25,'sine'],collect:[440,0.08,'triangle'],
    };
    const sound=sounds[name];
    if(sound)tone(sound[0],sound[1],sound[2],0.09,soundGain);
  }

  function setCustomAssets(assets){
    if(!assets||typeof assets!=='object'||Array.isArray(assets))throw new Error('自定义音频资源无效');
    const music=assets.music||'',sound=assets.sound||'',actions=assets.actions||{},content=assets.content||{};
    const validAudio=value=>!value||typeof value==='string'&&
      /^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+=*$/i.test(value)&&value.length<=360000;
    if(!validAudio(music)||!validAudio(sound))throw new Error('自定义音频格式无效或文件过大');
    const supportedActions=['attack','eat','feed','breed','cave','collect','craft','machine'];
    if(!actions||typeof actions!=='object'||Array.isArray(actions)||!content||
       typeof content!=='object'||Array.isArray(content))throw new Error('操作音效资源结构无效');
    const nextActions={},nextContent={};
    for(const [name,value] of Object.entries(actions)){
      if(!supportedActions.includes(name)||!validAudio(value))throw new Error('操作音效无效：'+name);
      if(value)nextActions[name]=value;
    }
    for(const [id,resources] of Object.entries(content)){
      if(!resources||typeof resources!=='object'||Array.isArray(resources)||
         resources.sound!==undefined&&!validAudio(resources.sound))
        throw new Error('内容音效无效：'+id);
      if(resources.sound)nextContent[id]=resources.sound;
    }
    customMusicData=music;customSoundData=sound;
    customActionSounds=nextActions;customContentSounds=nextContent;
    if(customMusicPlayer)customMusicPlayer.pause();
    customMusicPlayer=music?new Audio(music):null;
    if(customMusicPlayer){customMusicPlayer.loop=true;customMusicPlayer.preload='auto';}
    if(audioContext)apply();
  }

  readSettings();
  if(typeof setRenderQuality==='function')setRenderQuality(settings.quality);
  window.addEventListener('pointerdown',unlock);
  window.addEventListener('keydown',unlock);
  window.PixelSurvivalAudio={
    getSettings(){return {...settings};},
    setSettings,
    setCustomAssets,
    play,
    unlock,
  };
})();
