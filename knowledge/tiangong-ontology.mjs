// SPDX-License-Identifier: MIT
// 天工通用知识本体：描述所有接入游戏都必须遵守的语义和守恒边界。

export const TIANGONG_ONTOLOGY_VERSION = "tiangong_ontology_v1";

export const CONSERVATION_LAWS = [
  { id: "matter_destination", name: "物质有去向", description: "被操作的材料必须进入成品、副产物、残渣或逸散物，不能静默删除。" },
  { id: "capability_source", name: "能力有来源", description: "成品属性不能超过材料潜能、外部能源和已登记转化规则提供的上限。" },
  { id: "operation_cost", name: "操作有代价", description: "每个制造操作都需要能源、工具能力、时间或耐久成本。" },
  { id: "information_not_matter", name: "信息不造物", description: "提示词只决定路径、分配和效率，不能直接创造物质、能量或属性。" },
  { id: "closed_loop_no_gain", name: "闭环不增值", description: "合成、分解和再合成形成的闭环不能增加守恒量或可交易价值。" }
];

export const LEDGER_DEFINITIONS = {
  matter: { name: "物质账本", unit: "MU", invariant: "输入物质 = 成品 + 副产物 + 残渣 + 逸散物" },
  energy: { name: "能量账本", unit: "EU", invariant: "材料储能 + 外部供能 = 成品储能 + 工序做功 + 散失热量" },
  traits: { name: "属性潜能账本", unit: "TP", invariant: "输出属性不得超过输入潜能经过合法转化后的上限" },
  value: { name: "游戏价值账本", unit: "VU", invariant: "输出总价值不得超过输入、能源和工具损耗允许的价值" },
  entropy: { name: "复杂度账本", unit: "EP", invariant: "工序和冲突增加复杂度，技术、炉具与明确提示词降低可控损耗" }
};

export const MATERIAL_CONTRACT = {
  required: ["id", "name", "quantity", "matterUnits", "traits", "valueUnits", "kind"],
  optional: ["storedEnergy", "purity", "state", "tags", "promptKeywords", "supportedEffects", "consumeAmount", "color"],
  kinds: ["consumable", "catalyst", "tool"],
  states: ["solid", "liquid", "gas", "energy", "composite"]
};

export const PROCESS_PLAN_CONTRACT = {
  modelMayDecide: ["目标意图", "材料分工", "操作顺序", "作用部位", "取舍", "保底策略", "外观配方"],
  modelMustNotDecide: ["成功率", "最终数值", "库存扣除", "守恒豁免", "未登记材料", "未登记操作", "未登记效果"]
};
