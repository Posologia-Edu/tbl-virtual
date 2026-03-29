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

// Roadmap suggestions pool - contextually relevant to a TBL/education platform
const roadmapSuggestions = [
  { title: 'App Mobile (PWA)', description: 'Versão mobile progressiva para acesso offline e notificações push.', category: 'feature', priority: 'high' },
  { title: 'Análise de Desempenho por Competência', description: 'Dashboard de competências cruzando resultados de múltiplas avaliações por aluno.', category: 'feature', priority: 'high' },
  { title: 'IA para Feedback Personalizado', description: 'Feedback automático por IA adaptado ao perfil de erros de cada aluno.', category: 'feature', priority: 'high' },
  { title: 'Integração com LMS', description: 'Conectores para Moodle, Canvas e Google Classroom para importação/exportação de dados.', category: 'feature', priority: 'medium' },
  { title: 'Banco de Casos Clínicos Compartilhado', description: 'Marketplace específico para casos clínicos reutilizáveis entre professores e instituições.', category: 'feature', priority: 'medium' },
  { title: 'Sistema de Gamificação Avançado', description: 'Ranking global, badges temáticos e desafios semanais entre equipes.', category: 'feature', priority: 'medium' },
  { title: 'Relatórios em PDF Personalizáveis', description: 'Templates configuráveis para exportação de relatórios com identidade visual da instituição.', category: 'improvement', priority: 'medium' },
  { title: 'Dashboard de Engajamento', description: 'Métricas de participação, frequência e evolução dos alunos ao longo do semestre.', category: 'feature', priority: 'high' },
  { title: 'Modo Prova Seguro', description: 'Bloqueio de navegação e monitoramento anti-cola durante avaliações individuais.', category: 'feature', priority: 'high' },
  { title: 'Suporte a Questões Discursivas', description: 'Permitir questões abertas no iRAT/tRAT com correção manual ou por IA.', category: 'feature', priority: 'medium' },
  { title: 'Importação de Questões via Excel/CSV', description: 'Upload em massa de questões a partir de planilhas formatadas.', category: 'improvement', priority: 'medium' },
  { title: 'Notificações por Email', description: 'Alertas automáticos para alunos sobre novas salas, prazos e resultados.', category: 'feature', priority: 'medium' },
  { title: 'Tema Escuro Avançado', description: 'Modo escuro completo com personalização de cores por instituição.', category: 'improvement', priority: 'low' },
  { title: 'API Pública para Integrações', description: 'API REST documentada para integração com sistemas terceiros.', category: 'infrastructure', priority: 'medium' },
  { title: 'Multi-idioma Completo', description: 'Suporte completo a inglês e espanhol além do português.', category: 'improvement', priority: 'low' },
  { title: 'Sistema de Rubricas', description: 'Criação e aplicação de rubricas de avaliação para questões de aplicação.', category: 'feature', priority: 'high' },
  { title: 'Backup e Exportação de Dados', description: 'Exportação completa de dados do professor em formato estruturado.', category: 'security', priority: 'medium' },
  { title: 'Chat entre Equipes no tRAT', description: 'Canal de comunicação em tempo real entre membros da equipe durante o tRAT.', category: 'feature', priority: 'medium' },
  { title: 'Análise de Tempo por Questão', description: 'Métricas detalhadas de tempo gasto em cada questão por aluno e equipe.', category: 'feature', priority: 'low' },
  { title: 'Suporte a Vídeo nas Questões', description: 'Incorporar vídeos do YouTube ou uploads como parte do enunciado das questões.', category: 'feature', priority: 'medium' },
  { title: 'Painel Institucional', description: 'Visão consolidada para coordenadores com métricas de todos os professores da instituição.', category: 'feature', priority: 'high' },
  { title: 'Modo Revisão Pós-Prova', description: 'Permite ao aluno revisar suas respostas e ver explicações após encerramento.', category: 'feature', priority: 'medium' },
  { title: 'Templates de Sala Reutilizáveis', description: 'Salvar configurações de sala como template para reutilização rápida.', category: 'improvement', priority: 'low' },
  { title: 'Webhooks para Automação', description: 'Disparar eventos para sistemas externos quando uma sala é finalizada.', category: 'infrastructure', priority: 'low' },
];

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

  // Auto-generate roadmap suggestions every 30 days
  useEffect(() => {
    if (!isAdmin) return;
    const checkAndGenerate = async () => {
      const lastGenKey = 'roadmap_last_generated';
      const lastGen = localStorage.getItem(lastGenKey);
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      if (lastGen && (now - parseInt(lastGen)) < thirtyDays) return;

      // Check if there are already pending roadmap items
      const { data: pending } = await supabase
        .from('system_updates')
        .select('id, title')
        .in('status', ['planned', 'idea']);

      if (pending && pending.length >= 5) return; // Already have enough

      // Get existing titles to avoid duplicates
      const { data: existing } = await supabase
        .from('system_updates')
        .select('title');
      const existingTitles = new Set((existing || []).map((e: any) => e.title.toLowerCase()));

      // Pick 7-8 unique suggestions not already in the system
      const available = roadmapSuggestions.filter(s => !existingTitles.has(s.title.toLowerCase()));
      const shuffled = available.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(7 + Math.round(Math.random()), shuffled.length));

      if (selected.length === 0) return;

      const payload = selected.map(s => ({
        title: s.title,
        description: s.description,
        category: s.category,
        priority: s.priority,
        status: 'idea',
        tags: [],
      }));

      const { error } = await supabase.from('system_updates').insert(payload);
      if (!error) {
        localStorage.setItem(lastGenKey, now.toString());
        loadUpdates();
        toast.info(`${selected.length} novas sugestões adicionadas ao roadmap!`);
      }
    };

    const timer = setTimeout(checkAndGenerate, 2000);
    return () => clearTimeout(timer);
  }, [isAdmin]);

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
    const { data: existing } = await supabase.from('system_updates').select('title');
    const existingTitles = new Set((existing || []).map((e: any) => e.title.toLowerCase()));
    const available = roadmapSuggestions.filter(s => !existingTitles.has(s.title.toLowerCase()));
    const shuffled = available.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(7 + Math.round(Math.random()), shuffled.length));

    if (selected.length === 0) {
      toast.info('Todas as sugestões já foram adicionadas ao sistema.');
      setGeneratingRoadmap(false);
      return;
    }

    const payload = selected.map(s => ({
      title: s.title, description: s.description, category: s.category,
      priority: s.priority, status: 'idea', tags: [],
    }));

    const { error } = await supabase.from('system_updates').insert(payload);
    if (!error) {
      localStorage.setItem('roadmap_last_generated', Date.now().toString());
      toast.success(`${selected.length} novas sugestões geradas!`);
      loadUpdates();
    } else {
      toast.error('Erro ao gerar sugestões');
    }
    setGeneratingRoadmap(false);
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
                {generatingRoadmap ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Gerar Sugestões
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
