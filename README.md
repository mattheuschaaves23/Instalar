# InstalaPro e PapelPerto

O projeto reúne os dois lados do marketplace de instalação de papel de parede:

- **PapelPerto** é a experiência pública do cliente. O cliente descreve o serviço, informa a localização, compara profissionais e escolhe com quem conversar.
- **InstalaPro** é a área do profissional. O instalador mantém o perfil público, recebe oportunidades, cria orçamentos e organiza clientes e agenda.

Os dois lados usam o mesmo backend e o mesmo banco PostgreSQL. Assim, um perfil publicado pelo instalador aparece diretamente na busca do PapelPerto.

## Rotas principais

- `/` — apresentação da plataforma InstalaPro;
- `/papelperto` — busca pública de instaladores para clientes;
- `/cliente` — endereço compatível da área do cliente;
- `/cliente/pedidos` — histórico persistente de pedidos do cliente;
- `/cliente/pedido` — acompanhamento por número e código de acesso;
- `/cliente/entrar` — login do cliente;
- `/instalador/cadastro` — cadastro do instalador;
- `/instalador/entrar` — login do instalador;
- `/dashboard` — painel profissional.

## Rodar localmente

Crie os arquivos de ambiente a partir dos exemplos do frontend e do backend. Depois, em dois terminais:

```powershell
cd bem-instalado/backend
npm install
npm run db:init
npm run db:migrate
npm run dev
```

```powershell
cd bem-instalado/frontend
npm install
npm start
```

O frontend abre em `http://localhost:3000` e a API em `http://localhost:5000/api`.

## Verificar a integração

```powershell
cd bem-instalado/backend
npm run test:papelperto
```

O teste garante que a rota PapelPerto, a vitrine pública, a busca regional e a API de instaladores continuem conectadas.

## Publicação na Vercel

O `vercel.json` instala as dependências com `npm ci`, aplica somente as migrações ainda não registradas e gera o frontend Vite. A API é publicada pela função `api/index.js`. Não execute DDL dentro das requisições.

Variáveis obrigatórias:

- `DATABASE_URL` e `JWT_SECRET`;
- `FRONTEND_URL` e `APP_URL` com o domínio público;
- `BLOB_READ_WRITE_TOKEN` para fotos e certificados;
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` para recuperação de senha e aviso de novo interessado;
- `ASAAS_ENVIRONMENT=production`, `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` para cobrança Pix automática;
- na Asaas, cadastre o webhook `https://SEU_DOMINIO/api/subscriptions/webhooks/asaas` com o mesmo `ASAAS_WEBHOOK_TOKEN` e os eventos de pagamento;
- mantenha `SUBSCRIPTION_LAUNCH_ACCESS=false` em produção para exigir uma assinatura ativa;
- credenciais Google ou Apple somente quando o respectivo login social estiver habilitado.

Depois do primeiro `npm run db:init`, toda alteração estrutural deve entrar em `backend/db/migrations`. Para promover uma conta já criada a administrador, use explicitamente:

```powershell
cd bem-instalado/backend
npm run admin:promote -- administrador@dominio.com
```

Nenhum e-mail recebe privilégios administrativos automaticamente. Certificados de instaladores precisam ser analisados no painel antes da publicação do perfil.
