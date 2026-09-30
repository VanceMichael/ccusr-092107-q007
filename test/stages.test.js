import test from "node:test";
import assert from "node:assert/strict";

import { loadScenario } from "../src/fixtures.js";
import { checkVersionTransition } from "../src/stages.js";

const { manifests } = loadScenario();
const [v1, v2] = manifests.filter((m) => m.flight_id === "FLT-DEMO-1");

test("值机截止到配餐装车之间允许调整批次", () => {
  assert.deepEqual(checkVersionTransition(v1, v2), []);
});

test("登机口确认后不得再改餐食行与批次", () => {
  const v3 = {
    ...v2,
    manifest_id: "m-102",
    version: 3,
    status: "effective",
    supersedes: "m-101",
    created_stage: "gate_final",
    lines: v2.lines.map((l) => (l.meal === "standard" ? { ...l, meal: "premium" } : l)),
  };
  const violations = checkVersionTransition(v2, v3);
  assert.ok(violations.some((v) => v.includes("lines")));
});

test("阶段不得回退", () => {
  const v3 = { ...v2, manifest_id: "m-102", version: 3, supersedes: "m-101", created_stage: "checkin_closed" };
  assert.ok(checkVersionTransition(v2, v3).some((v) => v.includes("回退")));
});

test("起飞后不得再生成装载新版本", () => {
  const v3 = { ...v2, manifest_id: "m-102", version: 3, supersedes: "m-101", created_stage: "departed" };
  assert.ok(checkVersionTransition(v2, v3).some((v) => v.includes("起飞")));
});

test("版本必须声明替代关系且连续递增", () => {
  const broken = { ...v2, manifest_id: "m-102", version: 3, supersedes: "m-101", created_stage: "gate_final" };
  delete broken.supersedes;
  assert.ok(checkVersionTransition(v2, broken).some((v) => v.includes("替代")));
  const skipped = { ...v2, manifest_id: "m-102", version: 4, supersedes: "m-101", created_stage: "gate_final" };
  assert.ok(checkVersionTransition(v2, skipped).some((v) => v.includes("递增")));
});
