// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 4175;
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
      const response = await fetch(`${baseUrl}/api/v1/config/manifest`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("Emberfield 天工测试服务器启动超时");
}

const materials = [
  {
    id: "emberfield:slot:3:iron_ore",
    name: "铁矿",
    quantity: 23,
    consumeAmount: 1,
    matterUnits: 12,
    storedEnergy: 0,
    valueUnits: 12,
    traits: { damage: 13, stability: 12 },
    tags: ["metal", "stable"],
    supportedEffects: ["damage", "stability"],
    promptKeywords: ["铁矿", "铁", "金属"]
  },
  {
    id: "emberfield:slot:10:fire_shard",
    name: "火焰碎片",
    quantity: 5,
    consumeAmount: 1,
    matterUnits: 5,
    storedEnergy: 8,
    valueUnits: 15,
    traits: { fire: 13, explosion: 7, stability: 2 },
    tags: ["fire", "energy", "unstable"],
    supportedEffects: ["burn", "explosion"],
    promptKeywords: ["火焰碎片", "火焰", "燃烧"]
  }
];

async function preview(prompt) {
  const response = await fetch(`${baseUrl}/api/v1/craft/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gameId: "emberfield_tiangong_local_test",
      targetType: "sword",
      ruleVersion: "forge_conservation_v2",
      materialIds: materials.map((material) => material.id),
      materials,
      prompt
    })
  });
  assert.equal(response.status, 200);
  return response.json();
}

try {
  await waitForServer();
  const precise = await preview("先以铁矿为骨塑形成剑身，再将火焰碎片嵌入核心并封装，最后对火焰碎片稳定锻打；只保留持续燃烧，牺牲爆发换取稳定。");
  const vague = await preview("随便把这些材料炼成越强越好的武器。");

  assert.equal(precise.gameId, "emberfield_tiangong_local_test");
  assert.equal(precise.agent.knowledgeVersion, "emberfield_knowledge_v1", "必须使用 Emberfield 专属知识包");
  assert.ok(precise.agent.retrieved.some((entry) => entry.id.startsWith("emberfield.")), "RAG 必须检索 Emberfield 游戏事实");
  assert.equal(precise.successRate, 1, "完整材料工艺应能达到 100% 成功率");
  assert.equal(vague.successRate, 0, "含糊且不可执行的提示词应降到 0% 成功率");
  assert.equal(precise.operationReport.coverage, 100, "两个原生材料都必须被提示词操作");

  const commitResponse = await fetch(`${baseUrl}/api/v1/craft/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: precise.requestId })
  });
  assert.equal(commitResponse.status, 200);
  const committed = await commitResponse.json();
  assert.deepEqual(
    committed.settlement.consumedMaterialIds.slice().sort(),
    materials.map((material) => material.id).sort(),
    "结算必须逐一返回被操作的 Emberfield 原生材料实例"
  );
  assert.ok(Object.values(committed.settlement.balanceSheet.audits).every(Boolean), "结算必须通过全部守恒审计");
  console.log("Emberfield 接入测试通过：提示词产生 0%→100% 差异，RAG、原生材料结算和五账本均生效。");
} finally {
  server.kill();
}
