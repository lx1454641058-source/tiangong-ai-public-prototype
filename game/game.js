import { MATERIALS } from "../shared/tiangong-core.mjs";

const state = {
  panel: "forge",
  preview: null,
  asset: null,
  weapon: { name: "未命名长剑", prototypeName: "长剑", stage: "prototype", quality: "common", damage: 24, effects: ["基础伤害"], level: 1, instanceId: "prototype_sword" },
  history: [],
  inventory: Object.fromEntries(MATERIALS.map((material) => [material.id, 2])),
  byproducts: {},
  player: { id: "demo_player_01", ruleVersion: "forge_conservation_v2", inventoryRevision: 84 }
};

const byId = (id) => document.getElementById(id);
const canvas = byId("arena");
const ctx = canvas.getContext("2d");
const enemies = Array.from({ length: 13 }, (_, index) => ({ angle: (index / 13) * Math.PI * 2, radius: 145 + (index % 3) * 38, speed: 0.00035 + (index % 4) * 0.00008, size: 9 + (index % 3) * 3 }));

function renderMaterials() {
  byId("game-materials").innerHTML = MATERIALS.map((material, index) => {
    const amount = state.inventory[material.id] || 0;
    return `<label class="game-material"><input type="checkbox" value="${material.id}" ${index === 0 || index === 3 ? "checked" : ""} ${amount <= 0 ? "disabled" : ""}><span>${material.name} ×${amount}</span><small>${material.matterUnits} MU</small></label>`;
  }).join("");
}

