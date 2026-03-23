import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type SalonNavigationKey =
  | 'anasayfa'
  | 'randevular'
  | 'musteriler'
  | 'kasa-yonetimi'
  | 'personel'
  | 'raporlar'
  | 'hizmetler'
  | 'adaylar'
  | 'taksitler'
  | 'performans'
  | 'subeler'
  | 'odalar'
  | 'sozlesmeler'
  | 'maas';

export type SalonNavigationItem = {
  key: SalonNavigationKey;
  title: string;
  url: string;
  locked: boolean;
  placement: 'topbar' | 'more';
  defaultOrder: number;
  isVisible: boolean;
};

type NavigationPreferenceRow = Tables<'salon_navigation_preferences'>;

const NAVIGATION_ITEMS: Omit<SalonNavigationItem, 'isVisible'>[] = [
  { key: 'anasayfa', title: 'Anasayfa', url: '/', locked: true, placement: 'topbar', defaultOrder: 0 },
  { key: 'randevular', title: 'Randevular', url: '/randevular', locked: true, placement: 'topbar', defaultOrder: 1 },
  { key: 'musteriler', title: 'Müşteriler', url: '/musteriler', locked: true, placement: 'topbar', defaultOrder: 2 },
  { key: 'kasa-yonetimi', title: 'Kasa Yönetimi', url: '/kasa-yonetimi', locked: true, placement: 'topbar', defaultOrder: 3 },
  { key: 'personel', title: 'Personel', url: '/personel', locked: false, placement: 'topbar', defaultOrder: 4 },
  { key: 'raporlar', title: 'Raporlar', url: '/raporlar', locked: false, placement: 'topbar', defaultOrder: 5 },
  { key: 'hizmetler', title: 'Hizmetler', url: '/hizmetler', locked: false, placement: 'more', defaultOrder: 6 },
  { key: 'adaylar', title: 'Aday Müşteriler', url: '/adaylar', locked: false, placement: 'more', defaultOrder: 7 },
  { key: 'taksitler', title: 'Taksitler', url: '/taksitler', locked: false, placement: 'more', defaultOrder: 8 },
  { key: 'performans', title: 'Performans', url: '/performans', locked: false, placement: 'more', defaultOrder: 9 },
  { key: 'subeler', title: 'Şubeler', url: '/subeler', locked: false, placement: 'more', defaultOrder: 10 },
  { key: 'odalar', title: 'Odalar', url: '/odalar', locked: false, placement: 'more', defaultOrder: 11 },
  { key: 'sozlesmeler', title: 'Sözleşmeler', url: '/sozlesmeler', locked: false, placement: 'more', defaultOrder: 12 },
  { key: 'maas', title: 'Maaş & Ödeme', url: '/maas', locked: false, placement: 'more', defaultOrder: 13 },
];

const isRelevantPayload = (
  payload: { new?: Partial<NavigationPreferenceRow> | null; old?: Partial<NavigationPreferenceRow> | null },
  userId: string,
  salonId: string,
) => {
  const row = payload.new ?? payload.old;
  return row?.user_id === userId && row?.salon_id === salonId;
};

export function useSalonNavigation() {
  const { user, currentSalonId } = useAuth();
  const [preferences, setPreferences] = useState<NavigationPreferenceRow[]>([]);

  const fetchPreferences = useCallback(async () => {
    if (!user || !currentSalonId) {
      setPreferences([]);
      return;
    }

    const { data, error } = await supabase
      .from('salon_navigation_preferences')
      .select('*')
      .eq('user_id', user.id)
      .eq('salon_id', currentSalonId);

    if (!error) {
      setPreferences(data || []);
    }
  }, [currentSalonId, user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  useEffect(() => {
    if (!user || !currentSalonId) return;

    const channel = supabase
      .channel(`salon-navigation-${user.id}-${currentSalonId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salon_navigation_preferences' },
        (payload) => {
          if (isRelevantPayload(payload, user.id, currentSalonId)) {
            fetchPreferences();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSalonId, fetchPreferences, user]);

  const items = useMemo(() => {
    const preferenceMap = new Map(
      preferences.map((preference) => [preference.item_key, preference]),
    );

    return NAVIGATION_ITEMS.map((item) => {
      const preference = preferenceMap.get(item.key);
      return {
        ...item,
        isVisible: item.locked ? true : preference?.is_visible ?? true,
        defaultOrder: preference?.sort_order ?? item.defaultOrder,
      };
    }).sort((a, b) => a.defaultOrder - b.defaultOrder);
  }, [preferences]);

  const topbarItems = items.filter((item) => item.placement === 'topbar' && item.isVisible);
  const moreItems = items.filter((item) => item.placement === 'more' && item.isVisible);

  return {
    items,
    topbarItems,
    moreItems,
    hasMoreItems: moreItems.length > 0,
  };
}
