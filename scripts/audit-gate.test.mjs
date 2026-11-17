import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, highAdvisories, validateExceptions } from "./audit-gate.mjs";

const PICO = "GHSA-fc5q-39xc-vjpf";

const adv = (id, pkg, severity = "high") => ({
  source: 1,
  name: pkg,
  dependency: pkg,
  title: `${pkg} advisory`,
  url: `https://github.com/advisories/${id}`,
  severity,
  range: "<=4.0.7",
});

// Shape of `npm audit --json`: the owning package carries the advisory object,
// every dependent carries only the package name as a string `via`.
const report = (...advisories) => ({
  metadata: { vulnerabilities: {} },
  vulnerabilities: {
    ...Object.fromEntries(advisories.map((a) => [a.name, { name: a.name, severity: a.severity, via: [a] }])),
    ...(advisories.some((a) => a.name === "picomatch") ? { vite: { name: "vite", severity: "high", via: ["picomatch"] } } : {}),
  },
});

const exception = (over = {}) => ({
  id: PICO,
  package: "picomatch",
  ticket: "LAB-697",
  added: "2026-11-17",
  expires: "2026-12-17",
  reason: "no patched release",
  ...over,
});

const run = (over = {}) =>
  evaluate({
    all: report(adv(PICO, "picomatch")),
    prod: report(),
    exceptions: [exception()],
    today: "2026-11-18",
    ...over,
  });

test("passes when the only high advisory is excepted and absent from the production audit", () => {
  const r = run();
  assert.equal(r.failures.length, 0);
  assert.equal(r.excepted.length, 1);
  assert.equal(r.excepted[0].daysLeft, 29);
});

test("the same advisory fails once the exception is removed", () => {
  const r = run({ exceptions: [] });
  assert.equal(r.failures.length, 1);
  assert.match(r.failures[0], new RegExp(PICO));
  assert.match(r.failures[0], /not on the exception list/);
});

test("a dependent that only names the package is not a separate failure", () => {
  assert.equal([...highAdvisories(report(adv(PICO, "picomatch"))).keys()].join(), PICO);
});

test("a different high advisory still fails with picomatch excepted", () => {
  const r = run({ all: report(adv(PICO, "picomatch"), adv("GHSA-aaaa-bbbb-cccc", "undici")) });
  assert.equal(r.failures.length, 1);
  assert.match(r.failures[0], /GHSA-aaaa-bbbb-cccc/);
});

test("a critical advisory fails and a moderate one is ignored", () => {
  assert.equal(run({ all: report(adv(PICO, "picomatch"), adv("GHSA-aaaa-bbbb-cccc", "x", "critical")) }).failures.length, 1);
  assert.equal(run({ all: report(adv(PICO, "picomatch"), adv("GHSA-aaaa-bbbb-cccc", "x", "moderate")) }).failures.length, 0);
});

test("an excepted advisory fails when it reaches the production tree", () => {
  const r = run({ prod: report(adv(PICO, "picomatch")) });
  assert.equal(r.failures.length, 1);
  assert.match(r.failures[0], /production tree/);
});

test("valid through the expiry date, failing the day after", () => {
  assert.equal(run({ today: "2026-12-17" }).failures.length, 0);
  const r = run({ today: "2026-12-18" });
  assert.equal(r.failures.length, 1);
  assert.match(r.failures[0], /expired 2026-12-17/);
});

test("warns inside the last week and flags an exception that matches nothing", () => {
  assert.equal(run({ today: "2026-12-12" }).expiring.length, 1);
  assert.equal(run({ today: "2026-11-18" }).expiring.length, 0);
  const r = run({ all: report(), exceptions: [exception()] });
  assert.equal(r.failures.length, 0);
  assert.equal(r.stale.length, 1);
});

test("a malformed or open-ended exception fails the gate instead of being ignored", () => {
  assert.throws(() => validateExceptions([exception({ reason: "" })]), /missing `reason`/);
  assert.throws(() => validateExceptions([exception({ id: "picomatch" })]), /GHSA id/);
  assert.throws(() => validateExceptions([exception({ expires: "2027-12-17" })]), /1 to 45 days/);
  assert.throws(() => validateExceptions([exception({ expires: "2026-11-17" })]), /1 to 45 days/);
  assert.throws(() => validateExceptions([exception({ expires: "soon" })]), /YYYY-MM-DD/);
  assert.throws(() => validateExceptions([exception(), exception()]), /listed twice/);
  assert.throws(() => validateExceptions({}), /must be an array/);
});