function drawArena(time = 0) {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#102936";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(122,183,177,.14)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 45) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y < height; y += 45) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  const cx = width * 0.5;
  const cy = height * 0.53;
  ctx.strokeStyle = "rgba(232,174,74,.2)";
  ctx.beginPath(); ctx.arc(cx, cy, 105, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 180, 0, Math.PI * 2); ctx.stroke();
  enemies.forEach((enemy, index) => {
    const angle = enemy.angle + time * enemy.speed;
    const x = cx + Math.cos(angle) * enemy.radius;
    const y = cy + Math.sin(angle) * enemy.radius * 0.75;
    ctx.fillStyle = index % 2 ? "#c55864" : "#ce7c50";
    ctx.beginPath(); ctx.arc(x, y, enemy.size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(15,25,31,.7)";
    ctx.fillRect(x - enemy.size, y - enemy.size - 6, enemy.size * 2, 3);
    ctx.fillStyle = "#68c8a8";
    ctx.fillRect(x - enemy.size, y - enemy.size - 6, enemy.size * 1.3, 3);
  });
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(time * 0.002) * 0.15);
  ctx.fillStyle = "#e8b24c";
  ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(16, 13); ctx.lineTo(0, 24); ctx.lineTo(-16, 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff0b7";
  ctx.beginPath(); ctx.arc(0, -3, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#ff9d54"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(37, -29); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(255,220,150,.75)";
  ctx.font = "12px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`天工实战验证 · ${state.weapon.name}`, cx, 36);
  requestAnimationFrame(drawArena);
}

function selectedMaterials() {
  return [...document.querySelectorAll("#game-materials input:checked")].map((input) => input.value);
}

function log(message, className = "") {
  const item = document.createElement("span");
  item.className = className;
  item.textContent = message;
  byId("event-log").prepend(item);
}

function setPanel(panel) {
  state.panel = panel;
  document.querySelectorAll("[data-panel]").forEach((button) => button.classList.toggle("active", button.dataset.panel === panel));
  document.querySelectorAll("[data-panel-view]").forEach((view) => view.classList.toggle("active", view.dataset.panelView === panel));
  if (panel === "battle") renderBattleCard();
  if (panel === "inventory") renderHistory();
}

function stageLabel(stage) {
  return { prototype: "武器胚", analysis: "意图解析", trial: "材料试制", combat: "实战验证" }[stage] || "武器胚";
}

function renderWeaponCard() {
  const weapon = state.weapon;
  const visual = weapon.image2d ? `<img class="generated-weapon-thumb" src="${weapon.image2d.dataUri}" alt="${weapon.name} 全新生成图像">` : `<div class="weapon-emblem">${weapon.prototypeName.slice(0, 1)}</div>`;
  byId("weapon-card").innerHTML = `${visual}<div class="weapon-main"><div class="weapon-title"><strong>${weapon.name}</strong><span>${stageLabel(weapon.stage)}</span></div><small>研发等级 Lv.${String(weapon.level).padStart(2, "0")} · ${weapon.instanceId}</small><div class="weapon-effects">${weapon.effects.map((effect) => `<em>${effect}</em>`).join("")}</div></div><div class="weapon-damage"><small>攻击力</small><strong>${weapon.damage}</strong></div>`;
  byId("arena-weapon-label").textContent = `当前武器：${weapon.name}`;
  document.querySelectorAll("[data-stage]").forEach((step) => step.classList.toggle("active", step.dataset.stage === weapon.stage));
}

function renderBattleCard() {
  const weapon = state.weapon;
  const visual = weapon.image2d ? `<img class="generated-weapon-preview" src="${weapon.image2d.dataUri}" alt="${weapon.name}">` : `<div class="weapon-emblem large">${weapon.prototypeName.slice(0, 1)}</div>`;
  byId("battle-card").innerHTML = `<div class="battle-weapon">${visual}<div><span class="eyebrow">EQUIPPED WEAPON</span><h3>${weapon.name}</h3><p>${weapon.effects.join(" · ")}</p></div></div><div class="battle-stats"><div><small>攻击力</small><b>${weapon.damage}</b></div><div><small>研发等级</small><b>Lv.${weapon.level}</b></div><div><small>当前阶段</small><b>${stageLabel(weapon.stage)}</b></div></div>`;
}

function renderHistory() {
  const history = byId("weapon-history");
  if (!state.history.length) {
    history.innerHTML = `<div class="empty-history"><span>库</span><p>还没有完成的自制武器。</p><small>在天工研发所完成第一次试制后，成品会记录在这里。</small></div>`;
    return;
  }
  history.innerHTML = state.history.map((item) => `<article class="history-item">${item.image2d ? `<img class="generated-weapon-thumb" src="${item.image2d.dataUri}" alt="${item.name}">` : `<div class="weapon-emblem">${item.prototypeName.slice(0, 1)}</div>`}<div><strong>${item.name}</strong><small>${item.quality} · ${item.damage} 攻击力 · ${item.effects.join("、")}</small></div><span>新资产</span></article>`).join("");
}

function renderAgentTrace(preview) {
  const operationMode = preview.operationReport.assisted ? "已启用基础工艺辅助" : "已按玩家自定义工艺执行";
  const logic = preview.promptLogic || {}; const failed = (logic.checks || []).filter((check) => !check.passed).map((check) => check.message);
  byId("agent-console").innerHTML = `<div class="console-head"><span class="pulse"></span><strong>天工 Agent 解析完成</strong><small>${preview.agent.provider} · ${preview.ruleVersion}</small></div><div class="trace-grid"><div><small>提示词质量</small><b>${preview.promptScore} / 100</b></div><div><small>逻辑审计</small><b>${escapeHtml(logic.status || "UNKNOWN")} · ${Number(logic.score || 0)}</b></div><div><small>物质输入</small><b>${preview.balanceSheet.matter.input} MU</b></div><div><small>工序能耗</small><b>${preview.operationReport.requiredEnergy} EU</b></div></div><p class="trace-message">${operationMode}。${failed.length ? `需修正：${escapeHtml(failed.join("；"))}` : "材料、工序、因果顺序和效果来源均通过。"} ${preview.conflict.message}。已生成 AssetSpec，原图与原模型仅作画风参考。</p>`;
}

async function renderPreview() {
  const ids = selectedMaterials();
  const materials = MATERIALS.filter((material) => ids.includes(material.id));
  const response = await fetch("/api/v1/craft/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: "pixel_pathfinder_tiangong_demo", playerId: state.player.id, targetType: byId("game-target").value, materialIds: ids, materials, prompt: byId("game-prompt").value, ruleVersion: state.player.ruleVersion, inventoryRevision: state.player.inventoryRevision }) });
  if (!response.ok) throw new Error((await response.json()).error || "解析失败");
  const preview = await response.json();
  state.preview = preview;
  state.asset = null;
  state.weapon.stage = "analysis";
  renderWeaponCard();
  renderAgentTrace(preview);
  byId("game-preview-card").innerHTML = `<div class="preview-ready"><div class="preview-heading"><div><span class="eyebrow">CONSERVATION + ASSET PREVIEW</span><h3>${preview.targetName} · 新的研发记录</h3></div><span class="preview-status">${preview.feasible ? "待生成资产" : "不可执行"}</span></div><div class="preview-score"><strong>${Math.round(preview.successRate * 100)}%</strong><span>规则计算成功率</span><b>效率 ${preview.quality} / 100</b></div><div class="game-info-row"><span>核心效果</span><strong>${preview.effectNames.join("、") || "基础成形"}</strong></div><div class="game-info-row"><span>资产输入</span><strong>${preview.assetSpec.sourceMaterials.map((item) => item.name).join("、")} + 玩家工序 + ${preview.assetSpec.stylePack.version}</strong></div><div class="game-info-row"><span>硬规则</span><strong>不得复用原图/原模型，不得只换色</strong></div><button class="confirm-btn" id="game-generate" ${preview.feasible ? "" : "disabled"}>${preview.feasible ? "生成全新 2D 图像与 3D 模型" : preview.violations[0]}</button></div>`;
  byId("game-generate").addEventListener("click", generateAsset);
  log(`天工 Agent：已生成研发记录与 AssetSpec，提示词评分 ${preview.promptScore}。`);
}

async function generateAsset() {
  if (!state.preview) return;
  const response = await fetch("/api/v1/assets/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: state.preview.requestId }) });
  const asset = await response.json();
  if (!response.ok) throw new Error(asset.error || "资产生成失败");
  state.asset = asset;
  byId("game-preview-card").innerHTML = `<div class="asset-candidate"><img src="${asset.image2d.dataUri}" alt="全新生成道具"><div><span class="eyebrow">NEW ASSET CANDIDATE</span><h3>${asset.assetId}</h3><p>材料覆盖：${asset.audit.materialCoverage ? "通过" : "失败"} · 轮廓相似度 ${Math.round(asset.audit.silhouetteSimilarity * 100)}% / 上限 ${Math.round(asset.audit.silhouetteThreshold * 100)}% · 非简单换色：${asset.audit.simpleRecolorDetected ? "失败" : "通过"}</p><a class="model-download" href="${asset.model3d.dataUri}" download="${asset.model3d.fileName}">下载 3D OBJ 测试模型（${asset.model3d.vertexCount} 顶点）</a></div></div><button class="confirm-btn" id="game-confirm">审核通过，开始材料试制</button><small class="asset-note">当前为本地程序化测试生成器；正式版可替换为图像/3D 大模型，接口不变。</small>`;
  byId("game-confirm").addEventListener("click", confirmCraft);
  log(`资产服务：已生成全新候选资产 ${asset.assetId}，非复用审计通过。`, "good");
}

async function confirmCraft() {
  if (!state.preview) return;
  state.weapon.stage = "trial";
  renderWeaponCard();
  const response = await fetch("/api/v1/craft/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: state.preview.requestId }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "结算失败");
  for (const consumed of result.settlement.consumedMaterials) {
    state.inventory[consumed.materialId] = Math.max(0, (state.inventory[consumed.materialId] || 0) - consumed.amount);
  }
  for (const byproduct of result.settlement.byproducts || []) {
    state.byproducts[byproduct.id] = (state.byproducts[byproduct.id] || 0) + byproduct.amount;
  }
  state.player.inventoryRevision += 1;
  renderMaterials();
  if (result.status === "completed") {
    const item = result.weapon;
    state.weapon = { name: `${item.quality === "epic" ? "天工" : item.quality === "rare" ? "精制" : "试制"}${item.prototypeName}`, prototypeName: item.prototypeName, stage: "combat", quality: item.quality, damage: item.damage, effects: item.effectNames, level: 1, instanceId: item.instanceId, image2d: item.image2d, model3d: item.model3d, assetId: item.assetId };
    state.history.unshift({ ...state.weapon });
    renderWeaponCard();
    renderBattleCard();
    renderHistory();
    byId("game-preview-card").innerHTML = `<div class="craft-success"><img class="generated-weapon-preview" src="${item.image2d.dataUri}" alt="${state.weapon.name}"><div><span class="eyebrow">CRAFT COMPLETE</span><h3>${state.weapon.name}</h3><p>原材料已扣除；全新 2D/3D 资产与 ${result.settlement.byproducts.length} 类副产物已写入游戏背包。</p></div><strong>${item.damage}<small>攻击力</small></strong></div>`;
    log(`游戏服务器：完成试制并装备 ${state.weapon.name}；资产 ${item.assetId} 已签名。`, "good");
  } else {
    state.weapon.stage = "trial";
    renderWeaponCard();
    byId("game-preview-card").innerHTML = `<div class="craft-failed"><span class="failed-seal">试</span><div><span class="eyebrow">TRIAL FAILED</span><h3>${result.outcome}</h3><p>${result.materialLoss}。原材料已按守恒账本扣除，不会复制保留。</p></div></div>`;
    log(`游戏服务器：材料试制失败——${result.outcome}；${result.settlement.conservation}`, "bad");
  }
  state.preview = null;
  state.asset = null;
}

document.querySelectorAll("[data-panel]").forEach((button) => button.addEventListener("click", () => setPanel(button.dataset.panel)));
document.querySelectorAll("[data-open-panel]").forEach((button) => button.addEventListener("click", () => setPanel(button.dataset.openPanel)));
byId("open-tiangong").addEventListener("click", () => setPanel("forge"));
byId("game-preview").addEventListener("click", () => renderPreview().catch((error) => log(`天工错误：${error.message}`, "bad")));
byId("back-studio").addEventListener("click", () => { window.location.href = "../studio/"; });
renderMaterials();
renderWeaponCard();
renderBattleCard();
renderHistory();
requestAnimationFrame(drawArena);
