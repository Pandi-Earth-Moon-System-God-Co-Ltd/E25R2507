# P0 素材与导入检查

原件位于工作区的 `2233/`。各组使用一套来源文件，模型统一采用 GLB，音频采用 OGG。外链贴图与模型按相对路径导入，目录内保留每个 Kenney 包的原始 CC0 许可文件。FBX、OBJ 和同款替代导出未导入。

| 运行目录 | 原件目录 | 用途与导入检查 |
| --- | --- | --- |
| [`assets/character`](assets/character) | `2233/kenney_blocky-characters_20/Models/GLB format` | `character-m.glb` 和 `Textures/texture-m.png`。按实际网格尺寸归一为 1.75 米。使用 `idle`、`walk`、`sprint` 三个循环动作。 |
| [`assets/survival`](assets/survival) | `2233/kenney_survival-kit/Models/GLB format` | 秋树、枯桩、半幅帐篷、火塘、床卷、箱子、工作台、木地板、洞口岩块和可采集的木材、石块。使用包内 `Textures/colormap.png`。 |
| [`assets/nature`](assets/nature) | `2233/kenney_nature-kit/Models/GLTF format` | 常绿树、草、花、灌木、蘑菇和低矮岩石。材质随 GLB 导入。 |
| [`assets/town`](assets/town) | `2233/kenney_fantasy-town-kit_2.0/Models/GLB format` | 小屋墙、窗、门框、屋顶、破围栏与灯。使用对应的 `Textures/colormap.png`。 |
| [`assets/cave`](assets/cave) | `2233/kenney_modular-cave-kit_1.0/Models/GLB format` | `gate-rock.glb` 洞口、`room-small.glb` 石室、岩壁与第一人称顶棚。使用对应的 `Textures/colormap.png`。 |
| [`assets/audio`](assets/audio) | `2233/kenney_rpg-audio/Audio` | 两条足音用于地表与室内，拾取和进出场景各用一条音效。 |

## P1 近战素材

| 素材 | 来源与许可 | 游戏用途 |
| --- | --- | --- |
| `assets/survival/tool-axe.glb` | Kenney Survival Kit，CC0，使用已有色板 | 玩家近战斧，第三人称挂在持斧手上，第一人称由相机下的模型呈现 |
| `assets/creature/A02_spore_beetle.glb` | OhmTap OT-18 Blocky Beasts Starter v1.0.0，随件 `LICENSE.txt` | 洞穴孢甲虫，用到原模型的 `idle`、`walk`、`run`、`attack_light`、`hit`、`defeated` |
| `assets/audio/knifeSlice.ogg`、`assets/audio/metalLatch.ogg` | Kenney RPG Audio，CC0 | 近战挥击、格挡 |
| `assets/combat-audio/impactGeneric_light_003.ogg` | Kenney Impact Sounds，CC0 | 人物或孢甲虫受击 |

OhmTap 素材随工程用于本地游戏，原许可限制将独立素材上传至公开仓库或作为素材包分发。第三方许可随模型保留。资源商店和导入步骤见 [编辑器及素材导入指南](docs/编辑器及素材导入指南.md)。

林地高程和土路由工程生成，营火的火焰与光照由工程控制。家具、植被、建筑和洞穴轮廓使用上述模型。走道、门位、树干、墙壁和房间边界使用独立碰撞体。

在兼容渲染器下核查了角色及营地道具、小屋拼装和室内材质、洞口与石室。[营地](preview/camp.png) · [点燃后的营火](preview/camp-lit.png) · [小屋内部](preview/cabin.png) · [洞穴内部](preview/cave.png)
