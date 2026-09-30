// 履约链阶段：值机截止 -> 配餐装车 -> 登机口确定 -> 起飞。
// 每个阶段冻结后，属于该阶段的数据禁止改写；冻结必须按顺序推进。
export const STAGES = ["checkin_closed", "catering_loaded", "gate_final", "takeoff"];

export class StageGate {
  constructor() {
    this.frozen = new Set();
  }

  freeze(stage) {
    const index = STAGES.indexOf(stage);
    if (index < 0) throw new Error(`未知阶段: ${stage}`);
    for (let i = 0; i < index; i += 1) {
      if (!this.frozen.has(STAGES[i])) {
        throw new Error(`前置阶段 ${STAGES[i]} 尚未冻结，不能冻结 ${stage}`);
      }
    }
    this.frozen.add(stage);
  }

  isFrozen(stage) {
    return this.frozen.has(stage);
  }

  assertOpen(stage) {
    if (!STAGES.includes(stage)) throw new Error(`未知阶段: ${stage}`);
    if (this.frozen.has(stage)) {
      throw new Error(`阶段 ${stage} 已冻结，禁止改写该阶段数据`);
    }
  }
}
