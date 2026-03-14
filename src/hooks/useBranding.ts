import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BrandingSettings {
  company_name: string;
  app_name: string;
  logo_url: string;
}

const DEFAULTS: BrandingSettings = {
  company_name: 'Salonum Online',
  app_name: 'Salon Yönetim Paneli',
  logo_url: '',
};

export function useBranding() {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['company_name', 'app_name', 'logo_url']);

    if (!error && data) {
      const map: Record<string, string> = {};
      data.forEach(row => {
        map[row.key] = typeof row.value === 'string' ? row.value : String(row.value ?? '');
      });
      setBranding({
        company_name: map.company_name || DEFAULTS.company_name,
        app_name: map.app_name || DEFAULTS.app_name,
        logo_url: map.logo_url || DEFAULTS.logo_url,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBranding(); }, [fetchBranding]);

  const updateBranding = useCallback(async (key: keyof BrandingSettings, value: string) => {
    const { error } = await supabase
      .from('platform_settings')
      .update({ value: JSON.parse(JSON.stringify(value)) })
      .eq('key', key);

    if (!error) {
      setBranding(prev => ({ ...prev, [key]: value }));
    }
    return { error };
  }, []);

  return { branding, loading, updateBranding, refetch: fetchBranding };
}
