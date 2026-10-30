#!/usr/bin/env node

/**
 * SokoSeal Point — Deterministic Replay Evaluation Tool
 *
 * Re-runs deterministic visit segmentation, resolution, pairing, and applyActions
 * on recorded phone holds from IndexedDB exports or eval/holds/*.json.
 *
 * Usage:
 *   node scripts/replay.mjs [path-to-holds-file-or-dir]
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Register custom loader to resolve "@/lib/..." and auto-append .ts extensions
const rootUrl = pathToFileURL(process.cwd() + "/").href;
register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  let url = specifier;
  if (url.startsWith("@/")) {
    url = "${rootUrl}" + url.slice(2);
  }
  if (
    (url.startsWith("./") || url.startsWith("../") || url.startsWith("file://")) &&
    !url.endsWith(".ts") &&
    !url.endsWith(".js") &&
    !url.endsWith(".mjs") &&
    !url.endsWith(".json")
  ) {
    url += ".ts";
  }
  return nextResolve(url, context);
}
`)
);

// Dynamically import project modules after loader is registered
const { segmentVisits } = await import("@/lib/pointing/trace");
const { keepLongest } = await import("@/lib/pointing/fit");
const { applyActions } = await import("@/lib/commerce/plan");

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function median(values) {
  return percentile(values, 50);
}

function formatPct(num, total) {
  if (!total) return "N/A";
  return `${((num / total) * 100).toFixed(1)}% (${num}/${total})`;
}

async function loadHolds(targetPath) {
  let holds = [];
  try {
    const s = await stat(targetPath);
    if (s.isDirectory()) {
      const files = await readdir(targetPath);
      for (const file of files) {
        if (!file.endsWith(".json") || file === "package.json") continue;
        const fullPath = path.join(targetPath, file);
        try {
          const content = JSON.parse(await readFile(fullPath, "utf-8"));
          if (Array.isArray(content)) {
            holds.push(...content);
          } else if (content && typeof content === "object" && content.id) {
            holds.push(content);
          }
        } catch (err) {
          console.warn(`[replay] Could not parse ${file}:`, err.message);
        }
      }
    } else if (s.isFile()) {
      const content = JSON.parse(await readFile(targetPath, "utf-8"));
      if (Array.isArray(content)) holds = content;
      else if (content && typeof content === "object") holds = [content];
    }
  } catch {
    // Path not found
  }
  return holds;
}

export function replayHold(hold) {
  const { samples, samBoxes, products, intent, identities, annotation } = hold;

  // 1. Visit segmentation
  const sortedSamples = [...(samples ?? [])].sort((a, b) => a.at - b.at);
  const visits = segmentVisits(sortedSamples, samBoxes ?? []);

  // 2. Resolve visits against recorded identities
  // Build lookup from box coordinates to identity
  function findIdentity(box) {
    if (!identities || identities.length === 0) return undefined;
    return identities.find(
      (id) =>
        Math.abs(id.box.x1 - box.x1) < 0.001 &&
        Math.abs(id.box.y1 - box.y1) < 0.001 &&
        Math.abs(id.box.x2 - box.x2) < 0.001 &&
        Math.abs(id.box.y2 - box.y2) < 0.001
    );
  }

  const marks = visits.map((visit) => {
    const duration = visit.end - visit.start;
    if (visit.hit.kind === "ambiguous") {
      return { target: { state: "ambiguous" }, name: null, box: null, duration };
    }
    const id = findIdentity(visit.hit.box);
    let target = { state: "error" };
    if (id?.state === "product" && id.sku) {
      target = { state: "product", sku: id.sku };
    } else if (id?.state === "unknown") {
      target = { state: "unknown" };
    } else if (id?.state === "ambiguous") {
      target = { state: "ambiguous" };
    }
    return {
      target,
      name: id?.name ?? null,
      box: visit.hit.box,
      duration,
    };
  });

  // 3. Point trimming via keepLongest
  const actions = intent?.actions ?? [];
  const pointRequests = actions.filter((action) => action.reference === "POINT").length;
  const trimmedMarks = pointRequests > 0 ? keepLongest(marks, pointRequests) : marks;
  const replayedTargets = trimmedMarks.map((m) => m.target);

  // 4. Apply actions to empty basket
  const initialLines = [];
  const activeProducts = (products ?? []).filter((p) => p.active);
  const { lines, outcomes } = applyActions(initialLines, actions, replayedTargets, activeProducts);

  return {
    visits,
    marks: trimmedMarks,
    targets: replayedTargets,
    lines,
    outcomes,
    actions,
    annotation,
  };
}

export function evaluateHolds(holds) {
  let totalPointed = 0;
  let correctPointed = 0;
  let totalEmpty = 0;
  let correctEmpty = 0;
  let totalNotInShop = 0;
  let correctNotInShop = 0;
  let totalActions = 0;
  let correctActions = 0;
  let chooseProductCount = 0;

  const latencies = {
    scan: [],
    transcribe: [],
    identify: [],
    intent: [],
    total: [],
  };

  const perHoldResults = [];

  for (const hold of holds) {
    const result = replayHold(hold);
    const annotation = hold.annotation;

    let holdPointedCorrect = true;
    let holdActionsCorrect = true;
    let pointIdx = 0;

    for (let i = 0; i < result.actions.length; i++) {
      const action = result.actions[i];
      const outcome = result.outcomes[i];
      totalActions++;

      const isChoose =
        outcome?.status === "rejected" &&
        [
          "count_mismatch",
          "nothing_pointed",
          "not_in_shop",
          "unclear_product",
          "check_failed",
          "no_previous",
        ].includes(outcome.reason);
      if (isChoose) chooseProductCount++;

      const meant = annotation?.meantProducts?.[i];

      if (action.reference === "POINT") {
        totalPointed++;
        const target = result.targets[pointIdx];
        pointIdx++;

        if (meant === "nothing") {
          totalEmpty++;
          if (!target || target.state === "none") {
            correctEmpty++;
            correctPointed++;
          } else {
            holdPointedCorrect = false;
          }
        } else if (meant === "not_in_shop") {
          totalNotInShop++;
          if (target?.state === "unknown") {
            correctNotInShop++;
            correctPointed++;
          } else {
            holdPointedCorrect = false;
          }
        } else if (meant) {
          // Meant a specific product SKU
          if (target?.state === "product" && target.sku === meant) {
            correctPointed++;
          } else {
            holdPointedCorrect = false;
          }
        }
      }

      // Action accuracy: if annotation is present, verify final outcome
      if (annotation) {
        if (annotation.status === "correct" && outcome?.status === "applied") {
          correctActions++;
        } else if (
          annotation.status === "wrong" &&
          (outcome?.status === "rejected" || !holdPointedCorrect)
        ) {
          correctActions++;
        } else if (annotation.status === "correct" && outcome?.status === "rejected") {
          holdActionsCorrect = false;
        }
      }
    }

    if (hold.latencies) {
      if (hold.latencies.scanMs) latencies.scan.push(hold.latencies.scanMs);
      if (hold.latencies.transcribeMs) latencies.transcribe.push(hold.latencies.transcribeMs);
      if (hold.latencies.identifyMs) latencies.identify.push(hold.latencies.identifyMs);
      if (hold.latencies.intentMs) latencies.intent.push(hold.latencies.intentMs);
      if (hold.latencies.totalMs) latencies.total.push(hold.latencies.totalMs);
    }

    perHoldResults.push({
      id: hold.id,
      transcript: hold.transcript || hold.heard,
      actionsCount: result.actions.length,
      marksCount: result.marks.length,
      status: annotation?.status ?? "unannotated",
      holdPointedCorrect,
      holdActionsCorrect,
    });
  }

  return {
    totalHolds: holds.length,
    annotatedHolds: holds.filter((h) => h.annotation !== undefined).length,
    totalPointed,
    correctPointed,
    pointingAccuracy: totalPointed > 0 ? (correctPointed / totalPointed) * 100 : null,
    totalEmpty,
    correctEmpty,
    emptySpaceAccuracy: totalEmpty > 0 ? (correctEmpty / totalEmpty) * 100 : null,
    totalNotInShop,
    correctNotInShop,
    notInShopAccuracy: totalNotInShop > 0 ? (correctNotInShop / totalNotInShop) * 100 : null,
    totalActions,
    correctActions,
    actionAccuracy: totalActions > 0 ? (correctActions / totalActions) * 100 : null,
    chooseProductCount,
    chooseProductRate: totalActions > 0 ? (chooseProductCount / totalActions) * 100 : 0,
    latencies: {
      scanMedian: median(latencies.scan),
      scanP90: percentile(latencies.scan, 90),
      transcribeMedian: median(latencies.transcribe),
      transcribeP90: percentile(latencies.transcribe, 90),
      identifyMedian: median(latencies.identify),
      identifyP90: percentile(latencies.identify, 90),
      intentMedian: median(latencies.intent),
      intentP90: percentile(latencies.intent, 90),
      totalMedian: median(latencies.total),
      totalP90: percentile(latencies.total, 90),
    },
    perHoldResults,
  };
}

async function run() {
  const targetPath = process.argv[2] ?? "eval/holds";
  console.log(`\n=== SokoSeal Point Replay Evaluation ===`);
  console.log(`Reading recordings from: ${targetPath}\n`);

  const holds = await loadHolds(targetPath);

  if (holds.length === 0) {
    console.log(`No recordings found in ${targetPath}.`);
    console.log(`\nTo record phone data:`);
    console.log(`  1. Open the app on your phone and go to /debug`);
    console.log(`  2. Turn on the Hold Recorder`);
    console.log(`  3. Point and speak in /point, annotate results in /basket`);
    console.log(`  4. Export JSON in /debug and save to eval/holds/recordings.json`);
    console.log(`  5. Re-run: node scripts/replay.mjs\n`);
    process.exit(0);
  }

  const metrics = evaluateHolds(holds);

  console.log(`Total Holds Loaded: ${metrics.totalHolds} (${metrics.annotatedHolds} annotated)\n`);

  console.log(`--- Accuracy Metrics ---`);
  console.log(`Pointing Accuracy:    ${formatPct(metrics.correctPointed, metrics.totalPointed)}`);
  console.log(`Empty-Space Accuracy: ${formatPct(metrics.correctEmpty, metrics.totalEmpty)}`);
  console.log(`Not-In-Shop Accuracy: ${formatPct(metrics.correctNotInShop, metrics.totalNotInShop)}`);
  console.log(`Action Accuracy:      ${formatPct(metrics.correctActions, metrics.totalActions)}`);
  console.log(`Choose-Product Rate:  ${formatPct(metrics.chooseProductCount, metrics.totalActions)}\n`);

  function formatLatency(medianVal, p90Val) {
    if (!medianVal && !p90Val) return "N/A (unrecorded in run-hold.ts)";
    return `${medianVal} ms / ${p90Val} ms`;
  }

  console.log(`--- Latency (ms) [Median / P90] ---`);
  console.log(`Scan (SAM 3.1):       ${formatLatency(metrics.latencies.scanMedian, metrics.latencies.scanP90)}`);
  console.log(`Transcribe (Voice):   ${formatLatency(metrics.latencies.transcribeMedian, metrics.latencies.transcribeP90)}`);
  console.log(`Identify (Spark):     ${formatLatency(metrics.latencies.identifyMedian, metrics.latencies.identifyP90)}`);
  console.log(`Intent (Spark):       ${formatLatency(metrics.latencies.intentMedian, metrics.latencies.intentP90)}`);
  console.log(`Total Hold Pipeline:  ${formatLatency(metrics.latencies.totalMedian, metrics.latencies.totalP90)}\n`);

  if (metrics.perHoldResults.length > 0) {
    console.log(`--- Per-Hold Summary (first 10) ---`);
    for (const h of metrics.perHoldResults.slice(0, 10)) {
      console.log(
        `  [${h.status.toUpperCase()}] ${h.id.slice(0, 8)}: “${h.transcript}” -> ${h.marksCount} mark(s), ${h.actionsCount} action(s)`
      );
    }
    console.log(``);
  }
}

// Run directly if called as a script
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  run().catch((err) => {
    console.error("[replay] Fatal error:", err);
    process.exit(1);
  });
}
