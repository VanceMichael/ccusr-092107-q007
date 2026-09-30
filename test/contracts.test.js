import test from "node:test";
import assert from "node:assert/strict";

import { validateAgainst } from "../src/contracts.js";
import { loadScenario } from "../src/fixtures.js";

const scenario = loadScenario();

const cases = [
  ["passenger", scenario.passengers],
  ["flight", scenario.flights],
  ["supplier", scenario.suppliers],
  ["entitlement", scenario.entitlements],
  ["manifest", scenario.manifests],
  ["ledger", scenario.ledger],
  ["redemption", scenario.redemptions],
];

for (const [name, items] of cases) {
  test(`样例 ${name} 符合契约`, () => {
    for (const item of items) {
      assert.deepEqual(validateAgainst(name, item), []);
    }
  });
}

test("脱敏旅客不得携带明文姓名等未约定字段", () => {
  const bad = { ...scenario.passengers[0], full_name: "张三" };
  assert.ok(validateAgainst("passenger", bad).some((e) => e.includes("full_name")));
});

test("脱敏旅客姓名必须打码", () => {
  const bad = { ...scenario.passengers[0], masked_name: "李四" };
  assert.ok(validateAgainst("passenger", bad).length > 0);
});

test("缺少必填字段时校验失败", () => {
  const { pax_ref, ...rest } = scenario.passengers[0];
  assert.ok(validateAgainst("passenger", rest).some((e) => e.includes("pax_ref")));
});

test("权益类型与状态受枚举约束", () => {
  const bad = { ...scenario.entitlements[0], kind: "free_meal" };
  assert.ok(validateAgainst("entitlement", bad).length > 0);
});
