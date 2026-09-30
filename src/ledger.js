// 权益台账：记录每项权益从发放到了结的全过程，保证
// 退票、升舱、航班合并、退款、积分与优惠券调整守恒。
//
// 守恒规则：
// 1. 每项权益只能发放一次、了结一次，不允许悬空或重复结算；
// 2. 兑换（弃餐换里程/券、延误改领餐券）记入对应账户，
//    金额必须等于权益上约定的价值；
// 3. 退款金额必须等于该权益的已付金额；
// 4. 基础保障权益（儿童、低糖等特殊餐）只能履约、改领餐券
//    或随航班合并转移，不可作废或退款；
// 5. 航班合并时权益以 transferred 转出、由目标航班转入，
//    总数不增不减。

const KIND_RULES = {
  standard_meal: ["fulfilled", "refunded", "vouchered", "transferred"],
  special_meal: ["fulfilled", "vouchered", "transferred"],
  paid_upgrade: ["fulfilled", "refunded", "vouchered", "transferred"],
  opt_out_miles: ["converted", "transferred"],
  opt_out_coupon: ["converted", "transferred"],
  delay_voucher: ["vouchered", "transferred"],
};

const GUARANTEED_ALLOWED = new Set(["fulfilled", "vouchered", "transferred"]);

export class Ledger {
  constructor() {
    this.entitlements = new Map();
    this.balances = { meals: 0, cash: 0, miles: 0, coupon: 0, voucher: 0 };
  }

  grant(entitlement) {
    if (this.entitlements.has(entitlement.id)) {
      throw new Error(`权益 ${entitlement.id} 重复发放`);
    }
    if (!KIND_RULES[entitlement.kind]) {
      throw new Error(`未知权益类型 ${entitlement.kind}`);
    }
    this.entitlements.set(entitlement.id, { ...entitlement, resolution: null });
  }

  resolve(id, resolution) {
    const ent = this.entitlements.get(id);
    if (!ent) throw new Error(`未知权益 ${id}`);
    if (ent.resolution) {
      throw new Error(`权益 ${id} 已了结（${ent.resolution.type}），禁止重复结算`);
    }
    if (!KIND_RULES[ent.kind].includes(resolution.type)) {
      throw new Error(`权益 ${id}（${ent.kind}）不允许以 ${resolution.type} 了结`);
    }
    if (ent.guaranteed && !GUARANTEED_ALLOWED.has(resolution.type)) {
      throw new Error(`权益 ${id} 属于基础保障，只能履约、改领餐券或随航班转移`);
    }

    if (resolution.type === "converted" || resolution.type === "vouchered") {
      const expected = ent.converts_to;
      if (!expected) throw new Error(`权益 ${id} 未约定可兑换价值`);
      if (resolution.account !== expected.account || resolution.amount !== expected.amount) {
        throw new Error(`权益 ${id} 兑换价值与约定不符`);
      }
      this.balances[expected.account] += expected.amount;
    }
    if (resolution.type === "refunded") {
      const paid = ent.paid ?? 0;
      if (paid <= 0) throw new Error(`权益 ${id} 无已付金额可退`);
      if (resolution.amount !== paid) {
        throw new Error(`权益 ${id} 退款金额必须等于已付金额 ${paid}`);
      }
      this.balances.cash += paid;
    }
    if (resolution.type === "fulfilled") {
      this.balances.meals += 1;
    }
    ent.resolution = resolution;
  }

  transferOut(id, toFlightId) {
    this.resolve(id, { type: "transferred", to: toFlightId });
  }

  transferIn(entitlement, fromFlightId) {
    this.grant({ ...entitlement, transferred_from: fromFlightId });
  }

  // 守恒检查：所有权益均已了结，返回各账户累计额。
  checkConserved() {
    const open = [...this.entitlements.values()]
      .filter((ent) => !ent.resolution)
      .map((ent) => ent.id);
    if (open.length > 0) {
      throw new Error(`存在未了结权益: ${open.join(", ")}`);
    }
    return { ...this.balances };
  }
}
