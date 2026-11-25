import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import api from '../../services/api';
import { readSitePreferences, resetSitePreferences, saveSitePreferences } from '../../utils/sitePreferences';
import { planLinkLabel } from '../../utils/storePlanCopy';
import './Settings.css';

const sections = [
  ['geral', 'Geral'], ['tema', 'Tema'], ['espacamento', 'Espaçamento'],
  ['animacoes', 'Animações'], ['meus-dados', 'Meus dados'], ['exclusao', 'Exclusão'],
];

const themeOptions = [
  { value: 'light', label: 'Claro', detail: 'Fundo claro para ambientes bem iluminados.' },
  { value: 'dark', label: 'Escuro', detail: 'Fundo preto e destaques em azul.' },
];
const densityOptions = [
  { value: 'comfortable', label: 'Espaçoso', detail: 'Mais espaço entre os itens.' },
  { value: 'compact', label: 'Compacto', detail: 'Mais itens na tela, com menos espaço.', pro: true },
];
const motionOptions = [
  { value: 'smooth', label: 'Suaves', detail: 'Transições normais do painel.', icon: 'motion' },
  { value: 'reduced', label: 'Reduzidas', detail: 'Menos movimento ao navegar.', icon: 'screen' },
];

function SettingsIcon({ name, size = 20 }) {
  const icons = {
    theme: <><path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 1.4-2.9 1.7 1.7 0 0 1 1.3-2.6H18a3 3 0 0 0 3-3C21 7 17 3 12 3Z" /><path d="M7 12h.1M9 7.5h.1M13.5 7h.1M17 10h.1" strokeWidth="2.6" /></>,
    spacing: <><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /></>,
    motion: <><rect x="7" y="8" width="14" height="12" rx="2" /><path d="M3 15V5a2 2 0 0 1 2-2h11" /></>,
    screen: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M12 17v4m-4 0h8" /></>,
    reset: <><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" /></>,
    check: <path d="M5 12.5 10 17l9-10" />,
    download: <path d="M12 4v11m-4-4 4 4 4-4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4m-4 4v2" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    file: <path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h8" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    home: <path d="m3 11 9-8 9 8M5 10v11h5v-6h4v6h5V10" />,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><rect x="9" y="3" width="6" height="4" rx="1" /></>,
    shield: <><path d="M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10Z" /><path d="m9 12 2 2 4-4" /></>,
    trash: <path d="M4.5 7h15M9 7V4.8h6V7M7 7l.7 12h8.6L17 7M10 10.5v5m4-5v5" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75">{icons[name] || icons.info}</svg>;
}

const toSection = (name) => ({ search: name === 'geral' ? '' : '?aba=' + name });

function SettingsTabs({ active }) {
  const navRef = useRef(null);
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector('[aria-current="page"]');
    if (!link || nav.scrollWidth <= nav.clientWidth) return;
    const left = link.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    nav.scrollLeft = Math.max(0, left - (nav.clientWidth - link.offsetWidth) / 2);
  }, [active]);
  return <nav ref={navRef} className="settings-v2__tabs" aria-label="Seções de configurações">
    {sections.map(([id, label]) => (
      <Link key={id} to={toSection(id)} aria-current={active === id ? 'page' : undefined}>{label}</Link>
    ))}
  </nav>;
}

function SettingsNote({ icon = 'info', children }) {
  return <div className="settings-v2__note"><SettingsIcon name={icon} size={19} /><span>{children}</span></div>;
}

function PreferenceRow({ id, icon, label, value, tone }) {
  return <Link className="settings-v2__row" to={toSection(id)}>
    <span className="settings-v2__row-icon" data-icon-tone={tone}><SettingsIcon name={icon} /></span>
    <strong>{label}</strong>
    {value ? <span className="settings-v2__row-value">{value}</span> : null}
    <span className="settings-v2__chevron"><SettingsIcon name="arrow" size={17} /></span>
  </Link>;
}

