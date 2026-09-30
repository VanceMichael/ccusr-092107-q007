// 权益兑现登记：同一权益在任何渠道只能兑现一次。
// 渠道包括机上装载、跨机场补配、供应商替换与离线补录；
// 离线补录先记为待核对，联机对账时若发现已兑现则必须冲正。
export const CHANNELS = ["galley_load", "cross_airport_resupply", "supplier_substitution", "offline_backfill"];

export class RedemptionRegister {
  constructor() {
    this.records = new Map();
  }

  redeem(entitlementId, channel, ref) {
    if (!CHANNELS.includes(channel)) {
      throw new Error(`未知兑现渠道 ${channel}`);
    }
    const existing = this.records.get(entitlementId);
    if (existing) {
      throw new Error(
        `权益 ${entitlementId} 已经由 ${existing.channel} 兑现，禁止通过 ${channel} 重复兑现`,
      );
    }
    const record = {
      entitlementId,
      channel,
      ref,
      offline: channel === "offline_backfill",
    };
    this.records.set(entitlementId, record);
    return record;
  }

  // 离线补录：离线期间先落地，联机后同样受唯一兑现约束。
  backfill(entitlementId, ref) {
    return this.redeem(entitlementId, "offline_backfill", ref);
  }

  isRedeemed(entitlementId) {
    return this.records.has(entitlementId);
  }

  count() {
    return this.records.size;
  }
}
