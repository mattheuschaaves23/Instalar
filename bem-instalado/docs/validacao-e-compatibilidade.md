# Validação e compatibilidade

A ferramenta de estilos está em Tailwind CSS 4.3. Os padrões anteriores de borda,
placeholder, foco e espaçamento vertical foram preservados na migração.

## Navegadores

Use Chrome/Chrome Android 111+, Safari/iOS 16.4+ ou Firefox 128+.
Os scripts legados do Vite não substituem os recursos CSS necessários pelo
Tailwind 4. Navegadores e WebViews anteriores precisam ser atualizados.
Referência: https://tailwindcss.com/docs/upgrade-guide#browser-requirements

## Testes

- Backend: `npm test`.
- Frontend: `npm test`, `npm run build` e `npm audit`.
- Integrações: `TEST_DATABASE_URL` deve apontar para PostgreSQL local descartável,
  com o schema e as migrations aplicados; execute `npm run test:integration` no backend.
  O comando cobre checkout/estorno Asaas, concorrência dos orçamentos e o fluxo
  cadastro/pedido/interesse/escolha, incluindo suporte.
- O provedor Asaas é simulado nos testes. Não use dados nem chaves de produção.
- O CI provisiona PostgreSQL 16 isolado e executa também as três integrações.
- O frontend verifica se os scripts gerados pelo Vite continuam permitidos pela
  política de segurança configurada em `vercel.json`.

Em 08/10/2026, a validação local passou com 93 testes backend (nenhum ignorado),
87 testes frontend e zero vulnerabilidades reportadas por `npm audit` em ambos.
Isso não garante ausência de todo bug nem substitui homologação de cobranças reais,
entrega de e-mails, uploads e notificações em dispositivos reais.
