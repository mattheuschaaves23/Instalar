import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

function ClientLoginLogoMark() {
  return (
    <svg aria-hidden="true" className="client-login-logo-mark" viewBox="0 0 64 64">
      <path d="M32 5.5 54 18.5v27L32 58.5 10 45.5v-27z" />
      <path d="M21 44V25.5L32 19l11 6.5V44" />
      <path d="M28 44V32h8v12" />
    </svg>
  );
}

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
    copy: 'Todos os instaladores passam por uma analise completa.',
  },
  {
    icon: 'star',
    title: 'Avaliações reais',
    copy: 'Veja a experiencia de outros clientes antes de contratar.',
  },
  {
    icon: 'chat',
    title: 'Contato direto',
    copy: 'Fale diretamente com o instalador sem intermediarios.',
  },
];

export default function ClientLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', twoFactorToken: '' });
  const [needs2FA, setNeeds2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submitLabel = useMemo(() => (needs2FA ? 'Validar acesso' : 'Entrar'), [needs2FA]);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const result = await login(form);

      if (result.twoFactorRequired) {
        setNeeds2FA(true);
        toast('Digite o codigo 2FA para concluir o acesso.');
        return;
      }

      toast.success('Login realizado.');
      navigate('/cliente');
    } catch (error) {
      if (error.response?.status === 401 && error.response?.data?.twoFactorRequired) {
        setNeeds2FA(true);
        toast('Digite o codigo 2FA para concluir o acesso.');
        return;
      }

      toast.error(error.response?.data?.error || 'Nao foi possivel entrar.');
    }
  };

  const showPendingMessage = () => {
    toast('Recurso em preparacao.');
  };

  return (
    <main className="client-login-page">
      <section className="client-login-frame">
        <div className="client-login-left">
          <img alt="" className="client-login-bg" src="/landing/sala-preto-dourado.png" />
          <div className="client-login-left-overlay" />

          <div className="client-login-brand">
            <ClientLoginLogoMark />
            <div className="client-login-wordmark">
              <strong>INSTALA<span>+</span></strong>
              <small>INSTALADORES DE PAPEL DE PAREDE</small>
            </div>
          </div>

          <div className="client-login-copy">
            <p className="client-login-kicker">PARA QUEM BUSCA QUALIDADE</p>
            <h1>
              Encontre os melhores <span>instaladores de papel</span> de parede da sua região.
            </h1>
            <p className="client-login-description">
              Compare avaliações, veja trabalhos anteriores e contrate com segurança e praticidade.
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
              <h2>Bem-vindo de volta!</h2>
              <p>Faça login para acessar sua conta.</p>
            </div>

            <label className="client-login-field">
              <span>E-mail</span>
              <div className="client-login-input-wrap">
                <ClientLoginIcon name="mail" />
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

            <label className="client-login-field">
              <span>Senha</span>
              <div className="client-login-input-wrap">
                <ClientLoginIcon name="lock" />
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
                  className="client-login-eye"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  <ClientLoginIcon name="eye" />
                </button>
              </div>
            </label>

            {needs2FA ? (
              <label className="client-login-field">
                <span>Código 2FA</span>
                <div className="client-login-input-wrap">
                  <ClientLoginIcon name="lock" />
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

            <button className="client-login-forgot" onClick={showPendingMessage} type="button">
              Esqueceu sua senha?
            </button>

            <button className="client-login-submit" type="submit">
              <span>{submitLabel}</span>
              <ClientLoginIcon name="arrow" />
            </button>

            <div className="client-login-divider">
              <span />
              <p>ou entre com</p>
              <span />
            </div>

            <div className="client-login-socials">
              <button onClick={showPendingMessage} type="button">
                <span className="client-login-google">G</span>
                <span>Google</span>
              </button>
              <button onClick={showPendingMessage} type="button">
                <span className="client-login-apple">
                  <ClientLoginIcon name="apple" />
                </span>
                <span>Apple</span>
              </button>
            </div>

            <p className="client-login-register">
              Ainda não tem uma conta?{' '}
              <button onClick={showPendingMessage} type="button">
                Cadastre-se
              </button>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
