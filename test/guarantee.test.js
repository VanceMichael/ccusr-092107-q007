import test from "node:test";
import assert from "node:assert/strict";

import { loadScenario } from "../src/fixtures.js";
import { checkSpecialGuarantee } from "../src/guarantee.js";

const { passengers, entitlements } = loadScenario();

test("特殊旅客基础保障存在", () => {
  assert.deepEqual(checkSpecialGuarantee(passengers, entitlements), []);
});

test("取消儿童保障餐即违规", () => {
  const ents = entitlements.filter((e) => e.entitlement_id !== "ent-004");
  assert.ok(checkSpecialGuarantee(passengers, ents).some((v) => v.includes("pax-d04")));
});

test("保障餐缺少保障标识即违规", () => {
  const ents = entitlements.map((e) => (e.entitlement_id === "ent-005" ? { ...e, guaranteed: false } : e));
  assert.ok(checkSpecialGuarantee(passengers, ents).some((v) => v.includes("保障标识")));
});
