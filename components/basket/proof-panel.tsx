"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { describeChange } from "@/lib/commerce/changes";
import type { ProofEntry } from "@/lib/commerce/types";
import { useLocale, useMessages } from "@/lib/i18n/locale";

type RequestEntry = Extract<ProofEntry, { kind: "request" }>;
type EditEntry = Extract<ProofEntry, { kind: "edit" }>;

// Two parts: what was asked, as applied (never changes), and the user's own changes after it.
export function ProofPanel({ proof }: { proof: ProofEntry[] }) {
  const messages = useMessages();
  const t = messages.basket;
  const p = messages.point;
  const locale = useLocale();

  const time = (at: number) =>
    new Date(at).toLocaleTimeString(locale === "sw" ? "sw-TZ" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  const requests = proof.filter((entry): entry is RequestEntry => entry.kind === "request");
  const edits = proof.filter((entry): entry is EditEntry => entry.kind === "edit");
  const heading = "text-xs font-semibold tracking-wide text-muted uppercase";

  return (
    <details className="group overflow-hidden rounded-card border border-line bg-surface">
      <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 font-semibold">
        {t.proof}
        <ChevronDown aria-hidden size={18} className="text-muted transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-5 border-t border-line p-4 text-sm">
        <section>
          <h3 className={heading}>{t.original}</h3>
          <ol className="mt-2 space-y-4">
            {requests.map((entry, index) => (
              <li key={index}>
                <p className="text-xs text-muted">{time(entry.at)}</p>
                <p className="font-medium">“{entry.transcript || entry.heard}”</p>
                {entry.transcript && entry.heard && entry.transcript !== entry.heard && (
                  <p className="text-xs text-muted">
                    {p.voice.heard} “{entry.heard}”
                  </p>
                )}
                <ul className="mt-1 space-y-0.5">
                  {entry.outcomes.map((outcome, outcomeIndex) => (
                    <li key={outcomeIndex} className="flex items-start gap-1.5">
                      {outcome.status === "applied" ? (
                        <Check aria-hidden size={14} className="mt-0.5 shrink-0 text-verified" />
                      ) : (
                        <X aria-hidden size={14} className="mt-0.5 shrink-0 text-muted" />
                      )}
                      <span>
                        {p.intent.actions[outcome.action]}{" "}
                        {outcome.quantity ?? (outcome.action === "REMOVE" ? p.intent.all : "?")} ·{" "}
                        {outcome.status === "applied" ? outcome.name : p.outcome.reasons[outcome.reason]}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className={heading}>{t.edits}</h3>
          {edits.length === 0 ? (
            <p className="mt-2 text-muted">{t.noEdits}</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {edits.map((entry, index) => {
                const change = describeChange(entry.from, entry.to);

                const label =
                  change.kind === "added"
                    ? t.changeAdded(change.amount)
                    : change.kind === "reduced"
                      ? t.changeReduced(change.amount)
                      : t.changeRemoved;

                return (
                  <li key={index} className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-xs text-muted">{time(entry.at)}</span>
                    <span>
                      · {entry.name}: {entry.from} → {entry.to}
                    </span>
                    <span className={`text-xs font-semibold ${change.kind === "added" ? "text-verified" : "text-danger"}`}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </details>
  );
}