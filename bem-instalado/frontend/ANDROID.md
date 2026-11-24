# InstalaPro Instaladores para Android

O aplicativo Android é exclusivo para contas de instalador. O modo Android usa
a API de produção configurada em `.env.android` e não permite abrir áreas de
cliente, páginas públicas ou o painel administrativo.

## Requisitos

- Node.js 22.22 ou mais recente
- Java 21
- Android SDK 36
- Android 7 ou superior no aparelho
- Android System WebView ou Google Chrome atualizado

## Gerar o projeto web do aplicativo

O build do aplicativo exige `REACT_APP_TURNSTILE_SITE_KEY` (chave pública do
widget Turnstile, a mesma da Vercel). Sem ela o build para com erro, porque o
servidor de produção recusa cadastro e recuperação de senha sem o token. No
GitHub Actions ela vem da variável de repositório de mesmo nome; na máquina
local, defina no terminal ou em `.env.android.local` (ignorado pelo git).

O aplicativo roda em `https://app.instalarpro.com.br` (Android) e
`capacitor://app.instalarpro.com.br` (iOS), definido em `server.hostname` do
`capacitor.config.json`. Esse endereço é interno do WebView (não precisa de DNS
nem de site no ar). Como a Cloudflare libera automaticamente os subdomínios de
um hostname do widget, basta o widget do site ter `instalarpro.com.br`: não é
preciso liberar `localhost`. Se mudar o hostname, ajuste também a lista de
origens do CORS em `backend/server.js` (o teste `mobileCors.test.js` confere).

```bash
npm ci
npm run build:android:web
npx cap sync android
```

## Gerar APK de desenvolvimento

No Windows, todo o processo pode ser executado com:

```powershell
npm run android:apk:debug
```

No Linux ou macOS:

```bash
npm run android:sync
cd android
./gradlew assembleDebug
```

O APK de desenvolvimento será criado em
`android/app/build/outputs/apk/debug/app-debug.apk`. Ele serve para testes
locais e não deve ser distribuído como versão pública.

## Publicação na Google Play

Tags no formato `android-v1.0.0` executam o fluxo `Android Instaladores` no
GitHub Actions. O fluxo exige os segredos `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` e
gera o Android App Bundle (`.aab`) assinado para envio ao teste ou produção na
Google Play.

O keystore de upload nunca deve ser salvo no repositório. Mantenha também uma
cópia de segurança privada; sem ele não será possível enviar futuras versões
com a mesma identidade de upload.

Não há atualização por APK dentro do aplicativo distribuído pela Google Play.
As versões novas são entregues pelo próprio Google Play, com Play App Signing.

## Login com Google

O aplicativo abre o consentimento do Google no navegador seguro do sistema.
O retorno do Google ao backend é independente do link que reabre o app.
Em produção, o backend devolve o Android a
`https://instalar-sigma.vercel.app/auth/mobile/callback` para manter a
compatibilidade com a versão 1.0.36. Builds com o filtro novo também
reconhecem `https://instalarpro.com.br/auth/mobile/callback`. Os dois hosts
precisam servir o arquivo público `/.well-known/assetlinks.json` com o
certificado da versão de produção.

Se o domínio ainda não tiver sido verificado pelo aparelho, a página de retorno
oferece a contingência `instalapro://auth/callback`. Os plugins oficiais
`@capacitor/app` e `@capacitor/browser` recebem o link, fecham a aba de login e
concluem a sessão dentro do aplicativo.

Ao trocar o certificado de assinatura ou adotar o Play App Signing, atualize o
SHA-256 em `assetlinks.json` antes de distribuir a nova versão.
