import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { startSocialLogin } from '../../services/auth';
import { clearOAuthErrorFromUrl, getOAuthErrorMessage } from '../../utils/oauthMessages';
import { getAuthRequestErrorMessage } from '../../utils/authErrorMessage';
import { getNativeStorePlatform, isIosInstallerApp } from '../../utils/nativePlatform';
import useAuthCapabilities from '../../hooks/useAuthCapabilities';
import BrandWordmark from '../Layout/BrandWordmark';

const IS_INSTALLER_APP = process.env.REACT_APP_INSTALLER_APP === 'true';

function InstallerLoginIcon({ name }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  };

  if (name === 'user') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="3.1" {...common} />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" {...common} />
      </svg>
    );
  }

  if (name === 'mail') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4.5 6.8h15v10.4h-15z" {...common} />
        <path d="m5.1 7.3 6.9 5.4 6.9-5.4" {...common} />
      </svg>
    );
  }

  if (name === 'lock') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="6.5" y="10.4" width="11" height="8.1" rx="1.7" {...common} />
        <path d="M9 10.4V8a3 3 0 1 1 6 0v2.4" {...common} />
      </svg>
    );
  }

  if (name === 'eye') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3.8 12s3.1-5 8.2-5 8.2 5 8.2 5-3.1 5-8.2 5-8.2-5-8.2-5Z" {...common} />
        <circle cx="12" cy="12" r="2.2" {...common} />
      </svg>
    );
  }

  if (name === 'arrow') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 12h14" {...common} />
        <path d="m13 6 6 6-6 6" {...common} />
      </svg>
    );
  }

  if (name === 'star') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m12 3.8 2.6 5.2 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.8z" {...common} />
      </svg>
    );
  }

  if (name === 'shield') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3.5 18.5 6v5.8c0 4.1-2.7 7.2-6.5 8.7-3.8-1.5-6.5-4.6-6.5-8.7V6z" {...common} />
        <path d="m8.9 12 2 2 4.3-4.6" {...common} />
      </svg>
    );
  }

  if (name === 'chart') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5.2 18.7V14" {...common} />
        <path d="M10 18.7V9.5" {...common} />
        <path d="M14.8 18.7v-6.8" {...common} />
        <path d="M19.6 18.7V5.3" {...common} />
      </svg>
    );
  }

  if (name === 'headset') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4.5 13.4v-1.2a7.5 7.5 0 0 1 15 0v1.2" {...common} />
        <path d="M4.5 13.2h3v5h-3z" {...common} />
        <path d="M16.5 13.2h3v5h-3z" {...common} />
        <path d="M16.5 19.4c-.8.8-2.2 1.2-4.1 1.2" {...common} />
      </svg>
    );
  }

  if (name === 'trophy') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M8 4.8h8v3.8c0 3.2-1.7 5.4-4 6.1-2.3-.7-4-2.9-4-6.1z" {...common} />
        <path d="M8 6.5H5.3v1.9c0 1.7 1.1 3 2.8 3.4" {...common} />
        <path d="M16 6.5h2.7v1.9c0 1.7-1.1 3-2.8 3.4" {...common} />
        <path d="M12 14.7v3.4" {...common} />
        <path d="M8.5 20h7" {...common} />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4.5 19.5h15" {...common} />
      <path d="M5.5 16.5 10 12l3 3 5.5-6" {...common} />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="installer-login-google-icon" viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.23c1.89-1.74 2.99-4.31 2.99-7.42Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.89 6.61-2.42l-3.23-2.55c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.63A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 13.87A6.02 6.02 0 0 1 6.08 12c0-.65.11-1.28.32-1.87V7.5H3.06A10 10 0 0 0 2 12c0 1.61.38 3.13 1.06 4.5l3.34-2.63Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.34 2.63c.79-2.36 3-4.12 5.6-4.12Z"
        fill="#EA4335"
      />
    </svg>
  );
}