function GeneralSettings({ preferences, isAdmin }) {
  return <>
    <div className="settings-v2__split">
      <section className="settings-v2__panel"><h2>Preferências</h2>
        <div className="settings-v2__rows">
          <PreferenceRow id="tema" icon="theme" label="Tema" value={preferences.theme === 'dark' ? 'Escuro' : 'Claro'} />
          <PreferenceRow id="espacamento" icon="spacing" tone="purple" label="Espaçamento" value={preferences.density === 'compact' ? 'Compacto' : 'Espaçoso'} />
          <PreferenceRow id="animacoes" icon="motion" tone="green" label="Animações" value={preferences.motion === 'reduced' ? 'Reduzidas' : 'Suaves'} />
        </div>
      </section>
      <section className="settings-v2__panel"><h2>Neste dispositivo</h2>
        <div className="settings-v2__autosave">
          <span className="settings-v2__row-icon" data-icon-tone="green"><SettingsIcon name="check" /></span>
          <div><h3>Salvo automaticamente</h3><p>As preferências ficam neste navegador.</p></div>
        </div>
      </section>
    </div>
    <section className="settings-v2__panel"><h2>Privacidade da conta</h2>
      <div className="settings-v2__rows">
        <PreferenceRow id="meus-dados" icon="user" label="Meus dados" />
        <PreferenceRow id="exclusao" icon={isAdmin ? 'lock' : 'trash'} tone="neutral" label="Exclusão da conta"
          value={isAdmin ? 'Protegida no ADM' : undefined} />
      </div>
    </section>
  </>;
}

function ThemePreview({ theme }) {
  return <span className="settings-v2__theme-preview" data-preview-theme={theme} aria-hidden="true">
    <span className="settings-v2__preview-rail"><i /><i /><i /><i /></span>
    <span className="settings-v2__preview-main"><i /><span><b /><b /></span><i /><i /><i /></span>
  </span>;
}

function DensityPreview({ density }) {
  return <span className="settings-v2__density-preview" data-preview-density={density} aria-hidden="true">
    {[['home', 'Visão geral'], ['clipboard', 'Pedidos'], ['shield', 'Aprovações']].map(([icon, title]) => (
      <span key={icon}><span><SettingsIcon name={icon} size={17} /></span>{title}<SettingsIcon name="arrow" size={15} /></span>
    ))}
  </span>;
}

function PreferenceChoices({ groupId, heading, description, options, value, onChange, preview, note, compactAllowed, checkingPlan }) {
  return <section className="settings-v2__panel">
    <h2 id={groupId + '-title'}>{heading}</h2><p>{description}</p>
    <div className={'settings-v2__choices' + (preview ? '' : ' is-stacked')} role="group" aria-labelledby={groupId + '-title'}>
      {options.map((option) => {
        const selected = value === option.value;
        const disabled = Boolean(option.pro && !compactAllowed);
        return <label className={'settings-v2__choice' + (selected ? ' is-selected' : '') + (disabled ? ' is-locked' : '')} key={option.value}>
          <input type="radio" name={groupId} value={option.value} checked={selected}
            disabled={disabled} onChange={() => onChange(option.value)} />
          {preview ? preview(option.value) : <span className="settings-v2__choice-icon"><SettingsIcon name={option.icon} size={24} /></span>}
          <span className="settings-v2__choice-text">
            <span className="settings-v2__choice-label"><strong>{option.label}</strong>
              {option.pro ? <span className="settings-v2__badge">Pro</span> : null}
              {selected ? <span className="settings-v2__badge settings-v2__badge--selected"><SettingsIcon name="check" size={14} />Selecionado</span> : null}
            </span>
            <span>{option.detail}</span>
          </span>
        </label>;
      })}
    </div>
    <SettingsNote>{note}
      {checkingPlan ? ' Verificando seu plano…' : null}
      {groupId === 'espacamento' && !compactAllowed && !checkingPlan ? <> <Link to="/subscription">{planLinkLabel('Ver plano Pro')}</Link></> : null}
    </SettingsNote>
  </section>;
}

