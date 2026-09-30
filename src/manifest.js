// 装载清单：每个航班在每个阶段可以修订清单，但同一时刻
// 只允许一个有效版本，乘务组只能拿到这个唯一有效版本。
// 阶段冻结后，该阶段的清单禁止再出新版本。
export class ManifestBook {
  constructor(stageGate) {
    this.gate = stageGate;
    this.versions = new Map();
  }

  issue(flightId, stage, items) {
    this.gate.assertOpen(stage);
    const list = this.versions.get(flightId) ?? [];
    for (const manifest of list) {
      manifest.status = "superseded";
    }
    const manifest = {
      flightId,
      stage,
      version: list.length + 1,
      items,
      status: "active",
    };
    list.push(manifest);
    this.versions.set(flightId, list);
    return manifest;
  }

  // 乘务组视图入口：保证返回唯一有效版本。
  active(flightId) {
    const list = this.versions.get(flightId) ?? [];
    const actives = list.filter((manifest) => manifest.status === "active");
    if (actives.length !== 1) {
      throw new Error(`航班 ${flightId} 缺少唯一有效装载版本`);
    }
    return actives[0];
  }
}

// 乘务组视图：按座位给出餐型与过敏提示，不含旅客标识与其他画像字段。
export function crewView(manifest) {
  return manifest.items.map((item) => ({
    seat: item.seat,
    meal_type: item.meal_type,
    allergens: item.allergens ?? [],
  }));
}

// 供应商视图：只保留餐型数量与过敏约束的聚合结果，
// 不出现任何旅客标识，实现过敏信息最小可见。
export function supplierView(manifest) {
  const grouped = new Map();
  for (const item of manifest.items) {
    const entry = grouped.get(item.meal_type) ?? { meal_type: item.meal_type, quantity: 0, allergen_free: new Set() };
    entry.quantity += 1;
    for (const allergen of item.allergens ?? []) {
      entry.allergen_free.add(allergen);
    }
    grouped.set(item.meal_type, entry);
  }
  return [...grouped.values()].map((entry) => ({
    meal_type: entry.meal_type,
    quantity: entry.quantity,
    allergen_free: [...entry.allergen_free].sort(),
  }));
}

// 供应商替换 / 跨机场补配的替代餐必须守住过敏约束：
// 任一旅客声明的过敏原出现在替代餐成分中即禁止替换。
export function assertSubstitutionSafe(items, replacement) {
  const contains = new Set(replacement.contains ?? []);
  for (const item of items) {
    if (item.meal_type !== replacement.meal_type) continue;
    for (const allergen of item.allergens ?? []) {
      if (contains.has(allergen)) {
        throw new Error(`替代餐含旅客过敏原 ${allergen}，禁止替换 ${replacement.meal_type}`);
      }
    }
  }
}
