"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBasket } from "lucide-react";
import { ActionBar } from "@/components/basket/action-bar";
import { BasketLines } from "@/components/basket/basket-lines";
import { ProofPanel } from "@/components/basket/proof-panel";
import { RequestCard } from "@/components/basket/request-card";
import { SealedView } from "@/components/basket/sealed-view";
import { BasketSteps } from "@/components/basket/steps";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { removeLine, sealBasket, useBasket } from "@/lib/commerce/store";
import type { BasketLine } from "@/lib/commerce/types";
import { useMessages } from "@/lib/i18n/locale";
import { formatMoney } from "@/lib/money";
import { useRequest } from "@/lib/requests/store";

export default function BasketPage() {
  const router = useRouter();
  const basket = useBasket();
  const request = useRequest();
  const t = useMessages().basket;
  const [sealing, setSealing] = useState(false);
  const [removing, setRemoving] = useState<BasketLine | null>(null);
  const [leavingToPoint, setLeavingToPoint] = useState(false);

  if (!basket) {
    return (
      <div className="flex flex-col gap-4 py-2" aria-busy="true">
        <div className="h-8 w-28 rounded-control bg-line/60" />
        <div className="h-6 w-full rounded-control bg-line/40" />
        <div className="h-36 rounded-card border border-line bg-surface" />
      </div>
    );
  }
  if (basket.sealedAt !== null) return <SealedView basket={basket} />;
  if (leavingToPoint) return null;

  const lines = basket.lines;
  const hasLines = lines.length > 0;
  const items = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const totalText = hasLines ? formatMoney(total, lines[0].currency) : "";

  function confirmRemove() {
    if (!removing) return;
    const sku = removing.sku;
    const willBeEmpty = lines.length === 1 && !request;
    setRemoving(null);
    if (willBeEmpty) {
      // Navigate first, then clear the last line so the empty basket never flashes before Point.
      setLeavingToPoint(true);
      router.push("/point");
      window.setTimeout(() => {
        removeLine(sku);
      }, 120);
      return;
    }
    removeLine(sku);
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <BasketSteps current={sealing ? 1 : 0} />
      </div>

      {request && <RequestCard key={request.eventId} />}

      {hasLines ? (
        <BasketLines lines={lines} onRemove={setRemoving} />
      ) : (
        !request && (
          <div className="mt-8 flex flex-col items-center text-center">
            <ShoppingBasket aria-hidden size={32} strokeWidth={1.5} className="text-muted" />
            <p className="mt-3 text-sm text-muted">{t.empty}</p>
            <button
              type="button"
              onClick={() => router.push("/point")}
              className="mt-5 h-12 rounded-card bg-primary px-6 font-semibold text-white"
            >
              {t.pointAgain}
            </button>
          </div>
        )
      )}

      {basket.proof.length > 0 && <ProofPanel proof={basket.proof} />}

      {/* A request under review must be added or discarded before sealing. */}
      {hasLines && !request && (
        <ActionBar>
          <button
            type="button"
            onClick={() => router.push("/point")}
            className="h-12 flex-1 rounded-card border border-line bg-surface font-semibold"
          >
            {t.pointAgain}
          </button>
          <button
            type="button"
            onClick={() => setSealing(true)}
            className="h-12 flex-1 rounded-card bg-primary font-semibold text-white"
          >
            {t.seal}
          </button>
        </ActionBar>
      )}

      {sealing && (
        <ConfirmDialog
          tone="primary"
          title={t.sealTitle}
          body={t.sealBody(items, totalText)}
          confirmLabel={t.sealYes}
          cancelLabel={t.cancel}
          onConfirm={() => {
            const main = document.querySelector("main");
            if (main) main.scrollTop = 0;
            window.scrollTo(0, 0);
            sealBasket();
            setSealing(false);
          }}
          onCancel={() => setSealing(false)}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={t.removeTitle(removing.name)}
          body={lines.length === 1 ? t.removeLastBody : t.removeBody}
          confirmLabel={t.removeYes}
          cancelLabel={t.cancel}
          onConfirm={confirmRemove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}