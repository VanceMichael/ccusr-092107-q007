import { effectiveManifest } from "./manifest.js";

export const REDEEMABLE_KINDS = ["standard", "special_child", "special_low_sugar", "paid_upgrade", "delay_voucher"];

// 同一权益不得兑现两次；离线补录按幂等键去重；
// 每笔兑现必须对应该航班唯一有效的装载版本。
export function checkRedemptions(redemptions, entitlements, manifests) {
  const violations = [];
  const entById = new Map(entitlements.map((e) => [e.entitlement_id, e]));
  const seenEnt = new Set();
  const seenKeys = new Set();

  for (const red of redemptions) {
    if (seenEnt.has(red.entitlement_id)) {
      violations.push(`权益 ${red.entitlement_id} 被重复兑现`);
    }
    seenEnt.add(red.entitlement_id);
    if (seenKeys.has(red.idempotency_key)) {
      violations.push(`幂等键 ${red.idempotency_key} 重复（疑似离线补录重放）`);
    }
    seenKeys.add(red.idempotency_key);

    const ent = entById.get(red.entitlement_id);
    if (!ent) {
      violations.push(`兑现 ${red.redemption_id} 引用了不存在的权益 ${red.entitlement_id}`);
      continue;
    }
    if (!REDEEMABLE_KINDS.includes(ent.kind)) {
      violations.push(`权益 ${ent.entitlement_id} 类型 ${ent.kind} 不可兑现`);
    }
    if (ent.status !== "redeemed") {
      violations.push(`权益 ${ent.entitlement_id} 状态 ${ent.status} 与兑现记录不一致`);
    }
    const effective = effectiveManifest(manifests, ent.flight_id);
    if (!effective) {
      violations.push(`航班 ${ent.flight_id} 没有唯一有效装载版本`);
    } else if (red.manifest_id !== effective.manifest_id) {
      violations.push(`兑现 ${red.redemption_id} 未对应有效装载版本 ${effective.manifest_id}`);
    }
  }

  for (const ent of entitlements) {
    if (ent.status === "redeemed" && !seenEnt.has(ent.entitlement_id)) {
      violations.push(`权益 ${ent.entitlement_id} 标记已兑现但缺少兑现记录`);
    }
  }
  return violations;
}
