
# Revisao Completa de UX e Fluxos do TBL Virtual

## Resumo da Avaliacao

Apos analisar todos os fluxos do sistema, identifiquei **15 problemas** organizados por severidade. A plataforma tem uma base solida, mas existem falhas de UX que podem confundir usuarios e comprometer a experiencia.

---

## PROBLEMAS CRITICOS (Impacto Alto)

### 1. Dois caminhos de entrada para estudantes com comportamentos diferentes
- A Landing Page tem um dialogo rapido (nome + codigo de 6 caracteres) que cria um email efemero `roomCode_timestamp@student.tbl`
- A pagina `/join` tem um fluxo completo de 2 etapas (codigo da sala > nome + registro + email real)
- O dialogo da Landing valida codigo de 6 caracteres alfanumerico, mas o `/join` aceita apenas numeros (`replace(/\D/g, '')`)
- **Solucao**: Unificar a entrada do estudante. Remover o dialogo da Landing e direcionar sempre para `/join`, que tem o fluxo mais completo e seguro.

### 2. Ausencia de "Esqueci minha senha"
- Nenhum dos fluxos de autenticacao (AuthDialog, AuthPage) possui opcao de recuperacao de senha
- Professores que esquecerem a senha ficam sem acesso
- **Solucao**: Adicionar link "Esqueci minha senha" nos formularios de login, com pagina `/reset-password` dedicada

### 3. Signup nao redireciona para dashboard
- No `AuthDialog`, apos signup bem-sucedido, o dialogo apenas fecha (`onOpenChange(false)`) sem redirecionar para `/dashboard`
- No `AuthPage`, apos signup, faz `return` sem navegar
- O professor cria a conta e fica "perdido" na mesma pagina
- **Solucao**: Apos signup, exibir mensagem clara sobre aprovacao pendente ou redirecionar para `/dashboard` (que mostrara a tela de "Cadastro em Analise")

### 4. Google OAuth nao atribui role de professor
- O fluxo de Google Sign-In nao passa `data: { role: 'teacher' }` nos metadados
- Usuarios que se cadastram via Google podem ficar sem role definido, causando comportamento imprevisivel no `DashboardRouter`
- **Solucao**: Configurar os metadados do Google OAuth ou criar um trigger no banco que atribui role default

---

## PROBLEMAS MODERADOS (Impacto Medio)

### 5. Pagina /auth duplicada e sem uso claro
- Existe `AuthPage.tsx` (pagina completa) e `AuthDialog.tsx` (modal na Landing)
- A rota `/auth` e referenciada na PricingPage para redirecionar usuarios nao logados
- Mas o fluxo principal da Landing usa o AuthDialog
- **Solucao**: Decidir por um unico ponto de autenticacao. Recomendo manter o AuthDialog como principal e fazer `/auth` redirecionar para Landing com o dialog aberto

### 6. PricingPage - Botao "Plano Atual" sempre no plano Gratuito
- O botao do plano gratuito sempre diz "Plano Atual" independentemente do plano real do usuario
- Nao ha indicacao visual de qual plano o usuario realmente assina
- **Solucao**: Comparar com `subscription.plan` do contexto de auth e marcar o plano correto como ativo

### 7. Checkout abre em nova aba
- `window.open(data.url, '_blank')` abre o Stripe Checkout em nova aba
- Isso quebra o fluxo e pode ser bloqueado por pop-up blockers
- **Solucao**: Usar `window.location.href = data.url` para redirecionar na mesma aba

### 8. Menu lateral - "Meu Plano" e "Planos" sao confusos
- Ha dois itens consecutivos: "Meu Plano" (view interna) e "Planos" (navega para `/pricing`)
- O usuario pode nao entender a diferenca
- **Solucao**: Combinar em uma unica secao "Meu Plano" que mostra o plano atual + link para upgrade, ou renomear "Planos" para "Fazer Upgrade"

### 9. Nenhum onboarding pos-cadastro para professor
- Apos ser aprovado, o professor cai direto no dashboard vazio sem orientacao
- Nao ha tutorial, wizard, ou dicas contextuais
- **Solucao**: Adicionar um wizard de boas-vindas com 3-4 passos (criar primeiro questionario, entender as fases, criar sala)

### 10. TeacherDashboard e um arquivo monolitico de 1645 linhas
- Toda a logica do dashboard, formularios, estado e renderizacao esta em um unico arquivo
- Isso nao e diretamente um problema de UX, mas dificulta manutencao e pode causar lentidao
- **Solucao**: Extrair cada view (renderDashboard, renderRooms, etc.) em componentes separados

---

## PROBLEMAS MENORES (Impacto Baixo)

### 11. Reconexao de estudante tem fluxo quebrado
- Na `/join`, o botao "Reconectar com codigo de participante" chama `handleCodeSubmit()` que, se o usuario ja estiver logado, redireciona direto, caso contrario vai para `step='info'` (novo participante), nunca para `step='reconnect'`
- O step `reconnect` existe no JSX mas nao ha caminho de navegacao que leve ate ele
- **Solucao**: Corrigir o fluxo para que o botao de reconexao leve ao step correto

### 12. Falta feedback visual na tela de "Cadastro em Analise"
- A tela e estatica, sem nenhuma acao alem de "Sair"
- Nao informa se um email sera enviado ou estimativa de tempo
- **Solucao**: Adicionar informacoes mais claras, como "Voce recebera um email em seu-email@..." e um botao para verificar status

### 13. Loading state generico
- As telas de loading mostram apenas texto "Carregando..." sem skeleton ou indicador visual
- **Solucao**: Usar skeleton loaders para uma experiencia mais fluida

### 14. Navbar da Landing tem botoes "Entrar" duplicados
- Existe "Entrar" no dropdown "Professor" E um botao "Entrar" separado no canto direito
- **Solucao**: Remover a duplicacao, manter apenas os botoes do canto direito

### 15. Acessibilidade do link "Estudante" no mobile menu da Landing
- No menu mobile, o link "Estudante" navega para `/join`, mas nao tem icone ou indicacao visual de que e para estudantes
- **Solucao**: Adicionar icone e label mais descritivo

---

## Detalhes Tecnicos da Implementacao

### Prioridade 1 - Criticos (estimativa: 4-5 prompts)
1. Unificar entrada de estudante: remover dialogo da Landing, ajustar botao "Sou Estudante" para navegar a `/join`
2. Adicionar "Esqueci minha senha" + pagina `/reset-password`
3. Corrigir redirecionamento pos-signup (navegar para `/dashboard`)
4. Corrigir Google OAuth para incluir role nos metadados

### Prioridade 2 - Moderados (estimativa: 3-4 prompts)
5. Resolver duplicacao AuthPage vs AuthDialog
6. Corrigir PricingPage para mostrar plano ativo real
7. Mudar checkout para mesma aba (`location.href`)
8. Simplificar menu lateral (unificar "Meu Plano" e "Planos")
9. Criar wizard de onboarding pos-aprovacao

### Prioridade 3 - Menores (estimativa: 2-3 prompts)
10. Corrigir fluxo de reconexao do estudante
11. Melhorar tela de "Cadastro em Analise"
12. Adicionar skeleton loaders
13. Limpar duplicacao de botoes na navbar

---

## Ordem de Execucao Recomendada

1. Correcoes criticas de autenticacao (itens 2, 3, 4)
2. Unificacao do fluxo de entrada do estudante (item 1)
3. PricingPage e checkout (itens 6, 7)
4. Simplificacao do menu lateral (item 8)
5. Onboarding wizard (item 9)
6. Polimentos visuais (itens 11, 12, 13, 14)
