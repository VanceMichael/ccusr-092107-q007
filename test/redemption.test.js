import test from "node:test";
import assert from "node:assert/strict";

import { loadScenario } from "../src/fixtures.js";
import { checkRedemptions } from "../src/redemption.js";

const { redemptions, entitlements, manifests } = loadScenario();

test("样例兑现记录有效", () => {
  assert.deepEqual(checkRedemptions(redemptions, entitlements, manifests), []);
});

test("同一权益不得兑现两次", () => {
  const dup = { ...redemptions[0], redemption_id: "red-901", idempotency_key: "k-901" };
  const violations = checkRedemptions([...redemptions, dup], entitlements, manifests);
  assert.ok(violations.some((v) => v.includes("重复兑现")));
});

test("离线补录按幂等键去重", () => {
  const replay = { ...redemptions[0], redemption_id: "red-902", source: "offline_backfill" };
  const violations = checkRedemptions([...redemptions, replay], entitlements, manifests);
  assert.ok(violations.some((v) => v.includes("幂等键")));
});

test("兑现必须对应唯一有效装载版本", () => {
  const stale = [{ ...redemptions[0], manifest_id: "m-199" }, redemptions[1]];
  const violations = checkRedemptions(stale, entitlements, manifests);
  assert.ok(violations.some((v) => v.includes("有效装载版本")));
});

test("标记已兑现的权益必须有兑现记录", () => {
  const violations = checkRedemptions([redemptions[1]], entitlements, manifests);
  assert.ok(violations.some((v) => v.includes("ent-101")));
});
