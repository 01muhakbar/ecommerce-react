import React from "react";
import { createPortal } from "react-dom";
type Props = { open: boolean; onClose: () => void; width?: number; children: React.ReactNode; };

export default function Drawer({ open, onClose, width = 520, children }: Props) {
  if (!open) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose}/>
      <aside
        className="fixed right-0 top-0 h-full bg-white z-50 shadow-2xl overflow-auto"
        style={{ width }}
        role="dialog" aria-modal="true"
      >
        {children}
      </aside>
    </>, document.body
  );
}
