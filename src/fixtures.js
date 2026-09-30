import { readFileSync } from "node:fs";

const FIXTURES_DIR = new URL("../fixtures/", import.meta.url);

export function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));
}

// 读取整套样例场景：航班、供应商、脱敏旅客、权益、装载版本、账目与兑现记录。
export function loadScenario() {
  return {
    passengers: loadFixture("passengers"),
    flights: loadFixture("flights"),
    suppliers: loadFixture("suppliers"),
    entitlements: loadFixture("entitlements"),
    manifests: loadFixture("manifests"),
    ledger: loadFixture("ledger"),
    redemptions: loadFixture("redemptions"),
  };
}
