import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { startSocialLogin } from '../../services/auth';
import { clearOAuthErrorFromUrl, getOAuthErrorMessage } from '../../utils/oauthMessages';
import { getAuthRequestErrorMessage } from '../../utils/authErrorMessage';
import useAuthCapabilities from '../../hooks/useAuthCapabilities';
import BrandWordmark from '../Layout/BrandWordmark';

function ClientLoginIcon({ name }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  };

  if (name === 'helmet') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 11.5a7 7 0 0 1 14 0V14H5z" {...common} />
        <path d="M8 14v4.2h8V14" {...common} />
        <path d="M10 5.2V11" {...common} />
        <path d="M14 5.2V11" {...common} />
        <path d="M4 18.2h16" {...common} />
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

  if (name === 'shield') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3.5 18.5 6v5.8c0 4.1-2.7 7.2-6.5 8.7-3.8-1.5-6.5-4.6-6.5-8.7V6z" {...common} />
        <path d="m8.9 12 2 2 4.3-4.6" {...common} />
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

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20 11.5a8 8 0 0 1-11.8 7l-3.4 1 1.1-3.2A8 8 0 1 1 20 11.5Z" {...common} />
      <path d="M8.5 11.5h.1M12 11.5h.1M15.5 11.5h.1" {...common} />
    </svg>
  );
}

const benefitItems = [
  {
    icon: 'shield',
    title: 'Profissionais verificados',
    copy: 'Todos os instaladores passam por uma análise completa.',
  },
  {
    icon: 'star',
    title: 'Avaliações reais',
    copy: 'Veja a experiência de outros clientes antes de contratar.',
  },
  {
    icon: 'chat',
    title: 'Contato direto',
    copy: 'Fale diretamente com o instalador sem intermediarios.',
  },
];

function sanitizeClientNextPath(value) {
  const nextPath = String(value?.pathname ? `${value.pathname}${value.search || ''}${value.hash || ''}` : value || '').trim();

  if ((nextPath.startsWith('/cliente') || nextPath.startsWith('/installers/')) && !nextPath.startsWith('//')) {
    return nextPath;
  }

  return '/cliente';
}

