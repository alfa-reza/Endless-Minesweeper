import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../utils/cn";

interface ModalProps {
  children: ReactNode;
  onClose?: () => void;
  /** Close when the dimmed backdrop is clicked. */
  dismissOnBackdrop?: boolean;
  labelledBy?: string;
  className?: string;
}

/** Native <dialog> modal: top-layer, inert background, Esc/back dismissal, focus return. */
export function Modal({
  children,
  onClose,
  dismissOnBackdrop = true,
  labelledBy,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    const target = dialog.querySelector<HTMLElement>("[data-autofocus]");
    target?.focus({ preventScroll: true });

    // Light-dismiss fallback for browsers without <dialog closedby="any">
    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = dismissOnBackdrop && isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (dismissOnBackdrop && pressedOutside && isOutside(e)) {
        closeRef.current?.();
      }
      pressedOutside = false;
    };

    const supportsClosedBy = "closedBy" in HTMLDialogElement.prototype;
    if (!supportsClosedBy && dismissOnBackdrop) {
      dialog.addEventListener("pointerdown", onPointerDown);
      dialog.addEventListener("pointerup", onPointerUp);
    }

    return () => {
      if (!supportsClosedBy && dismissOnBackdrop) {
        dialog.removeEventListener("pointerdown", onPointerDown);
        dialog.removeEventListener("pointerup", onPointerUp);
      }
      if (dialog.open) dialog.close();
    };
  }, [dismissOnBackdrop]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      {...({ closedby: dismissOnBackdrop ? "any" : "closerequest" } as Record<string, string>)}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current?.();
      }}
      className={cn("modal-dialog animate-pop w-full max-w-lg", className)}
    >
      {children}
    </dialog>
  );
}
