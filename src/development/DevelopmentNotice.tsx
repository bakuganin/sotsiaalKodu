import { tr } from "../i18n";
import { useCallback, useId, useRef } from "react";
import { BrandSymbol } from "../brand/BrandArtwork";
import { organization } from "../content";
import ContentDialog, {
  type ContentDialogHandle,
} from "../dialog/ContentDialog";
import "./development-notice.css";
import LanguageSwitcher from "../navigation/LanguageSwitcher";

export const DEVELOPMENT_NOTICE_KEY = "sotsiaal-development-notice-dismissed";

export function shouldShowDevelopmentNotice() {
  try {
    return window.sessionStorage.getItem(DEVELOPMENT_NOTICE_KEY) !== "1";
  } catch {
    return true;
  }
}

interface DevelopmentNoticeProps {
  open: boolean;
  onDismiss: () => void;
}

export default function DevelopmentNotice({
  open,
  onDismiss,
}: DevelopmentNoticeProps) {
  const dialogRef = useRef<ContentDialogHandle>(null);
  const descriptionId = useId();
  const acknowledge = useCallback(() => {
    try {
      window.sessionStorage.setItem(DEVELOPMENT_NOTICE_KEY, "1");
    } catch {
      // A blocked storage API must never prevent entering the site.
    }
    onDismiss();
  }, [onDismiss]);

  return (
    <ContentDialog
      ref={dialogRef}
      open={open}
      contentKey="development-notice"
      onClose={acknowledge}
      closeLabel={tr("Закрыть предупреждение и перейти на сайт")}
      title={tr("Сайт ещё в разработке")}
      descriptionId={descriptionId}
      className="development-notice"
      header={
        <div className="development-notice-header">
          <LanguageSwitcher />
          <div className="development-notice-badge" aria-hidden="true">
            <svg viewBox="0 0 128 128" fill="currentColor" focusable="false">
              <BrandSymbol />
            </svg>
          </div>
          <p className="development-notice-brand">{organization.publicName}</p>
        </div>
      }
    >
      <p id={descriptionId} className="development-notice-description">
        {tr(
          "Мы постепенно обновляем сайт. Некоторые разделы и функции пока могут работать не полностью.",
        )}
      </p>
      <button
        type="button"
        className="development-notice-continue"
        onClick={() => dialogRef.current?.close(acknowledge)}
      >
        {tr("Перейти на сайт")}
      </button>
      <p className="development-notice-contact">
        <span>{tr("Связаться с нами: ")}</span>
        <a href={`tel:${organization.phone}`}>{organization.phoneDisplay}</a>
      </p>
    </ContentDialog>
  );
}
