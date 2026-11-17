# Identidade InstalarPro

O nome público passa a ser **InstalarPro** (com r). O domínio, e-mails,
identificadores de autenticação, chaves de armazenamento local, registros de
usuários e URLs dos APKs existentes não foram renomeados.

## Artes fornecidas

Fonte: `InstalarPro-logopack.zip`, enviado pelo proprietário em 17/11/2026.
As 14 imagens/ícones em `bem-instalado/frontend/public/brand/instalarpro-2026/`
são cópias binárias dos originais, com nomes curtos para uso no site.

- `logo-light.png` e `logo-dark.png`: logo completo com slogan.
- `wordmark-light.png` e `wordmark-dark.png`: versão sem slogan para cabeçalhos pequenos.
- `mark-light.png` e `mark-dark.png`: rolo isolado para menu recolhido.
- `icon-{32,64,180,192,512}.png`, `favicon.ico`: ícones fornecidos no pacote.
- `badge.png`: marca monocromática branca para notificações.
- `social-1080.png`: avatar para prévias de compartilhamento.

`BrandImage` escolhe a arte pela preferência de tema do site. Fotos escuras
usam explicitamente a variante escura, mesmo no tema claro. As cores originais
não são convertidas com filtros CSS. Os tamanhos intrínsecos foram preservados.

## Foto do instalador

Arquivo final usado pelo site:
`bem-instalado/frontend/public/auth/installer-login-worker-instalarpro-2026.jpg`.
A edição foi feita com a ferramenta integrada de geração/edição de imagens
(não com API/CLI). Depois houve apenas conversão para JPEG, qualidade 90,
sem recorte ou redimensionamento, para reduzir o download de 2 MB para 211 KB.
A foto antiga permanece disponível para clientes com arquivos antigos em cache.

Imagem 1: foto antiga do instalador. Imagem 2: logo completo transparente
para fundo escuro do pacote fornecido. Prompt final utilizado:

> Image 1 is the edit target: existing portrait marketing photograph of a wallpaper installer. Image 2 is the exact replacement brand artwork, not an edit target. Change ONLY the printed logo on the back of the installer's black shirt in Image 1. Replace the old 'InstalaPro' with the supplied 'InstalarPro' artwork from Image 2, preserving its roller symbol, silver/white Instalar letters and gold Pro letters, and its small tagline. Render the brand name verbatim 'InstalarPro' (I-n-s-t-a-l-a-r-P-r-o). Make the logo follow the fabric surface, folds, perspective, and existing lighting like a real screen print. Keep the placement and similar print size on the shirt. Keep EVERYTHING ELSE unchanged: identical person, body, pose, hair, hand, tools, hat, wallpaper, room, lighting, framing and tall portrait aspect ratio. No extra text, no additional logos, no redesign of the supplied logo. Photorealistic precise-object editing for the login page of an existing website.

## Publicação e compatibilidade

- Configuração Vercel `APP_NAME=InstalarPro`, em Production e Preview,
  para as mensagens que já usam essa variável. Nenhum segredo foi alterado.
- Cache do service worker versionado para buscar as novas artes.
- Nenhuma migration ou alteração em contas existentes.
- Nenhuma alteração nos arquivos da PR de segurança #4 do Augusto.
- O site/PWA recebe os novos ícones. Alterar nome/ícones do APK/IPA já instalado
  requer uma nova compilação e distribuição nativa, fora desta publicação do site.

## Verificação

- `BrandImage.test.jsx`: arte por tema, dimensões reais, nomes e manifesto.
- `scripts/qa/brand-identity.js`: navegador com APIs simuladas, sem alterar
  contas reais; início, login, recuperação, páginas legais, perfil público,
  painel, menu recolhido, celular claro/escuro, pedido, manifesto e ícones.
- Suítes completas de frontend/backend e build de produção antes da publicação.

Os dados simulados não substituem um teste real de login ou de entrega SMTP;
esta alteração não modifica esses fluxos.
