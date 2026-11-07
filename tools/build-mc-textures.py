#!/usr/bin/env python3
"""把 2233/ 材质包中游戏用到的贴图打包成 js/mc-textures.js。

游戏需要在 file:// 下直接打开也能使用材质包贴图，因此这里把 PNG 转成
data URL 内嵌到一个 JS 文件里：

  * 内嵌 data URL 不会污染 canvas，所以 WebGL 图集、药水染色都能正常工作；
  * 不需要任何构建工具 / 本地服务器；
  * 只打包游戏实际引用的贴图，文件体积可控。

用法（在项目根目录）：
    python tools/build-mc-textures.py
"""
from __future__ import annotations

import base64
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "2233" / "textures"
OUT = ROOT / "js" / "mc-textures.js"

# 游戏物品 ID -> 材质包贴图（相对 2233/textures，不带扩展名）
ITEM_TEXTURES = {
    "bow": "item/bow",
    "crossbow": "item/crossbow_standby",
    "arrow": "item/arrow",
    "hoe": "item/iron_hoe",

    "wood": "block/oak_log",
    "stone": "block/cobblestone",
    "copperOre": "item/raw_copper",
    "ironOre": "item/raw_iron",
    "ironIngot": "item/iron_ingot",
    "copperDust": "item/glowstone_dust",
    "ironDust": "item/gunpowder",
    "stoneDust": "item/sugar",
    "crystal": "item/amethyst_shard",
    "copperIngot": "item/copper_ingot",
    "bloodCore": "item/nether_star",
    "fiber": "item/string",
    "berry": "item/sweet_berries",
    "meat": "item/beef",
    "cooked": "item/cooked_beef",
    "bandage": "item/paper",
    "woodSword": "item/wooden_sword",
    "stoneSword": "item/stone_sword",
    "steelSword": "item/iron_sword",
    "copperSword": "item/golden_sword",
    "crystalSword": "item/diamond_sword",
    "bloodSword": "item/netherite_sword",
    "woodPickaxe": "item/wooden_pickaxe",
    "copperPickaxe": "item/golden_pickaxe",
    "woodArmor": "item/leather_chestplate",
    "stoneArmor": "item/chainmail_chestplate",
    "copperArmor": "item/golden_chestplate",
    "crystalArmor": "item/diamond_chestplate",
    "woodHelmet": "item/leather_helmet",
    "woodChestplate": "item/leather_chestplate",
    "woodLeggings": "item/leather_leggings",
    "woodBoots": "item/leather_boots",
    "torch": "block/torch",
    "woodBlock": "block/oak_planks",
    "stoneBlock": "block/stone",
    "plank": "block/oak_planks",
    "stick": "item/stick",
    "coal": "item/coal",
    "charcoal": "item/charcoal",
    "craftingTable": "block/crafting_table_front",
    "stonePickaxe": "item/stone_pickaxe",
    "ironPickaxe": "item/iron_pickaxe",
    "ironArmor": "item/iron_chestplate",
    "pistol": "item/crossbow_standby",
    "shotgun": "item/bow",
    "ammo": "item/arrow",
    "coin": "item/gold_nugget",
    "emptyBottle": "item/glass_bottle",
    "carrotSeed": "item/beetroot_seeds",
    "wheatSeed": "item/wheat_seeds",
    "carrot": "item/carrot",
    "wheat": "item/wheat",
    "bread": "item/bread",
    "copperFurnace": "block/furnace_front",
    "powerGenerator": "block/blast_furnace_front",
    "solarPanel": "block/daylight_detector_top",
    "conveyorBelt": "block/rail",
    "powerWire": "item/redstone",
    "ecoGarden": "block/moss_block",
    "worldGate": "item/end_crystal",
    "crusher": "block/piston_top",
    "automaticHarvester": "item/iron_hoe",
    "logisticsRouter": "item/comparator",
    "relicShard": "item/echo_shard",
}

# 药水类物品：共享原版药水瓶造型，按液体颜色染色（和《我的世界》一致）
POTION_TINTS = {
    "water": "#4f76e0",
    "dirtyWater": "#6b5a3a",
    "purifiedWater": "#7fd4ff",
    "smallPotion": "#e8443c",
    "largePotion": "#b3202a",
    "regenPotion": "#f06ea8",
    "powerPotion": "#ff9a3c",
    "hastePotion": "#45e0e0",
}

