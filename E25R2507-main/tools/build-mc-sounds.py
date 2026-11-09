#!/usr/bin/env python3
"""从 2233 材质包里提取音效，打包成 js/mc-sounds.js。

音效来自 GregTech-Modern 的 sounds 目录（.ogg），按游戏事件映射后
以 data URL 内嵌，直接双击 index.html（file://）也能播放。

用法（在项目根目录）：
    python tools/build-mc-sounds.py
"""
from __future__ import annotations

import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOUNDS = ROOT / "2233" / "GregTech-Modern" / "src" / "main" / "resources" / "assets" / "gtceu" / "sounds"
OUT = ROOT / "js" / "mc-sounds.js"

# 《我的世界》原版音效（可选）：把 .ogg 放到 2233/mc-sounds/ 下，按相对路径摆放即可
MC_SOUND_ROOT = ROOT / "2233" / "mc-sounds"
MC_EVENTS = {
    "attack": ["entity/player/attack/weak1.ogg", "entity/player/attack/weak2.ogg", "entity/player/attack/weak3.ogg"],
    "slash": ["entity/player/attack/sweep1.ogg", "entity/player/attack/sweep2.ogg", "entity/player/attack/sweep3.ogg"],
    "collect": ["random/pop.ogg", "entity/item/pickup.ogg"],
    "chop": ["dig/wood1.ogg", "dig/wood2.ogg", "dig/wood3.ogg", "dig/wood4.ogg"],
    "mine": ["dig/stone1.ogg", "dig/stone2.ogg", "dig/stone3.ogg", "dig/stone4.ogg"],
    "build": ["dig/stone1.ogg", "block/stone/place1.ogg"],
    "eat": ["random/eat1.ogg", "random/eat2.ogg"],
    "drink": ["random/drink.ogg"],
    "water": ["random/splash.ogg", "ambient/water/water1.ogg"],
    "hurt": ["entity/player/hurt1.ogg", "entity/player/hurt2.ogg"],
    "cave": ["ambient/cave/cave1.ogg", "ambient/cave/cave2.ogg"],
    "levelUp": ["random/levelup.ogg", "random/orb.ogg"],
}

# 游戏事件 -> 材质包里的音效文件（不带 .ogg）
EVENTS = {
    # 交互
    "attack": "cut",             # 挥砍
    "collect": "soft_hammer",    # 采集 / 拾取
    "mine": "miner",             # 挖矿
    "chop": "saw",               # 砍树
    "build": "wrench",           # 放置方块
    "cut": "wirecutter",         # 修剪 / 拆除
    "eat": "mortar",             # 进食
    "feed": "pump",              # 喂食
    "drink": "plunger",          # 喝水
    "water": "bath",             # 入水
    "fire": "fire",              # 火焰
    "hurt": "wrench",            # 受伤
    "scan": "portable_scanner",  # 扫描 / 地图
    # 制作与机器
    "craft": "assembler",        # 合成
    "machine": "furnace",        # 机器运转（默认）
    "machineOpen": "metal_pipe", # 打开机器
    "arc": "arc",                # 电弧炉
    "chemical": "chemical",      # 电解机
    "centrifuge": "centrifuge",  # 离心机
    "compressor": "compressor",  # 压缩机
    "macerator": "macerator",    # 粉碎机
    "mixer": "mixer",            # 搅拌
    "boiler": "boiler",          # 锅炉
    "turbine": "turbine",        # 涡轮
    "motor": "motor",            # 马达
    "cooling": "cooling",        # 冷却
    "electrolyzer": "electrolyzer",
    "forge": "forge_hammer",     # 锻造
    "file": "file",              # 打磨
    "chainsaw": "chainsaw",      # 伐木
    "drill": "drill",            # 钻探
    "screwdriver": "screwdriver",
    "spray_can": "spray_can",
    "replicator": "replicator",
    "jet_engine": "jet_engine",
    "combustion": "combustion",
    # 世界与成长
    "cave": "portal_opening",    # 进入洞穴
    "caveOut": "portal_closing", # 离开洞穴
    "levelUp": "science",        # 升级 / 解锁
}


def first_existing(paths: list[str]) -> Path | None:
    for rel in paths:
        candidate = MC_SOUND_ROOT / rel
        if candidate.is_file():
            return candidate
    return None


def data_url(path: Path) -> str:
    return "data:audio/ogg;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def main() -> None:
    library: dict[str, str] = {}
    missing: list[str] = []
    for event, name in EVENTS.items():
        path = SOUNDS / (name + ".ogg")
        if not path.is_file():
            missing.append(name)
            continue
        library[event] = data_url(path)
    # 原版音效优先：找到了就覆盖同名事件
    mc_used = 0
    for event, candidates in MC_EVENTS.items():
        found = first_existing(candidates)
        if found:
            library[event] = data_url(found)
            mc_used += 1
    if mc_used:
        print(f"已使用 {mc_used} 个《我的世界》原版音效")
    else:
        print(f"提示：把原版 .ogg 放到 {MC_SOUND_ROOT.relative_to(ROOT)} 下（如 entity/player/attack/weak1.ogg）即可自动替换")
    if missing:
        raise SystemExit("材质包缺少以下音效：" + ", ".join(missing))

    total = sum(len(value) for value in library.values())
    lines = [
        "'use strict';",
        "",
        "/* ══════════════════════════════════════════════════════════",
        "   游戏音效（自动生成，请勿手改）",
        "   生成脚本：tools/build-mc-sounds.py",
        "   - 音效样本提取自 2233 材质包（GregTech-Modern / gtceu sounds）",
        "   - data URL 内嵌，file:// 直接打开也能播放",
        "   ══════════════════════════════════════════════════════════ */",
        "",
        "window.PixelSurvivalSounds = " + json.dumps(library, indent=0, sort_keys=True) + ";",
        "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"已写入 {OUT.relative_to(ROOT)} · {len(library)} 个音效 · {total / 1024:.0f} KB (base64)")


if __name__ == "__main__":
    main()
