import { EFFECTS, MATERIALS, MATERIAL_OPERATIONS } from "../shared/tiangong-core.mjs";
import { PIXEL_PATHFINDER_KNOWLEDGE, PIXEL_PATHFINDER_MANIFEST } from "../knowledge/pixel-pathfinder.mjs";
import { CONSERVATION_LAWS, LEDGER_DEFINITIONS } from "../knowledge/tiangong-ontology.mjs";

const byId = (id) => document.getElementById(id);
let activePreview = null;
const APP_STATE_KEY = "tiangong-studio-flow-v1";
const defaultAppState = {
  authenticated: false,
  onboardingDone: false,
  user: { name: "演示团队", email: "demo@tiangong.ai", company: "天工演示团队" },
  projectCreated: false,
  partnershipSubmitted: false,
  runtimeConnected: false,
  testPassed: false,
  versionLocked: false,
  project: { name: "Pixel Pathfinder", engine: "Godot 4.3", platform: "PC / Web", useCase: "武器锻造" },
  applicationId: ""
};

function readAppState() {
  try {
    const saved = JSON.parse(localStorage.getItem(APP_STATE_KEY) || "null");
    return {
      ...defaultAppState,
      ...saved,
      user: { ...defaultAppState.user, ...(saved?.user || {}) },
      project: { ...defaultAppState.project, ...(saved?.project || {}) }
    };
  } catch {
    return structuredClone(defaultAppState);
  }
}

let appState = readAppState();

function saveAppState() {
  localStorage.setItem(APP_STATE_KEY, JSON.stringify(appState));
}

function showElement(id, visible) {
  byId(id)?.classList.toggle("is-hidden", !visible);
}

const onboardingSlides = [
  {
    kicker: "01 · ENGINE BOUNDARY",
    title: "天工让玩家创造，但把边界留给厂商。",
    text: "厂商提供游戏原生材料、数值上限、世界观和画风；玩家通过提示词探索组合；天工负责理解、计算、生成和审核。",
    cards: [["厂商", "定义材料、规则和审核边界"], ["天工", "提供Agent、RAG和守恒引擎"], ["玩家", "选择材料并描述自己的工艺"]]
  },
  {
    kicker: "02 · HOW IT WORKS",
    title: "从原生材料到新道具，每一步都可追踪。",
    text: "提示词先被转成结构化操作计划，再交给确定性规则引擎计算成功率、材料消耗和产物价值，模型不能直接修改库存。",
    cards: [["输入", "原生材料 + 提示词 + 游戏规则"], ["裁决", "RAG检索 + Agent规划 + 五账本"], ["输出", "新道具、碎片、废料和审计凭证"]]
  },
  {
    kicker: "03 · PARTNER JOURNEY",
    title: "用一条完整流程，把原型走到可交付版本。",
    text: "接下来你会创建项目、提交合作申请、查看接口方案，并在开发测试台跑通成功、失败、扣料和资产生成。",
    cards: [["创建项目", "登记游戏引擎和首个接入能力"], ["联合联调", "调用Runtime预览API并查看Agent Trace"], ["验收上线", "锁定版本并生成接入清单"]]
  }
];
let onboardingIndex = 0;

function renderOnboarding() {
  const slide = onboardingSlides[onboardingIndex];
  const icons = ["◈", "✦", "⚒"];
  const cards = slide.cards.map((card, index) => '<article class="onboarding-feature"><span>' + icons[index] + '</span><strong>' + card[0] + '</strong><small>' + card[1] + '</small></article>').join("");
  byId("onboarding-content").innerHTML = '<span class="onboarding-kicker">' + slide.kicker + '</span><h1>' + slide.title + '</h1><p>' + slide.text + '</p><div class="onboarding-grid">' + cards + '</div>';
  byId("onboarding-count").textContent = "0" + (onboardingIndex + 1) + " / 03";
  byId("onboarding-progress-bar").style.width = ((onboardingIndex + 1) / onboardingSlides.length) * 100 + "%";
  byId("onboarding-next").textContent = onboardingIndex === onboardingSlides.length - 1 ? "进入工作台" : "下一步";
}

