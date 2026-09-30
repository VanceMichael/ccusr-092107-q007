import test from "node:test";
import assert from "node:assert/strict";

import { loadScenario } from "../src/fixtures.js";
import { checkVersionTransition } from "../src/stages.js";
import { checkAllergyMinimality, checkLoadConservation, checkManifestSet } from "../src/manifest.js";
import { checkConservation, checkTransferConservation } from "../src/conservation.js";
import { checkRedemptions } from "../src/redemption.js";
import { checkSpecialGuarantee } from "../src/guarantee.js";

test("样例场景满足全部履约不变量", () => {
  const s = loadScenario();
  assert.deepEqual(checkManifestSet(s.manifests), []);
  assert.deepEqual(checkConservation(s.entitlements, s.ledger, s.flights), []);
  assert.deepEqual(checkTransferConservation(s.entitlements), []);
  assert.deepEqual(checkRedemptions(s.redemptions, s.entitlements, s.manifests), []);
  assert.deepEqual(checkSpecialGuarantee(s.passengers, s.entitlements), []);

  for (const m of s.manifests) {
    const flight = s.flights.find((f) => f.flight_id === m.flight_id);
    assert.deepEqual(checkAllergyMinimality(m), []);
    assert.deepEqual(checkLoadConservation(m, flight, s.suppliers), []);
  }

  const byFlight = new Map();
  for (const m of s.manifests) {
    if (!byFlight.has(m.flight_id)) byFlight.set(m.flight_id, []);
    byFlight.get(m.flight_id).push(m);
  }
  for (const list of byFlight.values()) {
    const sorted = [...list].sort((a, b) => a.version - b.version);
    for (let i = 1; i < sorted.length; i += 1) {
      assert.deepEqual(checkVersionTransition(sorted[i - 1], sorted[i]), []);
    }
  }
});
