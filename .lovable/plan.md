

## Plano de Implementação

Este plano cobre 5 problemas/funcionalidades distintas:

### 1. tRAT começa pela questão 10 em vez da questão 1

**Causa:** Na `StudentRoomView.tsx`, o Realtime listener (linha 464) faz `setCurrentQ(0)` e `setAppCurrentQ(0)` ao receber uma mudança de stage. Porém, as questões são carregadas via `sort_order` e o `currentQ` pode não ser resetado corretamente ao iniciar o tRAT porque o `renderTrat()` verifica se `hasStarted` e pula para `renderTratAnswering()` que usa `currentQ`, que pode estar apontando para o último índice do iRAT.

**Correção:** Garantir que `setCurrentQ(0)` é chamado explicitamente quando `current_stage` muda para `trat_open` ou `application_open`. Adicionar um `useEffect` dedicado que reseta `currentQ` sempre que `room.current_stage` muda.

---

### 2. Fase de Aplicação de Conceitos: Alunos ficam com animação e não veem questões

**Causa:** O `renderApplication()` na `StudentRoomView.tsx` carrega `appQuestions` via `loadAppData()`, mas esse load depende de `membership` existir. Se o load ocorre antes da membership estar pronta, as questões ficam vazias. Além disso, o fluxo atual permite que o aluno navegue livremente entre as questões, mas o novo requisito é que o professor controle qual questão é exibida.

**Correção:** Refatorar completamente a fase de aplicação para ser controlada pelo professor:
- Adicionar `current_app_question_index` e `app_alternatives_released` na tabela `rooms` (migration)
- O professor avança questão por questão e libera alternativas via botões no painel
- Os alunos só veem a questão atual e as alternativas ficam desabilitadas até o professor liberar

---

### 3. Painel do professor na fase de aplicação: controle questão a questão

**Novo fluxo no `TeacherRoomManage.tsx` (`renderAppMonitoring`):**
- Exibir apenas a questão atual (baseada em `current_app_question_index`)
- Botão "Liberar Alternativas" que seta `app_alternatives_released = true` na room
- Quando o primeiro grupo responde, iniciar janela de 1 segundo
- Após 1s, alternativas ficam desabilitadas novamente e `app_alternatives_released = false`
- Botão "Próxima Questão" incrementa `current_app_question_index` e reseta `app_alternatives_released`
- Exibir respostas dos grupos em tempo real (V/F com cores verde/vermelho)
- Quando todas as questões terminarem, exibir botão "Liberar Relatórios"

---

### 4. Captura simultânea de respostas (janela de 1 segundo)

**Lógica no `StudentRoomView.tsx`:**
- Alternativas desabilitadas por padrão
- Quando `app_alternatives_released = true` (via Realtime), habilitar V/F
- Ao submeter, a resposta é enviada normalmente
- O professor vê em tempo real quem respondeu
- Após 1s do primeiro grupo, o professor seta `app_alternatives_released = false` (pode ser automático via edge function ou pelo frontend do professor ao detectar a primeira resposta)

**Implementação simplificada:** O professor libera as alternativas, os grupos respondem, e a lógica de janela de 1s será gerenciada no frontend do professor: ao detectar a primeira `application_response` para a questão atual, iniciar um timer de 1s e depois setar `app_alternatives_released = false` automaticamente.

---

### 5. Botão "Liberar Relatórios" e envio de email ao final

**No `TeacherRoomManage.tsx`:**
- Quando todas as questões de aplicação terminarem, exibir botão "Liberar Relatórios"
- Ao clicar, avançar para `finished` e acionar o envio de emails via `send-report-email`
- O relatório já existe e funciona; apenas ajustar o trigger para que ocorra no momento correto

---

### Migration SQL necessária

```sql
ALTER TABLE public.rooms 
  ADD COLUMN IF NOT EXISTS current_app_question_index integer DEFAULT 0;
ALTER TABLE public.rooms 
  ADD COLUMN IF NOT EXISTS app_alternatives_released boolean DEFAULT false;
```

---

### Resumo de Arquivos Modificados

| Arquivo | Alterações |
|---------|-----------|
| `TeacherRoomManage.tsx` | Refatorar `renderAppMonitoring` com controle questão-a-questão, botão liberar alternativas, janela 1s, botão liberar relatórios |
| `StudentRoomView.tsx` | Reset `currentQ` na troca de stage; refatorar `renderApplication` para seguir questão controlada pelo professor com alternativas desabilitáveis |
| Migration SQL | Adicionar `current_app_question_index` e `app_alternatives_released` à tabela `rooms` |
| `types.ts` | Atualizado automaticamente pela migration |

