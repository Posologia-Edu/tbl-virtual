import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, ChevronRight, Trash2, Pencil, Users, BookOpen, FolderOpen,
  GraduationCap, FileText, Download, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { computeRoomScores } from '@/lib/tblScoring';

type ClassItem = {
  id: string;
  name: string;
  description: string | null;
  semester: string | null;
  is_active: boolean;
  created_at: string;
};

type RoomInClass = {
  id: string;
  name: string;
  code: string;
  current_stage: string;
  created_at: string;
  class_id: string | null;
};

type StudentInClass = {
  id: string;
  student_id: string;
  full_name: string;
  enrolled_at: string;
};

type ReportRow = {
  student_id: string;
  full_name: string;
  // final_score null = aluno não participou da sala
  rooms: { room_id: string; room_name: string; irat_score: number; trat_score: number; app_score: number; final_score: number | null; team_name?: string | null }[];
  average: number;
};

// Snapshot salvo em class_reports: não depende do estado atual das salas até ser regenerado.
type SavedReport = {
  rooms: { id: string; name: string }[];
  rows: ReportRow[];
  generated_at: string;
};

const stageLabels: Record<string, string> = {
  waiting: 'Aguardando', irat_open: 'iRAT', trat_open: 'tRAT',
  application_open: 'Aplicação', finished: 'Finalizado',
};

