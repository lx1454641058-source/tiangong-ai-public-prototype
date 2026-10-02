# 天工 AI 游戏内容生成引擎原型

这是一个可运行的“厂商工具＋Agent 服务＋资产生成服务＋游戏 Runtime SDK”原型，用来验证四件事：

1. 游戏厂商能否在天工 Studio 中管理项目接入、原生数据映射、RAG 知识库、模型和规则；
2. Agent 能否检索当前游戏知识并输出结构化 `CraftPlan`；
3. Pixel Pathfinder 能否通过 Godot Runtime SDK 使用原生材料完成游戏内武器锻造。
4. 数值裁决后能否根据材料、玩家提示词、CraftPlan 和游戏画风包生成全新的 2D 图像与 3D 模型，而不是复用原道具或简单换色。

玩家侧只需要选择游戏原生材料并表达目标；目标原型、炉具和规则版本由游戏上下文提供。Agent 可以补全厂商登记的基础工艺，成功率、品质、副产物和五套守恒账本全部由确定性规则引擎计算，不设置玩家风险偏好，也不对重复使用的提示词衰减。计算成功率前会进行可解释的提示词逻辑审计，检查基础结构、工序顺序、材料兼容、效果来源和自相矛盾；硬逻辑错误直接降为 0%。

当前原型不依赖外部图片或第三方前端框架，使用浏览器、Node.js 和原生 JavaScript 即可运行。

## 目录

```text
studio/                  面向游戏厂商的天工 Studio
agent/                   RAG 检索与模型规划器
knowledge/               按游戏隔离的试用知识库
game/                    早期浏览器游戏演示（非正式产品界面）
shared/                  天工标准规则引擎
shared/tiangong-assets.mjs AssetSpec、2D/3D 测试生成器与非复用审核
scripts/dev-server.mjs   本地静态服务器
tests/smoke-test.mjs     核心规则冒烟测试
tests/rag-agent-test.mjs RAG、Agent 和 CraftPlan 测试
tests/api-smoke-test.mjs 预览、结算和单次结算 API 测试
tests/asset-generation-test.mjs 资产生成、确定性和非复用测试
unity-adapter/           Unity 伙伴适配器骨架
godot-adapter/           Godot 伙伴适配器与游戏内锻造面板
```

## 运行

需要 Node.js 18 或更高版本。

```powershell
npm.cmd test
npm.cmd start
```

`npm.cmd test` 会检查规则引擎、RAG/Agent 和本地天工 API。启动服务器后，Runtime SDK 可以调用：

```text
POST http://127.0.0.1:4173/api/v1/craft/preview
POST http://127.0.0.1:4173/api/v1/assets/generate
POST http://127.0.0.1:4173/api/v1/craft/commit
GET  http://127.0.0.1:4173/api/v1/config/manifest
```

启动后打开：

- 厂商客户端：http://localhost:4173/studio/
- 早期浏览器游戏演示：http://localhost:4173/game/

默认使用可重复测试的 `mock-rag-agent`。接入兼容 Chat Completions JSON 输出的真实模型时，在服务端配置：

```text
TIANGONG_MODEL_PROVIDER=compatible
TIANGONG_MODEL_URL=https://your-provider.example/v1/chat/completions
TIANGONG_MODEL_NAME=your-model
TIANGONG_MODEL_API_KEY=***
```

资产阶段当前使用 `tiangong-procedural-mock`：它会生成一张新的 SVG 图像和一个新的 OBJ 三维模型文件，便于完整测试接口、下载、审核和游戏内回写。它不是正式的图像/3D 大模型，正式接入时应替换生成 provider，但继续使用相同的 `AssetSpec` 和审核协议。

## 全新资产生成链路

```text
游戏原生材料 + 玩家提示词 + CraftPlan + 规则裁决
→ AssetSpec（资产规格）
→ 2D/3D 候选资产
→ 指纹 / 轮廓 / 简单换色 / 材料覆盖 / 技术规格审核
→ 通过后获得 assetId
→ 游戏服务器原子扣料并绑定最终道具
```

`StylePack` 是游戏厂商提供的画风与技术约束包。原有道具图像和模型只允许帮助模型理解画风、比例与引擎预算，不会作为生成底图、贴图或网格输入。以下行为属于硬拒绝：复制源文件、套用原模型、仅换色、只裁切缩放、只叠加特效。

## Godot 测试伙伴

### Emberfield 游戏内试用版（当前）

本地测试副本位于：

```text
work/partners/emberfield
```

先运行 `npm.cmd start`，再用 Godot 4.7.1 打开该目录并运行。进入游戏后会自动打开中文“天工 · Emberfield 游戏内试用版”，按 `F6` 可以反复显示或隐藏。面板会读取 Emberfield 的原生背包，默认勾选 `iron_ore` 和 `fire_shard`，启动时自动进行一次只读预演，不会自动扣料。

试用链路为：

```text
原生背包材料 → 玩家提示词 → Emberfield RAG 知识包 → Agent 材料工序
→ 天工五账本核算 → AssetSpec → 全新 2D/3D 资产并审核 → 玩家确认
→ 原子扣料 → 武器、资产引用与副产物写回原背包
```

完整工艺提示词可达到 100%，含糊或不可执行提示词可降到 0%。执行后铁矿和火焰碎片各扣除 1 个，成品武器写入背包；满 4 MU 的副产物映射为原生 `Power Fragment`，不足 4 MU 的尾料生成一个零价值“天工锻造残渣”批次，并在名称中记录实际 MU，不能反向兑换成完整铁矿。

仅做自动结算回归测试时，可使用 Godot 的用户参数：

```text
-- --tiangong-auto-commit
```

