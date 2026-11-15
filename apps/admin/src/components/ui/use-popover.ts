'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * Open/close state for a disclosure popover (a button that shows a panel): closes on a click
 * outside or Escape, and Escape returns focus to the toggle.
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return {
    open,
    setOpen,
    toggleOpen: () => setOpen((value) => !value),
    /** Attach to the element wrapping both the toggle and the panel. */
    containerRef: container,
    /** Attach to the toggle button. */
    toggleRef: toggle,
    panelId,
  };
}
