import { createAssistedMaterialOperations, EFFECTS, MATERIAL_OPERATIONS, inferMaterialOperations } from "../shared/tiangong-core.mjs";
import { PIXEL_PATHFINDER_KNOWLEDGE_VERSION } from "../knowledge/pixel-pathfinder.mjs";
import { EMBERFIELD_KNOWLEDGE_VERSION, EMBERFIELD_MANIFEST } from "../knowledge/emberfield.mjs";
import { buildKnowledgeContext, retrieveKnowledge } from "./rag.mjs";

function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

function inferTechniques(prompt) {
  return [
    ...(containsAny(prompt, ["包裹", "封装"]) ? ["封装"] : []),
    ...(containsAny(prompt, ["隔离", "分层"]) ? ["隔离"] : []),
    ...(containsAny(prompt, ["引导", "通道"]) ? ["能量引导"] : [])
  ];
}

function inferEffects(prompt, materials, targetType) {
  return Object.values(EFFECTS)
    .filter((effect) => containsAny(prompt, effect.keywords))
    .map((effect) => effect.id);
}

function createMockPlan({ gameId, prompt, targetType, materials, retrieved }) {
  const normalizedPrompt = String(prompt || "").trim().toLowerCase();
  const requestedEffects = inferEffects(normalizedPrompt, materials, targetType);
  const explicitOperations = inferMaterialOperations(normalizedPrompt, materials);
  const materialOperations = explicitOperations.length
    ? explicitOperations
    : createAssistedMaterialOperations(normalizedPrompt, materials, requestedEffects);
  const materialRoles = materials
    .map((material) => {
      const actions = materialOperations
        .filter((operation) => operation.materialIds.includes(material.id))
        .map((operation) => operation.action);
      const role = actions.includes("form_base") ? "base"
        : actions.includes("embed_core") ? "energy_core"
          : actions.includes("infuse_edge") ? "edge"
            : actions.length ? "processed_material" : "unused";
      return { materialId: material.id, role };
    });
  const tradeoffs = containsAny(normalizedPrompt, ["牺牲", "换取", "降低", "取舍", "稳定"])
    ? ["按提示词降低爆发或范围，换取稳定性"]
    : [];
  return {
    provider: "mock-rag-agent",
    craftType: "weapon_forge",
    targetType,
    requestedEffects,
    materialRoles,
    materialOperations,
    techniques: inferTechniques(normalizedPrompt),
    tradeoffs,
    visualRecipe: {
      style: gameId === EMBERFIELD_MANIFEST.gameId ? "emberfield_pixel" : "pixel_pathfinder",
      base: `${targetType}_base`,
      accent: requestedEffects[0] || "damage",
      palette: containsAny(normalizedPrompt, ["火焰", "燃烧"]) ? "fire_metal" : "native_game"
    },
    warnings: retrieved.length ? [] : ["没有检索到适用的游戏知识"]
  };
}

function buildModelMessages({ targetType, prompt, materials, retrieved }) {
  return [
    {
      role: "system",
      content: "你是天工游戏内容规划 Agent。你必须把玩家提示词转换成按顺序执行、绑定具体原生材料 ID 的 materialOperations。玩家只表达目标时，可以引用知识库中登记的基础工艺并标记 assisted=true。你只能根据检索知识和当前材料生成 JSON。不要生成成功率、物质能量数值、库存操作、未登记动作、未登记材料或未登记效果。"
    },
    {
      role: "user",
      content: JSON.stringify({
        targetType,
        playerPrompt: prompt,
        nativeMaterials: materials,
        retrievedKnowledge: buildKnowledgeContext(retrieved),
        outputSchema: {
          craftType: "weapon_forge",
          targetType,
          requestedEffects: ["effect_id"],
          materialRoles: [{ materialId: "native_material_id", role: "role" }],
          materialOperations: [{ order: 1, action: "registered_operation_id", materialIds: ["native_material_id"], purpose: "玩家希望达到的目的", sourceText: "对应的提示词片段或系统基础工艺", assisted: false }],
          allowedMaterialOperations: Object.values(MATERIAL_OPERATIONS).map((operation) => ({ id: operation.id, name: operation.name })),
          techniques: ["technique"],
          tradeoffs: ["tradeoff"],
          visualRecipe: { style: "style_id", base: "base_id", accent: "effect_id", palette: "palette_id" },
          warnings: ["warning"]
        }
      })
    }
  ];
}

