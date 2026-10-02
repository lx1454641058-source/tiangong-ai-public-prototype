import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 4174;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["scripts/dev-server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdio: "ignore"
});

async function waitForServer() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/studio/`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("天工 API 测试服务器启动超时");
}

try {
  await waitForServer();
  const manifestResponse = await fetch(`${baseUrl}/api/v1/config/manifest`);
  assert.equal(manifestResponse.status, 200, "厂商客户端必须能读取接入清单");
  const manifestPayload = await manifestResponse.json();
  assert.equal(manifestPayload.manifest.ruleVersion, "forge_conservation_v2", "接入清单必须发布守恒规则版本");
  assert.equal(Object.keys(manifestPayload.conservation.ledgers).length, 5, "接入清单必须公开五套账本定义");
  const request = {
    gameId: "pixel_pathfinder_tiangong_demo",
    playerId: "api_test_player",
    targetType: "sword",
    materialIds: ["native:equipment:weapon"],
    materials: [{
      id: "native:equipment:weapon",
      name: "炎纹短剑",
      tags: ["fire", "weapon", "native"],
      promptKeywords: ["炎纹短剑", "火焰", "炎纹"],
      power: 30,
      supportedEffects: ["burn", "damage", "stability"]
    }],
    prompt: "以炎纹短剑为核心，封装火焰，持续燃烧，牺牲爆发换取稳定。",
    ruleVersion: "forge_rules_v1",
    inventoryRevision: 1
  };

  const previewResponse = await fetch(`${baseUrl}/api/v1/craft/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });
  assert.equal(previewResponse.status, 200, "预览 API 必须成功");
  const preview = await previewResponse.json();
  assert.ok(preview.requestId, "预览必须返回 requestId");
  assert.equal(preview.materials[0].id, "native:equipment:weapon", "API 必须保留游戏原生材料 ID");
  assert.equal(preview.materials[0].name, "炎纹短剑", "API 必须返回游戏原生材料名称");
  assert.equal(preview.agent.provider, "mock-rag-agent", "API 必须返回 Agent 模型来源");
  assert.ok(preview.agent.retrieved.length > 0, "API 必须返回 RAG 检索轨迹");
  assert.ok(preview.agent.materialOperations.length > 0, "API 必须返回按提示词生成的材料操作");
  assert.ok(preview.operationReport.steps.every((step) => step.materialIds.includes("native:equipment:weapon")), "API 操作步骤必须绑定游戏原生材料");
  assert.ok(Array.isArray(preview.effectIds), "预览必须返回效果白名单");
  assert.ok(preview.successRate >= 0 && preview.successRate <= 1, "API 成功率必须在0%到100%范围内");
  assert.ok(preview.balanceSheet?.matter?.balanced, "API 预览必须返回物质守恒账本");
  assert.ok(preview.balanceSheet?.energy?.balanced, "API 预览必须返回能量守恒账本");
  assert.equal(preview.assetSpec?.version, "asset_spec_v1", "API 预览必须返回资产规格");
  assert.ok(preview.assetSpec?.hardRules?.some((rule) => rule.includes("不得复用")), "资产规格必须禁止复用原图与原模型");

  const assetResponse = await fetch(`${baseUrl}/api/v1/assets/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: preview.requestId })
  });
  assert.equal(assetResponse.status, 200, "资产生成 API 必须成功");
  const asset = await assetResponse.json();
  assert.equal(asset.status, "APPROVED", "候选资产必须通过原型审核");
  assert.ok(asset.image2d?.dataUri?.startsWith("data:image/svg+xml"), "API 必须返回全新 2D 图像");
  assert.ok(asset.model3d?.dataUri?.startsWith("data:model/obj"), "API 必须返回可下载的 3D OBJ 模型");
  assert.equal(asset.audit.sourceAssetBinaryReused, false, "API 资产不得复用源文件");

  const commitResponse = await fetch(`${baseUrl}/api/v1/craft/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: preview.requestId })
  });
  assert.equal(commitResponse.status, 200, "提交 API 必须成功");
  const result = await commitResponse.json();
  assert.ok(["completed", "failed"].includes(result.status), "提交必须返回明确状态");
  assert.ok(result.status === "completed" ? result.weapon?.resultSignature : result.materialLoss, "结果必须带签名或材料损失");
  assert.ok(result.settlement?.consumedMaterialIds?.length > 0, "提交必须返回可由游戏执行的材料消耗清单");
  assert.ok(result.settlement.conservation, "提交必须返回材料守恒说明");
  assert.ok(Object.values(result.settlement.balanceSheet.audits).every(Boolean), "提交必须返回通过的守恒审计");
  if (result.status === "completed") {
    assert.ok(result.weapon.materialOperations.length > 0, "成功成品必须保留材料工序");
    assert.equal(result.weapon.assetId, asset.assetId, "成品必须绑定已审核的候选资产");
    assert.ok(result.weapon.image2d?.contentHash, "成品必须返回新图像引用");
    assert.ok(result.weapon.model3d?.contentHash, "成品必须返回新模型引用");
  }

  const duplicateResponse = await fetch(`${baseUrl}/api/v1/craft/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: preview.requestId })
  });
  assert.equal(duplicateResponse.status, 409, "同一个预览不能重复结算");
  console.log("天工 API 冒烟测试通过：预览、结算和单次结算约束均正常。");
} finally {
  server.kill();
}
