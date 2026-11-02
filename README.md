# 🎮 Future Terraria

一个基于 Phaser 3 + TypeScript 开发的未来废土沙盒生存游戏。

## 项目简介

Future Terraria 是一款受到 Terraria 启发的 2D 像素风沙盒游戏。

玩家将在被 AI 战争摧毁后的地球中探索遗迹、采集资源、建造基地、升级科技并挑战机械 Boss。

---

## 项目特色

### 🌍 随机世界

- 地形生成
- 矿石分布
- 地下洞穴
- 遗迹探索

### ⛏️ 沙盒生存

- 挖掘方块
- 放置方块
- 资源收集
- 装备制作

### 🤖 未来科技

- 能源晶体
- 废土机器人
- 科技装备
- 机械 Boss

### 🎒 成长系统

- 背包
- 合成
- 装备升级
- 科技解锁

---

## 技术栈

| 技术 | 用途 |
|--------|--------|
| TypeScript | 核心开发 |
| Phaser 3 | 游戏引擎 |
| Vite | 项目构建 |
| GitHub | 团队协作 |
| VS Code | 开发环境 |

---

## 项目结构

```text
src/

├── scenes/
│   └── GameScene.ts
│
├── player/
│   ├── Player.ts
│   └── PlayerController.ts
│
├── world/
│   ├── World.ts
│   ├── Block.ts
│   └── WorldGenerator.ts
│
├── enemy/
│   ├── Robot.ts
│   └── Boss.ts
│
├── inventory/
│   └── Inventory.ts
│
├── item/
│   ├── Item.ts
│   └── Recipe.ts
│
├── ui/
│   ├── Hud.ts
│   └── MainMenu.ts
│
└── main.ts
```

---

## 团队成员分工

### 世界系统

负责人：

功能：

- 地图生成
- 方块系统
- 挖矿系统
- 矿石生成

---

### 玩家系统

负责人：

功能：

- 移动
- 跳跃
- 状态管理

---

### 敌人与 Boss

负责人：

功能：

- AI
- 战斗
- Boss

---

### 背包与物品

负责人：

功能：

- 背包
- 物品
- 合成

---

### UI 与交互

负责人：

功能：

- 菜单
- HUD
- 游戏界面

---

## 开发路线

### Milestone 1

- [x] Phaser 项目初始化
- [x] 玩家生成
- [x] 移动系统
- [x] 重力系统

### Milestone 2

- [ ] 世界数组
- [ ] 方块地图
- [ ] 挖矿系统

### Milestone 3

- [ ] 背包系统
- [ ] 合成系统
- [ ] 装备系统

### Milestone 4

- [ ] Boss
- [ ] 存档
- [ ] 人物自定义

---

## 启动项目

安装依赖

```bash
npm install
```

启动开发服务器

```bash
npm run dev
```

构建项目

```bash
npm run build
```

---

## 许可证

仅用于课程项目与学习交流。
