"use client";

import { MoreHorizontal } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type ActionMenuProps = {
  label?: string;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
};

type MenuPosition = {
  left: number;
  top: number;
};

export function ActionMenu({ label = "İşlemler", children, align = "right", className }: ActionMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = Math.min(224, window.innerWidth - 24);
      const menuHeight = menuRef.current?.offsetHeight ?? 240;
      const preferredLeft = align === "right" ? rect.right - menuWidth : rect.left;
      const preferredTop = rect.bottom + 8;
      setPosition({
        left: Math.max(12, Math.min(preferredLeft, window.innerWidth - menuWidth - 12)),
        top: preferredTop + menuHeight <= window.innerHeight - 12
          ? preferredTop
          : Math.max(12, rect.top - menuHeight - 8)
      });
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    updatePosition();
    window.requestAnimationFrame(() => focusMenuItem(menuRef.current, 0));
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [align, open]);

  function toggleMenu(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setOpen((value) => !value);
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!menuRef.current || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = menuItems(menuRef.current);
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-button min-h-11 min-w-11 shrink-0"
        aria-label="İşlemler"
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-action-menu-ready={mounted ? "true" : "false"}
        onClick={toggleMenu}
        onKeyDown={handleTriggerKeyDown}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {position
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-hidden={!open}
              className={cn(
                "fixed z-[100] w-56 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-[0_24px_70px_rgba(15,23,42,0.20)]",
                !open && "hidden"
              )}
              style={{ left: position.left, top: position.top }}
              onClick={(event) => {
                event.stopPropagation();
                if ((event.target as Element).closest("a, button")) setOpen(false);
              }}
              onKeyDown={handleMenuKeyDown}
            >
              <div className="grid gap-1 [&_a]:min-h-11 [&_a]:w-full [&_a]:justify-start [&_a]:rounded-lg [&_a]:px-3 [&_button]:min-h-11 [&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg [&_button]:px-3">
                {children}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export const RecordActionMenu = ActionMenu;

function menuItems(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [role="menuitem"][tabindex]'));
}

function focusMenuItem(container: HTMLElement | null, index: number) {
  if (!container) return;
  menuItems(container)[index]?.focus();
}
