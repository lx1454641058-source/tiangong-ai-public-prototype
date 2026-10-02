import assert from "node:assert/strict";
import { EFFECTS, GameAdapter, previewCraft, executeCraft } from "../shared/tiangong-core.mjs";

const input = {
  materialIds: ["fire_core", "iron_ore"],
  prompt: "以精铁矿塑形成剑身，把火焰核心嵌入核心，目标持续燃烧。",
  targetType: "sword",
  ruleVersion: "forge_rules_v1"
};

const first = previewCraft(input);
const second = previewCraft(input);
assert.equal(first.intent.promptScore, second.intent.promptScore, "同条件提示词评分必须稳定");
assert.equal(first.successRate, second.successRate, "同条件显示成功率必须稳定");
assert.deepEqual(first.effects.map((effect) => effect.id), second.effects.map((effect) => effect.id), "同条件结果方向必须稳定");
assert.deepEqual(first.failureTable, second.failureTable, "同条件结果分布必须稳定");
assert.ok(first.successRate >= 0.05 && first.successRate <= 0.95, "成功率必须在安全范围内");
assert.ok(first.effects.every((effect) => Object.hasOwn(EFFECTS, effect.id)), "效果必须来自白名单");
assert.ok(first.effectCost >= 0, "预算计算不能出现负数");
assert.ok(Math.abs(first.failureTable.reduce((sum, entry) => sum + entry.probability, 0) - 1) < 0.000001, "结果分布必须合计为100%");
assert.ok(Object.values(first.balanceSheet.audits).every(Boolean), "预览必须通过五账本守恒检查");

const focusedPrompt = previewCraft({
  ...input,
  materialIds: ["fire_core", "iron_ore"],
  prompt: "以精铁为骨，以火焰核心为刃；用封装和分层稳定燃烧，持续命中，牺牲爆发换取稳定。"
});
const vaguePrompt = previewCraft({
  ...input,
  materialIds: ["fire_core", "iron_ore"],
  prompt: "随便做一把普通长剑。"
});
assert.equal(focusedPrompt.successRate, 1, "结构完整且材料匹配的提示词应达到100%成功率");
assert.equal(vaguePrompt.successRate, 0, "空泛提示词应为0%成功率");
assert.ok(focusedPrompt.quality > vaguePrompt.quality + 70, "提示词质量应显著拉开成品品质");
assert.notDeepEqual(focusedPrompt.effects, vaguePrompt.effects, "不同提示词应改变效果方向");
assert.deepEqual(focusedPrompt.operationReport.operatedMaterialIds.sort(), ["fire_core", "iron_ore"], "明确写入工序的材料必须全部参与成品");
assert.deepEqual(focusedPrompt.operationReport.steps.map((step) => step.action), ["form_base", "infuse_edge", "encapsulate", "isolate", "temper"], "规则引擎必须按提示词顺序执行塑形、融刃、封装、分层和稳定");

const ironOnlyPrompt = previewCraft({
  ...input,
  materialIds: ["fire_core", "iron_ore"],
  prompt: "以精铁矿为骨，反复锻打并淬炼，只追求锋利伤害。"
});
const fireOnlyPrompt = previewCraft({
  ...input,
  materialIds: ["fire_core", "iron_ore"],
  prompt: "以火焰核心为刃，用封装手法引导持续燃烧。"
});
assert.deepEqual(ironOnlyPrompt.operationReport.operatedMaterialIds, ["iron_ore"], "只操作精铁时火焰核心不能偷偷参与成品");
assert.deepEqual(fireOnlyPrompt.operationReport.operatedMaterialIds, ["fire_core"], "只操作火焰核心时精铁不能偷偷参与成品");
assert.ok(ironOnlyPrompt.effects.some((effect) => effect.id === "damage") && !ironOnlyPrompt.effects.some((effect) => effect.id === "burn"), "精铁工序应产出伤害方向而不是燃烧方向");
assert.ok(fireOnlyPrompt.effects.some((effect) => effect.id === "burn") && !fireOnlyPrompt.effects.some((effect) => effect.id === "damage"), "火核工序应产出燃烧方向而不是精铁伤害方向");
assert.notEqual(ironOnlyPrompt.materialPower, focusedPrompt.materialPower, "不同材料操作必须改变实际材料贡献值");

