import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createCraftPlan } from "../agent/planner.mjs";
import { executeCraft, GameAdapter, previewCraft } from "../shared/tiangong-core.mjs";
import { createAndGenerateAsset } from "../shared/tiangong-assets.mjs";
import { CONSERVATION_POLICY, PIXEL_PATHFINDER_MANIFEST } from "../knowledge/pixel-pathfinder.mjs";
import { EMBERFIELD_CONSERVATION_VIEW, EMBERFIELD_MANIFEST } from "../knowledge/emberfield.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};
const previewStore = new Map();
const maxRequestBodyBytes = 256 * 1024;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxRequestBodyBytes) {
        reject(new Error("请求体过大"));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("请求体不是有效 JSON"));
      }
    });
    request.on("error", reject);
  });
}

function toPreviewResponse(preview) {
  return {
    requestId: preview.requestId,
    gameId: preview.gameId,
    ruleVersion: preview.ruleVersion,
    targetType: preview.target.id,
    targetName: preview.target.name,
    effectIds: preview.effects.map((effect) => effect.id),
    effectNames: preview.effects.map((effect) => effect.name),
    quality: preview.quality,
    successRate: preview.successRate,
    promptScore: preview.intent.promptScore,
    promptLogic: preview.intent.promptLogic,
    materialMatch: preview.intent.materialMatch,
    promptSignals: preview.intent.promptSignals,
    materials: preview.materials.map((material) => ({ id: material.id, name: material.name, tags: material.tags })),
    conflict: preview.conflict,
    agent: {
      provider: preview.agentPlan?.provider || "none",
      craftType: preview.agentPlan?.craftType || "weapon_forge",
      requestedEffects: preview.agentPlan?.requestedEffects || [],
      techniques: preview.agentPlan?.techniques || [],
      materialRoles: preview.agentPlan?.materialRoles || [],
      materialOperations: preview.agentPlan?.materialOperations || [],
      knowledgeVersion: preview.agentContext?.knowledgeVersion || "",
      retrieved: preview.agentContext?.retrieved || [],
      promptContextHash: preview.agentContext?.promptContextHash || ""
    },
    materialPower: preview.materialPower,
    operationReport: preview.operationReport,
    totalBudget: preview.totalBudget,
    effectCost: preview.effectCost,
    feasible: preview.feasible,
    violations: preview.violations,
    processEfficiency: preview.processEfficiency,
    environment: preview.environment,
    balanceSheet: preview.balanceSheet,
    assetSpec: preview.assetSpec,
    outcomes: preview.failureTable,
    summary: preview.summary
  };
}

function toResultResponse(result) {
  const source = result.result;
  return {
    status: result.status,
    outcome: result.outcome,
    materialLoss: result.materialLoss,
    settlement: result.settlement,
    weapon: source ? {
      instanceId: source.instanceId,
      gameId: source.gameId,
      prototypeId: source.prototypeId,
      prototypeName: source.prototypeName,
      effectIds: source.effectIds,
      effectNames: source.effectNames,
      quality: source.quality,
      damage: source.damage,
      sourceMaterialIds: source.sourceMaterialIds,
      materialOperations: source.materialOperations,
      processSummary: source.processSummary,
      assetId: source.generatedAsset?.assetId || null,
      image2d: source.generatedAsset?.image2d || null,
      model3d: source.generatedAsset?.model3d || null,
      assetAudit: source.generatedAsset?.audit || null,
      assetSpec: source.assetSpec || null,
      ruleVersion: source.ruleVersion,
      resultSignature: source.resultSignature
    } : null
  };
}

async function handleApi(request, response, requestPath) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    });
    response.end();
    return true;
  }

  if (request.method === "GET" && requestPath === "/api/v1/config/manifest") {
    sendJson(response, 200, {
      manifests: [PIXEL_PATHFINDER_MANIFEST, EMBERFIELD_MANIFEST],
      manifest: PIXEL_PATHFINDER_MANIFEST,
      conservation: CONSERVATION_POLICY,
      emberfieldConservation: EMBERFIELD_CONSERVATION_VIEW
    });
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "只支持 POST" });
    return true;
  }

  try {
    const body = await readJsonBody(request);
    if (requestPath === "/api/v1/craft/preview") {
      const gameId = typeof body.gameId === "string" ? body.gameId : "pixel_pathfinder_tiangong_demo";
      const targetType = typeof body.targetType === "string" ? body.targetType : "sword";
      const materialIds = Array.isArray(body.materialIds) ? body.materialIds : [];
      const materials = Array.isArray(body.materials) ? body.materials : [];
      const agentContext = await createCraftPlan({
        gameId,
        targetType,
        prompt: typeof body.prompt === "string" ? body.prompt : "",
        materials
      });
      const preview = previewCraft({
        gameId,
        materialIds,
        materials,
        prompt: typeof body.prompt === "string" ? body.prompt : "",
        targetType,
        ruleVersion: typeof body.ruleVersion === "string" ? body.ruleVersion : PIXEL_PATHFINDER_MANIFEST.ruleVersion,
        agentPlan: agentContext.plan,
        agentContext,
        environment: body.environment && typeof body.environment === "object" ? body.environment : null
      });
      previewStore.set(preview.requestId, { preview, used: false, asset: null });
      sendJson(response, 200, toPreviewResponse(preview));
      return true;
    }

    if (requestPath === "/api/v1/assets/generate") {
      const record = previewStore.get(body.requestId);
      if (!record) {
        sendJson(response, 404, { error: "预览不存在或已过期" });
        return true;
      }
      if (!record.preview.feasible) {
        sendJson(response, 422, { error: "规则方案不可执行，不能生成候选资产" });
        return true;
      }
      record.asset = createAndGenerateAsset(record.preview);
      sendJson(response, record.asset.status === "APPROVED" ? 200 : 422, record.asset);
      return true;
    }

    if (requestPath === "/api/v1/craft/commit") {
      const record = previewStore.get(body.requestId);
      if (!record) {
        sendJson(response, 404, { error: "预览不存在或已过期" });
        return true;
      }
      if (record.used) {
        sendJson(response, 409, { error: "同一预览只能结算一次" });
        return true;
      }
      if (!record.asset) record.asset = createAndGenerateAsset(record.preview);
      if (record.asset.status !== "APPROVED") {
        sendJson(response, 422, { error: "候选资产未通过审核，未执行库存结算", asset: record.asset });
        return true;
      }
      record.used = true;
      const result = executeCraft(record.preview, Math.random(), record.asset);
      sendJson(response, 200, toResultResponse(result));
      return true;
    }

    sendJson(response, 404, { error: "未知天工 API" });
    return true;
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message || "请求处理失败" });
    return true;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
    if (requestPath.startsWith("/api/v1/")) {
      await handleApi(request, response, requestPath);
      return;
    }
    const wantsDirectory = requestPath.endsWith("/");
    const relativePath = (requestPath === "/" ? "/studio/" : requestPath).replace(/^[/\\]+/, "");
    const candidate = resolve(root, relativePath);
    const pathFromRoot = relative(root, candidate);
    if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const filePath = wantsDirectory || requestPath === "/" ? join(candidate, "index.html") : candidate;
    const data = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mime[extname(filePath)] || "application/octet-stream" });
    response.end(data);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error.code === "ENOENT" ? "Not found" : "Server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`天工原型服务器已启动：http://localhost:${port}`);
  console.log(`厂商客户端：http://localhost:${port}/studio/`);
  console.log(`游戏内原型：http://localhost:${port}/game/`);
});