# 3D 方块图集：顺序必须与 render3d.js 的 CELL 常量一致
ATLAS_TEXTURES = [
    "block/grass_block_top",
    "block/grass_block_side",
    "block/dirt",
    "block/stone",
    "block/cobblestone",
    "block/sand",
    "block/snow",
    "block/water_still",
    "block/oak_log",
    "block/oak_log_top",
    "block/oak_leaves",
    "block/oak_planks",
    "block/iron_block",
    "block/amethyst_block",
    "block/deepslate",
]
# 带透明像素的贴图先铺一层底色，避免着色器把透明处画成黑点
ATLAS_BASE = {
    "block/water_still": "#3f76e4",
    "block/oak_leaves": "#2f5f24",
}
# 灰度贴图需要按《我的世界》的生物群系颜色上色（草、水）
ATLAS_TINT = {
    "block/grass_block_top": "#91bd59",
    "block/water_still": "#4a86e0",
}

GUI_TEXTURES = [
    "gui/container/inventory",
    "gui/container/crafting_table",
    "gui/container/furnace",
    "gui/container/blast_furnace",
    "gui/container/smoker",
    "gui/container/generic_54",
    "gui/widgets",
    "gui/recipe_book",
    "gui/recipe_button",
    "gui/light_dirt_background",
    "gui/options_background",
]

# 方块类物品：在背包 / 快捷栏里画成《我的世界》那种等距小方块
BLOCK_ICONS = {
    "wood":               {"top": "block/oak_log_top", "side": "block/oak_log"},
    "plank":              {"top": "block/oak_planks", "side": "block/oak_planks"},
    "woodBlock":          {"top": "block/oak_planks", "side": "block/oak_planks"},
    "stoneBlock":         {"top": "block/stone", "side": "block/stone"},
    "stone":              {"top": "block/cobblestone", "side": "block/cobblestone"},
    "craftingTable":      {"top": "block/crafting_table_top", "side": "block/crafting_table_side",
                           "front": "block/crafting_table_front"},
    "copperFurnace":      {"top": "block/furnace_top", "side": "block/furnace_side",
                           "front": "block/furnace_front"},
    "powerGenerator":     {"top": "block/blast_furnace_top", "side": "block/blast_furnace_side",
                           "front": "block/blast_furnace_front"},
    "solarPanel":         {"top": "block/daylight_detector_top", "side": "block/daylight_detector_side"},
    "crusher":            {"top": "block/piston_top", "side": "block/piston_side"},
    "ecoGarden":          {"top": "block/moss_block", "side": "block/moss_block"},
    "conveyorBelt":       {"top": "block/hopper_top", "side": "block/hopper_outside"},
    "logisticsRouter":    {"top": "block/observer_top", "side": "block/observer_side",
                           "front": "block/observer_front"},
    "automaticHarvester": {"top": "block/hay_block_top", "side": "block/hay_block_side"},
    "worldGate":          {"top": "block/end_portal_frame_top", "side": "block/end_portal_frame_side"},
}

EXTRA_TEXTURES = [
    "item/potion",
    "item/potion_overlay",
]


def data_url(path: Path) -> str:
    raw = path.read_bytes()
    return "data:image/png;base64," + base64.b64encode(raw).decode("ascii")


# 格雷科技机器正面贴图 -> 我们的机器 ID
GT_MACHINE_OVERLAYS = {
    "copperFurnace": "steam_furnace",
    "steamBoiler": "steam_boiler",
    "steamForge": "forge_hammer",
    "arcFurnace": "arc_furnace",
    "electrolyzer": "electrolyzer",
    "centrifuge": "centrifuge",
    "highCompressor": "compressor",
    "crusher": "macerator",
    "assembler": "assembler",
    "mixer": "mixer",
    "chemicalReactor": "chemical_reactor",
    "miner": "miner",
}
GT_BLOCK_ROOT = ROOT / "2233" / "GregTech-Modern" / "src" / "main" / "resources" / "assets" / "gtceu" / "textures" / "block"


def build_gt_machine_icons(casing_path: Path) -> dict[str, str]:
    """把格雷科技的机器正面叠在铁块机身上，生成 16x16 图标（data URL）。"""
    from PIL import Image
    if not casing_path.is_file():
        return {}
    casing = Image.open(casing_path).convert("RGBA").resize((16, 16), Image.NEAREST)
    icons: dict[str, str] = {}
    for our_id, gt_name in GT_MACHINE_OVERLAYS.items():
        overlay_path = GT_BLOCK_ROOT / "machines" / gt_name / "overlay_front.png"
        if not overlay_path.is_file():
            continue
        overlay = Image.open(overlay_path).convert("RGBA").resize((16, 16), Image.NEAREST)
        icon = casing.copy()
        icon.alpha_composite(overlay)
        buffer = io.BytesIO()
        icon.save(buffer, format="PNG", optimize=True)
        icons["gt/" + our_id] = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    return icons


