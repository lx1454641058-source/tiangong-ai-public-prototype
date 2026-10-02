// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { previewCraft, executeCraft } from "../shared/tiangong-core.mjs";
import { createAndGenerateAsset } from "../shared/tiangong-assets.mjs";

const baseInput = {
  materialIds: ["iron_ore", "fire_core"],
  prompt: "以精铁矿为骨，以火焰核心为刃；先塑形，再封装火焰并分层隔离，最后稳定锻打，牺牲爆发换取持续燃烧。",
  targetType: "sword"
};

const preview = previewCraft(baseInput);
assert.equal(preview.assetSpec.version, "asset_spec_v1", "预览必须生成版本化 AssetSpec");
assert.deepEqual(preview.assetSpec.sourceMaterials.map((item) => item.id).sort(), ["fire_core", "iron_ore"], "AssetSpec 只能记录实际参与工序的材料");
assert.ok(preview.assetSpec.hardRules.some((rule) => rule.includes("不得复用")), "AssetSpec 必须把禁止复用源资产设为硬规则");

const first = createAndGenerateAsset(preview);
const second = createAndGenerateAsset(preview);
assert.equal(first.status, "APPROVED", "测试候选资产必须通过审核");
assert.equal(first.image2d.contentHash, second.image2d.contentHash, "同一提示词、材料、规则和画风必须生成稳定资产");
assert.equal(first.model3d.contentHash, second.model3d.contentHash, "同一输入的 3D 模型必须稳定");
assert.ok(first.image2d.dataUri.startsWith("data:image/svg+xml"), "必须生成可显示的新 2D 图像");
assert.ok(first.model3d.dataUri.startsWith("data:model/obj"), "必须生成可下载的 3D OBJ 模型");
assert.equal(first.audit.sourceAssetBinaryReused, false, "不得复用原道具图像、贴图或模型文件");
assert.equal(first.audit.simpleRecolorDetected, false, "不得把简单换色当成新资产");
assert.ok(first.audit.silhouetteSimilarity < first.audit.silhouetteThreshold, "候选轮廓相似度必须低于厂商阈值");
assert.ok(first.audit.materialCoverage, "生成资产必须覆盖实际投入材料");
assert.ok(first.audit.technical2d && first.audit.technical3d, "2D 与 3D 技术预算必须通过");

const changed = createAndGenerateAsset(previewCraft({
  ...baseInput,
  prompt: "以精铁矿为细长剑骨，将火焰核心嵌入护手；先塑形成骨，再嵌入核心并引导能量，优先迅捷轮廓和集中火光。"
}));
assert.notEqual(first.image2d.contentHash, changed.image2d.contentHash, "改变玩家提示词必须显著改变新图像");
assert.notEqual(first.model3d.contentHash, changed.model3d.contentHash, "改变玩家提示词必须改变 3D 模型参数");

const completed = executeCraft(preview, 0.01, first);
assert.equal(completed.status, "completed", "审核通过的资产可以进入结算");
assert.equal(completed.result.generatedAsset.assetId, first.assetId, "最终道具必须绑定已审核 assetId");
assert.equal(completed.result.generatedAsset.image2d.contentHash, first.image2d.contentHash, "最终道具不能偷偷替换候选图像");

console.log("天工资产生成测试通过：AssetSpec、全新 2D/3D 资产、确定性与非复用审计均正常。");
