import test from "node:test";
import assert from "node:assert/strict";

import { StageGate, STAGES } from "../src/stages.js";

test("阶段必须按顺序冻结", () => {
  const gate = new StageGate();
  assert.throws(() => gate.freeze("catering_loaded"), /尚未冻结/);
  for (const stage of STAGES) {
    gate.freeze(stage);
    assert.ok(gate.isFrozen(stage));
  }
});

test("已冻结阶段禁止改写", () => {
  const gate = new StageGate();
  gate.freeze("checkin_closed");
  assert.throws(() => gate.assertOpen("checkin_closed"), /已冻结/);
  assert.doesNotThrow(() => gate.assertOpen("catering_loaded"));
});

test("未知阶段直接拒绝", () => {
  const gate = new StageGate();
  assert.throws(() => gate.freeze("boarding"), /未知阶段/);
  assert.throws(() => gate.assertOpen("boarding"), /未知阶段/);
});
