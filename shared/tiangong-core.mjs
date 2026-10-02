// SPDX-License-Identifier: MIT
// 天工守恒规则引擎：模型规划工序，确定性代码核算物质、能量、属性、价值与复杂度。
import {
  CONSERVATION_POLICY,
  EFFECT_REGISTRY,
  OPERATION_REGISTRY,
  PIXEL_PATHFINDER_MANIFEST,
  PIXEL_PATHFINDER_RULE_VERSION,
  TARGET_BLUEPRINTS
} from "../knowledge/pixel-pathfinder.mjs";
import { createAndGenerateAsset, createAssetSpec } from "./tiangong-assets.mjs";

export const GAME_ID = PIXEL_PATHFINDER_MANIFEST.gameId;
export const EFFECTS = Object.fromEntries(Object.entries(EFFECT_REGISTRY).map(([id, effect]) => [id, { ...effect, cost: effect.requirement }]));
export const PROTOTYPES = TARGET_BLUEPRINTS;
export const MATERIAL_OPERATIONS = OPERATION_REGISTRY;

export const DEMO_MATERIALS = [
  { id: "fire_core", name: "火焰核心", quantity: 1, matterUnits: 6, storedEnergy: 10, traits: { fire: 14, explosion: 8, stability: 1 }, valueUnits: 18, purity: 0.9, state: "energy", kind: "consumable", tags: ["fire", "energy", "unstable"], promptKeywords: ["火焰核心", "火焰", "烈焰", "火"], supportedEffects: ["burn", "explosion"], color: "#ff7a45" },
  { id: "frost_shard", name: "寒冰碎片", quantity: 1, matterUnits: 5, storedEnergy: 4, traits: { frost: 13, control: 9, stability: 3 }, valueUnits: 15, purity: 0.86, state: "solid", kind: "consumable", tags: ["frost", "control"], promptKeywords: ["寒冰碎片", "寒冰", "冰冻", "冰"], supportedEffects: ["freeze", "slow"], color: "#78d8ff" },
  { id: "bat_blood", name: "蝙蝠血液", quantity: 1, matterUnits: 5, storedEnergy: 3, traits: { life: 12, poison: 8, stability: 2 }, valueUnits: 16, purity: 0.78, state: "liquid", kind: "consumable", tags: ["life", "dark"], promptKeywords: ["蝙蝠血液", "蝙蝠", "血液", "生命"], supportedEffects: ["life_steal", "poison"], color: "#d66cff" },
  { id: "iron_ore", name: "精铁矿", quantity: 1, matterUnits: 12, storedEnergy: 0, traits: { damage: 13, stability: 12 }, valueUnits: 12, purity: 0.82, state: "solid", kind: "consumable", tags: ["metal", "stable"], promptKeywords: ["精铁矿", "精铁", "铁", "金属"], supportedEffects: ["damage", "stability"], color: "#9ba8b5" },
  { id: "wind_feather", name: "风之羽", quantity: 1, matterUnits: 3, storedEnergy: 5, traits: { wind: 12, speed: 11, stability: 2 }, valueUnits: 14, purity: 0.88, state: "solid", kind: "consumable", tags: ["wind", "speed"], promptKeywords: ["风之羽", "羽毛", "风", "迅捷"], supportedEffects: ["projectile", "attack_speed"], color: "#baf2d2" },
  { id: "arcane_dust", name: "奥术粉尘", quantity: 1, matterUnits: 4, storedEnergy: 8, traits: { wind: 7, explosion: 11, stability: 3 }, valueUnits: 17, purity: 0.84, state: "solid", kind: "consumable", tags: ["magic", "energy"], promptKeywords: ["奥术粉尘", "奥术", "魔法", "能量"], supportedEffects: ["projectile", "explosion"], color: "#ae92ff" }
];

export const MATERIALS = DEMO_MATERIALS;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, precision = 2) => Number(Number(value).toFixed(precision));
const containsAny = (text, words) => words.some((word) => text.includes(word));
const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);

function fallbackTraits(material) {
  const traits = {};
  for (const effectId of material.supportedEffects || []) {
    const effect = EFFECTS[effectId];
    if (effect) traits[effect.trait] = Math.max(traits[effect.trait] || 0, effect.requirement);
  }
  return traits;
}

