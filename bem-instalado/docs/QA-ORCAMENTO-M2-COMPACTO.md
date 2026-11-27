# Orçamento por m² e seleção de cliente compacta

Os cenários vieram do pedido de aplicar ao modo Por m² a mesma lógica condicional do modo Por rolo e deixar a escolha do cliente inteira na tela.

- **RED (`c215929`):** o formulário ainda mostrava a caixa de valor total e não oferecia área manual; o backend rejeitava um orçamento de 12,50 m² sem largura e altura; o PDF não mostrava a área no ambiente. No Chromium local, a tela de clientes tinha rolagem externa nos três tamanhos testados.
- **GREEN (`198fc64` e ajuste do aviso de plano):** o instalador pode informar largura e altura para calcular a área ou informar somente a área total. Ambas as medidas ficam em branco nesse segundo caminho; um par incompleto não é descartado silenciosamente. O backend guarda e cobra a área; o PDF mostra a área sem inventar dimensões. Documentos antigos por valor fechado continuam editáveis.
- **Validação:** passaram 323 testes do frontend e 243 do backend, sem falhas obrigatórias; dois casos opcionais do piloto Asaas e um TODO de autenticação preexistente não entraram na aprovação. A cobertura do formulário foi 81,86% de linhas e 85,69% de branches. Comandos: `node node_modules/vitest/vitest.mjs run --maxWorkers=3 --coverage --coverage.include=src/components/Budgets/BudgetForm.jsx` e `node --test --test-concurrency=1 --test-force-exit --test-timeout=20000 'test/*.test.js'` com PostgreSQL isolado.
- **Layout:** navegador Chromium isolado, com 35 clientes fictícios e planos Pro e Grátis, em viewports de 1920×955, 1366×660 e 390×640. A página não rolou, o botão permaneceu visível e a lista pôde rolar. Buscar e selecionar um cliente no fim da lista continuou funcionando. Os testes de viewport não substituem um aparelho físico.

Sem migração: a área continua na coluna existente. Nenhuma versão Android ou iOS foi alterada.