function showStudio() {
  showElement("auth-screen", false);
  showElement("onboarding-screen", false);
  showElement("studio-shell", true);
  const userName = appState.user.company || appState.user.name || "演示团队";
  byId("account-name").textContent = userName;
  byId("account-email").textContent = appState.user.email;
  byId("account-avatar").textContent = userName.slice(0, 1);
  byId("sidebar-project-name").textContent = appState.project.name;
  byId("sidebar-project-meta").textContent = appState.project.engine + " · " + appState.project.platform;
  byId("project-game-name").value = appState.project.name;
  byId("project-engine").value = appState.project.engine;
  byId("project-platform").value = appState.project.platform;
  byId("project-use-case").value = appState.project.useCase;
  updateWorkflowUI();
}

function bootAuth() {
  if (appState.authenticated) {
    if (appState.onboardingDone) showStudio();
    else {
      showElement("auth-screen", false);
      showElement("onboarding-screen", true);
      showElement("studio-shell", false);
      renderOnboarding();
    }
  } else {
    showElement("auth-screen", true);
    showElement("onboarding-screen", false);
    showElement("studio-shell", false);
  }
}

function setAuthMode(mode) {
  const register = mode === "register";
  document.querySelectorAll(".auth-tab").forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
  document.querySelectorAll(".auth-register-only").forEach((element) => element.classList.toggle("is-hidden", !register));
  byId("auth-eyebrow").textContent = register ? "CREATE YOUR WORKSPACE" : "WELCOME BACK";
  byId("auth-title").textContent = register ? "创建厂商工作台" : "进入天工工作台";
  byId("auth-description").textContent = register ? "注册后可以创建项目、申请合作并保存联调进度。" : "使用演示账号即可体验完整接入流程。";
  byId("auth-submit").textContent = register ? "注册并开始导览" : "登录并进入工作台";
  byId("auth-hint").textContent = register ? "注册信息仅保存于本地原型，用于模拟账号系统。" : "演示账号：demo@tiangong.ai / tiangong123";
}

function setProgressStatus(view, message) {
  const labels = { overview: "接入阶段 1 / 6 · 工作台", capabilities: "接入阶段 2 / 6 · 了解天工", project: "接入阶段 3 / 6 · 创建项目", partnership: "接入阶段 4 / 6 · 合作申请", sandbox: "接入阶段 5 / 6 · 开发联调", launch: "接入阶段 6 / 6 · 验收上线" };
  byId("release-chip").textContent = message || labels[view] || "引擎配置";
}

