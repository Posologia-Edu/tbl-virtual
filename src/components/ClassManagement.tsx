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
  rooms: { room_id: string; room_name: string; irat_score: number; trat_score: number; app_score: number; final_score: number }[];
  average: number;
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
  const [report, setReport] = useState<ReportRow[]>([]);
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
    await loadClassDetails(cls.id);
  };

  const loadClassDetails = async (classId: string) => {
    const [{ data: classRooms }, { data: allRooms }, { data: classStudents }] = await Promise.all([
      supabase.from('rooms').select('id, name, code, current_stage, created_at, class_id').eq('class_id', classId).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('rooms').select('id, name, code, current_stage, created_at, class_id').eq('teacher_id', userId).is('class_id', null).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('class_students').select('id, student_id, enrolled_at').eq('class_id', classId),
    ]);
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

  // Generate consolidated report
  const generateReport = async () => {
    if (!selectedClass || rooms.length === 0 || students.length === 0) {
      toast.info('Vincule salas e matricule alunos primeiro');
      return;
    }
    const finishedRooms = rooms.filter(r => r.current_stage === 'finished');
    if (finishedRooms.length === 0) { toast.info('Nenhuma sala finalizada nesta turma'); return; }

    const roomIds = finishedRooms.map(r => r.id);
    const studentIds = students.map(s => s.student_id);

    const [{ data: iratData }, { data: tratData }, { data: appRespData }, { data: appQData }, { data: roomsDetail }] = await Promise.all([
      supabase.from('irat_responses').select('*').in('room_id', roomIds).in('student_id', studentIds),
      supabase.from('trat_attempts').select('*').in('room_id', roomIds),
      supabase.from('application_responses').select('*').in('room_id', roomIds),
      supabase.from('application_questions').select('*').in('room_id', roomIds),
      supabase.from('rooms').select('*').in('id', roomIds),
    ]);

    // Get team memberships
    const { data: teamMembers } = await supabase.from('team_members').select('*').in('room_id', roomIds).in('user_id', studentIds);
    const { data: questions } = await supabase.from('questions').select('*');

    const reportRows: ReportRow[] = students.map(student => {
      const roomScores = finishedRooms.map(room => {
        const roomDetail = (roomsDetail || []).find((r: any) => r.id === room.id) as any;
        const maxGrade = roomDetail?.max_grade || 10;
        const indPct = (roomDetail?.individual_pct || 30) / 100;
        const tmPct = (roomDetail?.team_pct || 40) / 100;
        const appPct = (roomDetail?.application_pct || 30) / 100;

        // iRAT score
        const studentIrat = (iratData || []).filter((r: any) => r.room_id === room.id && r.student_id === student.student_id);
        const totalQ = (questions || []).filter((q: any) => q.quiz_id === roomDetail?.quiz_id).length || 1;
        const iratRaw = studentIrat.reduce((s: number, r: any) => s + (r.score || 0), 0);
        const iratMax = totalQ * 4;
        const iratNorm = iratMax > 0 ? (iratRaw / iratMax) : 0;

        // tRAT score
        const tm = (teamMembers || []).find((m: any) => m.room_id === room.id && m.user_id === student.student_id);
        let tratNorm = 0;
        if (tm) {
          const teamAttempts = (tratData || []).filter((a: any) => a.room_id === room.id && a.team_id === tm.team_id);
          const qIds = [...new Set(teamAttempts.map((a: any) => a.question_id))];
          let tratRaw = 0;
          qIds.forEach(qid => {
            const correct = teamAttempts.find((a: any) => a.question_id === qid && a.is_correct);
            if (correct) tratRaw += [4, 2, 1, 0][(correct.attempt_number || 1) - 1] || 0;
          });
          tratNorm = iratMax > 0 ? (tratRaw / iratMax) : 0;
        }

        // App score
        let appNorm = 0;
        if (tm) {
          const teamAppResp = (appRespData || []).filter((r: any) => r.room_id === room.id && r.team_id === tm.team_id);
          const roomAppQ = (appQData || []).filter((q: any) => q.room_id === room.id);
          if (roomAppQ.length > 0) {
            let correct = 0;
            teamAppResp.forEach((r: any) => {
              const q = roomAppQ.find((q: any) => q.id === r.question_id);
              if (q && r.selected_option?.trim() === q.correct_answer?.trim()) correct++;
            });
            appNorm = correct / roomAppQ.length;
          }
        }

        const final_score = parseFloat(((iratNorm * indPct + tratNorm * tmPct + appNorm * appPct) * maxGrade).toFixed(2));
        return {
          room_id: room.id, room_name: room.name,
          irat_score: parseFloat((iratNorm * maxGrade).toFixed(2)),
          trat_score: parseFloat((tratNorm * maxGrade).toFixed(2)),
          app_score: parseFloat((appNorm * maxGrade).toFixed(2)),
          final_score,
        };
      });

      const avg = roomScores.length > 0 ? parseFloat((roomScores.reduce((s, r) => s + r.final_score, 0) / roomScores.length).toFixed(2)) : 0;
      return { student_id: student.student_id, full_name: student.full_name, rooms: roomScores, average: avg };
    });

    reportRows.sort((a, b) => b.average - a.average);
    setReport(reportRows);
    toast.success('Boletim gerado!');
  };

  const exportCSV = () => {
    if (report.length === 0) return;
    const finishedRooms = rooms.filter(r => r.current_stage === 'finished');
    const headers = ['Aluno', ...finishedRooms.map(r => r.name), 'Média'];
    const rows = report.map(r => {
      const scores = finishedRooms.map(room => {
        const s = r.rooms.find(rs => rs.room_id === room.id);
        return s ? s.final_score.toString() : '-';
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
        <Button variant="ghost" size="icon" onClick={() => { setSelectedClass(null); setReport([]); }}>
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

      <Tabs defaultValue="rooms">
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
            <Button onClick={generateReport}>
              <FileText className="w-4 h-4 mr-1" /> Gerar Boletim
            </Button>
            {report.length > 0 && (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-1" /> Exportar CSV
              </Button>
            )}
          </div>

          {report.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Boletim Consolidado — {selectedClass.name}</CardTitle>
                <CardDescription>{finishedRooms.length} atividade(s) finalizada(s)</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/10">
                      <TableHead className="sticky left-0 bg-card z-10">Aluno</TableHead>
                      {finishedRooms.map(r => (
                        <TableHead key={r.id} className="text-center min-w-[100px]">{r.name}</TableHead>
                      ))}
                      <TableHead className="text-center font-bold">Média</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.map(row => (
                      <TableRow key={row.student_id}>
                        <TableCell className="font-medium sticky left-0 bg-card z-10">{row.full_name}</TableCell>
                        {finishedRooms.map(room => {
                          const s = row.rooms.find(rs => rs.room_id === room.id);
                          return (
                            <TableCell key={room.id} className="text-center">
                              {s ? s.final_score : '-'}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold">{row.average}</TableCell>
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