# MC 皮肤里各部位的平均色（头正脸 / 身体正脸 / 四肢）
MOB_SKINS = {
    "zombie": "entity/zombie/zombie.png",
    "skeleton": "entity/skeleton/skeleton.png",
    "creeper": "entity/creeper/creeper.png",
    "spider": "entity/spider/spider.png",
}
# 64x32 皮肤的 UV 区域：(x0,y0,x1,y1)
MOB_REGIONS = {
    "head": (8, 8, 16, 16),
    "body": (20, 20, 28, 32),
    "limb": (44, 20, 48, 32),
}


def average_color(img, box):
    from PIL import Image
    crop = img.crop(box).convert("RGBA")
    pixels = [px for px in crop.getdata() if px[3] > 32]
    if not pixels:
        return "#808080"
    r = sum(px[0] for px in pixels) // len(pixels)
    g = sum(px[1] for px in pixels) // len(pixels)
    b = sum(px[2] for px in pixels) // len(pixels)
    return "#%02x%02x%02x" % (r, g, b)


def build_mob_palettes(pack: Path) -> dict[str, dict[str, str]]:
    from PIL import Image
    out: dict[str, dict[str, str]] = {}
    for name, rel in MOB_SKINS.items():
        path = pack / rel
        if not path.is_file():
            continue
        img = Image.open(path).convert("RGBA")
        if img.size[0] < 64:
            img = img.resize((64, 32), Image.NEAREST)
        out[name] = {part: average_color(img, box) for part, box in MOB_REGIONS.items()}
    return out


# 皮肤里各部位的正脸区域（64x32），裁出来做怪物部件贴图
MOB_PART_BOXES = {
    "head": (8, 8, 16, 16),
    "body": (20, 20, 28, 32),
    "arm": (44, 20, 48, 32),
    "leg": (4, 20, 8, 32),
}


def build_mob_parts(pack: Path) -> dict[str, str]:
    """把 MC 皮肤按部位裁成 16x16 部件图，血月骑士用红色变体。"""
    from PIL import Image
    out: dict[str, str] = {}
    for name, rel in MOB_SKINS.items():
        path = pack / rel
        if not path.is_file():
            continue
        skin = Image.open(path).convert("RGBA")
        if skin.size[0] < 64:
            skin = skin.resize((64, 32), Image.NEAREST)
        for part, box in MOB_PART_BOXES.items():
            crop = skin.crop(box).resize((16, 16), Image.NEAREST)
            buffer = io.BytesIO()
            crop.save(buffer, format="PNG", optimize=True)
            out[f"mob/{name}/{part}"] = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    # 血月骑士：僵尸皮肤整体染红
    if "zombie" in MOB_SKINS:
        skin = Image.open(pack / MOB_SKINS["zombie"]).convert("RGBA")
        if skin.size[0] < 64:
            skin = skin.resize((64, 32), Image.NEAREST)
        overlay = Image.new("RGBA", skin.size, (190, 40, 60, 150))
        skin = Image.alpha_composite(skin, overlay)
        for part, box in MOB_PART_BOXES.items():
            crop = skin.crop(box).resize((16, 16), Image.NEAREST)
            buffer = io.BytesIO()
            crop.save(buffer, format="PNG", optimize=True)
            out[f"mob/bloodKnight/{part}"] = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    return out