const installerBenefits = [
  {
    icon: 'user',
    title: 'Pedidos da sua região',
    copy: 'Veja solicitações compatíveis com o seu perfil',
  },
  {
    icon: 'star',
    title: 'Perfil profissional',
    copy: 'Mostre fotos, avaliações e regiões atendidas',
  },
  {
    icon: 'shield',
    title: 'Agenda e orçamentos',
    copy: 'Organize os atendimentos no mesmo painel',
  },
  {
    icon: 'chart',
    title: 'Plano Grátis permanente',
    copy: 'Comece sem cobrança e evolua para o Pro quando precisar',
  },
];

const trustItems = [
  {
    icon: 'shield',
    title: 'Sessão protegida',
    copy: 'Acesso com senha e recuperação por e-mail.',
  },
  {
    icon: 'headset',
    title: 'Suporte pelo painel',
    copy: 'Envie suas dúvidas diretamente ao administrador.',
  },
  {
    icon: 'trophy',
    title: 'Perfil público',
    copy: 'Clientes podem consultar seus trabalhos e avaliações.',
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { loading, login, logout, user } = useAuth();
  const authCapabilities = useAuthCapabilities();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const canUseGoogle = authCapabilities.oauth.google && !isIosInstallerApp();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (user?.account_type === 'installer' || user?.is_admin) {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (user?.account_type === 'client') {
      if (IS_INSTALLER_APP) {
        logout();
        toast.error('Este aplicativo é exclusivo para contas de instalador.');
      } else {
        navigate('/cliente', { replace: true });
      }
    }
  }, [loading, logout, navigate, user]);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('oauth_error');

    if (error) {
      toast.error(getOAuthErrorMessage(error));
      clearOAuthErrorFromUrl();
    }
  }, []);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      await login(
        { ...form, email: form.email.trim().toLowerCase(), account_type: 'installer' },
        { remember: rememberMe }
      );

      toast.success('Acesso liberado.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const suggestedPortal = error.response?.data?.suggested_portal;
      toast.error(
        IS_INSTALLER_APP && suggestedPortal
          ? 'Este aplicativo aceita somente contas de instalador.'
          : getAuthRequestErrorMessage(error)
      );
      if (suggestedPortal) {
        if (!IS_INSTALLER_APP) {
          navigate(suggestedPortal, { replace: true });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    if (oauthSubmitting) {
      return;
    }

    setOauthSubmitting(true);

    try {
      await startSocialLogin(provider, {
        role: 'installer',
        next: '/dashboard',
        platform: getNativeStorePlatform(),
      });
    } catch (_error) {
      toast.error('Não foi possível abrir o login com o Google. Tente novamente.');
    } finally {
      setOauthSubmitting(false);
    }
  };

  return (
    <main className={`installer-login-page${IS_INSTALLER_APP ? ' installer-app-login-page' : ' auth-web-login'}`}>
      <Link className="auth-login-back" to={IS_INSTALLER_APP ? '/instalador/boas-vindas' : '/'}>
        <span aria-hidden="true">←</span> Voltar
      </Link>
      <section className={`installer-login-frame${IS_INSTALLER_APP ? ' installer-app-login-frame' : ''}`}>
        {!IS_INSTALLER_APP ? (
          <div className="installer-login-left">
          <img alt="" className="installer-login-worker-photo" src="/auth/installer-login-worker-instalapro.jpg" />
          <div className="installer-login-left-overlay" />

          <div className="installer-login-brand">
            <BrandWordmark className="installer-login-brand-logo" size="md" />
          </div>

          <div className="installer-login-copy">
            <p className="installer-login-kicker">ÁREA DO INSTALADOR</p>
            <h1 aria-label="Acesse seu painel de instalador.">
              Acesse seu
              <br />
              <span>painel de instalador.</span>
            </h1>
            <p className="installer-login-description">
              Consulte pedidos da região, organize a agenda e envie orçamentos.
            </p>

            <div className="installer-login-benefits">
              {installerBenefits.map((item) => (
                <article key={item.title}>
                  <span className="installer-login-benefit-icon">
                    <InstallerLoginIcon name={item.icon} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          </div>
        ) : null}

        <div className="installer-login-right">
          {IS_INSTALLER_APP ? (
            <div className="installer-app-login-top">
              <BrandWordmark className="installer-app-login-logo" size="md" />
              <Link to="/instalador/boas-vindas">
                <span aria-hidden="true">←</span>
                Apresentação
              </Link>
            </div>
          ) : null}

          <form
            className={`installer-login-card${IS_INSTALLER_APP ? ' installer-app-login-card' : ''}`}
            onSubmit={handleSubmit}
          >
            {!IS_INSTALLER_APP ? (
              <div className="installer-login-avatar">
                <InstallerLoginIcon name="user" />
              </div>
            ) : (
              <p className="installer-app-login-kicker">ÁREA DO INSTALADOR</p>
            )}

            <div className="installer-login-card-head">
              <h2>{IS_INSTALLER_APP ? 'Entrar' : 'Entrar como instalador'}</h2>
              <p>
                {IS_INSTALLER_APP
                  ? 'Acesse sua conta para ver novas oportunidades.'
                  : 'Use o e-mail e a senha informados no cadastro.'}
              </p>
            </div>

            <label className="installer-login-field">
              <span>E-mail</span>
              <div className="installer-login-input-wrap">
                <InstallerLoginIcon name="mail" />
                <input
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  inputMode="email"
                  name="email"
                  onChange={handleChange}
                  placeholder="seu@email.com"
                  required
                  spellCheck={false}
                  type="email"
                  value={form.email}
                />
              </div>
            </label>

            <label className="installer-login-field">
              <span>Senha</span>
              <div className="installer-login-input-wrap">
                <InstallerLoginIcon name="lock" />
                <input
                  autoCapitalize="none"
                  autoComplete="current-password"
                  autoCorrect="off"
                  name="password"
                  onChange={handleChange}
                  placeholder="Digite sua senha"
                  required
                  spellCheck={false}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                />
                <button
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="installer-login-eye"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  <InstallerLoginIcon name="eye" />
                </button>
              </div>
            </label>

            <div className="installer-login-options">
              <label className="installer-login-remember">
                <input
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  type="checkbox"
                />
                <span>Lembrar de mim</span>
              </label>

              {authCapabilities.password_reset ? (
                <Link className="installer-login-forgot" to="/instalador/recuperar-senha">
                  Esqueceu sua senha?
                </Link>
              ) : null}
            </div>

            <button className="installer-login-submit" disabled={submitting} type="submit">
              <span>{submitting ? 'Entrando...' : 'Entrar'}</span>
              <InstallerLoginIcon name="arrow" />
            </button>

            {canUseGoogle ? (
              <>
                <div className="installer-login-divider">
                  <span />
                  <p>ou</p>
                  <span />
                </div>

                <div className="installer-login-socials">
                  {canUseGoogle ? (
                    <button
                      className="auth-google-button"
                      disabled={oauthSubmitting}
                      onClick={() => handleSocialLogin('google')}
                      type="button"
                    >
                      <GoogleIcon />
                      <span>{oauthSubmitting ? 'Abrindo Google...' : 'Continuar com Google'}</span>
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

            <p className="installer-login-register">
              Ainda não tem uma conta?{' '}
              <Link to="/instalador/cadastro">Cadastre-se agora</Link>
            </p>
          </form>
        </div>

        {!IS_INSTALLER_APP ? (
          <div className="installer-login-trust-bar">
            {trustItems.map((item) => (
              <article key={item.title}>
                <span className="installer-login-trust-icon">
                  <InstallerLoginIcon name={item.icon} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.copy}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
