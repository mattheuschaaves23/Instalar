# Pedido direto pelo perfil — plano de implementação

> Para execução: implementar na ordem abaixo, com testes primeiro e verificação de cada tarefa.

**Objetivo:** permitir que o cliente de um instalador envie uma solicitação privada a partir do perfil público compartilhado, sem criar conta.

**Arquitetura:** usar os pedidos existentes com um destinatário exclusivo, criado por uma rota pública com Turnstile. O aceite exclusivo cria o rascunho existente em uma única transação. O acompanhamento reutiliza o código privado enviado no fragmento da URL.

**Stack:** Express, PostgreSQL, React e testes com Node/Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-pedido-direto-perfil-design.md`.

## Restrições e pontos de revisão

- Não mudar a visibilidade de perfis ocultos nem os filtros do fluxo geral; conferir o acesso de outro instalador nas duas rotas de aceite e na listagem.
- Pedidos diretos de outra cidade devem aparecer ao destinatário. Perfil indisponível e falta de autorização do cliente não criam pedidos.
- Sem desafio válido, sem pedido. Não enviar mensagens externas automaticamente.
- Cliente não aparece em Clientes antes do instalador decidir seguir e salvar o orçamento. Duplo aceite não duplica o rascunho.
- O acompanhamento deve distinguir “pedido direto” dos pedidos abertos para toda a região.

## Tarefa 1: API e isolamento

- [x] Criar teste de integração em `backend/test/directServiceRequest.integration.test.js`: dois instaladores na mesma região, perfil oculto, envio como visitante, listagem exclusiva, notificação única, acesso do cliente com código e dois aceites concorrentes.
- [x] Executar com PostgreSQL local e confirmar falha pela falta da rota direta.
- [x] Criar migração `022_direct_service_requests.sql`, com o campo `direct_installer_id` em `service_requests` e índice de destinatário. Excluir permanentemente os pedidos diretos quando o destinatário for excluído permanentemente, sem liberá-los na busca geral.
- [x] Criar `POST /public/installers/:id/direct-requests` (nome, telefone, cidade, UF, detalhes, consentimento e desafio), `POST /opportunities/:id/accept-direct` e indicador `is_direct` nas respostas de leitura. Integrar o filtro de destinatário na listagem e negar o fluxo geral de interesse.
- [x] Verificar a migração, os testes da API e a preservação das abordagens comuns.

## Tarefa 2: perfil, painel e acompanhamento

- [x] Escrever testes para a opção de compartilhar perfil público, enviar o formulário e a ação de aceitar sem WhatsApp automático.
- [x] Adicionar `?orcamento=1` ao link em Meu perfil. No perfil público compartilhado, exibir “Pedir orçamento a este instalador” e um formulário de envio curto.
- [x] No painel de Oportunidades, identificar “Pedido direto” e encaminhar “Aceitar e montar orçamento” ao rascunho. Na página do cliente, mostrar que o pedido foi enviado só ao profissional escolhido.
- [x] Verificar o fluxo em testes novos e executar as suítes completas e o build. Não publicar nesta rodada.

## Verificação

- A API impede que a reabertura administrativa transforme pedidos diretos em pedidos gerais, inclusive durante reversão para código anterior. A interface de acompanhamento usa o mesmo estado público que a API.
- Revisão independente concluída; os problemas de reabertura, acompanhamento e recuperação do antirrobô foram cobertos com testes que falharam antes da correção.
- 137 testes no backend com PostgreSQL local, 198 no frontend. O fluxo de envio e acompanhamento foi conferido no navegador local, com serviço antirrobô simulado, e o formulário coube nas larguras de 375, 768 e 1440 px. Produção não alterada.
