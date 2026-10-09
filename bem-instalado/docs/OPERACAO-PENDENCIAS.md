# Operação após as correções de 09/10/2026

As correções do código não substituem a homologação dos serviços. Não considerar
o lançamento para clientes pagantes concluído enquanto estes itens estiverem abertos.

## Agendamento e alertas

- O projeto Vercel consultado está no plano Hobby. Cron nativo admite somente
  uma execução diária: não configura um processamento de e-mails a cada 5 minutos.
  Referência: https://vercel.com/docs/cron-jobs/usage-and-pricing.
- GitHub Actions permanece como verificação de melhor esforço, com horário fora
  do minuto zero. Pode atrasar; não é um agendador com garantia de frequência.
- Configurar um agendador externo a cada 5 minutos, com timeout de 30–45 segundos,
  GET ou POST em `https://instalar-sigma.vercel.app/api/operations/run` e o cabeçalho
  `Authorization: Bearer <CRON_SECRET>`. Não colocar o segredo na URL, nos logs
  ou no repositório. O administrador deve copiá-lo do gerenciador de segredos.
- Verificar HTTP 200 e `ok: true`, `healthy: true`. O segundo campo detecta falhas
  de entrega/heartbeat mesmo quando o processamento da fila terminou normalmente.
- Confirmar no provedor pelo menos três execuções consecutivas e um alerta
  recebido pelo responsável. Não provocar indisponibilidade em produção para testar.
- Monitorar a página inicial e `/api/health` em serviço independente. O heartbeat
  deve alertar quando a rotina deixar de rodar, não apenas quando ela retorna erro.

## Banco e arquivos

- Confirmar backup diário, retenção e recuperação pontual no painel do PostgreSQL.
- Os testes locais não são um backup dos dados de produção.
- Copiar os objetos do Blob e manter manifesto com caminho, tamanho e checksum,
  em armazenamento independente, com acesso privado e retenção definida.
- Restaurar uma cópia do banco e arquivos em destino isolado, nunca sobre a produção.
  Conferir contagens, relacionamentos e arquivos, medir o tempo, registrar evidências.
- Repetir o ensaio mensalmente com responsável identificado.
- Homologar foto, logo, portfólio, certificado e documentos com uma conta de teste
  aprovada, incluindo a recusa de acesso a arquivos de outro proprietário.

## Pagamentos e notificações

- Asaas foi testado com respostas simuladas, não com dinheiro real. Homologar
  checkout, Pix/cartão, recorrência, cancelamento, estorno e replay autenticado de
  webhook em ambiente de testes. Qualquer cobrança real exige aprovação própria.
- Push nativo depende da conta Firebase e das credenciais FCM/APNs; push web
  depende de `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` e
  `WEB_PUSH_SUBJECT`. Não gerar chaves novas sobre uma configuração existente.
- Testar inscrição, revogação, entrega com aplicativo fechado e token expirado.
  As notificações internas do painel são um recurso separado do push.

## Aplicativos e aceitação

- A geração Android usa a identidade de assinatura já cadastrada no GitHub.
  APK/AAB de uma execução manual são artefatos de teste, não publicação na Play Store.
- Android exige WebView 111+; iOS exige 16.4+, em linha com o compilador de estilos.
- O hook `capacitor:sync:after` mantém o mínimo do manifesto SPM após sincronização.
- Homologar em aparelhos reais e rede lenta antes de promover o APK novo ao download.
- Completar console, privacidade, Data Safety, conta de revisão e trilha de testes
  da Play Store; iPhone exige assinatura Apple, TestFlight e revisão própria.
- Consolidar gradualmente o CSS por componente e testar teclado, foco, zoom,
  contraste, leitor de tela, estados vazios, erros e recuperação. Não fazer uma
  reescrita indiscriminada dos estilos durante a correção de bugs operacionais.
