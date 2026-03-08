import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCookieConsent } from './useCookieConsent';

function getSessionId(): string {
  let id = sessionStorage.getItem('analytics_session_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('analytics_session_id', id);
  }
  return id;
}

function getDeviceType(): string {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export function useAnalytics() {
  const { hasConsent } = useCookieConsent();
  const location = useLocation();
  const lastPath = useRef('');

  const trackEvent = useCallback(async (eventType: string, eventData: Record<string, any> = {}) => {
    if (!hasConsent('analytics')) return;

    try {
      await supabase.from('analytics_events' as any).insert({
        session_id: getSessionId(),
        event_type: eventType,
        event_data: eventData,
        page_url: window.location.pathname,
        referrer: document.referrer || null,
        device_type: getDeviceType(),
        language: navigator.language,
      } as any);
    } catch {
      // silently fail
    }
  }, [hasConsent]);

  // Auto-track page views
  useEffect(() => {
    if (!hasConsent('analytics')) return;
    const path = location.pathname;
    if (path === lastPath.current) return;
    lastPath.current = path;
    trackEvent('page_view', { path });
  }, [location.pathname, hasConsent, trackEvent]);

  return { trackEvent };
}
