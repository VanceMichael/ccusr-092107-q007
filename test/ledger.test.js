import test from "node:test";
import assert from "node:assert/strict";

import { Ledger } from "../src/ledger.js";

test("弃餐换里程按约定价值入账，且不能重复结算", () => {
  const ledger = new Ledger();
  ledger.grant({ id: "ent-1", kind: "opt_out_miles", converts_to: { account: "miles", amount: 800 } });
  ledger.resolve("ent-1", { type: "converted", account: "miles", amount: 800 });
  assert.throws(
    () => ledger.resolve("ent-1", { type: "converted", account: "miles", amount: 800 }),
    /重复结算/,
  );
  assert.equal(ledger.checkConserved().miles, 800);
});

test("兑换价值与约定不符即拒绝", () => {
  const ledger = new Ledger();
  ledger.grant({ id: "ent-2", kind: "opt_out_coupon", converts_to: { account: "coupon", amount: 50 } });
  assert.throws(
    () => ledger.resolve("ent-2", { type: "converted", account: "coupon", amount: 60 }),
    /与约定不符/,
  );
});

test("付费升级退款必须等于已付金额", () => {
  const ledger = new Ledger();
  ledger.grant({ id: "ent-3", kind: "paid_upgrade", paid: 120 });
  assert.throws(() => ledger.resolve("ent-3", { type: "refunded", amount: 100 }), /已付金额/);
  ledger.resolve("ent-3", { type: "refunded", amount: 120 });
  assert.equal(ledger.checkConserved().cash, 120);
});

test("基础保障权益不可作废，只能履约、改领餐券或转移", () => {
  const ledger = new Ledger();
  ledger.grant({ id: "ent-4", kind: "special_meal", guaranteed: true });
  assert.throws(() => ledger.resolve("ent-4", { type: "refunded", amount: 0 }), /不允许/);
  ledger.resolve("ent-4", { type: "fulfilled" });
  assert.equal(ledger.checkConserved().meals, 1);
});

test("航班合并时权益转移总数守恒", () => {
  const from = new Ledger();
  const to = new Ledger();
  const moving = [
    { id: "ent-5", kind: "standard_meal" },
    { id: "ent-6", kind: "special_meal", guaranteed: true },
  ];
  for (const ent of moving) from.grant(ent);
  for (const ent of moving) {
    from.transferOut(ent.id, "CA1502");
    to.transferIn(ent, "CA1501");
  }
  to.resolve("ent-5", { type: "fulfilled" });
  to.resolve("ent-6", { type: "fulfilled" });
  assert.equal(from.checkConserved().meals, 0);
  assert.equal(to.checkConserved().meals, 2);
});

test("存在未了结权益时守恒检查失败", () => {
  const ledger = new Ledger();
  ledger.grant({ id: "ent-7", kind: "standard_meal" });
  assert.throws(() => ledger.checkConserved(), /未了结权益/);
});