def main() -> None:
    block_textures = set()
    for parts in BLOCK_ICONS.values():
        block_textures.update(parts.values())
    wanted = (set(ITEM_TEXTURES.values()) | set(ATLAS_TEXTURES) | set(GUI_TEXTURES)
              | set(EXTRA_TEXTURES) | block_textures)
    fonts: dict[str, str] = {}
    gt_machine_icons = build_gt_machine_icons(PACK / "block" / "iron_block.png")
    mob_palettes = build_mob_palettes(PACK)
    mob_parts = build_mob_parts(PACK)
    if gt_machine_icons:
        print(f"格雷科技机器图标：{len(gt_machine_icons)} 个")
    missing: list[str] = []
    for key in sorted(wanted):
        path = PACK / (key + ".png")
        if not path.is_file():
            missing.append(key)
            continue
        fonts[key] = data_url(path)
    if missing:
        raise SystemExit("材质包缺少以下贴图：" + ", ".join(missing))

    total = sum(len(value) for value in fonts.values())
    lines = [
        "'use strict';",
        "",
        "/* ══════════════════════════════════════════════════════════",
        "   2233 材质包贴图（自动生成，请勿手改）",
        "   生成脚本：tools/build-mc-textures.py",
        "   - 物品图标 / 方块图集 / 容器 GUI 全部来自《我的世界》材质包",
        "   - 以 data URL 内嵌，file:// 直接打开也不会污染 canvas",
        "   ══════════════════════════════════════════════════════════ */",
        "",
        "const MC_ITEM_TEXTURE = " + json.dumps(ITEM_TEXTURES, ensure_ascii=False, indent=2, sort_keys=True) + ";",
        "",
        "const MC_POTION_TINT = " + json.dumps(POTION_TINTS, ensure_ascii=False, indent=2, sort_keys=True) + ";",
        "",
        "const MC_ATLAS_TEXTURES = " + json.dumps(ATLAS_TEXTURES, indent=2) + ";",
        "",
        "const MC_ATLAS_BASE = " + json.dumps(ATLAS_BASE, indent=2, sort_keys=True) + ";",
        "",
        "const MC_ATLAS_TINT = " + json.dumps(ATLAS_TINT, indent=2, sort_keys=True) + ";",
        "",
        "const MC_BLOCK_ICONS = " + json.dumps(BLOCK_ICONS, indent=2, sort_keys=True) + ";",
        "",
        "const MC_GUI_KEYS = " + json.dumps(GUI_TEXTURES, indent=2) + ";",
        "",
        "const MC_MOB_COLORS = " + json.dumps(mob_palettes, indent=0, sort_keys=True) + ";",
        "",
        "const MC_TEXTURE_DATA = " + json.dumps({**fonts, **gt_machine_icons, **mob_parts}, indent=0, sort_keys=True) + ";",
        "",
    ]
    lines.append(MC_RUNTIME)
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"已写入 {OUT.relative_to(ROOT)} · {len(fonts)} 张贴图 · {total / 1024:.0f} KB (base64)")


