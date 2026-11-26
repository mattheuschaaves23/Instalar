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
