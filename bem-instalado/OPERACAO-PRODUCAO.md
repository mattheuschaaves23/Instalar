# Colocando o InstalaPro em operação

Este projeto já tem o fluxo completo de marketplace: o cliente cria um pedido, escolhe um instalador, recebe proposta, aceita o valor e o horário, e o agendamento entra na Agenda do instalador. O painel **Aprovações** permite revisar o certificado, recusar com motivo ou aprovar e publicar o perfil na vitrine.

## Antes do primeiro deploy no Vercel

Cadastre estas variáveis em **Vercel > Project > Settings > Environment Variables** para Preview e Production:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Banco PostgreSQL de produção. |
| `JWT_SECRET` | Chave longa, aleatória e exclusiva para as sessões. |
| `FRONTEND_URL` e `APP_URL` | URL pública final, por exemplo `https://seu-dominio.com.br`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Envio de confirmação de e-mail, proposta e avisos operacionais. Use uma senha de aplicativo quando o provedor exigir. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON inteiro, em uma só linha, da conta de serviço Firebase. Habilita o envio FCM pelo servidor. |

O deploy executa somente as migrations versionadas; ele não recria o schema nem apaga dados. Para um banco local novo, use o comando de inicialização local já existente, nunca em produção.

## E-mail e sessão

Contas criadas com senha recebem um link de confirmação. Enquanto o e-mail não é confirmado, ações protegidas da conta ficam bloqueadas. As sessões web passam a usar o cookie `HttpOnly` `instalapro_session`; o token não é salvo no `localStorage` do navegador. Aplicativos nativos continuam usando o armazenamento seguro do dispositivo.

O acesso por senha não exige código de autenticação adicional. A administração continua restrita a contas autenticadas com permissão de administrador. Os campos antigos de verificação em duas etapas permanecem no banco apenas para compatibilidade e não são lidos nem usados para autorizar o acesso; não é necessário migrar ou apagar contas existentes.

## Push Android e iPhone

O projeto já registra tokens de dispositivos Android/iOS e o servidor envia avisos por FCM quando `FIREBASE_SERVICE_ACCOUNT_JSON` estiver configurado. Ainda é necessário concluir a configuração de cada plataforma:

1. No Firebase, crie os apps Android e iOS com os mesmos identificadores definidos no Capacitor e baixe `google-services.json` para o Android.
2. No Apple Developer, habilite **Push Notifications** no App ID, gere uma chave APNs e associe o app iOS ao Firebase.
3. Faça um build assinado em aparelho real e aceite a permissão de notificações. Simuladores não comprovam push remoto.
4. Guarde `google-services.json`, a chave APNs e a conta de serviço fora do Git. Use os segredos do Vercel/CI para eles.

Sem essas credenciais, notificações dentro do site e e-mails continuam funcionando; o push com o aplicativo fechado não será entregue.

## SEO e Google

`robots.txt` e `sitemap.xml` agora são arquivos estáticos reais. Quando trocar o domínio Vercel por um domínio próprio, atualize as URLs em `frontend/public/robots.txt`, `frontend/public/sitemap.xml` e `frontend/index.html`, depois faça novo deploy. Cadastre o sitemap em [Google Search Console](https://search.google.com/search-console/).

As páginas públicas recebem título, descrição, canonical e Open Graph no navegador. Para SEO máximo em compartilhamentos e crawlers sem JavaScript, a próxima evolução é renderização no servidor (SSR/prerender); isso não é necessário para o funcionamento do marketplace.

## Verificação após o deploy

1. Crie uma conta com senha e confirme o e-mail pelo link recebido.
2. Envie um certificado de instalador e, como administrador autenticado, aprove-o em **Aprovações**.
3. Como cliente, publique um pedido, escolha o instalador, aceite uma proposta e confira o horário na Agenda.
4. Confira e-mail e push para proposta, aceite e atualização do serviço.
5. Abra `/robots.txt` e `/sitemap.xml` diretamente no domínio público e envie o sitemap ao Search Console.