function validatePlan(plan, { targetType, materials }) {
  if (!plan || typeof plan !== "object") throw new Error("模型没有返回合成计划");
  if (plan.targetType !== targetType) throw new Error("模型返回了错误的目标类型");
  const materialIds = new Set(materials.map((material) => material.id));
  const allowedEffects = new Set(Object.keys(EFFECTS));
  const requestedEffects = Array.isArray(plan.requestedEffects) ? plan.requestedEffects.map(String) : [];
  const invalidEffects = requestedEffects.filter((effectId) => !allowedEffects.has(effectId));
  if (invalidEffects.length) throw new Error(`模型返回了未登记效果：${invalidEffects.join(",")}`);
  const materialRoles = Array.isArray(plan.materialRoles) ? plan.materialRoles : [];
  if (materialRoles.some((entry) => !materialIds.has(String(entry.materialId)))) {
    throw new Error("模型引用了未提交的原生材料");
  }
  const rawOperations = Array.isArray(plan.materialOperations) ? plan.materialOperations.slice(0, 12) : [];
  const materialOperations = rawOperations.map((operation, index) => {
    const action = String(operation?.action || "");
    if (!Object.hasOwn(MATERIAL_OPERATIONS, action)) throw new Error(`模型返回了未登记材料操作：${action || "空操作"}`);
    const operationMaterialIds = [...new Set(Array.isArray(operation.materialIds) ? operation.materialIds.map(String) : [])];
    if (!operationMaterialIds.length || operationMaterialIds.some((materialId) => !materialIds.has(materialId))) {
      throw new Error("模型的材料操作引用了未提交的原生材料");
    }
    return {
      order: index + 1,
      action,
      actionName: MATERIAL_OPERATIONS[action].name,
      materialIds: operationMaterialIds,
      purpose: String(operation.purpose || "").slice(0, 160),
      sourceText: String(operation.sourceText || "").slice(0, 160),
      assisted: Boolean(operation.assisted)
    };
  });
  return {
    provider: String(plan.provider || "model"),
    craftType: String(plan.craftType || "weapon_forge"),
    targetType,
    requestedEffects: [...new Set(requestedEffects)],
    materialRoles,
    materialOperations,
    techniques: Array.isArray(plan.techniques) ? plan.techniques.map(String).slice(0, 5) : [],
    tradeoffs: Array.isArray(plan.tradeoffs) ? plan.tradeoffs.map(String).slice(0, 3) : [],
    visualRecipe: plan.visualRecipe && typeof plan.visualRecipe === "object" ? plan.visualRecipe : {},
    warnings: Array.isArray(plan.warnings) ? plan.warnings.map(String).slice(0, 5) : []
  };
}

async function callCompatibleModel({ messages }) {
  const modelUrl = process.env.TIANGONG_MODEL_URL || "";
  const modelName = process.env.TIANGONG_MODEL_NAME || "";
  const apiKey = process.env.TIANGONG_MODEL_API_KEY || "";
  if (!modelUrl || !modelName) throw new Error("未配置 TIANGONG_MODEL_URL 或 TIANGONG_MODEL_NAME");
  const response = await fetch(modelUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({ model: modelName, temperature: 0.2, response_format: { type: "json_object" }, messages })
  });
  if (!response.ok) throw new Error(`模型服务返回 HTTP ${response.status}`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("模型响应缺少 JSON 内容");
  return JSON.parse(content);
}

export async function createCraftPlan({ gameId = "pixel_pathfinder_tiangong_demo", targetType = "sword", prompt = "", materials = [], limit = 5 }) {
  const retrieved = retrieveKnowledge({ gameId, targetType, prompt, materials, limit });
  const messages = buildModelMessages({ targetType, prompt, materials, retrieved });
  const requestedProvider = process.env.TIANGONG_MODEL_PROVIDER || "mock";
  const rawPlan = requestedProvider === "mock"
    ? createMockPlan({ gameId, prompt, targetType, materials, retrieved })
    : await callCompatibleModel({ messages });
  const plan = validatePlan(rawPlan, { targetType, materials });
  return {
    plan,
    knowledgeVersion: gameId === EMBERFIELD_MANIFEST.gameId ? EMBERFIELD_KNOWLEDGE_VERSION : PIXEL_PATHFINDER_KNOWLEDGE_VERSION,
    retrieved: retrieved.map((document) => ({ id: document.id, type: document.type, score: document.retrievalScore })),
    provider: plan.provider,
    promptContextHash: Buffer.from(JSON.stringify({ targetType, prompt, materialIds: materials.map((material) => material.id), docs: retrieved.map((document) => document.id) })).toString("base64url")
  };
}
