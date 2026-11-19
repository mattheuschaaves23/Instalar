# Custodia da assinatura Android

Conferencia de 19/11/2026. Titular do projeto: Matheus, conta GitHub `mattheuschaaves23`.

## Identidade publicada e uso informado

- Aplicativo: `br.com.instalapro.instaladores`.
- APK oferecido no site: `android-v1.0.35`.
- SHA-256 do arquivo: `b4cc610bd028f9da42e4bbc4dabad06684b5aa87887a3dda86487470d5e78818`.
- SHA-256 do certificado: `4B:4F:56:22:FB:36:75:D1:8E:62:22:71:72:D1:9C:12:FD:4E:E1:19:E7:06:0E:8F:FB:6E:1B:23:27:DE:C0:D3`.
- Certificado RSA 4096, assinatura APK v2 validada com `apksigner` oficial do Android Build Tools 36.0.0.
- O certificado corresponde ao `assetlinks.json` existente.
- O titular confirmou que somente ele testou o APK, sem instaladores externos conhecidos. Isso e declaracao do titular, nao telemetria de instalacoes.

## Onde a chave fica

Os quatro segredos ja estavam cadastrados em Settings > Secrets and variables > Actions do repositorio do titular:

- `ANDROID_KEYSTORE_BASE64`;
- `ANDROID_KEYSTORE_PASSWORD`;
- `ANDROID_KEY_ALIAS`;
- `ANDROID_KEY_PASSWORD`.

Nao trocar esses segredos nem gerar outra chave para esta verificacao. O GitHub nao mostra novamente seus valores na interface. Colaboradores com escrita podem usar segredos em workflows: a titularidade da conta nao torna segredos de repositorio exclusivos ao titular durante execucoes. Nao houve mudanca de permissoes nesta tarefa.

## Copia de seguranca privada

O workflow manual `Backup criptografado da assinatura Android` so executa nesta conta, com o titular como ator e a branch main. Ele verifica o certificado e o acesso a chave privada existente antes de gerar um backup `age` criptografado para o destinatario publico fixado no workflow. Nao cria chave de assinatura, APK, AAB, tag nem release e nao substitui os segredos existentes.

A identidade privada de recuperacao fica no computador do titular, fora do Git e de pastas sincronizadas, na pasta `%LOCALAPPDATA%/InstalarPro/Assinatura-Backup-2026-11-19`. A pasta e restrita por ACL ao usuario Windows e ao sistema. O GitHub recebe somente um artefato criptografado, com retencao de um dia.

Guardar uma segunda copia privada do backup e da identidade de recuperacao em midia segura, separada deste computador. Nao enviar a identidade privada, senhas ou keystore por WhatsApp, e-mail, commits ou artefatos publicos. O desenvolvedor pode receber este documento e o certificado publico; isso nao inclui a chave privada.

Antes de configurar Play App Signing, conferir no Play Console se o app ja existe e qual certificado foi escolhido. Nao presumir que uma nova chave de upload seja a mesma chave usada pelo Google para distribuir o aplicativo. Preservar a identidade acima ate o titular aprovar a configuracao definitiva da loja.

Referencias: https://developer.android.com/studio/publish/app-signing e https://docs.github.com/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets.
