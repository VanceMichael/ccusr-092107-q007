// 退票、升舱、航班合并、退款、积分与优惠券调整的守恒检查。
// 每份权益可推导出一组确定的账目影响，实际账目必须与之逐笔对应，不多不少。

export function expectedEffects(entitlement, policy) {
  if (entitlement.status === "transferred") return []; // 已转移，由承接权益结算
  switch (entitlement.kind) {
    case "opt_out_miles":
      return [{ unit: "points", direction: "credit", amount: policy.opt_out_miles, kind: "points" }];
    case "opt_out_coupon":
      return [{ unit: "cny", direction: "credit", amount: policy.opt_out_coupon_cny, kind: "coupon" }];
    case "paid_upgrade": {
      const effects = [{ unit: "cny", direction: "debit", amount: entitlement.value.amount, kind: "payment" }];
      if (entitlement.status === "refunded" || entitlement.status === "cancelled") {
        effects.push({ unit: "cny", direction: "credit", amount: entitlement.value.amount, kind: "refund" });
      }
      return effects;
    }
    case "delay_voucher":
      return [{ unit: "cny", direction: "credit", amount: policy.delay_voucher_cny, kind: "voucher" }];
    default:
      return [];
  }
}

const keyOf = (e) => `${e.unit}|${e.direction}|${e.amount}|${e.kind}`;

export function checkConservation(entitlements, ledger, flights) {
  const violations = [];
  const policyByFlight = new Map(flights.map((f) => [f.flight_id, f.policy]));
  const entById = new Map(entitlements.map((e) => [e.entitlement_id, e]));

  for (const entry of ledger) {
    if (!entById.has(entry.entitlement_id)) {
      violations.push(`账目 ${entry.entry_id} 引用了不存在的权益 ${entry.entitlement_id}`);
    }
  }

  for (const ent of entitlements) {
    const policy = policyByFlight.get(ent.flight_id);
    if (!policy) {
      violations.push(`权益 ${ent.entitlement_id} 的航班 ${ent.flight_id} 不存在`);
      continue;
    }
    const expected = new Map();
    for (const e of expectedEffects(ent, policy)) {
      expected.set(keyOf(e), (expected.get(keyOf(e)) ?? 0) + 1);
    }
    const actual = new Map();
    for (const entry of ledger.filter((l) => l.entitlement_id === ent.entitlement_id)) {
      actual.set(keyOf(entry), (actual.get(keyOf(entry)) ?? 0) + 1);
    }
    for (const [key, count] of expected) {
      const got = actual.get(key) ?? 0;
      if (got < count) {
        violations.push(`权益 ${ent.entitlement_id} 缺少调整 ${key}（应有 ${count} 笔，实际 ${got} 笔）`);
      } else if (got > count) {
        violations.push(`权益 ${ent.entitlement_id} 调整 ${key} 重复（应有 ${count} 笔，实际 ${got} 笔）`);
      }
    }
    for (const [key, count] of actual) {
      if (!expected.has(key)) {
        violations.push(`权益 ${ent.entitlement_id} 存在无依据调整 ${key}（${count} 笔）`);
      }
    }
  }
  return violations;
}

// 航班合并：承接权益与原权益在旅客、餐型与价值上守恒，原权益不得重复结算。
export function checkTransferConservation(entitlements) {
  const violations = [];
  const byId = new Map(entitlements.map((e) => [e.entitlement_id, e]));
  const transferredFrom = new Set();

  for (const ent of entitlements) {
    if (ent.source !== "merge_transfer") continue;
    if (!ent.transferred_from) {
      violations.push(`权益 ${ent.entitlement_id} 缺少转移来源`);
      continue;
    }
    transferredFrom.add(ent.transferred_from);
    const original = byId.get(ent.transferred_from);
    if (!original) {
      violations.push(`权益 ${ent.entitlement_id} 的来源 ${ent.transferred_from} 不存在`);
      continue;
    }
    if (original.status !== "transferred") {
      violations.push(`原权益 ${original.entitlement_id} 未标记为已转移`);
    }
    if (original.pax_ref !== ent.pax_ref || original.kind !== ent.kind) {
      violations.push(`权益 ${ent.entitlement_id} 与来源在旅客或餐型上不守恒`);
    }
    if (original.value.unit !== ent.value.unit || original.value.amount !== ent.value.amount) {
      violations.push(`权益 ${ent.entitlement_id} 与来源在价值上不守恒`);
    }
  }
  for (const ent of entitlements) {
    if (ent.status === "transferred" && !transferredFrom.has(ent.entitlement_id)) {
      violations.push(`权益 ${ent.entitlement_id} 已转移但没有承接权益`);
    }
  }
  return violations;
}
