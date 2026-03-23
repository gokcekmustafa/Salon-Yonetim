import { useEffect } from 'react';

/**
 * Warns user before leaving page when a form is open.
 * Uses beforeunload for tab close/refresh and
 * overrides sidebar navigation via popstate for back/forward.
 * 
 * Does NOT interfere with visibility changes (tab switching).
 */
export function useFormGuard(isFormOpen: boolean) {
  // Handle browser tab close / refresh
  useEffect(() => {
    if (!isFormOpen) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isFormOpen]);

  // Handle browser back/forward button
  useEffect(() => {
    if (!isFormOpen) return;

    // Push a dummy state so pressing back triggers popstate instead of leaving
    window.history.pushState({ formGuard: true }, '');

    const handler = (e: PopStateEvent) => {
      if (isFormOpen) {
        const leave = window.confirm(
          'Açık formunuz var. Sayfadan ayrılmak istediğinize emin misiniz? Kaydedilmemiş değişiklikler kaybolacak.'
        );
        if (!leave) {
          // Stay on current page – re-push the guard state
          window.history.pushState({ formGuard: true }, '');
        }
        // If leave is true, the browser will navigate back naturally
      }
    };

    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
    };
  }, [isFormOpen]);
}
