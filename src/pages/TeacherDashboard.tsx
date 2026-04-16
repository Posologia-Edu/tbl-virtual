import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus, Users, Play, Archive, LogOut, ChevronRight, ChevronDown, LayoutDashboard,
  BookOpen, FileText, UserCircle, Mail, Lock, CreditCard, Trash2, Pencil, PlayCircle, Search,
  BarChart3, Settings2, FileQuestion, Sparkles, Upload, Loader2, CheckCircle2, TrendingUp, GraduationCap, Globe, Crown, Key,
  Building2, UserPlus, RefreshCw, Rocket,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import ClassManagement from '@/components/ClassManagement';
import QuestionBank from '@/components/QuestionBank';
import AccessibilityMenu from '@/components/AccessibilityMenu';
import AdminApiKeys from '@/components/AdminApiKeys';
import UpgradeDialog from '@/components/UpgradeDialog';
import SystemUpdates from '@/components/SystemUpdates';
import PipelineNotification from '@/components/PipelineNotification';
import { STRIPE_PLANS } from '@/lib/stripe-plans';
type Room = {
  id: string;
  name: string;
  code: string;
  current_stage: string;
  is_active: boolean;
  quiz_id: string | null;
  created_at: string;
  cancelled_at?: string | null;
};

type Quiz = {
  id: string;
  title: string;
  created_at: string;
  questions?: { id: string }[];
};

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  sort_order: number;
};

type ProfileData = {
  full_name: string;
  nickname: string;
  gender: string;
  cpf: string;
  institution: string;
  institution_city: string;
  country: string;
  neighborhood: string;
  street: string;
  street_number: string;
  zip_code: string;
};

type ActiveView =
  | 'dashboard' | 'rooms' | 'personal-data' | 'my-plan' | 'change-password'
  | 'contact' | 'create-quiz' | 'my-quizzes' | 'reports' | 'edit-quiz' | 'quiz-config'
  | 'admin-teachers' | 'admin-api-keys' | 'analytics' | 'classes' | 'question-bank'
  | 'admin-subscribers' | 'institution' | 'trash' | 'pipeline';

const stageLabels: Record<string, { label: string; className: string }> = {
  waiting: { label: 'Aguardando', className: 'bg-muted text-muted-foreground' },
  irat_open: { label: 'iRAT', className: 'phase-irat' },
  trat_open: { label: 'tRAT', className: 'phase-trat' },
  application_open: { label: 'Aplicação', className: 'phase-app' },
  finished: { label: 'Finalizado', className: 'bg-muted text-muted-foreground' },
};

