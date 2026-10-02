import { PIXEL_PATHFINDER_KNOWLEDGE } from "../knowledge/pixel-pathfinder.mjs";
import { EMBERFIELD_KNOWLEDGE } from "../knowledge/emberfield.mjs";

const DEFAULT_KNOWLEDGE = [...PIXEL_PATHFINDER_KNOWLEDGE, ...EMBERFIELD_KNOWLEDGE];

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .match(/[\u4e00-\u9fff]|[a-z0-9_:-]+/g) || [];
}

function scoreDocument(document, queryTokens, { gameId, targetType }) {
  if (document.gameId !== gameId) return -1;
  if (document.targetTypes?.length && !document.targetTypes.includes(targetType)) return -1;
  const searchable = tokenize([
    document.id,
    document.type,
    document.tags?.join(" "),
    document.content
  ].join(" "));
  const searchableSet = new Set(searchable);
  const overlap = queryTokens.reduce((score, token) => score + (searchableSet.has(token) ? 1 : 0), 0);
  const phraseBonus = queryTokens.filter((token) => document.content.toLowerCase().includes(token)).length * 0.25;
  const targetBonus = document.targetTypes?.includes(targetType) ? 2 : 0;
  return overlap + phraseBonus + targetBonus;
}

export function retrieveKnowledge({ gameId = "pixel_pathfinder_tiangong_demo", targetType = "sword", prompt = "", materials = [], limit = 5, documents = DEFAULT_KNOWLEDGE }) {
  const materialText = materials.flatMap((material) => [
    material.name,
    ...(material.tags || []),
    ...(material.promptKeywords || []),
    ...(material.supportedEffects || [])
  ]).join(" ");
  const queryTokens = tokenize(`${targetType} ${prompt} ${materialText}`);
  return documents
    .map((document) => ({ document, score: scoreDocument(document, queryTokens, { gameId, targetType }) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.document.id.localeCompare(right.document.id))
    .slice(0, limit)
    .map(({ document, score }) => ({ ...document, retrievalScore: Number(score.toFixed(2)) }));
}

export function buildKnowledgeContext(documents) {
  return documents.map((document, index) => `[#${index + 1} ${document.id}] ${document.content}`).join("\n");
}