export default function ClientLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, login, registerClient, user } = useAuth();
  const authCapabilities = useAuthCapabilities();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', twoFactorToken: '' });
  const [needs2FA, setNeeds2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submitLabel = useMemo(
    () => (isRegistering ? 'Criar minha conta' : needs2FA ? 'Validar acesso' : 'Entrar'),
    [isRegistering, needs2FA]
  );
  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return sanitizeClientNextPath(params.get('next') || location.state?.from);
  }, [location.search, location.state]);
  const isInstallerIntent = nextPath.startsWith('/installers/');

  useEffect(() => {
    if (loading) {
      return;
    }

    if (user?.account_type === 'client') {
      navigate(nextPath, { replace: true });
      return;
    }

    if (user?.account_type === 'installer' || user?.is_admin) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, navigate, nextPath, user]);

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
    setSubmitting(true);

    try {
      if (isRegistering) {
        if (form.password.length < 10 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
          toast.error('Use pelo menos 10 caracteres, com letras e números.');
          return;
        }

        await registerClient({
          name: form.name,
          phone: form.phone,
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        toast.success('Conta criada. Seus pedidos ficarão salvos aqui.');
        navigate(nextPath, { replace: true });
        return;
      }

      const result = await login({ ...form, email: form.email.trim().toLowerCase(), account_type: 'client' });

      if (result.twoFactorRequired) {
        setNeeds2FA(true);
        toast('Digite o código 2FA para concluir o acesso.');
        return;
      }

      toast.success('Login realizado.');
      navigate(nextPath, { replace: true });
    } catch (error) {
      if (error.response?.status === 401 && error.response?.data?.twoFactorRequired) {
        setNeeds2FA(true);
        toast('Digite o código 2FA para concluir o acesso.');
        return;
      }

      const suggestedPortal = error.response?.data?.suggested_portal;
      toast.error(getAuthRequestErrorMessage(error));
      if (suggestedPortal) {
        navigate(suggestedPortal, { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRegistration = () => {
    setIsRegistering((current) => !current);
    setNeeds2FA(false);
  };

  const handleSocialLogin = (provider) => {
    startSocialLogin(provider, { role: 'client', next: nextPath });
  };

  return (
    <main className="client-login-page">
      <section className="client-login-frame">
        <div className="client-login-left">
          <img alt="" className="client-login-bg" src="/landing/sala-preto-dourado.png" />
          <div className="client-login-left-overlay" />

          <div className="client-login-brand">
            <BrandWordmark className="client-login-brand-logo" size="md" />
          </div>

          <div className="client-login-copy">
            <p className="client-login-kicker">ÁREA DO CLIENTE</p>
            <h1>
              Entre para <span>acompanhar seus pedidos.</span>
            </h1>
            <p className="client-login-description">
              Seus pedidos e os instaladores interessados ficam salvos na sua conta.
            </p>

            <div className="client-login-benefits">
              {benefitItems.map((item) => (
                <article key={item.title}>
                  <span className="client-login-benefit-icon">
                    <ClientLoginIcon name={item.icon} />
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

        <div className="client-login-right">
          <Link className="client-login-installer-link" to="/instalador/entrar">
            <span className="client-login-installer-icon">
              <ClientLoginIcon name="helmet" />
            </span>
            <span>Entrar como instalador</span>
            <ClientLoginIcon name="arrow" />
          </Link>

          <form className="client-login-card" onSubmit={handleSubmit}>
            <div className="client-login-avatar">
              <ClientLoginIcon name="user" />
            </div>

            <div className="client-login-card-head">
              <h2>
                {isRegistering
                  ? 'Crie sua conta de cliente'
                  : isInstallerIntent
                    ? 'Finalize seu acesso'
                    : 'Entrar como cliente'}
              </h2>
              <p>
                {isRegistering
                  ? 'Salve seus pedidos e acompanhe os interessados em qualquer aparelho.'
                  : isInstallerIntent
                  ? 'Entre para falar com o instalador escolhido.'
                  : 'Use o e-mail e a senha informados no cadastro.'}
              </p>
            </div>

            {isRegistering ? (
              <>
                <label className="client-login-field">
                  <span>Nome</span>
                  <div className="client-login-input-wrap">
                    <ClientLoginIcon name="user" />
                    <input
                      autoComplete="name"
                      name="name"
                      onChange={handleChange}
                      placeholder="Seu nome"
                      required
                      value={form.name}
                    />
                  </div>
                </label>
                <label className="client-login-field">
                  <span>WhatsApp</span>
                  <div className="client-login-input-wrap">
                    <ClientLoginIcon name="chat" />
                    <input
                      autoComplete="tel"
                      inputMode="tel"
                      name="phone"
                      onChange={handleChange}
                      placeholder="(48) 99999-9999"
                      required
                      value={form.phone}
                    />
                  </div>
                </label>
              </>
            ) : null}

            <label className="client-login-field">
              <span>E-mail</span>
              <div className="client-login-input-wrap">
                <ClientLoginIcon name="mail" />
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

            <label className="client-login-field">
              <span>Senha</span>
              <div className="client-login-input-wrap">
                <ClientLoginIcon name="lock" />
                <input
                  autoCapitalize="none"
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
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
                  className="client-login-eye"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  <ClientLoginIcon name="eye" />
                </button>
              </div>
            </label>

            {needs2FA && !isRegistering ? (
              <label className="client-login-field">
                <span>Código 2FA</span>
                <div className="client-login-input-wrap">
                  <ClientLoginIcon name="lock" />
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    name="twoFactorToken"
                    onChange={handleChange}
                    placeholder="000000"
                    value={form.twoFactorToken}
                  />
                </div>
              </label>
            ) : null}

            {authCapabilities.password_reset && !isRegistering ? (
              <Link className="client-login-forgot" to="/cliente/recuperar-senha">
                Esqueceu sua senha?
              </Link>
            ) : null}

            <button className="client-login-submit" disabled={submitting} type="submit">
              <span>{submitting ? 'Aguarde...' : submitLabel}</span>
              <ClientLoginIcon name="arrow" />
            </button>

            {!isRegistering && authCapabilities.oauth.google ? (
              <>
                <div className="client-login-divider">
                  <span />
                  <p>ou entre com</p>
                  <span />
                </div>

                <div className="client-login-socials">
                  {authCapabilities.oauth.google ? (
                    <button onClick={() => handleSocialLogin('google')} type="button">
                      <span className="client-login-google">G</span>
                      <span>Google</span>
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

            <p className="client-login-register">
              {isRegistering ? 'Já tem uma conta? ' : 'Ainda não tem uma conta? '}
              <button onClick={toggleRegistration} type="button">
                {isRegistering ? 'Entrar' : 'Cadastre-se'}
              </button>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