function updateWorkflowUI() {
  const state = appState;
  const doneCount = 1 + Number(state.projectCreated) + Number(state.partnershipSubmitted) + Number(state.runtimeConnected) + Number(state.testPassed) + Number(state.versionLocked);
  byId("project-status-chip").textContent = state.projectCreated ? "已登记 · " + state.project.name : "尚未提交";
  byId("sidebar-project-name").textContent = state.project.name;
  byId("sidebar-project-meta").textContent = state.project.engine + " · " + state.project.platform;
  byId("partnership-status-chip").textContent = state.partnershipSubmitted ? "评估中 · " + state.applicationId : "待提交";
  byId("project-form-message").textContent = state.projectCreated ? "项目已保存：" + state.project.name + " · " + state.project.useCase : "保存后即可生成合作申请和接口清单。";
  byId("launch-score").textContent = doneCount + " / 6";
  byId("overview-progress-count").textContent = doneCount + " / 6";
  byId("launch-check-label").textContent = doneCount === 6 ? "已完成" : "进行中";
  byId("launch-status-chip").textContent = doneCount === 6 ? "可交付" : "已完成 " + doneCount + " / 6";
  const checks = { project: state.projectCreated, partner: state.partnershipSubmitted, runtime: state.runtimeConnected, test: state.testPassed, audit: state.versionLocked };
  document.querySelectorAll(".readiness-item").forEach((item) => {
    const key = item.dataset.check;
    const done = key === "account" || Boolean(checks[key]);
    item.classList.toggle("done", done);
    item.querySelector("span").textContent = done ? "✓" : item.querySelector("span").textContent;
    item.querySelector("em").textContent = done ? "已完成" : "待完成";
  });
  const readyToLaunch = state.projectCreated && state.partnershipSubmitted && state.runtimeConnected && state.testPassed;
  byId("launch-btn").disabled = !readyToLaunch || state.versionLocked;
  byId("launch-title").textContent = state.versionLocked ? "天工接入版本已经成型。" : readyToLaunch ? "所有联调项已通过，可以生成交付版本。" : "完成下面的检查，就可以形成第一个可交付版本。";
  if (state.versionLocked) showElement("launch-success", true);
}
const sandboxMaterials = MATERIALS.map((material) => ({
  ...material,
  id: `native:sandbox:${material.id}`,
  tags: [...material.tags, "native", "studio_fixture"]
}));

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderNativeMappings() {
  byId("materials-grid").innerHTML = sandboxMaterials.map((material) => `
    <article class="data-card">
      <div class="data-top"><h3>${escapeHtml(material.name)}</h3><span class="tag">原生映射</span></div>
      <p><code>${escapeHtml(material.id)}</code><br>状态：${escapeHtml(material.state)} · 类型：${escapeHtml(material.kind)}</p>
      <div class="meter"><i style="width:${Math.min(100, material.matterUnits * 6)}%"></i></div>
      <small>${material.matterUnits} MU · ${material.storedEnergy} EU · ${material.valueUnits} VU<br>潜能：${escapeHtml(Object.entries(material.traits).map(([key, value]) => `${key} ${value}`).join("、"))}</small>
    </article>
  `).join("");
}

function renderKnowledge() {
  byId("knowledge-count").textContent = String(PIXEL_PATHFINDER_KNOWLEDGE.length);
  byId("knowledge-grid").innerHTML = PIXEL_PATHFINDER_KNOWLEDGE.map((document) => `
    <article class="data-card knowledge-card">
      <div class="data-top"><h3>${escapeHtml(document.id)}</h3><span class="tag">${escapeHtml(document.type)}</span></div>
      <p>${escapeHtml(document.content)}</p>
      <div class="doc-meta"><span>${escapeHtml(document.targetTypes.join(" / "))}</span><span>${escapeHtml(document.tags.slice(0, 3).join(" · "))}</span></div>
    </article>
  `).join("");
}

function renderEffects() {
  byId("effects-grid").innerHTML = Object.values(EFFECTS).map((effect) => `
    <article class="data-card">
      <div class="data-top"><h3>${escapeHtml(effect.name)}</h3><span class="tag">${escapeHtml(effect.id)}</span></div>
      <p>所需属性潜能：<code>${escapeHtml(effect.trait)}</code></p>
      <div class="meter"><i style="width:${Math.min(100, effect.requirement * 8)}%"></i></div>
      <small>最低门槛 ${effect.requirement} TP · 关键词：${escapeHtml(effect.keywords.join("、"))}</small>
    </article>
  `).join("");
}

function renderMaterialPicker() {
  byId("studio-materials").innerHTML = sandboxMaterials.map((material, index) => `
    <label class="material-check"><input type="checkbox" value="${escapeHtml(material.id)}" ${index === 0 || index === 3 ? "checked" : ""}><span>${escapeHtml(material.name)}</span></label>
  `).join("");
}

