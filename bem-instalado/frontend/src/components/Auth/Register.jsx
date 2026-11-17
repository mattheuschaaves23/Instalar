import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../Layout/AuthShell';
import PasswordField from './PasswordField';
import Turnstile, { isTurnstileEnabled } from '../Security/Turnstile';

const highlights = [
  {
    kicker: 'Perfil público',
    title: 'Mostre seu trabalho',
    copy: 'Fotos, regiões atendidas, estilo de instalação e prova social no mesmo perfil.',
  },
  {
    kicker: 'Comercial',
    title: 'Feche mais serviços',
    copy: 'Orçamentos em PDF para enviar ao cliente e acompanhar o status.',
  },
  {
    kicker: 'Operação',
    title: 'Rotina organizada',
    copy: 'Agenda por dia, clientes, notificações e suporte direto no painel.',
  },
];

const PLAN_PRICE = Number(process.env.REACT_APP_SUBSCRIPTION_PRICE || 49.9);
const IS_INSTALLER_APP = process.env.REACT_APP_INSTALLER_APP === 'true';
const planBenefits = [
  'Dashboard com os números essenciais do mês.',
  'Agenda visual por dia para não perder instalação.',
  'Orçamentos com PDF pronto para compartilhar.',
  'Perfil público para atrair novos clientes.',
  'Suporte interno com chat para dúvidas e melhorias.',
];

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '',
    business_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name || !form.email || !form.password) {
      toast.error('Preencha nome, e-mail e senha.');
      return;
    }

    if (form.password.length < 10 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      toast.error('Use pelo menos 10 caracteres, com letras e números.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error('A confirmação de senha não confere.');
      return;
    }

    if (isTurnstileEnabled() && !turnstileToken) {
      toast.error('Conclua a verificação de segurança antes de criar sua conta.');
      return;
    }

    try {
      await register({
        name: form.name,
        business_name: form.business_name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        account_type: 'installer',
        turnstile_token: turnstileToken,
      });

      toast.success('Conta criada. Seu plano Grátis permanente já está ativo.');
      navigate('/dashboard');
    } catch (error) {
      setTurnstileToken('');
      setTurnstileResetKey((current) => current + 1);
      toast.error(error.response?.data?.error || 'Não foi possível criar a conta.');
    }
  };

  return (
    <AuthShell
      asideCopy="Criar conta"
      asideTitle="Cadastro"
      description="Cadastre seus dados profissionais para acessar pedidos, agenda e orçamentos."
      eyebrow="InstalarPro"
      highlights={highlights}
      title="Crie sua conta de instalador."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="field-label">Nome</span>
          <input className="field-input" name="name" onChange={handleChange} placeholder="Seu nome" value={form.name} />
        </label>

        <label className="block">
          <span className="field-label">Nome da empresa</span>
          <input
            className="field-input"
            name="business_name"
            onChange={handleChange}
            placeholder="Nome da sua marca"
            value={form.business_name}
          />
        </label>

        <label className="block">
          <span className="field-label">Email</span>
          <input
            className="field-input"
            name="email"
            onChange={handleChange}
            placeholder="seu@email.com"
            type="email"
            value={form.email}
          />
        </label>

        <PasswordField
          autoComplete="new-password"
          label="Senha"
          name="password"
          onChange={handleChange}
          placeholder="Crie uma senha"
          value={form.password}
        />

        <PasswordField
          autoComplete="new-password"
          label="Confirmar senha"
          name="confirmPassword"
          onChange={handleChange}
          placeholder="Repita sua senha"
          value={form.confirmPassword}
        />

        <label className="block">
          <span className="field-label">Telefone</span>
          <input
            className="field-input"
            name="phone"
            onChange={handleChange}
            placeholder="(00) 00000-0000"
            value={form.phone}
          />
        </label>

        <section className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
          <p className="field-label">Plano do instalador</p>
          <p className="mt-1 text-lg font-semibold text-[var(--gold-strong)]">Grátis, sem prazo para acabar</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Comece sem cobrança. Quando precisar de mais volume, assine o Pro por R$ {PLAN_PRICE.toFixed(2)}/mês.
          </p>
          <div className="mt-3 grid gap-2">
            {planBenefits.map((benefit) => (
              <p className="text-sm text-[var(--muted)]" key={benefit}>
                • {benefit}
              </p>
            ))}
          </div>
        </section>

        <Turnstile
          action="installer_register"
          onExpire={() => setTurnstileToken('')}
          onVerify={setTurnstileToken}
          resetKey={turnstileResetKey}
        />

        <button className="gold-button w-full" disabled={isTurnstileEnabled() && !turnstileToken} type="submit">
          Criar conta
        </button>
      </form>

      <div className="auth-helper-card mt-5">
        <p className="text-sm text-[var(--muted)]">
          Já tem conta?{' '}
          <Link className="font-semibold text-[var(--gold-strong)]" to="/instalador/entrar">
            Entrar no painel
          </Link>
        </p>
        {!IS_INSTALLER_APP && (
          <p className="mt-2 text-sm text-[var(--muted)]">
            É cliente e quer buscar profissionais?{' '}
            <Link className="font-semibold text-[var(--gold-strong)]" to="/cliente">
              Ir para área do cliente
            </Link>
            .
          </p>
        )}
      </div>
    </AuthShell>
  );
}
