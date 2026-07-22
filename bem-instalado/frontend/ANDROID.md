# InstalaPro Instaladores para Android

O aplicativo Android é exclusivo para contas de instalador. As rotas de cliente e a vitrine pública são redirecionadas para a entrada profissional dentro do aplicativo.

## Requisitos

- Node.js 22 ou superior
- Java 21
- Android SDK 36
- Android 7 ou superior no aparelho
- Android System WebView ou Google Chrome atualizado

## Gerar o projeto web do aplicativo

```bash
npm ci
npm run build:android:web
npx cap sync android
```

## Gerar APK de desenvolvimento

No Windows:

```powershell
cd android
.\gradlew.bat assembleDebug
```

No Linux ou macOS:

```bash
cd android
./gradlew assembleDebug
```

O APK será criado em `android/app/build/outputs/apk/debug/app-debug.apk`.

## Publicação automática

Tags no formato `android-v1.0.0` executam o fluxo `Android Instaladores` no GitHub Actions. O APK e seu arquivo SHA-256 são anexados automaticamente a uma versão pública no GitHub.

Para publicar na Google Play, configure um keystore permanente e gere um AAB de versão. O keystore nunca deve ser salvo no repositório.
