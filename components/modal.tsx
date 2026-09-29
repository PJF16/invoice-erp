"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Natives Modal: Fokus bleibt im Dialog, Escape schließt, Fokus kehrt zurück. */
export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} aria-busy={busy}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/40">
    <div className="p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4"><h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Dialog schließen" className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50">×</button>
      </div>
      {children}
    </div>
  </dialog>;
}