function normalizeMaterial(material, index) {
  if (!material || typeof material !== "object") return null;
  const id = String(material.id ?? `external:${index}`);
  const name = String(material.name ?? id);
  const supportedEffects = Array.isArray(material.supportedEffects) ? material.supportedEffects.map(String).filter((id) => EFFECTS[id]) : [];
  const legacyPower = Math.max(0, Number(material.power) || 0);
  const traits = Array.isArray(material.traits)
    ? Object.fromEntries(material.traits.map((entry) => [String(entry.id || entry.trait || ""), Math.max(0, Number(entry.amount ?? entry.value) || 0)]).filter(([key]) => key))
    : material.traits && typeof material.traits === "object"
      ? Object.fromEntries(Object.entries(material.traits).map(([key, value]) => [String(key), Math.max(0, Number(value) || 0)]))
    : fallbackTraits({ supportedEffects });
  const quantity = Math.max(1, Math.floor(Number(material.quantity ?? material.consumeAmount ?? 1) || 1));
  const matterUnits = Math.max(1, round(Number(material.matterUnits) || Math.max(3, legacyPower * 0.45 || 5)));
  const valueUnits = Math.max(0, round(Number(material.valueUnits) || matterUnits + legacyPower * 0.35));
  return {
    id, name, quantity, consumeAmount: Math.max(1, Math.floor(Number(material.consumeAmount) || 1)),
    matterUnits, storedEnergy: Math.max(0, round(Number(material.storedEnergy) || 0)), traits, valueUnits,
    purity: clamp(Number(material.purity) || 0.8, 0, 1), state: String(material.state || "solid"),
    kind: ["consumable", "catalyst", "tool"].includes(material.kind) ? material.kind : "consumable",
    tags: Array.isArray(material.tags) ? material.tags.map(String) : [],
    promptKeywords: Array.isArray(material.promptKeywords) ? material.promptKeywords.map(String) : [name],
    supportedEffects, color: String(material.color || "#9ba8b5"),
    power: legacyPower || round(sum(Object.values(traits)))
  };
}

function resolveMaterials(materialIds = [], suppliedMaterials = []) {
  const source = suppliedMaterials.length ? suppliedMaterials : materialIds.map((id) => DEMO_MATERIALS.find((material) => material.id === id)).filter(Boolean);
  const allowedIds = new Set(materialIds.map(String));
  return source.map(normalizeMaterial).filter(Boolean).filter((material) => !allowedIds.size || allowedIds.has(material.id));
}

function mentionedMaterials(text, materials) {
  return materials.map((material) => {
    const matches = [material.name, ...material.promptKeywords].filter(Boolean)
      .map((keyword) => ({ keyword, position: text.indexOf(String(keyword).toLowerCase()) }))
      .filter((match) => match.position >= 0)
      .sort((left, right) => left.position - right.position || right.keyword.length - left.keyword.length);
    return matches.length ? { materialId: material.id, position: matches[0].position } : null;
  }).filter(Boolean).sort((left, right) => left.position - right.position);
}

export function inferMaterialOperations(prompt, materials = []) {
  const normalized = String(prompt || "").trim().toLowerCase();
  if (!normalized || !materials.length) return [];
  const clauses = normalized.split(/[，,；;。.!！?？]/).map((clause) => clause.trim()).filter(Boolean);
  const operations = [];
  let lastMaterialIds = [];
  for (const clause of clauses) {
    const mentions = mentionedMaterials(clause, materials);
    const explicitIds = mentions.map((mention) => mention.materialId);
    if (mentions.length) lastMaterialIds = [mentions.at(-1).materialId];
    const matches = Object.values(MATERIAL_OPERATIONS).map((operation) => ({
      operation,
      position: Math.min(...operation.keywords.map((keyword) => {
        const index = clause.indexOf(keyword);
        return index < 0 ? Number.POSITIVE_INFINITY : index;
      }))
    })).filter((entry) => Number.isFinite(entry.position)).sort((left, right) => left.position - right.position);
    for (const { operation, position } of matches) {
      const structural = ["form_base", "embed_core", "infuse_edge"].includes(operation.id);
      const nearest = structural && mentions.length ? [...mentions].reverse().find((mention) => mention.position <= position) || mentions[0] : null;
      const ids = nearest ? [nearest.materialId] : explicitIds.length ? explicitIds : lastMaterialIds;
      if (!ids.length) continue;
      const signature = `${operation.id}:${ids.join(",")}`;
      if (operations.some((entry) => entry.signature === signature)) continue;
      operations.push({ signature, order: operations.length + 1, action: operation.id, actionName: operation.name, materialIds: [...ids], purpose: clause, sourceText: clause, assisted: false });
    }
  }
  return operations.slice(0, 12).map(({ signature, ...operation }) => operation);
}

export function createAssistedMaterialOperations(prompt, materials = [], requestedEffects = []) {
  if (!String(prompt || "").trim() || !materials.length) return [];
  const base = materials.find((material) => material.tags.includes("metal") || material.tags.includes("stable") || material.tags.includes("weapon")) || materials[0];
  const carriers = materials.filter((material) => requestedEffects.some((effectId) => material.supportedEffects.includes(effectId)));
  const operations = [{ action: "form_base", materialIds: [base.id], purpose: "采用厂商登记的基础成形工艺", sourceText: "系统依据目标补全", assisted: true }];
  for (const material of carriers) {
    if (material.id === base.id) continue;
    operations.push({ action: material.tags.includes("energy") ? "embed_core" : "fuse", materialIds: [material.id], purpose: "将目标属性载体接入基础结构", sourceText: "系统依据目标补全", assisted: true });
  }
  return operations.slice(0, 4).map((operation, index) => ({ ...operation, order: index + 1, actionName: MATERIAL_OPERATIONS[operation.action].name }));
}

