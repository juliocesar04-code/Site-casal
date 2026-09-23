# Relatório de segurança

Versão avaliada: branch `main` em 23 de setembro de 2026.

## Escopo

- Código da aplicação (`src/`), migrations e funções do banco (`supabase/`), configuração de headers e CSP.
- Banco do projeto Supabase `relicario` (políticas, grants, triggers, bucket, jobs agendados).
- Aplicação rodando localmente em modo de produção (`next build && next start`).

Fora do escopo desta rodada: ambiente de staging com credenciais reais (não existe ainda), infraestrutura interna do Supabase, Vercel e Mercado Pago, e testes de carga.

## Metodologia

1. Modelo de ameaças antes da implementação ([docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)).
2. Revisão manual do código com foco ofensivo: IDOR, escalonamento, injeção, upload, pagamento, corrida, enumeração, vazamento de erro.
3. Suíte SQL executada contra um Postgres descartável com os papéis do Supabase (`anon`, `authenticated`, `service_role`, `supabase_auth_admin`) e dois usuários, A e B: 140 verificações cobrindo acesso horizontal, colunas protegidas, imutabilidade para todos os papéis, idempotência de pagamento, crédito, agendamento, colaboração, respostas, exclusão e permissões em sessões novas.
4. Testes unitários (43) de parser de mídia, reprocessamento de imagem, assinatura de webhook, tickets, tokens, redirect, normalização de texto, CSP e snapshot. Parte deles foi validada por mutação: o código foi quebrado de propósito para confirmar que o teste falha.
5. Testes E2E (32 executados) contra a aplicação em produção local: headers reais, nonce por requisição, rotas privadas sem cache e sem indexação, respostas idênticas para links inexistentes e maliciosos, redirecionamento aberto, CSRF por origem, cron e webhook sem credencial, violações de CSP no navegador.
6. Análise estática: TypeScript strict e ESLint com regras que proíbem `any`, `dangerouslySetInnerHTML` e leitura de `process.env` fora do módulo de configuração.
7. Dependências: `npm audit` sem vulnerabilidades conhecidas.
8. Secrets: gitleaks no histórico Git completo e na árvore de trabalho, sem achados. Bundles do navegador conferidos: nenhuma chave presente.
9. Advisors de segurança do Supabase revisados.

## Achados

| # | Achado | Severidade | Situação |
|---|--------|------------|----------|
| F1 | Funções do schema `private` criadas depois do `revoke` herdavam `EXECUTE` para `PUBLIC`. Um usuário autenticado com acesso SQL conseguiria chamar o gerador de snapshot de qualquer memória. Pela API REST o schema não era exposto, o que limitava a exploração. | Média | Corrigido: revogação global do privilégio padrão. Teste "A cannot call private helpers through SQL". |
| F2 | Triggers de integridade chamavam helpers sem permissão para `service_role` e `supabase_auth_admin`. Os testes passavam por causa do cache de plano do PL/pgSQL na mesma sessão. Em produção, uploads, publicação pelo webhook e exclusão de conta falhariam. | Alta (disponibilidade de fluxos críticos) | Corrigido: grants explícitos por papel. Novo teste com uma conexão por papel, confirmado falhando antes da correção. |
| F3 | Se o processamento do webhook falhasse depois de registrar o evento, a nova tentativa do Mercado Pago seria descartada como duplicada e o pagamento aprovado não publicaria a memória. | Alta (pagamento sem entrega) | Corrigido: só eventos com resultado gravado são ignorados. |
| F4 | Segundo pagamento aprovado para uma memória já paga (dois checkouts) ou pagamento de memória excluída eram aceitos em silêncio, sem sinal para estorno. | Média | Corrigido: evento `payment_needs_refund`. Testes reproduziram a falha antes da correção. |
| F5 | Duas páginas eram pré-renderizadas estaticamente, sem nonce, e os scripts delas seriam bloqueados pela CSP. | Baixa (funcional) | Corrigido: renderização dinâmica no layout raiz. |
| F6 | A regex que remove caracteres de controle e de direção de texto estava gravada com os caracteres literais, invisíveis numa revisão. | Informativa | Corrigido: sequências de escape explícitas. Varredura confirmou que não há caracteres invisíveis no projeto. |
| F7 | A lista de marcas aceitas em MP4 não tinha teste; remover a checagem passava despercebido. | Informativa | Corrigido: teste adicionado e validado por mutação. |

