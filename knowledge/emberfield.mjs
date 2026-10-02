// SPDX-License-Identifier: MIT
// Emberfield 本地试验接入包：只登记原生物品语义，不复制游戏代码或素材。
import { CONSERVATION_LAWS, LEDGER_DEFINITIONS, MATERIAL_CONTRACT, TIANGONG_ONTOLOGY_VERSION } from "./tiangong-ontology.mjs";

export const EMBERFIELD_KNOWLEDGE_VERSION = "emberfield_knowledge_v1";
export const EMBERFIELD_RULE_VERSION = "forge_conservation_v2";

export const EMBERFIELD_MANIFEST = {
  gameId: "emberfield_tiangong_local_test",
  gameName: "Emberfield（本地测试）",
  engine: "Godot 4.x",
  ontologyVersion: TIANGONG_ONTOLOGY_VERSION,
  knowledgeVersion: EMBERFIELD_KNOWLEDGE_VERSION,
  ruleVersion: EMBERFIELD_RULE_VERSION,
  authority: "game_runtime",
  targetTypes: ["sword"]
};

const knowledge = (id, type, tags, content, authority = "game_studio") => ({
  id,
  type,
  gameId: EMBERFIELD_MANIFEST.gameId,
  version: EMBERFIELD_KNOWLEDGE_VERSION,
  targetTypes: ["sword"],
  tags,
  authority,
  content
});

export const EMBERFIELD_KNOWLEDGE = [
  knowledge("emberfield.game.manifest", "game_manifest", ["native_inventory", "authority"], "Emberfield 玩家背包是唯一库存真相。天工读取本次选择的原生物品实例，只返回预演和结算指令，不保存玩家物品。"),
  knowledge("emberfield.material.contract", "material_ontology", ["native_material", "mapping"], `原生材料适配时必须映射 ${MATERIAL_CONTRACT.required.join("、")}。iron_ore 是结构材料；fire_shard、frost_shard、power_fragment、spirit_essence、venom_gland 和 herb_segment 是游戏原生片段。`),
  knowledge("emberfield.conservation", "conservation_policy", ["conservation", "atomic_commit"], `${CONSERVATION_LAWS.map((law) => `${law.name}：${law.description}`).join(" ")} 被提示词实际操作的消耗型材料在成功或失败时都要扣除，成品、碎片和残渣必须与扣料在同一事务完成。`, "tiangong"),
  knowledge("emberfield.weapon", "target_blueprint", ["weapon", "sword", "augment"], "当前试用目标为长剑。铁矿提供结构、伤害和稳定；火焰碎片支持燃烧；冰霜碎片支持冰冻与减速；灵魂精华支持吸血；毒腺支持中毒。生成武器写回原背包，并映射到游戏已有增幅效果。"),
  knowledge("emberfield.operations", "operation_policy", ["prompt", "operation", "sequence"], "提示词应说明材料如何被处理，例如：以铁矿塑形成剑身，将火焰碎片嵌入核心并封装，最后稳定锻打。部位、顺序、取舍和冲突处理会显著改变效率，但提示词不能凭空增加材料能力。"),
  knowledge("emberfield.failure", "settlement_policy", ["failure", "fragment", "residue"], "失败也遵守等价交换：被操作材料会转化为劣质品、Power Fragment、可回收残渣或散失热量，不返还原材料。未被提示词操作的已勾选材料不扣除。"),
  knowledge("emberfield.visual", "asset_style", ["pixel_art", "2d", "native_style"], "试用版只复用 Emberfield 已有武器图标和像素风表现；天工结果通过名称、稀有度、属性和原生增幅表达，不生成或分发新的第三方素材。")
];

export const EMBERFIELD_CONSERVATION_VIEW = {
  laws: CONSERVATION_LAWS,
  ledgers: LEDGER_DEFINITIONS,
  promptPolicy: "提示词决定操作路径和转化效率；相同输入可重复得到相同成功率，不做熟练度衰减。"
};
