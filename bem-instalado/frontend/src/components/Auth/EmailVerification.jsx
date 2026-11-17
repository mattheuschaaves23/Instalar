import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { resendEmailVerificationRequest, verifyEmailRequest } from '../../services/auth';

export function EmailVerificationNotice() {
  const { user, retryProfile } = useAuth();
  const [sending, setSending] = useState(false);

  if (!user || user.email_verified) return null;

  const resend = async () => {
    try {
      setSending(true);
      const result = await resendEmailVerificationRequest();
      toast.success(result.already_verified ? 'Seu e-mail já está confirmado.' : 'Enviamos um novo link para seu e-mail.');
      await retryProfile();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível reenviar agora.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="email-verification-notice">
      <p><strong>Confirme seu e-mail.</strong> Enviamos um link para {user.email}; até confirmar, ações profissionais ficam bloqueadas.</p>
      <button className="ghost-button" disabled={sending} onClick={resend} type="button">
        {sending ? 'Enviando...' : 'Reenviar link'}
      </button>
    </section>
  );
}

export default function EmailVerification() {
  const [params] = useSearchParams();
  const { retryProfile } = useAuth();
  const [state, setState] = useState({ loading: true, error: '' });

  useEffect(() => {
    let active = true;
    const token = params.get('token') || '';
    if (!token) {
      setState({ loading: false, error: 'O link de confirmação está incompleto.' });
      return undefined;
    }

    verifyEmailRequest(token)
      .then(async () => {
        await retryProfile().catch(() => null);
        if (active) {
          setState({ loading: false, error: '' });
          toast.success('E-mail confirmado. Sua conta está ativa.');
        }
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: error.response?.data?.error || 'Não foi possível confirmar este e-mail.' });
      });

    return () => { active = false; };
  }, [params, retryProfile]);

  return (
    <main className="oauth-callback-page">
      <section className="oauth-callback-card">
        <h1>{state.loading ? 'Confirmando seu e-mail...' : state.error ? 'Não foi possível confirmar' : 'E-mail confirmado'}</h1>
        <p>{state.loading ? 'Aguarde um instante.' : state.error || 'Você já pode voltar e continuar sua jornada na InstalarPro.'}</p>
        {!state.loading ? <Link to="/instalador/entrar">Ir para o login</Link> : null}
      </section>
    </main>
  );
}