function renderAgentResult(preview) {
  const agent = preview.agent || {};
  const retrieved = Array.isArray(agent.retrieved) ? agent.retrieved : [];
  const operationReport = preview.operationReport || {};
  const operationSteps = Array.isArray(operationReport.steps) ? operationReport.steps : [];
  const balance = preview.balanceSheet || {};
  const promptLogic = preview.promptLogic || {};
  const logicChecksHtml = (promptLogic.checks || []).map((check) => `<li><b>${check.passed ? "✓" : check.severity === "error" ? "✕" : "!"} ${escapeHtml(check.id)}</b><span>${escapeHtml(check.message)}</span></li>`).join("");
  const operationsHtml = operationSteps.length
    ? operationSteps.map((step) => `<li><b>${Number(step.order)}. ${escapeHtml(step.actionName)}${step.assisted ? "（辅助）" : ""}</b><span>${escapeHtml((step.materialNames || []).join("、"))}</span><small>${step.energyCost} EU · 效率 ${Math.round(step.transferEfficiency * 100)}% · ${escapeHtml(step.sourceText || step.purpose || "")}</small></li>`).join("")
    : "<li><span>提示词没有生成可执行材料操作</span></li>";
  const retrievalHtml = retrieved.length
    ? retrieved.map((entry) => `<li><code>${escapeHtml(entry.id)}</code><span>${Number(entry.score || 0).toFixed(2)}</span></li>`).join("")
    : "<li><span>未检索到知识</span></li>";
  byId("studio-result").className = "result-content agent-result";
  byId("studio-result").innerHTML = `
    <div>
      <div class="result-visual"><div class="weapon">⚙</div><strong>${escapeHtml(preview.summary)}</strong><small>${escapeHtml(agent.provider || "unknown")} · ${escapeHtml(preview.ruleVersion)}</small></div>
      <div class="trace"><strong>Agent 生成的 CraftPlan</strong>规划模式：${operationReport.assisted ? "基础工艺辅助" : "玩家自定义工艺"}<br>效果：${escapeHtml((agent.requestedEffects || []).join("、") || "由材料推断")}<br>操作覆盖：${Number(operationReport.coverage || 0)}% · 工序能耗：${Number(operationReport.requiredEnergy || 0)} EU<br>上下文哈希：${escapeHtml(agent.promptContextHash || "无")}</div>
      <div class="retrieval-box"><strong>提示词逻辑审计：${escapeHtml(promptLogic.status || "UNKNOWN")} · ${Number(promptLogic.score || 0)} / 100</strong><ul>${logicChecksHtml}</ul></div>
      <div class="retrieval-box"><strong>按提示词执行的材料操作</strong><ol>${operationsHtml}</ol></div>
      <div class="asset-spec-box"><strong>AssetSpec 资产规格</strong><p>${escapeHtml((preview.assetSpec?.sourceMaterials || []).map((item) => item.name).join(" + "))}<br>${escapeHtml(preview.assetSpec?.stylePack?.artDirection || "未配置画风包")}</p><small>硬规则：不复用原图/原模型，不接受简单换色。</small><button class="primary-btn full" id="studio-generate-asset" ${preview.feasible ? "" : "disabled"}>生成并审核全新 2D/3D 候选资产</button></div>
      <div id="studio-asset-result"></div>
    </div>
    <div class="result-info">
      <h4>规则引擎裁决</h4>
      <div class="score">${Math.round(Number(preview.successRate || 0) * 100)}% <small>成功率</small></div>
      <div class="info-row"><span>提示词评分</span><b>${Number(preview.promptScore || 0)} / 100</b></div>
      <div class="info-row"><span>逻辑审计</span><b>${escapeHtml(promptLogic.status || "UNKNOWN")} · ${Number(promptLogic.score || 0)} / 100</b></div>
      <div class="info-row"><span>材料匹配</span><b>${Number(preview.materialMatch || 0)} / 100</b></div>
      <div class="info-row"><span>物质守恒</span><b>${Number(balance.matter?.input || 0)} = ${Number(balance.matter?.product || 0)} + ${Number(balance.matter?.byproducts || 0)} MU</b></div>
      <div class="info-row"><span>能量守恒</span><b>${Number(balance.energy?.input || 0)} = ${Number(balance.energy?.usefulWork || 0)} + ${Number(balance.energy?.productStored || 0)} + ${Number(balance.energy?.heatLoss || 0)} EU</b></div>
      <div class="info-row"><span>价值上限</span><b>${Number(balance.value?.product || 0) + Number(balance.value?.byproducts || 0)} / ${Number(balance.value?.input || 0)} VU</b></div>
      <div class="info-row"><span>最终复杂度</span><b>${Number(balance.entropy?.final || 0)} EP</b></div>
      <div class="info-row"><span>最终效果</span><b>${escapeHtml((preview.effectNames || []).join("、"))}</b></div>
      <div class="retrieval-box"><strong>RAG 检索命中</strong><ul>${retrievalHtml}</ul></div>
      <div class="failure-preview">失败分布：${escapeHtml((preview.outcomes || []).map((entry) => `${entry.label} ${Math.round(entry.probability * 100)}%`).join(" · "))}</div>
    </div>
  `;
  byId("studio-generate-asset")?.addEventListener("click", () => generateAsset().catch((error) => {
    byId("studio-asset-result").innerHTML = `<div class="failure-preview">资产生成失败：${escapeHtml(error.message)}</div>`;
  }));
}

