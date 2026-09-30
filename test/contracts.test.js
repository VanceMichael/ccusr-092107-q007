import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validate, assertValid } from "../src/schema.js";

const load = (path) => readFile(new URL(path, import.meta.url), "utf8").then(JSON.parse);

test("航班、供应商与脱敏旅客样例符合契约", async () => {
  const [flightSchema, supplierSchema, passengerSchema, flight, supplier, passengers] =
    await Promise.all([
      load("../contracts/flight.schema.json"),
      load("../contracts/supplier.schema.json"),
      load("../contracts/passenger.schema.json"),
      load("../fixtures/flight.json"),
      load("../fixtures/supplier.json"),
      load("../fixtures/passengers.json"),
    ]);
  assertValid(flight, flightSchema, "航班");
  assertValid(supplier, supplierSchema, "供应商");
  for (const passenger of passengers) {
    assertValid(passenger, passengerSchema, "脱敏旅客");
  }
});

test("脱敏旅客契约拒绝身份信息字段", async () => {
  const schema = await load("../contracts/passenger.schema.json");
  const [passenger] = await load("../fixtures/passengers.json");
  const leaked = { ...passenger, name: "某旅客", id_number: "110101199001010000" };
  const errors = validate(leaked, schema);
  assert.ok(errors.some((line) => line.includes("name")));
  assert.ok(errors.some((line) => line.includes("id_number")));
});

test("契约拒绝缺少阶段表的航班", async () => {
  const schema = await load("../contracts/flight.schema.json");
  const flight = await load("../fixtures/flight.json");
  const broken = { ...flight, stages: { checkin_closed: "2026-10-01T07:30:00+08:00" } };
  const errors = validate(broken, schema);
  assert.ok(errors.some((line) => line.includes("catering_loaded")));
});
