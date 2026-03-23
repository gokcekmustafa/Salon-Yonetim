import { useEffect } from 'react';

/**
 * Warns user only on full page exits (refresh/tab close) while form is open.
 * Avoids history/popstate side effects that can close dialogs on tab/app switching.
 */
export function useFormGuard(isFormOpen: boolean) {
  useEffect(() => {
    if (!isFormOpen) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isFormOpen]);
}
