import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const ConfirmContext = createContext(async () => false);

function normalizeOptions(options = {}) {
  if (typeof options === 'string') {
    return {
      title: 'Confirmar ação',
      message: options || 'Deseja continuar?',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      tone: 'default',
    };
  }

  const safeOptions = options && typeof options === 'object' ? options : {};

  return {
    title: safeOptions.title || 'Confirmar ação',
    message: safeOptions.message || 'Deseja continuar?',
    confirmText: safeOptions.confirmText || 'Confirmar',
    cancelText: safeOptions.cancelText || 'Cancelar',
    tone: safeOptions.tone === 'danger' ? 'danger' : 'default',
  };
}

export function ConfirmProvider({ children }) {
  const queueRef = useRef([]);
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [dialog, setDialog] = useState(null);

  const openNext = useCallback(() => {
    setDialog((current) => {
      if (current) {
        return current;
      }

      const next = queueRef.current.shift();
      return next || null;
    });
  }, []);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        queueRef.current.push({
          options: normalizeOptions(options),
          resolve,
        });
        openNext();
      }),
    [openNext]
  );

  const resolveDialog = useCallback(
    (accepted) => {
      setDialog((current) => {
        if (!current) {
          return null;
        }

        current.resolve(Boolean(accepted));
        return null;
      });

      window.setTimeout(() => {
        openNext();
      }, 0);
    },
    [openNext]
  );

  useEffect(() => {
    if (!dialog) {
      return undefined;
    }

    previousFocusRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => cancelButtonRef.current?.focus(), 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        resolveDialog(false);
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll('button:not([disabled]), [href], input, select, textarea')
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [dialog, resolveDialog]);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      {dialog ? (
        <div
          className="site-confirm-backdrop"
          onClick={() => resolveDialog(false)}
          role="presentation"
        >
          <div
            aria-describedby="site-confirm-message"
            aria-labelledby="site-confirm-title"
            aria-modal="true"
            className="site-confirm-dialog"
            onClick={(event) => event.stopPropagation()}
            ref={dialogRef}
            role="alertdialog"
          >
            <p className="eyebrow">Confirmação</p>
            <h3 className="site-confirm-title" id="site-confirm-title">
              {dialog.options.title}
            </h3>
            <p className="site-confirm-message" id="site-confirm-message">
              {dialog.options.message}
            </p>

            <div className="site-confirm-actions">
              <button
                className="ghost-button"
                onClick={() => resolveDialog(false)}
                ref={cancelButtonRef}
                type="button"
              >
                {dialog.options.cancelText}
              </button>
              <button
                className={
                  dialog.options.tone === 'danger' ? 'danger-button' : 'gold-button'
                }
                onClick={() => resolveDialog(true)}
                type="button"
              >
                {dialog.options.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

