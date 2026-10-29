"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { startNewBasket } from "@/lib/commerce/store";
import type { Basket } from "@/lib/commerce/types";
import { useLocale, useMessages } from "@/lib/i18n/locale";
import { clearRequest } from "@/lib/requests/store";
import { ActionBar } from "./action-bar";
import { BasketLines } from "./basket-lines";
import { ProofPanel } from "./proof-panel";
import { BasketSteps } from "./steps";

export function SealedView({ basket }: { basket: Basket }) {
  const router = useRouter();
  const t = useMessages().basket;
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);

  const sealedAt = new Date(basket.sealedAt ?? 0).toLocaleString(locale === "sw" ? "sw-TZ" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-4 pb-20">
      <BasketSteps current={3} />

      <section className="flex flex-col items-center rounded-card border border-line bg-surface px-4 py-6 text-center">
        <CircleCheck aria-hidden size={48} className="text-verified" />
        <h1 className="mt-2 text-2xl font-bold">{t.sealed}</h1>
        <p className="mt-1 text-sm text-muted">{t.sealedBody}</p>
        <p className="mt-1 text-xs text-muted">{sealedAt}</p>
      </section>

      <BasketLines lines={basket.lines} readOnly />
      <ProofPanel proof={basket.proof} />
      <p className="text-center text-xs text-muted">{t.clearNote}</p>

      <ActionBar>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="h-12 flex-1 rounded-card bg-primary font-semibold text-white"
        >
          {t.newBasket}
        </button>
      </ActionBar>

      {confirming && (
        <ConfirmDialog
          title={t.clearTitle}
          body={t.clearBody}
          confirmLabel={t.clearYes}
          cancelLabel={t.cancel}
          onConfirm={() => {
            startNewBasket();
            clearRequest();
            setConfirming(false);
            router.push("/point");
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}