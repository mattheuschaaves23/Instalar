import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthShell from '../Layout/AuthShell';
import PasswordField from './PasswordField';
import { forgotPasswordRequest, resetPasswordRequest } from '../../services/auth';

export default function PasswordRecovery() {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get('token') || '';
  const [mode, setMode] = useState(initialToken ? 'reset' : 'request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const title = useMemo(
    () => (mode === 'reset' ? 'Crie uma nova senha para entrar.' : 'Recupere o acesso ao painel.'),
    [mode]
  );

  async function handleRequest(event) {
    event.preventDefault();

    if (!email) {
      toast.error('Informe seu e-mail.');
      return;
    }

    setLoading(true);

    try {
      const response = await forgotPasswordRequest({ email, account_type: 'installer' });
      toast.success(response.message || 'Se o e-mail existir, as instrucoes serao enviadas.');

      if (response.reset_url || response.reset_token) {
        setResetUrl(response.reset_url || '');
        setToken(response.reset_token || '');
        setMode('reset');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel iniciar a recuperacao.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();

    if (!token || !password) {
      toast.error('Informe o token e a nova senha.');
      return;
    }

    if (password.length < 8) {
      toast.error('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('A confirmacao de senha nao confere.');
      return;
    }

    setLoading(true);

    try {
      const response = await resetPasswordRequest({ token, password });
      toast.success(response.message || 'Senha redefinida com sucesso.');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel redefinir a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      asideCopy="Recuperar acesso"
      asideTitle="Senha"
      description="Use seu e-mail de instalador para gerar um link seguro de redefinicao."
      eyebrow="Instalar+"
      highlights={[
        { kicker: 'Seguro', title: 'Token temporario', copy: 'O link expira automaticamente.' },
        { kicker: 'Conta', title: 'Somente instalador', copy: 'A recuperacao valida a conta do painel.' },
        { kicker: 'Acesso', title: 'Nova senha', copy: 'Depois de trocar, volte para o login normalmente.' },
      ]}
      title={title}
    >
      {mode === 'request' ? (
        <form className="space-y-4" onSubmit={handleRequest}>
          <label className="block">
            <span className="field-label">E-mail de instalador</span>
            <input
              autoComplete="email"
              className="field-input"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              required
              type="email"
              value={email}
            />
          </label>

          <button className="gold-button w-full" disabled={loading} type="submit">
            {loading ? 'Enviando...' : 'Recuperar senha'}
          </button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleReset}>
          {resetUrl ? (
            <div className="auth-helper-card">
              <p className="text-sm text-[var(--muted)]">Link de redefinicao gerado:</p>
              <a
                className="mt-2 block break-all font-semibold text-[var(--gold-strong)]"
                href={resetUrl}
              >
                {resetUrl}
              </a>
            </div>
          ) : null}

          <label className="block">
            <span className="field-label">Token de recuperacao</span>
            <input
              className="field-input"
              name="token"
              onChange={(event) => setToken(event.target.value)}
              placeholder="Cole o token recebido"
              required
              value={token}
            />
          </label>

          <PasswordField
            autoComplete="new-password"
            label="Nova senha"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Digite a nova senha"
            value={password}
          />

          <PasswordField
            autoComplete="new-password"
            label="Confirmar nova senha"
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repita a nova senha"
            value={confirmPassword}
          />

          <button className="gold-button w-full" disabled={loading} type="submit">
            {loading ? 'Salvando...' : 'Redefinir senha'}
          </button>
        </form>
      )}

      <div className="auth-helper-card mt-5">
        <p className="text-sm text-[var(--muted)]">
          Lembrou sua senha?{' '}
          <Link className="font-semibold text-[var(--gold-strong)]" to="/instalador/entrar">
            Voltar para o login
          </Link>
        </p>
        {mode === 'reset' ? (
          <button
            className="mt-3 text-sm font-semibold text-[var(--gold-strong)]"
            onClick={() => setMode('request')}
            type="button"
          >
            Gerar outro token
          </button>
        ) : null}
      </div>
    </AuthShell>
  );
}
