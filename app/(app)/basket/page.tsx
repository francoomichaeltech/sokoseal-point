"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, ShoppingBasket } from "lucide-react";
import { OutcomeList } from "@/components/camera/outcome-list";
import { useProducts } from "@/lib/catalogue/store";
import { applyActions } from "@/lib/commerce/plan";
import { applyHold, useBasket } from "@/lib/commerce/store";
import { useMessages } from "@/lib/i18n/locale";
import { formatMoney } from "@/lib/money";
import { clearRequest, useRequest } from "@/lib/requests/store";

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

function RequestCard() {
  const router = useRouter();
  const request = useRequest();
  const basket = useBasket();
  const products = useProducts();
  const t = useMessages();

  if (!request) return null;

  const cardClass = "rounded-card border border-line bg-surface p-4";

  if (request.phase === "processing") {
    return (
      <section className={cardClass}>
        <p className="flex items-center gap-2 text-sm">
          <LoaderCircle aria-hidden size={16} className="shrink-0 animate-spin" />
          {t.basket.processing}
        </p>
      </section>
    );
  }

  if (request.phase === "error") {
    return (
      <section className={cardClass}>
        <p className="text-sm text-danger">{t.basket.error}</p>
        <button
          type="button"
          onClick={() => {
            clearRequest();
            router.push("/point");
          }}
          className="mt-3 h-11 w-full rounded-card border border-line bg-surface font-semibold"
        >
          {t.basket.pointAgain}
        </button>
      </section>
    );
  }

  // A dry run on the current basket shows what adding would do; nothing changes until Add is pressed.
  const preview = applyActions(basket?.lines ?? [], request.actions, request.targets, products ?? []).outcomes;
  const canAdd = preview.some((outcome) => outcome.status === "applied");
  const corrected = request.transcript !== "" && !sameWords(request.transcript, request.heard);

  return (
    <section className={cardClass}>
      <h2 className="text-sm font-semibold text-muted">{t.basket.newRequest}</h2>
      {request.transcript ? (
        <p className="mt-1 font-medium">“{request.transcript}”</p>
      ) : (
        <p className="mt-1 text-muted">{t.point.voice.empty}</p>
      )}
      {corrected && (
        <p className="mt-0.5 text-xs text-muted">
          {t.point.voice.heard} “{request.heard}”
        </p>
      )}
      <p className="mt-2 text-xs text-muted">{t.point.pointing.summary(request.pointed, request.objectCount)}</p>

      {request.actions.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.point.intent.none}</p>
      ) : (
        <div className="mt-3">
          <OutcomeList outcome={{ phase: "done", outcomes: preview }} />
        </div>
      )}
      {request.needsClarification && <p className="mt-2 text-sm text-attention">{t.point.intent.unclear}</p>}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={clearRequest}
          className="h-11 flex-1 rounded-card border border-line bg-surface font-semibold"
        >
          {t.basket.discard}
        </button>
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => {
            applyHold(request.eventId, request.actions, request.targets, products ?? []);
            clearRequest();
          }}
          className="h-11 flex-1 rounded-card bg-primary font-semibold text-white disabled:opacity-50"
        >
          {t.basket.add}
        </button>
      </div>
    </section>
  );
}

export default function BasketPage() {
  const router = useRouter();
  const basket = useBasket();
  const request = useRequest();
  const t = useMessages().basket;

  if (!basket) return null;

  const lines = basket.lines;
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const currency = lines[0]?.currency;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <RequestCard />

      {lines.length === 0 ? (
        !request && (
          <div className="mt-8 flex flex-col items-center text-center">
            <ShoppingBasket aria-hidden size={32} strokeWidth={1.5} className="text-muted" />
            <p className="mt-3 text-sm text-muted">{t.empty}</p>
            <button
              type="button"
              onClick={() => router.push("/point")}
              className="mt-5 h-12 rounded-card bg-primary px-5 font-semibold text-white"
            >
              {t.pointAgain}
            </button>
          </div>
        )
      ) : (
        <section className="rounded-card border border-line bg-surface">
          <ul className="divide-y divide-line">
            {lines.map((line) => (
              <li key={line.sku} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{line.name}</p>
                  <p data-money className="text-sm text-muted">
                    {line.quantity} × {formatMoney(line.unitPrice, line.currency)}
                  </p>
                </div>
                <p data-money className="shrink-0 font-semibold">
                  {formatMoney(line.unitPrice * line.quantity, line.currency)}
                </p>
              </li>
            ))}
          </ul>
          {currency && (
            <div className="flex justify-between border-t border-line px-4 py-3 font-bold">
              <span>{t.total}</span>
              <span data-money>{formatMoney(total, currency)}</span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}