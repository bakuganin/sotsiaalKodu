import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import "./content-dialog.css";

const TRANSITION_MS = 300;

function prefersLessMotion() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.a11yReduceMotion === "true"
  );
}

export interface ContentDialogHandle {
  close: (afterClose?: () => void) => void;
}

interface ContentDialogProps {
  open: boolean;
  contentKey: string;
  onClose: () => void;
  closeLabel: string;
  title: string;
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  descriptionId?: string;
}

const ContentDialog = forwardRef<ContentDialogHandle, ContentDialogProps>(
  function ContentDialog(
    {
      open,
      contentKey,
      onClose,
      closeLabel,
      title,
      children,
      className = "",
      header,
      descriptionId,
    },
    ref,
  ) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const openingFrame = useRef<number | undefined>(undefined);
    const closeTimer = useRef<number | undefined>(undefined);
    const previousOverflow = useRef<string | null>(null);
    const closing = useRef(false);
    const afterClose = useRef<(() => void) | undefined>(undefined);
    const [visible, setVisible] = useState(false);
    const [lastContent, setLastContent] = useState({
      title,
      children,
      className,
      header,
      descriptionId,
    });

    // Browser Back can remove the route before the exit finishes.
    useLayoutEffect(() => {
      if (open)
        setLastContent({ title, children, className, header, descriptionId });
    }, [open, title, children, className, header, descriptionId]);
    const content = open
      ? { title, children, className, header, descriptionId }
      : lastContent;

    const clearScheduled = useCallback(() => {
      if (openingFrame.current !== undefined)
        cancelAnimationFrame(openingFrame.current);
      openingFrame.current = undefined;
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }, []);

    const releaseDialog = useCallback(() => {
      dialogRef.current?.close();
      if (previousOverflow.current !== null) {
        document.body.style.overflow = previousOverflow.current;
        previousOverflow.current = null;
      }
    }, []);

    const finishClose = useCallback(() => {
      if (!closing.current) return;
      clearScheduled();
      closing.current = false;
      const action = afterClose.current;
      afterClose.current = undefined;
      releaseDialog();
      action?.();
    }, [clearScheduled, releaseDialog]);

    const startClose = useCallback(
      (action?: () => void) => {
        // Repeated Escape/backdrop clicks must not restart the exit.
        if (closing.current) return;
        clearScheduled();
        afterClose.current = action;
        closing.current = true;
        setVisible(false);
        const dialog = dialogRef.current;
        if (!dialog?.open || prefersLessMotion()) finishClose();
        else
          closeTimer.current = window.setTimeout(
            finishClose,
            TRANSITION_MS + 60,
          );
      },
      [clearScheduled, finishClose],
    );

    useImperativeHandle(
      ref,
      () => ({
        close: (action = onClose) => startClose(action),
      }),
      [onClose, startClose],
    );

    useLayoutEffect(() => {
      clearScheduled();
      closing.current = false;
      afterClose.current = undefined;
      const dialog = dialogRef.current;
      const showWhenReady = () => {
        if (!open || !dialog?.isConnected) return;
        if (!dialog.open) {
          previousOverflow.current = document.body.style.overflow;
          document.body.style.overflow = "hidden";
          dialog.showModal();
        }
        dialog.scrollTop = 0;
        if (prefersLessMotion()) setVisible(true);
        else {
          // Give the native top layer an initial painted frame before fading in.
          openingFrame.current = requestAnimationFrame(() => {
            openingFrame.current = requestAnimationFrame(() => {
              openingFrame.current = undefined;
              setVisible(true);
            });
          });
        }
      };
      if (open) {
        if (document.documentElement.dataset.siteReady === "false")
          window.addEventListener("site:ready", showWhenReady, { once: true });
        else showWhenReady();
      } else startClose();

      return () => {
        clearScheduled();
        window.removeEventListener("site:ready", showWhenReady);
      };
    }, [open, contentKey, clearScheduled, startClose]);

    useLayoutEffect(
      () => () => {
        clearScheduled();
        afterClose.current = undefined;
        releaseDialog();
      },
      [clearScheduled, releaseDialog],
    );

    return (
      <dialog
        ref={dialogRef}
        className={`content-dialog ${content.className}`}
        data-visible={visible}
        aria-labelledby={titleId}
        aria-describedby={content.descriptionId}
        onCancel={(event) => {
          event.preventDefault();
          startClose(onClose);
        }}
        onTransitionEnd={(event) => {
          if (
            closing.current &&
            event.target === event.currentTarget &&
            event.propertyName === "opacity" &&
            event.pseudoElement === "" &&
            Number(getComputedStyle(event.currentTarget).opacity) === 0
          )
            finishClose();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            startClose(onClose);
        }}
      >
        <button
          className="icon-button dialog-close"
          aria-label={closeLabel}
          onClick={() => startClose(onClose)}
        >
          <X />
        </button>
        {content.header}
        <h2 id={titleId}>{content.title}</h2>
        {content.children}
      </dialog>
    );
  },
);

export default ContentDialog;
