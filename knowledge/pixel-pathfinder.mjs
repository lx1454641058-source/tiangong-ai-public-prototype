// SPDX-License-Identifier: MIT
// Pixel Pathfinder 接入包：厂商可配置的游戏事实、工序、目标蓝图和守恒策略。
import { CONSERVATION_LAWS, LEDGER_DEFINITIONS, MATERIAL_CONTRACT, TIANGONG_ONTOLOGY_VERSION } from "./tiangong-ontology.mjs";

export const PIXEL_PATHFINDER_KNOWLEDGE_VERSION = "pp_knowledge_v4_asset_generation";
export const PIXEL_PATHFINDER_RULE_VERSION = "forge_conservation_v2";

// StylePack 是厂商提供的“画风与技术约束包”。参考资产只能用于理解风格，不能作为新道具贴图直接复用。
export const PIXEL_PATHFINDER_STYLE_PACK = {
  id: "pp_pixel_forge",
  version: "style_pack_v1",
  artDirection: "高对比暗色像素幻想风，轮廓清晰，材料特征可辨认",
  palette: ["#e8b24c", "#ff7a45", "#78d8ff", "#ae92ff", "#9ba8b5", "#152a36"],
  referenceAssetIds: ["native:reference:sword", "native:reference:bow", "native:reference:wand"],
  referenceFingerprints: ["pp_ref_sword_v1", "pp_ref_bow_v1", "pp_ref_wand_v1"],
  referenceUse: "style_and_proportion_only",
  outputs: {
    image2d: { format: "svg", width: 360, height: 360, transparentBackground: true, pixelGrid: 4 },
    model3d: { format: "obj", maxVertices: 512, maxFaces: 768, coordinateSystem: "Y_UP", lodCount: 1 }
  },
  novelty: { maxSilhouetteSimilarity: 0.82, rejectExactFingerprint: true, rejectSimpleRecolor: true }
};

export const PIXEL_PATHFINDER_MANIFEST = {
  gameId: "pixel_pathfinder_tiangong_demo",
  gameName: "Pixel Pathfinder",
  engine: "Godot 4.3",
  ontologyVersion: TIANGONG_ONTOLOGY_VERSION,
  knowledgeVersion: PIXEL_PATHFINDER_KNOWLEDGE_VERSION,
  ruleVersion: PIXEL_PATHFINDER_RULE_VERSION,
  authority: "game_server",
  targetTypes: ["sword", "bow", "wand"],
  assetSpecVersion: "asset_spec_v1",
  stylePackVersion: PIXEL_PATHFINDER_STYLE_PACK.version
};

export const EFFECT_REGISTRY = {
  damage: { id: "damage", name: "基础伤害", trait: "damage", requirement: 8, keywords: ["伤害", "攻击", "锋利"] },
  burn: { id: "burn", name: "燃烧", trait: "fire", requirement: 8, keywords: ["燃烧", "火焰", "灼烧"] },
  freeze: { id: "freeze", name: "冰冻", trait: "frost", requirement: 8, keywords: ["冰冻", "冻结", "寒冰"] },
  slow: { id: "slow", name: "减速", trait: "control", requirement: 6, keywords: ["减速", "迟缓", "控制"] },
  life_steal: { id: "life_steal", name: "吸血", trait: "life", requirement: 9, keywords: ["吸血", "生命", "回血"] },
  projectile: { id: "projectile", name: "弹射", trait: "wind", requirement: 7, keywords: ["弹射", "穿透", "分裂"] },
  attack_speed: { id: "attack_speed", name: "攻速", trait: "speed", requirement: 7, keywords: ["攻速", "快速", "迅捷"] },
  explosion: { id: "explosion", name: "范围爆炸", trait: "explosion", requirement: 10, keywords: ["爆炸", "范围", "冲击"] },
  poison: { id: "poison", name: "中毒", trait: "poison", requirement: 7, keywords: ["中毒", "毒", "腐蚀"] },
  stability: { id: "stability", name: "稳定", trait: "stability", requirement: 6, keywords: ["稳定", "稳固", "平衡"] }
};

