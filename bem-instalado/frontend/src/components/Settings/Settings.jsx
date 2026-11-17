import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import PageIntro from '../Layout/PageIntro';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import api from '../../services/api';
import { readSitePreferences, resetSitePreferences, saveSitePreferences } from '../../utils/sitePreferences';
import { useSubscription } from '../../contexts/SubscriptionContext';

const densityOptions = [
  { value: 'comfortable', label: 'Espaçosa', detail: 'Mais respiro' },
  { value: 'compact', label: 'Compacta', detail: 'Mais informação' },
];

const themeOptions = [
  { value: 'light', label: 'Branco', detail: 'Tema principal' },
  { value: 'dark', label: 'Preto', detail: 'Versão escura' },
];

const motionOptions = [
  { value: 'smooth', label: 'Suaves', detail: 'Padrão' },
  { value: 'reduced', label: 'Reduzidas', detail: 'Menos movimento' },
];

function SettingsIcon({ type }) {
  const sharedProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  const icons = {
    layout: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 10h16M9 10v9" /></>,
    motion: <><path d="M4 16c4-8 8 8 12 0" /><path d="M16 8h4v4" /><path d="M20 8c-3.5 7-7-7-11 0" /></>,
    reset: <><path d="M20 12a8 8 0 1 1-2.4-5.7" /><path d="M20 4v5h-5" /></>,
    check: <path d="M5 12.5 10 17l9-10" />,
    download: <><path d="M12 4v10" /><path d="m8.5 10.5 3.5 3.5 3.5-3.5" /><path d="M5 19h14" /></>,
    trash: <><path d="M4.5 7h15" /><path d="M9 7V4.8h6V7" /><path d="m7 7 .7 12h8.6L17 7" /><path d="M10 10.5v5M14 10.5v5" /></>,
  };

  return <svg {...sharedProps}>{icons[type] || icons.layout}</svg>;
}

