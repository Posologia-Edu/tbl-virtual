

## Diagnóstico: Por que o e-mail de convite não chega

### Causa raiz encontrada

O usuário `sergiofernandesaraujo@hotmail.com` **já existia** no banco de dados quando o convite foi enviado (provavelmente de um cadastro anterior). 

No código da Edge Function `send-invite-teacher` (linha 76-82), quando o perfil já existe, a função **apenas aprova o perfil e vincula à instituição, mas NÃO envia nenhum e-mail**. O envio de e-mail só acontece no bloco `else` (linhas 83-171), que é executado apenas para **usuários novos**.

Os logs confirmam isso:
```
[INVITE] User already exists: 4ac286ec-..., linking to institution
```

Isso também afeta o botão "Reenviar convite", que chama a mesma função e cai no mesmo branch sem envio.

**Problema secundário**: a resposta do `fetch` para o Resend não é verificada, então erros silenciosos de envio passam despercebidos.

---

## Plano de correção

### 1. Reestruturar a Edge Function `send-invite-teacher`

Mover a lógica de envio de e-mail para **fora** do bloco condicional `if/else`, para que seja executada tanto para usuários novos quanto existentes:

- Para **usuários existentes**: gerar um link de recuperação e enviar o e-mail de convite (mesmo template)
- Para **usuários novos**: manter o fluxo atual (criar usuário + gerar link + enviar e-mail)
- Adicionar **verificação da resposta** do Resend (`res.ok`, `res.status`) e logar erros detalhados
- Adicionar log do corpo da resposta do Resend para diagnóstico

### Estrutura proposta:

```text
1. Autenticar chamador (admin ou institucional)
2. Verificar se usuário já existe
   ├─ SIM: aprovar perfil, obter userId
   └─ NÃO: criar usuário, inserir perfil e role, obter userId
3. Gerar link de recuperação (SEMPRE)
4. Enviar e-mail via Resend (SEMPRE)
5. Verificar resposta do Resend e logar resultado
6. Gravar manual_subscriptions
7. Retornar sucesso
```

### 2. Validar domínio Resend

Verificar se o domínio `tbl.posologia.app` está efetivamente verificado no Resend. Se não estiver, o envio falhará silenciosamente. A correção de logs acima ajudará a diagnosticar isso.

---

### Detalhes técnicos

**Arquivo alterado**: `supabase/functions/send-invite-teacher/index.ts`

Mudanças principais:
- Extrair o bloco de geração de link + envio de e-mail para depois do `if/else` de existência do usuário
- Sempre gerar `recoveryUrl` via `supabase.auth.admin.generateLink({ type: "recovery" })`
- Capturar e logar `await res.json()` da resposta do Resend
- Adicionar `if (!res.ok)` com log de erro detalhado

Nenhuma alteração no frontend necessária -- o `resendInvite` já chama a mesma função, que passará a funcionar para ambos os casos.