export const TARGET_BLUEPRINTS = {
  sword: { id: "sword", name: "长剑", minimumMatter: 8, maxEffects: 3, baseDamage: 24, allowedEffects: ["damage", "burn", "freeze", "life_steal", "attack_speed", "stability"] },
  bow: { id: "bow", name: "猎弓", minimumMatter: 6, maxEffects: 3, baseDamage: 18, allowedEffects: ["damage", "burn", "slow", "projectile", "poison", "attack_speed"] },
  wand: { id: "wand", name: "奥术法杖", minimumMatter: 5, maxEffects: 3, baseDamage: 20, allowedEffects: ["damage", "burn", "freeze", "slow", "projectile", "explosion"] }
};

// 工序中的数字由厂商配置并版本化；模型只能引用 operationId，不能改写这些数值。
export const OPERATION_REGISTRY = {
  form_base: { id: "form_base", name: "塑形成骨", keywords: ["为骨", "作骨", "骨架", "基底", "剑身", "塑形"], energyCost: 5, transferEfficiency: 0.9, entropy: 3, outputState: "composite" },
  embed_core: { id: "embed_core", name: "嵌入核心", keywords: ["为核心", "作核心", "内核", "嵌入", "植入"], energyCost: 4, transferEfficiency: 0.86, entropy: 4, outputState: "composite" },
  infuse_edge: { id: "infuse_edge", name: "融入刃部", keywords: ["为刃", "作刃", "刃部", "刀刃", "剑刃"], energyCost: 5, transferEfficiency: 0.88, entropy: 4, outputState: "composite" },
  encapsulate: { id: "encapsulate", name: "封装", keywords: ["包裹", "封装", "包覆"], energyCost: 3, transferEfficiency: 0.94, entropy: -2, outputState: "composite" },
  isolate: { id: "isolate", name: "分层隔离", keywords: ["隔离", "分层", "分隔"], energyCost: 4, transferEfficiency: 0.92, entropy: -3, outputState: "composite" },
  fuse: { id: "fuse", name: "融合", keywords: ["融合", "熔合", "合并"], energyCost: 6, transferEfficiency: 0.82, entropy: 6, outputState: "composite" },
  quench: { id: "quench", name: "淬炼", keywords: ["淬火", "淬炼", "冷却"], energyCost: 4, transferEfficiency: 0.9, entropy: 2, outputState: "solid" },
  channel: { id: "channel", name: "能量引导", keywords: ["引导", "通道", "导流"], energyCost: 3, transferEfficiency: 0.9, entropy: -1, outputState: "energy" },
  temper: { id: "temper", name: "稳定锻打", keywords: ["锻打", "锤炼", "稳定", "调和"], energyCost: 5, transferEfficiency: 0.93, entropy: -2, outputState: "solid" }
};

export const CONSERVATION_POLICY = {
  laws: CONSERVATION_LAWS,
  ledgers: LEDGER_DEFINITIONS,
  defaultEnvironment: { furnaceId: "native:forge:basic", name: "基础锻造炉", availableEnergy: 36, precision: 0.82, valueCost: 4 },
  roundingTolerance: 0.000001,
  residueItem: { id: "native:resource:forge_residue", name: "锻造残渣" },
  fragmentItem: { id: "native:resource:refine_fragment", name: "可回收精粹碎片" },
  antiArbitrage: "outputValue <= inputValue + energyValue - irreversibleLoss",
  promptPolicy: "提示词决定路径与效率，不增加守恒预算；同条件重复使用不衰减。"
};

const knowledge = (id, type, targetTypes, tags, content, authority = "game_studio") => ({
  id, type, gameId: PIXEL_PATHFINDER_MANIFEST.gameId, version: PIXEL_PATHFINDER_KNOWLEDGE_VERSION,
  targetTypes, tags, authority, content
});

