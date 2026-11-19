# Pedidos, interesses e localização — verificação de 19/11/2026

## Escopo e isolamento

- Base: `7cfec18c8d6a1e39c2692c36c35f338daa2f7362`; branch `feat/pedidos-localizacao-confiavel`.
- Publicação do site autorizada pelo proprietário após os testes. Sem novo APK.
- Sem alterações em login, OAuth, recuperação de senha, Turnstile, chaves, permissões, assinatura Android ou migrations.
- Testes mutáveis somente em PostgreSQL 16.16 local, banco `instalar_test`, servidores ligados a `127.0.0.1`.
- Contas, pedidos e telefones fictícios. SMTP e cobrança simulados nos testes de integração. A navegação para WhatsApp foi interceptada localmente: nenhuma mensagem enviada.

## Falhas reproduzidas e corrigidas

1. Completar número/complemento descartava o ponto GPS. Agora o ponto só é conservado se rua, cidade e UF ainda correspondem ao endereço obtido; alterações de endereço invalidam coordenadas antigas.
2. Resultado de busca com apenas cidade permitia avançar. Agora abre o preenchimento de rua/referência, mantendo cidade e UF já encontradas.
3. A API aceitava região incompleta, UF inválida, coordenada isolada e valores como booleanos/listas. Esses casos recebem 400 antes de gravar.
4. Endereço manual disparava outra busca e podia virar um ponto no centro da cidade. Agora não há essa espera nem precisão inventada: endereço manual/CEP sem coordenadas segue pela cidade, com distância exata desconhecida.
5. Repetir uma escolha já realizada podia falhar após o prazo original da oportunidade. A repetição do mesmo escolhido agora é idempotente, sem notificações duplicadas; pedido aberto vencido continua bloqueado.
6. Pedido vencido ainda podia anunciar contato via interesse na serialização. A disponibilidade respeita o vencimento.
7. Corrigidos contraste do texto secundário do perfil, papel acessível do indicador de agenda, distinção do link de atribuição do mapa e contraste de “Continuar” no tema escuro.

Pedidos e coordenadas antigos não foram migrados nem sobrescritos.

## Evidência de testes

- Frontend: **158 testes aprovados**, em 31 arquivos (`npm test`).
- Backend: **134 testes aprovados, nenhum ignorado**, com `TEST_DATABASE_URL` local e `JWT_SECRET` fictício (`npm test`). Inclui Asaas simulado, orçamento/agenda, aparência, oportunidades e marketplace completo.
- Concorrência com pool de quatro conexões: três tentativas simultâneas geram apenas dois interesses distintos; duas escolhas de profissionais diferentes retornam um sucesso e um conflito, com um único escolhido e uma notificação.
- Acesso sem autorização não escolhe profissional. Endereço/contato permanecem restritos ao escolhido, salvo consentimento explícito para abrir o rascunho de WhatsApp no momento do interesse.
- Busca antiga resolvendo após troca do texto não substitui a nova busca.
- CEP real `88137-620` consultado: Rua Turquesa, Palhoça/SC, ViaCEP; sem coordenadas inventadas.
- Cobertura dos utilitários de endereço/GPS: 91,91% instruções, 85,53% ramos, 100% funções e 98,68% linhas. `requestAddress.js`: 100% linhas. Não representa cobertura de todo o sistema.
- `npm run build`, `node --check controllers/serviceRequestController.js`, verificador PapelPerto e `git diff --check`: aprovados.
- `npm audit --omit=dev --audit-level=high` no backend e `npm audit --audit-level=high` no frontend: nenhuma vulnerabilidade reportada no momento.
- Busca de padrões de novas credenciais no diff: nenhum achado. Não substitui auditoria completa de segredos/histórico.

## Navegador

Jornada com banco/API reais locais: preencher pedido → publicar → login do instalador → Novas → Tenho interesse → abrir rascunho com perfil/instruções → Meus interesses → cliente abre perfil não listado → Escolher este instalador → confirmação → Escolheram você → contato/endereço liberados.

GPS de teste fixo: rua encontrada → informar número → confirmar → voltar → marcador e número preservados. Não foi usada a posição real do proprietário.

Localização e oportunidades verificadas em 375, 768 e 1440 px, temas claro/escuro, sem transbordamento horizontal. Perfil de escolha também verificado nessas larguras e em escuro no celular. Varredura axe WCAG A/AA nos estados inspecionados sem violações remanescentes após as correções. Não equivale a certificação de acessibilidade nem teste manual com leitor de tela.

Não havia baseline visual versionado: comparação automática de regressão visual **inconclusiva**. Screenshots atuais são evidência de inspeção, não prova de identidade com uma versão anterior. Core Web Vitals de campo e comportamento em celular físico/rede móvel não foram medidos nesta etapa. O 401 de consulta de sessão para visitante anônimo foi esperado; nenhuma exceção JavaScript foi observada na jornada testada.

## Reprodução e checkpoints

- RED endereço/GPS, região, vencimento e repetição: `66c806b`; correção: `b0f2837`.
- RED perfil acessível/contraste: `4fffc00`; GREEN: `b2661b6`.
- RED atribuição GPS: `292e32e`; GREEN: `9c76373`.
- RED botão escuro: `f391ddf`; GREEN: `fb5470b`.
- Testes de DOM usam Testing Library/jsdom; cobertura usa Vitest v8. Dependências exclusivamente de desenvolvimento.
- Testes automatizados não garantem ausência absoluta de bugs. GPS, mapa, conectividade e abertura de aplicativos externos continuam sujeitos ao dispositivo/provedor; entrada manual e reabertura de WhatsApp são alternativas preservadas.
- Não há migração nesta entrega. Em caso de regressão, é possível restaurar o deployment anterior ou reverter os commits desta branch, preservando os dados.
