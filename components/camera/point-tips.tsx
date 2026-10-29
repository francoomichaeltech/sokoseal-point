"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CircleHelp, ImageIcon, Mic, Pointer } from "lucide-react";
import { useMessages } from "@/lib/i18n/locale";

const SEEN_KEY = "sokoseal.pointTips.seen";

// Shown once on the first visit to Point; the ? button reopens it.
export function PointTips() {
  const t = useMessages().point.tips;
  // Point only renders on the client (see DeviceGate), so localStorage is available.
  const [open, setOpen] = useState(() => localStorage.getItem(SEEN_KEY) !== "1");
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function close() {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  }

  const items = [
    { Icon: Camera, text: t.camera },
    { Icon: Pointer, text: t.point },
    { Icon: Mic, text: t.speak },
    { Icon: ImageIcon, text: t.photos },
  ];

  return (
    <>
      <button
        type="button"
        aria-label={t.open}
        onClick={() => setOpen(true)}
        className="absolute top-2 right-2 z-10 grid size-9 place-items-center rounded-full bg-ink/60 text-white"
      >
        <CircleHelp aria-hidden size={20} />
      </button>

      <dialog
        ref={ref}
        aria-labelledby="tips-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto mb-0 w-full max-w-md rounded-t-sheet bg-surface p-0 shadow-sheet backdrop:bg-ink/50"
      >
        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <h2 id="tips-title" className="text-lg font-bold">
            {t.title}
          </h2>
          <ul className="mt-4 space-y-3">
            {items.map(({ Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <Icon aria-hidden size={16} />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">{t.honest}</p>
          <button type="button" onClick={close} className="mt-5 h-12 w-full rounded-card bg-primary font-semibold text-white">
            {t.ok}
          </button>
        </div>
      </dialog>
    </>
  );
}