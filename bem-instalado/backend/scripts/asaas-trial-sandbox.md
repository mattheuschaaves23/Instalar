# Homologação de assinatura de 7 dias — InstalarPro

Estes comandos só acessam o Sandbox. Não usam a configuração da aplicação, não escrevem no banco e não fazem deploy.

## Prévia da tela de Assinatura

A página `/subscription` mostra os valores em produção, mas ainda não aceita adesão
real. O endpoint antigo de criação (`POST /api/subscriptions/pay`) também fica bloqueado
em produção. Assinaturas e cobranças já cadastradas não são migradas.

Para testar pelo site, use um banco isolado e uma conta de instalador administrador.
Em desenvolvimento (`NODE_ENV=development`) ou Vercel Preview, configure
`SUBSCRIPTION_TRIAL_SANDBOX_ENABLED=true` e `ASAAS_TRIAL_SANDBOX_API_KEY` como segredo
exclusivo do ambiente de teste. A API só cria checkout no Sandbox, sem escrever em
assinaturas locais. Sem essas variáveis a escolha de pagamento não é oferecida.
Em produção, mesmo que configuradas, elas nunca abrem checkout.

## 1. Validar o acesso

No painel **Sandbox** do Asaas, gere uma chave nova em **Integrações → Chaves de API**. Abra o PowerShell nesta pasta e execute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\configurarAsaasSandbox.ps1
```

Cole a chave no prompt oculto, não na linha de comando. A chave validada fica em `%LOCALAPPDATA%\InstalarPro\asaas-sandbox.key`, criptografada para a conta Windows que executou o script. Para desativá-la, revogue-a no painel Sandbox do Asaas.

## 2. Testar o checkout e a cobrança

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\configurarAsaasSandbox.ps1 -Acao Criar -Plano mensal
```

