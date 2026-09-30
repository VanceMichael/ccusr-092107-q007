const NEED_TO_KIND = { child: "special_child", low_sugar: "special_low_sugar" };

// 特殊旅客（儿童、低糖等）的基础特殊餐保障不可被弃餐、升级或合并移除。
export function checkSpecialGuarantee(passengers, entitlements) {
  const violations = [];
  for (const pax of passengers) {
    for (const need of pax.needs) {
      const kind = NEED_TO_KIND[need];
      if (!kind) continue;
      const matches = entitlements.filter(
        (e) => e.pax_ref === pax.pax_ref && e.kind === kind && e.status !== "cancelled",
      );
      if (matches.length === 0) {
        violations.push(`旅客 ${pax.pax_ref} 的 ${need} 需求缺少基础保障餐`);
      } else if (!matches.some((e) => e.guaranteed === true)) {
        violations.push(`旅客 ${pax.pax_ref} 的 ${kind} 权益缺少保障标识`);
      }
    }
  }
  return violations;
}
