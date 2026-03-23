import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Blocks in-app navigation and browser back/forward when a form is open.
 * Shows a native confirm dialog to let the user decide.
 */
export function useFormGuard(isFormOpen: boolean) {
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        isFormOpen && currentLocation.pathname !== nextLocation.pathname,
      [isFormOpen]
    )
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const leave = window.confirm('Açık formunuz var. Sayfadan ayrılmak istediğinize emin misiniz? Kaydedilmemiş değişiklikler kaybolacak.');
      if (leave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Also handle browser tab close / refresh
  useEffect(() => {
    if (!isFormOpen) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isFormOpen]);
}
