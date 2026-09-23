# Arquitetura

## Visão geral

Relicário é uma aplicação Next.js (App Router) hospedada na Vercel, com Supabase como banco (Postgres), autenticação e storage. Mercado Pago processa pagamentos.

```
Navegador ──HTTPS──▶ Vercel (Next.js)
                      ├─ Server Components / Server Actions / Route Handlers
                      ├─ proxy.ts: sessão, CSP com nonce, headers
                      └─ server/ (único lugar com credenciais)
                            ├─ Supabase (cliente do usuário, RLS aplicada)
                            ├─ Supabase (service role, uso restrito)
                            └─ Mercado Pago API
Mercado Pago ──webhook assinado──▶ /api/webhooks/mercadopago
Upload direto ──URL assinada de uso único──▶ Supabase Storage (bucket privado)
```

O navegador nunca recebe chave do Supabase. Todas as leituras e escritas passam pelo servidor Next.js. Upload é a única exceção de tráfego direto, e usa uma URL assinada que o servidor gera para um caminho que ele mesmo escolhe.

## Estrutura de pastas

```
src/
  app/                  rotas (UI e route handlers)
    (site)/             landing, privacidade, termos, segurança
    (auth)/             entrar, criar conta, recuperar e redefinir senha
    auth/               callbacks de OAuth e confirmação de e-mail
    painel/             dashboard e criador (autenticado)
    m/[slug]/           experiência pública e cartão imprimível
    contribuir/[token]/ envio de contribuições
    api/                uploads, webhooks, cron, analytics
  components/           UI compartilhada
  domain/               regras puras: máquina de estados, templates, temas, snapshot
  lib/                  validação (Zod), i18n, utilitários sem I/O
  server/               código que só roda no servidor ("server-only")
    auth/               sessão e usuário atual
    db/                 clientes Supabase (usuário e admin)
    repositories/       acesso a dados
    services/           casos de uso (memórias, mídia, publicação, colaboração)
    payments/           abstração de provider + Mercado Pago
    storage/            buckets, caminhos, URLs assinadas
    media/              inspeção de arquivos, reprocessamento de imagem, parser MP4
    security/           rate limit, origem, logs de segurança, tokens
    notifications/      caixa de saída e envio de e-mail
    analytics/          eventos sem dados pessoais
supabase/
  migrations/           schema, RLS, triggers e funções
  tests/                testes de RLS e imutabilidade (usuários A e B)
tests/                  unitários (Vitest) e E2E (Playwright)
```

## Máquina de estados da memória

```
             ┌──────────── return_to_draft ────────────┐
             ▼                                         │
 draft ──submit_for_payment──▶ awaiting_payment ──webhook aprovado──▶ paid
   │                                   │                               │
   │ (crédito já pago)                 └──────────────┬────────────────┘
   └──────────────────────────────────────────────────┤ publish_memory
                                                      ▼
                                   release_at > agora? ──sim──▶ scheduled ──cron──▶ published
                                                      └─não──▶ published
 qualquer estado ──delete_memory──▶ deleted (terminal)
```

- O conteúdo só é editável em `draft`. A partir de `awaiting_payment` ele está congelado, porque o que foi revisado é o que será pago.
- Voltar para `draft` durante o checkout é permitido. Se o pagamento for aprovado depois disso, ele vira crédito da memória (`paid_payment_id`) e a próxima publicação não cobra de novo.
- `scheduled` e `published` diferem apenas na data. O acesso público sempre compara `release_at` com o relógio do banco, então um atraso do cron nunca libera conteúdo antes da hora.
- As transições são validadas por trigger no banco (`memories_enforce_transition`). Transições inválidas geram erro mesmo com service role.

## Imutabilidade

Aplicada em três camadas:

1. **Serviço**: a camada `services/` recusa escrita em memória que não esteja em `draft`.
2. **RLS**: políticas de `update`, `insert` e `delete` nas tabelas de conteúdo exigem `status = 'draft'` na memória dona.
3. **Triggers**: `memories_freeze_content` e `children_freeze` bloqueiam qualquer alteração de conteúdo quando a memória não é rascunho, independente do papel (inclui service role). A única saída é a exclusão, que transforma a linha em tombstone.

Colunas de controle (`owner_id`, `status`, `public_slug`, `content_hash`, `content_snapshot`, `published_at`, `paid_payment_id`, `deleted_at`) só mudam por funções `security definer` do próprio banco.

## Publicação e integridade

`publish_memory(memory_id, payment_id)` roda numa transação com `select … for update` na memória:

1. valida o estado e o pagamento aprovado vinculado;
2. trava contribuições pendentes (`locked`);
3. monta `content_snapshot` (jsonb) com todo o conteúdo em ordem determinística;
4. calcula `content_hash = sha256(snapshot::text)` com pgcrypto;
5. define `published_at` e o estado (`scheduled` ou `published`).

