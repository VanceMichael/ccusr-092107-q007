// 履约链阶段：值机截止 → 配餐装车 → 登机口确认 → 起飞。
export const STAGES = ["checkin_closed", "catering_loaded", "gate_final", "departed"];

// 各数据区段的冻结时点：越过该阶段后对应区段即不可再改。
export const SECTION_FROZEN_AT = {
  lines: "catering_loaded",
  batches: "catering_loaded",
  redistribution: "gate_final",
};

export function stageIndex(stage) {
  return STAGES.indexOf(stage);
}

function deepEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// 校验相邻两个装载版本之间的演进是否尊重阶段冻结。
export function checkVersionTransition(prev, next) {
  const violations = [];
  if (next.flight_id !== prev.flight_id) {
    violations.push(`版本 ${next.manifest_id} 与 ${prev.manifest_id} 不属于同一航班`);
  }
  if (next.version !== prev.version + 1) {
    violations.push(`版本号应从 ${prev.version} 递增，实际为 ${next.version}`);
  }
  if (next.supersedes !== prev.manifest_id) {
    violations.push(`版本 ${next.manifest_id} 未声明替代 ${prev.manifest_id}`);
  }
  const pi = stageIndex(prev.created_stage);
  const ni = stageIndex(next.created_stage);
  if (pi < 0 || ni < 0) {
    violations.push("存在未知阶段");
    return violations;
  }
  if (ni < pi) {
    violations.push(`阶段不得从 ${prev.created_stage} 回退到 ${next.created_stage}`);
  }
  if (next.created_stage === "departed") {
    violations.push("起飞后不得再生成装载新版本");
  }
  for (const [section, frozenAt] of Object.entries(SECTION_FROZEN_AT)) {
    if (stageIndex(frozenAt) < ni && !deepEqual(prev[section], next[section])) {
      violations.push(`区段 ${section} 已在 ${frozenAt} 冻结，版本 ${next.manifest_id} 不得修改`);
    }
  }
  return violations;
}
