import assert from "node:assert/strict";
import { createCraftPlan } from "../agent/planner.mjs";
import { retrieveKnowledge } from "../agent/rag.mjs";
import { previewCraft } from "../shared/tiangong-core.mjs";

const materials = [{
  id: "native:equipment:weapon",
  name: "炎纹短剑",
  tags: ["fire", "weapon", "native"],
  promptKeywords: ["炎纹短剑", "火焰", "炎纹"],
  power: 30,
  supportedEffects: ["burn", "damage", "stability"]
}];

const prompt = "以炎纹短剑为核心，用封装和分层稳定燃烧，持续命中，牺牲爆发换取稳定。";
const retrieved = retrieveKnowledge({
  gameId: "pixel_pathfinder_tiangong_demo",
  targetType: "sword",
  prompt,
  materials
});
assert.ok(retrieved.length >= 3, "RAG 必须检索到多个当前游戏知识文档");
assert.ok(retrieved.every((document) => document.gameId === "pixel_pathfinder_tiangong_demo"), "RAG 不能跨游戏检索");
assert.ok(retrieved.some((document) => document.id === "pp.target.sword"), "RAG 必须命中长剑目标规则");

const agentContext = await createCraftPlan({
  gameId: "pixel_pathfinder_tiangong_demo",
  targetType: "sword",
  prompt,
  materials
});
assert.equal(agentContext.provider, "mock-rag-agent", "无模型配置时必须使用可测试的 Mock Agent");
assert.ok(agentContext.plan.requestedEffects.includes("burn"), "Agent 必须把燃烧意图映射为效果 ID");
assert.equal(agentContext.plan.materialRoles[0].materialId, "native:equipment:weapon", "Agent 只能引用提交的原生材料");
assert.ok(agentContext.plan.materialOperations.length >= 2, "Agent 必须把提示词转换成多步材料操作");
assert.ok(agentContext.plan.materialOperations.every((operation) => operation.materialIds.includes("native:equipment:weapon")), "每一步操作必须绑定原生材料 ID");
assert.ok(agentContext.retrieved.length > 0, "Agent 上下文必须保留 RAG 检索轨迹");

const preview = previewCraft({
  materialIds: materials.map((material) => material.id),
  materials,
  prompt,
  targetType: "sword",
  agentPlan: agentContext.plan,
  agentContext
});
assert.ok(preview.successRate > 0.8, "完整提示词经过 Agent 后应保持较高成功率");
assert.equal(preview.agentPlan.provider, "mock-rag-agent", "预览必须保留模型来源");
assert.ok(preview.operationReport.steps.some((step) => step.action === "embed_core"), "规则引擎必须执行“以材料为核心”操作");
assert.equal(preview.operationReport.operatedMaterialIds[0], "native:equipment:weapon", "只有被提示词操作的材料才能参与成品");

const vagueContext = await createCraftPlan({
  gameId: "pixel_pathfinder_tiangong_demo",
  targetType: "sword",
  prompt: "随便做一把普通长剑。",
  materials
});
const vaguePreview = previewCraft({
  materialIds: materials.map((material) => material.id),
  materials,
  prompt: "随便做一把普通长剑。",
  targetType: "sword",
  agentPlan: vagueContext.plan,
  agentContext: vagueContext
});
assert.equal(vaguePreview.successRate, 0, "Agent 不能替空泛提示词自动补全出成功率");
assert.equal(vaguePreview.operationReport.assisted, true, "Agent 可以提出基础工艺，但规则引擎必须继续阻止空泛目标");

const simpleContext = await createCraftPlan({
  gameId: "pixel_pathfinder_tiangong_demo",
  targetType: "sword",
  prompt: "制作一把持续燃烧的火焰剑。",
  materials
});
const simplePreview = previewCraft({ materialIds: materials.map((material) => material.id), materials, prompt: "制作一把持续燃烧的火焰剑。", targetType: "sword", agentPlan: simpleContext.plan, agentContext: simpleContext });
assert.equal(simplePreview.operationReport.assisted, true, "目标明确的简单提示词应使用厂商基础工艺");
assert.ok(simplePreview.successRate > 0 && simplePreview.successRate < preview.successRate, "基础工艺应降低思考量，但详细提示词仍应获得更高效率");

console.log("天工 RAG/Agent 测试通过：知识隔离、计划生成和规则裁决链路正常。");
