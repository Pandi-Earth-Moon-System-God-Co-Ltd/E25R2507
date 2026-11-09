# 创作工坊 · Mod API 参考

> 给会一点 JS 的同事：不打开编辑器，直接用代码注册内容。
> 所有 API 都在 `window.PixelSurvivalModAPI` 上，**游戏加载完成后**可用。

## 1. 怎么加载自己的脚本

1. 在 `mods/` 下新建 `my-mod.js`；
2. 在 `index.html` 里、`js/title-screen.js` 之后加一行：
   `<script src="mods/my-mod.js"></script>`
3. 脚本里包一层判断，避免加载顺序问题：

```js
(function(){
  if (!window.PixelSurvivalModAPI) return;
  const api = window.PixelSurvivalModAPI;
  // 在这里注册内容
})();
```

参考实现：`mods/sample-effects.js`。

## 2. 物品

```js
api.registerItem('studio:my_ore', {
  name: '秘银矿',
  desc: '发着蓝光的稀有矿石',
  kind: 'material',        // material | food | weapon | tool | armor
  icon: 'crystal',          // 没有贴图时用的图标
  color: '#8fd6ff',         // 主色
  color2: '#3c6d8a',        // 阴影色
  // 按 kind 追加：
  hunger: 6, hydration: 2, heal: 1,   // food
  dmg: 9, range: 20,                  // weapon
  mine: 3,                            // tool（采集效率）
  def: 0.3,                           // armor（减伤 0~0.9）
});
```

- ID 规则：字母开头，只允许字母/数字/`_`/`-`/`:`，建议 `命名空间:名字`；
- 贴图：编辑器里上传，或 `studioStoreTexture(id, dataUrl)`。

## 3. 方块

```js
api.registerBlock('studio:my_block', {
  name: '秘银块', desc: '装饰用的秘银方块',
  icon: 'block', color: '#8fd6ff', color2: '#3c6d8a',
  kind: 'placeable',
});
```

## 4. 机器

```js
api.registerMachine('studio:my_machine', {
  name: '秘银熔炉',
  blockItem: 'studio:my_block',   // 必须先注册这个方块
  fuelItem: 'coal',                // 烧什么
  fuelPerCraft: 1,
  capacity: 200,                   // 蓄电量
  ui: {
    title: '秘银熔炉', statusLabel: '状态', inputLabel: '输入',
    outputLabel: '产物', fuelLabel: '燃料', footer: '秘银冶炼',
    background: '#c6c6c6', accent: '#4f7a32', text: '#3f3f3f',
  },
  recipes: [
    { id: 'smeltMithril', name: '冶炼秘银',
      input: { 'studio:my_ore': 2 }, output: { 'studio:my_ingot': 1 },
      duration: 8, energy: 4 },
  ],
});
```

> 电压：机器的电压档位由 `MACHINE_VOLTAGE` 表决定，自定义机器默认**低压**；
> 想让它在高压时代才工作，需要同时改 `js/core.js` 里的表（这一步目前要改代码）。

## 5. 合成配方

```js
api.registerRecipe({
  out: 'studio:my_ingot',    // 产物 ID
  count: 1,                  // 每次产出
  need: { 'studio:my_ore': 2 },
  tier: 2,                   // 需要的科技等级（0~5）
  table: true,               // 需要工作台
  grid: ['oo', 'oo'],        // 有形状配方（可选）
  key: { o: 'studio:my_ore' },
});
```

- 没有 `grid` 就是**无序配方**（材料放任意格子都行）；
- `shape: '2x2'` 表示这个形状也能在背包 2×2 格子里摆。

## 6. 技能与自定义效果

```js
api.configureSkillNode('studio:my_skill', {
  name: '秘银爆发', desc: '向前方释放秘银冲击',
  effect: 'wave',                  // 内置效果或已注册的自定义效果
  level: 2, xpCost: 40, cost: 25, cd: 8,
  requires: [],                    // 前置技能 ID
  effectParams: { damageMul: 3.5, reach: 220, duration: 4 },
});
```

内置效果：`spin` `dash` `wave` `ward` `nova` `orbit` `chain` `heal`。

### 注册全新效果

```js
api.registerSkillEffect('myBurst', {
  name: '我的爆发',
  cast(ctx){
    // ctx.skill / ctx.angle / ctx.damage / ctx.player / ctx.enemies
    // ctx.particles(x, y, 颜色, 数量)
    // ctx.hit(敌人, 下标)   ← 对某个敌人造成本次技能伤害
    ctx.particles(ctx.player.x, ctx.player.y - 10, '#ffd166', 12);
    for (let i = ctx.enemies.length - 1; i >= 0; i--){
      const e = ctx.enemies[i];
      if (Math.hypot(e.x - ctx.player.x, e.y - ctx.player.y) < 120) ctx.hit(e, i);
    }
  },
});
api.skillEffects();   // 列出全部已注册效果
```

> ⚠️ 效果是函数，**不能**导出进 MOD 包；要分享就把 `mods/` 脚本一起发。

## 7. 作物与科技（进阶）

```js
api.registerCrop('studio:my_crop', { name:'秘银草', seedItem:'studio:my_seed', output:'studio:my_ore', yield:2, growthTime:60 });
api.registerTechnology(4, { name:'秘银时代', unlock:'秘银装备', day:14, kills:30, cost:{ 'studio:my_ingot':6 } });
```

## 8. MOD 包格式（导出/导入的是这个）

```json
{
  "format": "PixelSurvivalGameStudioMod",
  "version": 1,
  "metadata": { "name": "...", "author": "...", "version": "1.0.0" },
  "definitions": {
    "items": {}, "blocks": {}, "machines": {}, "maps": {},
    "recipes": [], "machineRecipes": [], "studioBlueprints": [], "skillNodes": [],
    "textures": {}, "assets": {}
  }
}
```

- `textures` 里是 `id → data:image/png;base64,...`；
- 导入时选「跳过重名」只会导入本地没有的内容。

## 9. 常见坑

| 现象 | 原因 |
|---|---|
| 注册报「ID 已存在」 | 内置内容占用了这个 ID，换一个命名空间 |
| 机器放下打不开 | `blockItem` 没先注册，或缺少 `machineType` |
| 配方造不出来 | `need` 里的物品不存在，或 `tier` 高于当前科技 |
| 技能没出现在下拉 | 自定义效果没注册 / 脚本没加载 |