1. Abra a `CheckoutUrl` e complete em até 30 minutos. Use só [cartão de teste do Asaas](https://docs.asaas.com/docs/faq-sandbox) e dados de teste. Se o checkout pedir e-mail ou celular, use contatos próprios ou autorizados, pois o Sandbox pode mandar notificações.
2. Observe se o checkout explica o primeiro vencimento e se não cobra no ato. Se o Sandbox não for inequívoco, não use o retorno do navegador nem o evento `CHECKOUT_PAID` como prova de débito ou de horário da cobrança.
3. Inspecione a assinatura e os pagamentos. Preencha os três valores com a saída de `Criar` e mantenha o mesmo plano:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\configurarAsaasSandbox.ps1 -Acao Inspecionar -Plano mensal -CheckoutId '<CheckoutId>' -Referencia '<Referencia>' -PrimeiroDebito '<PrimeiroDebito>'
```

4. Repita com `-Plano anual`. Confira R$ 49,90 por mês e R$ 538,92 por ano (10% de desconto sobre 12 mensalidades). Por segurança, o vencimento de teste é arredondado para o início do dia seguinte, no fuso de São Paulo, ao último horário possível de conclusão do checkout + 168 horas. Isso evita marcar o vencimento antes do término dos sete dias se a API ignorar o horário.
5. Correlacione os eventos de [checkout](https://docs.asaas.com/docs/checkout-events), [assinatura](https://docs.asaas.com/docs/subscription-events) e [pagamento](https://docs.asaas.com/docs/payment-events) com os IDs e as datas no painel do Sandbox. Uma cobrança pendente não é dinheiro debitado. Se o script não localizar a assinatura via referência ou cobrança pelo ID do checkout, o resultado é inconclusivo; confira o vínculo pelo painel.
6. Teste também cartão recusado, checkout abandonado, cancelamento antes do fim do teste e a primeira cobrança após a data agendada. Pode-se simular confirmação no Sandbox para testar o tratamento do evento, mas isso não prova que o débito automático ocorre no dia certo. Não reenvie a criação automaticamente em caso de timeout: revise o painel para evitar duplicatas.

## Antes da migração em produção

- Quem já usa o Grátis só entra no teste após consentir com o valor/periodicidade e cadastrar o cartão no checkout do Asaas. Nada é cobrado ou migrado automaticamente. Preserve seus dados e permita cancelar antes da primeira cobrança. Defina o prazo de transição antes de descontinuar o Grátis.
- No projeto oficial, `ASAAS_NEXT_API_KEY` é o segredo reservado para a Bem Instalado.
  O botão **Verificar conta Asaas** na página Assinatura, visível para administradores,
  usa a chave somente para ler o status cadastral. Isso não ativa cobranças, não
  substitui a configuração antiga e não migra registros.
- Não reutilize IDs de cliente, cartão ou assinatura da conta antiga. Antes de
  liberar cobranças na nova, finalize o controle de quem pode iniciar o teste e
  os webhooks de cadastro, pagamento e cancelamento.
- Defina a verificação de identidade e a retenção dos dados antes de abrir o teste ao público. O dígito verificador do CPF só confere formato; cartão autorizado também não é prova de que o CPF pertence ao instalador. Depois de verificar a pessoa, o resgate precisa ser atômico e único por identidade para impedir que contas simultâneas usem o mesmo teste. Não grave CPF em logs.
- A liberação do teste depende de confirmação verificável da assinatura; a liberação do período pago depende de confirmação financeira. Teste eventos repetidos e fora de ordem, cobrança recusada, cancelamento e intervalos de acesso antes de publicar.

Para a troca da conta, `verifyAsaasProductionAccount.js` confere via API somente de leitura
se a chave nova pertence à carteira esperada (primeiro argumento, confirmado com o
administrador no painel do Asaas) e se a conta está aprovada. A chave é recebida pelo
stdin a partir de uma fonte segura, sem argumentos, logs ou arquivos. A verificação
não mexe na Vercel e não habilita a cobrança. Não use a chave de produção no roteiro
de teste dos 7 dias.

## Consultar um checkout antigo sem entrar no painel

Se você tem uma chave **segura e válida da mesma conta Sandbox**, não é preciso
refazer o checkout. Use a referência de `id` do link, o vencimento exibido antes
do envio e o plano. Execute na pasta backend, passando a chave **apenas pelo
stdin** a partir da sua fonte segura, nunca como argumento, arquivo aberto ou chat:

```text
node scripts/asaasTrialSandbox.js inspecionar-checkout <id-do-checkout> 2026-12-04 mensal
```

Essa ação é somente leitura. Sem vínculo verificável com uma assinatura, devolve
resultado inconclusivo. Ausência de débito antes do vencimento não confirma que a
recorrência será executada. Se a chave não estiver disponível, recupere acesso à
mesma conta pelo [suporte](https://docs.asaas.com/docs/entre-em-contato), sem
compartilhar API keys ou dados de cartão.

## Homologar o ciclo completo no InstalarPro

1. Em ambiente isolado, aplique a migração `030_asaas_managed_trial.sql` pelo
   migrador do projeto. Configure as variáveis `ASAAS_MANAGED_TRIAL_*` conforme
   o `.env.example`, usando somente uma chave Sandbox nova. O webhook exige
   token exclusivo e o ID da conta Asaas que emite os eventos. Configure
   `POST /api/subscriptions/webhooks/asaas-managed-trial` somente nesse ambiente.
2. Crie um cliente e um instalador fictícios sem Pro ou privilégio de administrador.
   O responsável confirma a identidade de teste e o vínculo entre os cadastros,
   e libera um único teste com `node scripts/approveAsaasSandboxTrial.js <id-do-instalador>
   <id-do-cliente-asaas> --identidade-ficticia-conferida`. Passe o CPF fictício pelo stdin, nunca como argumento ou em logs.
   O banco guarda um HMAC, não o CPF, e a unicidade impede outro resgate do mesmo
   documento, mesmo com outro cadastro. Isso não é um serviço de prova de
   titularidade para o público. Não use documentos reais nessa etapa.
3. Teste os planos em identidades fictícias separadas. Confira consentimento,
   preço, cartão válido/recusado, recorrência criada sem valor debitado à vista,
   cancelamento antes do vencimento, primeiro débito e renovação. Verifique o
   status no Asaas, sem considerar apenas a página de retorno. Um checkout
   abandonado ou resposta ambígua não autoriza nova tentativa automática:
   reconcilie no Asaas para não criar duplicatas.
4. Na conta nova de produção, faça só o diagnóstico enquanto o checkout fica
   bloqueado: configure `ASAAS_NEXT_API_KEY` e `ASAAS_NEXT_EXPECTED_WALLET_ID`
   no servidor. O botão de verificação administrativa compara a carteira esperada
   e o cadastro aprovado por GET; não troca credenciais antigas nem confirma
   que cobranças recorrentes já estão liberadas.
5. Para o piloto de produção, não reaproveite clientes ou IDs do Sandbox.
   São pré-requisitos: confirmar recorrência por cartão e vencimento na conta
   nova, registrar as evidências de homologação, aprovar o mecanismo de
   titularidade e a retenção do identificador, aprovar a comunicação de
   transição do Grátis e definir acompanhamento e desligamento. O piloto descrito
   abaixo não migra assinaturas anteriores nem abre cobrança ao público.

## Piloto de produção (somente um instalador, desligado por padrão)

O projeto não abre adesões para todos. O servidor bloqueia checkout real quando
o ambiente não é a Vercel de produção, quando a credencial é do Sandbox ou do
contrato antigo, ou quando o cadastro não é daquele instalador autorizado.
O cartão é informado diretamente no Asaas. O servidor registra o plano, preço,
referência e horário do aceite no banco, sem guardar o CPF ou os dados do cartão.

1. **Pré-requisito:** guardar as evidências de homologação do mensal, do anual e
   de cancelamento antes do primeiro vencimento (não somente a tela de retorno).
   O teste anterior pode ser consultado por chave do mesmo Sandbox. Não marque
   `ASAAS_PILOT_SANDBOX_VERIFIED` antes de verificar a cobrança.
2. **Publicação com adesões fechadas:** manter
   `ASAAS_PILOT_ENROLLMENT_ENABLED=false`. Publicar a rota e a migração 030.
   Configurar a chave nova da Bem Instalado (`ASAAS_NEXT_API_KEY`) nos segredos
   de **Production** da Vercel. Conferir o identificador da carteira no painel
   antes de preencher `ASAAS_NEXT_EXPECTED_WALLET_ID`. A chave antiga fica intacta.
   Configurar `ASAAS_PILOT_ACCOUNT_ID`, um token exclusivo de webhook e uma chave
   HMAC própria; o ID da conta que assina o evento não deve ser presumido igual ao
   ID da carteira. Não envie chaves, senhas nem CPF pelo chat.
3. **Notificações:** com `ASAAS_PILOT_RECEIVER_ENABLED=true`, cadastrar no Asaas
   de produção `https://instalarpro.com.br/api/subscriptions/webhooks/asaas-managed-trial`
   com o token configurado e eventos de checkout, assinatura e pagamentos que
   mudam o acesso. Conferir uma entrega autenticada e HTTP 200 nos logs do Asaas
   antes de marcar `ASAAS_PILOT_WEBHOOK_VERIFIED=true`. Não use um pagamento real
   só para testar o transporte do webhook.
4. **Identidade do piloto:** confirmar titularidade fora do formulário, obter
   consentimento do participante para o piloto e verificar o cadastro Asaas.
   Com adesões pausadas, o operador autorizado executa
   `approveAsaasPilotTrial.js <id-do-instalador> <id-do-cliente-asaas> --titularidade-verificada`
   no ambiente de operação aprovado, passando o CPF pelo stdin protegido.
   O comando consulta o Asaas, bloqueia carteira ou CPF divergente e cria só
   autorização local; não gera assinatura. A retenção do HMAC para o público
   precisa de política validada antes de qualquer expansão.
5. **Execução autorizada:** só então ativar a flag de adesão, para o único
   `ASAAS_PILOT_INSTALLER_ID`. O participante vê que usará cartão real, confirma
   o valor e termina o checkout pessoalmente. Confirmar que o Pro entra em teste
   sem pagamento imediato e conciliar o primeiro débito e o repasse. O preço
   mensal é R$ 49,90; o anual é R$ 538,92 em cobrança única anual.
6. **Pausa e reversão:** para parar novas adesões, desligar somente
   `ASAAS_PILOT_ENROLLMENT_ENABLED`. Manter a recepção e a conciliação ativas
   enquanto houver contrato do piloto, para permitir cancelamento e acompanhar
   pagamentos e estornos. Um checkout já emitido pode continuar no Asaas até
   expirar; a flag não cancela contratos nem revoga links já emitidos. Em
   incidente, conferir os registros no painel e tratar cada contrato afetado
   antes de remover o webhook ou credenciais.