function PreferenceSegment({ label, options, value, onChange }) {
  return (
    <div className="settings-control-block">
      <p>{label}</p>
      <div className="settings-segment" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            className={value === option.value ? 'is-selected' : ''}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <strong>{option.label}</strong>
            <span>{option.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const { isPro, loading: planLoading, subscription } = useSubscription();
  const confirm = useConfirm();
  const [preferences, setPreferences] = useState(() => readSitePreferences());
  const [savedAt, setSavedAt] = useState(() => new Date());
  const [deletePhrase, setDeletePhrase] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);

  const firstName = user?.name?.split(' ')[0] || 'usuário';

  const savePreference = (patch) => {
    if (subscription && !isPro && patch.density === 'compact') {
      toast('O modo compacto está disponível no plano Pro.');
      return;
    }

    setPreferences((currentPreferences) => {
      const nextPreferences = saveSitePreferences({ ...currentPreferences, ...patch });
      setSavedAt(new Date());
      return nextPreferences;
    });
  };

  const handleReset = () => {
    const nextPreferences = resetSitePreferences();
    setPreferences(nextPreferences);
    setSavedAt(new Date());
    toast.success('Configurações restauradas.');
  };

  useEffect(() => {
    if (!planLoading && subscription && !isPro && preferences.density === 'compact') {
      const nextPreferences = saveSitePreferences({
        ...preferences,
        density: 'comfortable',
      });
      setPreferences(nextPreferences);
    }
  }, [isPro, planLoading, preferences, subscription]);

  const handleDeleteAccount = async (event) => {
    event.preventDefault();

    if (deletePhrase.trim().toUpperCase() !== 'EXCLUIR') {
      toast.error('Digite EXCLUIR para confirmar.');
      return;
    }

    const accepted = await confirm({
      title: 'Excluir conta definitivamente?',
      message: 'A conta, o perfil, os pedidos e os dados vinculados serão removidos. Uma assinatura recorrente ativa será cancelada. Esta ação não pode ser desfeita.',
      confirmText: 'Excluir minha conta',
      cancelText: 'Manter minha conta',
      tone: 'danger',
    });

    if (!accepted) {
      return;
    }

    try {
      setIsDeletingAccount(true);
      await api.delete('/users/account', { data: { confirmation: 'EXCLUIR' } });
      await logout();
      window.location.replace('/instalador/entrar?conta=excluida');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível excluir a conta agora.');
      setIsDeletingAccount(false);
    }
  };

  const handleDataExport = async () => {
    try {
      setIsExportingData(true);
      const response = await api.get('/users/data-export', { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `instalapro-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Sua cópia de dados foi baixada.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível preparar a cópia agora.');
    } finally {
      setIsExportingData(false);
    }
  };

  const stats = [
    {
      label: 'Fundo',
      value: preferences.theme === 'light' ? 'Branco' : 'Preto',
      detail: 'Tema deste dispositivo',
    },
    {
      label: 'Densidade',
      value: preferences.density === 'compact' ? 'Compacta' : 'Espaçosa',
      detail: 'Preferência da interface',
    },
    {
      label: 'Movimento',
      value: preferences.motion === 'reduced' ? 'Reduzido' : 'Suave',
      detail: 'Animações do painel',
    },
  ];

  return (
    <div className="page-shell settings-page">
      <PageIntro
        eyebrow="Conta"
        title="Configurações"
        description={`Ajustes do painel de ${firstName}: aparência, movimento e privacidade.`}
        actions={(
          <button className="ghost-button" onClick={handleReset} type="button">
            <SettingsIcon type="reset" />
            Restaurar padrão
          </button>
        )}
        stats={stats}
      />

      <section className="settings-layout">
        <article className="settings-panel">
          <div className="settings-section-head">
            <span><SettingsIcon type="layout" /></span>
            <div>
              <p>Interface</p>
              <h2>Organização visual</h2>
            </div>
          </div>

          <PreferenceSegment
            label="Fundo"
            onChange={(value) => savePreference({ theme: value })}
            options={themeOptions}
            value={preferences.theme}
          />

          <PreferenceSegment
            label="Espaçamento"
            onChange={(value) => savePreference({ density: value })}
            options={isPro ? densityOptions : densityOptions.slice(0, 1)}
            value={preferences.density}
          />

          <PreferenceSegment
            label="Animações"
            onChange={(value) => savePreference({ motion: value })}
            options={motionOptions}
            value={preferences.motion}
          />
        </article>

        <article className="settings-panel settings-panel--status">
          <div className="settings-save-state">
            <span><SettingsIcon type="check" /></span>
            <div>
              <p>Salvo automaticamente</p>
              <strong>{savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
            </div>
          </div>
          <small>
            As preferências ficam neste dispositivo e são aplicadas quando o painel abre.
          </small>
        </article>

        <article className="settings-panel settings-panel--danger">
          <div className="settings-section-head">
            <span><SettingsIcon type="trash" /></span>
            <div>
              <p>Privacidade</p>
              <h2>Exclusão da conta</h2>
            </div>
          </div>

          <div className="settings-export-row">
            <div>
              <h3>Uma cópia dos seus dados</h3>
              <p>Baixe as informações da sua conta, pedidos, propostas, agenda e pagamentos em JSON.</p>
            </div>
            <button className="settings-export-button" disabled={isExportingData} onClick={handleDataExport} type="button">
              <SettingsIcon type="download" />
              {isExportingData ? 'Preparando...' : 'Baixar meus dados'}
            </button>
          </div>

          {user?.is_admin ? (
            <p className="settings-danger-copy">
              A conta administrativa principal não pode ser excluída por esta tela. Transfira a
              administração antes de solicitar a exclusão pelo suporte.
            </p>
          ) : (
            <>
              <p className="settings-danger-copy">
                A exclusão é definitiva. Perfil, fotos, pedidos, agenda, orçamentos e demais dados
                ligados à conta serão removidos. Registros financeiros exigidos por lei podem ser
                conservados pelo provedor de pagamento durante o prazo legal.
              </p>

              <form className="settings-delete-form" onSubmit={handleDeleteAccount}>
                <label htmlFor="delete-account-confirmation">
                  Para confirmar, digite <strong>EXCLUIR</strong>
                </label>
                <div>
                  <input
                    autoComplete="off"
                    id="delete-account-confirmation"
                    onChange={(event) => setDeletePhrase(event.target.value)}
                    placeholder="EXCLUIR"
                    spellCheck="false"
                    value={deletePhrase}
                  />
                  <button
                    className="danger-button"
                    disabled={isDeletingAccount || deletePhrase.trim().toUpperCase() !== 'EXCLUIR'}
                    type="submit"
                  >
                    {isDeletingAccount ? 'Excluindo conta...' : 'Excluir minha conta'}
                  </button>
                </div>
              </form>
            </>
          )}

          <Link className="settings-privacy-link" to="/excluir-conta">
            Entenda o processo e quais dados são excluídos
          </Link>
        </article>
      </section>
    </div>
  );
}
