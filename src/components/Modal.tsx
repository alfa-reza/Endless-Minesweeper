import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../utils/cn";

interface ModalProps {
  children: ReactNode;
  onClose?: () => void;
  /** Close when the dimmed backdrop is clicked. */
  dismissOnBackdrop?: boolean;
  labelledBy?: string;
  className?: string;
  /** Extra classes for the backdrop (e.g. to let clicks through). */
  backdropClassName?: string;
}

/** Accessible modal: Esc to close, focus trap, restores focus on close. */
export function Modal({
  children,
  onClose,
  dismissOnBackdrop = true,
  labelledBy,
  className,
  backdropClassName,
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const card = cardRef.current!;
    const focusables = () =>
      Array.from(
        card.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
    const target = card.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0];
    target?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.repeat) {
        e.preventDefault();
        closeRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      className={cn(
        "animate-fade fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[radial-gradient(1000px_700px_at_50%_15%,rgba(124,160,255,0.12),rgba(0,0,0,0.62))] p-3 backdrop-blur-[3px]",
        backdropClassName,
      )}
      onPointerDown={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          "animate-pop glass w-full max-w-lg overflow-hidden rounded-3xl bg-linear-to-b from-[#151a3a]/90 to-[#0b0f24]/90 shadow-[0_30px_100px_rgba(0,0,0,0.55)]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
