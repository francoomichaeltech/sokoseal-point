"use client";

import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** danger for destructive actions such as delete; primary for a normal confirmation. */
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

// Native modal dialog: focus stays inside, Esc and a tap on the backdrop cancel.
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-card bg-surface p-0 shadow-sheet backdrop:bg-ink/50"
    >
      <div className="p-5">
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 flex-1 rounded-card border border-line bg-surface font-semibold"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-12 flex-1 rounded-card font-semibold text-white ${tone === "danger" ? "bg-danger" : "bg-primary"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}