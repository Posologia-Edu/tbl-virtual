

## Plano: Correção de Realtime na Aplicação de Conceitos + Cálculo de Relatório

### Problema 1: Realtime não funciona na fase de aplicação (StudentRoomView.tsx)

**Causa raiz:** O Realtime listener na linha 474 faz `setRoom(newRoom)`, e o `renderApplication()` lê `room?.current_app_question_index` e `room?.app_alternatives_released`. O `setRoom` deveria atualizar o render. **Porém**, o `loadAppData()` (que carrega `appQuestions`) só é chamado no `useEffect` da linha 351 quando `room?.current_stage` muda — mas `current_app_question_index` e `app_alternatives_released` mudam **sem** mudar o stage.

Além disso, `appQuestions` é carregado uma vez quando o stage muda para `application_open`, mas se o load falha (membership não pronta), fica vazio e nunca é recarregado.

**Correção:**
1. Adicionar um `useEffect` que recarrega `appQuestions` quando `room?.current_stage === 'application_open'` e `membership` muda (para cobrir o caso em que membership carrega depois).
2. O Realtime listener já faz `setRoom(newRoom)` que deveria atualizar o render. Verificar se o `Room` type inclui os campos `current_app_question_index` e `app_alternatives_released` — **já inclui** (linhas 44-45). Então o render deve atualizar. O problema real é que **o polling de 3s faz `loadRoom()` que faz um SELECT e `setRoom(data)`**. Isso deveria funcionar.

**Diagnóstico adicional:** Na linha 489, há um listener para `application_questions` que chama `loadAppData()`. Mas o primeiro load de `appQuestions` depende de `membership` existir. Se `membership` é null quando `application_open` começa, `loadAppData` retorna questões mas sem respostas. Mais importante: se o listener Realtime NÃO dispara (problema conhecido do Supabase Realtime com filters), o polling só atualiza `room` (via `loadRoom`), mas **não** chama `loadAppData()`.

**Solução definitiva:** Adicionar um `useEffect` que roda `loadAppData()` quando o stage é `application_open` E `membership` existe, reagindo a mudanças no `room?.current_app_question_index`. Isso garante que mesmo sem Realtime, o polling (que atualiza `room`) vai triggerar o reload de app questions e responses.

### Problema 2: Alternativas não habilitam em tempo real

**Causa:** `alternativesReleased` é lido de `room?.app_alternatives_released`. Quando o professor seta `app_alternatives_released = true`, o Realtime deveria atualizar `room` no student. Se o Realtime falha, o polling de 3s (via `loadRoom`) deveria pegar. **O render já usa `room?.app_alternatives_released`**, então deveria funcionar.

**Problema real provável:** O Realtime do Supabase pode não estar disparando para a table `rooms` com o filter `id=eq.${roomId}`. Vou garantir que o polling de 3s cubra esse caso e que o componente re-renderize corretamente.

**Solução:** Reduzir o polling para 2s na fase de aplicação (onde a sincronização precisa ser rápida) e garantir que `loadAppData` também é chamado pelo polling quando na fase de aplicação.

### Problema 3: Questões não avançam em tempo real

**Mesma causa:** `current_app_question_index` vem de `room`, que é atualizado via Realtime/polling. Se room atualiza, o render atualiza. O polling deveria cobrir. Vou confirmar que o polling está funcionando e adicionar reload de app data quando o index muda.

### Problema 4: Cálculo de relatório errado

**Causa no frontend (linha 1176-1181):**
```javascript
appRawScore = appQuestions.filter(q =>
  appResponses.some((r: any) => r.question_id === q.id && r.team_id === teamId)
).length;
```
Isso conta questões com **qualquer** resposta, não apenas corretas. Um grupo que errou 2 de 3 questões recebe `appRaw = 3`.

**Correção:** Filtrar por respostas corretas, similar ao edge function (linha 69):
```javascript
appRawScore = appQuestions.filter(q =>
  appResponses.some((r: any) => r.question_id === q.id && r.team_id === teamId && (
    (q.correct_answer === 'V' && r.selected_option === 'A') || 
    (q.correct_answer === 'F' && r.selected_option === 'B') ||
    (q.correct_answer === 'A' && r.selected_option === 'A') ||
    (q.correct_answer === 'B' && r.selected_option === 'B')
  ))
).length;
```

**Verificação da fórmula de nota:** Com nota máxima 10, pesos 30/40/30:
- `iratGrade = (iratRaw / maxIrat) * 10` → até 10
- `finalGrade = iratGrade * 0.3 + tratGrade * 0.4 + appGrade * 0.3` → até 10
  
Isso está correto. Ex: aluno acertou 60% no iRAT → `(0.6 * 10) * 0.3 = 1.8`. Correto.

O problema é só o `appRawScore` que não filtra por acertos.

### Alterações por arquivo

| Arquivo | Alteração |
|---------|-----------|
| `StudentRoomView.tsx` | 1. Adicionar `useEffect` que recarrega `loadAppData` quando `room?.current_app_question_index` muda na fase de aplicação. 2. Melhorar polling: chamar `loadAppData` durante `application_open`. 3. Reduzir polling para 2s na fase de aplicação. |
| `TeacherRoomManage.tsx` | Corrigir `appRawScore` no `computeStudentReport` para contar apenas respostas corretas. |
| `send-report-email/index.ts` | Já está correto (filtra por acertos na linha 69). Nenhuma mudança. |

