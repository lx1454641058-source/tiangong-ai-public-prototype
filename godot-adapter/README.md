# 天工 Godot 适配器

这是一套面向 Godot 4.3 游戏的最小 Runtime SDK 接入示例。游戏拥有玩家界面和原生数据，天工提供 Agent、RAG 与规则服务。

## 文件

- TianGongAdapter.gd：通过 HTTP/JSON 调用天工的预览和结算接口。
- TianGongForgePanel.gd：游戏内“天工锻造所”面板。

## 接入方式

将两个脚本复制到 Godot 游戏的 scripts 目录，并在主控制器中：

1. 创建 TianGongAdapter 节点；
2. 从游戏自己的装备、资源、精华系统生成原生材料描述，并在创建面板前调用 `set_native_materials()`；
3. 创建 TianGongForgePanel，把 adapter 属性指向适配器；
4. 用游戏按键或按钮显示面板；
5. 在 `_to_game_item()` 中把天工结果映射为本游戏的装备数据。

预览请求会经过 `Runtime SDK → RAG 检索 → Agent CraftPlan → 规则引擎`。模型只生成结构化计划，不能直接修改游戏库存、成功率或最终数值。

`CraftPlan.materialOperations` 是提示词对应的材料工序。每一步都包含顺序、动作白名单 ID 和一个或多个游戏原生材料 ID。Godot 面板会把这些步骤显示为“塑形成骨（材料 A）→ 融入刃部（材料 B）”，并把最终工序、来源材料和提示词写入生成装备。

结算响应中的 `settlement.consumedMaterials` 是必须实际扣除的原生材料清单，`settlement.fragment` 是可选副产物。本示例把碎片映射到游戏原生精粹，并通过“验证 → 快照 → 扣料 → 发放 → 保存”的事务执行；背包满、材料移动或数量不足时恢复快照。正式联网游戏应把同样的事务放到权威游戏服务器上。

材料描述至少包含 `id`、`name`、`quantity`、`matterUnits`、`traits`、`valueUnits` 和 `kind`；建议同时提供 `storedEnergy`、`purity`、`state`、`tags`、`promptKeywords` 与 `supportedEffects`。旧版 `power` 字段只用于试用兼容，不再是规则引擎的真实预算。
其中 `id` 必须能回到宿主游戏的真实物品或资源，天工只保存和计算这个 ID，不拥有材料库存。

Pixel Pathfinder 的实际测试副本位于：

work/partners/pixel-pathfinder-main-extracted/pixel-pathfinder-main