const assistedPrompt = previewCraft({
  ...input,
  materialIds: ["fire_core", "iron_ore"],
  prompt: "制作一把能够持续燃烧的火焰剑。"
});
assert.equal(assistedPrompt.intent.assisted, true, "简单目标必须由厂商登记的基础工艺辅助完成");
assert.ok(assistedPrompt.successRate >= 0.45 && assistedPrompt.successRate < focusedPrompt.successRate, "简单提示词应可用，但详细工艺必须明显占优");

const impossiblePrompt = previewCraft({
  ...input,
  materialIds: ["iron_ore"],
  prompt: "把精铁矿塑形成火焰剑并持续燃烧。"
});
assert.equal(impossiblePrompt.successRate, 0, "提示词不能凭空创造材料没有的火焰潜能");

const nativeMaterialPreview = previewCraft({
  materialIds: ["native:item:ember-sword"],
  materials: [{
    id: "native:item:ember-sword",
    name: "炎纹短剑",
    tags: ["fire", "weapon", "native"],
    promptKeywords: ["炎纹短剑", "火焰", "炎纹"],
    power: 30,
    supportedEffects: ["burn", "damage"]
  }],
  prompt: "以炎纹短剑为核心，封装火焰，持续燃烧。",
  targetType: "sword"
});
assert.equal(nativeMaterialPreview.materialIds[0], "native:item:ember-sword", "天工必须保留游戏原生材料 ID");
assert.equal(nativeMaterialPreview.materials[0].name, "炎纹短剑", "天工必须使用适配器传入的原生材料描述");
assert.ok(nativeMaterialPreview.intent.promptScore > 0, "原生材料也必须参与提示词评定");
const nativeRequest = GameAdapter.toTianGongRequest({
  selectedMaterials: [{ id: "native:item:ember-sword" }],
  nativeMaterials: nativeMaterialPreview.materials,
  prompt: "以炎纹短剑为核心，封装火焰，持续燃烧。",
  targetType: "sword",
  player: { id: "native_player", ruleVersion: "forge_rules_v1", inventoryRevision: "native-v1" }
});
assert.deepEqual(nativeRequest.materialIds, ["native:item:ember-sword"], "适配器必须传递原生材料 ID");
assert.equal(nativeRequest.materials[0].name, "炎纹短剑", "适配器必须传递原生材料描述");

const success = executeCraft(first, 0.01);
assert.equal(success.status, "completed", "低随机值应得到成功结果");
assert.deepEqual(success.settlement.consumedMaterialIds.sort(), first.operationReport.operatedMaterialIds.sort(), "成功结算必须消耗全部被操作材料");
assert.equal(success.settlement.preservedMaterials.length, 0, "成功结算不能复制保留投入材料");
const gameItem = GameAdapter.toGameItem(success.result);
assert.ok(gameItem.itemId.startsWith("item_"), "游戏适配器必须生成游戏实例ID");
assert.equal(gameItem.signature.startsWith("tg_conservation_"), true, "结果应带天工守恒签名");
assert.ok(Object.values(success.settlement.balanceSheet.audits).every(Boolean), "成功结算必须通过守恒审计");

const failed = executeCraft(first, 0.99);
assert.equal(failed.status, "failed", "高随机值应得到失败结果");
assert.ok(failed.materialLoss, "失败必须明确材料损失");
assert.ok(failed.settlement.consumedMaterialIds.length > 0, "失败结算也必须明确实际消耗的材料");

function randomInsideOutcome(preview, label) {
  let cursor = 0;
  for (const entry of preview.failureTable) {
    if (entry.label === label && entry.probability > 0) return cursor + entry.probability / 2;
    cursor += entry.probability;
  }
  throw new Error(`测试结果分布中不存在：${label}`);
}

const scrap = executeCraft(first, randomInsideOutcome(first, "碎片与残渣"));
assert.equal(scrap.outcome, "碎片与残渣", "部分失败必须进入碎片结算路径");
assert.ok(scrap.settlement.fragment?.amount > 0, "垃圾结果必须返还精粹碎片");
assert.equal(scrap.settlement.consumedMaterials.length, first.operationReport.operatedMaterialIds.length, "失败也必须消耗全部被操作的消耗型材料，避免材料复制");
assert.equal(scrap.settlement.balanceSheet.matter.product + scrap.settlement.balanceSheet.matter.byproducts, scrap.settlement.balanceSheet.matter.input, "失败后的成品与副产物必须等于输入物质");

console.log("天工原型冒烟测试通过：一致性、白名单、成功和失败路径均正常。");
