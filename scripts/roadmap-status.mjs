#!/usr/bin/env node
/**
 * Roadmap status reporter.
 *
 * Parses the task tables in docs/roadmap/*.md and prints progress per workstream.
 * The roadmap files are the single source of truth: this script only reads them,
 * so it can never disagree with the document people edit.
 *
 * Usage:
 *   npm run roadmap:status
 *   node scripts/roadmap-status.mjs --json
 *   node scripts/roadmap-status.mjs --open        # list every open task id
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROADMAP_DIR = join(ROOT, "docs", "roadmap");

// `npm run roadmap:status | head` closes the pipe early; exit quietly instead of
// crashing with an unhandled EPIPE.
process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
  throw error;
});

const STATUS = {
  "✅": "done",
  "🟡": "partial",
  "⬜": "todo",
  "🔒": "blocked",
};

/** Workstream grouping by task-ID prefix. */
const WORKSTREAM = {
  PLAT: "Platform & API",
  SEC: "Security & integrity",
  WEB: "Web",
  AND: "Android",
  OPS: "Operations",
  DATA: "Data & analytics",
  GRW: "Growth",
};

function parseFile(file) {
  const tasks = [];
  let phase = "unphased";
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();

    const heading = /^#{2,4}\s+(.*)$/.exec(line);
    if (heading) {
      // Phase headings look like "## Phase WEB-A — …" or "### SEC-1 · …".
      if (/^(Phase|SEC-)/.test(heading[1]))
        phase = heading[1].replace(/\s*\(M[\d.→ ]+\)$/, "").trim();
      continue;
    }

    if (!line.startsWith("|")) continue;
    const cells = line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 6) continue;

    const id = /^([A-Z]{3,4})-(\d{3})$/.exec(cells[0]);
    if (!id) continue;

    const statusCell = cells[2];
    const statusKey = Object.keys(STATUS).find((emoji) => statusCell.startsWith(emoji));
    const effort = Number.parseFloat(cells[cells.length - 2]);

    tasks.push({
      id: cells[0],
      prefix: id[1],
      file: file.replace(`${ROOT}/`, ""),
      phase,
      title: cells[1],
      status: statusKey ? STATUS[statusKey] : "unknown",
      effort: Number.isFinite(effort) ? effort : 0,
    });
  }
  return tasks;
}

const files = readdirSync(ROADMAP_DIR)
  .filter((name) => name.endsWith(".md"))
  .sort();

const tasks = files.flatMap((name) => parseFile(join(ROADMAP_DIR, name)));
const args = new Set(process.argv.slice(2));

if (args.has("--open")) {
  for (const task of tasks.filter((t) => t.status !== "done")) {
    process.stdout.write(`${task.id}\t${task.status}\t${task.effort}d\t${task.title}\n`);
  }
  process.exit(0);
}

const summary = {};
for (const task of tasks) {
  const stream = WORKSTREAM[task.prefix] ?? task.prefix;
  summary[stream] ??= {
    total: 0,
    done: 0,
    partial: 0,
    todo: 0,
    blocked: 0,
    effort: 0,
    remaining: 0,
  };
  summary[stream].total += 1;
  summary[stream][task.status] = (summary[stream][task.status] ?? 0) + 1;
  summary[stream].effort += task.effort;
  if (task.status !== "done") summary[stream].remaining += task.effort;
}

if (args.has("--json")) {
  process.stdout.write(`${JSON.stringify({ tasks, summary }, null, 2)}\n`);
  process.exit(0);
}

const totals = Object.values(summary).reduce(
  (acc, row) => ({
    total: acc.total + row.total,
    done: acc.done + row.done,
    partial: acc.partial + row.partial,
    todo: acc.todo + row.todo,
    blocked: acc.blocked + row.blocked,
    effort: acc.effort + row.effort,
    remaining: acc.remaining + row.remaining,
  }),
  { total: 0, done: 0, partial: 0, todo: 0, blocked: 0, effort: 0, remaining: 0 },
);

const pad = (value, width) => String(value).padEnd(width);
const num = (value, width) => String(value).padStart(width);

process.stdout.write(`LoopSquad roadmap — ${totals.total} tasks, ${totals.effort} dev-days\n\n`);
process.stdout.write(
  `${pad("Workstream", 24)}${num("tasks", 6)}${num("done", 6)}${num("part", 6)}${num("todo", 6)}${num("blkd", 6)}${num("days", 7)}${num("open", 7)}\n`,
);
process.stdout.write(`${"-".repeat(68)}\n`);
for (const [stream, row] of Object.entries(summary).sort((a, b) => b[1].effort - a[1].effort)) {
  process.stdout.write(
    `${pad(stream, 24)}${num(row.total, 6)}${num(row.done, 6)}${num(row.partial, 6)}${num(row.todo, 6)}${num(row.blocked, 6)}${num(row.effort, 7)}${num(row.remaining, 7)}\n`,
  );
}
process.stdout.write(`${"-".repeat(68)}\n`);
process.stdout.write(
  `${pad("Total", 24)}${num(totals.total, 6)}${num(totals.done, 6)}${num(totals.partial, 6)}${num(totals.todo, 6)}${num(totals.blocked, 6)}${num(totals.effort, 7)}${num(totals.remaining, 7)}\n`,
);

const pct = totals.total === 0 ? 0 : Math.round((totals.done / totals.total) * 100);
process.stdout.write(`\nProgress: ${pct}% complete (${totals.done}/${totals.total} tasks)\n`);
process.stdout.write("Tip: --open lists open tasks, --json emits machine-readable output.\n");
