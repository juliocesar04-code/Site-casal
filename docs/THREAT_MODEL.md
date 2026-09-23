# Modelo de ameaças

Documento vivo. Revisar a cada funcionalidade que cria nova entrada de dados, novo papel ou nova integração.

## Ativos

| Ativo | Por que importa |
|-------|-----------------|
| Contas e sessões | acesso a rascunhos, pagamentos e exclusão |
| Conteúdo das memórias (texto, fotos, vídeos) | privado e emocionalmente sensível |
| `public_slug` | quem tem o link vê a memória |
| Tokens de colaboração | permitem enviar conteúdo para uma memória |
| Respostas do destinatário | privadas, só o dono lê |
| Estado de pagamento | decide se algo é publicado |
| `content_hash` e snapshot | garantem que o publicado não mudou |
| Service role do Supabase, access token e segredo de webhook do Mercado Pago | comprometimento total |

## Atores

- **Visitante anônimo**: landing, páginas legais, memórias por link.
- **Destinatário**: abre a memória e pode responder, sem conta.
- **Colaborador**: tem apenas o token de colaboração, sem conta.
- **Usuário autenticado**: cria e gerencia as próprias memórias.
- **Mercado Pago**: envia webhooks.
- **Atacante**: qualquer um dos anteriores agindo de má-fé, incluindo um usuário autenticado tentando acessar dados de outro.

## Fronteiras de confiança

1. Navegador → Next.js: toda entrada é hostil.
2. Next.js → Supabase com o JWT do usuário: RLS é a última barreira.
3. Next.js → Supabase com service role: só em `src/server`, só nos casos listados na arquitetura.
4. Mercado Pago → webhook: só vale depois da assinatura e da consulta ao provider.
5. Navegador → Storage: só com URL assinada de uso único para caminho escolhido pelo servidor.
6. PostgREST exposto publicamente: um atacante pode chamar a API do Supabase diretamente com a chave pública. As políticas precisam resistir a isso sem depender do Next.js.

## Pontos de entrada

Server Actions (auth, criador, painel), `POST /api/uploads`, `POST /api/uploads/{id}/complete`, `POST /api/webhooks/mercadopago`, `GET /m/{slug}`, `POST /m/{slug}/responder`, `GET|POST /contribuir/{token}`, `POST /api/analytics`, `GET /api/cron/*`, callbacks de auth e a API REST do Supabase.

## Ameaças e controles

| # | Ameaça | Controle | Teste |
|---|--------|----------|-------|
| T1 | IDOR: usuário A lê ou altera memória, mídia, contribuição ou resposta de B | RLS por `auth.uid()` em todas as tabelas; serviços sempre buscam pelo par (id, dono); storage sem políticas cliente | `supabase/tests/rls.sql`, E2E A/B |
| T2 | Alterar memória publicada | RLS exige `draft`; triggers de congelamento para qualquer papel; hash e snapshot | `supabase/tests/immutability.sql` |
| T3 | Publicar sem pagar | `publish_memory` exige pagamento aprovado; só service role executa; status do cliente ignorado | `supabase/tests/publishing.sql`, unit do webhook |
| T4 | Falsificar webhook ou reenviar evento | HMAC com segredo, janela de tempo, `payment_events` único, consulta ao provider, conferência de valor e referência | `tests/unit/webhook.test.ts` |
| T5 | Alterar preço | preço resolvido no servidor a partir do catálogo; valor conferido no retorno do provider | unit + E2E |
| T6 | Upload malicioso (polyglot, HTML, SVG, executável, bomba de descompressão) | allowlist por magic bytes, reencode de imagem, limite de pixels, MP4 validado por parser, caminho gerado no servidor, `Content-Type` fixo, bucket privado em outra origem | `tests/unit/media-*.test.ts` |
| T7 | Enumeração de links e tokens | slug de 14 caracteres base62 (~83 bits), token de 22 (~131 bits), token guardado como hash, respostas idênticas para inexistente, excluído e rascunho | unit + E2E |
| T8 | Acesso antes da data agendada | checagem com `now()` do banco dentro de `get_public_memory`; conteúdo nem sai do banco | `supabase/tests/publishing.sql` |
| T9 | XSS armazenado | React escapa texto; sem `dangerouslySetInnerHTML` com dados de usuário; CSP com nonce | lint + revisão |
| T10 | CSRF | Server Actions com checagem de origem; `assertSameOrigin` nos route handlers; cookies `SameSite=Lax` | unit |
| T11 | Força bruta e enumeração de contas | rate limit por IP e e-mail; mensagens genéricas; limites nativos do Supabase Auth | unit do rate limit |
| T12 | Open redirect | `safeRedirectPath` aceita apenas caminhos relativos internos | unit |
| T13 | Vazamento de segredo | nada com `NEXT_PUBLIC_`; `server-only`; validação de env; gitleaks no CI | CI |
| T14 | Condição de corrida (webhook duplo, publicar e excluir juntos) | `for update` na memória e no pagamento; transições validadas por trigger; idempotência | `supabase/tests/publishing.sql` |
| T15 | Abuso de endpoints públicos (spam de contribuições e respostas) | rate limit, limites por memória, tamanho máximo | unit |
| T16 | Clickjacking | `frame-ancestors 'none'` | checagem de headers |
| T17 | Exposição de erros | `error.tsx` genérico; logs sem stack no cliente; mensagens de API padronizadas | E2E |
| T18 | Link de exclusão reaproveitado | memória excluída vira tombstone sem conteúdo; slug responde igual a inexistente; mídia apagada do storage | `supabase/tests/deletion.sql` |
| T19 | Vazamento por Referer ou cache | `Referrer-Policy: no-referrer` e `no-store` nas memórias; `noindex` | checagem de headers |
| T20 | SSRF | nenhuma funcionalidade busca URL fornecida por usuário; o único destino externo é a API do Mercado Pago, fixa no código | revisão |

## Riscos aceitos

- `style-src` permite `'unsafe-inline'` porque o Next.js e a biblioteca de animação aplicam estilos inline. Scripts continuam restritos por nonce.
- Vídeos não são reencodados no servidor (sem ffmpeg em ambiente serverless). O risco é mitigado por validação estrutural, bucket em origem separada, `Content-Type` fixo e reprodução só via `<video>`.
- Quem tem o link de uma memória publicada pode repassá-lo. Isso faz parte do produto e está explicado na interface.