export default function ClassManagement({ userId }: { userId: string }) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [rooms, setRooms] = useState<RoomInClass[]>([]);
  const [unassignedRooms, setUnassignedRooms] = useState<RoomInClass[]>([]);
  const [students, setStudents] = useState<StudentInClass[]>([]);
  const [report, setReport] = useState<SavedReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSemester, setNewSemester] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSemester, setEditSemester] = useState('');

  const [activeTab, setActiveTab] = useState('rooms');

  const loadClasses = useCallback(async () => {
    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', userId)
      .order('created_at', { ascending: false });
    setClasses((data as ClassItem[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  const createClass = async () => {
    if (!newName.trim()) { toast.error('Informe o nome da turma'); return; }
    const { error } = await supabase.from('classes').insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      semester: newSemester.trim() || null,
      teacher_id: userId,
    } as any);
    if (error) { toast.error('Falha ao criar turma'); return; }
    toast.success('Turma criada!');
    setNewName(''); setNewDesc(''); setNewSemester('');
    setCreateOpen(false);
    loadClasses();
  };

  const updateClass = async () => {
    if (!selectedClass || !editName.trim()) return;
    const { error } = await supabase.from('classes').update({
      name: editName.trim(),
      description: editDesc.trim() || null,
      semester: editSemester.trim() || null,
    } as any).eq('id', selectedClass.id);
    if (error) { toast.error('Falha ao atualizar'); return; }
    toast.success('Turma atualizada!');
    setEditOpen(false);
    loadClasses();
    setSelectedClass(prev => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() || null, semester: editSemester.trim() || null } : null);
  };

  const deleteClass = async (id: string) => {
    // Unassign rooms first
    await supabase.from('rooms').update({ class_id: null } as any).eq('class_id', id);
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) { toast.error('Falha ao excluir'); return; }
    toast.success('Turma excluída');
    if (selectedClass?.id === id) setSelectedClass(null);
    loadClasses();
  };

  const openClass = async (cls: ClassItem) => {
    setSelectedClass(cls);
    setActiveTab('rooms');
    setReport(null);
    await loadClassDetails(cls.id);
  };

  const loadClassDetails = async (classId: string) => {
    const [{ data: classRooms }, { data: allRooms }, { data: classStudents }] = await Promise.all([
      supabase.from('rooms').select('id, name, code, current_stage, created_at, class_id').eq('class_id', classId).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('rooms').select('id, name, code, current_stage, created_at, class_id').eq('teacher_id', userId).is('class_id', null).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('class_students').select('id, student_id, enrolled_at').eq('class_id', classId),
    ]);
    const { data: saved } = await (supabase as any).from('class_reports').select('data, generated_at').eq('class_id', classId).maybeSingle();
    setReport(saved ? { ...saved.data, generated_at: saved.generated_at } : null);
    setRooms((classRooms as RoomInClass[]) || []);
    setUnassignedRooms((allRooms as RoomInClass[]) || []);

    // Load student names
    const studentIds = (classStudents || []).map((s: any) => s.student_id);
    if (studentIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', studentIds);
      const merged = (classStudents || []).map((s: any) => {
        const p = (profiles || []).find((pr: any) => pr.id === s.student_id);
        return { id: s.id, student_id: s.student_id, full_name: p?.full_name || 'Aluno', enrolled_at: s.enrolled_at };
      });
      setStudents(merged);
    } else {
      setStudents([]);
    }
  };

  const assignRoom = async (roomId: string) => {
    if (!selectedClass) return;
    const { error } = await supabase.from('rooms').update({ class_id: selectedClass.id } as any).eq('id', roomId);
    if (error) { toast.error('Falha ao vincular sala'); return; }
    toast.success('Sala vinculada!');
    loadClassDetails(selectedClass.id);
  };

  const unassignRoom = async (roomId: string) => {
    const { error } = await supabase.from('rooms').update({ class_id: null } as any).eq('id', roomId);
    if (error) { toast.error('Falha ao desvincular'); return; }
    toast.success('Sala desvinculada');
    if (selectedClass) loadClassDetails(selectedClass.id);
  };

  const enrollStudentsFromRooms = async () => {
    if (!selectedClass || rooms.length === 0) return;
    const roomIds = rooms.map(r => r.id);
    const { data: participants } = await supabase
      .from('room_participants')
      .select('user_id')
      .in('room_id', roomIds);
    if (!participants || participants.length === 0) { toast.info('Nenhum aluno encontrado nas salas'); return; }
    const uniqueIds = [...new Set(participants.map((p: any) => p.user_id))];
    const existingIds = students.map(s => s.student_id);
    const newIds = uniqueIds.filter(id => !existingIds.includes(id));
    if (newIds.length === 0) { toast.info('Todos os alunos já estão matriculados'); return; }
    const { error } = await supabase.from('class_students').insert(
      newIds.map(sid => ({ class_id: selectedClass.id, student_id: sid })) as any
    );
    if (error) { toast.error('Falha ao matricular alunos'); return; }
    toast.success(`${newIds.length} aluno(s) matriculado(s)!`);
    loadClassDetails(selectedClass.id);
  };

  const removeStudent = async (enrollmentId: string) => {
    await supabase.from('class_students').delete().eq('id', enrollmentId);
    toast.success('Aluno removido');
    if (selectedClass) loadClassDetails(selectedClass.id);
  };

  // Gera o boletim com exatamente a fórmula do Relatório Final da sala (src/lib/tblScoring.ts)
  // e grava no banco, sobrescrevendo o boletim anterior da turma.
  const generateReport = async () => {
    if (!selectedClass || rooms.length === 0 || students.length === 0) {
      toast.info('Vincule salas e matricule alunos primeiro');
      return;
    }
    const finishedRooms = rooms.filter(r => r.current_stage === 'finished');
    if (finishedRooms.length === 0) { toast.info('Nenhuma sala finalizada nesta turma'); return; }

    setGenerating(true);
    try {
      const roomIds = finishedRooms.map(r => r.id);
      const [
        { data: roomsDetail }, { data: participants }, { data: teamsData }, { data: appealsData },
        { data: iratData }, { data: tratData }, { data: appQData }, { data: appRespData },
      ] = await Promise.all([
        supabase.from('rooms').select('*').in('id', roomIds),
        supabase.from('room_participants').select('room_id, user_id').in('room_id', roomIds),
        supabase.from('teams').select('id, room_id, name, team_members(user_id)').in('room_id', roomIds),
        supabase.from('appeals').select('*').in('room_id', roomIds),
        supabase.from('irat_responses').select('*').in('room_id', roomIds),
        supabase.from('trat_attempts').select('*').in('room_id', roomIds),
        supabase.from('application_questions').select('*').in('room_id', roomIds),
        supabase.from('application_responses').select('*').in('room_id', roomIds),
      ]);
      const quizIds = [...new Set((roomsDetail || []).map((r: any) => r.quiz_id).filter(Boolean))] as string[];
      const { data: questionsData } = quizIds.length > 0
        ? await supabase.from('questions').select('id, quiz_id').in('quiz_id', quizIds)
        : { data: [] as any[] };

      // roomId -> (userId -> score)
      const scoresByRoom: Record<string, Record<string, ReturnType<typeof computeRoomScores>[number]>> = {};
      finishedRooms.forEach(room => {
        const detail = (roomsDetail || []).find((r: any) => r.id === room.id) as any;
        const inRoom = (arr: any[] | null) => (arr || []).filter(x => x.room_id === room.id);
        const scores = computeRoomScores({
          room: detail || {},
          participantIds: inRoom(participants).map(p => p.user_id),
          questions: (questionsData || []).filter((q: any) => q.quiz_id === detail?.quiz_id),
          // o relatório da sala só considera times com membros
          teams: inRoom(teamsData).filter(t => (t.team_members || []).length > 0),
          iratResponses: inRoom(iratData),
          tratAttempts: inRoom(tratData),
          appeals: inRoom(appealsData),
          appQuestions: inRoom(appQData),
          appResponses: inRoom(appRespData),
        });
        scoresByRoom[room.id] = Object.fromEntries(scores.map(s => [s.studentId, s]));
      });

      const rows: ReportRow[] = students.map(student => {
        const roomScores = finishedRooms.map(room => {
          const s = scoresByRoom[room.id][student.student_id];
          if (!s) return { room_id: room.id, room_name: room.name, irat_score: 0, trat_score: 0, app_score: 0, final_score: null, team_name: null };
          return {
            room_id: room.id, room_name: room.name,
            irat_score: parseFloat(s.iratGrade.toFixed(2)),
            trat_score: parseFloat(s.tratGrade.toFixed(2)),
            app_score: parseFloat(s.appGrade.toFixed(2)),
            final_score: parseFloat(s.finalGrade.toFixed(2)),
            team_name: s.teamName,
          };
        });
        const graded = roomScores.filter(r => r.final_score !== null) as { final_score: number }[];
        const average = graded.length > 0
          ? parseFloat((graded.reduce((sum, r) => sum + r.final_score, 0) / graded.length).toFixed(2))
          : 0;
        return { student_id: student.student_id, full_name: student.full_name, rooms: roomScores, average };
      });
      rows.sort((a, b) => b.average - a.average);

      const generated_at = new Date().toISOString();
      const data = { rooms: finishedRooms.map(r => ({ id: r.id, name: r.name })), rows };
      const { error } = await (supabase as any).from('class_reports')
        .upsert({ class_id: selectedClass.id, data, generated_at }, { onConflict: 'class_id' });
      if (error) toast.error('Boletim gerado, mas falhou ao salvar no banco');
      else toast.success('Boletim gerado e salvo!');
      setReport({ ...data, generated_at });
    } finally {
      setGenerating(false);
    }
  };

  const exportCSV = () => {
    if (!report || report.rows.length === 0) return;
    const headers = ['Aluno', ...report.rooms.flatMap(r => [r.name, 'Grupo - ' + r.name]), 'Média'];
    const rows = report.rows.map(r => {
      const scores = report.rooms.flatMap(room => {
        const s = r.rooms.find(rs => rs.room_id === room.id);
        return [s && s.final_score !== null ? s.final_score.toString() : '-', s?.team_name || '-'];
      });
      return [r.full_name, ...scores, r.average.toString()];
    });
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `boletim_${selectedClass?.name || 'turma'}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ==================== LIST VIEW ====================
  if (!selectedClass) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-heading font-bold">Minhas Turmas</h2>
          <Button onClick={() => { setNewName(''); setNewDesc(''); setNewSemester(''); setCreateOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nova Turma
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : classes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhuma turma criada. Crie uma para organizar suas salas!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map(cls => (
              <Card key={cls.id} className="transition-all hover:shadow-md cursor-pointer" onClick={() => openClass(cls)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-heading text-lg">{cls.name}</CardTitle>
                      {cls.semester && <CardDescription className="mt-1">{cls.semester}</CardDescription>}
                    </div>
                    <Badge variant={cls.is_active ? 'default' : 'secondary'}>{cls.is_active ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {cls.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{cls.description}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setSelectedClass(cls); setEditName(cls.name); setEditDesc(cls.description || ''); setEditSemester(cls.semester || ''); setEditOpen(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); deleteClass(cls.id); }}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Nova Turma</DialogTitle>
              <DialogDescription>Crie uma turma para agrupar salas e acompanhar o progresso dos alunos.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome da Turma</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Medicina 2025.1" />
              </div>
              <div className="space-y-2">
                <Label>Semestre (opcional)</Label>
                <Input value={newSemester} onChange={e => setNewSemester(e.target.value)} placeholder="Ex: 2025.1" />
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descrição da turma..." rows={3} />
              </div>
              <Button onClick={createClass} className="w-full">Criar Turma</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">Editar Turma</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Semestre</Label>
                <Input value={editSemester} onChange={e => setEditSemester(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
              </div>
              <Button onClick={updateClass} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ==================== DETAIL VIEW ====================
  const finishedRooms = rooms.filter(r => r.current_stage === 'finished');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { setSelectedClass(null); setReport(null); }}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-heading font-bold">{selectedClass.name}</h2>
          <p className="text-sm text-muted-foreground">
            {selectedClass.semester && `${selectedClass.semester} · `}
            {rooms.length} sala(s) · {students.length} aluno(s)
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rooms" className="gap-1"><FolderOpen className="w-4 h-4" /> Salas</TabsTrigger>
          <TabsTrigger value="students" className="gap-1"><Users className="w-4 h-4" /> Alunos</TabsTrigger>
          <TabsTrigger value="report" className="gap-1"><FileText className="w-4 h-4" /> Boletim</TabsTrigger>
        </TabsList>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Salas Vinculadas</CardTitle>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sala vinculada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {rooms.map(room => (
                    <div key={room.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{room.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{room.code} · {stageLabels[room.current_stage] || room.current_stage}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => unassignRoom(room.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {unassignedRooms.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Salas Disponíveis</CardTitle>
                <CardDescription>Salas sem turma que podem ser vinculadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {unassignedRooms.map(room => (
                    <div key={room.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{room.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{room.code} · {stageLabels[room.current_stage] || room.current_stage}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => assignRoom(room.id)}>
                        <Plus className="w-3 h-3 mr-1" /> Vincular
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Button size="sm" onClick={enrollStudentsFromRooms}>
              <Users className="w-4 h-4 mr-1" /> Matricular Alunos das Salas
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/10">
                    <TableHead>Aluno</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum aluno matriculado.</TableCell></TableRow>
                  ) : students.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(s.enrolled_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="ghost" onClick={() => removeStudent(s.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report Tab */}
        <TabsContent value="report" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Button onClick={generateReport} disabled={generating}>
              <FileText className="w-4 h-4 mr-1" /> {generating ? 'Gerando...' : report ? 'Regenerar Boletim' : 'Gerar Boletim'}
            </Button>
            {report && report.rows.length > 0 && (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-1" /> Exportar CSV
              </Button>
            )}
          </div>

          {report && report.rows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Boletim Consolidado — {selectedClass.name}</CardTitle>
                <CardDescription>
                  {report.rooms.length} atividade(s) finalizada(s) · gerado em {new Date(report.generated_at).toLocaleString('pt-BR')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/10">
                      <TableHead className="sticky left-0 bg-card z-10">Aluno</TableHead>
                      {report.rooms.map(r => (
                        <TableHead key={r.id} className="text-center min-w-[100px]">{r.name}</TableHead>
                      ))}
                      <TableHead className="text-center font-bold">Média</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.map(row => (
                      <TableRow key={row.student_id}>
                        <TableCell className="font-medium sticky left-0 bg-card z-10">{row.full_name}</TableCell>
                        {report.rooms.map(room => {
                          const s = row.rooms.find(rs => rs.room_id === room.id);
                          return (
                            <TableCell key={room.id} className="text-center">
                              {s && s.final_score !== null ? s.final_score.toFixed(2) : '-'}
                              {s?.team_name && <div className="text-xs text-muted-foreground font-normal">{s.team_name}</div>}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold">{row.average.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