function analyzeEffectPolarity(prompt) {
  const requested = [];
  const negated = [];
  const contradictory = [];
  const negativeCues = ["不要", "禁止", "取消", "移除", "避免", "排除", "牺牲", "放弃", "降低", "减少"];
  const positiveCues = ["需要", "保留", "获得", "附加", "目标", "持续", "增强", "让", "使", "换取", "优先"];
  const classifyOccurrence = (keyword, position) => {
    const separators = ["，", ",", "；", ";", "。", ".", "！", "!", "？", "?"];
    const clauseStart = Math.max(-1, ...separators.map((separator) => prompt.lastIndexOf(separator, position - 1))) + 1;
    const prefix = prompt.slice(Math.max(clauseStart, position - 12), position);
    const lastCue = (cues) => Math.max(-1, ...cues.map((cue) => prefix.lastIndexOf(cue)));
    return lastCue(negativeCues) > lastCue(positiveCues) ? "negative" : "positive";
  };
  for (const effect of Object.values(EFFECTS)) {
    const polarities = [];
    for (const keyword of effect.keywords) {
      let position = prompt.indexOf(keyword);
      while (position >= 0) { polarities.push(classifyOccurrence(keyword, position)); position = prompt.indexOf(keyword, position + keyword.length); }
    }
    if (!polarities.length) continue;
    const negative = polarities.includes("negative");
    const explicitlyPositive = polarities.includes("positive");
    if (negative) negated.push(effect.id);
    if (!negative || explicitlyPositive) requested.push(effect.id);
    if (negative && explicitlyPositive) contradictory.push(effect.id);
  }
  return { requested, negated, contradictory };
}

export function auditPromptLogic({ prompt, materials, materialOperations, requestedEffects, rejectedEffects, prototype, assisted }) {
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const checks = [];
  const add = (id, passed, severity, message) => checks.push({ id, passed, severity, message });
  const actionIndexes = (action) => materialOperations.map((operation, index) => operation.action === action ? index : -1).filter((index) => index >= 0);
  const baseIndexes = actionIndexes("form_base");
  const nativeWeaponBaseIndexes = materialOperations.map((operation, index) => (operation.materialIds || []).some((id) => materialById.get(id)?.tags?.includes("weapon")) ? index : -1).filter((index) => index >= 0);
  const effectiveBaseIndexes = baseIndexes.length ? baseIndexes : nativeWeaponBaseIndexes;
  const attachmentIndexes = materialOperations.map((operation, index) => ["embed_core", "infuse_edge", "fuse"].includes(operation.action) ? index : -1).filter((index) => index >= 0);
  const controlIndexes = materialOperations.map((operation, index) => ["encapsulate", "isolate", "channel", "quench", "temper"].includes(operation.action) ? index : -1).filter((index) => index >= 0);
  const polarity = analyzeEffectPolarity(prompt);

  add("executable_steps", materialOperations.length > 0, "error", materialOperations.length ? "已形成可执行工序" : "没有形成可执行工序");
  add("base_structure", effectiveBaseIndexes.length > 0, "error", baseIndexes.length ? "已指定承载成品的基础结构" : nativeWeaponBaseIndexes.length ? "游戏原生武器作为已有承载结构并会在结算时被消耗" : `${prototype.name}缺少“塑形成骨/基础成形”步骤`);
  const baseBeforeAttachments = !attachmentIndexes.length || (effectiveBaseIndexes.length > 0 && Math.min(...effectiveBaseIndexes) <= Math.min(...attachmentIndexes));
  add("structure_order", baseBeforeAttachments, "error", baseBeforeAttachments ? "基础结构先于核心、刃部或融合步骤" : "核心、刃部或融合发生在基础结构形成之前");
  const controlHasSubject = !controlIndexes.length || controlIndexes.every((index) => materialOperations.slice(0, index).some((operation) => ["form_base", "embed_core", "infuse_edge", "fuse"].includes(operation.action)));
  add("control_order", controlHasSubject, "error", controlHasSubject ? "控制步骤均有已形成对象" : "控制步骤出现在任何成形或融合对象之前");
  const incompatible = [];
  for (const operation of materialOperations) for (const materialId of operation.materialIds || []) {
    const material = materialById.get(materialId);
    if (!material) { incompatible.push(`${materialId} 不在本次材料中`); continue; }
    const tags = new Set(material.tags || []);
    if (operation.action === "form_base" && tags.has("energy") && !tags.has("metal") && !tags.has("stable") && !tags.has("wood") && !tags.has("crystal")) incompatible.push(`${material.name}只能量化，不能单独承担基础结构`);
    if (operation.action === "channel" && !(material.storedEnergy > 0 || ["energy", "fire", "frost", "magic"].some((tag) => tags.has(tag)))) incompatible.push(`${material.name}没有可引导的能量`);
    if (operation.action === "infuse_edge" && !(Object.values(material.traits || {}).some((value) => Number(value) > 0) || (material.supportedEffects || []).length || ["metal", "weapon", "crystal", "energy"].some((tag) => tags.has(tag)))) incompatible.push(`${material.name}没有可融入刃部的登记特征`);
  }
  add("material_operation_compatibility", incompatible.length === 0, "error", incompatible.length ? incompatible.join("；") : "材料状态与所用工序兼容");
  add("effect_source", rejectedEffects.length === 0, "error", rejectedEffects.length ? "目标效果缺少材料来源或不适用于当前目标" : "每个目标效果均有材料来源且被目标类型允许");
  add("semantic_consistency", polarity.contradictory.length === 0, "error", polarity.contradictory.length ? `同一提示词同时要求并禁止：${polarity.contradictory.map((id) => EFFECTS[id]?.name || id).join("、")}` : "未发现效果要求自相矛盾");
  const operatedIds = new Set(materialOperations.flatMap((operation) => operation.materialIds || []));
  const allMaterialsExplained = materials.every((material) => operatedIds.has(material.id));
  add("material_coverage", allMaterialsExplained, "warning", allMaterialsExplained ? "每种投入材料都有明确用途" : "存在未说明用途的材料；它们不会被消耗或贡献效果");
  add("player_authorship", !assisted, "warning", assisted ? "关键工序由系统补全；玩家说明越完整，成功率越高" : "关键工序来自玩家提示词");
  const errors = checks.filter((check) => !check.passed && check.severity === "error");
  const warnings = checks.filter((check) => !check.passed && check.severity === "warning");
  return { status: errors.length ? "INVALID" : warnings.length ? "WARNING" : "VALID", score: errors.length ? 0 : clamp(100 - warnings.length * 10, 0, 100), checks, errors: errors.map((check) => check.message), warnings: warnings.map((check) => check.message), requestedEffects, negatedEffects: polarity.negated, contradictoryEffects: polarity.contradictory };
}