## Controles verificados

- **Acesso horizontal:** o usuário A não lê, altera nem exclui memórias, capítulos, mídia, contribuições, links, respostas ou pagamentos do B, nem pela aplicação nem pela API REST direta.
- **Imutabilidade:** título, mensagem, tema, data, snapshot, hash, capítulos, mídia e contribuições de uma memória publicada recusam alteração do dono e do `service_role`. Adulteração direta nas linhas é detectada pelo recálculo do hash.
- **Pagamento:** preço definido no servidor, valor conferido no retorno do provider, webhook com HMAC, consulta ao provider como fonte da verdade, idempotência, rejeição tardia não rebaixa aprovação.
- **Agendamento:** antes da data, o banco não devolve o conteúdo; mudar o relógio do aparelho não tem efeito.
- **Upload:** tipo por assinatura binária, imagem reprocessada (remove EXIF, GPS e dados anexados), limite de pixels, MP4 validado por estrutura, caminho gerado no servidor, bucket privado sem políticas de cliente.
- **Enumeração:** slugs de 14 caracteres base62 e tokens de 22, tokens guardados como hash, 404 idêntico para inexistente, rascunho, excluído e malformado, rate limit nas rotas públicas.
- **Sessão e CSRF:** cookies `HttpOnly`, `Secure` e `SameSite=Lax`, validação do JWT no servidor a cada requisição, checagem de origem nas rotas que alteram estado, Server Actions com checagem nativa do Next.js.
- **Headers:** CSP com nonce e `strict-dynamic`, `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, sem `X-Powered-By`.
- **Erros:** respostas genéricas; nenhuma resposta testada expôs stack, SQL, caminho interno ou credencial.

## Riscos residuais

- `style-src-attr 'unsafe-inline'` é necessário para estilos em atributo aplicados pelo React e pela biblioteca de animação. Scripts e elementos `<style>` continuam presos ao nonce.
- Vídeos não são reencodados no servidor. A validação estrutural, a origem separada do storage e a reprodução apenas por `<video>` reduzem o risco.
- Os arquivos no storage têm checksum registrado no snapshot, mas não há verificação automática periódica dos bytes. Uma substituição direta no storage exigiria a chave secreta.
- Três funções `security definer` são chamáveis por usuários autenticados (`submit_for_payment`, `return_to_draft`, `delete_memory`). É intencional: cada uma resolve o dono por `auth.uid()` e os testes cobrem a tentativa sobre recursos de outro usuário.
- O rate limit usa janela fixa e confia em `x-forwarded-for`, o que é correto na Vercel e precisa ser revisto em outra hospedagem.
- Quem recebe o link pode repassá-lo. Isso é parte do produto e está explicado ao usuário.

## Limitações

- Os testes de autorização E2E com dois usuários reais (`tests/e2e/authorization.spec.ts`) estão prontos, mas não foram executados: dependem de contas de teste num ambiente de staging.
- Não houve DAST contra um ambiente implantado. A aplicação local não tinha a chave secreta do Supabase, então fluxos que dependem dela (upload, publicação, respostas) foram validados pela suíte SQL e por testes unitários, não de ponta a ponta.
- A configuração do Supabase Auth (URLs, templates, SMTP, proteção contra senhas vazadas) é manual e está listada em [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Conclusão

Nenhuma vulnerabilidade explorável conhecida foi identificada dentro do escopo e da metodologia utilizados, após as correções e os retestes. Antes do lançamento público, é necessário executar os testes de autorização E2E e um DAST contra staging, com as mesmas regras de correção e reteste.
