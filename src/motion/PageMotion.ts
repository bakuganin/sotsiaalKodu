import { useLayoutEffect, useState } from "react";
import "./page-motion.css";

/** Keep the gate closed through a dialog's exit, until its native close(). */
export function usePageMotionGate(requestedPause: boolean) {
  const [dialogOpen, setDialogOpen] = useState(false);

  useLayoutEffect(() => {
    const update = () => {
      setDialogOpen(document.querySelector("dialog[open]") !== null);
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    update();
    return () => observer.disconnect();
  }, []);

  return requestedPause || dialogOpen;
}
