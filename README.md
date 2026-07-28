# TBL Virtual

Plataforma digital para Team-Based Learning (TBL): iRAT, tRAT e atividades de aplicação com turmas, em tempo real.

## Rodando localmente

Requisitos: Node.js e npm ([instalar via nvm](https://github.com/nvm-sh/nvm#installing-and-updating)).

```sh
# Clone o repositório
git clone https://github.com/Posologia-Edu/tbl-virtual.git
cd tbl-virtual

# Instale as dependências
npm install

# Copie o .env de exemplo e preencha as variáveis do Supabase
cp .env .env.local # ou configure diretamente o .env

# Suba o servidor de desenvolvimento
npm run dev
```

## Stack

- Vite + React + TypeScript
- shadcn/ui + Tailwind CSS
- Supabase (Postgres, Auth, Realtime, Edge Functions)

## Deploy

O frontend é hospedado no **Cloudflare Pages**, com deploy automático a cada push na branch `main` (integração Git nativa do Cloudflare Pages). Comando de build: `npm run build`; diretório de saída: `dist`.

As Edge Functions (`supabase/functions/`) são deployadas separadamente via Supabase CLI:

```sh
npx supabase functions deploy <nome-da-function> --project-ref hqrugxoyezoizjkiskcv
```

Migrações de banco ficam em `supabase/migrations/` e são aplicadas via `npx supabase db query --linked -f <arquivo>.sql`.
