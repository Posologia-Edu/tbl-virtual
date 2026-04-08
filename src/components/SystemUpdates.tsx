import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Plus, CheckCircle2, Rocket, Loader2, Trash2, Calendar, Sparkles, Lightbulb, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

interface SystemUpdate {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  version: string | null;
  created_at: string;
  implemented_at: string | null;
  tags: string[];
  notes: string | null;
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: 'Alta', color: 'bg-red-500 text-white' },
  medium: { label: 'Média', color: 'bg-amber-500 text-white' },
  low: { label: 'Baixa', color: 'bg-green-500 text-white' },
};

const categoryConfig: Record<string, { label: string }> = {
  feature: { label: 'Funcionalidade' },
  improvement: { label: 'Melhoria' },
  bugfix: { label: 'Correção' },
  security: { label: 'Segurança' },
  infrastructure: { label: 'Infraestrutura' },
};

const borderColors: Record<string, string> = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-green-500',
};

// Static pool removed - now using AI-powered suggestions

export default function SystemUpdates() {
  const { isAdmin } = useAuth();
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<SystemUpdate | null>(null);
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', category: 'feature', status: 'idea',
    priority: 'medium', version: '', tags: '', notes: '',
    implemented_at: '',
  });

  const loadUpdates = async () => {
    const { data } = await supabase.from('system_updates').select('*').order('created_at', { ascending: false });
    if (data) setUpdates(data as any);
    setLoading(false);
  };

  useEffect(() => { loadUpdates(); }, []);

  const resetForm = () => {
    setForm({ title: '', description: '', category: 'feature', status: 'idea', priority: 'medium', version: '', tags: '', notes: '', implemented_at: '' });
    setEditingUpdate(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (u: SystemUpdate) => {
    setEditingUpdate(u);
    setForm({
      title: u.title, description: u.description, category: u.category,
      status: u.status, priority: u.priority || 'medium', version: u.version || '',
      tags: (u.tags || []).join(', '), notes: u.notes || '',
      implemented_at: u.implemented_at ? u.implemented_at.slice(0, 10) : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Preencha título e descrição'); return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      status: form.status,
      priority: form.priority,
      version: form.version.trim() || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: form.notes.trim() || null,
      implemented_at: form.implemented_at || null,
    };

    if (editingUpdate) {
      const { error } = await supabase.from('system_updates').update(payload).eq('id', editingUpdate.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Atualização editada');
    } else {
      const { error } = await supabase.from('system_updates').insert(payload);
      if (error) { toast.error('Erro ao criar'); return; }
      toast.success('Registro criado');
    }
    setDialogOpen(false);
    resetForm();
    loadUpdates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('system_updates').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Registro excluído');
    loadUpdates();
  };

  const handleComplete = async (u: SystemUpdate) => {
    const { error } = await supabase.from('system_updates').update({
      status: 'done',
      implemented_at: new Date().toISOString(),
    }).eq('id', u.id);
    if (error) { toast.error('Erro ao concluir'); return; }
    toast.success(`"${u.title}" movido para o Changelog!`);
    loadUpdates();
  };

  const handleGenerateRoadmap = async () => {
    setGeneratingRoadmap(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-roadmap-ai');

      if (error) {
        let message = error.message || 'Erro ao gerar sugestões com IA';
        const context = (error as { context?: Response }).context;

        if (context instanceof Response) {
          try {
            const errorBody = await context.clone().json();
            if (typeof errorBody?.error === 'string') {
              message = errorBody.error;
            }
          } catch {
            if (context.status === 402) {
              message = 'Créditos de IA esgotados. Adicione fundos em Settings > Workspace > Usage.';
            } else if (context.status === 429) {
              message = 'Limite de requisições atingido. Tente novamente em alguns segundos.';
            }
          }
        }

        toast.error(message);
        console.error(error);
        return;
      }

      if (data?.ok === false) {
        toast.error(data.error || 'Erro ao gerar sugestões com IA');
        return;
      }

      if (data?.count === 0) {
        toast.info('A IA não encontrou novas sugestões relevantes no momento.');
      } else {
        toast.success(`${data.count} novas sugestões geradas pela IA!`);
        loadUpdates();
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao conectar com a IA');
    } finally {
      setGeneratingRoadmap(false);
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const doneUpdates = updates.filter(u => u.status === 'done');
  const roadmapUpdates = updates.filter(u => ['in_progress', 'planned', 'idea'].includes(u.status));

  const renderChangelogCard = (u: SystemUpdate) => {
    const pc = priorityConfig[u.priority || 'medium'] || priorityConfig.medium;
    return (
      <div key={u.id} className={`bg-card rounded-lg border border-l-4 ${borderColors[u.priority || 'medium'] || 'border-l-muted'} p-4 hover:shadow-sm transition-shadow`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <h4 className="font-semibold text-sm text-foreground">{u.title}</h4>
              {u.version && <Badge variant="outline" className="text-xs">{u.version}</Badge>}
              <Badge className={`text-xs ${pc.color}`}>{pc.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{u.description}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {u.implemented_at ? formatDate(u.implemented_at) : formatDate(u.created_at)}
              {u.notes && <span className="italic border-l pl-2 border-muted">— {u.notes}</span>}
            </div>
          </div>
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(u.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderRoadmapCard = (u: SystemUpdate) => {
    const pc = priorityConfig[u.priority || 'medium'] || priorityConfig.medium;
    return (
      <div key={u.id} className={`bg-card rounded-lg border border-l-4 ${borderColors[u.priority || 'medium'] || 'border-l-muted'} p-4 hover:shadow-sm transition-shadow`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <h4 className="font-semibold text-sm text-foreground">{u.title}</h4>
              <Badge className={`text-xs ${pc.color}`}>{pc.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{u.description}</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleComplete(u)}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Concluir
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(u.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Rocket className="w-6 h-6" /> Pipeline de Atualizações</h2>
          <p className="text-muted-foreground text-sm">Histórico de funcionalidades e planejamento futuro do sistema.</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Nova Entrada</Button>
        )}
      </div>

      <Tabs defaultValue="changelog">
        <TabsList>
          <TabsTrigger value="changelog" className="gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Changelog ({doneUpdates.length})
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" />
            Roadmap ({roadmapUpdates.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="changelog" className="mt-4">
          {doneUpdates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma atualização registrada ainda.</p>
          ) : (
            <div className="space-y-3">{doneUpdates.map(renderChangelogCard)}</div>
          )}
        </TabsContent>

        <TabsContent value="roadmap" className="mt-4">
          {isAdmin && (
            <div className="flex justify-end mb-3">
              <Button variant="outline" size="sm" onClick={handleGenerateRoadmap} disabled={generatingRoadmap} className="gap-1.5">
                {generatingRoadmap ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {generatingRoadmap ? 'Gerando...' : 'Sugerir com IA'}
              </Button>
            </div>
          )}
          {roadmapUpdates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma funcionalidade no roadmap.</p>
          ) : (
            <div className="space-y-3">{roadmapUpdates.map(renderRoadmapCard)}</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUpdate ? 'Editar Registro' : 'Nova Entrada no Pipeline'}</DialogTitle>
            <DialogDescription>Registre uma atualização, funcionalidade planejada ou ideia futura.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Sistema de Apelação no tRAT" />
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva a funcionalidade ou atualização..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="done">✅ Implementado</SelectItem>
                    <SelectItem value="in_progress">🔄 Em Desenvolvimento</SelectItem>
                    <SelectItem value="planned">📋 Planejado</SelectItem>
                    <SelectItem value="idea">💡 Ideia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Funcionalidade</SelectItem>
                    <SelectItem value="improvement">Melhoria</SelectItem>
                    <SelectItem value="bugfix">Correção</SelectItem>
                    <SelectItem value="security">Segurança</SelectItem>
                    <SelectItem value="infrastructure">Infraestrutura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 Alta</SelectItem>
                    <SelectItem value="medium">🟡 Média</SelectItem>
                    <SelectItem value="low">🟢 Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Versão</Label>
                <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="Ex: v1.2.0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data de Implementação</Label>
              <Input type="date" value={form.implemented_at} onChange={e => setForm(f => ({ ...f, implemented_at: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="Ex: TBL, IA, relatório" />
            </div>
            <div className="space-y-2">
              <Label>Notas adicionais</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observações, decisões de design, dependências..." rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave}>{editingUpdate ? 'Salvar Alterações' : 'Criar Registro'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
