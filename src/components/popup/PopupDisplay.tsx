import { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PopupData {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  duration_seconds: number;
}

export function PopupDisplay() {
  const { user } = useAuth();
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  const dismiss = useCallback(async () => {
    if (!popup || !user) return;
    setVisible(false);
    // Track view
    await supabase.from('popup_views' as any).insert({ popup_id: popup.id, user_id: user.id } as any).select();
  }, [popup, user]);

  useEffect(() => {
    if (!user) return;
    const fetchPopup = async () => {
      // Get active popups
      const { data: popups } = await supabase
        .from('popup_announcements' as any)
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!popups || (popups as any[]).length === 0) return;

      // Get already-viewed popup IDs
      const { data: views } = await supabase
        .from('popup_views' as any)
        .select('popup_id')
        .eq('user_id', user.id);

      const viewedIds = new Set((views as any[] || []).map((v: any) => v.popup_id));
      const unseen = (popups as any[]).find((p: any) => !viewedIds.has(p.id));

      if (unseen) {
        setPopup(unseen as PopupData);
        // Small delay for smooth entrance
        setTimeout(() => setVisible(true), 300);
      }
    };
    fetchPopup();
  }, [user]);

  // Auto-close timer with progress
  useEffect(() => {
    if (!visible || !popup) return;
    const totalMs = popup.duration_seconds * 1000;
    const intervalMs = 50;
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += intervalMs;
      setProgress(Math.max(0, 100 - (elapsed / totalMs) * 100));
      if (elapsed >= totalMs) {
        clearInterval(interval);
        dismiss();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [visible, popup, dismiss]);

  if (!popup || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-muted w-full">
          <div
            className="h-full bg-primary transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="p-6 pt-5">
          {/* Icon */}
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold text-foreground mb-2">{popup.title}</h2>

          {/* Message */}
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {popup.message}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-5">
            {popup.link_url && (
              <Button asChild size="sm" className="btn-gradient gap-1.5">
                <a href={popup.link_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {popup.link_label || 'Detaylar'}
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={dismiss}>
              Kapat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
