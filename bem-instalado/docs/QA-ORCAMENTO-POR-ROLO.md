# Orçamento por rolo com medidas opcionais

Os cenários foram derivados do pedido de exigir a quantidade de rolos somente quando não houver medidas. Por ambiente, o instalador pode preencher largura e altura para calcular automaticamente ou deixar as duas em branco e informar um número inteiro positivo de rolos. O preço por rolo continua sendo usado nos dois caminhos. A remoção pode continuar sendo cobrada separadamente.

## Evidência

- **RED** (`e145ae1`): o teste do formulário encontrou a caixa “Informar total sem medidas”; a API rejeitou o orçamento baseado só em rolos; o PDF imprimiu dimensões e área zeradas.
- **GREEN** (`c934524`): passaram os 9 testes focados do formulário e os 13 testes da API/PDF, incluindo persistência em PostgreSQL local. A cobertura focada do formulário ficou em 81,11% de branches e 78,4% de linhas. A compilação de produção do frontend também passou.
- Foi incluída regressão para a reabertura de um orçamento salvo e para pedidos com ambientes mistos: só o ambiente sem medidas exige o número de rolos. Um par incompleto de medidas é rejeitado em vez de ser descartado silenciosamente.
- Na suíte completa, passaram 322 testes do frontend e 242 do backend, sem falhas obrigatórias. A cobertura do formulário chegou a 81,86% de linhas e 84,77% de branches. Dois cenários opcionais do piloto Asaas e um teste de autenticação já marcado como pendente no commit base ficaram fora da aprovação.

Comandos focados: `node node_modules/vitest/vitest.mjs run src/components/Budgets/BudgetRemoval.test.jsx` (frontend) e `node --test --test-concurrency=1 --test-force-exit --test-timeout=20000 test/operationsQuote.integration.test.js test/generatePDF.test.js` (backend, com banco local). Nenhuma migração de banco nem alteração do app publicado nas lojas foi necessária.
