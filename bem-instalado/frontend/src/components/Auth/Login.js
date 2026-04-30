import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

function InstallerLoginLogoMark() {
  return (
    <svg aria-hidden="true" className="installer-login-logo-mark" viewBox="0 0 64 64">
      <path d="M32 5.5 54 18.5v27L32 58.5 10 45.5v-27z" />
      <path d="M21 44V25.5L32 19l11 6.5V44" />
      <path d="M28 44V32h8v12" />
    </svg>
  );
}

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

  if (name === 'apple') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M16.8 12.6c0-2 1.7-3 1.8-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.7 0-1.7-.7-2.7-.6-1.4 0-2.7.8-3.4 2-1.5 2.6-.4 6.4 1 8.5.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.9.7 1.9-1 2.6-2.1c.8-1.2 1.2-2.4 1.2-2.4 0-.1-2.9-1.1-3-3.5Z"
          fill="currentColor"
        />
        <path d="M14.9 6.6c.6-.7 1-1.7.9-2.6-.9.1-1.9.6-2.5 1.3-.6.7-1.1 1.6-.9 2.5.9.1 1.9-.5 2.5-1.2Z" fill="currentColor" />
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

const installerBenefits = [
  {
    icon: 'user',
    title: 'Mais clientes',
    copy: 'Receba solicitações todos os dias',
  },
  {
    icon: 'star',
    title: 'Seu perfil em destaque',
    copy: 'Destaque suas avaliações e trabalhos realizados',
  },
  {
    icon: 'shield',
    title: 'Pagamentos seguros',
    copy: 'Negocie com segurança e receba com tranquilidade',
  },
  {
    icon: 'chart',
    title: 'Cresça com a gente',
    copy: 'Mais visibilidade, mais oportunidades, mais resultados',
  },
];

const trustItems = [
  {
    icon: 'shield',
    title: 'Plataforma segura',
    copy: 'Seus dados e pagamentos protegidos sempre.',
  },
  {
    icon: 'headset',
    title: 'Suporte dedicado',
    copy: 'Conte com nosso time sempre que precisar.',
  },
  {
    icon: 'trophy',
    title: 'Profissionais valorizados',
    copy: 'Seu trabalho reconhecido e sua reputação cresce.',
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', twoFactorToken: '' });
  const [needs2FA, setNeeds2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const submitLabel = useMemo(() => (needs2FA ? 'Validar acesso' : 'Entrar na plataforma'), [needs2FA]);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const result = await login(form);

      if (result.twoFactorRequired) {
        setNeeds2FA(true);
        toast('Digite o código 2FA para concluir o acesso.');
        return;
      }

      toast.success('Acesso liberado.');
      navigate('/dashboard');
    } catch (error) {
      if (error.response?.status === 401 && error.response?.data?.twoFactorRequired) {
        setNeeds2FA(true);
        toast('Digite o código 2FA para concluir o acesso.');
        return;
      }

      toast.error(error.response?.data?.error || 'Não foi possível entrar.');
    }
  };

  const showPendingMessage = () => {
    toast('Recurso em preparação.');
  };

  return (
    <main className="installer-login-page">
      <section className="installer-login-frame">
        <div className="installer-login-left">
          <img alt="" className="installer-login-worker-photo" src="/auth/installer-login-worker.png" />
          <div className="installer-login-left-overlay" />

          <div className="installer-login-brand">
            <InstallerLoginLogoMark />
            <div className="installer-login-wordmark">
              <strong>INSTALA<span>+</span></strong>
              <small>INSTALADORES DE PAPEL DE PAREDE</small>
            </div>
          </div>

          <div className="installer-login-copy">
            <p className="installer-login-kicker">ÁREA DO INSTALADOR</p>
            <h1>
              Conecte-se a mais
              <br />
              oportunidades e
              <br />
              <span>faça seu trabalho</span>
              <br />
              <span>crescer.</span>
            </h1>
            <p className="installer-login-description">
              A plataforma que valoriza o seu trabalho e conecta você a clientes que buscam qualidade.
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

        <div className="installer-login-right">
          <form className="installer-login-card" onSubmit={handleSubmit}>
            <div className="installer-login-avatar">
              <InstallerLoginIcon name="user" />
            </div>

            <div className="installer-login-card-head">
              <h2>Bem-vindo de volta!</h2>
              <p>Faça login para acessar sua conta de instalador.</p>
            </div>

            <label className="installer-login-field">
              <span>E-mail</span>
              <div className="installer-login-input-wrap">
                <InstallerLoginIcon name="mail" />
                <input
                  autoComplete="email"
                  name="email"
                  onChange={handleChange}
                  placeholder="seu@email.com"
                  required
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
                  autoComplete="current-password"
                  name="password"
                  onChange={handleChange}
                  placeholder="Digite sua senha"
                  required
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

            {needs2FA ? (
              <label className="installer-login-field">
                <span>Código 2FA</span>
                <div className="installer-login-input-wrap">
                  <InstallerLoginIcon name="lock" />
                  <input
                    autoComplete="one-time-code"
                    name="twoFactorToken"
                    onChange={handleChange}
                    placeholder="000000"
                    value={form.twoFactorToken}
                  />
                </div>
              </label>
            ) : null}

            <div className="installer-login-options">
              <label className="installer-login-remember">
                <input
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  type="checkbox"
                />
                <span>Lembrar de mim</span>
              </label>

              <button className="installer-login-forgot" onClick={showPendingMessage} type="button">
                Esqueceu sua senha?
              </button>
            </div>

            <button className="installer-login-submit" type="submit">
              <span>{submitLabel}</span>
              <InstallerLoginIcon name="arrow" />
            </button>

            <div className="installer-login-divider">
              <span />
              <p>ou continue com</p>
              <span />
            </div>

            <div className="installer-login-socials">
              <button onClick={showPendingMessage} type="button">
                <span className="installer-login-google">G</span>
                <span>Entrar com Google</span>
              </button>
              <button onClick={showPendingMessage} type="button">
                <span className="installer-login-apple">
                  <InstallerLoginIcon name="apple" />
                </span>
                <span>Entrar com Apple</span>
              </button>
            </div>

            <p className="installer-login-register">
              Ainda não tem uma conta?{' '}
              <Link to="/instalador/cadastro">Cadastre-se agora</Link>
            </p>
          </form>
        </div>

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
      </section>
    </main>
  );
}
