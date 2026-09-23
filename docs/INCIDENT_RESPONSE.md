# Resposta a incidentes

Procedimento mínimo quando houver suspeita de invasão, vazamento ou fraude.

1. **Preservar evidências.** Exporte os logs da Vercel e as tabelas `security_events`, `event_logs` e `payment_events` do período antes de qualquer mudança.
2. **Conter.** Se preciso, coloque o site em manutenção pela Vercel e pause o webhook no Mercado Pago.
3. **Revogar credenciais.** Rotacione `SUPABASE_SECRET_KEY`, `APP_SECRET` (invalida tickets de upload), `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` e `CRON_SECRET`. Encerre as sessões de usuários afetados pelo painel do Supabase Auth.
4. **Medir o impacto.** Quais contas, memórias, arquivos e pagamentos foram tocados. `verify_memory_integrity` e `sweep_integrity` mostram se alguma memória publicada foi alterada.
5. **Corrigir a causa** com teste de regressão e novo ciclo de CI.
6. **Restaurar** o serviço e acompanhar os logs nas 48 horas seguintes.
7. **Revisar os dados afetados** e contatar os titulares quando houver risco a eles.
8. **Cumprir obrigações legais.** Incidentes com risco relevante aos titulares devem ser comunicados à ANPD e aos afetados, conforme a LGPD e a regulamentação vigente.
9. **Documentar** cronologia, causa, impacto, correção e o que muda no processo.
