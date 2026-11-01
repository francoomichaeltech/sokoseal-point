"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { OutcomeList } from "@/components/camera/outcome-list";
import { useProducts } from "@/lib/catalogue/store";
import { applyActions, type Choice } from "@/lib/commerce/plan";
import { applyHold, useBasket } from "@/lib/commerce/store";
import type { RejectReason } from "@/lib/commerce/types";
import { useMessages } from "@/lib/i18n/locale";
import { clearRequest, useRequest } from "@/lib/requests/store";
import { PointedChips } from "./pointed-chips";
import { PointedEvidence } from "./pointed-evidence";

// Product problems the user can settle by picking the product; quantity and basket problems cannot.
const CHOOSABLE: RejectReason[] = [
  "count_mismatch",
  "nothing_pointed",
  "not_in_shop",
  "unclear_product",
  "check_failed",
  "no_previous",
];

const CARD = "rounded-card border border-line bg-surface p-4";
const BUTTON = "h-12 flex-1 rounded-card font-semibold";

// Case and punctuation fixes alone are not worth showing the original for.
function sameWords(a: string, b: string) {
  const words = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
  return words(a) === words(b);
}

export function RequestCard() {
  const router = useRouter();
  const request = useRequest();
  const basket = useBasket();
  const products = useProducts();
  const t = useMessages();
  const [choices, setChoices] = useState<Choice[]>([]);

  if (!request) return null;

  if (request.phase === "processing") {
    return (
      <section className={CARD}>
        <p className="flex items-center gap-2 text-sm">
          <LoaderCircle aria-hidden size={16} className="shrink-0 animate-spin" />
          {t.basket.processing}
        </p>
      </section>
    );
  }

  if (request.phase === "error") {
    return (
      <section className={CARD}>
        <p className="text-sm text-danger">{t.basket.error}</p>
        <button
          type="button"
          onClick={() => {
            clearRequest();
            router.push("/point");
          }}
          className={`mt-3 w-full border border-line bg-surface ${BUTTON}`}
        >
          {t.basket.pointAgain}
        </button>
      </section>
    );
  }

  const active = (products ?? []).filter((product) => product.active);
  // A dry run on the current basket; nothing changes until Add is pressed.
  const preview = applyActions(basket?.lines ?? [], request.actions, request.targets, active, choices).outcomes;
  const pending = preview.filter((outcome) => outcome.status === "rejected" && CHOOSABLE.includes(outcome.reason));
  const settled = preview.filter((outcome) => !pending.includes(outcome));
  const canAdd = preview.some((outcome) => outcome.status === "applied");
  const corrected = request.transcript !== "" && !sameWords(request.transcript, request.heard);

  function choose(index: number, choice: Choice) {
    setChoices((current) => {
      const next = [...current];
      next[index] = choice;
      return next;
    });
  }

  function add() {
    if (request?.phase !== "ready") return;
    applyHold(
      {
        eventId: request.eventId,
        heard: request.heard,
        transcript: request.transcript,
        actions: request.actions,
        targets: request.targets,
      },
      active,
      choices,
    );
    clearRequest();
  }

  return (
    <section className={CARD}>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t.basket.newRequest}</p>
      {request.transcript ? (
        <p className="mt-1 text-lg leading-snug font-semibold">“{request.transcript}”</p>
      ) : (
        <p className="mt-1 text-muted">{t.point.voice.empty}</p>
      )}
      {corrected && (
        <p className="mt-1 text-xs text-muted">
          {t.point.voice.heard} “{request.heard}”
        </p>
      )}

      {!request.handSeen && request.actions.some((action) => action.reference === "POINT") && (
        <p className="mt-3 rounded-control bg-attention-soft px-3 py-2 text-sm text-attention">{t.basket.noHand}</p>
      )}

      {request.evidence && request.marks.some((mark) => mark.box) ? (
        <PointedEvidence evidence={request.evidence} marks={request.marks} />
      ) : (
        request.marks.length > 0 && <PointedChips marks={request.marks} />
      )}

      {request.actions.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.point.intent.none}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {settled.length > 0 && <OutcomeList outcome={{ phase: "done", outcomes: settled }} />}

          {pending.map((outcome) => (
            <div key={outcome.index} className="rounded-control border border-attention/40 bg-attention-soft p-3">
              <p className="text-sm font-semibold">
                {t.basket.choose} · {t.point.intent.actions[outcome.action]}{" "}
                {outcome.quantity ?? (outcome.action === "REMOVE" ? t.point.intent.all : "?")}
              </p>
              <p className="truncate text-xs text-muted">“{outcome.spoken}”</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.map((product) => (
                  <button
                    key={product.sku}
                    type="button"
                    onClick={() => choose(outcome.index, product.sku)}
                    className="h-10 rounded-full border border-line bg-surface px-4 text-sm font-medium"
                  >
                    {product.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => choose(outcome.index, null)}
                  className="h-10 rounded-full px-4 text-sm font-medium text-muted"
                >
                  {t.basket.skip}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {request.needsClarification && <p className="mt-2 text-sm text-attention">{t.point.intent.unclear}</p>}

      <div className="mt-4 flex gap-3">
        <button type="button" onClick={clearRequest} className={`border border-line bg-surface ${BUTTON}`}>
          {t.basket.discard}
        </button>
        <button
          type="button"
          disabled={!canAdd}
          onClick={add}
          className={`bg-primary text-white disabled:opacity-50 ${BUTTON}`}
        >
          {t.basket.add}
        </button>
      </div>
    </section>
  );
}