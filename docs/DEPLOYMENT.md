# Deploy

## Ambientes

| Ambiente | Onde | Supabase | Mercado Pago |
|----------|------|----------|--------------|
| development | máquina local | projeto de desenvolvimento | credenciais de teste |
| preview | deploys de branch na Vercel | projeto de staging | credenciais de teste |
| production | domínio principal | projeto `relicario` | credenciais de produção |

Dados reais de clientes nunca são copiados para development ou preview.

## 1. Supabase

As migrations de `supabase/migrations` já foram aplicadas no projeto `relicario` (região São Paulo). Para um novo ambiente, aplique-as em ordem.

No painel do projeto:

1. **Authentication > URL Configuration**
   - Site URL: o domínio de produção.
   - Redirect URLs: `https://SEU_DOMINIO/auth/callback` e `https://SEU_DOMINIO/auth/confirm`. Em preview, adicione o domínio de preview.
2. **Authentication > Email Templates**, para os links funcionarem mesmo abertos em outro aparelho:
   - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/painel`
   - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
3. **Authentication > Providers > Email**: confirmação de e-mail ligada, senha mínima de 10 caracteres, proteção contra senhas vazadas ligada.
4. **Authentication > Providers > Google** (opcional): cadastre o Client ID e o Secret do Google Cloud, depois defina `AUTH_GOOGLE_ENABLED=true`.
5. **Authentication > SMTP**: configure um provedor próprio antes de abrir para o público. O SMTP padrão do Supabase tem limite baixo de envios.
6. **Project Settings > API Keys**: copie a publishable key e crie uma secret key exclusiva para a Vercel.
7. **Database > Backups**: confirme a política de backup do plano. Teste uma restauração em staging pelo menos uma vez.

## 2. Mercado Pago

1. Crie uma aplicação em Suas integrações e use as credenciais de teste em preview.
2. Em Webhooks, cadastre `https://SEU_DOMINIO/api/webhooks/mercadopago` com o evento **Pagamentos** e copie a assinatura secreta.
3. Em produção, troque para as credenciais de produção e repita o cadastro do webhook.

## 3. Vercel

Variáveis de ambiente (Settings > Environment Variables), separadas por ambiente:

| Variável | Observação |
|----------|------------|
| `APP_URL` | domínio público, sem barra final |
| `APP_SECRET` | 32+ caracteres aleatórios (`openssl rand -hex 32`), diferente por ambiente |
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_PUBLISHABLE_KEY` | chave pública |
| `SUPABASE_SECRET_KEY` | chave secreta, marcada como Sensitive |
| `MERCADOPAGO_ACCESS_TOKEN` | Sensitive |
| `MERCADOPAGO_WEBHOOK_SECRET` | Sensitive |
| `CRON_SECRET` | 32+ caracteres; a Vercel envia no header do cron |
| `CONTACT_EMAIL` | contato exibido nas páginas legais |
| `RESEND_API_KEY`, `EMAIL_FROM` | opcionais, para avisos por e-mail |
| `AUTH_GOOGLE_ENABLED` | `true` depois de configurar o Google |

Nenhuma variável usa o prefixo `NEXT_PUBLIC_`. O `vercel.json` agenda `/api/cron/maintenance` uma vez por dia; a liberação de memórias agendadas acontece a cada minuto pelo `pg_cron` no próprio banco.

## 4. Checklist de release

- [ ] CI verde: lint, typecheck, unitários, suíte SQL, build, auditoria de dependências, scan de secrets, E2E
- [ ] Migrations aplicadas e advisors de segurança do Supabase revisados
- [ ] Variáveis de produção diferentes das de preview
- [ ] Webhook de produção cadastrado e um pagamento real de ponta a ponta com estorno em seguida
- [ ] Headers conferidos no domínio real (`curl -I`): CSP com nonce, HSTS, `X-Frame-Options`, `nosniff`
- [ ] E2E de autorização (usuários A e B) executado contra staging
- [ ] Templates de e-mail e URLs de redirect do Supabase apontando para o domínio final
- [ ] SMTP próprio configurado
- [ ] Backup verificado
- [ ] Contato de privacidade publicado

## 5. Monitoramento

- Logs da Vercel para 5xx e latência.
- `security_events` no banco: `login_failed`, `rate_limited`, `upload_rejected`, `webhook_invalid_signature`, `payment_amount_mismatch`, `payment_needs_refund`, `integrity_mismatch`, `integrity_check_failed`.
- Consulta sugerida para alerta diário:

```sql
select type, severity, count(*)
from security_events
where created_at > now() - interval '24 hours'
group by 1, 2
order by 3 desc;
```

Qualquer `critical` ou `payment_needs_refund` pede ação no mesmo dia.