export function parsePrompt(prompt, materialIds = [], targetType = "sword", suppliedMaterials = [], agentPlan = null) {
  const normalized = String(prompt || "").trim().toLowerCase();
  const materials = resolveMaterials(materialIds, suppliedMaterials);
  const prototype = PROTOTYPES[targetType] || PROTOTYPES.sword;
  const effectPolarity = analyzeEffectPolarity(normalized);
  const plannedEffects = Array.isArray(agentPlan?.requestedEffects) ? agentPlan.requestedEffects.map(String) : effectPolarity.requested;
  const requestedEffects = [...new Set(plannedEffects.filter((id) => !effectPolarity.negated.includes(id) || effectPolarity.contradictory.includes(id)))];
  const explicitOperations = Array.isArray(agentPlan?.materialOperations) && agentPlan.materialOperations.length
    ? agentPlan.materialOperations
    : inferMaterialOperations(normalized, materials);
  const materialOperations = explicitOperations.length ? explicitOperations : createAssistedMaterialOperations(normalized, materials, requestedEffects);
  const selectedIds = new Set(materials.map((material) => material.id));
  const operatedMaterialIds = [...new Set(materialOperations.flatMap((operation) => operation.materialIds || []).map(String).filter((id) => selectedIds.has(id)))];
  const operatedMaterials = materials.filter((material) => operatedMaterialIds.includes(material.id));
  const materialEffects = [...new Set(operatedMaterials.flatMap((material) => material.supportedEffects))];
  const desiredEffects = requestedEffects.length ? requestedEffects : materialEffects.filter((id) => !effectPolarity.negated.includes(id)).slice(0, 1);
  const effects = desiredEffects.filter((id) => EFFECTS[id] && prototype.allowedEffects.includes(id) && materialEffects.includes(id)).slice(0, prototype.maxEffects);
  const rejectedEffects = desiredEffects.filter((id) => !EFFECTS[id] || !prototype.allowedEffects.includes(id) || !materialEffects.includes(id));
  const materialReferences = materials.filter((material) => containsAny(normalized, material.promptKeywords)).length;
  const operationCoverage = materials.length ? Math.round(operatedMaterialIds.length / materials.length * 100) : 0;
  const explicitCount = materialOperations.filter((operation) => !operation.assisted).length;
  const assisted = materialOperations.length > 0 && explicitCount === 0;
  const hasTradeoff = Boolean(agentPlan?.tradeoffs?.length) || containsAny(normalized, ["牺牲", "换取", "降低", "减少", "取舍", "优先"]);
  const hasConstraint = containsAny(normalized, ["持续", "单体", "范围", "命中", "避免", "保持", "仅", "只"]);
  const hasConflictHandling = containsAny(normalized, ["封装", "隔离", "分层", "稳定", "调和"]);
  const hasSequence = explicitCount >= 3 || containsAny(normalized, ["先", "再", "然后", "最后", "分次"]);
  const hasVagueIntent = containsAny(normalized, ["随便", "随意", "随机", "无所谓", "看着办", "越强越好", "随缘"]);
  const hasForbiddenIntent = containsAny(normalized, ["修改库存", "无限", "管理员", "执行代码", "不消耗材料", "凭空"]);
  const materialMatch = requestedEffects.length ? Math.round(effects.length / requestedEffects.length * 100) : effects.length ? 70 : 0;
  const baseScore = clamp(
    (effects.length ? 30 : 0)
      + (assisted ? 15 : Math.min(25, explicitCount * 6 + 7))
      + (materials.length ? Math.round(materialReferences / materials.length * 15) : 0)
      + (hasSequence ? 10 : 0) + (hasTradeoff ? 10 : 0) + (hasConstraint ? 5 : 0) + (hasConflictHandling ? 5 : 0)
      - rejectedEffects.length * 20 - (hasVagueIntent ? 30 : 0) - (hasForbiddenIntent ? 100 : 0), 0, 100
  );
  const promptLogic = auditPromptLogic({ prompt: normalized, materials, materialOperations, requestedEffects, rejectedEffects, prototype, assisted });
  const score = promptLogic.status === "INVALID" ? 0 : clamp(baseScore - (100 - promptLogic.score), 0, 100);
  const promptBlocked = !materials.length || !materialOperations.length || !operatedMaterialIds.length || hasForbiddenIntent || hasVagueIntent || promptLogic.status === "INVALID" || (requestedEffects.length > 0 && effects.length === 0);
  const unresolved = [
    ...rejectedEffects.map((id) => `材料或目标无法提供：${EFFECTS[id]?.name || id}`),
    ...(hasForbiddenIntent ? ["提示词要求违反天工五律，已阻止执行"] : []),
    ...(hasVagueIntent ? ["提示词没有给出可执行目标；请至少说明想获得的效果"] : []),
    ...promptLogic.errors,
    ...promptLogic.warnings,
    ...(!materials.length ? ["尚未选择材料"] : []),
    ...(assisted ? ["已采用厂商登记的基础工艺；补充部位、顺序和取舍可提高效率"] : []),
    ...(materialOperations.length && operationCoverage < 100 ? [`${materials.length - operatedMaterialIds.length} 个未被操作的材料不会消耗，也不会贡献能力`] : [])
  ];
  return {
    targetType: prototype.id, targetName: prototype.name, effects,
    materialRoles: Array.isArray(agentPlan?.materialRoles) && agentPlan.materialRoles.length ? agentPlan.materialRoles : materials.map((material) => ({ materialId: material.id, role: operatedMaterialIds.includes(material.id) ? "processed_material" : "unused" })),
    materialOperations, operatedMaterialIds, operationCoverage, assisted,
    techniques: Array.isArray(agentPlan?.techniques) ? agentPlan.techniques : [],
    tradeoffs: Array.isArray(agentPlan?.tradeoffs) ? agentPlan.tradeoffs : hasTradeoff ? ["按玩家提示词执行优先级取舍"] : [],
    confidence: round(score / 100), promptScore: score, materialMatch, promptBlocked, promptLogic,
    promptSignals: { requestedEffects: requestedEffects.length, materialReferences, materialOperations: materialOperations.length, explicitOperations: explicitCount, operationCoverage, assisted, hasTradeoff, hasConstraint, hasSequence, hasConflictHandling, hasVagueIntent, hasForbiddenIntent },
    unresolved, normalizedPrompt: normalized
  };
}

