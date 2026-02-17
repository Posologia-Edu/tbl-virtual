import { useConnectionStatus } from '@/hooks/useOfflineSync';
import { Wifi, WifiOff, CloudOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface ConnectionStatusProps {
  pendingCount?: number;
  syncing?: boolean;
}

export default function ConnectionStatus({ pendingCount = 0, syncing = false }: ConnectionStatusProps) {
  const isOnline = useConnectionStatus();
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {(!isOnline || pendingCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-2 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg ${
            !isOnline
              ? 'bg-destructive text-destructive-foreground'
              : syncing
                ? 'bg-primary text-primary-foreground'
                : 'bg-warning text-warning-foreground'
          }`}
          role="status"
          aria-live="assertive"
        >
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4" aria-hidden="true" />
              <span>{t('offline.noConnection', 'Sem conexão — respostas salvas localmente')}</span>
            </>
          ) : syncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>{t('offline.syncing', 'Sincronizando respostas...')}</span>
            </>
          ) : (
            <>
              <CloudOff className="w-4 h-4" aria-hidden="true" />
              <span>{pendingCount} {t('offline.pendingSync', 'resposta(s) aguardando sincronização')}</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Small inline dot indicator for headers */
export function ConnectionDot() {
  const isOnline = useConnectionStatus();

  return (
    <div
      className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-success' : 'bg-destructive'}`}
      title={isOnline ? 'Online' : 'Offline'}
      role="status"
      aria-label={isOnline ? 'Connected' : 'Disconnected'}
    />
  );
}
