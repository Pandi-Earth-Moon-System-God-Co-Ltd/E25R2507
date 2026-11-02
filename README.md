# Future Survival

Future Survival 是一个面向团队开发的 Python 横版 2.5D 生存沙盒原型。

当前原型已包含基础地形、方块编辑与等距 2.5D 展示：

- Pygame 窗口与基础事件循环
- ModernGL 上下文初始化与显式清理
- 可通过种子重现的起伏 voxel 地形
- 等距视角的方块顶面/侧面渲染及鼠标拾取
- 鼠标挖掘/放置方块和快捷键选择方块类型
- 窗口标题中的实时 FPS 显示
- 清晰的退出处理（关闭窗口或按 `Esc` / `Q`）

尚未实现：玩家移动、碰撞/物理、光照、存档、模组 API 和联网。

## 环境要求

- Python 3.11+（建议使用 3.12）
- 支持 OpenGL 3.3 Core 的显卡/驱动
- Windows、Linux 或 macOS

## 启动

在项目根目录执行：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m future_survival
```

窗口标题会显示 `Future Survival | FPS: ...`。关闭窗口，或按 `Esc` / `Q`，即可退出。

完成上面的环境安装后，也可以在项目根目录双击 `run_game.bat` 启动。脚本会优先使用项目的 `.venv`，否则使用系统 `python`。

## 操作

- **鼠标左键**：挖掘指向的方块
- **鼠标右键**：在指向方块被点击的面上放置当前方块
- **`1` / `2` / `3`**：选择草方块 / 泥土 / 石头
- 窗口标题会显示最近挖掘或放置的区块坐标

默认世界种子为 `17`。可通过 `GameConfig(world_seed=...)`、`world_width`、
`world_height` 和 `world_depth` 调整生成结果与尺寸。

如果 PowerShell 禁止执行激活脚本，可以直接使用虚拟环境解释器：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m future_survival
```

## 项目结构

```text
future_survival/
├── __main__.py          # python -m future_survival 的入口
├── app.py               # Pygame 生命周期、输入和主循环
├── config.py            # 可集中调整的运行配置
├── camera/
│   └── controller.py    # 相机状态接口
├── renderer/
│   ├── context.py       # Pygame OpenGL 窗口与 ModernGL 上下文
│   └── renderer.py      # ModernGL 方块渲染和等距拾取
└── world/
    ├── chunk.py         # voxel chunk 数据模型与编辑接口
    └── generation.py    # 带种子的简易地形生成
```

## 团队协作边界

- **应用/输入**：维护 `app.py`，只编排生命周期、事件和系统调用，不直接写 shader。
- **渲染**：维护 `renderer/`，拥有 ModernGL 资源、shader、模型和渲染队列；对上层暴露 `begin_frame` / `draw_world` / `end_frame` 等接口。
- **相机**：维护 `camera/`，只处理世界坐标到视图/投影的状态，不依赖 Pygame 事件循环。
- **世界/区块**：维护 `world/`，负责 voxel 数据、chunk 坐标和编辑语义；不创建窗口、不调用 ModernGL。
- **配置**：公共运行参数集中在 `config.py`，避免模块间散落常量。

跨模块集成只通过公开类和方法进行。地形生成和区块编辑可在无图形环境中单独验证。

## 验证

无图形环境时可以先做静态验证：

```powershell
python -m compileall future_survival
python -m unittest discover -s tests -v
```

在有图形桌面的机器上，运行入口并确认窗口出现、标题 FPS 更新、`Esc` 可退出。ModernGL 需要可创建 OpenGL 3.3 Core 上下文；如果驱动不满足，程序会输出明确错误并清理 Pygame 资源。
