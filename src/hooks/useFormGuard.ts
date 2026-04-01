import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Warns user on page exits (refresh/tab close) AND in-app navigation while form is open.
 */
export function useFormGuard(isFormOpen: boolean) {
  // Block in-app navigation via react-router
  const blocker = useBlocker(
    useCallback(() => isFormOpen, [isFormOpen])
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const confirmed = window.confirm('Devam eden bir işleminiz var. Sayfadan ayrılmak istediğinize emin misiniz?');
      if (confirmed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

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
