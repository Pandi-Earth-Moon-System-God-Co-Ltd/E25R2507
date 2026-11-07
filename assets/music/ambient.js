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
    if(window.PixelGfx)PixelGfx.apply();
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
      if(window.PixelGfx)PixelGfx.apply();
      else if(typeof setRenderQuality==='function')setRenderQuality(settings.quality);
      apply();
      if(window.PixelGfx&&(patch.quality!==undefined||patch.fog!==undefined))
        PixelGfx.syncLegacy({quality:patch.quality,fog:patch.fog});
      return {...settings};
    }catch(error){
      throw new Error('音画设置保存失败：'+error.message);
    }
  }

  /* 《我的世界》风格音效：用 WebAudio 现场合成，替代机械音 */
  function sfxNoise(dur, freq, q, gain){
    const rate = audioContext.sampleRate;
    const length = Math.max(1, Math.floor(rate * dur));
    const buffer = audioContext.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const amp = audioContext.createGain();
    amp.gain.value = gain;
    amp.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + dur);
    source.connect(filter); filter.connect(amp); amp.connect(typeof soundGain !== 'undefined' && soundGain ? soundGain : audioContext.destination);
    source.start();
  }
  function sfxTone(freq, dur, type, gain, slideTo){
    const osc = audioContext.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, audioContext.currentTime + dur);
    const amp = audioContext.createGain();
    amp.gain.value = gain;
    amp.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + dur);
    osc.connect(amp); amp.connect(typeof soundGain !== 'undefined' && soundGain ? soundGain : audioContext.destination);
    osc.start(); osc.stop(audioContext.currentTime + dur + 0.02);
  }
  const MC_SFX = {
    attack: () => { sfxNoise(0.09, 850, 1.4, 0.30); sfxTone(170, 0.06, 'square', 0.10, 110); },
    collect: () => { sfxTone(760, 0.05, 'triangle', 0.22); sfxTone(1140, 0.06, 'triangle', 0.16); },
    mine: () => { sfxNoise(0.07, 1500, 2.5, 0.26); sfxTone(240, 0.05, 'square', 0.08); },
    chop: () => { sfxNoise(0.10, 420, 1.6, 0.28); sfxTone(150, 0.09, 'triangle', 0.16, 90); },
    build: () => { sfxNoise(0.12, 260, 1.1, 0.30); sfxTone(110, 0.10, 'sine', 0.16, 70); },
    eat: () => { for (let i = 0; i < 3; i++) setTimeout(() => sfxNoise(0.06, 700, 1.8, 0.22), i * 110); },
    drink: () => { for (let i = 0; i < 3; i++) setTimeout(() => sfxTone(420 - i * 60, 0.07, 'sine', 0.16), i * 120); },
    water: () => { sfxNoise(0.28, 900, 0.9, 0.24); },
    hurt: () => { sfxTone(300, 0.16, 'square', 0.20, 120); sfxNoise(0.10, 600, 1.2, 0.18); },
    levelUp: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => sfxTone(f, 0.16, 'triangle', 0.18), i * 90)); },
    craft: () => { sfxNoise(0.08, 520, 1.4, 0.20); sfxTone(330, 0.10, 'triangle', 0.14, 440); },
    machineOpen: () => { sfxTone(260, 0.08, 'square', 0.12); sfxTone(390, 0.09, 'square', 0.10); },
    scan: () => { sfxTone(660, 0.10, 'sine', 0.14, 990); },
    cave: () => { sfxTone(160, 0.35, 'sine', 0.20, 90); },
    caveOut: () => { sfxTone(220, 0.28, 'sine', 0.18, 420); },
    slash: () => { sfxNoise(0.10, 1800, 0.9, 0.24); sfxTone(520, 0.07, 'triangle', 0.10, 300); },
  };

  /* 弓箭蓄力：按阶段播放升调短音 */
  window.PixelSurvivalCharge = { tick: function(stage){
    try{
      if (!audioContext || audioContext.state !== 'running' || !settings.sound) return;
      sfxTone(520 + stage * 260, 0.06, 'triangle', 0.10);
    }catch(error){ /* ignore */ }
  } };

  /* 血月低频氛围音：低沉嗡鸣 + 缓慢起伏 */
  let bloodMoonOsc = null, bloodMoonGain = null, bloodMoonLfo = null;
  function setBloodMoon(active){
    try{
      if (active){
        if (bloodMoonOsc || !audioContext || audioContext.state !== 'running') return;
        bloodMoonOsc = audioContext.createOscillator();
        bloodMoonOsc.type = 'sine';
        bloodMoonOsc.frequency.value = 58;
        bloodMoonGain = audioContext.createGain();
        bloodMoonGain.gain.value = 0.045;
        bloodMoonLfo = audioContext.createOscillator();
        bloodMoonLfo.frequency.value = 0.18;
        const lfoGain = audioContext.createGain();
        lfoGain.gain.value = 0.03;
        bloodMoonLfo.connect(lfoGain);
        lfoGain.connect(bloodMoonGain.gain);
        bloodMoonOsc.connect(bloodMoonGain);
        bloodMoonGain.connect(typeof soundGain !== 'undefined' && soundGain ? soundGain : audioContext.destination);
        bloodMoonOsc.start();
        bloodMoonLfo.start();
      } else if (bloodMoonOsc){
        try{ bloodMoonOsc.stop(); if (bloodMoonLfo) bloodMoonLfo.stop(); }catch(error){ /* ignore */ }
        bloodMoonOsc = null; bloodMoonGain = null; bloodMoonLfo = null;
      }
    }catch(error){ /* 音频不可用时忽略 */ }
  }
  window.PixelSurvivalBloodMoon = { set: setBloodMoon };

  /* 材质包提取的音效样本（js/mc-sounds.js），按事件名缓存播放器 */
  const samplePlayers=Object.create(null);
  const MACHINE_SAMPLE={copperFurnace:'machine',crusher:'macerator',solarPanel:'arc',
    automaticHarvester:'chainsaw',logisticsRouter:'machineOpen',steamBoiler:'boiler',
    steamForge:'forge',arcFurnace:'arc',electrolyzer:'chemical',centrifuge:'centrifuge',
    highCompressor:'compressor',assembler:'craft',mixer:'mixer',chemicalReactor:'chemical',miner:'miner',bender:'forge',wiremill:'cut',washer:'cooling',transformer:'arc',batteryBuffer:'electric'};
  // 徒手/木石用轻敲声，别拿锯子、钻头这种机械音去当采集音
  const COLLECT_SAMPLE={rock:'soft_hammer',tree:'soft_hammer',bush:'soft_hammer'};
  const BLADE=/Sword|Knife|Blade|Axe/i;
  function playSample(name,contentId){
    const library=window.PixelSurvivalSounds;
    let key=name;
    if(name==='machine'&&MACHINE_SAMPLE[contentId])key=MACHINE_SAMPLE[contentId];
    else if(name==='collect'&&COLLECT_SAMPLE[contentId])key=COLLECT_SAMPLE[contentId];
    else if(name==='attack')key=BLADE.test(contentId||'')?'slash':'attack';
    const url=library&&(library[key]||library[name]);
    if(!url)return false;
    try{
      let base=samplePlayers[key];
      if(!base){
        base=samplePlayers[key]=new Audio(url);
        base.preload='auto';
      }
      const player=base.cloneNode();
      player.volume=Math.max(0.05,Math.min(0.8,settings.volume*2.2));
      const started=player.play();
      if(started&&typeof started.catch==='function')started.catch(()=>{});
      return true;
    }catch(error){
      return false;
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
    // 人的动作优先用《我的世界》风格合成音；机器保留机械样本
    const isMachine = name === 'machine' || name === 'machineOpen';
    if (!isMachine && MC_SFX[name]){
      try{ MC_SFX[name](); return; }catch(error){ /* 合成失败则回退样本 */ }
    }
    if(playSample(name,contentId))return;
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
  if(window.PixelGfx)PixelGfx.apply();
  else if(typeof setRenderQuality==='function')setRenderQuality(settings.quality);
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
