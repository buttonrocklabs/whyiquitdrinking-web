#!/usr/bin/env node
/**
 * LAB-697 -- the `npm audit (high+)` gate, with a scoped, expiring exception
 * list.
 *
 * WHY THIS EXISTS: GHSA-fc5q-39xc-vjpf (picomatch ReDoS) is rated high, covers
 * every picomatch release (<= 4.0.7, and 4.0.7 is the latest), and has no patched
 * version. A bare `npm audit --audit-level=high` therefore failed every PR
 * (PR 840 and 841 both merged on red) and no version bump can clear it. A check
 * that is red on every PR teaches everyone to merge past it, which is the exact
 * failure LAB-297 exists to prevent.
 *
 * WHAT THIS DOES: runs the same audit, but lets a high or critical advisory pass
 * when .github/audit-exceptions.json lists its GHSA id and ALL of these hold:
 *   1. the entry is complete (id, package, reason, ticket, added, expires),
 *   2. it has not expired (expires is at most 45 days after added, so an entry
 *      cannot be parked forever),
 *   3. the advisory is absent from `npm audit --omit=dev`, so it only ever
 *      reaches build tools. If it ever reaches the runtime tree, the check fails
 *      no matter what the list says.
 * Any other high or critical advisory still fails. An exception that matches
 * nothing is flagged as stale (remove it), not failed.
 *
 * It fails closed: if npm audit cannot run or returns no report (registry down),
 * the gate fails instead of passing on silence.
 *
 * Usage: node scripts/audit-gate.mjs [--exceptions <file>] [--today YYYY-MM-DD]
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FAIL_SEVERITIES = new Set(["high", "critical"]);
const MAX_EXCEPTION_DAYS = 45;
const WARN_DAYS_LEFT = 7;
const GHSA = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const dayNumber = (iso) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

/** Every high or critical advisory in an `npm audit --json` report, keyed by GHSA id. */
export function highAdvisories(report) {
  const found = new Map();
  for (const vuln of Object.values(report?.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      // A string `via` is a dependent pointing at the real advisory elsewhere.
      if (typeof via !== "object" || !FAIL_SEVERITIES.has(via.severity)) continue;
      const id = String(via.url ?? "").split("/").pop() || `source-${via.source}`;
      if (!found.has(id)) {
        found.set(id, { id, package: via.name, severity: via.severity, range: via.range, title: via.title });
      }
    }
  }
  return found;
}

/** Throws on a malformed entry: a typo in this file must fail the check, not silently drop an exception. */
export function validateExceptions(list) {
  if (!Array.isArray(list)) throw new Error("audit-exceptions.json: `exceptions` must be an array");
  const seen = new Set();
  for (const e of list) {
    const where = `exception ${e?.id ?? "(no id)"}`;
    for (const f of ["id", "package", "reason", "ticket", "added", "expires"]) {
      if (typeof e?.[f] !== "string" || !e[f].trim()) throw new Error(`${where}: missing \`${f}\``);
    }
    if (!GHSA.test(e.id)) throw new Error(`${where}: id must be a GHSA id`);
    if (!ISO_DATE.test(e.added) || !ISO_DATE.test(e.expires)) throw new Error(`${where}: added and expires must be YYYY-MM-DD`);
    const span = dayNumber(e.expires) - dayNumber(e.added);
    if (!(span > 0 && span <= MAX_EXCEPTION_DAYS)) {
      throw new Error(`${where}: expires must be 1 to ${MAX_EXCEPTION_DAYS} days after added (got ${span})`);
    }
    if (seen.has(e.id)) throw new Error(`${where}: listed twice`);
    seen.add(e.id);
  }
  return list;
}

/**
 * Pure decision. `all` is the full audit, `prod` the --omit=dev audit, both parsed JSON.
 * Returns { failures, excepted, stale, expiring } as printable strings and rows.
 */
export function evaluate({ all, prod, exceptions, today }) {
  validateExceptions(exceptions);
  const allHigh = highAdvisories(all);
  const prodHigh = highAdvisories(prod);
  const byId = new Map(exceptions.map((e) => [e.id, e]));
  const failures = [];
  const excepted = [];
  const expiring = [];

  for (const adv of allHigh.values()) {
    const label = `${adv.id} ${adv.package} ${adv.range} (${adv.severity}): ${adv.title}`;
    const ex = byId.get(adv.id);
    if (prodHigh.has(adv.id)) {
      failures.push(`${label} -- reaches the production tree, exceptions never cover that`);
    } else if (!ex) {
      failures.push(`${label} -- not on the exception list`);
    } else if (today > ex.expires) {
      failures.push(`${label} -- exception ${ex.ticket} expired ${ex.expires}, re-decide it`);
    } else {
      const left = dayNumber(ex.expires) - dayNumber(today);
      excepted.push({ ...adv, ticket: ex.ticket, expires: ex.expires, daysLeft: left });
      if (left <= WARN_DAYS_LEFT) expiring.push(`${adv.id} exception ${ex.ticket} expires ${ex.expires} (${left} days)`);
    }
  }
  const stale = exceptions.filter((e) => !allHigh.has(e.id)).map((e) => `${e.id} (${e.ticket}) matches nothing in the audit, remove it`);
  return { failures, excepted, stale, expiring };
}

function runAudit(args) {
  const r = spawnSync("npm", ["audit", "--json", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let report;
  try {
    report = JSON.parse(r.stdout);
  } catch {
    throw new Error(`npm audit ${args.join(" ")} printed no JSON (exit ${r.status}): ${String(r.stderr).slice(0, 300)}`);
  }
  // npm audit exits non-zero whenever it finds anything, so the exit code says nothing here.
  if (report.error || !report.vulnerabilities || !report.metadata) {
    throw new Error(`npm audit ${args.join(" ")} returned no report: ${JSON.stringify(report.error ?? report).slice(0, 300)}`);
  }
  return report;
}

function main(argv) {
  const opt = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  const file = opt("--exceptions", ".github/audit-exceptions.json");
  const today = opt("--today", new Date().toISOString().slice(0, 10));
  const gha = process.env.GITHUB_ACTIONS === "true";

  const exceptions = JSON.parse(readFileSync(file, "utf8")).exceptions;
  const { failures, excepted, stale, expiring } = evaluate({
    all: runAudit([]),
    prod: runAudit(["--omit=dev"]),
    exceptions,
    today,
  });

  for (const e of excepted) console.log(`EXCEPTED  ${e.id} ${e.package} ${e.range}: ${e.ticket}, valid until ${e.expires} (${e.daysLeft} days)`);
  for (const w of [...expiring, ...stale]) console.log(`${gha ? "::warning::" : "WARNING   "}${w}`);
  for (const f of failures) console.log(`${gha ? "::error::" : "FAIL      "}${f}`);

  if (failures.length) {
    console.log(`\naudit gate: ${failures.length} high/critical advisor${failures.length === 1 ? "y" : "ies"} not covered. Fix the dependency, or add a scoped entry to ${file} with a ticket and an expiry.`);
    return 1;
  }
  console.log(`audit gate: pass (${excepted.length} excepted, none uncovered)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.log(`${process.env.GITHUB_ACTIONS === "true" ? "::error::" : "FAIL      "}audit gate could not decide: ${e.message}`);
    process.exit(1);
  }
}