MC_RUNTIME = r'''
/* ── 贴图加载与查询 ───────────────────────────────── */
const MCTextures = (function(){
  const images = Object.create(null);
  const tinted = Object.create(null);

  function dataUrl(key){
    return MC_TEXTURE_DATA[key] || null;
  }

  function isReady(img){
    return !!img && img.complete && img.naturalWidth > 0;
  }

  function load(key){
    if (key in images) return images[key];
    const data = dataUrl(key);
    if (!data) return (images[key] = null);
    const img = new Image();
    img.decoding = 'async';
    img.src = data;
    images[key] = img;
    return img;
  }

  function allLoaded(){
    for (const key in MC_TEXTURE_DATA){
      if (!isReady(load(key))) return false;
    }
    return true;
  }

  function raw(key){
    const img = load(key);
    return isReady(img) ? img : null;
  }

  /* 物品图标：药水按液体颜色染色，其余直接取贴图 */
  function itemIcon(id){
    const key = MC_ITEM_TEXTURE[id];
    if (key) return raw(key);
    const tint = MC_POTION_TINT[id];
    if (!tint) return null;
    if (tinted[id] !== undefined) return tinted[id] || null;
    const base = raw('item/potion');
    const overlay = raw('item/potion_overlay');
    if (!base) return null;
    const cv = document.createElement('canvas');
    cv.width = base.naturalWidth || 16;
    cv.height = base.naturalHeight || 16;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0, cv.width, cv.height);
    if (overlay){
      const liquid = document.createElement('canvas');
      liquid.width = cv.width; liquid.height = cv.height;
      const lg = liquid.getContext('2d');
      lg.imageSmoothingEnabled = false;
      lg.drawImage(overlay, 0, 0, liquid.width, liquid.height);
      lg.globalCompositeOperation = 'source-atop';
      lg.fillStyle = tint;
      lg.fillRect(0, 0, liquid.width, liquid.height);
      g.drawImage(liquid, 0, 0);
    }
    tinted[id] = cv;
    return cv;
  }

  function mobSprite(name, part){
    return raw('mob/' + name + '/' + part);
  }

  function gtIcon(id){
    return raw('gt/' + id);
  }

  function gui(name){
    const key = name.indexOf('/') >= 0 ? name : 'gui/container/' + name;
    return raw(key);
  }

  function atlasImage(cell){
    return raw(MC_ATLAS_TEXTURES[cell]);
  }

  function atlasBase(cell){
    return MC_ATLAS_BASE[MC_ATLAS_TEXTURES[cell]] || null;
  }

  function atlasTint(cell){
    return MC_ATLAS_TINT[MC_ATLAS_TEXTURES[cell]] || null;
  }

  /* ── 方块物品：等距 3D 小方块（和《我的世界》背包里一样） ── */
  const blockIcons = new Map();
  function blockIcon(id, size){
    const parts = MC_BLOCK_ICONS[id];
    if (!parts) return null;
    // 按 2 倍分辨率渲染，绘制时再平滑缩小，方块看起来更干净
    size = Math.max(16, Math.round((size || 16) * 2));
    const key = id + ':' + size;
    if (blockIcons.has(key)) return blockIcons.get(key);
    const top = raw(parts.top);
    const side = raw(parts.side);
    const front = raw(parts.front || parts.side);
    if (!top || !side || !front) return null;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const g = cv.getContext('2d');
    if (!g) return null;
    g.imageSmoothingEnabled = false;
    const S = size, half = S / 2, quarter = S / 4;
    const pTop = [half, 0], pRight = [S, quarter], pBottom = [half, half], pLeft = [0, quarter];
    const pBottomCenter = [half, S], pBottomLeft = [0, quarter + half];
    const face = (img, origin, ex, ey, shade) => {
      g.save();
      g.setTransform(ex[0] / 16, ex[1] / 16, ey[0] / 16, ey[1] / 16, origin[0], origin[1]);
      g.drawImage(img, 0, 0, 16, 16, 0, 0, 16, 16);
      g.restore();
      if (shade > 0){
        g.save();
        g.beginPath();
        g.moveTo(origin[0], origin[1]);
        g.lineTo(origin[0] + ex[0], origin[1] + ex[1]);
        g.lineTo(origin[0] + ex[0] + ey[0], origin[1] + ex[1] + ey[1]);
        g.lineTo(origin[0] + ey[0], origin[1] + ey[1]);
        g.closePath();
        g.clip();
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(0,0,0,' + shade + ')';
        g.fillRect(0, 0, S, S);
        g.restore();
      }
    };
    face(top, pLeft,
      [pTop[0] - pLeft[0], pTop[1] - pLeft[1]],
      [pBottom[0] - pLeft[0], pBottom[1] - pLeft[1]], 0);
    face(side, pLeft,
      [pBottom[0] - pLeft[0], pBottom[1] - pLeft[1]],
      [pBottomLeft[0] - pLeft[0], pBottomLeft[1] - pLeft[1]], 0.2);
    face(front, pBottom,
      [pRight[0] - pBottom[0], pRight[1] - pBottom[1]],
      [pBottomCenter[0] - pBottom[0], pBottomCenter[1] - pBottom[1]], 0.36);
    // 描边 + 棱线，让同色贴图（石头、木板）也能看出是立体的
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.lineWidth = Math.max(1, Math.round(size / 16));
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.beginPath();
    g.moveTo(pLeft[0], pLeft[1]);
    g.lineTo(pTop[0], pTop[1]);
    g.lineTo(pRight[0], pRight[1]);
    g.lineTo(pRight[0], pRight[1] + half);
    g.lineTo(pBottomCenter[0], pBottomCenter[1]);
    g.lineTo(pBottomLeft[0], pBottomLeft[1]);
    g.closePath();
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.14)';
    g.beginPath();
    g.moveTo(pLeft[0], pLeft[1]);
    g.lineTo(pBottom[0], pBottom[1]);
    g.lineTo(pRight[0], pRight[1]);
    g.moveTo(pBottom[0], pBottom[1]);
    g.lineTo(pBottomCenter[0], pBottomCenter[1]);
    g.stroke();
    blockIcons.set(key, cv);
    return cv;
  }

  /* 预加载全部贴图，返回加载完成后的 Promise（用于首帧后刷新） */
  function preload(){
    const list = Object.keys(MC_TEXTURE_DATA).map(load);
    return Promise.all(list.map(img => img && img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
  }

  return {
    itemIcon,
    gtIcon,
    mobSprite,
    blockIcon,
    gui,
    atlasImage,
    atlasBase,
    atlasTint,
    dataUrl,
    isReady,
    allLoaded,
    preload,
    image: raw,
    keys(){ return Object.keys(MC_TEXTURE_DATA); },
  };
})();

window.MCTextures = MCTextures;
MCTextures.preload();
'''


if __name__ == "__main__":
    main()