function DataSettings({ exporting, onExport }) {
  return <div className="settings-v2__split">
    <section className="settings-v2__panel"><h2>Uma cópia dos seus dados</h2><p>Baixe os dados vinculados à sua conta.</p>
      <dl className="settings-v2__format"><dt>Formato do arquivo</dt><dd><code>JSON</code></dd></dl>
      <ul className="settings-v2__data-list">
        <li><SettingsIcon name="user" />Perfil e pedidos</li>
        <li><SettingsIcon name="calendar" />Orçamentos e agenda</li>
        <li><SettingsIcon name="card" />Pagamentos</li>
      </ul>
      <div className="settings-v2__actions"><button className="settings-v2__button is-primary" type="button" disabled={exporting} onClick={onExport}>
        <SettingsIcon name="download" size={18} />{exporting ? 'Preparando…' : 'Baixar meus dados'}
      </button></div>
      <p className="settings-v2__small">O arquivo contém dados pessoais. Guarde em um local seguro.</p>
    </section>
    <aside className="settings-v2__panel"><h2>Privacidade</h2>
      <p>Entenda como tratamos seus dados e o que acontece quando uma conta é excluída.</p>
      <div className="settings-v2__privacy-links">
        <Link to="/privacidade"><SettingsIcon name="file" />Política de privacidade <SettingsIcon name="arrow" size={16} /></Link>
        <Link to="/excluir-conta"><SettingsIcon name="trash" />O que acontece ao excluir a conta <SettingsIcon name="arrow" size={16} /></Link>
      </div>
    </aside>
  </div>;
}

function DeletionSettings({ isAdmin, phrase, setPhrase, deleting, onDelete, exporting, onExport }) {
  return <>
    <section className="settings-v2__panel"><h2>Exclusão da conta</h2>
      {isAdmin ? <>
        <div className="settings-v2__guard"><SettingsIcon name="lock" size={22} /><strong>Conta administrativa protegida</strong></div>
        <p>A conta administrativa principal não pode ser excluída por aqui.<br />Transfira a administração antes de solicitar a exclusão pelo suporte.</p>
        <div className="settings-v2__actions"><Link className="settings-v2__button" to="/support">Abrir suporte</Link></div>
      </> : <>
        <div className="settings-v2__guard is-danger"><SettingsIcon name="trash" size={22} /><strong>A exclusão é definitiva</strong></div>
        <p>O perfil, as fotos, os pedidos, a agenda, os orçamentos e demais dados ligados à conta serão removidos. Registros financeiros exigidos por lei podem ser conservados pelo provedor de pagamento durante o prazo legal.</p>
        <form className="settings-v2__delete-form" onSubmit={onDelete}>
          <label htmlFor="delete-account-confirmation">Para confirmar, digite <strong>EXCLUIR</strong></label>
          <div>
            <input id="delete-account-confirmation" autoComplete="off" spellCheck="false" value={phrase}
              placeholder="EXCLUIR" onChange={(event) => setPhrase(event.target.value)} />
            <button className="settings-v2__button is-danger" type="submit" disabled={deleting || phrase.trim().toUpperCase() !== 'EXCLUIR'}>
              {deleting ? 'Excluindo conta…' : 'Excluir minha conta'}
            </button>
          </div>
        </form>
      </>}
    </section>
    <section className="settings-v2__panel"><h2>Quer guardar seus dados?</h2>
      <p>Você pode baixar uma cópia das informações da sua conta.</p>
      <div className="settings-v2__actions is-split">
        <button className="settings-v2__button" type="button" disabled={exporting} onClick={onExport}>
          <SettingsIcon name="download" size={18} />{exporting ? 'Preparando…' : 'Baixar uma cópia'}
        </button>
        <Link className="settings-v2__link" to="/excluir-conta">Entenda o processo de exclusão <SettingsIcon name="arrow" size={16} /></Link>
      </div>
    </section>
  </>;
}

