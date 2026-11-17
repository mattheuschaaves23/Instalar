# Perfil intuitivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir o perfil como apresentação e editar com orientação e requisitos claros.
**Architecture:** A rota /profile continua igual; query editar=1 ativa o editor. A apresentação pública aceita uma prévia privada explicitamente projetada. Novos componentes e CSS ficam em Profile, sem modificar autenticação ou backend.
**Tech Stack:** React 19, React Router 8, CSS, Vitest e Playwright CLI existentes.
**Spec:** docs/superpowers/specs/2026-11-17-perfil-intuitivo-design.md

## Global Constraints
- Só frontend; preservar API, banco, autenticação, recuperação de senha e Turnstile do Augusto.
- Somente nome, telefone, cidade, estado e e-mail confirmado obrigatórios.
- Não publicar o perfil automaticamente; não enviar campos privados/administrativos em etapas erradas.
- Sem novas dependências e sem alterações nos arquivos do PR #4 do Augusto.

## Review Focus
- Perfil não publicado ou sem foto: mostrar prévia útil, sem 404 ou aprovação indevida.
- Campos editados e cancelamento/voltar: preservar apenas o que foi salvo e pedir confirmação para descarte.
- Falha de API: não mostrar formulário vazio como se fossem dados reais nem anunciar sucesso.
- Tutorial pulado/concluído: lembrar por conta, permitir rever, foco por teclado e não bloquear edição.
- Prévia: dados privados não vazam e navegação pública de clientes continua intacta.

### Task 1: Modelo e apresentação
**Files:** Profile/Profile.jsx, Profile/profilePresentation.js, Public/InstallerProfile.jsx; testes Profile/profilePresentation.test.js e scripts/qa/profile-flow.js.
**Interfaces:** buildOwnerProfilePreview(profile, {summary, reviews, slots}) retorna payload público projetado; /profile usa dados autenticados.
- [x] Criar e executar teste RED da abertura como apresentação e da projeção sem dados privados.
- [x] Implementar prévia, estado de carregamento/erro e checklist de requisitos salvos.
- [x] Executar testes específicos e suíte frontend.

### Task 2: Editor e tutorial
**Files:** Profile/ProfileEditor.jsx (editor existente reorganizado), Profile/ProfileEditTutorial.jsx, Profile/ProfileReadiness.jsx, Profile/Profile.css, Profile/profileEditing.js e testes.
**Interfaces:** editor recebe initialProfile, onSaved(profile, finish), onCancel(); buildProfileStepPayload(form, step) envia apenas campos da etapa; tutorial usa armazenamento seguro existente por id.
- [x] Testar RED os payloads por etapa e o ciclo do editor no navegador.
- [x] Implementar três etapas, salvamento por etapa, proteção de alterações não salvas e tutorial reabrível.
- [x] Testar requisitos incompletos, sem mídia e erro de salvamento; suíte frontend verde.

### Task 3: Verificação final e domínio
- [x] Playwright: desktop/celular, claro/escuro, teclado, primeira visita/repetição, API falhando, público e privado.
- [x] Builds web de produção e Android, e git diff --check.
- [x] Revisor independente do diff e confirmação de zero sobreposição com PR #4.
- [x] Verificar domínio na Vercel e DNS; relatar qualquer dependência de registro/propriedade ao usuário, sem mudar login.

## Registro de execução
Usuário aprovou o fluxo e pediu prosseguir sem conflitar com Augusto. Implementação nesta sessão em feat/perfil-intuitivo; correção anterior do tema preservada no commit 322cc53. Sem merge/push/deploy.

- A apresentação usa o mesmo endpoint do cliente, que já permite a prévia autenticada do dono. Se ele falhar, a projeção local mostra os dados essenciais sem repassar dados privados.
- Revisão independente: rascunho volta ao navegar entre rotas ou ao reenviar confirmação; fica apenas em memória e separado por conta. Imagens públicas que usam caminho relativo passam pelo host da API no app. Certificado protegido continua no editor autenticado.
- Verificação final: 117 testes do frontend, fluxo completo no Playwright com API simulada e builds web/Android concluídos. Sem teste em aparelho Android nem publicação de APK.
- Registro.br confirmou instalarpro.com.br disponível por R$ 40/ano. A promoção da Vercel não inclui .com.br; o usuário preferiu manter o endereço e consultar o preço. Nenhuma compra ou troca de domínio foi realizada.