function addVectors(vectors) {
  const result = {};
  for (const vector of vectors) for (const [key, value] of Object.entries(vector || {})) result[key] = round((result[key] || 0) + Number(value || 0));
  return result;
}

function scaleVector(vector, factor) {
  return Object.fromEntries(Object.entries(vector).map(([key, value]) => [key, round(value * factor)]));
}

function subtractVectors(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return Object.fromEntries(
    [...keys]
      .map((key) => [key, round(Math.max(0, (left[key] || 0) - (right[key] || 0)))])
      .filter(([, value]) => value > 0)
  );
}

function conflictInfo(materials, intent) {
  const tags = materials.flatMap((material) => material.tags);
  const conflict = tags.includes("fire") && tags.includes("frost");
  if (!conflict) return { penalty: 0, entropy: 0, message: "未发现已登记属性冲突" };
  const mitigated = intent.promptSignals.hasConflictHandling || intent.effects.includes("stability");
  return mitigated
    ? { penalty: 6, entropy: 4, message: "火冰冲突已通过稳定工艺部分化解" }
    : { penalty: 28, entropy: 14, message: "火冰冲突未处理，转化损耗显著增加" };
}

function buildOperationReport(materials, intent) {
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const steps = intent.materialOperations.map((operation, index) => {
    const rule = MATERIAL_OPERATIONS[operation.action];
    const stepMaterials = (operation.materialIds || []).map((id) => materialById.get(id)).filter(Boolean);
    return {
      order: index + 1, action: operation.action, actionName: rule?.name || operation.action,
      materialIds: stepMaterials.map((material) => material.id), materialNames: stepMaterials.map((material) => material.name),
      purpose: String(operation.purpose || ""), sourceText: String(operation.sourceText || ""), assisted: Boolean(operation.assisted),
      energyCost: rule?.energyCost || 0, transferEfficiency: rule?.transferEfficiency || 0, entropy: rule?.entropy || 0,
      inputStates: [...new Set(stepMaterials.map((material) => material.state))], outputState: rule?.outputState || "composite"
    };
  }).filter((step) => step.materialIds.length);
  const contributions = intent.operatedMaterialIds.map((id) => {
    const material = materialById.get(id);
    return { materialId: id, materialName: material.name, matterUnits: round(material.matterUnits * material.consumeAmount), storedEnergy: round(material.storedEnergy * material.consumeAmount), traits: scaleVector(material.traits, material.consumeAmount), actions: steps.filter((step) => step.materialIds.includes(id)).map((step) => step.action) };
  });
  const averageEfficiency = steps.length ? sum(steps.map((step) => step.transferEfficiency)) / steps.length : 0;
  const sequenceScore = steps.length ? clamp(Math.round(averageEfficiency * 70 + Math.min(30, steps.filter((step) => !step.assisted).length * 7)), 0, 100) : 0;
  return { steps, operatedMaterialIds: [...intent.operatedMaterialIds], ignoredMaterialIds: materials.map((material) => material.id).filter((id) => !intent.operatedMaterialIds.includes(id)), coverage: intent.operationCoverage, assisted: intent.assisted, sequenceScore, requiredEnergy: sum(steps.map((step) => step.energyCost)), baseEntropy: Math.max(0, sum(steps.map((step) => step.entropy))), materialContributions: contributions };
}

