import test from "node:test";
import assert from "node:assert/strict";

import { RedemptionRegister } from "../src/redemption.js";

test("同一权益跨渠道只能兑现一次", () => {
  const register = new RedemptionRegister();
  register.redeem("ent-1", "galley_load", "CA1501-v1");
  assert.throws(
    () => register.redeem("ent-1", "cross_airport_resupply", "CAN-resupply-1"),
    /重复兑现/,
  );
  assert.throws(
    () => register.redeem("ent-1", "supplier_substitution", "SUP-PEK-02"),
    /重复兑现/,
  );
  assert.equal(register.count(), 1);
});

test("离线补录同样受唯一兑现约束", () => {
  const register = new RedemptionRegister();
  register.redeem("ent-2", "galley_load", "CA1501-v1");
  assert.throws(() => register.backfill("ent-2", "offline-sheet-7"), /重复兑现/);

  register.backfill("ent-3", "offline-sheet-7");
  assert.throws(() => register.redeem("ent-3", "galley_load", "CA1501-v2"), /重复兑现/);
  assert.equal(register.count(), 2);
});

test("不同权益互不影响", () => {
  const register = new RedemptionRegister();
  register.redeem("ent-4", "galley_load", "CA1501-v1");
  register.redeem("ent-5", "cross_airport_resupply", "CAN-resupply-1");
  assert.ok(register.isRedeemed("ent-4"));
  assert.ok(register.isRedeemed("ent-5"));
  assert.equal(register.count(), 2);
});
