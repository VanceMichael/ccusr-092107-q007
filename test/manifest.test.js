import test from "node:test";
import assert from "node:assert/strict";

import { StageGate } from "../src/stages.js";
import { ManifestBook, crewView, supplierView, assertSubstitutionSafe } from "../src/manifest.js";

const ITEMS = [
  { passenger_key: "pax-0002", seat: "14C", meal_type: "standard", allergens: [] },
  { passenger_key: "pax-0003", seat: "21A", meal_type: "child", allergens: ["peanut"] },
  { passenger_key: "pax-0004", seat: "22F", meal_type: "low_sugar", allergens: [] },
];

test("乘务组只能拿到唯一有效装载版本", () => {
  const book = new ManifestBook(new StageGate());
  const v1 = book.issue("CA1501", "catering_loaded", ITEMS);
  assert.equal(book.active("CA1501").version, 1);

  const v2 = book.issue("CA1501", "catering_loaded", [...ITEMS, { passenger_key: "pax-0005", seat: "23B", meal_type: "standard", allergens: [] }]);
  assert.equal(v1.status, "superseded");
  const active = book.active("CA1501");
  assert.equal(active.version, 2);
  assert.equal(active.items.length, 4);
  assert.equal(v2.status, "active");
});

test("阶段冻结后禁止再出该阶段的新版本", () => {
  const gate = new StageGate();
  const book = new ManifestBook(gate);
  gate.freeze("checkin_closed");
  book.issue("CA1501", "catering_loaded", ITEMS);
  gate.freeze("catering_loaded");
  assert.throws(() => book.issue("CA1501", "catering_loaded", ITEMS), /已冻结/);
  assert.doesNotThrow(() => book.issue("CA1501", "gate_final", ITEMS));
});

test("乘务组视图不含旅客标识，仅保留座位、餐型与过敏提示", () => {
  const book = new ManifestBook(new StageGate());
  book.issue("CA1501", "catering_loaded", ITEMS);
  const view = crewView(book.active("CA1501"));
  assert.equal(view.length, 3);
  for (const row of view) {
    assert.deepEqual(Object.keys(row).sort(), ["allergens", "meal_type", "seat"]);
  }
  assert.deepEqual(view.find((row) => row.seat === "21A").allergens, ["peanut"]);
});

test("供应商视图只做聚合，不出现任何旅客标识", () => {
  const book = new ManifestBook(new StageGate());
  book.issue("CA1501", "catering_loaded", ITEMS);
  const view = supplierView(book.active("CA1501"));
  assert.deepEqual(view.find((row) => row.meal_type === "child"), {
    meal_type: "child",
    quantity: 1,
    allergen_free: ["peanut"],
  });
  const serialized = JSON.stringify(view);
  assert.ok(!serialized.includes("pax-"));
  assert.ok(!serialized.includes("21A"));
});

test("替代餐含旅客过敏原时禁止替换", () => {
  assert.throws(
    () => assertSubstitutionSafe(ITEMS, { meal_type: "child", contains: ["peanut"] }),
    /过敏原/,
  );
  assert.doesNotThrow(() =>
    assertSubstitutionSafe(ITEMS, { meal_type: "child", contains: ["milk"] }),
  );
  assert.doesNotThrow(() =>
    assertSubstitutionSafe(ITEMS, { meal_type: "standard", contains: ["peanut"] }),
  );
});