export const PIXEL_PATHFINDER_KNOWLEDGE = [
  knowledge("pp.game.manifest", "game_manifest", ["sword", "bow", "wand"], ["native_data", "authority"], "装备、背包和库存版本由游戏服务器拥有。天工只读取当前请求中的原生实例，返回结算指令，不保存玩家库存。"),
  knowledge("pp.material.contract", "material_ontology", ["sword", "bow", "wand"], ["matter", "energy", "traits", "value"], `原生材料必须映射 ${MATERIAL_CONTRACT.required.join("、")}；缺失的可选字段使用规则包默认值，不允许模型自行补充能力。`),
  knowledge("pp.conservation.five-laws", "conservation_policy", ["sword", "bow", "wand"], ["conservation", "ledger", "invariant"], CONSERVATION_LAWS.map((law) => `${law.name}：${law.description}`).join(" "), "tiangong"),
  knowledge("pp.operations.registered", "operation_policy", ["sword", "bow", "wand"], ["operation", "energy", "entropy"], `可执行工序只有：${Object.values(OPERATION_REGISTRY).map((operation) => operation.name).join("、")}。模型负责排序和绑定材料，规则引擎读取固定能耗、效率和复杂度。`),
  knowledge("pp.target.sword", "target_blueprint", ["sword"], ["weapon", "melee", "structure"], "长剑至少需要 8 MU 结构物质，最多 3 个效果。适合伤害、燃烧、冰冻、吸血、攻速和稳定；提示词可描述部位、持续性和取舍。"),
  knowledge("pp.target.bow", "target_blueprint", ["bow"], ["weapon", "ranged", "structure"], "猎弓至少需要 6 MU 结构物质，最多 3 个效果。适合伤害、燃烧、减速、弹射、中毒和攻速。"),
  knowledge("pp.target.wand", "target_blueprint", ["wand"], ["weapon", "magic", "structure"], "奥术法杖至少需要 5 MU 结构物质，最多 3 个效果。适合伤害、燃烧、冰冻、减速、弹射和爆炸。"),
  knowledge("pp.prompt.assistance", "agent_policy", ["sword", "bow", "wand"], ["prompt", "assist", "player_experience"], "玩家只需选择材料并表达目标。目标明确但未写工序时，Agent 可以采用厂商登记的基础工艺；明确的部位、顺序、取舍和冲突处理会提高效率。辅助补全不能改变目标或创造能力。"),
  knowledge("pp.native.mapping", "native_mapping", ["sword", "bow", "wand"], ["element", "affix", "trait"], "metal 提供 damage/stability，wood 提供 life/stability，water 提供 frost/control，fire 提供 fire/explosion，earth 提供 damage/stability；词条只能映射为已登记 trait。"),
  knowledge("pp.failure.settlement", "settlement_policy", ["sword", "bow", "wand"], ["failure", "byproduct", "atomic_commit"], "成功和失败都消耗实际被操作的消耗型材料。失败不是删除材料，而是把投入结算为劣质品、可回收碎片、残渣和散失热量；扣料与发放必须原子执行。"),
  knowledge("pp.asset.style", "asset_style", ["sword", "bow", "wand"], ["pixel_art", "2d", "3d", "style_pack"], "新道具必须依据材料特征、玩家工序、效果语义和 StylePack 生成全新的 2D 图像与 3D 模型。原生资产只允许作为画风、比例和技术规格参考。"),
  knowledge("pp.asset.novelty", "asset_novelty_policy", ["sword", "bow", "wand"], ["non_reuse", "similarity", "audit"], "禁止复制原图、套用原模型、仅换色或只叠加特效。候选资产必须通过指纹、轮廓相似度、简单换色、材料覆盖和技术规格检查后才能获得 assetId。", "tiangong"),
  knowledge("pp.asset.spec", "asset_generation_contract", ["sword", "bow", "wand"], ["asset_spec", "prompt", "material", "craft_plan"], "AssetSpec 由规则结果生成，固定记录材料视觉特征、工序结构、效果、画风包和引擎预算。图像或模型生成器不得修改伤害、词条、成功率、库存与结算。", "tiangong")
];
