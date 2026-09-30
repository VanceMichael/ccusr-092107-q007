import test from "node:test";
import assert from "node:assert/strict";

import { loadScenario } from "../src/fixtures.js";
import { checkConservation, checkTransferConservation } from "../src/conservation.js";

const { entitlements, ledger, flights } = loadScenario();

test("样例账目守恒", () => {
  assert.deepEqual(checkConservation(entitlements, ledger, flights), []);
});

test("重复发放积分即破坏守恒", () => {
  const dup = { ...ledger[0], entry_id: "led-901" };
  const violations = checkConservation(entitlements, [...ledger, dup], flights);
  assert.ok(violations.some((v) => v.includes("重复")));
});

test("退款后缺少退款账目即破坏守恒", () => {
  const ents = entitlements.map((e) => (e.entitlement_id === "ent-003" ? { ...e, status: "refunded" } : e));
  assert.ok(checkConservation(ents, ledger, flights).some((v) => v.includes("缺少")));
});

test("金额不符即破坏守恒", () => {
  const bad = ledger.map((l) => (l.entry_id === "led-001" ? { ...l, amount: 500 } : l));
  assert.ok(checkConservation(entitlements, bad, flights).length > 0);
});

test("无源账目即违规", () => {
  const orphan = { ...ledger[0], entry_id: "led-902", entitlement_id: "ent-999" };
  assert.ok(checkConservation(entitlements, [...ledger, orphan], flights).some((v) => v.includes("不存在")));
});

test("航班合并：承接权益与原权益守恒", () => {
  const merged = [
    ...entitlements,
    {
      entitlement_id: "ent-201",
      flight_id: "FLT-DEMO-3",
      pax_ref: "pax-a01",
      kind: "standard",
      status: "transferred",
      value: { unit: "meal", amount: 1 },
      source: "booking",
    },
    {
      entitlement_id: "ent-202",
      flight_id: "FLT-DEMO-1",
      pax_ref: "pax-a01",
      kind: "standard",
      status: "active",
      value: { unit: "meal", amount: 1 },
      source: "merge_transfer",
      transferred_from: "ent-201",
    },
  ];
  assert.deepEqual(checkTransferConservation(merged), []);

  const brokenValue = merged.map((e) =>
    e.entitlement_id === "ent-202" ? { ...e, value: { unit: "meal", amount: 2 } } : e,
  );
  assert.ok(checkTransferConservation(brokenValue).some((v) => v.includes("不守恒")));

  const orphan = merged.filter((e) => e.entitlement_id !== "ent-202");
  assert.ok(checkTransferConservation(orphan).some((v) => v.includes("承接")));
});
