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
import { sealBasket, useBasket } from "@/lib/commerce/store";
import { useMessages } from "@/lib/i18n/locale";
import { formatMoney } from "@/lib/money";
import { useRequest } from "@/lib/requests/store";

export default function BasketPage() {
  const router = useRouter();
  const basket = useBasket();
  const request = useRequest();
  const t = useMessages().basket;
  const [sealing, setSealing] = useState(false);

  if (!basket) return null;
  if (basket.sealedAt !== null) return <SealedView basket={basket} />;

  const lines = basket.lines;
  const hasLines = lines.length > 0;
  const items = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const totalText = hasLines ? formatMoney(total, lines[0].currency) : "";

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <BasketSteps current={sealing ? 1 : 0} />
      </div>

      {request && <RequestCard key={request.eventId} />}

      {hasLines ? (
        <BasketLines lines={lines} />
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
            sealBasket();
            setSealing(false);
          }}
          onCancel={() => setSealing(false)}
        />
      )}
    </div>
  );
}