export default function Settings() {
  const { user, logout } = useAuth();
  const { isPro, loading: planLoading, subscription } = useSubscription();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const tab = sections.find(([id]) => id === searchParams.get('aba'))?.[0] || 'geral';
  const [preferences, setPreferences] = useState(readSitePreferences);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const isAdmin = Boolean(user?.is_admin);

  useEffect(() => {
    if (!planLoading && subscription && !isPro && preferences.density === 'compact') {
      setPreferences(saveSitePreferences({ ...preferences, density: 'comfortable' }));
    }
  }, [isPro, planLoading, preferences, subscription]);

  useEffect(() => {
    if (tab !== 'exclusao') setDeletePhrase('');
  }, [tab]);

  const selectPreference = (key, value) => {
    if (preferences[key] === value || (key === 'density' && value === 'compact' && !isPro)) return;
    setPreferences(saveSitePreferences({ ...preferences, [key]: value }));
  };
  const restore = () => {
    setPreferences(resetSitePreferences());
    toast.success('Configurações restauradas.');
  };

  const handleDeleteAccount = async (event) => {
    event.preventDefault();
    if (isAdmin || isDeletingAccount) return;
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
    if (!accepted) return;

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
    if (isExportingData) return;
    try {
      setIsExportingData(true);
      const response = await api.get('/users/data-export', { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'instalapro-meus-dados-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
      }
      toast.success('Download dos seus dados iniciado.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível preparar a cópia agora.');
    } finally {
      setIsExportingData(false);
    }
  };

  return <section className="settings-v2">
    <header className="settings-v2__heading">
      <div><h1>Configurações</h1><p>Preferências do dispositivo e dados da sua conta.</p></div>
      {tab === 'geral' ? <button className="settings-v2__button" onClick={restore} type="button"><SettingsIcon name="reset" size={17} />Restaurar padrão</button> : null}
    </header>
    <SettingsTabs active={tab} />
    <div className="settings-v2__content">
      {tab === 'geral' ? <GeneralSettings preferences={preferences} isAdmin={isAdmin} /> : null}
      {tab === 'tema' ? <PreferenceChoices key={tab} groupId="tema" heading="Tema do painel"
        description="Escolha como o painel aparece neste dispositivo." options={themeOptions} value={preferences.theme}
        onChange={(value) => selectPreference('theme', value)} preview={(value) => <ThemePreview theme={value} />}
        note="Salvo automaticamente neste dispositivo." /> : null}
      {tab === 'espacamento' ? <PreferenceChoices key={tab} groupId="espacamento" heading="Espaçamento do painel"
        description="Escolha quanto espaço deixar entre os itens." options={densityOptions} value={preferences.density}
        onChange={(value) => selectPreference('density', value)} preview={(value) => <DensityPreview density={value} />}
        note="O modo compacto está disponível no plano Pro." compactAllowed={isPro} checkingPlan={planLoading} /> : null}
      {tab === 'animacoes' ? <PreferenceChoices key={tab} groupId="animacoes" heading="Movimento do painel"
        description="Escolha como os elementos se movem na tela." options={motionOptions} value={preferences.motion}
        onChange={(value) => selectPreference('motion', value)} note="A preferência vale neste dispositivo." /> : null}
      {tab === 'meus-dados' ? <DataSettings exporting={isExportingData} onExport={handleDataExport} /> : null}
      {tab === 'exclusao' ? <DeletionSettings isAdmin={isAdmin} phrase={deletePhrase} setPhrase={setDeletePhrase}
        deleting={isDeletingAccount} onDelete={handleDeleteAccount} exporting={isExportingData} onExport={handleDataExport} /> : null}
    </div>
  </section>;
}
