import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageIntro from '../Layout/PageIntro';
import { useAuth } from '../../contexts/AuthContext';
import {
  ACCENT_PRESETS,
  readSitePreferences,
  resetSitePreferences,
  saveSitePreferences,
} from '../../utils/sitePreferences';

const densityOptions = [
  { value: 'comfortable', label: 'Espacosa', detail: 'Mais respiro' },
  { value: 'compact', label: 'Compacta', detail: 'Mais informacao' },
];

const motionOptions = [
  { value: 'smooth', label: 'Suaves', detail: 'Padrao' },
  { value: 'reduced', label: 'Reduzidas', detail: 'Menos movimento' },
];

const shortcutItems = [
  { to: '/profile', title: 'Perfil publico', detail: 'Dados, fotos, documentos e seguranca.', icon: 'user' },
  { to: '/subscription', title: 'Assinatura', detail: 'Plano, status e acesso ao painel.', icon: 'card' },
  { to: '/notifications', title: 'Notificacoes', detail: 'Avisos recentes da conta.', icon: 'bell' },
  { to: '/support', title: 'Suporte', detail: 'Atendimento e ideias para o produto.', icon: 'help' },
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
    palette: <><path d="M12 4a8 8 0 0 0 0 16h1.2a1.8 1.8 0 0 0 1.3-3.05 1.3 1.3 0 0 1 .9-2.25H17a3 3 0 0 0 3-3A7.7 7.7 0 0 0 12 4Z" /><circle cx="8.2" cy="11" r=".8" /><circle cx="10.5" cy="8" r=".8" /><circle cx="14" cy="8.2" r=".8" /></>,
    layout: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 10h16M9 10v9" /></>,
    motion: <><path d="M4 16c4-8 8 8 12 0" /><path d="M16 8h4v4" /><path d="M20 8c-3.5 7-7-7-11 0" /></>,
    reset: <><path d="M20 12a8 8 0 1 1-2.4-5.7" /><path d="M20 4v5h-5" /></>,
    check: <path d="M5 12.5 10 17l9-10" />,
    user: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19c1.6-3 4.2-4.5 6.5-4.5s4.9 1.5 6.5 4.5" /></>,
    card: <><rect x="4" y="6.5" width="16" height="11" rx="2" /><path d="M4 10h16" /></>,
    bell: <><path d="M18 10.8a6 6 0 0 0-12 0c0 5-2 5.7-2 5.7h16s-2-.7-2-5.7" /><path d="M10 20a2.4 2.4 0 0 0 4 0" /></>,
    help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.8 9.4a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1.1-1.4 2.2" /><path d="M12 17.2h.01" /></>,
  };

  return <svg {...sharedProps}>{icons[type] || icons.palette}</svg>;
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
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(() => readSitePreferences());
  const [savedAt, setSavedAt] = useState(() => new Date());

  const currentPreset = useMemo(
    () => ACCENT_PRESETS.find((preset) => preset.value === preferences.accentColor),
    [preferences.accentColor]
  );
  const firstName = user?.name?.split(' ')[0] || 'usuario';

  const savePreference = (patch) => {
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
    toast.success('Configuracoes restauradas.');
  };

  const stats = [
    {
      label: 'Cor ativa',
      value: currentPreset?.name || preferences.accentColor.toUpperCase(),
      detail: preferences.accentColor.toUpperCase(),
    },
    {
      label: 'Densidade',
      value: preferences.density === 'compact' ? 'Compacta' : 'Espacosa',
      detail: 'Preferencia da interface',
    },
    {
      label: 'Movimento',
      value: preferences.motion === 'reduced' ? 'Reduzido' : 'Suave',
      detail: 'Animacoes do painel',
    },
  ];

  return (
    <div className="page-shell settings-page">
      <PageIntro
        eyebrow="Conta"
        title="Configuracoes"
        description={`Ajustes do painel de ${firstName}: aparencia, movimento e atalhos da conta.`}
        actions={(
          <button className="ghost-button" onClick={handleReset} type="button">
            <SettingsIcon type="reset" />
            Restaurar padrao
          </button>
        )}
        stats={stats}
      />

      <section className="settings-layout">
        <article className="settings-panel settings-panel--accent">
          <div className="settings-section-head">
            <span><SettingsIcon type="palette" /></span>
            <div>
              <p>Aparencia</p>
              <h2>Cor do site</h2>
            </div>
          </div>

          <div className="settings-color-row" aria-label="Cores prontas">
            {ACCENT_PRESETS.map((preset) => (
              <button
                aria-label={`Usar cor ${preset.name}`}
                className={preferences.accentColor === preset.value ? 'is-selected' : ''}
                key={preset.value}
                onClick={() => savePreference({ accentColor: preset.value })}
                style={{ '--swatch-color': preset.value }}
                type="button"
              >
                <span />
                <strong>{preset.name}</strong>
              </button>
            ))}
          </div>

          <label className="settings-color-picker">
            <span>Cor personalizada</span>
            <input
              aria-label="Escolher cor personalizada"
              onChange={(event) => savePreference({ accentColor: event.target.value })}
              type="color"
              value={preferences.accentColor}
            />
          </label>

          <div className="settings-live-preview">
            <div>
              <span className="settings-preview-dot" />
              <p>Painel Instalar+</p>
              <strong>Previa da sua cor</strong>
            </div>
            <button type="button">Botao principal</button>
          </div>
        </article>

        <article className="settings-panel">
          <div className="settings-section-head">
            <span><SettingsIcon type="layout" /></span>
            <div>
              <p>Interface</p>
              <h2>Organizacao visual</h2>
            </div>
          </div>

          <PreferenceSegment
            label="Espacamento"
            onChange={(value) => savePreference({ density: value })}
            options={densityOptions}
            value={preferences.density}
          />

          <PreferenceSegment
            label="Animacoes"
            onChange={(value) => savePreference({ motion: value })}
            options={motionOptions}
            value={preferences.motion}
          />
        </article>

        <article className="settings-panel settings-panel--shortcuts">
          <div className="settings-section-head">
            <span><SettingsIcon type="check" /></span>
            <div>
              <p>Conta</p>
              <h2>Atalhos uteis</h2>
            </div>
          </div>

          <div className="settings-shortcuts">
            {shortcutItems.map((item) => (
              <Link key={item.to} to={item.to}>
                <span><SettingsIcon type={item.icon} /></span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              </Link>
            ))}
          </div>
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
            As preferencias ficam neste dispositivo e sao aplicadas quando o painel abre.
          </small>
        </article>
      </section>
    </div>
  );
}