O `jsonb` do Postgres normaliza a ordem das chaves, o que torna a serialização canônica. A página pública renderiza a partir do snapshot, e `verify_memory_integrity` recalcula o hash tanto do snapshot guardado quanto das linhas atuais para detectar adulteração.

## Pagamentos

```
cliente escolhe "Publicar"          (envia só memory_id)
  └─ servidor resolve preço do catálogo (R$ 9,99, em centavos)
  └─ cria payments (status created) e preferência no Mercado Pago
       external_reference = payments.id, notification_url fixa
  └─ redireciona ao checkout (Pix ou cartão)
Mercado Pago ──▶ webhook
  └─ valida x-signature (HMAC-SHA256, janela de tempo)
  └─ registra evento em payment_events (chave única → idempotência)
  └─ consulta GET /v1/payments/{id} no provider (fonte da verdade)
  └─ confere external_reference, valor, moeda e status
  └─ transação: payments.status = approved → publish_memory
```

O retorno do navegador (`back_urls`) nunca aprova nada, só mostra o estado atual. O provider fica atrás da interface `PaymentProvider`, então adicionar outro é implementar `createCheckout` e `fetchPayment`.

## Uploads

1. O cliente pede um slot (`POST /api/uploads`) informando tipo e tamanho declarados.
2. O servidor valida sessão, dono, estado `draft`, allowlist de tipos, tamanho e cota por memória. Cria `memory_media` com status `pending` e caminho gerado no servidor (`{memory_id}/{media_id}/source`), e devolve uma URL assinada de upload.
3. O cliente envia o arquivo direto ao storage.
4. O cliente chama `POST /api/uploads/{id}/complete`. O servidor baixa o objeto e:
   - verifica assinatura binária (magic bytes), ignorando extensão e MIME do navegador;
   - imagens: decodifica e reencoda com sharp para WebP, aplica rotação EXIF, remove metadados (inclui GPS), limita pixels e gera miniatura;
   - vídeos: aceita só MP4/MOV, lê a caixa `mvhd` para obter a duração real e rejeita acima do limite;
   - calcula SHA-256, grava os derivados com `Content-Type` fixo e apaga o original.
5. Arquivos rejeitados são removidos e o evento vai para `security_events`.

O bucket é privado e sem políticas para `anon` ou `authenticated`. Leitura acontece só por URL assinada de curta duração, gerada depois da checagem de autorização.

## Colaboração

- O dono gera um link `/contribuir/{token}` com 128 bits de entropia. O banco guarda apenas `sha256(token)`.
- O link pode ter prazo, ser revogado e regenerado. Não expõe o ID da memória nem dá acesso ao conteúdo dela.
- Contribuições entram como `pending`. O dono aprova ou rejeita enquanto a memória é rascunho. Na publicação, as pendentes viram `locked` e só as aprovadas entram no snapshot.
- Rate limit por IP e por link, limite de contribuições por memória e limite de tamanho.

## Agendamento

`release_at` é opcional. A função `get_public_memory(slug)` devolve apenas metadados de abertura (remetente, destinatário e data de liberação) enquanto `now() < release_at`. O conteúdo e as URLs de mídia só são gerados depois. Um job `pg_cron` a cada minuto move `scheduled → published` e cria a notificação.

## Autenticação e sessão

- Supabase Auth com e-mail e senha (confirmação por e-mail) e Google OAuth.
- Sessão em cookies `HttpOnly`, `Secure` e `SameSite=Lax` via `@supabase/ssr`. Nada sensível em `localStorage`.
- Login, cadastro e recuperação passam por Server Actions com rate limit por IP e e-mail, e respostas que não revelam se a conta existe.
- Redirecionamentos pós-login só aceitam caminhos relativos internos.

## Segurança transversal

- **CSP** com nonce por requisição, `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`.
- **Headers**: HSTS com preload, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
- **CSRF**: Server Actions têm checagem de origem do Next.js. Route handlers que alteram estado chamam `assertSameOrigin`. Webhook usa assinatura.
- **Rate limit**: tabela `rate_limits` com função atômica no Postgres, chaves por IP (hash com sal), usuário e endpoint.
- **Logs**: `security_events` e `event_logs` estruturados, sem conteúdo privado, tokens ou IP em claro.
- **Memórias públicas**: `noindex`, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`.

## Ambientes

| Ambiente    | Supabase                      | Mercado Pago          |
|-------------|-------------------------------|-----------------------|
| development | projeto local ou de dev       | credenciais de teste  |
| preview     | projeto de staging            | credenciais de teste  |
| production  | projeto `relicario`           | credenciais de produção |

Variáveis de ambiente são validadas na inicialização (`src/server/env.ts`). Nenhuma credencial usa prefixo `NEXT_PUBLIC_`.

## Evoluções previstas

O modelo já acomoda música e áudio (`memory_media.kind`), novos templates (tabela `templates` + registro em `domain/templates`), outros idiomas (`lib/i18n`), outros providers de pagamento (`PaymentProvider`), planos (`payments.product_id` + catálogo) e cápsulas do tempo (`release_at`).