const stages = ['waiting', 'irat_open', 'trat_open', 'application_open', 'finished'] as const;
const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function TeacherDashboard() {
  const { user, profile, signOut, isAdmin, subscription } = useAuth();
  const planLimits = usePlanLimits();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomQuiz, setNewRoomQuiz] = useState('');
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [newRoomMaxGrade, setNewRoomMaxGrade] = useState('10');
  const [newRoomIndPct, setNewRoomIndPct] = useState('30');
  const [newRoomTeamPct, setNewRoomTeamPct] = useState('40');
  const [newRoomAppPct, setNewRoomAppPct] = useState('30');

  // Trash state
  const [trashRooms, setTrashRooms] = useState<any[]>([]);
  const [trashQuizzes, setTrashQuizzes] = useState<any[]>([]);
  const [trashQuestions, setTrashQuestions] = useState<any[]>([]);
  const [trashTab, setTrashTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [quizSubOpen, setQuizSubOpen] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState<ProfileData>({
    full_name: '', nickname: '', gender: '', cpf: '', institution: '',
    institution_city: '', country: '', neighborhood: '', street: '', street_number: '', zip_code: '',
  });

  // Change password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Contact state
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  // Create quiz state
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizOptions, setNewQuizOptions] = useState('4');

  // My quizzes state
  const [quizSearch, setQuizSearch] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [addQOpen, setAddQOpen] = useState(false);
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');

  // Application question state
  const [appQuestions, setAppQuestions] = useState<any[]>([]);
  const [addAppQOpen, setAddAppQOpen] = useState(false);
  const [appQText, setAppQText] = useState('');
  const [appCorrectAnswer, setAppCorrectAnswer] = useState<'V' | 'F'>('V');

  // Edit question state
  const [editQuestionId, setEditQuestionId] = useState<string | null>(null);
  const [editAppQuestionId, setEditAppQuestionId] = useState<string | null>(null);

  // Admin state
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [adminSubscribers, setAdminSubscribers] = useState<any[]>([]);
  const [trialTeachers, setTrialTeachers] = useState<any[]>([]);
  const [approvalPlan, setApprovalPlan] = useState<string>('free');
  const [inlineCheckoutLoading, setInlineCheckoutLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Institutional state
  const [institutionTeachers, setInstitutionTeachers] = useState<any[]>([]);
  const [instInviteEmail, setInstInviteEmail] = useState('');
  const [instInviteName, setInstInviteName] = useState('');
  const [instInviteLoading, setInstInviteLoading] = useState(false);
  const [instLinkEmail, setInstLinkEmail] = useState('');
  const [instLinkLoading, setInstLinkLoading] = useState(false);
  const [instInviteOpen, setInstInviteOpen] = useState(false);
  const [instName, setInstName] = useState('');
  const [instNameSaving, setInstNameSaving] = useState(false);

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePlan, setInvitePlan] = useState('free');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);

  const [showTypeChoice, setShowTypeChoice] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);

  // AI generation state
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuizTitle, setAiQuizTitle] = useState('');
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const [showAiImportDialog, setShowAiImportDialog] = useState(false);
  const [aiImportFile, setAiImportFile] = useState<File | null>(null);
  const [aiImportLoading, setAiImportLoading] = useState(false);
  const aiImportFileInputRef = useRef<HTMLInputElement>(null);

  // Quiz config state (for launching)
  const [configQuiz, setConfigQuiz] = useState<Quiz | null>(null);
  const [maxGrade, setMaxGrade] = useState('10');
  const [individualPct, setIndividualPct] = useState('30');
  const [teamPct, setTeamPct] = useState('40');
  const [applicationPct, setApplicationPct] = useState('30');
  const [showAnswers, setShowAnswers] = useState(true);
  const [showIndividualInTeam, setShowIndividualInTeam] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const isInstitutionalPlan = planLimits.currentPlan === 'institutional';

  useEffect(() => {
    if (user && activeView === 'personal-data') loadProfile();
    if (user && activeView === 'admin-teachers' && isAdmin) { loadTeachers(); loadTrialTeachers(); }
    if (user && activeView === 'admin-subscribers' && isAdmin) loadAdminSubscribers();
    if (user && activeView === 'institution' && isInstitutionalPlan) loadInstitutionTeachers();
    if (user && activeView === 'trash') loadTrash();
  }, [user, activeView]);

  const loadData = async () => {
    const [{ data: roomsData }, { data: quizzesData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('teacher_id', user!.id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('quizzes').select('*, questions(id)').eq('teacher_id', user!.id).is('deleted_at', null).order('created_at', { ascending: false }),
    ]);
    setRooms((roomsData as Room[]) || []);
    setQuizzes((quizzesData as Quiz[]) || []);

    if (roomsData && roomsData.length > 0) {
      const roomIds = roomsData.map(r => r.id);
      const { data: parts } = await supabase
        .from('room_participants')
        .select('user_id')
        .in('room_id', roomIds);
      const uniqueStudents = new Set((parts || []).map((p: any) => p.user_id));
      setTotalStudents(uniqueStudents.size);
    }
    setLoading(false);
  };

  const loadTrash = async () => {
    const [{ data: tRooms }, { data: tQuizzes }, { data: tQuestions }] = await Promise.all([
      supabase.from('rooms').select('*').eq('teacher_id', user!.id).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('quizzes').select('*').eq('teacher_id', user!.id).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('questions').select('*, quizzes!inner(teacher_id)').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ]);
    setTrashRooms(tRooms || []);
    setTrashQuizzes(tQuizzes || []);
    setTrashQuestions((tQuestions || []).filter((q: any) => q.quizzes?.teacher_id === user!.id));
  };

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
    if (data) {
      setProfileForm({
        full_name: data.full_name || '',
        nickname: (data as any).nickname || '',
        gender: (data as any).gender || '',
        cpf: (data as any).cpf || '',
        institution: (data as any).institution || '',
        institution_city: (data as any).institution_city || '',
        country: (data as any).country || '',
        neighborhood: (data as any).neighborhood || '',
        street: (data as any).street || '',
        street_number: (data as any).street_number || '',
        zip_code: (data as any).zip_code || '',
      });
    }
  };

  const saveProfile = async () => {
    const { error } = await supabase.from('profiles').update(profileForm as any).eq('id', user!.id);
    if (error) { toast.error('Falha ao salvar dados'); return; }
    toast.success('Dados atualizados com sucesso!');
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error('Senhas não conferem'); return; }
    if (newPassword.length < 6) { toast.error('A nova senha deve ter ao menos 6 caracteres'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); return; }
    toast.success('Senha alterada com sucesso!');
    setOldPassword(''); setNewPassword(''); setConfirmPassword('');
  };

  const loadTeachers = async () => {
    const [{ data: roles }, { data: manualSubs }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('manual_subscriptions').select('*'),
    ]);
    if (!roles) return;
    const teacherRoles = roles.filter((r: any) => r.role === 'teacher' || r.role === 'admin');
    const userIds = teacherRoles.map((r: any) => r.user_id);
    if (userIds.length === 0) { setAllTeachers([]); return; }
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, is_approved, is_blocked, institution, created_at').in('id', userIds);
    const merged = (profiles || []).map((p: any) => {
      const r = teacherRoles.find((r: any) => r.user_id === p.id);
      const ms = (manualSubs || []).find((s: any) => s.user_id === p.id);
      return { ...p, role: r?.role || 'teacher', manualPlan: ms?.plan || null, grantedBy: ms?.granted_by || null };
    });
    setAllTeachers(merged);
  };

  const loadTrialTeachers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('list-trial-teachers');
      if (error) { console.error('Error loading trial teachers:', error); return; }
      setTrialTeachers(data?.trialTeachers || []);
    } catch (err) {
      console.error('Error loading trial teachers:', err);
    }
  };

  const approveTeacher = async (id: string) => {
    await supabase.from('profiles').update({ is_approved: true } as any).eq('id', id);
    // If a plan was selected, grant it via manual_subscriptions
    if (approvalPlan && approvalPlan !== 'free') {
      await supabase.from('manual_subscriptions').upsert({
        user_id: id,
        plan: approvalPlan,
        granted_by: user!.id,
      } as any, { onConflict: 'user_id' });
    }
    toast.success('Professor aprovado!');
    setApprovalPlan('free');
    loadTeachers();
    supabase.functions.invoke('send-approval-email', { body: { teacherId: id } })
      .then(res => {
        if (res.error) console.error('Erro ao enviar e-mail de aprovação:', res.error);
        else toast.success('E-mail de aprovação enviado!');
      });
  };

  const loadAdminSubscribers = async () => {
    const [{ data: roles }, { data: profiles }, { data: manualSubs }, { data: rooms }, { data: participants }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('profiles').select('id, full_name, email, institution, created_at'),
      supabase.from('manual_subscriptions').select('*'),
      supabase.from('rooms').select('id, teacher_id'),
      supabase.from('room_participants').select('user_id, room_id'),
    ]);
    // Build student→teacher mapping (most recent room's teacher)
    const studentTeacherMap: Record<string, string> = {};
    (participants || []).forEach((p: any) => {
      const room = (rooms || []).find((r: any) => r.id === p.room_id);
      if (room) studentTeacherMap[p.user_id] = room.teacher_id;
    });
    const merged = (profiles || []).map((p: any) => {
      const r = (roles || []).find((r: any) => r.user_id === p.id);
      const ms = (manualSubs || []).find((s: any) => s.user_id === p.id);
      return {
        ...p,
        role: r?.role || 'student',
        manualPlan: ms?.plan || 'free',
        grantedAt: ms?.granted_at,
        expiresAt: ms?.expires_at,
        teacherId: studentTeacherMap[p.id] || null,
      };
    });
    setAdminSubscribers(merged);
  };

  // ─── Institutional management ───
  const loadInstitutionTeachers = async () => {
    if (!user) return;
    // Load institution name from own profile
    const { data: ownProfile } = await supabase.from('profiles').select('institution').eq('id', user.id).single();
    if (ownProfile?.institution) setInstName(ownProfile.institution);

    const { data: subs } = await supabase
      .from('manual_subscriptions')
      .select('user_id, plan, granted_at')
      .eq('granted_by', user.id);
    if (!subs || subs.length === 0) { setInstitutionTeachers([]); return; }
    const userIds = subs.map((s: any) => s.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, institution').in('id', userIds);
    const merged = subs.map((s: any) => {
      const p = profiles?.find((pr: any) => pr.id === s.user_id);
      return { ...s, full_name: p?.full_name || '—', email: p?.email || '—', institution: p?.institution || '—' };
    });
    setInstitutionTeachers(merged);
  };

  const saveInstitutionName = async () => {
    if (!user || !instName.trim()) { toast.error('Informe o nome da instituição'); return; }
    setInstNameSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-institution-teachers', {
        body: { institution: instName.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Instituição atualizada para todos os professores vinculados!');
      loadInstitutionTeachers();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar instituição');
    } finally {
      setInstNameSaving(false);
    }
  };

  const handleInstitutionInvite = async () => {
    if (!instInviteEmail || !instInviteName) { toast.error('Preencha nome e e-mail'); return; }
    setInstInviteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invite-teacher', {
        body: { email: instInviteEmail, fullName: instInviteName, plan: 'pro', institution: instName.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Professor convidado com sucesso!');
      setInstInviteEmail(''); setInstInviteName(''); setInstInviteOpen(false);
      loadInstitutionTeachers();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao convidar professor');
    } finally {
      setInstInviteLoading(false);
    }
  };

  const handleInstitutionLink = async () => {
    if (!instLinkEmail) { toast.error('Informe o e-mail do professor'); return; }
    setInstLinkLoading(true);
    try {
      // Find existing user
      const { data: profiles } = await supabase.from('profiles').select('id, email').eq('email', instLinkEmail);
      if (!profiles || profiles.length === 0) { toast.error('Professor não encontrado. Use a opção de convidar.'); return; }
      const teacherId = profiles[0].id;
      // Grant pro plan linked to this institution
      const { error } = await supabase.from('manual_subscriptions').upsert({
        user_id: teacherId,
        plan: 'pro',
        granted_by: user!.id,
      } as any, { onConflict: 'user_id' });
      if (error) throw error;
      // Also approve and set institution server-side (bypass RLS)
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-institution-teachers', {
        body: { institution: instName.trim() || undefined, teacherId },
      });
      if (syncError) throw syncError;
      if (syncData?.error) throw new Error(syncData.error);
      toast.success('Professor vinculado à instituição!');
      setInstLinkEmail('');
      loadInstitutionTeachers();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao vincular professor');
    } finally {
      setInstLinkLoading(false);
    }
  };

  const handleInstitutionRemove = async (teacherUserId: string) => {
    await supabase.from('manual_subscriptions').update({ plan: 'free', granted_by: null } as any).eq('user_id', teacherUserId).eq('granted_by', user!.id);
    toast.success('Professor removido da instituição');
    loadInstitutionTeachers();
  };

  const blockTeacher = async (id: string, block: boolean) => {
    await supabase.from('profiles').update({ is_blocked: block } as any).eq('id', id);
    toast.success(block ? 'Professor bloqueado' : 'Professor desbloqueado');
    loadTeachers();
  };

  const deleteTeacher = async (id: string) => {
    await supabase.from('user_roles').delete().eq('user_id', id);
    await supabase.from('profiles').delete().eq('id', id);
    toast.success('Professor excluído');
    loadTeachers();
  };

  const deleteFullUser = async (userId: string) => {
    setDeleteUserLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Usuário excluído com sucesso!');
      setDeleteUserTarget(null);
      loadAdminSubscribers();
      if (activeView === 'admin-teachers') loadTeachers();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir usuário');
    } finally { setDeleteUserLoading(false); }
  };

  const inviteTeacher = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) { toast.error('Preencha nome e e-mail'); return; }
    setInviteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invite-teacher', {
        body: { email: inviteEmail.trim(), fullName: inviteName.trim(), plan: invitePlan },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Convite enviado para ${inviteEmail}!`);
      setInviteOpen(false); setInviteEmail(''); setInviteName(''); setInvitePlan('free');
      loadTeachers();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar convite');
    } finally { setInviteLoading(false); }
  };

  const sendContact = async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) { toast.error('Preencha todos os campos'); return; }
    try {
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: { subject: contactSubject.trim(), message: contactMessage.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Mensagem enviada com sucesso!');
      setContactSubject(''); setContactMessage('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar mensagem');
    }
  };

  const resendInvite = async (email: string, fullName: string, plan: string = 'free'): Promise<void> => {
    setResendingInvite(email);
    try {
      const { data, error } = await supabase.functions.invoke('send-invite-teacher', {
        body: { email, fullName, plan },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Convite reenviado para ${email}!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reenviar convite');
    } finally {
      setResendingInvite(null);
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    // Check room limit for free plan
    if (isFinite(planLimits.maxRoomsPerMonth)) {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const roomsThisMonth = rooms.filter(r => r.created_at >= firstOfMonth).length;
      if (roomsThisMonth >= planLimits.maxRoomsPerMonth) {
        planLimits.showUpgradeDialog('Salas ilimitadas');
        return;
      }
    }
    const indPct = parseInt(newRoomIndPct) || 30;
    const tmPct = parseInt(newRoomTeamPct) || 40;
    const appPct = parseInt(newRoomAppPct) || 30;
    if (indPct + tmPct + appPct !== 100) { toast.error('A soma dos percentuais deve ser 100%'); return; }
    const { data: codeData } = await supabase.rpc('generate_room_code');
    const code = codeData as string;
    const { error } = await supabase.from('rooms').insert({
      name: newRoomName.trim(), code, teacher_id: user!.id, quiz_id: newRoomQuiz || null,
      max_grade: parseFloat(newRoomMaxGrade) || 10,
      individual_pct: indPct, team_pct: tmPct, application_pct: appPct,
    } as any);
    if (error) { toast.error('Falha ao criar sala'); return; }
    toast.success(`Sala criada! Código: ${code}`);
    setNewRoomName(''); setNewRoomQuiz(''); setCreateRoomOpen(false);
    setNewRoomMaxGrade('10'); setNewRoomIndPct('30'); setNewRoomTeamPct('40'); setNewRoomAppPct('30');
    loadData();
  };

  const advanceStage = async (room: Room) => {
    const currentIdx = stages.indexOf(room.current_stage as any);
    if (currentIdx >= stages.length - 1) return;
    const nextStage = stages[currentIdx + 1];
    if (nextStage === 'irat_open') {
      const endTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await supabase.from('rooms').update({ current_stage: nextStage, irat_end_time: endTime }).eq('id', room.id);
    } else {
      await supabase.from('rooms').update({ current_stage: nextStage }).eq('id', room.id);
    }
    loadData();
    toast.success(`Avançou para ${stageLabels[nextStage].label}`);
  };

  const toggleArchive = async (room: Room) => {
    // Soft delete - send to trash
    await supabase.from('rooms').update({ deleted_at: new Date().toISOString() } as any).eq('id', room.id);
    loadData();
    toast.success('Sala movida para a lixeira');
  };

  const canReapply = (room: Room) => {
    if (!room.cancelled_at || room.is_active) return false;
    const cancelledAt = new Date(room.cancelled_at).getTime();
    const now = Date.now();
    return (now - cancelledAt) < 24 * 60 * 60 * 1000; // within 24h
  };

  const reapplyRoom = async (room: Room) => {
    // Clean all previous data
    const { data: qIds } = await supabase.from('questions').select('id').eq('quiz_id', room.quiz_id!);
    const { data: aqIds } = await supabase.from('application_questions').select('id').eq('room_id', room.id);
    if (qIds && qIds.length > 0) {
      const ids = qIds.map(q => q.id);
      await supabase.from('irat_responses').delete().eq('room_id', room.id);
      await supabase.from('trat_attempts').delete().eq('room_id', room.id);
    }
    if (aqIds && aqIds.length > 0) {
      const ids = aqIds.map(q => q.id);
      await supabase.from('application_responses').delete().eq('room_id', room.id);
    }
    await supabase.from('application_questions').delete().eq('room_id', room.id);
    await supabase.from('appeals').delete().eq('room_id', room.id);
    
    await supabase.from('rooms').update({ 
      is_active: true, 
      current_stage: 'waiting',
      cancelled_at: null,
      irat_end_time: null,
      trat_end_time: null,
      app_end_time: null,
    } as any).eq('id', room.id);
    toast.success('Sala reativada! Todos os dados anteriores foram limpos.');
    loadData();
  };

  // Quiz management
  const createQuiz = async () => {
    if (!newQuizTitle.trim()) { toast.error('Informe o nome do questionário'); return; }
    if (isFinite(planLimits.maxQuizzes) && quizzes.length >= planLimits.maxQuizzes) {
      planLimits.showUpgradeDialog('Questionários ilimitados');
      return;
    }
    const { error } = await supabase.from('quizzes').insert({ title: newQuizTitle.trim(), teacher_id: user!.id });
    if (error) { toast.error('Falha ao criar questionário'); return; }
    toast.success('Questionário criado!');
    setNewQuizTitle(''); setNewQuizOptions('4');
    loadData();
    setActiveView('my-quizzes');
  };

  const openQuizConfig = (quiz: Quiz) => {
    setConfigQuiz(quiz);
    setMaxGrade('10'); setIndividualPct('30'); setTeamPct('40'); setApplicationPct('30');
    setShowAnswers(true); setShowIndividualInTeam(false);
    setActiveView('quiz-config');
  };

  const launchQuiz = async () => {
    if (!configQuiz) return;
    const indPct = parseInt(individualPct) || 30;
    const tmPct = parseInt(teamPct) || 40;
    const appPct = parseInt(applicationPct) || 30;
    if (indPct + tmPct + appPct !== 100) { toast.error('A soma dos percentuais deve ser 100%'); return; }
    try {
      const { data: codeData, error: codeError } = await supabase.rpc('generate_room_code');
      if (codeError) { toast.error('Falha ao gerar código da sala'); console.error(codeError); return; }
      const code = codeData as string;
      const { data: room, error } = await supabase.from('rooms').insert({
        name: configQuiz.title, code, teacher_id: user!.id, quiz_id: configQuiz.id,
        max_grade: parseFloat(maxGrade) || 10,
        individual_pct: indPct, team_pct: tmPct, application_pct: appPct,
        show_answers_in_report: showAnswers, show_individual_in_team: showIndividualInTeam,
      } as any).select().single();
      if (error) { toast.error('Falha ao criar sala: ' + error.message); console.error(error); return; }
      toast.success('Sala criada!');
      navigate(`/room/${room.id}/manage`);
    } catch (err) {
      console.error(err);
      toast.error('Erro inesperado ao criar sala');
    }
  };

  const deleteQuiz = async (id: string) => {
    // Soft delete - move to trash
    await supabase.from('quizzes').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
    loadData();
    toast.success('Questionário movido para a lixeira');
  };

  const deleteQuestion = async (id: string) => {
    // Soft delete
    await supabase.from('questions').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
    if (selectedQuiz) {
      const { data } = await supabase.from('questions').select('*').eq('quiz_id', selectedQuiz.id).is('deleted_at', null).order('sort_order');
      setQuestions((data as Question[]) || []);
    }
  };

  const deleteAppQuestionFromQuiz = async (id: string) => {
    await supabase.from('application_questions').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
    if (selectedQuiz) {
      const { data } = await supabase.from('application_questions').select('*').eq('quiz_id', selectedQuiz.id).is('deleted_at', null).order('sort_order');
      setAppQuestions(data || []);
    }
  };

  // Trash actions
  const restoreFromTrash = async (type: 'room' | 'quiz' | 'question', id: string) => {
    const table = type === 'room' ? 'rooms' : type === 'quiz' ? 'quizzes' : 'questions';
    await supabase.from(table).update({ deleted_at: null } as any).eq('id', id);
    toast.success('Item restaurado!');
    loadTrash();
    loadData();
  };

  const permanentDelete = async (type: 'room' | 'quiz' | 'question', id: string) => {
    if (type === 'room') {
      // Clean related data
      await supabase.from('irat_responses').delete().eq('room_id', id);
      await supabase.from('trat_attempts').delete().eq('room_id', id);
      await supabase.from('application_responses').delete().eq('room_id', id);
      await supabase.from('application_questions').delete().eq('room_id', id);
      await supabase.from('appeals').delete().eq('room_id', id);
      await supabase.from('team_members').delete().eq('room_id', id);
      await supabase.from('teams').delete().eq('room_id', id);
      await supabase.from('room_participants').delete().eq('room_id', id);
      await supabase.from('rooms').delete().eq('id', id);
    } else if (type === 'quiz') {
      const { data: qIds } = await supabase.from('questions').select('id').eq('quiz_id', id);
      const { data: aqIds } = await supabase.from('application_questions').select('id').eq('quiz_id', id);
      if (qIds && qIds.length > 0) {
        const ids = qIds.map(q => q.id);
        await supabase.from('irat_responses').delete().in('question_id', ids);
        await supabase.from('trat_attempts').delete().in('question_id', ids);
      }
      if (aqIds && aqIds.length > 0) {
        const ids = aqIds.map(q => q.id);
        await supabase.from('application_responses').delete().in('question_id', ids);
      }
      await supabase.from('application_questions').delete().eq('quiz_id', id);
      await supabase.from('questions').delete().eq('quiz_id', id);
      await supabase.from('rooms').update({ quiz_id: null }).eq('quiz_id', id);
      await supabase.from('quizzes').delete().eq('id', id);
    } else {
      await supabase.from('irat_responses').delete().eq('question_id', id);
      await supabase.from('trat_attempts').delete().eq('question_id', id);
      await supabase.from('questions').delete().eq('id', id);
    }
    toast.success('Item excluído definitivamente');
    loadTrash();
  };

  const openEditQuiz = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    const [{ data }, { data: appData }] = await Promise.all([
      supabase.from('questions').select('*').eq('quiz_id', quiz.id).is('deleted_at', null).order('sort_order'),
      supabase.from('application_questions').select('*').eq('quiz_id', quiz.id).is('deleted_at', null).order('sort_order'),
    ]);
    setQuestions((data as Question[]) || []);
    setAppQuestions(appData || []);
    setActiveView('edit-quiz');
  };

  const addQuestion = async () => {
    if (!qText.trim() || !optA || !optB || !optC || !optD) { toast.error('Preencha todos os campos'); return; }
    const totalQ = questions.length + appQuestions.length;
    if (isFinite(planLimits.maxQuestionsPerQuiz) && totalQ >= planLimits.maxQuestionsPerQuiz) {
      planLimits.showUpgradeDialog('Questões ilimitadas por questionário');
      return;
    }
    const { error } = await supabase.from('questions').insert({
      quiz_id: selectedQuiz!.id, question_text: qText.trim(),
      option_a: optA, option_b: optB, option_c: optC, option_d: optD,
      correct_option: correct, sort_order: questions.length,
    });
    if (error) { toast.error('Falha ao adicionar questão'); return; }
    toast.success('Questão adicionada!');
    setQText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setCorrect('A');
    setAddQOpen(false);
    const { data } = await supabase.from('questions').select('*').eq('quiz_id', selectedQuiz!.id).is('deleted_at', null).order('sort_order');
    setQuestions((data as Question[]) || []);
    loadData();
  };

  const addAppQuestionToQuiz = async () => {
    if (!appQText.trim()) { toast.error('Preencha o enunciado'); return; }
    const totalQ = questions.length + appQuestions.length;
    if (isFinite(planLimits.maxQuestionsPerQuiz) && totalQ >= planLimits.maxQuestionsPerQuiz) {
      planLimits.showUpgradeDialog('Questões ilimitadas por questionário');
      return;
    }
    const { error } = await supabase.from('application_questions').insert({
      quiz_id: selectedQuiz!.id, question_text: appQText.trim(),
      option_a: 'V', option_b: 'F', option_c: null, option_d: null,
      correct_answer: appCorrectAnswer,
      sort_order: appQuestions.length,
    });
    if (error) { toast.error('Falha ao adicionar questão de aplicação'); return; }
    toast.success('Questão de aplicação adicionada!');
    setAppQText(''); setAppCorrectAnswer('V');
    setAddAppQOpen(false);
    const { data } = await supabase.from('application_questions').select('*').eq('quiz_id', selectedQuiz!.id).is('deleted_at', null).order('sort_order');
    setAppQuestions(data || []);
  };

  // deleteQuestion and deleteAppQuestionFromQuiz already defined above

  // AI helper functions
  const getMimeType = (name: string): string => {
    if (name.endsWith('.pdf')) return 'application/pdf';
    if (name.endsWith('.doc')) return 'application/msword';
    if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (name.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
    if (name.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return 'text/plain';
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractAiErrorMessage = (error: unknown) => {
    if (!error) return 'Falha ao gerar questões com IA';

    const message = typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: string }).message || '')
      : String(error);

    if (message.includes('Failed to fetch')) {
      return 'A geração demorou demais ou a função falhou ao processar o arquivo. Tente novamente com um PDF menor ou em texto pesquisável.';
    }

    return message || 'Falha ao gerar questões com IA';
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const generateWithAI = async () => {
    if (!aiFile || !aiQuizTitle.trim()) return;
    if (isFinite(planLimits.maxQuizzes) && quizzes.length >= planLimits.maxQuizzes) {
      planLimits.showUpgradeDialog('Questionários ilimitados');
      return;
    }
    if (!planLimits.canUseAI) { planLimits.showUpgradeDialog('Geração de Questões com IA'); return; }
    if (planLimits.isAiLimitReached) { planLimits.showUpgradeDialog('IA Ilimitada'); return; }
    if (aiFile.size > MAX_FILE_SIZE) { toast.error('Arquivo muito grande. Máximo 10MB.'); return; }
    setAiLoading(true);
    try {
      const isText = aiFile.name.endsWith('.txt') || aiFile.name.endsWith('.md');
      const mimeType = getMimeType(aiFile.name);
      let fileContent: string;
      if (isText) { fileContent = await readFileAsText(aiFile); }
      else { fileContent = await readFileAsBase64(aiFile); }

      const { data, error } = await supabase.functions.invoke('generate-quiz-ai', { body: { fileContent, fileName: aiFile.name, mimeType: isText ? undefined : mimeType } });
      if (error) throw error;
      if (data?.error) {
        if (data.error === 'PLAN_LIMIT') { planLimits.showUpgradeDialog('Geração de Questões com IA'); setAiLoading(false); return; }
        throw new Error(data.message || data.error);
      }

      const { data: quiz, error: qErr } = await supabase.from('quizzes').insert({ title: aiQuizTitle.trim(), teacher_id: user!.id }).select().single();
      if (qErr || !quiz) throw new Error('Falha ao criar questionário');

      if (data.irat_questions?.length) {
        await supabase.from('questions').insert(data.irat_questions.map((q: any, i: number) => ({
          quiz_id: quiz.id, question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, sort_order: i,
        })));
      }
      if (data.application_questions?.length) {
        await supabase.from('application_questions').insert(data.application_questions.map((q: any, i: number) => ({
          quiz_id: quiz.id, question_text: q.question_text, option_a: 'V', option_b: 'F', option_c: null, option_d: null, correct_answer: q.correct_answer, sort_order: i,
        })));
      }

      toast.success(`Questionário criado com ${data.irat_questions?.length || 0} questões iRAT/tRAT e ${data.application_questions?.length || 0} de aplicação!`);
      setShowAiDialog(false); setAiFile(null); setAiQuizTitle('');
      loadData();
      // Open the quiz for editing
      setSelectedQuiz(quiz as Quiz);
      const [{ data: qData }, { data: aData }] = await Promise.all([
        supabase.from('questions').select('*').eq('quiz_id', quiz.id).order('sort_order'),
        supabase.from('application_questions').select('*').eq('quiz_id', quiz.id).order('sort_order'),
      ]);
      setQuestions((qData as Question[]) || []);
      setAppQuestions(aData || []);
      setActiveView('edit-quiz');
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('PLAN_LIMIT')) {
        planLimits.showUpgradeDialog('Geração de Questões com IA');
      } else {
        toast.error(extractAiErrorMessage(err));
      }
    } finally { setAiLoading(false); planLimits.refreshSubscription(); }
  };

  const generateForExistingQuiz = async () => {
    if (!aiImportFile || !selectedQuiz) return;
    if (!planLimits.canUseAI) { planLimits.showUpgradeDialog('Geração de Questões com IA'); return; }
    if (planLimits.isAiLimitReached) { planLimits.showUpgradeDialog('IA Ilimitada'); return; }
    if (aiImportFile.size > MAX_FILE_SIZE) { toast.error('Arquivo muito grande. Máximo 10MB.'); return; }
    setAiImportLoading(true);
    try {
      const isText = aiImportFile.name.endsWith('.txt') || aiImportFile.name.endsWith('.md');
      const mimeType = getMimeType(aiImportFile.name);
      let fileContent: string;
      if (isText) { fileContent = await readFileAsText(aiImportFile); }
      else { fileContent = await readFileAsBase64(aiImportFile); }

      const { data, error } = await supabase.functions.invoke('generate-quiz-ai', { body: { fileContent, fileName: aiImportFile.name, mimeType: isText ? undefined : mimeType } });
      if (error) throw error;
      if (data?.error) {
        if (data.error === 'PLAN_LIMIT') { planLimits.showUpgradeDialog('Geração de Questões com IA'); setAiImportLoading(false); return; }
        throw new Error(data.message || data.error);
      }

      if (data.irat_questions?.length) {
        await supabase.from('questions').insert(data.irat_questions.map((q: any, i: number) => ({
          quiz_id: selectedQuiz.id, question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, sort_order: questions.length + i,
        })));
      }
      if (data.application_questions?.length) {
        await supabase.from('application_questions').insert(data.application_questions.map((q: any, i: number) => ({
          quiz_id: selectedQuiz.id, question_text: q.question_text, option_a: 'V', option_b: 'F', option_c: null, option_d: null, correct_answer: q.correct_answer, sort_order: appQuestions.length + i,
        })));
      }

      toast.success(`Adicionadas ${data.irat_questions?.length || 0} questões iRAT/tRAT e ${data.application_questions?.length || 0} de aplicação!`);
      setShowAiImportDialog(false); setAiImportFile(null);
      const [{ data: qData }, { data: aData }] = await Promise.all([
        supabase.from('questions').select('*').eq('quiz_id', selectedQuiz.id).order('sort_order'),
        supabase.from('application_questions').select('*').eq('quiz_id', selectedQuiz.id).order('sort_order'),
      ]);
      setQuestions((qData as Question[]) || []);
      setAppQuestions(aData || []);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('PLAN_LIMIT')) {
        planLimits.showUpgradeDialog('Geração de Questões com IA');
      } else {
        toast.error(extractAiErrorMessage(err));
      }
    } finally { setAiImportLoading(false); planLimits.refreshSubscription(); }
  };

  // Chart data
  const currentYear = new Date().getFullYear();
  const chartData = months.map((m, i) => {
    const count = rooms.filter(r => {
      const d = new Date(r.created_at);
      return d.getFullYear() === currentYear && d.getMonth() === i && r.current_stage === 'finished';
    }).length;
    return { name: m, value: count };
  });

  const finishedCount = rooms.filter(r => r.current_stage === 'finished').length;
  const activeRooms = rooms.filter(r => r.is_active && r.current_stage !== 'finished');
  const finishedRooms = rooms.filter(r => r.current_stage === 'finished');

  const filteredQuizzes = quizzes.filter(q =>
    q.title.toLowerCase().includes(quizSearch.toLowerCase())
  );

  const getQuizStatus = (quiz: Quiz) => {
    const hasQuestions = (quiz.questions?.length || 0) > 0;
    const isApplied = rooms.some(r => r.quiz_id === quiz.id && r.current_stage === 'finished');
    if (isApplied) return 'Aplicação Finalizada';
    if (hasQuestions) return 'Questionário concluído';
    return 'Questionário não concluído';
  };

  // ==================== RENDER FUNCTIONS ====================

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold">Painel <span className="font-normal text-muted-foreground">Dashboard</span></h2>
        <div className="text-sm text-muted-foreground">Ano referência: <span className="font-semibold text-foreground">{currentYear}</span></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground mb-1">Salas Criadas</p>
            <p className="text-3xl font-heading font-bold">{rooms.length}</p>
            <p className="text-xs text-primary mt-1">{activeRooms.length} ativas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(var(--phase-trat))' }}>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground mb-1">Finalizadas</p>
            <p className="text-3xl font-heading font-bold">{finishedCount}</p>
            <p className="text-xs mt-1" style={{ color: 'hsl(var(--phase-trat))' }}>Sessões completas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(var(--success))' }}>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground mb-1">Alunos</p>
            <p className="text-3xl font-heading font-bold">{totalStudents}</p>
            <p className="text-xs mt-1" style={{ color: 'hsl(var(--success))' }}>Participaram das aplicações</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Sessões Finalizadas por Mês</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} name="Sessões" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      {activeRooms.length > 0 && (
        <div>
          <h3 className="text-lg font-heading font-semibold mb-3">Salas Ativas</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeRooms.slice(0, 6).map(room => (
              <Card key={room.id} className="transition-all hover:shadow-md cursor-pointer" onClick={() => navigate(`/room/${room.id}/manage`)}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-heading font-semibold truncate">{room.name}</p>
                    <Badge className={stageLabels[room.current_stage]?.className || ''}>{stageLabels[room.current_stage]?.label}</Badge>
                  </div>
                  <p className="font-mono text-sm tracking-widest text-muted-foreground">{room.code}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderRooms = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold">Suas Salas</h2>
        <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Nova Sala</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">Criar Sala</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome da Sala</Label>
                <Input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="Ex: Biologia 101" />
              </div>
              <div className="space-y-2">
                <Label>Quiz (opcional)</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newRoomQuiz} onChange={e => setNewRoomQuiz(e.target.value)}>
                  <option value="">Nenhum quiz selecionado</option>
                  {quizzes.map(q => (<option key={q.id} value={q.id}>{q.title} ({q.questions?.length || 0} questões)</option>))}
                </select>
              </div>
              <Separator />
              <p className="text-sm font-semibold text-center">Configurações da Avaliação</p>
              <div className="space-y-2">
                <Label>Nota Máxima</Label>
                <Input value={newRoomMaxGrade} onChange={e => setNewRoomMaxGrade(e.target.value)} placeholder="10" type="number" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">% Individual (iRAT)</Label>
                  <Input value={newRoomIndPct} onChange={e => setNewRoomIndPct(e.target.value)} type="number" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">% Equipe (tRAT)</Label>
                  <Input value={newRoomTeamPct} onChange={e => setNewRoomTeamPct(e.target.value)} type="number" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">% Aplicação</Label>
                  <Input value={newRoomAppPct} onChange={e => setNewRoomAppPct(e.target.value)} type="number" />
                </div>
              </div>
              {(() => {
                const total = (parseInt(newRoomIndPct) || 0) + (parseInt(newRoomTeamPct) || 0) + (parseInt(newRoomAppPct) || 0);
                return <p className={`text-xs text-center ${total !== 100 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>Total: {total}% — A soma deve ser 100%.</p>;
              })()}
              <Button onClick={createRoom} className="w-full" disabled={(() => { const t = (parseInt(newRoomIndPct)||0) + (parseInt(newRoomTeamPct)||0) + (parseInt(newRoomAppPct)||0); return t !== 100; })()}>Criar Sala</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {rooms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Nenhuma sala ainda. Crie uma para começar!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(room => (
            <Card key={room.id} className={`transition-all hover:shadow-md ${!room.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="font-heading text-lg">{room.name}</CardTitle>
                    <CardDescription className="font-mono text-lg tracking-widest mt-1">{room.code}</CardDescription>
                  </div>
                  <Badge className={stageLabels[room.current_stage]?.className || ''}>{stageLabels[room.current_stage]?.label || room.current_stage}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  {room.is_active && room.current_stage !== 'finished' && (
                    <Button size="sm" onClick={() => advanceStage(room)} className="flex-1"><Play className="w-3 h-3 mr-1" /> Próxima Fase</Button>
                  )}
                  {!room.is_active && canReapply(room) && (
                    <Button size="sm" onClick={() => reapplyRoom(room)} className="flex-1" variant="outline">
                      <RefreshCw className="w-3 h-3 mr-1" /> Reaplicar
                    </Button>
                  )}
                  {!room.is_active && room.cancelled_at && !canReapply(room) && (
                    <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">Encerrada definitivamente</Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={() => navigate(`/room/${room.id}/manage`)}><ChevronRight className="w-3 h-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleArchive(room)}><Archive className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderPersonalData = () => (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-heading font-bold">Meus Dados</h2>
      <Card>
        <CardHeader><CardTitle className="text-lg">Dados Pessoais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input value={profileForm.cpf} onChange={e => setProfileForm(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" />
          </div>
          <div className="space-y-2">
            <Label>Nome Completo</Label>
            <Input value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Como deseja ser chamado</Label>
              <Input value={profileForm.nickname} onChange={e => setProfileForm(p => ({ ...p, nickname: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Gênero</Label>
              <Select value={profileForm.gender} onValueChange={v => setProfileForm(p => ({ ...p, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o gênero" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                  <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={user?.email || ''} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Instituição de Ensino</Label>
            <Input value={profileForm.institution} onChange={e => setProfileForm(p => ({ ...p, institution: e.target.value }))} placeholder="Nome da instituição" />
          </div>
          <div className="space-y-2">
            <Label>Cidade da Instituição</Label>
            <Input value={profileForm.institution_city} onChange={e => setProfileForm(p => ({ ...p, institution_city: e.target.value }))} placeholder="Cidade da Instituição de Ensino" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Endereço Pessoal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>País</Label>
            <Select value={profileForm.country} onValueChange={v => setProfileForm(p => ({ ...p, country: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione um país" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="brasil">Brasil</SelectItem>
                <SelectItem value="portugal">Portugal</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={profileForm.neighborhood} onChange={e => setProfileForm(p => ({ ...p, neighborhood: e.target.value }))} placeholder="Informe o bairro" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <Label>Logradouro</Label>
              <Input value={profileForm.street} onChange={e => setProfileForm(p => ({ ...p, street: e.target.value }))} placeholder="Informe a rua" />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={profileForm.street_number} onChange={e => setProfileForm(p => ({ ...p, street_number: e.target.value }))} placeholder="Nº" className="w-24" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input value={profileForm.zip_code} onChange={e => setProfileForm(p => ({ ...p, zip_code: e.target.value }))} placeholder="Informe o CEP" className="max-w-xs" />
          </div>
          <Button onClick={saveProfile}>Alterar Dados</Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderMyPlan = () => {
    const currentPlanKey = subscription.plan || 'free';
    const planMetaInline: Record<string, { icon: typeof Sparkles; highlight: boolean; badge?: string }> = {
      free: { icon: Sparkles, highlight: false },
      pro: { icon: Crown, highlight: true, badge: 'Mais Popular' },
      institutional: { icon: CreditCard, highlight: false },
  };


    const handleCheckout = async (planKey: string) => {
      if (planKey === 'free') { toast.info('Você já está no plano gratuito!'); return; }
      setInlineCheckoutLoading(planKey);
      try {
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { priceId: STRIPE_PLANS[planKey as keyof typeof STRIPE_PLANS].price_id },
        });
        if (error) throw error;
        if (data?.url) window.location.href = data.url;
      } catch (err: any) {
        toast.error(err.message || 'Erro ao iniciar checkout');
      } finally { setInlineCheckoutLoading(null); }
    };

    const handleManageSubscription = async () => {
      setCancelLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('customer-portal');
        if (error) throw error;
        if (data?.url) window.location.href = data.url;
      } catch (err: any) {
        toast.error(err.message || 'Erro ao abrir portal de gerenciamento');
      } finally { setCancelLoading(false); }
    };

    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-heading font-bold mb-2">Escolha o plano ideal</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Comece gratuitamente e faça upgrade quando precisar. Todos os planos incluem as 3 fases completas do TBL.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {(Object.entries(STRIPE_PLANS) as [string, typeof STRIPE_PLANS[keyof typeof STRIPE_PLANS]][]).map(([key, plan]) => {
            const meta = planMetaInline[key];
            const Icon = meta.icon;
            const isCurrent = currentPlanKey === key;
            const isLoading = inlineCheckoutLoading === key;

            return (
              <div
                key={key}
                className={`relative rounded-3xl border p-8 flex flex-col ${
                  isCurrent
                    ? 'border-primary ring-2 ring-primary/30 bg-primary/[0.03] shadow-xl shadow-primary/10 scale-[1.02]'
                    : meta.highlight
                    ? 'border-primary/50 bg-primary/[0.02] shadow-lg shadow-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                {meta.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {meta.badge}
                  </div>
                )}
                <div className="mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${meta.highlight ? 'bg-primary/15' : 'bg-accent'}`}>
                    <Icon className={`w-6 h-6 ${meta.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-heading font-bold">
                      {plan.price === 0 ? 'Grátis' : `R$${plan.price.toFixed(2).replace('.', ',')}`}
                    </span>
                    {plan.price > 0 && <span className="text-muted-foreground text-sm">/mês</span>}
                  </div>
                  {plan.price > 0 && (
                    <p className="text-sm text-primary font-semibold mt-2">
                      🎉 7 dias grátis · Cancele quando quiser
                    </p>
                  )}
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${meta.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <Button
                    onClick={() => handleCheckout(key)}
                    disabled={isLoading || inlineCheckoutLoading !== null || isCurrent}
                    variant={isCurrent ? 'secondary' : meta.highlight ? 'default' : 'outline'}
                    className={`w-full rounded-2xl h-12 ${meta.highlight && !isCurrent ? 'shadow-lg shadow-primary/20' : ''}`}
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {isCurrent ? '✓ Plano Atual' : key === 'free' ? 'Plano Gratuito' : 'Assinar Agora'}
                  </Button>
                  {isCurrent && subscription.subscribed && key !== 'free' && (
                    <Button
                      onClick={handleManageSubscription}
                      disabled={cancelLoading}
                      variant="ghost"
                      className="w-full rounded-2xl h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {cancelLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Cancelar Assinatura
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Plan details for current plan */}
        {subscription.subscribed && subscription.subscriptionEnd && (
          <Card className="max-w-md mx-auto border-t-4 border-t-primary">
            <CardContent className="pt-6 space-y-2 text-sm">
              <div className="flex items-center gap-2"><Settings2 className="w-4 h-4 text-muted-foreground" /><span><span className="font-semibold">Válido até:</span> {new Date(subscription.subscriptionEnd).toLocaleDateString('pt-BR')}</span></div>
              {STRIPE_PLANS[currentPlanKey].limits.ai_questions && (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  <span><span className="font-semibold">IA:</span> {isFinite(STRIPE_PLANS[currentPlanKey].limits.ai_questions_per_month) ? `${subscription.aiUsedThisMonth}/${STRIPE_PLANS[currentPlanKey].limits.ai_questions_per_month} usados este mês` : 'Ilimitado'}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderChangePassword = () => (
    <div className="max-w-lg space-y-6">
      <h2 className="text-2xl font-heading font-bold">Alterar Senha</h2>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Senha Antiga</Label>
            <Input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Senha Antiga" />
          </div>
          <div className="space-y-2">
            <Label>Senha Nova</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Senha Nova" />
          </div>
          <div className="space-y-2">
            <Label>Confirmação de Senha</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirmação de Senha" />
          </div>
          <Button onClick={changePassword}>Alterar</Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderContact = () => (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-heading font-bold">Mensagem de Contato</h2>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={profile?.full_name || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user?.email || ''} disabled className="bg-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assunto da Mensagem</Label>
            <Input value={contactSubject} onChange={e => setContactSubject(e.target.value)} placeholder="Assunto" />
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea value={contactMessage} onChange={e => setContactMessage(e.target.value)} placeholder="Digite aqui a sua mensagem..." rows={6} />
          </div>
          <Button onClick={sendContact}>Enviar Mensagem</Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderCreateQuiz = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-heading font-bold">Novo Questionário</h2>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        <Card>
          <CardHeader className="text-center"><CardTitle className="text-primary">Questionário</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Questionário</Label>
                <Input value={newQuizTitle} onChange={e => setNewQuizTitle(e.target.value)} placeholder="Nome" />
              </div>
              <div className="space-y-2">
                <Label>Quantidade de Alternativas por Questão</Label>
                <Select value={newQuizOptions} onValueChange={setNewQuizOptions}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-primary">
          <CardHeader><CardTitle className="text-sm">Ações</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2 text-destructive" onClick={() => setActiveView('my-quizzes')}>
              <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs">✕</span> Cancelar
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 text-success" onClick={createQuiz}>
              <span className="w-5 h-5 rounded-full bg-success text-success-foreground flex items-center justify-center text-xs">✓</span> Salvar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderMyQuizzes = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold">Meus Questionários</h2>
        <Badge variant="outline" className="text-lg font-heading">
          {isFinite(planLimits.maxQuizzes) ? `${quizzes.length}/${planLimits.maxQuizzes}` : quizzes.length}
        </Badge>
      </div>
      <div className="flex gap-3">
        <Button variant="link" className="text-primary px-0" onClick={() => {
          if (isFinite(planLimits.maxQuizzes) && quizzes.length >= planLimits.maxQuizzes) {
            planLimits.showUpgradeDialog('Questionários ilimitados');
            return;
          }
          setActiveView('create-quiz');
        }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Questionário
        </Button>
        <Button variant="link" className="px-0" onClick={() => {
          if (!planLimits.canUseAI) { planLimits.showUpgradeDialog('Geração de Questões com IA'); return; }
          if (planLimits.isAiLimitReached) { planLimits.showUpgradeDialog('IA Ilimitada'); return; }
          setAiQuizTitle(''); setAiFile(null); setShowAiDialog(true);
        }}>
          <Sparkles className="w-4 h-4 mr-1" /> Criar com IA
          {planLimits.canUseAI && isFinite(planLimits.aiLimit) && (
            <Badge variant="secondary" className="ml-1 text-xs">{planLimits.aiUsed}/{planLimits.aiLimit}</Badge>
          )}
        </Button>
      </div>
      <div className="flex gap-2 max-w-lg">
        <Input value={quizSearch} onChange={e => setQuizSearch(e.target.value)} placeholder="Buscar Questionário" />
        <Button size="icon" variant="default"><Search className="w-4 h-4" /></Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/10">
                <TableHead>Nome</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead>Status Questionário</TableHead>
                <TableHead className="text-center">Excluir</TableHead>
                <TableHead className="text-center">Editar</TableHead>
                <TableHead className="text-center">Aplicar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuizzes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum questionário encontrado.</TableCell></TableRow>
              ) : filteredQuizzes.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium text-primary cursor-pointer" onClick={() => openEditQuiz(q)}>{q.title}</TableCell>
                  <TableCell className="text-sm">{new Date(q.created_at).toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="text-sm">{getQuizStatus(q)}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => deleteQuiz(q.id)}><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => openEditQuiz(q)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => openQuizConfig(q)}>
                      <PlayCircle className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderEditQuiz = () => {
    if (!selectedQuiz) return null;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setActiveView('my-quizzes')}><ChevronRight className="w-4 h-4 rotate-180" /></Button>
          <div>
            <h2 className="text-2xl font-heading font-bold">{selectedQuiz.title}</h2>
            <p className="text-sm text-muted-foreground">{questions.length} questões iRAT/tRAT · {appQuestions.length} questões de aplicação</p>
          </div>
        </div>

        {/* Add Question Button - opens type choice */}
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowTypeChoice(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Questão
          </Button>
        </div>

        {/* Type Choice Dialog */}
        <Dialog open={showTypeChoice} onOpenChange={setShowTypeChoice}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-center text-lg font-heading">Tipo de Questão</DialogTitle>
              <DialogDescription className="text-center">Selecione o tipo de questão que deseja criar</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-4 py-4">
              <button
                onClick={() => { setShowTypeChoice(false); setAddQOpen(true); }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all"
              >
                <BookOpen className="w-10 h-10 text-primary" />
                <span className="font-semibold text-sm">iRAT / tRAT</span>
                <span className="text-xs text-muted-foreground text-center">Questão manual com gabarito</span>
              </button>
              <button
                onClick={() => { setShowTypeChoice(false); setAddAppQOpen(true); }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-orange-300/40 hover:border-orange-400 hover:bg-orange-50 transition-all"
              >
                <FileQuestion className="w-10 h-10 text-orange-500" />
                <span className="font-semibold text-sm">Aplicação</span>
                <span className="text-xs text-muted-foreground text-center">Questão V/F para aplicação</span>
              </button>
              <button
                onClick={() => { setShowTypeChoice(false); setAiImportFile(null); setShowAiImportDialog(true); }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-purple-300/40 hover:border-purple-400 hover:bg-purple-50 transition-all"
              >
                <Sparkles className="w-10 h-10 text-purple-500" />
                <span className="font-semibold text-sm">Criar com IA</span>
                <span className="text-xs text-muted-foreground text-center">Gerar questões a partir de material</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* iRAT/tRAT Question Dialog */}
        <Dialog open={addQOpen} onOpenChange={setAddQOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">Adicionar Questão iRAT/tRAT</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>Questão</Label>
                <Input value={qText} onChange={e => setQText(e.target.value)} placeholder="Digite sua questão..." />
              </div>
              {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                <div key={opt} className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <span>Opção {opt}</span>
                    {correct === opt && <span className="text-xs px-1.5 py-0.5 rounded bg-success text-success-foreground">Correta</span>}
                  </Label>
                  <div className="flex gap-2">
                    <Input className="flex-1" value={opt === 'A' ? optA : opt === 'B' ? optB : opt === 'C' ? optC : optD}
                      onChange={e => { const v = e.target.value; if (opt === 'A') setOptA(v); else if (opt === 'B') setOptB(v); else if (opt === 'C') setOptC(v); else setOptD(v); }}
                      placeholder={`Opção ${opt}`} />
                    <Button type="button" size="sm" variant={correct === opt ? 'default' : 'outline'} onClick={() => setCorrect(opt)}>✓</Button>
                  </div>
                </div>
              ))}
              <Button onClick={addQuestion} className="w-full">Adicionar Questão</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Application Question Dialog */}
        <Dialog open={addAppQOpen} onOpenChange={setAddAppQOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">Adicionar Questão de Aplicação (V/F)</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>Questão</Label>
                <Input value={appQText} onChange={e => setAppQText(e.target.value)} placeholder="Digite a questão de aplicação..." />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Gabarito: Resposta correta</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['V', 'F'] as const).map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAppCorrectAnswer(opt)}
                      className={`p-4 rounded-lg border-2 text-center font-bold transition-all ${
                        appCorrectAnswer === opt
                          ? opt === 'V' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      {opt === 'V' ? 'Verdadeiro' : 'Falso'}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={addAppQuestionToQuiz} className="w-full">Adicionar Questão</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* iRAT/tRAT Questions List */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b pb-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-heading font-semibold">Questões iRAT / tRAT</h3>
            <Badge variant="secondary" className="ml-auto">{questions.length}</Badge>
          </div>
          {questions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">Nenhuma questão iRAT/tRAT adicionada.</p>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <Card key={q.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium mb-2"><span className="text-muted-foreground mr-2">Q{i + 1}.</span>{q.question_text}</p>
                        <div className="grid grid-cols-2 gap-1 text-sm">
                          {(['A', 'B', 'C', 'D'] as const).map(opt => (
                            <span key={opt} className={`px-2 py-1 rounded ${q.correct_option === opt ? 'bg-success/10 text-success font-medium' : 'text-muted-foreground'}`}>
                              {opt}. {q[`option_${opt.toLowerCase()}` as keyof Question] as string}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Application Questions List */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b pb-2">
            <FileQuestion className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-heading font-semibold">Questões de Aplicação</h3>
            <Badge variant="secondary" className="ml-auto">{appQuestions.length}</Badge>
          </div>
          {appQuestions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">Nenhuma questão de aplicação adicionada.</p>
          ) : (
            <div className="space-y-3">
              {appQuestions.map((q: any, i: number) => (
                <Card key={q.id} className="border-l-4 border-l-orange-400">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium mb-2"><span className="text-muted-foreground mr-2">A{i + 1}.</span>{q.question_text}</p>
                        <p className="text-sm">
                          <span className="font-semibold">Gabarito: </span>
                          <span className={`font-bold ${q.correct_answer?.trim() === 'V' ? 'text-green-600' : q.correct_answer?.trim() === 'F' ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {q.correct_answer?.trim() === 'V' ? 'Verdadeiro' : q.correct_answer?.trim() === 'F' ? 'Falso' : 'Não definido'}
                          </span>
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteAppQuestionFromQuiz(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderReports = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-heading font-bold">Aplicações Finalizadas</h2>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/10">
                <TableHead>Questionário</TableHead>
                <TableHead>Aplicado</TableHead>
                <TableHead className="text-center">Resultados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finishedRooms.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhuma aplicação finalizada ainda.</TableCell></TableRow>
              ) : finishedRooms.map(room => {
                const quiz = quizzes.find(q => q.id === room.quiz_id);
                return (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{quiz?.title || room.name}</TableCell>
                    <TableCell className="text-sm">{new Date(room.created_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-4">
                        <Button variant="link" size="sm" className="gap-1" onClick={() => navigate(`/room/${room.id}/manage`)}>
                          <BarChart3 className="w-4 h-4" /> Final
                        </Button>
                        <Button variant="link" size="sm" className="gap-1" onClick={() => navigate(`/room/${room.id}/manage`)}>
                          <Settings2 className="w-4 h-4" /> Gerencial
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderTrash = () => {
    const allItems = [
      ...trashRooms.map((r: any) => ({ ...r, _type: 'room' as const, _name: r.name, _deleted: r.deleted_at })),
      ...trashQuizzes.map((q: any) => ({ ...q, _type: 'quiz' as const, _name: q.title, _deleted: q.deleted_at })),
      ...trashQuestions.map((q: any) => ({ ...q, _type: 'question' as const, _name: q.question_text?.substring(0, 80), _deleted: q.deleted_at })),
    ].sort((a, b) => new Date(b._deleted).getTime() - new Date(a._deleted).getTime());

    const filtered = trashTab === 'all' ? allItems :
      trashTab === 'rooms' ? allItems.filter(i => i._type === 'room') :
      trashTab === 'quizzes' ? allItems.filter(i => i._type === 'quiz') :
      allItems.filter(i => i._type === 'question');

    const typeLabel = { room: 'Sala', quiz: 'Questionário', question: 'Questão' };
    const typeColor = { room: 'bg-primary/10 text-primary', quiz: 'bg-warning/10 text-warning-foreground', question: 'bg-muted text-muted-foreground' };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-heading font-bold flex items-center gap-2"><Trash2 className="w-6 h-6" /> Lixeira</h2>
        <Tabs value={trashTab} onValueChange={setTrashTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">Tudo ({allItems.length})</TabsTrigger>
            <TabsTrigger value="rooms">Salas ({trashRooms.length})</TabsTrigger>
            <TabsTrigger value="quizzes">Questionários ({trashQuizzes.length})</TabsTrigger>
            <TabsTrigger value="questions">Questões ({trashQuestions.length})</TabsTrigger>
          </TabsList>
        </Tabs>
        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>A lixeira está vazia.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((item: any) => (
              <Card key={`${item._type}-${item.id}`}>
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge className={typeColor[item._type]}>{typeLabel[item._type]}</Badge>
                    <span className="font-medium truncate">{item._name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{new Date(item._deleted).toLocaleDateString('pt-BR')}</span>
                    <Button size="sm" variant="outline" onClick={() => restoreFromTrash(item._type, item.id)}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Restaurar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita. Todos os dados relacionados serão perdidos.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => permanentDelete(item._type, item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir Definitivamente
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAdminTeachers = () => {
    const admins = allTeachers.filter((t: any) => t.role === 'admin');
    const invited = allTeachers.filter((t: any) => t.role !== 'admin' && t.grantedBy);
    const selfRegistered = allTeachers.filter((t: any) => t.role !== 'admin' && !t.grantedBy);

    const renderTeacherTable = (list: any[], emptyMsg: string) => (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/10">
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">{emptyMsg}</TableCell></TableRow>
              ) : list.map((t: any) => (
                <TableRow key={t.id} className={t.is_blocked ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">
                    {t.full_name}
                    {t.role === 'admin' && <Badge className="ml-2 bg-primary text-primary-foreground text-xs">Admin</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.email || '—'}</TableCell>
                  <TableCell className="text-sm">{t.institution || '—'}</TableCell>
                  <TableCell className="text-sm">
                    <Badge variant={
                      t.manualPlan === 'institutional' ? 'default' :
                      t.manualPlan === 'pro' ? 'secondary' : 'outline'
                    } className={
                      t.manualPlan === 'institutional' ? 'bg-primary text-primary-foreground' :
                      t.manualPlan === 'pro' ? '' : 'text-muted-foreground'
                    }>
                      {t.manualPlan === 'institutional' ? 'Institucional' : t.manualPlan === 'pro' ? 'Pro' : 'Gratuito'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(t.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-center">
                    {t.is_blocked ? (
                      <Badge variant="destructive">Bloqueado</Badge>
                    ) : t.is_approved ? (
                      <Badge className="bg-green-100 text-green-800 border-green-300">Aprovado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-orange-600 border-orange-300">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {t.id !== user!.id && (
                      <div className="flex items-center justify-center gap-1">
                        {!t.is_approved && !t.is_blocked && (
                          <div className="flex items-center gap-1">
                            <Select value={approvalPlan} onValueChange={setApprovalPlan}>
                              <SelectTrigger className="w-[110px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">Gratuito</SelectItem>
                                <SelectItem value="pro">Pro</SelectItem>
                                <SelectItem value="institutional">Institucional</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => approveTeacher(t.id)}>
                              Aprovar
                            </Button>
                          </div>
                        )}
                        {t.grantedBy && (
                          <Button
                            size="sm" variant="outline"
                            className="text-primary border-primary/30 hover:bg-primary/10"
                            disabled={resendingInvite === t.email}
                            onClick={() => resendInvite(t.email, t.full_name, t.manualPlan || 'free')}
                            title="Reenviar convite"
                          >
                            {resendingInvite === t.email ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          </Button>
                        )}
                        {!t.is_blocked ? (
                          <Button size="sm" variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => blockTeacher(t.id, true)}>
                            Bloquear
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => blockTeacher(t.id, false)}>
                            Desbloquear
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => deleteTeacher(t.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-heading font-bold">Gerenciar Professores</h2>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button><Mail className="w-4 h-4 mr-2" /> Enviar Convite</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">Convidar Professor</DialogTitle>
                <DialogDescription>O convidado receberá um e-mail com link para cadastrar sua senha.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Nome do professor" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select value={invitePlan} onValueChange={setInvitePlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Gratuito</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="institutional">Institucional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={inviteTeacher} disabled={inviteLoading} className="w-full">
                  {inviteLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Enviar Convite
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Administradores */}
        <div className="space-y-3">
          <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" /> Administradores do Sistema
            <Badge variant="secondary" className="ml-1">{admins.length}</Badge>
          </h3>
          {renderTeacherTable(admins, 'Nenhum administrador encontrado.')}
        </div>

        <Separator />

        {/* Professores Convidados */}
        <div className="space-y-3">
          <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" /> Professores Convidados
            <Badge variant="secondary" className="ml-1">{invited.length}</Badge>
          </h3>
          {renderTeacherTable(invited, 'Nenhum professor convidado.')}
        </div>

        <Separator />

        {/* Professores Pagantes / Auto-cadastrados */}
        <div className="space-y-3">
          <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" /> Professores Pagantes / Auto-cadastrados
            <Badge variant="secondary" className="ml-1">{selfRegistered.length}</Badge>
          </h3>
          {renderTeacherTable(selfRegistered, 'Nenhum professor pagante/auto-cadastrado.')}
        </div>

        {/* Professores em Trial */}
        {trialTeachers.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Professores em Período de Teste
                <Badge variant="secondary" className="ml-1">{trialTeachers.length}</Badge>
              </h3>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/10">
                        <TableHead>E-mail</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Fim do Trial</TableHead>
                        <TableHead className="text-center">Dias Restantes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trialTeachers.map((t: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{t.email}</TableCell>
                          <TableCell>
                            <Badge variant={t.plan === 'Institucional' ? 'default' : 'secondary'}>
                              {t.plan}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {t.trial_end ? new Date(t.trial_end).toLocaleDateString('pt-BR') : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {t.days_remaining !== null ? (
                              <Badge variant={t.days_remaining <= 2 ? 'destructive' : 'outline'} className={t.days_remaining <= 2 ? '' : 'text-orange-600 border-orange-300'}>
                                {t.days_remaining} {t.days_remaining === 1 ? 'dia' : 'dias'}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderAdminSubscribers = () => {
    const nonStudents = adminSubscribers.filter((s: any) => s.role !== 'student');
    const students = adminSubscribers.filter((s: any) => s.role === 'student');

    // Group students by teacher
    const teacherProfiles = adminSubscribers.filter((s: any) => s.role === 'teacher' || s.role === 'admin');
    const studentsByTeacher: Record<string, any[]> = {};
    const unassignedStudents: any[] = [];

    students.forEach((s: any) => {
      if (s.teacherId) {
        if (!studentsByTeacher[s.teacherId]) studentsByTeacher[s.teacherId] = [];
        studentsByTeacher[s.teacherId].push(s);
      } else {
        unassignedStudents.push(s);
      }
    });

    const renderUserRow = (s: any) => (
      <TableRow key={s.id}>
        <TableCell className="font-medium">{s.full_name}</TableCell>
        <TableCell className="text-sm">{s.email || '—'}</TableCell>
        <TableCell className="text-sm">{s.institution || '—'}</TableCell>
        <TableCell className="text-center">
          <Select
            value={s.role}
            onValueChange={async (val) => {
              await supabase.from('user_roles').update({ role: val } as any).eq('user_id', s.id);
              toast.success('Cargo atualizado!');
              loadAdminSubscribers();
            }}
          >
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Aluno</SelectItem>
              <SelectItem value="teacher">Professor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-center">
          <Badge variant={s.manualPlan === 'institutional' ? 'default' : s.manualPlan === 'pro' ? 'secondary' : 'outline'}>
            {s.manualPlan === 'institutional' ? 'Institucional' : s.manualPlan === 'pro' ? 'Pro' : 'Gratuito'}
          </Badge>
        </TableCell>
        <TableCell className="text-sm">{new Date(s.created_at).toLocaleDateString('pt-BR')}</TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1">
            <Select
              value={s.manualPlan}
              onValueChange={async (val) => {
                await Promise.all([
                  supabase.from('manual_subscriptions').upsert({
                    user_id: s.id, plan: val, granted_by: user!.id,
                  } as any, { onConflict: 'user_id' }),
                  supabase.from('profiles').update({ is_approved: true } as any).eq('id', s.id),
                ]);
                toast.success('Plano atualizado!');
                loadAdminSubscribers();
              }}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Gratuito</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="institutional">Institucional</SelectItem>
              </SelectContent>
            </Select>
            {s.id !== user!.id && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setDeleteUserTarget({ id: s.id, name: s.full_name })}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );

    const tableHeader = (
      <TableHeader>
        <TableRow className="bg-primary/10">
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Instituição</TableHead>
          <TableHead className="text-center">Cargo</TableHead>
          <TableHead className="text-center">Plano</TableHead>
          <TableHead>Cadastro</TableHead>
          <TableHead className="text-center">Ações</TableHead>
        </TableRow>
      </TableHeader>
    );

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-heading font-bold">Usuários e Planos</h2>

        {/* Professores e Admins */}
        <div className="space-y-3">
          <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" /> Professores e Administradores
            <Badge variant="secondary" className="ml-1">{nonStudents.length}</Badge>
          </h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                {tableHeader}
                <TableBody>
                  {nonStudents.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum professor encontrado.</TableCell></TableRow>
                  ) : nonStudents.map(renderUserRow)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Students grouped by teacher */}
        <div className="space-y-3">
          <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" /> Alunos por Professor
            <Badge variant="secondary" className="ml-1">{students.length}</Badge>
          </h3>

          {teacherProfiles.filter((t: any) => studentsByTeacher[t.id]?.length > 0).map((teacher: any) => (
            <Collapsible key={teacher.id} defaultOpen>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        {teacher.full_name}
                        {teacher.institution && <span className="text-muted-foreground font-normal">— {teacher.institution}</span>}
                      </CardTitle>
                      <Badge variant="secondary">{studentsByTeacher[teacher.id].length} alunos</Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <Table>
                      {tableHeader}
                      <TableBody>
                        {studentsByTeacher[teacher.id].map(renderUserRow)}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}

          {unassignedStudents.length > 0 && (
            <Collapsible defaultOpen>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        Sem professor vinculado
                      </CardTitle>
                      <Badge variant="outline">{unassignedStudents.length} alunos</Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <Table>
                      {tableHeader}
                      <TableBody>
                        {unassignedStudents.map(renderUserRow)}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {students.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum aluno encontrado.</CardContent></Card>
          )}
        </div>

        {/* Delete User Confirmation Dialog */}
        <AlertDialog open={!!deleteUserTarget} onOpenChange={(open) => { if (!open) setDeleteUserTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir <strong>{deleteUserTarget?.name}</strong>? Esta ação é irreversível e removerá todas as informações deste usuário do sistema (respostas, participações, salas, questionários, etc).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteUserLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteUserLoading}
                onClick={() => deleteUserTarget && deleteFullUser(deleteUserTarget.id)}
              >
                {deleteUserLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Excluir Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  };

  const renderInstitution = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Minha Instituição
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie os professores vinculados ao seu plano Institucional. Cada professor adicionado recebe acesso <Badge variant="secondary" className="ml-1">Pro</Badge>
          </p>
        </div>
      </div>

      {/* Institution name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5" /> Nome da Instituição
          </CardTitle>
          <CardDescription>Defina o nome da sua instituição. Ele será aplicado automaticamente a todos os professores vinculados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Instituição</Label>
              <Input value={instName} onChange={e => setInstName(e.target.value)} placeholder="Ex: Universidade Federal..." />
            </div>
            <Button onClick={saveInstitutionName} disabled={instNameSaving}>
              {instNameSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Dialog open={instInviteOpen} onOpenChange={setInstInviteOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="w-4 h-4 mr-2" /> Convidar Novo Professor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Novo Professor</DialogTitle>
              <DialogDescription>O professor receberá um e-mail com link para criar sua senha e já terá acesso Pro vinculado à sua instituição.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Nome completo</Label>
                <Input value={instInviteName} onChange={e => setInstInviteName(e.target.value)} placeholder="Nome do professor" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={instInviteEmail} onChange={e => setInstInviteEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
              </div>
              <Button onClick={handleInstitutionInvite} disabled={instInviteLoading} className="w-full">
                {instInviteLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Enviar Convite
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline"><Search className="w-4 h-4 mr-2" /> Vincular Professor Existente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vincular Professor Existente</DialogTitle>
              <DialogDescription>Informe o e-mail de um professor já cadastrado na plataforma para vinculá-lo à sua instituição com acesso Pro.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>E-mail do professor</Label>
                <Input value={instLinkEmail} onChange={e => setInstLinkEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
              </div>
              <Button onClick={handleInstitutionLink} disabled={instLinkLoading} className="w-full">
                {instLinkLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                Vincular Professor
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Teacher list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" /> Professores Vinculados
            <Badge variant="secondary">{institutionTeachers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {institutionTeachers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhum professor vinculado ainda.</p>
              <p className="text-sm">Use os botões acima para convidar ou vincular professores.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10">
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead className="text-center">Plano</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {institutionTeachers.map((t: any) => (
                  <TableRow key={t.user_id}>
                    <TableCell className="font-medium">{t.full_name}</TableCell>
                    <TableCell className="text-sm">{t.email}</TableCell>
                    <TableCell className="text-sm">{t.institution || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">Pro</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className="text-primary hover:text-primary"
                          disabled={resendingInvite === t.email}
                          onClick={() => resendInvite(t.email, t.full_name, 'pro')}
                          title="Reenviar convite"
                        >
                          {resendingInvite === t.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover professor?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O professor <strong>{t.full_name}</strong> perderá o acesso Pro e voltará para o plano Gratuito.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleInstitutionRemove(t.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>ℹ️ Importante:</strong> Os professores vinculados recebem acesso Pro automaticamente. 
            Caso seu plano Institucional seja cancelado, todos os professores vinculados voltarão ao plano Gratuito.
          </p>
        </CardContent>
      </Card>
    </div>
  );


  const renderQuizConfig = () => {
    if (!configQuiz) return null;
    const indPct = parseInt(individualPct) || 0;
    const tmPct = parseInt(teamPct) || 0;
    const appPct = parseInt(applicationPct) || 0;
    const totalPct = indPct + tmPct + appPct;
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl font-heading font-bold text-center">Questionário: {configQuiz.title}</h2>
        <Card>
          <CardHeader className="text-center"><CardTitle className="flex items-center justify-center gap-2"><FileText className="w-5 h-5" /> Informativos da Prova</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold">Nota Máxima</Label>
              <Input value={maxGrade} onChange={e => setMaxGrade(e.target.value)} placeholder="Nota máxima do questionário" />
            </div>
            <Separator />
            <p className="text-sm font-semibold text-center">Composição da Nota</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold text-xs">% Individual (iRAT)</Label>
                <Input value={individualPct} onChange={e => setIndividualPct(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-xs">% Equipe (tRAT)</Label>
                <Input value={teamPct} onChange={e => setTeamPct(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-xs">% Aplicação</Label>
                <Input value={applicationPct} onChange={e => setApplicationPct(e.target.value)} />
              </div>
            </div>
            <p className={`text-xs text-center ${totalPct !== 100 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
              Total: {totalPct}% — A soma deve ser 100%.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex-1">Exibir <strong>questionário com gabarito</strong> aos estudantes no relatório final</Label>
              <Switch checked={showAnswers} onCheckedChange={setShowAnswers} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex-1">Exibir na prova em equipe, as respostas selecionadas pelos membros da equipe da <strong>aplicação individual</strong></Label>
              <Switch checked={showIndividualInTeam} onCheckedChange={setShowIndividualInTeam} />
            </div>
          </CardContent>
        </Card>
        <Button onClick={launchQuiz} className="w-full py-6 text-lg" disabled={totalPct !== 100}>Iniciar</Button>
      </div>
    );
  };

  // ==================== SIDEBAR & LAYOUT ====================

  return (
    <>
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-sidebar-border">
          <div className="p-4 border-b border-sidebar-border">
            <h1 className="text-xl font-heading font-bold text-sidebar-foreground">TBL Virtual</h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile?.full_name}</p>
          </div>
          <SidebarContent>
            {/* Início */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('dashboard')} isActive={activeView === 'dashboard'} className="cursor-pointer">
                      <LayoutDashboard className="w-4 h-4" /><span>Início</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Área do Professor */}
            <SidebarGroup>
              <SidebarGroupLabel>Área do Professor</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('personal-data')} isActive={activeView === 'personal-data'} className="cursor-pointer">
                      <UserCircle className="w-4 h-4" /><span>Dados Pessoais</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('my-plan')} isActive={activeView === 'my-plan'} className="cursor-pointer">
                      <Crown className="w-4 h-4" /><span>Meu Plano</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('change-password')} isActive={activeView === 'change-password'} className="cursor-pointer">
                      <Lock className="w-4 h-4" /><span>Alterar Senha</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('contact')} isActive={activeView === 'contact'} className="cursor-pointer">
                      <Mail className="w-4 h-4" /><span>Entrar em Contato</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Área de Questionários */}
            <SidebarGroup>
              <SidebarGroupLabel>Área de Questionários</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Collapsible open={quizSubOpen} onOpenChange={setQuizSubOpen}>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="cursor-pointer w-full" isActive={activeView === 'create-quiz' || activeView === 'my-quizzes' || activeView === 'edit-quiz'}>
                          <BookOpen className="w-4 h-4" /><span className="flex-1 text-left">Questionários</span>
                          <ChevronDown className={`w-3 h-3 transition-transform ${quizSubOpen ? 'rotate-180' : ''}`} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenu className="pl-6 mt-1 space-y-0.5">
                          <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => {
                              if (isFinite(planLimits.maxQuizzes) && quizzes.length >= planLimits.maxQuizzes) {
                                planLimits.showUpgradeDialog('Questionários ilimitados');
                                return;
                              }
                              setActiveView('create-quiz');
                            }} isActive={activeView === 'create-quiz'} className="cursor-pointer text-sm">
                              <span>Criar Questionário</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => setActiveView('my-quizzes')} isActive={activeView === 'my-quizzes' || activeView === 'edit-quiz'} className="cursor-pointer text-sm">
                              <span>Meus Questionários</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </SidebarMenu>
                      </CollapsibleContent>
                    </Collapsible>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('rooms')} isActive={activeView === 'rooms'} className="cursor-pointer">
                      <Users className="w-4 h-4" /><span>Salas</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('reports')} isActive={activeView === 'reports'} className="cursor-pointer">
                      <BarChart3 className="w-4 h-4" /><span>Relatórios</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('analytics')} isActive={activeView === 'analytics'} className="cursor-pointer">
                      <TrendingUp className="w-4 h-4" /><span>Analytics</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('classes')} isActive={activeView === 'classes'} className="cursor-pointer">
                      <GraduationCap className="w-4 h-4" /><span>Turmas</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('question-bank')} isActive={activeView === 'question-bank'} className="cursor-pointer">
                      <Globe className="w-4 h-4" /><span>Banco de Questões</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveView('trash')} isActive={activeView === 'trash'} className="cursor-pointer">
                      <Trash2 className="w-4 h-4" /><span>Lixeira</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Institutional */}
            {isInstitutionalPlan && !isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Minha Instituição</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setActiveView('institution')} isActive={activeView === 'institution'} className="cursor-pointer">
                        <Building2 className="w-4 h-4" /><span>Gerenciar Professores</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Administração</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                       <SidebarMenuButton onClick={() => setActiveView('admin-teachers')} isActive={activeView === 'admin-teachers'} className="cursor-pointer">
                         <Users className="w-4 h-4" /><span>Professores</span>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                     <SidebarMenuItem>
                       <SidebarMenuButton onClick={() => setActiveView('admin-api-keys')} isActive={activeView === 'admin-api-keys'} className="cursor-pointer">
                         <Key className="w-4 h-4" /><span>API Keys IA</span>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                     <SidebarMenuItem>
                       <SidebarMenuButton onClick={() => setActiveView('admin-subscribers')} isActive={activeView === 'admin-subscribers'} className="cursor-pointer">
                         <CreditCard className="w-4 h-4" /><span>Usuários e Planos</span>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                     <SidebarMenuItem>
                       <SidebarMenuButton onClick={() => setActiveView('pipeline')} isActive={activeView === 'pipeline'} className="cursor-pointer">
                         <Rocket className="w-4 h-4" /><span>Pipeline</span>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                   </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            <SidebarGroup>
              <SidebarGroupLabel>Conta</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => { signOut(); navigate('/'); }} className="cursor-pointer text-destructive hover:text-destructive">
                      <LogOut className="w-4 h-4" /><span>Sair</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b bg-card h-14 flex items-center px-4 gap-3 shrink-0" role="banner">
            <SidebarTrigger aria-label={t('a11y.openMenu')} />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <AccessibilityMenu />
              <UserCircle className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">{profile?.full_name}</span>
            </div>
          </header>

          <main id="main-content" className="flex-1 p-6 overflow-y-auto" role="main" aria-label={t('a11y.mainContent')}>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : (
              <>
                {activeView === 'dashboard' && renderDashboard()}
                {activeView === 'rooms' && renderRooms()}
                {activeView === 'personal-data' && renderPersonalData()}
                {activeView === 'my-plan' && renderMyPlan()}
                {activeView === 'change-password' && renderChangePassword()}
                {activeView === 'contact' && renderContact()}
                {activeView === 'create-quiz' && renderCreateQuiz()}
                {activeView === 'my-quizzes' && renderMyQuizzes()}
                {activeView === 'edit-quiz' && renderEditQuiz()}
                {activeView === 'reports' && renderReports()}
                {activeView === 'quiz-config' && renderQuizConfig()}
                {activeView === 'analytics' && user && (
                  planLimits.canViewDetailedReports
                    ? <AnalyticsDashboard userId={user.id} canExport={planLimits.canExportCSV} onUpgradeNeeded={planLimits.showUpgradeDialog} />
                    : <div className="text-center py-12 space-y-4">
                        <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
                        <p className="text-muted-foreground">Analytics detalhados estão disponíveis nos planos Pro e Institucional.</p>
                        <Button onClick={() => planLimits.showUpgradeDialog('Relatórios Detalhados')}><Crown className="w-4 h-4 mr-1" /> Fazer Upgrade</Button>
                      </div>
                )}
                {activeView === 'classes' && user && <ClassManagement userId={user.id} />}
                {activeView === 'question-bank' && user && <QuestionBank userId={user.id} />}
                {activeView === 'admin-teachers' && isAdmin && renderAdminTeachers()}
                {activeView === 'admin-api-keys' && isAdmin && <AdminApiKeys />}
                {activeView === 'admin-subscribers' && isAdmin && renderAdminSubscribers()}
                {activeView === 'institution' && isInstitutionalPlan && renderInstitution()}
                {activeView === 'trash' && renderTrash()}
                {activeView === 'pipeline' && isAdmin && <SystemUpdates />}
              </>
            )}
          </main>
        </div>
      </div>
      {isAdmin && <PipelineNotification onNavigate={() => setActiveView('pipeline')} />}
    </SidebarProvider>

    {/* AI Create New Quiz Dialog */}
    <Dialog open={showAiDialog} onOpenChange={v => { if (!aiLoading) setShowAiDialog(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Criar Questionário com IA
          </DialogTitle>
          <DialogDescription>
            Envie um material de apoio e a IA criará 10 questões iRAT/tRAT e 3 casos clínicos de aplicação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome do Questionário</Label>
            <Input value={aiQuizTitle} onChange={e => setAiQuizTitle(e.target.value)} placeholder="Ex: Farmacologia - Antibióticos" disabled={aiLoading} />
          </div>
          <div className="space-y-2">
            <Label>Material de Apoio</Label>
            <input ref={aiFileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" className="hidden" onChange={e => setAiFile(e.target.files?.[0] || null)} />
            <div onClick={() => !aiLoading && aiFileInputRef.current?.click()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${aiFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'} ${aiLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              {aiFile ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                  <p className="font-medium">{aiFile.name}</p>
                  <p className="text-sm text-muted-foreground">{(aiFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Clique para selecionar um arquivo</p>
                  <p className="text-xs text-muted-foreground">PDF, Word, PowerPoint ou TXT</p>
                </div>
              )}
            </div>
          </div>
          {aiLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Analisando material e gerando questões... Isso pode levar até 1 minuto.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowAiDialog(false)} disabled={aiLoading}>Cancelar</Button>
          <Button onClick={generateWithAI} disabled={aiLoading || !aiFile || !aiQuizTitle.trim()}>
            {aiLoading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</> : <><Sparkles className="w-4 h-4 mr-1" /> Gerar Questões</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* AI Import into Existing Quiz Dialog */}
    <Dialog open={showAiImportDialog} onOpenChange={v => { if (!aiImportLoading) setShowAiImportDialog(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" /> Gerar Questões com IA
          </DialogTitle>
          <DialogDescription>
            Envie um material de apoio e a IA criará 10 questões iRAT/tRAT e 3 casos clínicos de aplicação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Material de Apoio</Label>
            <input ref={aiImportFileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" className="hidden" onChange={e => setAiImportFile(e.target.files?.[0] || null)} />
            <div onClick={() => !aiImportLoading && aiImportFileInputRef.current?.click()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${aiImportFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'} ${aiImportLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              {aiImportFile ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                  <p className="font-medium">{aiImportFile.name}</p>
                  <p className="text-sm text-muted-foreground">{(aiImportFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Clique para selecionar um arquivo</p>
                  <p className="text-xs text-muted-foreground">PDF, Word, PowerPoint ou TXT</p>
                </div>
              )}
            </div>
          </div>
          {aiImportLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Analisando material e gerando questões... Isso pode levar até 1 minuto.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowAiImportDialog(false)} disabled={aiImportLoading}>Cancelar</Button>
          <Button onClick={generateForExistingQuiz} disabled={aiImportLoading || !aiImportFile}>
            {aiImportLoading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</> : <><Sparkles className="w-4 h-4 mr-1" /> Gerar Questões</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Upgrade Dialog */}
    <UpgradeDialog
      open={planLimits.upgradeOpen}
      onOpenChange={planLimits.closeUpgradeDialog}
      feature={planLimits.upgradeFeature}
      currentPlan={planLimits.currentPlan as any}
    />
    </>
  );
}
