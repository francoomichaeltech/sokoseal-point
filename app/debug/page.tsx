"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Download, Trash2 } from "lucide-react";
import {
  clearRecordedHolds,
  deleteRecordedHold,
  downloadRecordingsBlob,
  exportRecordingsJson,
  getRecordedHolds,
  setRecorderEnabled,
  useRecorderEnabled,
  type RecordedHold,
} from "@/lib/debug/recorder";

export default function DebugPage() {
  const enabled = useRecorderEnabled();
  const [holds, setHolds] = useState<RecordedHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getRecordedHolds().then((items) => {
      if (cancelled) return;
      setHolds(items);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    const items = await getRecordedHolds();
    setHolds(items);
    setLoading(false);
  }

  function handleToggle() {
    setRecorderEnabled(!enabled);
  }

  async function handleExport() {
    const json = await exportRecordingsJson();
    downloadRecordingsBlob(json);
  }

  async function handleCopyJson() {
    const json = await exportRecordingsJson();
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleClearAll() {
    if (!window.confirm("Clear all recorded holds? This cannot be undone.")) return;
    setClearing(true);
    await clearRecordedHolds();
    await refresh();
    setClearing(false);
  }

  async function handleDelete(id: string) {
    await deleteRecordedHold(id);
    await refresh();
  }

  const annotatedCount = holds.filter((h) => h.annotation !== undefined).length;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-canvas p-4 text-ink">
      <header className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <a
            href="/point"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-ink"
          >
            <ArrowLeft size={18} />
          </a>
          <h1 className="text-lg font-bold">Debug Hold Recorder</h1>
        </div>
        <span className="rounded bg-attention-soft px-2 py-0.5 text-xs font-semibold text-attention">
          Internal Only
        </span>
      </header>

      <section className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm">Hold Recorder</h2>
            <p className="mt-0.5 text-xs text-muted">
              Record scan frames, SAM boxes, traces, transcripts & latencies.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled ? "bg-primary" : "bg-line"
            }`}
            role="switch"
            aria-checked={enabled}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <div className="mt-3 rounded border border-dashed border-line bg-canvas p-2 text-xs text-muted">
          State: <strong className={enabled ? "text-verified" : "text-muted"}>{enabled ? "ENABLED" : "DISABLED (default)"}</strong>
          {!enabled && " — Turn on to record holds for Phase 1 replay evaluation."}
        </div>
      </section>

      <section className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm">Recordings Storage</h2>
            <p className="text-xs text-muted">
              {holds.length} hold{holds.length === 1 ? "" : "s"} stored in IndexedDB ({annotatedCount} annotated)
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="text-xs font-medium text-primary hover:underline"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={holds.length === 0}
            onClick={handleExport}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-card bg-primary px-3 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Download size={14} /> Export JSON
          </button>
          <button
            type="button"
            disabled={holds.length === 0}
            onClick={handleCopyJson}
            className="flex h-10 items-center justify-center gap-1.5 rounded-card border border-line bg-surface px-3 text-xs font-semibold text-ink disabled:opacity-40"
          >
            {copied ? <Check size={14} className="text-verified" /> : null}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            disabled={holds.length === 0 || clearing}
            onClick={handleClearAll}
            className="flex h-10 items-center justify-center gap-1.5 rounded-card border border-danger/30 bg-danger/10 px-3 text-xs font-semibold text-danger disabled:opacity-40"
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </section>

      <section className="mt-4">
        <h2 className="font-semibold text-xs tracking-wider text-muted uppercase">Recorded Holds</h2>
        {loading ? (
          <p className="mt-2 text-xs text-muted">Loading recorded holds…</p>
        ) : holds.length === 0 ? (
          <div className="mt-2 rounded-card border border-line bg-surface p-6 text-center text-xs text-muted">
            No holds recorded yet. Enable the recorder above, go to{" "}
            <a href="/point" className="text-primary underline">
              Point
            </a>
            , and hold to speak.
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {holds.map((h, index) => (
              <div key={h.id} className="rounded-card border border-line bg-surface p-3 text-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-muted">
                      #{holds.length - index} · {new Date(h.createdAt).toLocaleTimeString()}
                    </span>
                    <p className="mt-0.5 font-medium text-ink">“{h.transcript || h.heard || "(no speech)"}”</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.annotation ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${
                          h.annotation.status === "correct" ? "bg-verified" : "bg-danger"
                        }`}
                      >
                        {h.annotation.status}
                      </span>
                    ) : (
                      <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                        Unannotated
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDelete(h.id)}
                      className="text-muted hover:text-danger"
                      aria-label="Delete hold"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                  <span>Samples: {h.samples.length}</span>
                  <span>SAM Boxes: {h.samBoxes.length}</span>
                  <span>Marks: {h.marks.length}</span>
                  <span>Actions: {h.intent?.actions.length ?? 0}</span>
                  <span>Duration: {Math.round(h.durationMs)}ms</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-8 border-t border-line pt-4 text-center text-xs text-muted">
        <div className="flex justify-center gap-4">
          <a href="/point" className="text-primary hover:underline">
            Point View
          </a>
          <span>•</span>
          <a href="/basket" className="text-primary hover:underline">
            Basket View
          </a>
          <span>•</span>
          <a href="/products" className="text-primary hover:underline">
            Products View
          </a>
        </div>
      </footer>
    </div>
  );
}
