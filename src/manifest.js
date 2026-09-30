export const SPECIAL_MEALS = ["child", "low_sugar"];

const LINE_KEYS = ["pax_ref", "seat", "meal", "allergens"];

// 每个航班恰好一个有效装载版本；版本沿 supersedes 链递增，有效版本即最新版本。
export function effectiveManifest(manifests, flightId) {
  const list = manifests.filter((m) => m.flight_id === flightId && m.status === "effective");
  return list.length === 1 ? list[0] : null;
}

export function checkManifestSet(manifests) {
  const violations = [];
  const byFlight = new Map();
  for (const m of manifests) {
    if (!byFlight.has(m.flight_id)) byFlight.set(m.flight_id, []);
    byFlight.get(m.flight_id).push(m);
  }
  for (const [flightId, list] of byFlight) {
    const effective = list.filter((m) => m.status === "effective");
    if (effective.length !== 1) {
      violations.push(`航班 ${flightId} 应有唯一有效装载版本，实际 ${effective.length} 个`);
    }
    const sorted = [...list].sort((a, b) => a.version - b.version);
    sorted.forEach((m, i) => {
      if (m.version !== i + 1) {
        violations.push(`航班 ${flightId} 的版本号不连续：${m.manifest_id} 为 v${m.version}`);
      }
      if (i === 0) {
        if (m.supersedes) violations.push(`首版本 ${m.manifest_id} 不应声明替代关系`);
      } else if (m.supersedes !== sorted[i - 1].manifest_id) {
        violations.push(`版本 ${m.manifest_id} 的替代链断裂`);
      }
      if (m.status === "effective" && i !== sorted.length - 1) {
        violations.push(`有效版本 ${m.manifest_id} 不是最新版本`);
      }
      if (m.status !== "effective" && m.status !== "superseded") {
        violations.push(`版本 ${m.manifest_id} 状态未知：${m.status}`);
      }
    });
  }
  return violations;
}

// 乘务组视图：只保留座位、餐型与特殊餐过敏原编码，不含旅客标识。
export function crewView(manifest) {
  return {
    flight_id: manifest.flight_id,
    version: manifest.version,
    lines: manifest.lines.map((line) => {
      const view = { seat: line.seat, meal: line.meal };
      if (SPECIAL_MEALS.includes(line.meal) && Array.isArray(line.allergens) && line.allergens.length > 0) {
        view.allergens = [...line.allergens];
      }
      return view;
    }),
  };
}

// 过敏信息最小可见：装载行只允许约定字段，且仅特殊餐可携带过敏原编码。
export function checkAllergyMinimality(manifest) {
  const violations = [];
  for (const line of manifest.lines) {
    for (const key of Object.keys(line)) {
      if (!LINE_KEYS.includes(key)) {
        violations.push(`座位 ${line.seat} 的装载行含未约定字段 ${key}`);
      }
    }
    if (line.allergens !== undefined && !SPECIAL_MEALS.includes(line.meal)) {
      violations.push(`座位 ${line.seat} 的 ${line.meal} 餐不应携带过敏原信息`);
    }
  }
  return violations;
}

// 装载守恒与供应约束：供应商替换、跨机场补配不得改变有效装载总量，
// 且每个批次必须落在供应商的服务机场与能力范围内。
export function checkLoadConservation(manifest, flight, suppliers) {
  const violations = [];
  const supplierById = new Map(suppliers.map((s) => [s.supplier_id, s]));
  const batchById = new Map(manifest.batches.map((b) => [b.batch_id, b]));

  for (const batch of manifest.batches) {
    const supplier = supplierById.get(batch.supplier_id);
    if (!supplier) {
      violations.push(`批次 ${batch.batch_id} 的供应商 ${batch.supplier_id} 不存在`);
      continue;
    }
    if (!supplier.airports.includes(batch.airport)) {
      violations.push(`批次 ${batch.batch_id} 的机场 ${batch.airport} 不在供应商服务范围`);
    }
    if (!supplier.capabilities.includes(batch.meal)) {
      violations.push(`批次 ${batch.batch_id} 的餐型 ${batch.meal} 超出供应商能力`);
    }
    if (batch.replaces) {
      const target = batchById.get(batch.replaces);
      if (!target) {
        violations.push(`批次 ${batch.batch_id} 替换的 ${batch.replaces} 不存在`);
      } else {
        if (target.replaced_by !== batch.batch_id) {
          violations.push(`批次 ${batch.replaces} 未标记被 ${batch.batch_id} 替换`);
        }
        if (target.meal !== batch.meal || target.qty !== batch.qty) {
          violations.push(`批次 ${batch.batch_id} 替换后餐型或数量不守恒`);
        }
      }
    }
    if (batch.replaced_by && ![...batchById.values()].some((b) => b.replaces === batch.batch_id)) {
      violations.push(`批次 ${batch.batch_id} 标记被替换但缺少接替批次`);
    }
    if (batch.airport !== flight.route.origin && !batch.covers_shortage_of) {
      violations.push(`跨机场批次 ${batch.batch_id} 必须声明所补缺口`);
    }
    if (batch.covers_shortage_of) {
      const target = batchById.get(batch.covers_shortage_of);
      if (!target) {
        violations.push(`批次 ${batch.batch_id} 补配的缺口 ${batch.covers_shortage_of} 不存在`);
      } else if (target.meal !== batch.meal) {
        violations.push(`批次 ${batch.batch_id} 补配餐型与缺口不一致`);
      }
    }
  }

  const need = {};
  for (const line of manifest.lines) {
    if (line.meal !== "none") need[line.meal] = (need[line.meal] ?? 0) + 1;
  }
  const loaded = {};
  for (const batch of manifest.batches) {
    if (batch.replaced_by) continue;
    loaded[batch.meal] = (loaded[batch.meal] ?? 0) + batch.qty;
  }
  for (const meal of new Set([...Object.keys(need), ...Object.keys(loaded)])) {
    if ((need[meal] ?? 0) !== (loaded[meal] ?? 0)) {
      violations.push(`餐型 ${meal} 需求 ${need[meal] ?? 0} 与有效装载 ${loaded[meal] ?? 0} 不守恒`);
    }
  }
  return violations;
}
