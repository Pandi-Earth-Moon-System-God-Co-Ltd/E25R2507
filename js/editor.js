'use strict';

/* ══════════════════════════════════════════════════════════
   创作工坊 · 全新编辑器（替换旧 Game Studio 界面）
   - 顶部模块切换 / 左侧内容列表 / 中间卡片式编辑 / 右侧实时预览
   - 内容通过 PixelSurvivalModAPI 注册，与旧内容库、存档完全兼容
   ══════════════════════════════════════════════════════════ */
const GameEditor = (function(){
  const root = document.getElementById('game-studio');
  const MAP_CELL = 7;

  const state = {
    tab: 'wizard',
    editing: null,
    draft: {},
    search: '',
    recipe: [],
    craftCount: 1,
    craftTier: 0,
    textureDraft: null,
    textureImage: null,
    machineRecipes: [],
    blueprintKind: 'creature',
    mapBrush: 'terrain:0',
    mapBrushSize: 1,
    templateLabel: '',
    wizard: { kind:null, id:'studio:my_weapon', name:'', power:8, tier:1, output:{ id:'stoneDust', count:1 }, drop:'wood', enemyRate:1, seed:1, fuel:'coal', desc:'', more:false, range:18, hydration:2, heal:0,
      materials:[{ id:'ironIngot', count:2 },{ id:'stick', count:1 }] },
    error: '',
    message: '',
  };

  let shell = null, listEl = null, editorEl = null, previewEl = null, statusEl = null;
  const DRAFT_KEY = 'pixel-survival-editor-draft';
  let draftTimer = 0;
  function persistDraft(){
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try{
        const payload = JSON.stringify({ tab:state.tab, draft:state.draft, recipe:state.recipe,
          machineRecipes:state.machineRecipes, editing:state.editing, texture:state.textureDraft });
        if (payload.length < 500000) localStorage.setItem(DRAFT_KEY, payload);
      }catch(error){ /* 配额不足就忽略 */ }
    }, 400);
  }
  function restoreDraft(){
    try{
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.tab) return false;
      state.tab = data.tab;
      state.draft = data.draft || {};
      state.recipe = data.recipe || [];
      state.machineRecipes = data.machineRecipes || [];
      state.editing = data.editing || null;
      state.textureDraft = data.texture || null;
      return true;
    }catch(error){ return false; }
  }
  function clearDraftCache(){
    try{ localStorage.removeItem(DRAFT_KEY); }catch(error){ /* ignore */ }
  }

  /* ── DOM helpers ───────────────────────────── */
  function el(tag, props, ...children){
    const node = document.createElement(tag);
    if (props) for (const [key, value] of Object.entries(props)){
      if (value === undefined || value === null) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'checked') node.checked = !!value;
      else if (key === 'value') node.value = value;
      else if (key === 'disabled') node.disabled = !!value;
      else if (key === 'title') node.title = value;
      else node.setAttribute(key, value);
    }
    for (const child of children.flat()){
      if (child === null || child === undefined || child === false) continue;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  }
  function field(label, control, hint){
    const wrap = el('label', { class:'ge-field' });
    wrap.append(el('span', { class:'ge-label', text:label }), control);
    if (hint) wrap.append(el('small', { class:'ge-hint', text:hint }));
    return wrap;
  }
  /* ── 撤销栈：600ms 内的连续输入合并成一步 ── */
  let lastSnapshotAt = 0;
  function snapshotDraft(){
    return JSON.stringify({ d: state.draft, r: state.recipe, m: state.machineRecipes,
      c: state.craftCount, t: state.craftTier });
  }
  function pushHistory(force){
    const now = Date.now();
    if (!force && now - lastSnapshotAt < 600) return;
    lastSnapshotAt = now;
    state.history.push(snapshotDraft());
    if (state.history.length > 30) state.history.shift();
  }
  function undo(){
    const previous = state.history.pop();
    if (!previous){ setStatus('没有可撤销的操作', true); return; }
    try{
      const data = JSON.parse(previous);
      state.draft = data.d || {};
      state.recipe = data.r || [];
      state.machineRecipes = data.m || [];
      state.craftCount = data.c || 1;
      state.craftTier = data.t || 0;
    }catch(error){ setStatus('撤销失败', true); return; }
    render();
    setStatus('已撤销上一步');
  }

  function setDraft(name, value){ pushHistory(); state.draft[name] = value; refreshPreview(); }
  function textInput(name, opts){
    opts = opts || {};
    const input = el('input', { type:'text', value:state.draft[name] === undefined ? '' : state.draft[name],
      maxLength: opts.max || 120, placeholder: opts.placeholder || '' });
    if (opts.readonly) input.readOnly = true;
    input.addEventListener('input', () => setDraft(name, input.value));
    return input;
  }
  function numberInput(name, opts){
    opts = opts || {};
    const input = el('input', { type:'number', value:state.draft[name] === undefined ? 0 : state.draft[name],
      min: opts.min === undefined ? 0 : opts.min, max: opts.max === undefined ? 9999 : opts.max,
      step: opts.step === undefined ? 1 : opts.step });
    input.addEventListener('input', () => {
      const value = Number(input.value);
      setDraft(name, Number.isFinite(value) ? value : 0);
    });
    return input;
  }
  function textArea(name, opts){
    opts = opts || {};
    const area = el('textarea', { maxLength: opts.max || 200 });
    area.value = state.draft[name] === undefined ? '' : state.draft[name];
    area.addEventListener('input', () => setDraft(name, area.value));
    return area;
  }
  function select(name, options){
    const node = el('select', {});
    for (const option of options){
      const value = Array.isArray(option) ? option[0] : option;
      const label = Array.isArray(option) ? option[1] : option;
      node.append(el('option', { value:String(value), text:label }));
    }
    node.value = String(state.draft[name] === undefined ? (options[0] ? (Array.isArray(options[0]) ? options[0][0] : options[0]) : '') : state.draft[name]);
    node.addEventListener('change', () => setDraft(name, node.value));
    return node;
  }
  function colorInput(name){
    const input = el('input', { type:'color', value:state.draft[name] || '#ffffff' });
    input.addEventListener('input', () => setDraft(name, input.value));
    return input;
  }
  function card(title, subtitle, ...children){
    const box = el('section', { class:'ge-card' });
    box.append(el('h3', { text:title }));
    if (subtitle) box.append(el('p', { class:'ge-card-sub', text:subtitle }));
    for (const child of children.flat()) if (child) box.append(child);
    return box;
  }
  function grid(...fields){ return el('div', { class:'ge-grid' }, ...fields); }
  function statCard(fields){
    const list = fields.filter(Boolean);
    if (!list.length) return card('数值设定', '按物品类型显示对应属性。',
      el('p', { class:'ge-note', text:'材料类物品没有额外属性，可直接保存。' }));
    return card('数值设定', '按物品类型显示对应属性。', grid(...list));
  }
  function itemOptions(filter){
    return Object.keys(ITEMS)
      .filter(id => !filter || filter(ITEMS[id]))
      .map(id => [id, ITEMS[id].name + '（' + id + '）']);
  }
  function setStatus(message, isError){
    state.error = isError ? message : '';
    state.message = isError ? '' : message;
    if (statusEl) statusEl.textContent = message || '';
    if (statusEl) statusEl.style.color = isError ? '#ff8a7a' : '#a8e08a';
  }

  /* ── 新建草稿 ─────────────────────────────── */
  function newItemDraft(){
    return { id:'studio:my_item', name:'新物品', desc:'由创作工坊创建', kind:'material',
      color:'#b58cff', color2:'#644a8b', hunger:10, hydration:0, heal:0, dmg:5, range:16, def:0.2, mine:1 };
  }
  function newBlockDraft(){
    return { id:'studio:my_block', name:'新方块', desc:'由创作工坊创建', color:'#8db15d', color2:'#3d7049', hardness:3, drop:'wood' };
  }
  function newMachineDraft(){
    return { id:'studio:my_machine', name:'新机器', desc:'自定义加工机器', blockId:'studio:my_machine_block',
      color:'#8b8b8b', color2:'#555555', fuelItem:'wood', fuelPerCraft:1,
      uiTitle:'新机器 · 加工', uiStatusLabel:'状态', uiInputLabel:'输入', uiOutputLabel:'产物',
      uiFuelLabel:'燃料', uiFooter:'加工时间与电力状态', uiBackground:'#c6c6c6', uiAccent:'#4f7a32', uiText:'#3f3f3f' };
  }
  function newSkillDraft(){
    return { id:'studio:skill', name:'新技能', desc:'描述技能效果', effect:'wave', level:1, xpCost:25, cost:20, cd:6, requires:[] };
  }
  function newMapDraft(){
    return { id:'studio:my_world', name:'新世界', desc:'自定义地图', seed:1, dayLength:600, seasonDays:8,
      hungerRate:1, thirstRate:1, enemyRate:1, startingFood:3, startingWater:2 };
  }
  function newBlueprintDraft(kind){
    const module = STUDIO_MODULES.find(entry => entry.id === kind);
    const draft = { id:'studio:my_' + kind, name:'新' + (kind === 'creature' ? '生物' : '逻辑'), desc:'' };
    for (const def of module.fields){
      const [key, , value] = def;
      draft[key] = typeof value === 'number' ? value : value;
    }
    return draft;
  }

  /* 模板：新建时先选一个，字段按模板预填 */
  const TEMPLATES = {
    items: [
      { label:'材料', hint:'最基础的材料：无额外属性，只需名称、颜色和图标。', make:() => newItemDraft() },
      { label:'食物', hint:'可食用物品：预设 饱食8 / 水分4 / 回血1，右键进食。', make:() => ({ ...newItemDraft(), id:'studio:my_food', name:'新食物', kind:'food', hunger:8, hydration:4, heal:1 }) },
      { label:'武器', hint:'近战武器：预设 攻击8 / 距离18，左键挥砍。', make:() => ({ ...newItemDraft(), id:'studio:my_weapon', name:'新武器', kind:'weapon', dmg:8, range:18 }) },
      { label:'工具', hint:'采集工具：预设采集效率 2，可挖更高等级的矿脉。', make:() => ({ ...newItemDraft(), id:'studio:my_tool', name:'新工具', kind:'tool', mine:2 }) },
      { label:'护甲', hint:'护甲：预设减伤 25%，拖到装备栏即可穿戴。', make:() => ({ ...newItemDraft(), id:'studio:my_armor', name:'新护甲', kind:'armor', def:0.25 }) },
    ],
    blocks: [
      { label:'装饰方块', hint:'普通方块：硬度 3，掉木头，可放进合成表。', make:() => newBlockDraft() },
      { label:'坚硬矿石方块', hint:'矿石方块：硬度 8，需要铁镐以上才能挖。', make:() => ({ ...newBlockDraft(), id:'studio:my_ore', name:'新矿石块', hardness:8 }) },
    ],
    machines: [
      { label:'加工机（1 进 1 出）', hint:'示例：石头 ×1 → 石粉 ×1（6 秒）。', make:() => newMachineDraft() },
      { label:'双配方机器', hint:'示例：石头→石粉、铁矿×2→铁粉，一台机器两种加工。', make:() => ({ ...newMachineDraft(), id:'studio:my_double', name:'双配方机器' }),
        recipes: [
          { id:'process_1', inputId:'stone', inputCount:1, outputId:'stoneDust', outputCount:1, duration:6, energy:0 },
          { id:'process_2', inputId:'ironOre', inputCount:2, outputId:'ironDust', outputCount:1, duration:9, energy:0 },
        ] },
      { label:'快速加工机', hint:'示例：铜矿→铜粉×2，2 秒一台，适合流水线。', make:() => ({ ...newMachineDraft(), id:'studio:my_fast', name:'快速加工机' }),
        recipes: [{ id:'process_1', inputId:'copperOre', inputCount:1, outputId:'copperDust', outputCount:2, duration:2, energy:0 }] },
    ],
    skills: [
      { label:'攻击技能', hint:'wave 效果：向前方打出一道冲击波。', make:() => ({ ...newSkillDraft(), effect:'wave' }) },
      { label:'位移技能', hint:'dash 效果：向前冲刺，冷却 5 秒。', make:() => ({ ...newSkillDraft(), id:'studio:dash_skill', name:'新位移', effect:'dash', cd:5 }) },
      { label:'防御技能', hint:'ward 效果：短时间减伤护盾，冷却 10 秒。', make:() => ({ ...newSkillDraft(), id:'studio:ward_skill', name:'新护盾', effect:'ward', cd:10 }) },
    ],
    maps: [
      { label:'小型世界', hint:'56×56 世界，默认规则，适合快速试玩。', make:() => ({ ...newMapDraft(), seed:1 }) },
      { label:'更大的一天', hint:'一天 1200 秒、敌袭 1.4 倍，节奏更慢更硬。', make:() => ({ ...newMapDraft(), id:'studio:long_day', name:'长昼世界', dayLength:1200, enemyRate:1.4 }) },
    ],
  };

  function applyTemplate(template){
    pushHistory(true);
    state.editing = null;
    state.textureDraft = null;
    state.textureImage = null;
    state.draft = template.make();
    state.templateLabel = template.label;
    if (state.tab === 'items'){ state.recipe = []; state.craftCount = 1; state.craftTier = 0; }
    if (state.tab === 'machines'){
      state.machineRecipes = template.recipes
        ? template.recipes.map(row => ({ ...row }))
        : [{ id:'process_1', inputId:'stone', inputCount:1, outputId:'stoneDust', outputCount:1, duration:6, energy:0 }];
    }
    render();
    setStatus('已套用模板：' + template.label + ' · 改完点保存即可');
  }

  function templateRow(){
    const list = TEMPLATES[state.tab];
    if (!list || state.editing) return null;
    const wrap = el('section', { class:'ge-card ge-template' },
      el('h3', { text:'从模板开始' }),
      el('p', { class:'ge-card-sub', text:'选一个最接近的模板，字段会预填好，改完直接保存。' }));
    const chips = el('div', { class:'ge-chips' });
    for (const template of list){
      const chip = el('button', { class:'ge-chip' + (state.templateLabel === template.label ? ' is-on' : ''), type:'button', text:template.label });
      chip.addEventListener('click', () => applyTemplate(template));
      chips.append(chip);
    }
    wrap.append(chips);
    const current = list.find(entry => entry.label === state.templateLabel);
    wrap.append(el('p', { class:'ge-hint', text: current && current.hint
      ? '当前模板 · ' + current.hint
      : '点一个模板，这里会显示它会生成什么内容。' }));
    return wrap;
  }

  const DEFAULTS = {
    items: newItemDraft, blocks: newBlockDraft, machines: newMachineDraft,
    skills: newSkillDraft, maps: newMapDraft,
  };

  /* ── 载入已有内容到草稿 ───────────────────── */
  function loadDraft(entry){
    pushHistory(true);
    state.editing = { tab: state.tab, id: entry.id };
    state.error = state.message = '';
    state.textureDraft = null;
    state.textureImage = null;
    if (state.tab === 'items'){
      const item = ITEMS[entry.id];
      state.draft = { id: entry.id, name:item.name, desc:item.desc || '', kind:item.kind || 'material',
        color:item.color, color2:item.color2, hunger:item.hunger || 0, hydration:item.hydration || 0,
        heal:item.heal || 0, dmg:item.dmg || 0, range:item.range || 16, def:item.def || 0, mine:item.mine || 1 };
      const recipe = RECIPES.find(r => r.out === entry.id);
      state.recipe = recipe ? Object.entries(recipe.need).map(([id, count]) => ({ id, count })) : [];
      state.craftCount = recipe ? recipe.count || 1 : 1;
      state.craftTier = recipe ? recipe.tier || 0 : 0;
    } else if (state.tab === 'blocks'){
      const item = ITEMS[entry.id];
      const properties = getStudioBlockProperties(entry.id);
      const definition = properties && properties.definition || {};
      state.draft = { id: entry.id, name:item.name, desc:item.desc || '', color:item.color, color2:item.color2,
        hardness:definition.hardness || 3, drop:definition.drop || 'wood' };
    } else if (state.tab === 'machines'){
      const type = MACHINE_TYPES[entry.id];
      const block = ITEMS[type.blockItem] || {};
      const ui = type.ui || {};
      state.draft = { id: entry.id, name:type.name, desc:block.desc || '', blockId:type.blockItem,
        color:block.color || '#8b8b8b', color2:block.color2 || '#555555',
        fuelItem:type.fuelItem, fuelPerCraft:type.fuelPerCraft,
        uiTitle:ui.title || type.name, uiStatusLabel:ui.statusLabel || '状态', uiInputLabel:ui.inputLabel || '输入',
        uiOutputLabel:ui.outputLabel || '产物', uiFuelLabel:ui.fuelLabel || '燃料', uiFooter:ui.footer || '',
        uiBackground:ui.background || '#c6c6c6', uiAccent:ui.accent || '#4f7a32', uiText:ui.text || '#3f3f3f' };
      state.machineRecipes = type.recipes.map(recipe => {
        const input = Object.entries(recipe.input)[0] || [];
        const output = Object.entries(recipe.output)[0] || [];
        return { id:recipe.id, inputId:input[0] || 'stone', inputCount:input[1] || 1,
          outputId:output[0] || 'stoneDust', outputCount:output[1] || 1,
          duration:recipe.duration, energy:recipe.energy || 0 };
      });
    } else if (state.tab === 'skills'){
      const skill = SKILLS.find(s => s.id === entry.id);
      state.draft = { id:skill.id, name:skill.name, desc:skill.desc, effect:skill.effect || 'spin',
        level:skill.level, xpCost:skill.xpCost, cost:skill.cost, cd:skill.cd, requires:[...skill.requires] };
    } else if (state.tab === 'maps'){
      const map = modDefinitions.maps[entry.id];
      state.draft = { id:map.id, name:map.name, desc:map.description || '', seed:map.seed,
        dayLength:map.rules.dayLength, seasonDays:map.rules.seasonDays, hungerRate:map.rules.hungerRate,
        thirstRate:map.rules.thirstRate, enemyRate:map.rules.enemyRate,
        startingFood:map.rules.startingFood, startingWater:map.rules.startingWater };
      studioWorldTiles = map.terrain.slice();
      studioWorldObjects = map.objects.map(object => ({ ...object }));
      studioWorldSpawn = { ...map.spawn };
    } else if (state.tab === 'blueprints'){
      const blueprint = modDefinitions.studioBlueprints.find(b => b.kind === entry.kind && b.id === entry.id);
      if (!blueprint) return;
      state.blueprintKind = blueprint.kind;
      state.draft = { ...blueprint.definition, id:blueprint.id, name:blueprint.name, desc:blueprint.description || '' };
    }
    render();
  }

  function clearDraft(){
    pushHistory(true);
    state.editing = null;
    state.templateLabel = '';
    state.textureDraft = null;
    state.textureImage = null;
    state.error = state.message = '';
    const factory = DEFAULTS[state.tab];
    if (factory){
      state.draft = factory();
      state.recipe = [];
      state.craftCount = 1;
      state.craftTier = 0;
      state.machineRecipes = [{ id:'process_1', inputId:'stone', inputCount:1, outputId:'stoneDust', outputCount:1, duration:6, energy:0 }];
    } else if (state.tab === 'blueprints'){
      state.draft = newBlueprintDraft(state.blueprintKind);
    } else {
      state.draft = {};
    }
    if (state.tab === 'maps'){
      const generated = studioGenerateTerrain(1);
      studioWorldTiles = Array.isArray(generated) ? generated : generated.terrain;
      studioWorldObjects = [];
      studioWorldSpawn = (generated && generated.spawn) || { x:MAP_W >> 1, y:MAP_H >> 1 };
    }
    render();
  }

  /* ── 内容列表 ─────────────────────────────── */
  function listEntries(){
    const tab = state.tab;
    if (tab === 'items'){
      return Object.keys(modDefinitions.items)
        .filter(id => ITEMS[id] && ITEMS[id].kind !== 'placeable')
        .map(id => ({ id, name:ITEMS[id].name, icon:id, kind:'物品' }));
    }
    if (tab === 'blocks'){
      return Object.keys(modDefinitions.blocks)
        .filter(id => ITEMS[id])
        .map(id => ({ id, name:ITEMS[id].name, icon:id, kind:'方块' }));
    }
    if (tab === 'machines'){
      return Object.keys(modDefinitions.machines)
        .filter(id => MACHINE_TYPES[id])
        .map(id => ({ id, name:MACHINE_TYPES[id].name, icon:MACHINE_TYPES[id].blockItem, kind:'机器' }));
    }
    if (tab === 'skills'){
      return SKILLS.map(skill => ({ id:skill.id, name:skill.name, kind:'技能',
        sub:modDefinitions.skillNodes.some(node => node.id === skill.id) ? '自定义' : '内置' }));
    }
    if (tab === 'maps'){
      return Object.keys(modDefinitions.maps).map(id => ({ id, name:modDefinitions.maps[id].name, kind:'地图' }));
    }
    if (tab === 'blueprints'){
      return modDefinitions.studioBlueprints
        .filter(entry => entry.kind === 'creature' || entry.kind === 'logic')
        .map(entry => ({ id:entry.id, name:entry.name, kind:entry.kind, sub:entry.kind === 'creature' ? '生物' : '逻辑' }));
    }
    return [];
  }
  function renderList(){
    if (!listEl) return;
    listEl.replaceChildren();
    listEl.append(el('div', { class:'ge-list-head' },
      el('input', { class:'ge-search', type:'search', value:state.search, placeholder:'搜索名称或 ID',
        oninput:event => { state.search = event.target.value; renderList(); } }),
      el('button', { class:'ge-btn primary', type:'button', text:'＋ 新建',
        onclick:() => { state.search = ''; clearDraft(); } })
    ));
    const keyword = state.search.trim().toLowerCase();
    const entries = listEntries().filter(entry =>
      !keyword || entry.name.toLowerCase().includes(keyword) || entry.id.toLowerCase().includes(keyword));
    if (!entries.length){
      listEl.append(el('p', { class:'ge-empty', text:keyword ? '没有匹配的内容' : '这里还没有内容，点「新建」开始。' }));
      return;
    }
    for (const entry of entries){
      const row = el('button', { class:'ge-item', type:'button' },
        el('span', { class:'ge-item-icon' }),
        el('span', { class:'ge-item-text' },
          el('strong', { text:entry.name }),
          el('small', { text:entry.id + (entry.sub ? ' · ' + entry.sub : '') })
        )
      );
      if (state.editing && state.editing.tab === state.tab && state.editing.id === entry.id)
        row.setAttribute('aria-selected', 'true');
      row.addEventListener('click', () => loadDraft(entry));
      if (entry.icon) drawIntoCanvas(row.querySelector('.ge-item-icon'), entry.icon, 22);
      const copy = el('span', { class:'ge-item-copy', text:'⧉', title:'复制为新内容' });
      copy.addEventListener('click', event => { event.stopPropagation(); duplicateEntry(entry); });
      if (!(state.tab === 'skills' && entry.sub === '内置')) row.append(copy);
      const remove = el('span', { class:'ge-item-del', text:'×', title:'删除' });
      remove.addEventListener('click', event => { event.stopPropagation(); requestDelete(entry); });
      if (!(state.tab === 'skills' && entry.sub === '内置')) row.append(remove);
      listEl.append(row);
    }
  }
  /* 复制为新内容：机器/技能/物品都能整份复制，改几个数值就是新内容 */
  function duplicateEntry(entry){
    try{
      loadDraft(entry);
    }catch(error){ setStatus(error.message, true); return; }
    state.editing = null;
    const base = String(state.draft.id || 'studio:copy').replace(/_copy\d*$/, '').replace(/:copy\d*$/, '');
    const taken = id => !!(ITEMS[id] || modDefinitions.textures[id] || modDefinitions.maps[id] ||
      modDefinitions.machines[id] || modDefinitions.blocks[id]);
    let n = 1, id = base + '_copy';
    while (taken(id)) id = base + '_copy' + (++n);
    state.draft.id = id;
    if (state.draft.blockId) state.draft.blockId = id + '_block';
    state.draft.name = (state.draft.name || entry.name || '新内容') + ' 副本';
    if (state.tab === 'skills') state.draft.requires = (state.draft.requires || []).filter(r => r !== entry.id);
    render();
    setStatus('已复制为「' + state.draft.name + '」· 改完点保存即可');
  }

  function requestDelete(entry){
    const label = entry.kind === '技能' ? '技能节点' : entry.kind || '内容';
    let refs = 0;
    try{
      if (typeof RECIPES !== 'undefined') refs = RECIPES.filter(recipe => recipe.out === entry.id ||
        Object.keys(recipe.need || {}).includes(entry.id)).length;
    }catch(error){ refs = 0; }
    const refText = refs ? '\n\n注意：有 ' + refs + ' 条配方引用了它，删除后这些配方会失效。' : '';
    if (!window.confirm('确定删除' + label + '「' + entry.name + '」吗？此操作无法撤销。' + refText)) return;
    try{
      if (state.tab === 'blueprints'){
        studioDeleteDefinition({ kind:entry.kind, id:entry.id, name:entry.name, blueprint:true });
      } else {
        studioDeleteDefinition({ kind:entry.kind, id:entry.id, name:entry.name });
      }
      if (state.editing && state.editing.id === entry.id) state.editing = null;
      setStatus('已删除 ' + entry.name);
      render();
    }catch(error){ setStatus(error.message, true); }
  }

  /* ── 预览 ─────────────────────────────────── */
  function drawIntoCanvas(target, id, size){
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    try{ drawItemIcon(context, id, 0, 0, size); }catch(error){ /* 图标不可用时留空 */ }
    target.replaceChildren(canvas);
    return canvas;
  }
  function refreshPreview(){
    if (!previewEl) return;
    previewEl.replaceChildren();
    previewEl.append(el('h2', { class:'ge-preview-title', text:'实时预览' }));
    if (state.tab === 'items' || state.tab === 'blocks' || state.tab === 'machines'){
      const iconId = state.tab === 'machines' ? state.draft.blockId : state.draft.id;
      const slot = el('div', { class:'ge-slot' });
      if (state.textureDraft && state.textureImage && state.textureImage.complete){
        const canvas = document.createElement('canvas');
        canvas.width = 48; canvas.height = 48;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.drawImage(state.textureImage, 0, 0, 48, 48);
        slot.append(canvas);
      } else if (iconId && ITEMS[iconId]){
        drawIntoCanvas(slot, iconId, 48);
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = 48; canvas.height = 48;
        const context = canvas.getContext('2d');
        context.fillStyle = state.draft.color2 || '#644a8b';
        context.fillRect(6, 6, 36, 36);
        context.fillStyle = state.draft.color || '#b58cff';
        context.fillRect(8, 8, 32, 32);
        context.fillStyle = 'rgba(0,0,0,0.35)';
        context.fillRect(8, 34, 32, 6);
        context.fillStyle = 'rgba(255,255,255,0.5)';
        context.fillRect(10, 10, 6, 6);
        slot.append(canvas);
      }
      previewEl.append(slot);
      const tip = el('div', { class:'ge-tip' },
        el('strong', { text:state.draft.name || '未命名' }),
        el('small', { class:'ge-tip-id', text:state.draft.id || '' })
      );
      if (state.tab === 'items'){
        const kindLabel = { material:'材料', food:'食物', weapon:'武器', tool:'工具', armor:'护甲' }[state.draft.kind] || '材料';
        tip.append(el('span', { class:'ge-tip-line', text:'类型：' + kindLabel }));
        if (state.draft.kind === 'food') tip.append(el('span', { class:'ge-tip-line', text:'饱食 +' + state.draft.hunger + ' · 水分 +' + state.draft.hydration + ' · 生命 ' + state.draft.heal }));
        if (state.draft.kind === 'weapon') tip.append(el('span', { class:'ge-tip-line', text:'攻击 +' + state.draft.dmg + ' · 距离 ' + state.draft.range }));
        if (state.draft.kind === 'tool') tip.append(el('span', { class:'ge-tip-line', text:'采集效率 ' + state.draft.mine }));
        if (state.draft.kind === 'armor') tip.append(el('span', { class:'ge-tip-line', text:'减伤 ' + Math.round((state.draft.def || 0) * 100) + '%' }));
      } else if (state.tab === 'blocks'){
        tip.append(el('span', { class:'ge-tip-line', text:'硬度 ' + state.draft.hardness + ' · 掉落 ' + (ITEMS[state.draft.drop] ? ITEMS[state.draft.drop].name : state.draft.drop) }));
      } else {
        tip.append(el('span', { class:'ge-tip-line', text:'燃料：' + (ITEMS[state.draft.fuelItem] ? ITEMS[state.draft.fuelItem].name : state.draft.fuelItem) }));
        tip.append(el('span', { class:'ge-tip-line', text:'配方 ' + state.machineRecipes.length + ' 条' }));
      }
      if (state.draft.desc) tip.append(el('span', { class:'ge-tip-desc', text:state.draft.desc }));
      previewEl.append(tip);
      previewEl.append(el('p', { class:'ge-hint-line',
        text:state.editing ? '保存后会更新游戏里的同名内容。' : '保存后内容会出现在背包 / 合成表里。' }));
      if (state.tab === 'machines'){
        previewEl.append(el('div', { class:'ge-machine-mock' },
          el('strong', { text:state.draft.uiTitle || state.draft.name }),
          el('p', { text:(state.draft.uiStatusLabel || '状态') + ' · 待机' }),
          el('p', { text:(state.draft.uiInputLabel || '输入') + ' · ' + ((state.machineRecipes[0] && state.machineRecipes[0].inputId) || '-') }),
          el('p', { text:(state.draft.uiOutputLabel || '产物') + ' · ' + ((state.machineRecipes[0] && state.machineRecipes[0].outputId) || '-') })
        ));
      }
    } else if (state.tab === 'skills'){
      previewEl.append(el('div', { class:'ge-tip' },
        el('strong', { text:(state.draft.name || '新技能') + ' · Lv.' + state.draft.level }),
        el('span', { class:'ge-tip-line', text:'XP ' + state.draft.xpCost + ' · 体力 ' + state.draft.cost + ' · 冷却 ' + state.draft.cd + 's' }),
        el('span', { class:'ge-tip-line', text:'效果 ' + (state.draft.effect || '-') + ' · 伤害 ×' + ((state.draft.effectParams||{}).damageMul || 2.2) + ' · 距离 ' + ((state.draft.effectParams||{}).reach || 160) }),
        el('span', { class:'ge-tip-desc', text:state.draft.desc || '' })));
    } else if (state.tab === 'maps'){
      const canvas = document.createElement('canvas');
      canvas.width = 168; canvas.height = 168;
      drawMapPreview(canvas);
      previewEl.append(canvas);
      previewEl.append(el('p', { class:'ge-hint-line', text:'56 × 56 · 出生点用绿色标记' }));
    } else if (state.tab === 'blueprints'){
      previewEl.append(el('div', { class:'ge-tip' },
        el('strong', { text:state.draft.name || '新蓝图' }),
        el('span', { class:'ge-tip-line', text:state.blueprintKind === 'creature' ? '生物蓝图' : '事件逻辑蓝图' }),
        el('span', { class:'ge-tip-desc', text:state.draft.desc || '' })));
    } else if (state.tab === 'wizard'){
      const w = state.wizard;
      if (!w.kind){
        previewEl.append(el('p', { class:'ge-hint-line', text:'先选一个类型，这里会显示成品的样子。' }));
      } else {
        const paint = (size) => {
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const c2 = canvas.getContext('2d');
          c2.imageSmoothingEnabled = false;
          const dark = w.kind === 'weapon' ? '#5f6870' : w.kind === 'food' ? '#8a5a24' : '#464c50';
          const light = w.kind === 'weapon' ? '#cfd8e0' : w.kind === 'food' ? '#e0a24b' : '#9aa0a6';
          c2.fillStyle = dark; c2.fillRect(size*0.12, size*0.12, size*0.76, size*0.76);
          c2.fillStyle = light; c2.fillRect(size*0.18, size*0.18, size*0.64, size*0.64);
          c2.fillStyle = 'rgba(255,255,255,0.35)'; c2.fillRect(size*0.18, size*0.18, size*0.28, size*0.12);
          return canvas;
        };
        const slot = el('div', { class:'ge-slot' });
        slot.append(paint(48));
        previewEl.append(el('p', { class:'ge-hint', text:'物品栏里的样子' }), slot);
        const tip = el('div', { class:'ge-tip' },
          el('strong', { text: w.name || '未命名' }),
          el('span', { class:'ge-tip-id', text: w.id || '' })
        );
        if (w.kind === 'weapon') tip.append(el('span', { class:'ge-tip-line', text:'攻击力 ' + w.power + '（木剑 5 / 铁剑 9 / 荧晶 14）' }));
        if (w.kind === 'food') tip.append(el('span', { class:'ge-tip-line', text:'恢复饱食 ' + w.power }));
        if (w.kind === 'machine') tip.append(el('span', { class:'ge-tip-line', text:'加工时间 ' + w.power + ' 秒 · 燃料 ' + ((ITEMS[w.fuel] || {}).name || w.fuel || '煤炭') }));
        if (w.kind === 'block') tip.append(el('span', { class:'ge-tip-line', text:'硬度 ' + w.power + ' · 掉落 ' + ((ITEMS[w.drop] || {}).name || w.drop) }));
        if (w.kind === 'map') tip.append(el('span', { class:'ge-tip-line', text:'一天 ' + w.power + ' 秒 · 敌袭 ×' + w.enemyRate + ' · 种子 ' + w.seed }));
        if (w.desc) tip.append(el('span', { class:'ge-tip-desc', text:w.desc }));
        tip.append(el('span', { class:'ge-tip-line', text:'科技 ' + (TECH_LEVELS[w.tier] ? TECH_LEVELS[w.tier].name : '原始时代') }));
        const matText = w.materials.length
          ? w.materials.map(row => ((ITEMS[row.id] || {}).name || row.id) + '×' + row.count).join(' + ')
          : '（暂无材料）';
        tip.append(el('span', { class:'ge-tip-desc', text: w.kind === 'machine'
          ? '配方：' + matText + ' → ' + ((ITEMS[w.output.id] || {}).name || w.output.id) + ' ×' + w.output.count
          : '配方：' + matText }));
        previewEl.append(tip);
        // 手持预览：模拟第一人称右下角的手
        const hand = document.createElement('canvas');
        hand.width = 96; hand.height = 72;
        hand.className = 'ge-hand-preview';
        const hc = hand.getContext('2d');
        hc.imageSmoothingEnabled = false;
        hc.fillStyle = '#2a2f2a'; hc.fillRect(0, 0, 96, 72);
        if (w.kind === 'weapon'){
          hc.save();
          hc.translate(64, 44);
          hc.rotate(-0.55);
          hc.drawImage(paint(38), -19, -19);
          hc.restore();
          hc.strokeStyle = 'rgba(255,220,140,0.55)';
          hc.lineWidth = 2;
          hc.beginPath();
          hc.arc(64, 44, 26, -1.2, -0.15);
          hc.stroke();
        } else {
          hc.drawImage(paint(40), 40, 20);
        }
        hc.fillStyle = 'rgba(0,0,0,0.35)'; hc.fillRect(0, 64, 96, 8);
        previewEl.append(el('p', { class:'ge-hint', text:'第一人称拿在手上' }), hand);
      }
    } else if (state.tab === 'character'){
      const canvas = document.createElement('canvas');
      canvas.width = 96; canvas.height = 128;
      canvas.className = 'ge-char-preview';
      drawPlayerPreview(canvas);
      previewEl.append(canvas);
    } else if (state.tab === 'mods'){
      previewEl.append(el('div', { class:'ge-tip' }, el('strong', { text:'内容统计' }),
        el('span', { class:'ge-tip-desc', text:studioCountDefinitions() })));
    } else {
      previewEl.append(el('p', { class:'ge-hint-line', text:'调整后立即生效，设置保存在当前浏览器。' }));
    }
  }

  /* ── 地图预览 / 绘制 ─────────────────────── */
  function drawMapPreview(canvas){
    const context = canvas.getContext('2d');
    const cell = canvas.width / MAP_W;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++){
      const terrain = MAP_TERRAIN[studioWorldTiles[y * MAP_W + x]] || MAP_TERRAIN[0];
      context.fillStyle = terrain.color;
      context.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
    }
    for (const object of studioWorldObjects){
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(Math.floor(object.x * cell), Math.floor(object.y * cell), Math.max(2, Math.ceil(cell)), Math.max(2, Math.ceil(cell)));
    }
    context.fillStyle = '#3dff6a';
    context.fillRect(Math.floor(studioWorldSpawn.x * cell) - 1, Math.floor(studioWorldSpawn.y * cell) - 1,
      Math.ceil(cell) + 2, Math.ceil(cell) + 2);
  }
  function drawMapCanvas(canvas){
    const context = canvas.getContext('2d');
    const cell = MAP_CELL;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++){
      const terrain = MAP_TERRAIN[studioWorldTiles[y * MAP_W + x]] || MAP_TERRAIN[0];
      context.fillStyle = terrain.color;
      context.fillRect(x * cell, y * cell, cell, cell);
    }
    for (const object of studioWorldObjects){
      context.fillStyle = 'rgba(20,20,20,0.85)';
      context.fillRect(object.x * cell + 1, object.y * cell + 1, cell - 2, cell - 2);
      context.fillStyle = '#f3e3a8';
      context.fillRect(object.x * cell + Math.floor(cell / 2) - 1, object.y * cell + Math.floor(cell / 2) - 1, 2, 2);
    }
    context.strokeStyle = 'rgba(0,0,0,0.18)';
    context.lineWidth = 1;
    for (let i = 0; i <= MAP_W; i += 8){
      context.beginPath(); context.moveTo(i * cell + 0.5, 0); context.lineTo(i * cell + 0.5, MAP_H * cell); context.stroke();
      context.beginPath(); context.moveTo(0, i * cell + 0.5); context.lineTo(MAP_W * cell, i * cell + 0.5); context.stroke();
    }
    context.strokeStyle = '#3dff6a';
    context.lineWidth = 2;
    context.strokeRect(studioWorldSpawn.x * cell + 1, studioWorldSpawn.y * cell + 1, cell - 2, cell - 2);
  }

  /* ── 各模块编辑区 ─────────────────────────── */
  function buildItems(){
    const kindButtons = el('div', { class:'ge-chips' });
    for (const [value, label] of [['material','材料'],['food','食物'],['weapon','武器'],['tool','工具'],['armor','护甲']]){
      const chip = el('button', { class:'ge-chip' + (state.draft.kind === value ? ' is-on' : ''), type:'button', text:label });
      chip.addEventListener('click', () => { state.draft.kind = value; render(); });
      kindButtons.append(chip);
    }
    const parts = [
      card('图标与名称', '名称会显示在背包提示框里；ID 创建后不建议修改。',
        grid(
          field('内容 ID', textInput('id', { readonly:!!state.editing, placeholder:'studio:my_item' }), '建议用 命名空间:名称'),
          field('名称', textInput('name', { max:48 })),
          field('描述', textArea('desc')),
          field('物品类型', kindButtons),
          field('主色', colorInput('color')),
          field('阴影色', colorInput('color2'))
        ),
        textureRow()),
      statCard([
        state.draft.kind === 'food' ? field('饱食恢复', numberInput('hunger', { min:0, max:99 })) : null,
        state.draft.kind === 'food' ? field('水分恢复', numberInput('hydration', { min:0, max:99 })) : null,
        state.draft.kind === 'food' ? field('生命恢复', numberInput('heal', { min:-99, max:99 })) : null,
        state.draft.kind === 'weapon' ? field('攻击力', numberInput('dmg', { min:0, max:999 })) : null,
        state.draft.kind === 'weapon' ? field('攻击距离', numberInput('range', { min:1, max:200 })) : null,
        state.draft.kind === 'tool' ? field('采集效率', numberInput('mine', { min:1, max:9 })) : null,
        state.draft.kind === 'armor' ? field('减伤比例', numberInput('def', { min:0, max:0.9, step:0.05 })) : null
      ]),
      recipeCard(),
      saveBar('保存物品'),
    ];
    editorEl.append(...parts.filter(Boolean));
  }

  function textureRow(){
    const wrap = el('div', { class:'ge-texture' });
    // 卡片里直接显示当前贴图（上传后立即更新）
    const thumb = document.createElement('canvas');
    thumb.width = 32; thumb.height = 32;
    thumb.className = 'ge-tex-thumb';
    const tc = thumb.getContext('2d');
    tc.imageSmoothingEnabled = false;
    tc.fillStyle = '#202020'; tc.fillRect(0, 0, 32, 32);
    const live = state.textureDraft && state.textureImage && state.textureImage.complete;
    const stored = modDefinitions.textures[state.draft.id];
    if (live) tc.drawImage(state.textureImage, 0, 0, 32, 32);
    else if (stored){
      const img = new Image();
      img.onload = () => { tc.imageSmoothingEnabled = false; tc.drawImage(img, 0, 0, 32, 32); };
      img.src = stored;
    }
    wrap.append(thumb);
    const info = el('small', { class:'ge-hint',
      text:modDefinitions.textures[state.draft.id] ? '当前使用自定义贴图（32×32）' : '未上传贴图时使用材质包图标' });
    const file = el('input', { type:'file', accept:'image/png,image/jpeg,image/webp' });
    file.addEventListener('change', async () => {
      const selected = file.files && file.files[0];
      if (!selected) return;
      try{
        const dataUrl = await studioNormalizeTexture(selected);
        state.textureDraft = dataUrl;
        const image = new Image();
        image.onload = refreshPreview;
        image.src = dataUrl;
        state.textureImage = image;
        setStatus('贴图已载入，保存后生效。');
        render();
      }catch(error){ setStatus(error.message, true); }
    });
    wrap.append(info, file);
    if (modDefinitions.textures[state.draft.id]){
      const remove = el('button', { class:'ge-btn danger', type:'button', text:'移除贴图' });
      remove.addEventListener('click', () => {
        try{ studioRemoveTexture(state.draft.id); state.textureDraft = null; state.textureImage = null;
          setStatus('已移除自定义贴图。'); render(); }catch(error){ setStatus(error.message, true); }
      });
      wrap.append(remove);
    }
    return wrap;
  }

  function recipeCard(){
    const rows = el('div', { class:'ge-recipe-rows' });
    state.recipe.forEach((row, index) => {
      const line = el('div', { class:'ge-recipe-row' },
        selectRow(row.id, id => { row.id = id; render(); }),
        el('input', { class:'ge-count', type:'number', min:1, max:99, value:row.count,
          oninput:event => { row.count = Math.max(1, Number(event.target.value) || 1); refreshPreview(); } }),
        el('button', { class:'ge-btn danger', type:'button', text:'×',
          onclick:() => { state.recipe.splice(index, 1); render(); } })
      );
      rows.append(line);
    });
    const add = el('button', { class:'ge-btn', type:'button', text:'＋ 添加材料',
      onclick:() => { state.recipe.push({ id:itemOptions()[0][0], count:1 }); render(); } });
    const craftGridBox = el('div', { class:'ge-craft-grid' });
    const canvas = document.createElement('canvas');
    canvas.width = 60; canvas.height = 60;
    craftGridBox.append(canvas);
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 9; i++){
      const x = (i % 3) * 20, y = Math.floor(i / 3) * 20;
      ctx.fillStyle = '#373737'; ctx.fillRect(x, y, 20, 20);
      ctx.fillStyle = '#8b8b8b'; ctx.fillRect(x + 1, y + 1, 18, 18);
    }
    state.recipe.slice(0, 9).forEach((row, index) => {
      if (!ITEMS[row.id]) return;
      drawItemIcon(ctx, row.id, (index % 3) * 20 + 2, Math.floor(index / 3) * 20 + 2, 16);
    });
    return card('制作配方', '留空表示这个内容不进入合成表。',
      el('div', { class:'ge-recipe-flex' }, craftGridBox, el('div', {},
        rows, add,
        grid(
          field('每次产出', numberInput('craftCount', { min:1, max:99 })),
          field('所需科技', select('craftTier', TECH_LEVELS.map((tech, index) => [String(index), tech.name])))
        ))));
  }
  /* 物品选择：可直接输入名称/ID 搜索（datalist 自动补全） */
  function itemLabel(id){
    const item = ITEMS[id];
    return item ? item.name + '（' + id + '）' : (id || '');
  }
  function selectRow(current, onChange){
    const input = el('input', { class:'ge-pick', type:'text', list:'ge-item-options',
      placeholder:'输入名称或 ID 搜索…', value: current ? itemLabel(current) : '' });
    const resolve = () => {
      const text = String(input.value || '').trim();
      const match = itemOptions().find(([id, label]) => label === text || id === text ||
        label.toLowerCase() === text.toLowerCase() || label.indexOf(text) === 0);
      if (match){ input.value = match[1]; onChange(match[0]); }
      else if (input.value){ input.value = current ? itemLabel(current) : ''; }
    };
    input.addEventListener('change', resolve);
    input.addEventListener('blur', resolve);
    return input;
  }
  function itemDatalist(){
    const list = el('datalist', { id:'ge-item-options' });
    for (const [id, label] of itemOptions()) list.append(el('option', { value:label, text:id }));
    return list;
  }

  function buildBlocks(){
    const parts = [
      card('方块信息', '方块会出现在制作表中，可放置到世界里。',
        grid(
          field('内容 ID', textInput('id', { readonly:!!state.editing })),
          field('名称', textInput('name', { max:48 })),
          field('描述', textArea('desc')),
          field('掉落物', select('drop', itemOptions())),
          field('硬度', numberInput('hardness', { min:1, max:100 })),
          field('主色', colorInput('color')),
          field('阴影色', colorInput('color2'))
        ),
        textureRow()),
      saveBar('保存方块'),
    ];
    editorEl.append(...parts.filter(Boolean));
  }

  function buildMachines(){
    const recipeList = el('div', { class:'ge-machine-recipes' });
    state.machineRecipes.forEach((recipe, index) => {
      recipeList.append(el('div', { class:'ge-machine-recipe' },
        el('span', { class:'ge-recipe-index', text:'#' + (index + 1) }),
        selectRow(recipe.inputId, id => { recipe.inputId = id; render(); }),
        el('input', { class:'ge-count', type:'number', min:1, max:99, value:recipe.inputCount,
          oninput:event => { recipe.inputCount = Math.max(1, Number(event.target.value) || 1); refreshPreview(); } }),
        el('span', { class:'ge-arrow', text:'→' }),
        selectRow(recipe.outputId, id => { recipe.outputId = id; render(); }),
        el('input', { class:'ge-count', type:'number', min:1, max:99, value:recipe.outputCount,
          oninput:event => { recipe.outputCount = Math.max(1, Number(event.target.value) || 1); refreshPreview(); } }),
        el('input', { class:'ge-time', type:'number', min:1, max:3600, value:recipe.duration, title:'加工秒数',
          oninput:event => { recipe.duration = Number(event.target.value) || 1; } }),
        el('button', { class:'ge-btn danger', type:'button', text:'×', title:'删除配方',
          onclick:() => { state.machineRecipes.splice(index, 1); render(); } })
      ));
    });
    const addRecipe = el('button', { class:'ge-btn', type:'button', text:'＋ 添加配方',
      onclick:() => {
        state.machineRecipes.push({ inputId:'stone', inputCount:1, outputId:'stoneDust', outputCount:1, duration:6, energy:0 });
        render();
      } });
    editorEl.append(
      card('机器方块', '机器会以一个可放置方块的形式出现在游戏里。',
        grid(
          field('机器 ID', textInput('id', { readonly:!!state.editing })),
          field('机器名称', textInput('name', { max:48 })),
          field('机器方块 ID', textInput('blockId', { readonly:!!state.editing })),
          field('方块描述', textArea('desc')),
          field('燃料物品', select('fuelItem', itemOptions(item => item.kind !== 'placeable'))),
          field('每批燃料', numberInput('fuelPerCraft', { min:1, max:99 })),
          field('主色', colorInput('color')),
          field('阴影色', colorInput('color2'))
        ),
        textureRow()),
      card('加工配方', '输入 → 产出，可添加多条。', recipeList, addRecipe),
      card('机器界面', '放置机器后打开的界面文字与颜色。',
        grid(
          field('标题', textInput('uiTitle', { max:48 })),
          field('状态文字', textInput('uiStatusLabel', { max:48 })),
          field('输入栏文字', textInput('uiInputLabel', { max:48 })),
          field('产物栏文字', textInput('uiOutputLabel', { max:48 })),
          field('燃料栏文字', textInput('uiFuelLabel', { max:48 })),
          field('底部说明', textInput('uiFooter', { max:48 })),
          field('界面底色', colorInput('uiBackground')),
          field('强调色', colorInput('uiAccent')),
          field('文字颜色', colorInput('uiText'))
        )),
      saveBar('保存机器')
    );
  }

  function buildSkills(){
    const requires = el('div', { class:'ge-chips' });
    for (const skill of SKILLS){
      if (skill.id === state.draft.id) continue;
      const on = state.draft.requires.includes(skill.id);
      const chip = el('button', { class:'ge-chip' + (on ? ' is-on' : ''), type:'button', text:skill.name });
      chip.addEventListener('click', () => {
        state.draft.requires = on ? state.draft.requires.filter(id => id !== skill.id)
          : [...state.draft.requires, skill.id];
        render();
      });
      requires.append(chip);
    }
    editorEl.append(
      card('技能节点', '技能会在 N 技能树中显示，消耗技能经验解锁。',
        grid(
          field('技能 ID', textInput('id', { readonly:!!state.editing })),
          field('名称', textInput('name', { max:48 })),
          field('说明', textArea('desc')),
          field('战斗效果', select('effect', (typeof SKILL_EFFECTS !== 'undefined' ? SKILL_EFFECTS : []).map(effect => [effect.id, effect.name]))),
          field('伤害倍率', el('input', { type:'number', min:0.5, max:6, step:0.1,
            value: (state.draft.effectParams && state.draft.effectParams.damageMul) || 2.2,
            oninput: event => { state.draft.effectParams = { ...(state.draft.effectParams||{}), damageMul: Number(event.target.value) }; refreshPreview(); } })),
          field('作用距离', el('input', { type:'number', min:20, max:400, step:10,
            value: (state.draft.effectParams && state.draft.effectParams.reach) || 160,
            oninput: event => { state.draft.effectParams = { ...(state.draft.effectParams||{}), reach: Number(event.target.value) }; refreshPreview(); } })),
          field('持续时间（护盾/震地）', el('input', { type:'number', min:0.5, max:20, step:0.5,
            value: (state.draft.effectParams && state.draft.effectParams.duration) || 4,
            oninput: event => { state.draft.effectParams = { ...(state.draft.effectParams||{}), duration: Number(event.target.value) }; refreshPreview(); } })),
          field('等级要求', numberInput('level', { min:1, max:99 })),
          field('技能经验', numberInput('xpCost', { min:0, max:9999 })),
          field('体力消耗', numberInput('cost', { min:1, max:100 })),
          field('冷却秒数', numberInput('cd', { min:1, max:120 }))
        ),
        field('前置技能', requires)),
      saveBar('保存技能')
    );
  }

  function buildMaps(){
    const brushes = el('div', { class:'ge-brushes' });
    MAP_TERRAIN.forEach((terrain, index) => {
      const value = 'terrain:' + index;
      const chip = el('button', { class:'ge-chip' + (state.mapBrush === value ? ' is-on' : ''), type:'button', text:terrain.name });
      chip.style.background = terrain.color;
      chip.style.color = '#101010';
      chip.addEventListener('click', () => { state.mapBrush = value; render(); });
      brushes.append(chip);
    });
    MAP_OBJECTS.forEach(object => {
      const value = 'object:' + object.id;
      const chip = el('button', { class:'ge-chip' + (state.mapBrush === value ? ' is-on' : ''), type:'button', text:object.name });
      chip.addEventListener('click', () => { state.mapBrush = value; render(); });
      brushes.append(chip);
    });
    const sizeRow = el('div', { class:'ge-brush-size' }, el('span', { class:'ge-label', text:'笔刷大小' }));
    for (const size of [1, 2, 3]){
      const chip = el('button', { class:'ge-chip' + ((state.mapBrushSize || 1) === size ? ' is-on' : ''), type:'button', text:size + '×' + size, title:'地形与物件笔刷大小' });
      chip.addEventListener('click', () => { state.mapBrushSize = size; render(); });
      sizeRow.append(chip);
    }
    const spawnChip = el('button', { class:'ge-chip' + (state.mapBrush === 'spawn' ? ' is-on' : ''), type:'button', text:'出生点' });
    spawnChip.addEventListener('click', () => { state.mapBrush = 'spawn'; render(); });
    brushes.append(spawnChip);

    const canvas = el('canvas', { class:'ge-map-canvas', width:MAP_W * MAP_CELL, height:MAP_H * MAP_CELL });
    drawMapCanvas(canvas);
    let painting = false;
    const paint = event => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left) / rect.width * MAP_W);
      const y = Math.floor((event.clientY - rect.top) / rect.height * MAP_H);
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
      if (state.mapBrush === 'spawn'){
        studioWorldSpawn = { x, y };
      } else if (state.mapBrush.startsWith('object:')){
        const type = state.mapBrush.slice(7);
        const size = Math.max(1, Math.min(3, state.mapBrushSize || 1));
        const half = Math.floor(size / 2);
        for (let dy = -half; dy < size - half; dy++){
          for (let dx = -half; dx < size - half; dx++){
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
            const index = studioWorldObjects.findIndex(object => object.x === nx && object.y === ny);
            if (index >= 0){
              // 单格笔刷再点一次是擦除；大笔刷只补空位，避免误删
              if (size === 1) studioWorldObjects.splice(index, 1);
            } else if (studioWorldObjects.length < 2048){
              studioWorldObjects.push({ x:nx, y:ny, type });
            }
          }
        }
      } else {
        const terrainIndex = Number(state.mapBrush.slice(8)) || 0;
        const size = Math.max(1, Math.min(3, state.mapBrushSize || 1));
        const half = Math.floor(size / 2);
        for (let dy = -half; dy < size - half; dy++){
          for (let dx = -half; dx < size - half; dx++){
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
            studioWorldTiles[ny * MAP_W + nx] = terrainIndex;
          }
        }
      }
      drawMapCanvas(canvas);
      refreshPreview();
    };
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      painting = true;
      canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
      paint(event);
    });
    canvas.addEventListener('pointermove', event => { if (painting) paint(event); });
    canvas.addEventListener('pointerup', () => { painting = false; });
    canvas.addEventListener('pointerleave', () => { painting = false; });

    editorEl.append(
      card('绘制地图', '左键绘制；物件笔刷再点一次可擦除。笔刷大小对地形和物件都生效（单格时点已有物件=擦除）。',
        brushes, sizeRow,
        el('div', { class:'ge-map-actions' },
          el('button', { class:'ge-btn', type:'button', text:'随机地形',
            onclick:() => { const generated = studioGenerateTerrain(Math.max(1, Number(state.draft.seed) || 1)); studioWorldTiles = Array.isArray(generated) ? generated : generated.terrain; if (generated && generated.spawn) studioWorldSpawn = generated.spawn; drawMapCanvas(canvas); refreshPreview(); } }),
          el('button', { class:'ge-btn danger', type:'button', text:'清空物件',
            onclick:() => { studioWorldObjects = []; drawMapCanvas(canvas); refreshPreview(); } })
        ),
        canvas),
      card('世界规则',
        grid(
          field('地图 ID', textInput('id', { readonly:!!state.editing })),
          field('地图名称', textInput('name', { max:48 })),
          field('地图说明', textArea('desc')),
          field('地形种子', numberInput('seed', { min:1, max:4294967295 })),
          field('一天秒数', numberInput('dayLength', { min:30, max:1800 })),
          field('每季天数', numberInput('seasonDays', { min:2, max:32 })),
          field('饥饿倍率', numberInput('hungerRate', { min:0, max:3, step:0.1 })),
          field('口渴倍率', numberInput('thirstRate', { min:0, max:3, step:0.1 })),
          field('敌袭倍率', numberInput('enemyRate', { min:0, max:3, step:0.1 })),
          field('初始食物', numberInput('startingFood', { min:0, max:99 })),
          field('初始空瓶', numberInput('startingWater', { min:0, max:99 }))
        )),
      saveBar('保存地图')
    );
  }

  function buildBlueprints(){
    const kindChips = el('div', { class:'ge-chips' });
    for (const [kind, label] of [['creature','生物设计'],['logic','事件逻辑']]){
      const chip = el('button', { class:'ge-chip' + (state.blueprintKind === kind ? ' is-on' : ''), type:'button', text:label });
      chip.addEventListener('click', () => {
        state.blueprintKind = kind;
        state.editing = null;
        state.draft = newBlueprintDraft(kind);
        render();
      });
      kindChips.append(chip);
    }
    const module = STUDIO_MODULES.find(entry => entry.id === state.blueprintKind);
    const fields = [];
    for (const def of module.fields){
      const [key, label, value, type, options] = def;
      if (key === 'id' || key === 'name' || key === 'desc') continue;
      if (type === 'number') fields.push(field(label, numberInput(key)));
      else if (type === 'select') fields.push(field(label, select(key, options || [])));
      else if (type === 'itemSelect') fields.push(field(label, select(key, itemOptions())));
      else fields.push(field(label, textInput(key, { max:160 })));
    }
    editorEl.append(
      card('蓝图类型', '蓝图会保存在本地内容库，可导出分享；暂不接入游戏运行时。', kindChips),
      card('蓝图内容', '',
        grid(
          field('蓝图 ID', textInput('id', { readonly:!!state.editing })),
          field('名称', textInput('name', { max:48 })),
          field('说明', textArea('desc')),
          ...fields
        )),
      saveBar('保存蓝图')
    );
  }

  function buildCharacter(){
    const rows = el('div', { class:'ge-char-rows' });
    const groups = [
      ['skin','肤色',PLAYER_CUSTOMIZATION.skin.map((option, index) => [String(index), option.name])],
      ['hairStyle','发型',PLAYER_CUSTOMIZATION.hairStyle.map((option, index) => [String(index), option])],
      ['hairColor','发色',PLAYER_CUSTOMIZATION.hairColor.map((option, index) => [String(index), option.name])],
      ['outfit','服装',PLAYER_CUSTOMIZATION.outfit.map((option, index) => [String(index), option.name])],
      ['outfitStyle','款式',PLAYER_CUSTOMIZATION.outfitStyle.map((option, index) => [String(index), option])],
      ['eyes','眼睛',PLAYER_CUSTOMIZATION.eyes.map((option, index) => [String(index), option.name])],
      ['faceDetail','面部',PLAYER_CUSTOMIZATION.faceDetail.map((option, index) => [String(index), option])],
      ['hat','头饰',PLAYER_CUSTOMIZATION.hat.map((option, index) => [String(index), option])],
      ['back','背饰',PLAYER_CUSTOMIZATION.back.map((option, index) => [String(index), option])],
    ];
    for (const [key, label, options] of groups){
      const node = el('select', {});
      for (const [value, text] of options) node.append(el('option', { value, text }));
      node.value = String(player.appearance[key]);
      node.addEventListener('change', () => {
        player.appearance[key] = Number(node.value);
        refreshPreview();
      });
      rows.append(el('div', { class:'ge-char-row' }, el('span', { text:label }), node));
    }
    const spriteInput = el('input', { type:'file', accept:'image/png,image/jpeg,image/webp' });
    spriteInput.addEventListener('change', async () => {
      const file = spriteInput.files && spriteInput.files[0];
      if (!file) return;
      try{
        const dataUrl = await studioNormalizePlayerSprite(file);
        studioStoreAsset('playerSprite', dataUrl);
        setStatus('角色立绘已更新。');
        render();
      }catch(error){ setStatus(error.message, true); }
    });
    const removeSprite = el('button', { class:'ge-btn danger', type:'button', text:'移除立绘',
      onclick:() => { try{ studioStoreAsset('playerSprite', ''); setStatus('已恢复程序绘制外观。'); render(); }
        catch(error){ setStatus(error.message, true); } } });
    editorEl.append(
      card('角色外观', '只改变外观，不影响属性。',
        rows,
        el('div', { class:'ge-row-inline' }, spriteInput, removeSprite)),
      el('div', { class:'ge-savebar' },
        el('button', { class:'ge-btn primary', type:'button', text:'应用并保存', onclick:() => {
          try{ saveGame(); setStatus('人物外观已保存。'); }catch(error){ setStatus(error.message, true); }
        } }),
        el('button', { class:'ge-btn', type:'button', text:'返回游戏', onclick:closeEditor }))
    );
  }

  function buildMedia(){
    const settings = PixelSurvivalAudio.getSettings();
    const toggle = (key, label) => {
      const input = el('input', { type:'checkbox', checked:settings[key] });
      input.addEventListener('change', () => {
        try{ PixelSurvivalAudio.setSettings({ [key]:input.checked }); setStatus(label + (input.checked ? ' 已开启' : ' 已关闭')); }
        catch(error){ setStatus(error.message, true); }
      });
      return el('label', { class:'ge-check' }, input, el('span', { text:label }));
    };
    const volume = el('input', { type:'range', min:0, max:0.5, step:0.01, value:settings.volume });
    volume.addEventListener('change', () => {
      try{ PixelSurvivalAudio.setSettings({ volume:Number(volume.value) }); setStatus('音量已更新'); }
      catch(error){ setStatus(error.message, true); }
    });
    editorEl.append(
      card('声音与动画', '设置保存在当前浏览器；游戏音效来自 2233 材质包。',
        el('div', { class:'ge-checks' }, toggle('music','背景音乐'), toggle('sound','操作音效'), toggle('animations','环境动画')),
        field('音量', volume)),
      card('说明', '', el('p', { class:'ge-note', text:'音效已替换为材质包里的提取样本（敲击、加工、机械等），无需再上传音频。' }))
    );
  }

  /* 跳过已存在的定义（协作合并时用） */
  function filterExisting(defs){
    const out = JSON.parse(JSON.stringify(defs));
    for (const id of Object.keys(out.items || {})) if (ITEMS[id]) delete out.items[id];
    for (const id of Object.keys(out.blocks || {})) if (ITEMS[id]) delete out.blocks[id];
    for (const id of Object.keys(out.machines || {})) if (MACHINE_TYPES[id]) delete out.machines[id];
    for (const id of Object.keys(out.maps || {})) if (modDefinitions.maps[id]) delete out.maps[id];
    for (const id of Object.keys(out.textures || {})) if (modDefinitions.textures[id]) delete out.textures[id];
    for (const id of Object.keys(out.assets || {})) if (modDefinitions.assets[id]) delete out.assets[id];
    if (Array.isArray(out.recipes)) out.recipes = out.recipes.filter(recipe => !RECIPES.some(existing => existing.out === recipe.out));
    if (Array.isArray(out.machineRecipes)) out.machineRecipes = out.machineRecipes.filter(recipe => !MACHINE_TYPES[recipe.out] && !ITEMS[recipe.out]);
    if (Array.isArray(out.skillNodes)) out.skillNodes = out.skillNodes.filter(node => !SKILLS.some(skill => skill.id === node.id));
    if (Array.isArray(out.studioBlueprints)) out.studioBlueprints = out.studioBlueprints.filter(blueprint =>
      !modDefinitions.studioBlueprints.some(existing => existing.kind === blueprint.kind && existing.id === blueprint.id));
    return out;
  }

  async function importModPackage(input){
    const file = input.files && input.files[0];
    if (!file) return;
    try{
      if (file.size > 8 * 1024 * 1024) throw new Error('MOD 包不能超过 8 MB');
      const pkg = JSON.parse(await file.text());
      if (!pkg || pkg.format !== 'PixelSurvivalGameStudioMod' || pkg.version !== 1)
        throw new Error('文件不是受支持的创作工坊 MOD 包');
      if (!pkg.definitions) throw new Error('MOD 定义结构无效');
      const mode = state.importMode || 'skip';
      const defs = mode === 'skip' ? filterExisting(pkg.definitions) : pkg.definitions;
      const imported = studioImportPackage(defs, pkg.metadata);
      render();
      setStatus(imported ? '导入完成（' + (mode === 'skip' ? '已跳过重名内容' : '已覆盖重名内容') + '）' : '已取消导入');
    }catch(error){
      setStatus('导入失败：' + error.message, true);
    }finally{
      input.value = '';
    }
  }

  /* ── 向导：从「我要做什么」开始 ── */
  const WIZARD_KINDS = [
    ['weapon', '一把武器', '攻击力越高越强，材料决定造价'],
    ['food', '一件食物', '恢复饱食与水分'],
    ['machine', '一台机器', '输入材料 → 产出成品，自动生成方块'],
    ['block', '一个方块', '可以放置进世界、进合成表的方块'],
    ['map', '一个新世界', '自定义地形规则的世界'],
  ];

  function buildWizard(){
    const w = state.wizard;
    if (state.draft.wizardTier === undefined) state.draft.wizardTier = String(w.tier || 0);
    if (!w.fuel) w.fuel = 'coal';
    if (!w.output) w.output = { id:'stoneDust', count:1 };
    const kindRow = el('div', { class:'ge-chips' });
    for (const [kind, label, hint] of WIZARD_KINDS){
      const chip = el('button', { class:'ge-chip' + (w.kind === kind ? ' is-on' : ''), type:'button', text:label, title:hint });
      chip.addEventListener('click', () => {
        w.kind = kind;
        state.textureDraft = null; state.textureImage = null;
        w.id = kind === 'machine' ? 'studio:my_machine'
          : kind === 'food' ? 'studio:my_food'
          : kind === 'block' ? 'studio:my_block'
          : kind === 'map' ? 'studio:my_world'
          : 'studio:my_weapon';
        w.name = label.replace('一', '我的').replace('台', '');
        render();
      });
      kindRow.append(chip);
    }
    editorEl.append(card('① 你想做什么？', '选一个目标，下面只显示需要的字段。', kindRow));
    if (!w.kind){
      editorEl.append(el('p', { class:'ge-note', text:'先选一个类型，这里是给不写代码的同事用的快速通道；高级功能在顶部其它标签里。' }));
      return;
    }

    const fields = [];
    fields.push(field('名字', el('input', { type:'text', value:w.name, maxLength:24,
      oninput:event => { w.name = event.target.value; refreshPreview(); } })));
    if (w.kind === 'weapon'){
      fields.push(field('攻击力（木剑5 / 铁剑9 / 荧晶14）', el('input', { type:'number', min:1, max:30, value:w.power,
        oninput:event => { w.power = Number(event.target.value) || 1; } })));
    }
    if (w.kind === 'food'){
      fields.push(field('恢复饱食', el('input', { type:'number', min:1, max:20, value:w.power,
        oninput:event => { w.power = Number(event.target.value) || 1; } })));
    }
    if (w.kind === 'machine'){
      fields.push(field('加工时间（秒）', el('input', { type:'number', min:1, max:60, value:w.power,
        oninput:event => { w.power = Number(event.target.value) || 1; } })));
      fields.push(field('产出物品', selectRow(w.output.id, id => { w.output.id = id; render(); })));
      fields.push(field('产出数量', el('input', { type:'number', min:1, max:64, value:w.output.count,
        oninput:event => { w.output.count = Math.max(1, Number(event.target.value) || 1); refreshPreview(); } })));
      fields.push(field('燃料', selectRow(w.fuel, id => { w.fuel = id; render(); })));
    }
    if (w.kind === 'block'){
      fields.push(field('硬度（木镐能挖3以下）', el('input', { type:'number', min:1, max:100, value:w.power,
        oninput:event => { w.power = Number(event.target.value) || 1; refreshPreview(); } })));
      fields.push(field('挖掉后掉落', selectRow(w.drop, id => { w.drop = id; render(); })));
    }
    if (w.kind === 'map'){
      fields.push(field('一天多少秒', el('input', { type:'number', min:60, max:1800, value:w.power,
        oninput:event => { w.power = Number(event.target.value) || 600; refreshPreview(); } })));
      fields.push(field('敌袭倍率', el('input', { type:'number', min:0, max:3, step:0.1, value:w.enemyRate,
        oninput:event => { w.enemyRate = Number(event.target.value) || 1; refreshPreview(); } })));
      fields.push(field('地形种子', el('input', { type:'number', min:1, max:99999, value:w.seed,
        oninput:event => { w.seed = Number(event.target.value) || 1; refreshPreview(); } })));
    }
    if (w.kind !== 'map') fields.push(field('需要科技等级', select('wizardTier', TECH_LEVELS.map((tech, index) => [String(index), tech.name]))));

    const matRows = el('div', { class:'ge-recipe-rows' });
    w.materials.forEach((row, index) => {
      matRows.append(el('div', { class:'ge-recipe-row' },
        selectRow(row.id, id => { row.id = id; render(); }),
        el('input', { class:'ge-count', type:'number', min:1, max:64, value:row.count,
          oninput:event => { row.count = Math.max(1, Number(event.target.value) || 1); } }),
        el('button', { class:'ge-btn danger', type:'button', text:'×',
          onclick:() => { w.materials.splice(index, 1); render(); } })
      ));
    });

    editorEl.append(
      card('② 叫什么、有多强', '不填也能用，默认值已经能跑。', grid(...fields),
        el('div', { class:'ge-texture' },
          el('small', { class:'ge-hint', text: state.textureDraft ? '已选择贴图（保存后生效）' : '贴图可选：上传 PNG，右侧预览会立即更新' }),
          (() => {
            const input = el('input', { type:'file', accept:'image/png,image/jpeg,image/webp' });
            const accept = async file => {
              if (!file) return;
              try{
                const dataUrl = await studioNormalizeTexture(file);
                state.textureDraft = dataUrl;
                const image = new Image();
                image.onload = refreshPreview;
                image.src = dataUrl;
                state.textureImage = image;
                render();
              }catch(error){ setStatus(error.message, true); }
            };
            input.addEventListener('drop', event => {
              event.preventDefault();
              accept(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
            });
            input.addEventListener('dragover', event => event.preventDefault());
            input.addEventListener('change', async () => {
              const file = input.files && input.files[0];
              if (!file) return;
              try{
                const dataUrl = await studioNormalizeTexture(file);
                state.textureDraft = dataUrl;
                const image = new Image();
                image.onload = refreshPreview;
                image.src = dataUrl;
                state.textureImage = image;
                render();
              }catch(error){ setStatus(error.message, true); }
            });
            return input;
          })(),
          state.textureDraft ? (() => {
            const remove = el('button', { class:'ge-btn danger', type:'button', text:'移除贴图' });
            remove.addEventListener('click', () => { state.textureDraft = null; state.textureImage = null; render(); });
            return remove;
          })() : null
        )),
      ...(w.kind === 'map' ? [] : [card('③ 用什么做', '搜物品名，填数量；这就是合成配方。', matRows,
        el('button', { class:'ge-btn', type:'button', text:'＋ 加材料',
          onclick:() => { w.materials.push({ id:'stone', count:1 }); render(); } }))]),
      el('div', { class:'ge-savebar' },
        el('button', { class:'ge-btn primary', type:'button', text:'保存并试玩', onclick:wizardSave }),
        el('button', { class:'ge-btn', type:'button', text:'重置', onclick:() => { state.tab='wizard'; state.wizard.kind=null; render(); } }),
        el('button', { class:'ge-btn', type:'button', text:'返回游戏', onclick:closeEditor })
      )
    );
  }

  function wizardSave(){
    const w = state.wizard;
    if (!w.kind){ setStatus('先选一个类型', true); return; }
    const prevTab = state.tab, prevDraft = state.draft, prevRecipe = state.recipe, prevEditing = state.editing;
    try{
      state.editing = null;
      const name = (w.name || '新内容').trim();
      if (w.kind === 'weapon' || w.kind === 'food'){
        state.tab = 'items';
        state.draft = { id:w.id, name, desc:(w.desc || '向导创建'), kind:w.kind,
          color: w.kind === 'weapon' ? '#cfd8e0' : '#e0a24b', color2: w.kind === 'weapon' ? '#6b7480' : '#8a5a24',
          dmg: w.power, range: w.range, hunger: w.power, hydration: w.hydration, heal: w.heal, mine: 1, def: 0 };
        state.recipe = w.materials.map(row => ({ id:row.id, count:row.count }));
        state.craftCount = 1;
        state.craftTier = Number(state.draft.wizardTier) || 0;
        saveItem();
      } else if (w.kind === 'block'){
        state.tab = 'blocks';
        state.draft = { id:w.id, name, desc:(w.desc || '向导创建'), color:'#8db15d', color2:'#3d7049', hardness:w.power, drop:w.drop };
        saveBlock();
      } else if (w.kind === 'map'){
        state.tab = 'maps';
        state.draft = { id:w.id, name, desc:(w.desc || '向导创建'), seed:w.seed, dayLength:w.power,
          seasonDays:8, hungerRate:1, thirstRate:1, enemyRate:w.enemyRate, startingFood:3, startingWater:2 };
        saveMap();
      } else {
        state.tab = 'machines';
        state.draft = { ...newMachineDraft(), id:w.id, name, blockId:w.id + '_block',
          fuelItem:w.fuel, uiTitle:name, uiFooter:'向导创建' };
        state.machineRecipes = [{ id:'process_1', inputId:w.materials[0] ? w.materials[0].id : 'stone',
          inputCount:w.materials[0] ? w.materials[0].count : 1,
          outputId:w.output.id, outputCount:w.output.count,
          duration:w.power, energy:0 }];
        saveMachine();
      }
      const id = w.kind === 'machine' ? w.id + '_block' : w.id;
      if (state.textureDraft){
        try{ studioStoreTexture(id, state.textureDraft); }catch(error){ /* 贴图失败不影响内容 */ }
        state.textureDraft = null; state.textureImage = null;
      }
      clearDraftCache();
      closeEditor();
      let added = false;
      try{
        if (typeof G !== 'undefined' && G && !G.gameOver && ITEMS[id]){ addItem(id, 20); added = true; }
      }catch(error){ added = false; }
      showToast(added ? ('试玩：' + ITEMS[id].name + ' ×20 已放进背包') : '已保存，进游戏后能找到它', '#a8efb2');
    }catch(error){
      setStatus(error.message, true);
    }finally{
      state.tab = prevTab; state.draft = prevDraft; state.recipe = prevRecipe; state.editing = prevEditing;
    }
  }

  function buildMods(){
    const meta = modDefinitions.modInfo;
    const importInput = el('input', { type:'file', accept:'application/json,.json' });
    importInput.style.display = 'none';
    importInput.addEventListener('change', () => importModPackage(importInput));
    editorEl.append(importInput);
    const name = el('input', { type:'text', value:meta.name || '团队内容包', maxLength:120 });
    const author = el('input', { type:'text', value:meta.author || '', maxLength:120 });
    const version = el('input', { type:'text', value:meta.version || '1.0.0', maxLength:20 });
    const description = el('textarea', { maxLength:200 });
    description.value = meta.description || '';
    const info = el('div', {},
      grid(field('MOD 名称', name), field('作者 / 团队', author), field('版本号', version), field('备注', description)),
      el('div', { class:'ge-row-inline' },
        el('button', { class:'ge-btn primary', type:'button', text:'保存团队信息', onclick:() => {
          if (!name.value.trim() || !author.value.trim()) return setStatus('请填写名称与作者。', true);
          if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version.value)) return setStatus('版本号格式如 1.0.0', true);
          const previous = { ...modDefinitions.modInfo };
          modDefinitions.modInfo = { name:name.value.trim(), author:author.value.trim(), version:version.value.trim(), description:description.value.trim() };
          try{ persistModDefinitions(); setStatus('团队信息已保存。'); }
          catch(error){ modDefinitions.modInfo = previous; setStatus(error.message, true); }
        } }))
    );
    editorEl.append(
      card('内容统计', '', el('p', { class:'ge-note', text:studioCountDefinitions() })),
      card('导出与导入', '导出的 JSON 包含全部自定义内容与贴图，可直接发给队友。',
        el('div', { class:'ge-row-inline' },
          el('button', { class:'ge-btn primary', type:'button', text:'导出 MOD 包', onclick:() => {
            try{ studioExport(); setStatus('MOD 包已导出。'); }catch(error){ setStatus(error.message, true); }
          } }),
          el('button', { class:'ge-btn blue', type:'button', text:'导入 MOD 包', onclick:() => {
            importInput.value = ''; importInput.click();
          } }))),
      el('div', { class:'ge-chips' },
        ...[['skip','跳过重名内容'],['overwrite','覆盖重名内容']].map(([mode, label]) => {
          const chip = el('button', { class:'ge-chip' + ((state.importMode || 'skip') === mode ? ' is-on' : ''), type:'button', text:label });
          chip.addEventListener('click', () => { state.importMode = mode; render(); });
          return chip;
        })),
      el('p', { class:'ge-hint', text:'合并同事的包时：跳过 = 只导入新内容；覆盖 = 用包里的同名内容替换本地。' }),
      card('团队信息', '', info)
    );
  }

  /* 一键试玩：保存 → 关闭编辑器 → 把成果放进背包 */
  function playtestCurrent(){
    let id = null;
    try{
      saveCurrent();
      id = state.draft && state.draft.id;
      if (state.tab === 'machines' && state.draft.blockId) id = state.draft.blockId;
    }catch(error){
      setStatus('试玩前保存失败：' + error.message, true);
      return;
    }
    clearDraftCache();
    closeEditor();
    let added = false;
    try{
      if (typeof G !== 'undefined' && G && !G.gameOver && id && ITEMS[id]){
        addItem(id, 20);
        added = true;
      }
    }catch(error){ added = false; }
    if (added) showToast('试玩：' + ITEMS[id].name + ' ×20 已放进背包', '#a8efb2');
    else showToast('已保存。进入游戏后可以在合成/背包里找到它', '#a8e0ff');
  }

  function saveBar(label){
    return el('div', { class:'ge-savebar' },
      el('button', { class:'ge-btn primary', type:'button', text:label, onclick:saveCurrent }),
      el('button', { class:'ge-btn blue', type:'button', text:'▶ 试玩', title:'保存并直接进游戏，成果会放进背包', onclick:() => playtestCurrent() }),
      el('button', { class:'ge-btn', type:'button', text:'清空表单', onclick:clearDraft }),
      el('button', { class:'ge-btn', type:'button', text:'返回游戏', onclick:closeEditor })
    );
  }

  /* ── 保存 ─────────────────────────────────── */
  function saveCurrent(){
    try{
      if (state.tab === 'items') saveItem();
      else if (state.tab === 'blocks') saveBlock();
      else if (state.tab === 'machines') saveMachine();
      else if (state.tab === 'skills') saveSkill();
      else if (state.tab === 'maps') saveMap();
      else if (state.tab === 'blueprints') saveBlueprint();
      clearDraftCache();
      render();
    }catch(error){ setStatus(error.message, true); }
  }
  function requireName(){
    if (typeof state.draft.name !== 'string' || !state.draft.name.trim())
      throw new Error('请填写名称');
  }
  function saveItem(){
    const d = state.draft;
    studioValidateId(d.id);
    requireName();
    const definition = { name:d.name.trim(), desc:d.desc || '', kind:d.kind, color:d.color, color2:d.color2, icon:'crystal' };
    if (d.kind === 'food') Object.assign(definition, { hunger:Number(d.hunger) || 0, hydration:Number(d.hydration) || 0, heal:Number(d.heal) || 0 });
    if (d.kind === 'weapon') Object.assign(definition, { dmg:Number(d.dmg) || 0, range:Number(d.range) || 16, cd:0.45 });
    if (d.kind === 'tool') Object.assign(definition, { mine:Number(d.mine) || 1, cd:0.42 });
    if (d.kind === 'armor') definition.def = Math.min(0.9, Number(d.def) || 0);
    const editing = state.editing && state.editing.tab === 'items';
    if (editing){
      if (!modDefinitions.items[d.id]) throw new Error('只能编辑自定义物品');
      Object.assign(ITEMS[d.id], definition);
      modDefinitions.items[d.id] = { ...ITEMS[d.id] };
      persistModDefinitions();
    } else {
      if (ITEMS[d.id]) throw new Error('该 ID 已被占用');
      PixelSurvivalModAPI.registerItem(d.id, definition);
    }
    if (state.textureDraft) studioStoreTexture(d.id, state.textureDraft);
    const need = {};
    for (const row of state.recipe) if (row.id && ITEMS[row.id] && row.count > 0) need[row.id] = (need[row.id] || 0) + row.count;
    const existingRecipe = modDefinitions.recipes.findIndex(recipe => recipe.out === d.id);
    if (Object.keys(need).length){
      const recipeIndex = existingRecipe >= 0 ? String(existingRecipe) : '';
      studioSaveCraftingRecipe(d.id, need, Number(state.draft.craftCount) || 1, Number(state.draft.craftTier) || 0, recipeIndex);
      state.recipe = Object.entries(need).map(([id, count]) => ({ id, count }));
    } else if (existingRecipe >= 0){
      studioRemoveCraftingRecipe(existingRecipe);
    }
    state.editing = { tab:'items', id:d.id };
    setStatus('物品已保存：' + d.name.trim(), false);
  }
  function saveBlock(){
    const d = state.draft;
    studioValidateId(d.id);
    requireName();
    if (!ITEMS[d.drop]) throw new Error('掉落物 ID 无效');
    const definition = { name:d.name.trim(), desc:d.desc || '', icon:'block', color:d.color, color2:d.color2, kind:'placeable' };
    if (state.editing && state.editing.tab === 'blocks'){
      if (!modDefinitions.blocks[d.id]) throw new Error('只能编辑自定义方块');
      Object.assign(ITEMS[d.id], definition);
      modDefinitions.items[d.id] = { ...ITEMS[d.id] };
      modDefinitions.blocks[d.id] = { ...ITEMS[d.id] };
    } else {
      if (ITEMS[d.id]) throw new Error('该 ID 已被占用');
      PixelSurvivalModAPI.registerBlock(d.id, definition);
      PixelSurvivalModAPI.registerRecipe({ out:d.id, need:{ wood:4 }, tier:0 });
    }
    const properties = { kind:'block-properties', id:d.id, name:d.name.trim(),
      definition:{ hardness:Number(d.hardness) || 3, drop:d.drop, collision:'solid' } };
    const index = modDefinitions.studioBlueprints.findIndex(entry => entry.kind === 'block-properties' && entry.id === d.id);
    if (index >= 0) modDefinitions.studioBlueprints[index] = properties;
    else modDefinitions.studioBlueprints.push(properties);
    if (state.textureDraft) studioStoreTexture(d.id, state.textureDraft);
    persistModDefinitions();
    state.editing = { tab:'blocks', id:d.id };
    setStatus('方块已保存：' + d.name.trim(), false);
  }
  function saveMachine(){
    const d = state.draft;
    studioValidateId(d.id);
    studioValidateId(d.blockId);
    requireName();
    if (!ITEMS[d.fuelItem] || ITEMS[d.fuelItem].kind === 'placeable') throw new Error('燃料物品无效');
    const recipes = state.machineRecipes
      .filter(row => ITEMS[row.inputId] && ITEMS[row.outputId])
      .map((row, index) => ({ id:'process_' + (index + 1), name:d.name + ' 加工 ' + (index + 1),
        input:{ [row.inputId]:Math.max(1, Number(row.inputCount) || 1) },
        output:{ [row.outputId]:Math.max(1, Number(row.outputCount) || 1) },
        duration:Math.max(1, Number(row.duration) || 1),
        ...(Number(row.energy) > 0 ? { energy:Number(row.energy) } : {}) }));
    if (!recipes.length) throw new Error('至少需要一条有效的加工配方');
    const ui = { title:d.uiTitle, statusLabel:d.uiStatusLabel, inputLabel:d.uiInputLabel,
      outputLabel:d.uiOutputLabel, fuelLabel:d.uiFuelLabel, footer:d.uiFooter,
      background:d.uiBackground, accent:d.uiAccent, text:d.uiText };
    const editing = state.editing && state.editing.tab === 'machines';
    if (editing && !modDefinitions.machines[d.id]) throw new Error('只能编辑自定义机器');
    const fuelPerCraft = Math.max(1, Number(d.fuelPerCraft) || 1);
    if (editing){
      const updated = { name:d.name.trim(), blockItem:d.blockId, fuelItem:d.fuelItem, fuelPerCraft, recipes, ui };
      const oldMachine = modDefinitions.machines[d.id];
      const oldBlock = ITEMS[d.blockId];
      const oldItemDefinition = modDefinitions.items[d.blockId];
      const oldBlockDefinition = modDefinitions.blocks[d.blockId];
      MACHINE_TYPES[d.id] = updated;
      modDefinitions.machines[d.id] = JSON.parse(JSON.stringify(updated));
      Object.assign(ITEMS[d.blockId], { name:d.name.trim(), desc:d.desc || '', color:d.color, color2:d.color2, machineType:d.id });
      modDefinitions.items[d.blockId] = { ...ITEMS[d.blockId] };
      modDefinitions.blocks[d.blockId] = { ...ITEMS[d.blockId] };
      try{ persistModDefinitions(); }
      catch(error){
        MACHINE_TYPES[d.id] = oldMachine; modDefinitions.machines[d.id] = oldMachine;
        ITEMS[d.blockId] = oldBlock;
        if (oldItemDefinition) modDefinitions.items[d.blockId] = oldItemDefinition;
        else delete modDefinitions.items[d.blockId];
        if (oldBlockDefinition) modDefinitions.blocks[d.blockId] = oldBlockDefinition;
        else delete modDefinitions.blocks[d.blockId];
        throw error;
      }
    } else {
      if (!ITEMS[d.blockId]) PixelSurvivalModAPI.registerBlock(d.blockId, { name:d.name, desc:d.desc || '', icon:'block', color:d.color, color2:d.color2 });
      PixelSurvivalModAPI.registerMachine(d.id, { name:d.name.trim(), blockItem:d.blockId, fuelItem:d.fuelItem,
        fuelPerCraft, ui, recipes });
    }
    if (!RECIPES.some(recipe => recipe.out === d.blockId))
      PixelSurvivalModAPI.registerRecipe({ out:d.blockId, need:{ wood:8, stone:8 }, tier:0 });
    if (state.textureDraft) studioStoreTexture(d.blockId, state.textureDraft);
    persistModDefinitions();
    state.editing = { tab:'machines', id:d.id };
    setStatus('机器已保存：' + d.name.trim(), false);
  }
  function saveSkill(){
    const d = state.draft;
    studioValidateId(d.id);
    requireName();
    const effectParams = d.effectParams || {};
    PixelSurvivalModAPI.configureSkillNode(d.id, { name:d.name.trim(), desc:d.desc || '', effectParams,
      effect:d.effect, level:Math.max(1, Number(d.level) || 1), xpCost:Math.max(0, Number(d.xpCost) || 0),
      cost:Math.max(1, Number(d.cost) || 1), cd:Math.max(1, Number(d.cd) || 1),
      requires:state.draft.requires || [] });
    state.editing = { tab:'skills', id:d.id };
    setStatus('技能已保存：' + d.name.trim(), false);
  }
  function saveMap(){
    const d = state.draft;
    studioValidateId(d.id);
    requireName();
    if (state.editing ? false : !!modDefinitions.maps[d.id]) throw new Error('该地图 ID 已存在');
    const map = studioNormalizeMap({ id:d.id, name:d.name, desc:d.desc, seed:Number(d.seed) || 1,
      dayLength:Number(d.dayLength) || 600, seasonDays:Number(d.seasonDays) || 8,
      hungerRate:Number(d.hungerRate), thirstRate:Number(d.thirstRate), enemyRate:Number(d.enemyRate),
      startingFood:Number(d.startingFood) || 0, startingWater:Number(d.startingWater) || 0 });
    const previous = modDefinitions.maps[d.id];
    modDefinitions.maps[d.id] = map;
    try{ persistModDefinitions(); }
    catch(error){
      if (previous) modDefinitions.maps[d.id] = previous; else delete modDefinitions.maps[d.id];
      throw error;
    }
    state.editing = { tab:'maps', id:d.id };
    setStatus('地图已保存：' + d.name.trim(), false);
  }
  function saveBlueprint(){
    const d = state.draft;
    studioValidateId(d.id);
    requireName();
    const payload = { ...d, id:d.id, name:d.name, desc:d.desc || '' };
    if (state.blueprintKind === 'creature'){
      payload.hp = Number(d.hp) || 30;
      payload.speed = Number(d.speed) || 24;
      payload.damage = Number(d.damage) || 6;
    }
    studioSaveBlueprint(state.blueprintKind, payload, !!(state.editing && state.editing.tab === 'blueprints'));
    state.editing = { tab:'blueprints', id:d.id };
    setStatus('蓝图已保存：' + d.name.trim(), false);
  }

  /* ── 绘制角色预览 ─────────────────────────── */
  function drawPlayerPreview(canvas){
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.save();
    context.translate(canvas.width / 2, canvas.height - 8);
    context.scale(2.6, 2.6);
    const livePlayer = player;
    try{
      player = { ...livePlayer, x:0, y:0, swing:0, walkPhase:0, invuln:0, attackAngle:0 };
      drawPlayer(0, 0);
    }catch(error){ /* 预览失败不影响编辑 */ }
    player = livePlayer;
    context.restore();
  }

  /* ── 主界面 ───────────────────────────────── */
  const TABS = [
    ['wizard','向导'], ['items','物品'], ['blocks','方块'], ['machines','机器'], ['skills','技能'],
    ['maps','地图'], ['blueprints','蓝图'], ['character','角色'], ['media','音画'], ['mods','MOD'],
  ];

  function draftIssues(){
    const issues = [];
    const d = state.draft || {};
    if (!d.id) issues.push('缺少内容 ID');
    else if (!/^[a-zA-Z][a-zA-Z0-9_:-]{1,47}$/.test(String(d.id))) issues.push('ID 只能包含字母、数字、_ - :，且以字母开头');
    if (!String(d.name || '').trim()) issues.push('缺少名称');
    if (!state.editing && d.id && ITEMS[d.id]) issues.push('ID 已被占用：' + d.id);
    if (state.tab === 'items') for (const row of (state.recipe || [])) if (!ITEMS[row.id]) issues.push('配方材料无效：' + row.id);
    if (state.tab === 'machines'){
      if (!d.blockId) issues.push('缺少机器方块 ID');
      else if (!/^[a-zA-Z][a-zA-Z0-9_:-]{1,47}$/.test(String(d.blockId))) issues.push('机器方块 ID 格式不对');
      if (!state.machineRecipes.length) issues.push('至少需要一条加工配方');
      else if (!state.machineRecipes.some(r => r.inputId && r.outputId)) issues.push('所有配方都缺少输入或产物');
      else if (state.machineRecipes.some(r => !ITEMS[r.inputId] || !ITEMS[r.outputId])) issues.push('配方里有不存在的物品');
    }
    return issues;
  }

  function ensureDraft(){
    if (!state.draft || !Object.keys(state.draft).length){
      const factory = DEFAULTS[state.tab];
      state.draft = factory ? factory() : (state.tab === 'blueprints' ? newBlueprintDraft(state.blueprintKind) : {});
    }
    if (state.tab === 'skills' && !Array.isArray(state.draft.requires)) state.draft.requires = [];
    if (state.tab === 'machines' && (!Array.isArray(state.machineRecipes) || !state.machineRecipes.length))
      state.machineRecipes = [{ id:'process_1', inputId:'stone', inputCount:1, outputId:'stoneDust', outputCount:1, duration:6, energy:0 }];
    if (state.tab === 'items' && !Array.isArray(state.recipe)) state.recipe = [];
  }

  function render(){
    ensureDraft();
    root.replaceChildren();
    shell = el('section', { class:'ge-shell', role:'dialog', 'aria-modal':'true', 'aria-label':'创作工坊' });
    /* 顶栏 */
    const tabs = el('nav', { class:'ge-tabs' });
    for (const [id, label] of TABS){
      const button = el('button', { class:'ge-tab' + (state.tab === id ? ' is-on' : ''), type:'button', text:label });
      button.addEventListener('click', () => {
        state.tab = id;
        state.search = '';
        state.editing = null;
        state.error = state.message = '';
        if (id === 'blueprints') state.draft = newBlueprintDraft(state.blueprintKind);
        else if (DEFAULTS[id]) state.draft = DEFAULTS[id]();
        else state.draft = {};
        if (id === 'machines') state.machineRecipes = [{ id:'process_1', inputId:'stone', inputCount:1, outputId:'stoneDust', outputCount:1, duration:6, energy:0 }];
        if (id === 'items'){ state.recipe = []; state.craftCount = 1; state.craftTier = 0; }
        state.textureDraft = null; state.textureImage = null;
        render();
      });
      tabs.append(button);
    }
    const top = el('header', { class:'ge-top' },
      el('div', { class:'ge-brand' }, el('h1', { text:'创作工坊' }), el('p', { text:'做物品、方块、机器、技能、地图' })),
      tabs,
      el('div', { class:'ge-top-actions' },
        el('button', { class:'ge-btn', type:'button', text:'↶ 撤销', title:'撤销上一步', onclick:() => undo() }),
        el('button', { class:'ge-btn', type:'button', text:'重置编辑区', title:'清空当前表单', onclick:() => {
          state.editing = null; state.textureDraft = null; state.textureImage = null;
          state.error = state.message = '';
          const factory = DEFAULTS[state.tab];
          state.draft = factory ? factory() : (state.tab === 'blueprints' ? newBlueprintDraft(state.blueprintKind) : {});
          if (state.tab === 'items'){ state.recipe = []; state.craftCount = 1; state.craftTier = 0; }
          if (state.tab === 'machines') state.machineRecipes = [{ id:'process_1', inputId:'stone', inputCount:1, outputId:'stoneDust', outputCount:1, duration:6, energy:0 }];
          render();
          setStatus('编辑区已重置。');
        } }),
        el('button', { class:'ge-btn danger', type:'button', text:'关闭 · Esc', onclick:closeEditor })
      )
    );
    shell.append(top);

    /* 主体 */
    listEl = el('aside', { class:'ge-list' });
    if (state.tab === 'wizard') listEl.style.display = 'none';
    editorEl = el('main', { class:'ge-editor' });
    const scroll = el('div', { class:'ge-scroll' }, editorEl);
    previewEl = el('aside', { class:'ge-preview' });
    shell.append(el('div', { class:'ge-body' + (state.tab === 'wizard' ? ' ge-body-single' : '') }, listEl, scroll, previewEl));

    statusEl = el('footer', { class:'ge-status studio-status' });
    shell.append(statusEl);
    root.append(shell, itemDatalist());
    root.setAttribute('aria-hidden', 'false');

    renderList();
    const templates = templateRow();
    if (templates) editorEl.append(templates);
    const checkTabs = ['items','blocks','machines','skills','maps','blueprints'];
    const issues = checkTabs.includes(state.tab) ? draftIssues() : [];
    if (issues.length){
      const banner = el('div', { class:'ge-issues' }, el('strong', { text:'保存前请先修正：' }));
      const list = el('ul', {});
      for (const issue of issues) list.append(el('li', { text:issue }));
      banner.append(list);
      editorEl.append(banner);
    }
    if (state.tab === 'wizard') buildWizard();
    else if (state.tab === 'items') buildItems();
    else if (state.tab === 'blocks') buildBlocks();
    else if (state.tab === 'machines') buildMachines();
    else if (state.tab === 'skills') buildSkills();
    else if (state.tab === 'maps') buildMaps();
    else if (state.tab === 'blueprints') buildBlueprints();
    else if (state.tab === 'character') buildCharacter();
    else if (state.tab === 'media') buildMedia();
    else if (state.tab === 'mods') buildMods();
    refreshPreview();
    persistDraft();
    if (state.error) setStatus(state.error, true);
    else if (state.message) setStatus(state.message, false);
    else setStatus('全部内容保存在本地浏览器；导出的 MOD 包可直接分享。');
  }

  /* ── 打开 / 关闭 ──────────────────────────── */
  function openEditor(){
    state.tab = state.tab || 'items';
    const restored = restoreDraft();
    if (restored) state.message = '已恢复上次未保存的草稿';
    if (!state.draft || !Object.keys(state.draft).length){
      const factory = DEFAULTS[state.tab];
      state.draft = factory ? factory() : (state.tab === 'blueprints' ? newBlueprintDraft(state.blueprintKind) : {});
    }
    render();
  }
  function closeEditor(){
    root.setAttribute('aria-hidden', 'true');
    root.replaceChildren();
    if (typeof lockGraceUntil !== 'undefined') { /* 由 input.js 提供 */ }
    panel = studioReturnPanel === 'studio' ? 'pause' : (studioReturnPanel || 'pause');
    studioReturnPanel = null;
    clearInput();
    if (typeof syncPointerLock === 'function') syncPointerLock();
  }

  return { render, openEditor, closeEditor, state, save:saveCurrent };
})();

/* 覆盖旧的 Game Studio 入口，游戏里调用这几个函数即可打开新编辑器 */
function openGameStudio(){
  if (G.gameOver) return;
  clearInput();
  studioReturnPanel = panel;
  panel = 'studio';
  GameEditor.openEditor();
}
function closeGameStudio(){ GameEditor.closeEditor(); }
function renderGameStudio(){ GameEditor.render(); }
