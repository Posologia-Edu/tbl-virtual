import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Rocket, Clock, Loader2, Lightbulb, ArrowRight, CheckCircle2 } from 'lucide-react';

interface PipelineItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
}

export default function PipelineNotification({ onNavigate }: { onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PipelineItem[]>([]);

  useEffect(() => {
    const checkPipeline = async () => {
      // Only show once per session
      const sessionKey = 'pipeline_notification_shown';
      if (sessionStorage.getItem(sessionKey)) return;

      const { data } = await supabase
        .from('system_updates')
        .select('id, title, description, status, priority, category')
        .in('status', ['in_progress', 'planned', 'idea'])
        .order('priority', { ascending: true })
        .limit(10);

      if (data && data.length > 0) {
        setItems(data as any);
        setOpen(true);
        sessionStorage.setItem(sessionKey, 'true');
      }
    };

    // Delay to avoid blocking initial render
    const timer = setTimeout(checkPipeline, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (items.length === 0) return null;

  const inProgress = items.filter(i => i.status === 'in_progress');
  const planned = items.filter(i => i.status === 'planned');
  const ideas = items.filter(i => i.status === 'idea');

  const statusIcon = (status: string) => {
    if (status === 'in_progress') return <Loader2 className="w-3.5 h-3.5 text-blue-500" />;
    if (status === 'planned') return <Clock className="w-3.5 h-3.5 text-amber-500" />;
    return <Lightbulb className="w-3.5 h-3.5 text-purple-500" />;
  };

  const priorityDot = (p: string) => {
    if (p === 'high') return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />;
    if (p === 'medium') return <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />;
    return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />;
  };

  const renderGroup = (title: string, icon: any, groupItems: PipelineItem[]) => {
    if (groupItems.length === 0) return null;
    const Icon = icon;
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-1.5"><Icon className="w-4 h-4" /> {title}</h4>
        {groupItems.map(item => (
          <div key={item.id} className="flex items-start gap-2 pl-2">
            {priorityDot(item.priority)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
            </div>
            {statusIcon(item.status)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" /> Pipeline de Atualizações
          </DialogTitle>
          <DialogDescription>
            Você tem {items.length} {items.length === 1 ? 'item' : 'itens'} pendentes no pipeline de desenvolvimento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[50vh] overflow-y-auto">
          {renderGroup('Em Desenvolvimento', Loader2, inProgress)}
          {inProgress.length > 0 && (planned.length > 0 || ideas.length > 0) && <Separator />}
          {renderGroup('Planejado', Clock, planned)}
          {planned.length > 0 && ideas.length > 0 && <Separator />}
          {renderGroup('Ideias', Lightbulb, ideas)}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          <Button onClick={() => { setOpen(false); onNavigate(); }}>
            Ver Pipeline Completo <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
