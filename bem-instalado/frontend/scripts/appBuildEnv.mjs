// Regras do build web que vai empacotado no aplicativo (Capacitor).
// O site da Vercel recebe as variáveis do painel; o aplicativo é compilado no
// GitHub Actions ou na máquina do desenvolvedor e precisa recebê-las de lá.
// Sem a chave pública do Turnstile o servidor de produção recusa cadastro e
// recuperação de senha feitos pelo aplicativo, então o build para aqui.

export const NATIVE_APP_MODES = ['android', 'ios'];

const TURNSTILE_KEY = 'REACT_APP_TURNSTILE_SITE_KEY';
// Chaves de teste públicas da Cloudflare (1x..., 2x..., 3x...). Só passam com a
// chave secreta de teste; a produção recusa o token gerado por elas.
const TURNSTILE_TEST_KEY = /^[123]x0{10,}[A-Z]{2}$/;

export function appBuildEnvErrors(mode, env = {}) {
  if (!NATIVE_APP_MODES.includes(mode)) return [];

  const errors = [];
  const siteKey = String(env[TURNSTILE_KEY] || '').trim();
  if (!siteKey) {
    errors.push(
      `${TURNSTILE_KEY} ausente. Sem ela o cadastro de instalador e a recuperação de senha são recusados pelo servidor. ` +
        'No GitHub Actions: crie a variável de repositório REACT_APP_TURNSTILE_SITE_KEY (Settings > Secrets and variables > Actions > Variables) ' +
        `com a mesma chave de site usada na Vercel. Na máquina local: defina a variável no terminal ou em .env.${mode}.local (ignorado pelo git).`
    );
  } else if (TURNSTILE_TEST_KEY.test(siteKey)) {
    errors.push(`${TURNSTILE_KEY} é uma chave de teste da Cloudflare; o servidor de produção recusa o token dela. Use a chave de site real.`);
  }
  return errors;
}

export function assertAppBuildEnv(mode, env) {
  const errors = appBuildEnvErrors(mode, env);
  if (errors.length) {
    throw new Error(`Build do aplicativo (${mode}) interrompido:\n- ${errors.join('\n- ')}`);
  }
}
