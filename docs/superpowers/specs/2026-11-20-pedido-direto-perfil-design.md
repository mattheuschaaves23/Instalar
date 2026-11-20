# Pedidos diretos pelo perfil do instalador

## Objetivo

O instalador pode compartilhar seu perfil público com um cliente que encontrou fora da InstalarPro. O cliente vê o perfil e escolhe se quer enviar uma solicitação de orçamento somente para aquele profissional.

## Abordagens

- Sem conta, com Turnstile e limite de envios: opção escolhida. Evita interromper o cliente para criar um cadastro quando ele já tem um profissional em mente.
- Exigir login: permitiria acompanhar o pedido pela conta desde o início, mas adicionaria uma etapa ao primeiro contato.

## Fluxo proposto

1. No painel, o instalador copia ou compartilha o link do próprio perfil público. Perfil oculto não passa a ser público automaticamente.
2. No link compartilhado, o cliente abre “Pedir orçamento a este instalador”. Ele informa nome, WhatsApp, cidade/UF e o que precisa. O formulário explica quem receberá os dados e exige confirmação antes do envio. Não pede CPF.
3. O instalador recebe uma notificação e vê o pedido identificado como direto no painel. Se aceitar, pode completar um rascunho em Orçamentos. Enviar um pedido direto não equivale a contratar, aprovar um orçamento, agendar um serviço ou mandar WhatsApp automaticamente.

## Restrições e verificação

- O servidor verifica se o perfil está habilitado para receber pedidos, o destinatário e a proteção antirrobô. Um destino inválido não vira pedido geral.
- Só o instalador destinatário pode ver e aceitar o pedido no painel. A página de acompanhamento do cliente não deve ficar acessível sem a autorização correspondente.
- Testar o envio sem conta, o perfil indisponível, a exclusão de outros instaladores e a criação de um único orçamento se o botão for acionado mais de uma vez. Preservar o fluxo geral e seus pedidos existentes.
- Cadastro rápido por nome em orçamentos manuais é independente. Pedidos diretos não entram no banco de clientes do instalador sem que ele decida seguir.
