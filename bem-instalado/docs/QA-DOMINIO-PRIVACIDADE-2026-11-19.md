# Domínio e política de privacidade — 19/11/2026

## Pedido e evidência inicial

O proprietário relatou que a política permanecia em `instalar-sigma.vercel.app/privacidade` e solicitou atualização do documento. O endereço legado respondeu HTTP 200, sem redirecionamento. O HTML do domínio oficial ainda anunciava canonical e imagens sociais no endereço antigo. A política estava datada de agosto e não identificava a pessoa jurídica.

Base desta entrega: `c749a639bf39e4818e9f0457345dcfa509156ede`. Branch isolada: `fix/dominio-politica-privacidade`.

O proprietário informou o CNPJ **55.445.091/0001-60** para identificar o responsável. A razão social **BEM INSTALADO HOME DECOR LTDA** foi corroborada por consulta pública à BrasilAPI e pela [página institucional da empresa](https://bemkidspapeis.com.br/quem-somos/). Não foram solicitados CPF ou credenciais.

## Alterações

- Redirecionamentos permanentes das três páginas legais do host antigo para o domínio oficial, sem regra global que possa quebrar sessões, APIs ou retorno de login do aplicativo.
- Tratamento também no React: uma navegação interna por `Link` não necessariamente consulta o servidor, então os documentos corrigem o host legado após navegação SPA.
- Canonical e imagens sociais do HTML inicial atualizados; título/canonical próprios para privacidade, termos e exclusão.
- Links dos materiais de publicação nas lojas atualizados. Isso não altera formulários já cadastrados nas contas das lojas nem gera APK.
- Política atualizada para `2026-11-19`, com controlador/CNPJ/canal, dados e finalidades, compartilhamento do pedido, consentimento separado e envio manual no WhatsApp, GPS/CEP e fornecedores, cookies/armazenamento, notificações, conservação, exclusão e direitos.
- Versões centralizadas no arquivo compartilhado `legalDocuments.json`. O texto e a versão dos Termos de Uso de agosto foram preservados; novos pedidos registram `2026-11-19` como versão do conjunto legal aceito. Consentimentos antigos não foram regravados.
- Sem alteração de chaves, DNS, autenticação, Turnstile, origens de API do app, pagamentos ou esquema de banco.

## Testes e evidência TDD

Jornadas: abrir documento antigo; entrar nele por navegação interna; ler política e identificar canal/controlador; alternar documentos sem perder título/canonical; preservar rotas do aplicativo; registrar a versão correta em um novo pedido.

- Checkpoint RED `8c3e729`: 9 testes de documentos falharam pelos campos, metadados e redirecionamentos ausentes; teste do backend reproduziu a versão antiga `2026-08-06`.
- Checkpoint GREEN `5b8e396`: os mesmos 11 testes de documentos e os testes de validação do backend passaram.
- Checkpoint `314f23f`: especificação do utilitário SPA adicionada antes da implementação; RED de compilação por módulo ainda ausente. `753c234`: utilitário e integração implementados, 13 testes de rotas mais os 11 de documentos aprovados.
- Frontend completo: **182 testes aprovados** em 33 arquivos.
- Backend completo: **135 aprovados, zero ignorados**, usando PostgreSQL local isolado, serviços financeiros/SMTP simulados e chave de teste, nunca dados de produção.
- Cobertura de `LegalPage.jsx`, `AccountDeletionPage.jsx` e `canonicalLegalUrl.jsx`: **100% linhas/funções, 96,15% instruções, 95,83% ramos**. A navegação real do host legado precisa de verificação no deployment porque a condição `has` da Vercel não é reproduzida pelo Vite local.
- Build Vite, verificador PapelPerto, checagem sintática do controller e `git diff --check` aprovados.
- Auditorias npm de produção do backend e completa do frontend: nenhuma vulnerabilidade reportada no momento.

## Navegador e limites

Leitura e links entre documentos conferidos em preview local sem conta real. Política verificada em 375, 768 e 1440 px, temas claro/escuro e zoom CSS de 200%, sem transbordamento horizontal. Navegação por Tab alcançou os sete links; títulos e versões corretos ao alternar documentos. Axe A/AA não indicou violações nos estados inspecionados. Isso não substitui avaliação manual com leitor de tela.

Não havia baseline visual versionado: comparação automática de regressão visual inconclusiva. Core Web Vitals de campo não medidos. As capturas usam dados públicos da empresa, não dados de clientes.

## Referências e limite jurídico

Orientação de transparência e direitos consultada na [ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares) e na [LGPD](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm). Condições de redirecionamento verificadas na [documentação oficial da Vercel](https://vercel.com/docs/project-configuration/vercel-json).

Os fluxos descritos foram confrontados com o código de pedidos, geocodificação, autenticação, armazenamento, exclusão, pagamentos, notificações e diagnóstico. Provedores opcionais são descritos de forma condicional. Não foram inventados prazos de retenção, encarregado nominal, certificações ou garantias de ausência de incidentes. A revisão técnica do texto não é parecer jurídico nem certificação de conformidade: contratos, retenção efetiva, transferências internacionais e atendimento aos titulares continuam sujeitos à validação jurídica e operacional da empresa.
