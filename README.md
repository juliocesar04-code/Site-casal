# Relicário

Plataforma para criar memórias digitais privadas: uma pessoa monta uma experiência com texto, fotos, vídeos curtos, capítulos e linha do tempo, paga uma vez, publica e entrega por link, QR Code ou numa data marcada. Depois de publicada, a memória fica selada e não pode ser alterada por ninguém.

## Stack

Next.js 16 (App Router, React 19) · TypeScript strict · Tailwind CSS 4 · Motion · Supabase (Postgres, Auth, Storage, pg_cron) · Mercado Pago · Zod · Vercel

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | visão geral, pastas, máquina de estados, imutabilidade, pagamentos, uploads |
| [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) | ativos, atores, fronteiras de confiança, ameaças e controles |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | configuração de Supabase, Mercado Pago e Vercel, ambientes e checklist de release |
| [docs/INCIDENT_RESPONSE.md](docs/INCIDENT_RESPONSE.md) | procedimento mínimo para incidentes |
| [SECURITY_REPORT.md](SECURITY_REPORT.md) | escopo, metodologia, achados, correções e riscos residuais |

## Rodando localmente

Requisitos: Node 22+, e um projeto Supabase de desenvolvimento (nunca o de produção).

```bash
npm ci
cp .env.example .env.local   # preencha com credenciais de desenvolvimento
npm run dev
```

As migrations ficam em `supabase/migrations` e são aplicadas em ordem no projeto de desenvolvimento.

## Testes

```bash
npm run lint        # ESLint, incluindo regras contra dangerouslySetInnerHTML e process.env fora de env.ts
npm run typecheck
npm test            # unitários: mídia, assinatura de webhook, redirects, tokens, CSP, snapshot
npm run test:db     # RLS e imutabilidade contra um Postgres descartável, com usuários A e B
npm run test:e2e    # Playwright; os testes de autorização A/B exigem E2E_USER_A_* e E2E_USER_B_*
```

`npm run test:db` usa `TEST_DATABASE_URL` quando definido; sem ele, sobe um cluster local temporário com os binários do Postgres instalados.

## Estrutura

```
src/app          rotas: site, auth, painel, experiência pública (/m), colaboração, API
src/components   UI: experiência, editor, painel, site
src/domain       regras puras: estados, modelos, temas, snapshot, catálogo
src/lib          i18n, validação, utilitários sem I/O
src/server       código só de servidor: auth, db, serviços, pagamentos, storage, mídia, segurança
supabase         migrations e suíte SQL de segurança
tests            unitários e E2E
```

## Princípios

- O navegador nunca recebe chave do Supabase. Toda leitura e escrita passa pelo servidor.
- Identidade, preço, status de pagamento e horário de liberação são decididos no servidor ou no banco.
- Conteúdo publicado é imutável por trigger no banco, para qualquer papel.
- Textos de usuário são sempre renderizados como texto.
