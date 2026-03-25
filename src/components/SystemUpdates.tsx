import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Plus, CheckCircle2, Clock, Lightbulb, Rocket, Loader2, Pencil, Trash2, Calendar,
  Tag, AlertCircle, ArrowUpCircle, ArrowRightCircle, ArrowDownCircle,
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

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  done: { label: 'Implementado', icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  in_progress: { label: 'Em Desenvolvimento', icon: Loader2, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  planned: { label: 'Planejado', icon: Clock, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  idea: { label: 'Ideia', icon: Lightbulb, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  feature: { label: 'Funcionalidade', color: 'bg-primary/10 text-primary' },
  improvement: { label: 'Melhoria', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
  bugfix: { label: 'Correção', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  security: { label: 'Segurança', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  infrastructure: { label: 'Infraestrutura', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
};

const priorityIcons: Record<string, any> = {
  high: ArrowUpCircle,
  medium: ArrowRightCircle,
  low: ArrowDownCircle,
};

export default function SystemUpdates() {
  const { isAdmin } = useAuth();
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<SystemUpdate | null>(null);
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

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const doneUpdates = updates.filter(u => u.status === 'done');
  const inProgressUpdates = updates.filter(u => u.status === 'in_progress');
  const plannedUpdates = updates.filter(u => u.status === 'planned');
  const ideaUpdates = updates.filter(u => u.status === 'idea');

  const renderUpdateCard = (u: SystemUpdate) => {
    const sc = statusConfig[u.status] || statusConfig.idea;
    const cc = categoryConfig[u.category] || categoryConfig.feature;
    const PriorityIcon = priorityIcons[u.priority || 'medium'] || ArrowRightCircle;
    const StatusIcon = sc.icon;

    return (
      <Card key={u.id} className="group hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <StatusIcon className={`w-4 h-4 shrink-0 ${u.status === 'in_progress' ? 'animate-spin' : ''}`} />
                <h4 className="font-semibold text-sm">{u.title}</h4>
                {u.version && <Badge variant="outline" className="text-xs">{u.version}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mb-2">{u.description}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-xs ${sc.color}`}>{sc.label}</Badge>
                <Badge className={`text-xs ${cc.color}`}>{cc.label}</Badge>
                <PriorityIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {u.implemented_at ? formatDate(u.implemented_at) : formatDate(u.created_at)}
                </span>
                {(u.tags || []).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs"><Tag className="w-2.5 h-2.5 mr-0.5" />{tag}</Badge>
                ))}
              </div>
              {u.notes && <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-muted pl-2">{u.notes}</p>}
            </div>
            {isAdmin && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(u.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSection = (title: string, icon: any, items: SystemUpdate[], emptyMsg: string) => {
    const Icon = icon;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          <h3 className="font-semibold text-lg">{title}</h3>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{emptyMsg}</p>
        ) : (
          <div className="space-y-2">{items.map(renderUpdateCard)}</div>
        )}
      </div>
    );
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Rocket className="w-6 h-6" /> Pipeline de Atualizações</h2>
          <p className="text-muted-foreground text-sm">Histórico de implementações e planejamento de futuras funcionalidades</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Nova Entrada</Button>
        )}
      </div>

      <Tabs defaultValue="changelog">
        <TabsList>
          <TabsTrigger value="changelog">Changelog ({doneUpdates.length})</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline ({inProgressUpdates.length + plannedUpdates.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="ideas">Ideias ({ideaUpdates.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="changelog" className="space-y-4 mt-4">
          {renderSection('Implementado', CheckCircle2, doneUpdates, 'Nenhuma atualização registrada ainda.')}
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-6 mt-4">
          {renderSection('Em Desenvolvimento', Loader2, inProgressUpdates, 'Nenhuma funcionalidade em desenvolvimento.')}
          <Separator />
          {renderSection('Planejado', Clock, plannedUpdates, 'Nenhuma funcionalidade planejada.')}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="ideas" className="space-y-4 mt-4">
            {renderSection('Ideias Futuras', Lightbulb, ideaUpdates, 'Nenhuma ideia registrada. Clique em "Nova Entrada" para começar.')}
          </TabsContent>
        )}
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
