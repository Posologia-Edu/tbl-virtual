import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type PendingAction = {
  id: string;
  table: string;
  method: 'insert' | 'upsert';
  data: Record<string, any>;
  timestamp: number;
};

const STORAGE_KEY = 'tbl-offline-queue';

function loadQueue(): PendingAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingAction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useOfflineSync() {
  const isOnline = useConnectionStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  // Update pending count on mount
  useEffect(() => {
    setPendingCount(loadQueue().length);
  }, []);

  const enqueue = useCallback((table: string, method: 'insert' | 'upsert', data: Record<string, any>) => {
    const action: PendingAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      table,
      method,
      data,
      timestamp: Date.now(),
    };
    const queue = loadQueue();
    queue.push(action);
    saveQueue(queue);
    setPendingCount(queue.length);
    return action.id;
  }, []);

  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return;
    const queue = loadQueue();
    if (queue.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);

    const failed: PendingAction[] = [];
    let successCount = 0;

    for (const action of queue) {
      try {
        let error: any = null;
        if (action.method === 'insert') {
          const res = await (supabase.from(action.table as any) as any).insert(action.data);
          error = res.error;
        } else if (action.method === 'upsert') {
          const res = await (supabase.from(action.table as any) as any).upsert(action.data);
          error = res.error;
        }

        if (error) {
          // Duplicate key = already synced, skip
          if (error.code === '23505') {
            successCount++;
          } else {
            failed.push(action);
          }
        } else {
          successCount++;
        }
      } catch {
        failed.push(action);
      }
    }

    saveQueue(failed);
    setPendingCount(failed.length);
    syncingRef.current = false;
    setSyncing(false);

    if (successCount > 0) {
      toast.success(`${successCount} resposta(s) sincronizada(s) com sucesso!`);
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} resposta(s) não puderam ser sincronizadas. Tentaremos novamente.`);
    }
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline) {
      const queue = loadQueue();
      if (queue.length > 0) {
        // Small delay to let network stabilize
        const timeout = setTimeout(syncQueue, 1500);
        return () => clearTimeout(timeout);
      }
    }
  }, [isOnline, syncQueue]);

  // Periodic sync attempt every 30s while online
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      const queue = loadQueue();
      if (queue.length > 0) syncQueue();
    }, 30000);
    return () => clearInterval(interval);
  }, [isOnline, syncQueue]);

  // Resilient submit: tries Supabase first, falls back to local queue
  const resilientSubmit = useCallback(async (
    table: string,
    method: 'insert' | 'upsert',
    data: Record<string, any>,
  ): Promise<{ success: boolean; offline: boolean; error?: any }> => {
    if (!isOnline) {
      enqueue(table, method, data);
      return { success: true, offline: true };
    }

    try {
      let result: any;
      if (method === 'insert') {
        result = await (supabase.from(table as any) as any).insert(data);
      } else {
        result = await (supabase.from(table as any) as any).upsert(data);
      }

      if (result.error) {
        // Network error → cache locally
        if (result.error.message?.includes('fetch') || result.error.message?.includes('network')) {
          enqueue(table, method, data);
          return { success: true, offline: true };
        }
        return { success: false, offline: false, error: result.error };
      }

      return { success: true, offline: false };
    } catch (err) {
      // Network failure → cache locally
      enqueue(table, method, data);
      return { success: true, offline: true };
    }
  }, [isOnline, enqueue]);

  return {
    isOnline,
    pendingCount,
    syncing,
    resilientSubmit,
    syncQueue,
    enqueue,
  };
}
