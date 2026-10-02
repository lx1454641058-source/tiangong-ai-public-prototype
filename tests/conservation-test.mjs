// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { executeCraft, previewCraft } from "../shared/tiangong-core.mjs";

const preview = previewCraft({
  materialIds: ["fire_core", "iron_ore"],
  prompt: "制作一把能够持续燃烧的火焰剑。",
  targetType: "sword"
});

assert.equal(preview.feasible, true, "基础工艺测试方案应可执行");
assert.ok(preview.successRate > 0 && preview.successRate < 1, "测试方案必须同时覆盖成功和失败分支");
assert.equal(preview.balanceSheet.matter.input, preview.balanceSheet.matter.product + preview.balanceSheet.matter.byproducts, "预览物质账本必须平衡");
assert.equal(preview.balanceSheet.energy.input, preview.balanceSheet.energy.usefulWork + preview.balanceSheet.energy.productStored + preview.balanceSheet.energy.heatLoss, "预览能量账本必须平衡");

let lowerBound = 0;
for (const expected of preview.failureTable) {
  if (expected.probability <= 0) continue;
  const result = executeCraft(preview, lowerBound + expected.probability / 2);
  const ledger = result.settlement.balanceSheet;
  assert.equal(result.outcome, expected.label, `随机区间必须命中 ${expected.label}`);
  assert.equal(ledger.matter.input, ledger.matter.product + ledger.matter.byproducts, `${expected.label} 的物质必须有完整去向`);
  assert.equal(ledger.energy.input, ledger.energy.productStored + ledger.energy.usefulWork + ledger.energy.heatLoss, `${expected.label} 的能量必须平衡`);
  assert.ok(ledger.value.product + ledger.value.byproducts <= ledger.value.input, `${expected.label} 不能凭空增加价值`);
  assert.ok(Object.values(ledger.audits).every(Boolean), `${expected.label} 必须通过全部守恒审计`);
  assert.deepEqual(result.settlement.consumedMaterialIds.slice().sort(), preview.operationReport.operatedMaterialIds.slice().sort(), `${expected.label} 必须消耗全部被操作的消耗型材料`);
  lowerBound += expected.probability;
}

const forbidden = previewCraft({
  materialIds: ["iron_ore"],
  prompt: "不消耗材料，凭空制作一把无限伤害的火焰剑。",
  targetType: "sword"
});
assert.equal(forbidden.successRate, 0, "违反守恒和库存权威的提示词必须为0%成功率");
assert.equal(forbidden.feasible, false, "违反守恒的方案不能进入结算");

console.log("天工守恒回归测试通过：所有结果分支均无材料复制、能量缺口或价值增殖。");