function buildPreviewBalance({ operatedMaterials, operationReport, effects, environment, processEfficiency, conflict }) {
  const matterIn = round(sum(operatedMaterials.map((material) => material.matterUnits * material.consumeAmount)));
  const materialEnergy = round(sum(operatedMaterials.map((material) => material.storedEnergy * material.consumeAmount)));
  const externalEnergy = round(Math.max(0, Math.min(environment.availableEnergy, operationReport.requiredEnergy - materialEnergy)));
  const energyIn = round(materialEnergy + externalEnergy);
  const usefulWork = round(Math.min(operationReport.requiredEnergy, energyIn) * 0.62);
  const productStoredEnergy = round(materialEnergy * processEfficiency * 0.45);
  const heatLoss = round(Math.max(0, energyIn - usefulWork - productStoredEnergy));
  const traitsIn = addVectors(operatedMaterials.map((material) => scaleVector(material.traits, material.consumeAmount)));
  const traitsToProduct = scaleVector(traitsIn, processEfficiency);
  const productMatter = round(matterIn * (0.55 + processEfficiency * 0.35));
  const byproductMatter = round(matterIn - productMatter);
  const valueIn = round(sum(operatedMaterials.map((material) => material.valueUnits * material.consumeAmount)) + environment.valueCost);
  const productValue = round(Math.min(valueIn, sum(operatedMaterials.map((material) => material.valueUnits * material.consumeAmount)) * (0.5 + processEfficiency * 0.42)));
  const irreversibleLoss = round(Math.max(0, valueIn - productValue) * 0.35);
  const byproductValue = round(Math.max(0, valueIn - productValue - irreversibleLoss));
  return {
    matter: { unit: "MU", input: matterIn, product: productMatter, byproducts: byproductMatter, balanced: round(productMatter + byproductMatter) === matterIn },
    energy: { unit: "EU", material: materialEnergy, external: externalEnergy, input: energyIn, usefulWork, productStored: productStoredEnergy, heatLoss, balanced: round(usefulWork + productStoredEnergy + heatLoss) === energyIn },
    traits: { unit: "TP", input: traitsIn, productCeiling: traitsToProduct, residual: subtractVectors(traitsIn, traitsToProduct), balanced: true },
    value: { unit: "VU", input: valueIn, product: productValue, byproducts: byproductValue, irreversibleLoss, balanced: round(productValue + byproductValue + irreversibleLoss) === valueIn },
    entropy: { unit: "EP", operations: operationReport.baseEntropy, conflict: conflict.entropy, control: Math.round(processEfficiency * 10), final: Math.max(0, operationReport.baseEntropy + conflict.entropy - Math.round(processEfficiency * 10)) },
    audits: { matter: true, energy: true, traitCap: effects.every((effect) => (traitsToProduct[effect.trait] || 0) <= (traitsIn[effect.trait] || 0)), valueCap: productValue + byproductValue <= valueIn }
  };
}