async function generateAsset() {
  if (!activePreview) return;
  const button = byId("studio-generate-asset");
  button.disabled = true;
  button.textContent = "正在生成与审核…";
  const response = await fetch("/api/v1/assets/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: activePreview.requestId }) });
  const asset = await response.json();
  if (!response.ok) throw new Error(asset.error || "资产生成失败");
  byId("studio-asset-result").innerHTML = `<article class="studio-asset-card"><img src="${asset.image2d.dataUri}" alt="全新生成的候选道具"><div><span class="tag">${escapeHtml(asset.status)}</span><h4>${escapeHtml(asset.assetId)}</h4><p>输入材料、CraftPlan、玩家提示词与 StylePack 共同决定此资产。</p><ul><li>未复用源文件：${asset.audit.sourceAssetBinaryReused ? "失败" : "通过"}</li><li>非简单换色：${asset.audit.simpleRecolorDetected ? "失败" : "通过"}</li><li>轮廓相似度：${Math.round(asset.audit.silhouetteSimilarity * 100)}%（上限 ${Math.round(asset.audit.silhouetteThreshold * 100)}%）</li><li>材料覆盖：${asset.audit.materialCoverage ? "通过" : "失败"}</li><li>2D/3D 技术规格：${asset.audit.technical2d && asset.audit.technical3d ? "通过" : "失败"}</li></ul><a href="${asset.model3d.dataUri}" download="${asset.model3d.fileName}">下载 OBJ 测试模型 · ${asset.model3d.vertexCount} 顶点 / ${asset.model3d.faceCount} 面</a><small>当前 provider：${escapeHtml(asset.provider)}（本地测试，不是正式生成模型）</small></div></article>`;
  button.textContent = "已生成，可再次生成验证确定性";
  button.disabled = false;
}

async function runPreview() {
  const button = byId("studio-run");
  const selectedIds = new Set([...document.querySelectorAll("#studio-materials input:checked")].map((input) => input.value));
  const materials = sandboxMaterials.filter((material) => selectedIds.has(material.id));
  button.disabled = true;
  byId("studio-preview-badge").textContent = "运行中";
  byId("studio-preview-badge").classList.remove("ready");
  try {
    const response = await fetch("/api/v1/craft/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: "pixel_pathfinder_tiangong_demo",
        playerId: "studio_test_player",
        targetType: byId("studio-target").value,
        materialIds: materials.map((material) => material.id),
        materials,
        prompt: byId("studio-prompt").value,
        ruleVersion: PIXEL_PATHFINDER_MANIFEST.ruleVersion,
        inventoryRevision: "studio-fixture-v1"
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    activePreview = payload;
    appState.runtimeConnected = true;
    appState.testPassed = Boolean(payload.feasible);
    saveAppState();
    updateWorkflowUI();
    byId("studio-preview-badge").textContent = "已完成";
    byId("studio-preview-badge").classList.add("ready");
    renderAgentResult(payload);
  } catch (error) {
    byId("studio-preview-badge").textContent = "失败";
    byId("studio-result").className = "empty-result error-result";
    byId("studio-result").innerHTML = `<div class="empty-icon">!</div><p>Agent 预览失败</p><small>${escapeHtml(error.message)}</small>`;
  } finally {
    button.disabled = false;
  }
}

const viewLabels = {
  overview: "引擎总览",
  capabilities: "了解天工",
  project: "项目与数据接入",
  partnership: "联系合作",
  knowledge: "RAG 知识库",
  agent: "Agent 与模型",
  rules: "规则引擎",
  sandbox: "开发测试台",
  adapter: "Runtime SDK",
  launch: "验收上线",
  release: "发布与审计"
};

function setView(view) {
  document.querySelectorAll(".view").forEach((element) => element.classList.toggle("active", element.id === `${view}-view`));
  document.querySelectorAll(".nav-item").forEach((element) => element.classList.toggle("active", element.dataset.view === view));
  byId("page-title").textContent = viewLabels[view] || "天工 Studio";
  setProgressStatus(view);
  const nextViews = { overview: "capabilities", capabilities: "project", project: "partnership", partnership: "sandbox", sandbox: "launch" };
  const action = byId("header-action");
  if (action) {
    action.textContent = nextViews[view] ? "继续接入" : "查看工作台";
    action.onclick = () => setView(nextViews[view] || "overview");
  }
}

function markSaved(message) {
  byId("release-chip").textContent = message;
}

function handleProjectSave() {
  const name = byId("project-game-name").value.trim();
  if (!name) {
    byId("project-form-message").textContent = "请先填写游戏名称。";
    return;
  }
  appState.project = {
    name,
    engine: byId("project-engine").value,
    platform: byId("project-platform").value,
    useCase: byId("project-use-case").value
  };
  appState.projectCreated = true;
  saveAppState();
  updateWorkflowUI();
  markSaved("项目已保存 · 下一步联系合作");
  setView("partnership");
}

function handlePartnershipSubmit() {
  const contact = byId("partner-contact").value.trim();
  const email = byId("partner-email").value.trim();
  if (!contact || !email) {
    byId("partnership-form-message").textContent = "请填写联系人姓名和工作邮箱后再提交。";
    return;
  }
  const stamp = String(Date.now()).slice(-6);
  appState.applicationId = "TG-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + stamp;
  appState.partnershipSubmitted = true;
  saveAppState();
  byId("application-id").textContent = appState.applicationId;
  byId("partnership-form-message").textContent = "申请已提交，原型已为你创建联调空间。";
  showElement("application-result", true);
  updateWorkflowUI();
  markSaved("合作申请已提交 · " + appState.applicationId);
}

function finishLaunch() {
  const ready = appState.projectCreated && appState.partnershipSubmitted && appState.runtimeConnected && appState.testPassed;
  if (!ready) return;
  appState.versionLocked = true;
  saveAppState();
  byId("launch-version").textContent = "TG-" + String(appState.project.name).replaceAll(/\s+/g, "-").toUpperCase().slice(0, 12) + "-0.5.0";
  updateWorkflowUI();
  markSaved("接入版本已成型 · 可交付");
}

function showStudioFromOnboarding() {
  appState.onboardingDone = true;
  saveAppState();
  showStudio();
}

document.querySelectorAll(".auth-tab").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
byId("auth-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const register = document.querySelector(".auth-tab.active")?.dataset.authMode === "register";
  const email = byId("auth-email").value.trim();
  const password = byId("auth-password").value;
  const company = byId("auth-company").value.trim();
  if (!email || password.length < 8 || (register && !company)) {
    byId("auth-hint").textContent = register ? "请填写公司名称、邮箱和至少8位密码。" : "请填写邮箱和至少8位密码。";
    return;
  }
  appState.authenticated = true;
  appState.user = { name: company || "演示团队", company: company || "演示团队", email };
  saveAppState();
  if (!appState.onboardingDone) {
    showElement("auth-screen", false);
    showElement("onboarding-screen", true);
    renderOnboarding();
  } else showStudio();
});
byId("onboarding-next").addEventListener("click", () => {
  if (onboardingIndex < onboardingSlides.length - 1) {
    onboardingIndex += 1;
    renderOnboarding();
  } else showStudioFromOnboarding();
});
byId("onboarding-skip").addEventListener("click", showStudioFromOnboarding);
byId("logout-btn").addEventListener("click", () => {
  appState.authenticated = false;
  saveAppState();
  bootAuth();
});
document.querySelectorAll("[data-use-case]").forEach((button) => button.addEventListener("click", () => {
  byId("project-use-case").value = button.dataset.useCase;
  setView("project");
  byId("project-form-message").textContent = "已选择能力：" + button.dataset.useCase + "，请补充游戏信息。";
}));
byId("create-project-btn").addEventListener("click", handleProjectSave);
byId("submit-partnership-btn").addEventListener("click", handlePartnershipSubmit);
byId("launch-btn").addEventListener("click", finishLaunch);
byId("help-btn").addEventListener("click", () => {
  setView("partnership");
  byId("partnership-form-message").textContent = "需要合作咨询？填写表单即可创建天工合作申请。";
});
byId("download-manifest-btn")?.addEventListener("click", () => {
  const manifest = { project: appState.project, applicationId: appState.applicationId, ruleVersion: PIXEL_PATHFINDER_MANIFEST.ruleVersion, sdkVersion: "0.5.0", generatedAt: new Date().toISOString() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "tiangong-integration-manifest.json";
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelectorAll("[data-view-jump]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewJump)));
byId("studio-run").addEventListener("click", runPreview);
byId("release-btn").addEventListener("click", () => markSaved("试用版本 0.5 · 待验证"));
byId("reindex-btn").addEventListener("click", () => {
  byId("reindex-btn").textContent = `索引完成 · ${PIXEL_PATHFINDER_KNOWLEDGE.length} 文档`;
});

renderNativeMappings();
renderKnowledge();
renderEffects();
renderMaterialPicker();

byId("laws-grid").innerHTML = CONSERVATION_LAWS.map((law) => `<article class="data-card"><div class="data-top"><h3>${escapeHtml(law.name)}</h3><span class="tag">硬约束</span></div><p>${escapeHtml(law.description)}</p></article>`).join("");
byId("ledgers-grid").innerHTML = Object.entries(LEDGER_DEFINITIONS).map(([id, ledger]) => `<article class="data-card"><div class="data-top"><h3>${escapeHtml(ledger.name)}</h3><span class="tag">${escapeHtml(ledger.unit)}</span></div><p>${escapeHtml(ledger.invariant)}</p></article>`).join("");
byId("operations-grid").innerHTML = Object.values(MATERIAL_OPERATIONS).map((operation) => `<article class="data-card"><div class="data-top"><h3>${escapeHtml(operation.name)}</h3><span class="tag">${escapeHtml(operation.id)}</span></div><p>能耗 ${operation.energyCost} EU · 转移效率 ${Math.round(operation.transferEfficiency * 100)}% · 复杂度 ${operation.entropy >= 0 ? "+" : ""}${operation.entropy} EP</p></article>`).join("");
bootAuth();