Emberfield 副本只用于本地、非商用兼容性验证，已被 `.gitignore` 排除，不随天工仓库上传或发布。其 README 声明 MIT，但当前副本没有独立的标准许可证全文和完整素材授权清单，因此不把游戏代码或素材并入天工源码。

### Pixel Pathfinder 早期适配

已下载并解压 Pixel Pathfinder 官方源码到：

work/partners/pixel-pathfinder-main-extracted/pixel-pathfinder-main

该副本加入了天工 Godot Runtime SDK。使用 Godot 4.3 打开该目录并运行游戏，在地图或战斗界面按 T 打开“神兵锻造 · 天工试用”。先启动本项目的天工服务器，再在游戏内点击“预览评定”和“确认炼制”。

接入代码模板位于 godot-adapter/。游戏内目标原型暂时固定为长剑；玩家选择的是 Pixel Pathfinder 自己的装备、背包物品、精粹和词条精华。确认结算时，Godot 先验证所有原生 ID，建立库存快照，再扣除被操作材料并发放成品和碎片；任一步失败都会恢复快照，不会复制或吞掉材料。

平台不拥有这批材料，也不创建 `iron_ore`、`fire_core` 一类跨游戏材料。浏览器 Studio 为了独立演示仍保留一套演示材料回退；真实游戏接入时，只要传入 `materials`，规则引擎就完全使用适配器提供的原生材料。

提示词会被转换为有顺序的 `materialOperations`。例如“以精铁为骨，以火焰核心为刃；分层封装火焰核心”会生成“塑形成骨（精铁）→ 融入刃部（火焰核心）→ 分层隔离（火焰核心）→ 封装（火焰核心）”。如果玩家只说“制作一把持续燃烧的火焰剑”，Agent 会采用厂商登记的基础工艺，但效率低于玩家明确指定部位、顺序和取舍的方案。只有被步骤引用的材料才贡献能力；未被操作的材料不会消耗。

## 原型中的合作伙伴假设

原型假设接入的是一个 Survivors-like 2D 游戏。它使用：

- 游戏自己的装备、资源或材料掉落；
- 武器原型；
- 燃烧、冰冻、减速、吸血等效果组件；
- 战斗场景；
- 玩家炼器界面。

这与推荐的开源 Unity 项目 Survivors Roguelike Kit 的功能结构相近。当前仓库没有直接复制其代码或素材，因此本原型可以独立运行；真正接入 Unity 时，需要通过适配器将游戏中的 ScriptableObject、库存和效果组件映射到天工标准协议。

## 产品定位

天工 Studio 不是玩家合成界面，而是游戏厂商使用的 AI 内容引擎工作台，包含：

- 项目和游戏引擎接入；
- 原生数据协议映射；
- RAG 知识库管理；
- Agent 与模型配置；
- 规则、版本、测试和审计。

玩家看到的锻造、炼丹、宠物进化等界面由游戏厂商制作。天工 Runtime SDK 只在后台传输原生数据、提示词、Agent 计划和规则结果。

设计上借鉴“装备编辑器、稀有材料试制、持续迭代自制武器”的抽象体验，不直接使用《全职高手》或《荣耀》的专有名称、角色、数值、文本和素材。

## 重要边界

- Agent只解析意图，不修改库存、不执行代码；
- RAG 只保存相对稳定的游戏知识，当前背包和装备由 Runtime SDK 实时传入；
- 规划模型只输出结构化 `CraftPlan`，不输出成功率、最终数值或库存命令；资产模型只消费 `AssetSpec`，不得回写数值和库存；
- 材料的名称、ID、数量和消耗归属游戏本身，天工只接收适配器传来的材料描述；
- 规则引擎决定效果是否可实现；
- 游戏服务器应拥有最终扣料和发放权；
- 每个原生材料实例即使参与多道工序也只消耗一次；成功和失败都会消耗全部被操作的消耗型材料，差额必须结算为成品、碎片、残渣或散失热量；
- 同材料、同规则版本和同提示词会得到相同评分与显示成功率，不做重复使用衰减；
- 提示词是成功率和品质的主导因素：详细提示词可以达到材料允许范围内的 100%；简单但目标明确的提示词可以通过基础工艺获得可用结果；空泛、越权或缺少属性来源的提示词为 0%；
- 规则引擎同时核算物质（MU）、能量（EU）、属性潜能（TP）、游戏价值（VU）和复杂度（EP），提示词只能改善路径和效率，不能增加这些输入；
- 本地浏览器演示用模拟库存，不能直接用于真实玩家资产；Pixel Pathfinder 已改为读取其原生装备/资源状态；
- 原型会实际生成新的 SVG 图像和 OBJ 模型，但当前是本地程序化测试生成器，尚未接入正式的 2D 扩散模型、3D 生成模型和生产级相似度服务；
- 只有通过非复用、非简单换色、材料覆盖、画风和技术规格审核的候选资产才能获得 `assetId` 并进入结算。

## 后续接入 Unity 的最小工作

1. 将 `shared/tiangong-core.mjs` 的标准数据结构转换为 C# DTO；
2. 将 `unity-adapter/Runtime/` 复制到伙伴 Unity 项目的 `Assets/TianGongAdapter/Runtime/`；
3. 在 Unity 中实现材料、原型和效果组件映射；
4. 将库存冻结、扣料、发放放到游戏服务器；
5. 用天工标准 API 替换本地模拟规则调用；
6. 根据 `AssetSpec` 调用正式 2D/3D 生成服务，并把审核通过的 `assetId`、贴图、OBJ/GLB 或预制体写入 Addressables；
7. 在 Unity 场景中加载审核通过的新资产，禁止回退为原道具简单换色。