export function previewCraft({ gameId = GAME_ID, materialIds = [], materials: suppliedMaterials = [], prompt = "", targetType = "sword", ruleVersion = PIXEL_PATHFINDER_RULE_VERSION, agentPlan = null, agentContext = null, environment: suppliedEnvironment = null }) {
  const materials = resolveMaterials(materialIds, suppliedMaterials);
  const prototype = PROTOTYPES[targetType] || PROTOTYPES.sword;
  const intent = parsePrompt(prompt, materials.map((material) => material.id), prototype.id, materials, agentPlan);
  const operationReport = buildOperationReport(materials, intent);
  const operatedMaterials = materials.filter((material) => operationReport.operatedMaterialIds.includes(material.id));
  const effects = intent.effects.map((id) => EFFECTS[id]).filter(Boolean);
  const environment = { ...CONSERVATION_POLICY.defaultEnvironment, ...(suppliedEnvironment || {}) };
  const conflict = conflictInfo(operatedMaterials, intent);
  const matterIn = sum(operatedMaterials.map((material) => material.matterUnits * material.consumeAmount));
  const traitsIn = addVectors(operatedMaterials.map((material) => scaleVector(material.traits, material.consumeAmount)));
  const energyAvailable = sum(operatedMaterials.map((material) => material.storedEnergy * material.consumeAmount)) + environment.availableEnergy;
  const missingTraits = effects.filter((effect) => (traitsIn[effect.trait] || 0) < effect.requirement).map((effect) => effect.id);
  const violations = [
    ...(matterIn < prototype.minimumMatter ? [`结构物质不足：需要 ${prototype.minimumMatter} MU，当前 ${round(matterIn)} MU`] : []),
    ...(energyAvailable < operationReport.requiredEnergy ? [`工序能量不足：需要 ${operationReport.requiredEnergy} EU，当前可用 ${round(energyAvailable)} EU`] : []),
    ...missingTraits.map((id) => `属性潜能不足：${EFFECTS[id].name}`),
    ...(intent.promptBlocked ? intent.unresolved : [])
  ];
  const feasible = !intent.promptBlocked && !violations.length;
  const operationFactor = operationReport.sequenceScore / 100;
  const promptFactor = intent.promptScore / 100;
  const calculatedEfficiency = 0.1 + promptFactor * 0.68 + intent.materialMatch / 100 * 0.1 + operationFactor * 0.07 + environment.precision * 0.05 - conflict.penalty / 100;
  const processEfficiency = feasible
    ? intent.promptScore === 100 && intent.materialMatch === 100 && conflict.penalty === 0 ? 1 : clamp(calculatedEfficiency, 0, 1)
    : 0;
  const successRate = round(processEfficiency);
  const quality = Math.round(processEfficiency * 100);
  const highQualityRate = round(successRate * clamp((quality - 55) / 100, 0.05, 0.45), 6);
  const failureRate = round(1 - successRate, 6);
  const failureTable = [
    { label: "高品质成功", probability: highQualityRate },
    { label: "普通成功", probability: round(successRate - highQualityRate, 6) },
    { label: "劣质品", probability: round(failureRate * 0.45, 6) },
    { label: "碎片与残渣", probability: round(failureRate * 0.35, 6) },
    { label: "完全转化为残渣", probability: round(failureRate * 0.2, 6) }
  ];
  const probabilityDelta = round(1 - sum(failureTable.map((entry) => entry.probability)), 6);
  failureTable.at(-1).probability = round(failureTable.at(-1).probability + probabilityDelta, 6);
  const balanceSheet = buildPreviewBalance({ operatedMaterials, operationReport, effects, environment, processEfficiency, conflict });
  const traitCapacity = sum(effects.map((effect) => traitsIn[effect.trait] || 0));
  const effectRequirement = sum(effects.map((effect) => effect.requirement));
  const preview = {
    requestId: `preview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, gameId, ruleVersion, target: prototype, intent, agentPlan, agentContext,
    operationReport, effects, materialIds: materials.map((material) => material.id), materials, environment, conflict, violations, feasible,
    processEfficiency: round(processEfficiency), successRate, quality, failureTable, balanceSheet,
    materialPower: traitCapacity, totalBudget: traitCapacity, effectCost: effectRequirement, overflow: Math.max(0, effectRequirement - traitCapacity),
    previewValidSeconds: 120,
    summary: feasible ? `${prototype.name}：${effects.map((effect) => effect.name).join("＋") || "基础成形"}；${intent.assisted ? "基础工艺辅助" : "玩家自定义工艺"}，预计成功率 ${Math.round(successRate * 100)}%` : `${prototype.name}方案不可执行：${violations[0] || "未形成合法工序"}`
  };
  preview.assetSpec = createAssetSpec(preview);
  return preview;
}

function buildExecutionBalance(preview, outcome, yieldFactor) {
  const input = preview.balanceSheet.matter.input;
  const hasProduct = yieldFactor > 0;
  const product = hasProduct ? round(input * yieldFactor) : 0;
  const byproducts = round(input - product);
  const inputTraits = preview.balanceSheet.traits.input;
  const productTraits = hasProduct ? scaleVector(inputTraits, yieldFactor * preview.processEfficiency) : {};
  const residualTraits = subtractVectors(inputTraits, productTraits);
  const energy = preview.balanceSheet.energy;
  const usefulWork = round(Math.min(preview.operationReport.requiredEnergy, energy.input) * (hasProduct ? 0.62 : 0.35));
  const productStored = hasProduct ? round(Math.min(energy.material * yieldFactor * 0.5, Math.max(0, energy.input - usefulWork))) : 0;
  const heatLoss = round(Math.max(0, energy.input - productStored - usefulWork));
  const valueInput = preview.balanceSheet.value.input;
  const productValue = hasProduct ? round(Math.min(valueInput, preview.balanceSheet.value.product * yieldFactor)) : 0;
  const byproductValue = round(Math.min(valueInput - productValue, byproducts * 0.5));
  const irreversibleLoss = round(valueInput - productValue - byproductValue);
  return {
    matter: { unit: "MU", input, product, byproducts, balanced: round(product + byproducts) === input },
    energy: { unit: "EU", input: energy.input, material: energy.material, external: energy.external, productStored, usefulWork, heatLoss, balanced: round(productStored + usefulWork + heatLoss) === energy.input },
    traits: { unit: "TP", input: inputTraits, product: productTraits, residual: residualTraits, balanced: true },
    value: { unit: "VU", input: valueInput, product: productValue, byproducts: byproductValue, irreversibleLoss, balanced: round(productValue + byproductValue + irreversibleLoss) === valueInput },
    entropy: { ...preview.balanceSheet.entropy, outcome },
    audits: { matter: round(product + byproducts) === input, energy: round(productStored + usefulWork + heatLoss) === energy.input, traitCap: Object.keys(productTraits).every((key) => productTraits[key] <= (inputTraits[key] || 0)), valueCap: productValue + byproductValue <= valueInput }
  };
}

export function executeCraft(preview, randomValue = Math.random(), approvedAsset = null) {
  let cursor = clamp(randomValue, 0, 0.999999);
  const outcome = preview.failureTable.find((entry) => { cursor -= entry.probability; return cursor < 0; })?.label || "完全转化为残渣";
  const yieldFactor = outcome === "高品质成功" ? 0.94 : outcome === "普通成功" ? 0.82 : outcome === "劣质品" ? 0.6 : 0;
  const isProduct = yieldFactor > 0;
  const operated = preview.materials.filter((material) => preview.operationReport.operatedMaterialIds.includes(material.id));
  const consumedMaterials = operated.filter((material) => material.kind === "consumable").map((material) => ({ materialId: material.id, amount: material.consumeAmount }));
  const preservedMaterials = operated.filter((material) => material.kind !== "consumable").map((material) => ({ materialId: material.id, amount: material.consumeAmount, durabilityLoss: material.kind === "tool" ? 1 : 0 }));
  const balanceSheet = buildExecutionBalance(preview, outcome, yieldFactor);
  const fragmentCount = Math.floor(balanceSheet.matter.byproducts / 4);
  const residueMatter = round(balanceSheet.matter.byproducts - fragmentCount * 4);
  const byproducts = [
    ...(fragmentCount ? [{ ...CONSERVATION_POLICY.fragmentItem, amount: fragmentCount, matterUnits: fragmentCount * 4 }] : []),
    ...(residueMatter ? [{ ...CONSERVATION_POLICY.residueItem, amount: Math.max(1, Math.ceil(residueMatter)), matterUnits: residueMatter }] : [])
  ];
  const settlement = {
    consumedMaterials, consumedMaterialIds: consumedMaterials.map((entry) => entry.materialId), preservedMaterials, byproducts,
    fragment: byproducts.find((entry) => entry.id === CONSERVATION_POLICY.fragmentItem.id) || null,
    balanceSheet,
    conservation: `投入 ${balanceSheet.matter.input} MU，成品承载 ${balanceSheet.matter.product} MU，副产物承载 ${balanceSheet.matter.byproducts} MU；被操作的消耗型材料全部结算。`
  };
  if (!isProduct) return { status: "failed", outcome, materialLoss: `被操作材料已转化为${byproducts.map((item) => item.name).join("和") || "残渣与散失热量"}`, settlement, result: null };
  const quality = outcome === "高品质成功" ? "epic" : outcome === "普通成功" ? "rare" : "common";
  const damageTrait = balanceSheet.traits.product.damage || 0;
  const resultEffects = outcome === "劣质品" ? preview.effects.slice(0, 1) : preview.effects;
  const generatedAsset = approvedAsset?.status === "APPROVED" ? approvedAsset : createAndGenerateAsset(preview);
  if (generatedAsset.status !== "APPROVED") {
    return { status: "asset_rejected", outcome: "资产审核未通过", materialLoss: "尚未执行库存结算", settlement: null, result: null, asset: generatedAsset };
  }
  const result = {
    instanceId: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, gameId: preview.gameId,
    prototypeId: preview.target.id, prototypeName: preview.target.name,
    effectIds: resultEffects.map((effect) => effect.id), effectNames: resultEffects.map((effect) => effect.name), quality,
    damage: Math.max(1, Math.round((preview.target.baseDamage + damageTrait * 1.2) * yieldFactor)),
    matterUnits: balanceSheet.matter.product, traits: balanceSheet.traits.product,
    sourceMaterialIds: preview.operationReport.operatedMaterialIds, materialOperations: preview.operationReport.steps,
    processSummary: preview.operationReport.steps.map((step) => `${step.order}. ${step.actionName}：${step.materialNames.join("、")}`).join("；"),
    assetSpec: preview.assetSpec,
    generatedAsset,
    ruleVersion: preview.ruleVersion, resultSignature: `tg_conservation_${preview.requestId}`
  };
  return { status: "completed", outcome, materialLoss: "被操作的消耗型材料已全部转化", settlement, result };
}

export const GameAdapter = {
  toTianGongRequest({ selectedMaterials, nativeMaterials = [], prompt, targetType, player, environment = null }) {
    return { gameId: GAME_ID, playerId: player.id, targetType, materialIds: selectedMaterials.map((material) => typeof material === "string" ? material : material.id), materials: nativeMaterials, prompt, ruleVersion: player.ruleVersion || PIXEL_PATHFINDER_RULE_VERSION, inventoryRevision: player.inventoryRevision, environment };
  },
  toGameItem(result) {
    if (!result) return null;
    return { itemId: result.instanceId, template: result.prototypeId, displayName: `${result.quality === "epic" ? "天工" : result.quality === "rare" ? "精制" : "试制"}${result.prototypeName}`, effects: result.effectNames, damage: result.damage, matterUnits: result.matterUnits, traits: result.traits, assetId: result.generatedAsset?.assetId || null, image2d: result.generatedAsset?.image2d || null, model3d: result.generatedAsset?.model3d || null, assetAudit: result.generatedAsset?.audit || null, signature: result.resultSignature };
  }
};
