// Fonte única da fórmula de notas do TBL.
// Usada pelo Relatório Final da sala (TeacherRoomManage) e pelo Boletim Consolidado (ClassManagement).

export type RoomScoringConfig = {
  individual_pct?: number | null;
  team_pct?: number | null;
  application_pct?: number | null;
  max_grade?: number | string | null;
};

export type RoomScoringInput = {
  room: RoomScoringConfig;
  /** user_ids dos participantes da sala */
  participantIds: string[];
  /** questões do quiz da sala (iRAT/tRAT) */
  questions: any[];
  /** salas só consideram times com membros */
  teams: any[]; // { id, team_members: [{ user_id }] }
  iratResponses: any[];
  tratAttempts: any[];
  appeals: any[];
  appQuestions: any[];
  appResponses: any[];
};

export type StudentScore = {
  studentId: string;
  teamId: string | null;
  teamName: string | null;
  iratRaw: number;
  tratRaw: number;
  appRaw: number;
  iratGrade: number;
  tratGrade: number;
  appGrade: number;
  finalGrade: number;
};

const ATTEMPT_POINTS = [4, 2, 1, 0];

const isAppAnswerCorrect = (correct: string, selected: string) =>
  (correct === 'V' && selected === 'A') ||
  (correct === 'F' && selected === 'B') ||
  (correct === 'A' && selected === 'A') ||
  (correct === 'B' && selected === 'B') ||
  (correct === 'C' && selected === 'C') ||
  (correct === 'D' && selected === 'D');

export function computeRoomScores(input: RoomScoringInput): StudentScore[] {
  const { room, participantIds, questions, teams, iratResponses, tratAttempts, appeals, appQuestions, appResponses } = input;

  const iratPct = (room.individual_pct ?? 30) / 100;
  const tratPct = (room.team_pct ?? 40) / 100;
  const appPct = (room.application_pct ?? 30) / 100;
  const maxGrade = parseFloat(String(room.max_grade)) || 10;

  const maxIratScore = questions.length * 4;
  const maxTratScore = questions.length * 4;
  const maxAppScore = appQuestions.length > 0 ? appQuestions.length : 1;

  return participantIds.map(studentId => {
    const iratRaw = iratResponses
      .filter(r => r.student_id === studentId)
      .reduce((sum, r) => sum + r.score, 0);

    const team = teams.find(t => (t.team_members || []).some((m: any) => m.user_id === studentId));
    const teamId: string | null = team?.id ?? null;

    let tratRaw = 0;
    if (teamId) {
      const teamAttempts = tratAttempts.filter(a => a.team_id === teamId && a.is_correct);
      tratRaw = teamAttempts.reduce((sum, a) => sum + ATTEMPT_POINTS[a.attempt_number - 1], 0);

      // Recurso aceito: pontuação cheia (4) menos o que a equipe já recebeu na questão
      appeals
        .filter(ap => ap.team_id === teamId && ap.status === 'accepted')
        .forEach(ap => {
          const existing = tratAttempts.find(a => a.team_id === teamId && a.question_id === ap.question_id && a.is_correct);
          const existingScore = existing ? ATTEMPT_POINTS[existing.attempt_number - 1] : 0;
          tratRaw += 4 - existingScore;
        });
    }

    let appRaw = 0;
    if (teamId && appQuestions.length > 0) {
      appRaw = appQuestions.filter(q =>
        appResponses.some(r => r.question_id === q.id && r.team_id === teamId && isAppAnswerCorrect(q.correct_answer, r.selected_option))
      ).length;
    }

    const iratBase = maxIratScore > 0 ? (iratRaw / maxIratScore) * maxGrade : 0;
    const tratBase = maxTratScore > 0 ? (tratRaw / maxTratScore) * maxGrade : 0;
    const appBase = maxAppScore > 0 ? (appRaw / maxAppScore) * maxGrade : 0;

    const iratGrade = iratBase * iratPct;
    const tratGrade = tratBase * tratPct;
    const appGrade = appBase * appPct;

    return {
      studentId, teamId, teamName: team?.name ?? null,
      iratRaw, tratRaw, appRaw,
      iratGrade, tratGrade, appGrade,
      finalGrade: iratGrade + tratGrade + appGrade,
    };
  });
}
