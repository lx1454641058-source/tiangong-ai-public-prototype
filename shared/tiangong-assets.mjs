// SPDX-License-Identifier: MIT
// 天工资产管线原型：把规则结果转换为 AssetSpec，并生成全新的测试 2D 图像和 3D OBJ 模型。
import { PIXEL_PATHFINDER_STYLE_PACK } from "../knowledge/pixel-pathfinder.mjs";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function stableAssetHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
}

function encodeDataUri(mime, content) {
  return `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
}

export function createAssetSpec(preview, stylePack = PIXEL_PATHFINDER_STYLE_PACK) {
  const operatedIds = new Set(preview.operationReport?.operatedMaterialIds || []);
  const materials = (preview.materials || []).filter((material) => operatedIds.has(material.id));
  const prompt = preview.intent?.normalizedPrompt || "";
  const promptDigest = stableAssetHash(prompt);
  return {
    version: "asset_spec_v1",
    requestId: preview.requestId,
    gameId: preview.gameId,
    target: { id: preview.target.id, name: preview.target.name },
    promptDigest,
    playerIntent: prompt,
    sourceMaterials: materials.map((material) => ({
      id: material.id,
      name: material.name,
      color: safeColor(material.color, "#9ba8b5"),
      state: material.state,
      tags: material.tags,
      traits: material.traits
    })),
    structure: (preview.operationReport?.steps || []).map((step) => ({
      order: step.order,
      operationId: step.action,
      operationName: step.actionName,
      materialIds: step.materialIds,
      purpose: step.purpose || step.sourceText || ""
    })),
    effects: (preview.effects || []).map((effect) => ({ id: effect.id, name: effect.name, trait: effect.trait })),
    stylePack: {
      id: stylePack.id,
      version: stylePack.version,
      artDirection: stylePack.artDirection,
      palette: stylePack.palette,
      referenceAssetIds: stylePack.referenceAssetIds,
      referenceUse: stylePack.referenceUse
    },
    outputs: stylePack.outputs,
    noveltyPolicy: stylePack.novelty,
    hardRules: [
      "不得复用任一输入材料或原有道具的图像、贴图、网格与模型文件",
      "不得仅换色、裁切、缩放或叠加特效冒充新资产",
      "必须让被操作材料和玩家工序在轮廓、结构或表面语言中可辨认",
      "资产生成不得改变规则引擎已经裁定的数值和结算"
    ]
  };
}

function buildSvg(spec, seed) {
  const colors = spec.sourceMaterials.map((material) => material.color);
  const primary = safeColor(colors[0], spec.stylePack.palette[0]);
  const secondary = safeColor(colors[1], spec.stylePack.palette[1]);
  const glow = safeColor(colors[2], spec.stylePack.palette[2]);
  const variant = Number.parseInt(seed.slice(0, 4), 16);
  const lean = variant % 2 ? -7 : 8;
  const broad = 24 + (variant % 18);
  let weapon;
  if (spec.target.id === "bow") {
    const bend = 52 + (variant % 25);
    weapon = `<path d="M ${180 - bend} 60 Q ${245 + lean} 180 ${180 - bend} 300" fill="none" stroke="${primary}" stroke-width="${broad / 3}" stroke-linecap="square"/><path d="M ${180 - bend} 60 L ${180 - bend} 300" stroke="${secondary}" stroke-width="4"/><path d="M 95 180 L 268 180" stroke="${glow}" stroke-width="8"/><path d="M 268 180 L 242 165 L 242 195 Z" fill="${secondary}"/>`;
  } else if (spec.target.id === "wand") {
    weapon = `<polygon points="${173 + lean},118 ${187 + lean},118 ${204 - lean},307 ${154 - lean},307" fill="${primary}"/><polygon points="180,34 224,83 180,132 136,83" fill="${secondary}"/><polygon points="180,50 207,83 180,113 153,83" fill="${glow}"/><rect x="161" y="250" width="38" height="22" fill="${secondary}"/>`;
  } else {
    weapon = `<polygon points="180,28 ${180 + broad},92 ${191 + lean},242 ${169 + lean},242 ${180 - broad},92" fill="${primary}"/><polygon points="180,43 ${188 + lean},102 ${184 + lean},221 176,221 ${172 + lean},102" fill="${glow}"/><rect x="116" y="236" width="128" height="22" fill="${secondary}"/><rect x="166" y="252" width="28" height="72" fill="${primary}"/><polygon points="151,324 209,324 180,348" fill="${secondary}"/>`;
  }
  const materialMarks = spec.sourceMaterials.map((material, index) => `<rect x="${42 + index * 31}" y="310" width="20" height="20" fill="${material.color}"/><text x="${52 + index * 31}" y="304" text-anchor="middle" fill="#dcebf0" font-size="9">${index + 1}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360" shape-rendering="crispEdges"><defs><filter id="g"><feGaussianBlur stdDeviation="7"/></filter></defs><g opacity=".28" filter="url(#g)" fill="${glow}"><circle cx="180" cy="180" r="106"/></g><g transform="rotate(${lean} 180 180)">${weapon}</g>${materialMarks}<text x="348" y="349" text-anchor="end" fill="#78909a" font-size="8">TG-${seed}</text></svg>`;
}

function buildObj(spec, seed) {
  const vertices = [];
  const faces = [];
  const addBox = (cx, cy, cz, sx, sy, sz) => {
    const base = vertices.length + 1;
    for (const [x, y, z] of [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]) {
      vertices.push([cx + x * sx / 2, cy + y * sy / 2, cz + z * sz / 2]);
    }
    for (const face of [[1,2,3,4],[5,8,7,6],[1,5,6,2],[2,6,7,3],[3,7,8,4],[5,1,4,8]]) faces.push(face.map((index) => base + index - 1));
  };
  const variant = Number.parseInt(seed.slice(-4), 16);
  if (spec.target.id === "bow") {
    addBox(-0.55, 0.8, 0, 0.18, 1.4, 0.16);
    addBox(0, 0, 0, 0.16, 2.7, 0.14);
    addBox(-0.55, -0.8, 0, 0.18, 1.4, 0.16);
    addBox(0.2, 0, 0, 2.2, 0.06, 0.06);
  } else if (spec.target.id === "wand") {
    addBox(0, -0.45, 0, 0.22, 2.6 + (variant % 5) / 10, 0.22);
    addBox(0, 1.05, 0, 0.72, 0.72, 0.72);
  } else {
    addBox(0, 0.75, 0, 0.28 + (variant % 8) / 100, 2.7, 0.12);
    addBox(0, -0.78, 0, 1.25, 0.16, 0.2);
    addBox(0, -1.35, 0, 0.24, 1.0, 0.24);
  }
  const lines = [`# Tiangong generated OBJ ${seed}`, `o tg_${spec.target.id}_${seed}`];
  for (const vertex of vertices) lines.push(`v ${vertex.map((value) => value.toFixed(4)).join(" ")}`);
  for (const face of faces) lines.push(`f ${face.join(" ")}`);
  return { text: lines.join("\n"), vertexCount: vertices.length, faceCount: faces.length };
}

export function generateAssetCandidate(spec, stylePack = PIXEL_PATHFINDER_STYLE_PACK) {
  const seedSource = JSON.stringify({ prompt: spec.playerIntent, materials: spec.sourceMaterials, structure: spec.structure, target: spec.target, style: spec.stylePack.version });
  const seed = stableAssetHash(seedSource);
  const svg = buildSvg(spec, seed);
  const obj = buildObj(spec, seed);
  const silhouetteSimilarity = Number((0.28 + (Number.parseInt(seed.slice(0, 2), 16) % 42) / 100).toFixed(2));
  const audit = {
    mode: "prototype_deterministic_audit",
    exactFingerprintMatch: stylePack.referenceFingerprints.includes(seed),
    silhouetteSimilarity,
    silhouetteThreshold: stylePack.novelty.maxSilhouetteSimilarity,
    simpleRecolorDetected: false,
    sourceAssetBinaryReused: false,
    materialCoverage: spec.sourceMaterials.every((material) => spec.structure.some((step) => step.materialIds.includes(material.id))),
    styleConformance: spec.stylePack.version === stylePack.version,
    technical2d: svg.includes('width="360"') && svg.includes('height="360"'),
    technical3d: obj.vertexCount <= stylePack.outputs.model3d.maxVertices && obj.faceCount <= stylePack.outputs.model3d.maxFaces
  };
  audit.passed = !audit.exactFingerprintMatch && silhouetteSimilarity < audit.silhouetteThreshold && !audit.simpleRecolorDetected && !audit.sourceAssetBinaryReused && audit.materialCoverage && audit.styleConformance && audit.technical2d && audit.technical3d;
  const assetId = audit.passed ? `asset_tg_${spec.target.id}_${seed}` : null;
  return {
    jobId: `asset_job_${spec.requestId}`,
    requestId: spec.requestId,
    status: audit.passed ? "APPROVED" : "REJECTED",
    provider: "tiangong-procedural-mock",
    providerMode: "local_test_only",
    assetId,
    spec,
    image2d: { format: "svg", width: 360, height: 360, contentHash: stableAssetHash(svg), dataUri: encodeDataUri("image/svg+xml", svg) },
    model3d: { format: "obj", vertexCount: obj.vertexCount, faceCount: obj.faceCount, contentHash: stableAssetHash(obj.text), fileName: `${assetId || `rejected_${seed}`}.obj`, dataUri: encodeDataUri("model/obj", obj.text) },
    audit,
    notices: ["此原型生成的是全新程序化测试资产，未调用外部图像或 3D 大模型。", "正式版应替换 provider，并保留相同 AssetSpec 与审核接口。"]
  };
}

export function createAndGenerateAsset(preview, stylePack = PIXEL_PATHFINDER_STYLE_PACK) {
  return generateAssetCandidate(preview.assetSpec || createAssetSpec(preview, stylePack), stylePack);
}
