import assert from "node:assert/strict";
import { DEMO_MATERIALS, previewCraft } from "../shared/tiangong-core.mjs";

const selected = DEMO_MATERIALS.filter((material) => ["iron_ore", "fire_core"].includes(material.id));
const valid = previewCraft({ materials: selected, targetType: "sword", prompt: "先以精铁矿为骨塑形成剑身，再把火焰核心嵌入核心并封装，最后稳定锻打；只保留持续燃烧，牺牲爆发换取稳定。" });
assert.equal(valid.intent.promptLogic.status, "VALID");
assert.equal(valid.successRate, 1);

const wrongOrder = previewCraft({ materials: selected, targetType: "sword", prompt: "先把火焰核心嵌入核心并封装，最后以精铁矿塑形成剑身，目标持续燃烧。" });
assert.equal(wrongOrder.intent.promptLogic.status, "INVALID");
assert.equal(wrongOrder.successRate, 0);

const contradictory = previewCraft({ materials: selected, targetType: "sword", prompt: "以精铁矿塑形成剑身，把火焰核心嵌入核心；需要持续燃烧，同时禁止燃烧。" });
assert.equal(contradictory.intent.promptLogic.status, "INVALID");
assert.equal(contradictory.successRate, 0);

console.log("天工提示词逻辑测试通过：因果顺序、材料工序兼容与语义矛盾审计均正常。");
