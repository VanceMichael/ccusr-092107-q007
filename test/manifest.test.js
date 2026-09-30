import test from "node:test";
import assert from "node:assert/strict";

import { loadScenario } from "../src/fixtures.js";
import {
  checkAllergyMinimality,
  checkLoadConservation,
  checkManifestSet,
  crewView,
  effectiveManifest,
} from "../src/manifest.js";

const { manifests, flights, suppliers } = loadScenario();
const flight1 = flights.find((f) => f.flight_id === "FLT-DEMO-1");

test("每个航班有唯一有效装载版本", () => {
  assert.deepEqual(checkManifestSet(manifests), []);
  assert.equal(effectiveManifest(manifests, "FLT-DEMO-1").manifest_id, "m-101");
  assert.equal(effectiveManifest(manifests, "FLT-DEMO-2").manifest_id, "m-200");
});

test("出现两个有效版本即违规", () => {
  const tampered = manifests.map((m) => (m.manifest_id === "m-100" ? { ...m, status: "effective" } : m));
  assert.ok(checkManifestSet(tampered).some((v) => v.includes("唯一有效")));
});

test("有效版本必须是最新版本", () => {
  const tampered = manifests.map((m) => {
    if (m.manifest_id === "m-100") return { ...m, status: "effective" };
    if (m.manifest_id === "m-101") return { ...m, status: "superseded" };
    return m;
  });
  assert.ok(checkManifestSet(tampered).some((v) => v.includes("最新版本")));
});

test("乘务组视图只含座位、餐型与特殊餐过敏原", () => {
  const view = crewView(effectiveManifest(manifests, "FLT-DEMO-1"));
  const standard = view.lines.find((l) => l.seat === "12A");
  assert.equal("allergens" in standard, false);
  assert.equal("pax_ref" in standard, false);
  const child = view.lines.find((l) => l.seat === "15A");
  assert.deepEqual(child.allergens, ["dairy"]);
});

test("过敏信息最小可见：非特殊餐不得携带过敏原", () => {
  const m = effectiveManifest(manifests, "FLT-DEMO-1");
  assert.deepEqual(checkAllergyMinimality(m), []);
  const bad = {
    ...m,
    lines: m.lines.map((l) => (l.meal === "standard" ? { ...l, allergens: ["nuts"] } : l)),
  };
  assert.ok(checkAllergyMinimality(bad).some((v) => v.includes("过敏原")));
});

test("装载守恒：供应商替换与跨机场补配不改变有效装载", () => {
  const m = effectiveManifest(manifests, "FLT-DEMO-1");
  assert.deepEqual(checkLoadConservation(m, flight1, suppliers), []);
});

test("替换未回标即破坏守恒", () => {
  const m = structuredClone(effectiveManifest(manifests, "FLT-DEMO-1"));
  delete m.batches.find((b) => b.batch_id === "bat-03").replaced_by;
  const violations = checkLoadConservation(m, flight1, suppliers);
  assert.ok(violations.some((v) => v.includes("bat-03")));
  assert.ok(violations.some((v) => v.includes("不守恒")));
});

test("跨机场批次必须声明所补缺口", () => {
  const m = structuredClone(effectiveManifest(manifests, "FLT-DEMO-1"));
  delete m.batches.find((b) => b.batch_id === "bat-06").covers_shortage_of;
  assert.ok(checkLoadConservation(m, flight1, suppliers).some((v) => v.includes("跨机场")));
});

test("批次不得超出供应商服务机场与能力", () => {
  const m = structuredClone(effectiveManifest(manifests, "FLT-DEMO-1"));
  m.batches.find((b) => b.batch_id === "bat-05").meal = "low_sugar";
  assert.ok(checkLoadConservation(m, flight1, suppliers).some((v) => v.includes("能力")));
});
