# 天工 Unity 适配器骨架

来源：天工项目原创代码，未复制伙伴游戏代码；正式发布前请由项目方确定许可证。

这组 C# 文件用于接入：

`Roo-Roo-Roo/survivors-roguelike-kit`

伙伴仓库已经下载到本地：

```text
work/partners/survivors-roguelike-kit/
```

## 当前伙伴项目

- Unity：`6000.0.23f1`
- 主要技能数据：`Assets/RGame/RoguelikeKit/Scripts/SOData/Skill/SkillDataSO.cs`
- 技能管理：`Assets/RGame/RoguelikeKit/Scripts/System/Skill/SkillManager.cs`
- 已有状态效果：`BurnBuff`、`FreezingBuff`、`SlowBuff`

## 接入方式

1. 安装 Unity `6000.0.23f1`。
2. 打开 `work/partners/survivors-roguelike-kit/`。
3. 将本目录下的 `Runtime/` 复制到伙伴项目的 `Assets/TianGongAdapter/Runtime/`。
4. 在 `Initialization.unity` 场景添加 `TianGongHttpClient` 所在的 GameObject。
5. 在游戏 UI 场景添加“天工研发所”按钮和面板。
6. 玩家提交材料和提示词后，调用 `PreviewCraft`。
7. 玩家确认试制后，调用 `CommitCraft`。
   - 将 `TianGongCraftPreview.requestId` 写回 `TianGongCraftRequest.requestId` 后再提交。
8. 在同一个游戏服务器事务中按 `settlement.consumedMaterials` 扣除原生材料、按 `settlement.byproducts` 发放或记录副产物，并使用 `TianGongWeaponBridge` 发放成品；任何一步失败都必须整体回滚。

## 运行模式

当前本地服务已经提供：

```text
POST /api/v1/craft/preview
POST /api/v1/craft/commit
```

当前 `scripts/dev-server.mjs` 已经提供这两个本地 API：预览会保存一份服务端研发记录，提交会消费这份记录，同一个 `requestId` 不能重复结算。

请求中的每个原生材料需要映射 `matterUnits`、`storedEnergy`、`traits`、`valueUnits` 和 `kind`。响应中的 `balanceSheet` 用于显示和审计守恒结果，库存事务仍由游戏服务器执行。

## 效果映射

| 天工结果 | 伙伴游戏目标 |
|---|---|
| `damage` | `SkillDataSO.Damage` |
| `burn` | `BurnBuff` 或火焰技能效果 |
| `freeze` | `FreezingBuff` |
| `slow` | `SlowBuff` |
| `projectile` | 技能弹道或数量配置 |
| `attack_speed` | 冷却或技能速度配置 |

注意：当前骨架不会自动修改伙伴仓库的 `SkillManager` 私有字典。正式接入还需要增加一个受控的 `RegisterExternalSkill` 入口，由游戏厂商决定哪些天工结果可以进入战斗。
