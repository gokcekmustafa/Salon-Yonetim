import { useEffect } from 'react';

/**
 * Warns user on page exits (refresh/tab close) while form is open.
 */
export function useFormGuard(isFormOpen: boolean) {
  // Block browser refresh / tab close
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
