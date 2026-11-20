import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import PageIntro from '../Layout/PageIntro';
import { useSubscription } from '../../contexts/SubscriptionContext';
import api from '../../services/api';
import { isNativeStoreApp } from '../../utils/nativePlatform';
import { planLinkLabel } from '../../utils/storePlanCopy';

const DEFAULT_BRANDING = {
  brand_name: '',
  document_title: 'Proposta comercial de instalação',
  accent_color: '#CDA349',
  intro_text: '',
  closing_text: '',
  show_logo: true,
  show_installer_photo: true,
  show_contact: true,
};

const ACCENT_OPTIONS = [
  { value: '#CDA349', label: 'Dourado', detail: 'Clássico e sofisticado' },
  { value: '#0F8798', label: 'Azul petróleo', detail: 'Claro e profissional' },
  { value: '#2956A8', label: 'Azul', detail: 'Institucional' },
  { value: '#5B3FA3', label: 'Violeta', detail: 'Contemporâneo' },
  { value: '#2E8B57', label: 'Verde', detail: 'Natural' },
  { value: '#B84372', label: 'Rosa escuro', detail: 'Marcante' },
];

function PdfBrandingIcon({ type }) {
  const sharedProps = {
    width: 21,
    height: 21,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  const icons = {
    file: <><path d="M7 3.8h7l3 3V20H7z" /><path d="M14 3.8V7h3" /><path d="M9.5 11h5M9.5 15h5" /></>,
    spark: <><path d="m12 3 1.45 5.55L19 10l-5.55 1.45L12 17l-1.45-5.55L5 10l5.55-1.45L12 3Z" /><path d="m18.5 15 .7 2.8L22 18.5l-2.8.7-.7 2.8-.7-2.8-2.8-.7 2.8-.7.7-2.8Z" /></>,
    image: <><rect x="4" y="5" width="16" height="14" rx="2.2" /><circle cx="9" cy="10" r="1.4" /><path d="m5.5 17 4.3-4.3 3.1 3.1 2.1-2.1 3.5 3.3" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10" /></>,
  };

  return <svg {...sharedProps}>{icons[type] || icons.file}</svg>;
}

function TextCounter({ current, max }) {
  return <span className="pdf-branding-counter">{String(current || '').length}/{max}</span>;
}

export default function PdfBranding() {
  const { isPro, loading: planLoading } = useSubscription();
  const [form, setForm] = useState(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    api.get('/users/pdf-branding')
      .then((response) => {
        if (active) {
          setForm({ ...DEFAULT_BRANDING, ...(response.data?.branding || {}) });
        }
      })
      .catch((error) => {
        if (active) {
          toast.error(error.response?.data?.error || 'Não foi possível carregar a personalização do PDF.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!isPro) {
      toast.error('A personalização do PDF está disponível no plano Pro.');
      return;
    }

    try {
      setSaving(true);
      const response = await api.put('/users/pdf-branding', form);
      setForm({ ...DEFAULT_BRANDING, ...(response.data?.branding || {}) });
      toast.success('Personalização do PDF salva.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível salvar a personalização.');
    } finally {
      setSaving(false);
    }
  };

  const brandName = form.brand_name.trim() || 'Sua marca';
  const documentTitle = form.document_title.trim() || DEFAULT_BRANDING.document_title;

  return (
    <div className="page-shell pdf-branding-page space-y-6">
      <PageIntro
        eyebrow="PDF PROFISSIONAL · PRO"
        title="Personalize seus orçamentos"
        description="Defina a identidade que aparece no PDF enviado ao cliente. As escolhas são aplicadas automaticamente aos próximos downloads."
        actions={(
          <Link className="ghost-button" to="/profile">
            <PdfBrandingIcon type="image" /> Atualizar logo e foto
          </Link>
        )}
        stats={[
          { label: 'Status', value: isPro ? 'Pro ativo' : 'Recurso Pro', detail: 'Marca aplicada em cada PDF' },
          { label: 'Personalização', value: 'Ao vivo', detail: 'Veja a prévia antes de salvar' },
        ]}
      />

      <div className="pdf-branding-layout">
        <form className="pdf-branding-form lux-panel" onSubmit={handleSave}>
          <div className="pdf-branding-form-heading">
            <span className="pdf-branding-icon"><PdfBrandingIcon type="spark" /></span>
            <div>
              <p className="eyebrow">IDENTIDADE DO DOCUMENTO</p>
              <h2>Como seu orçamento será apresentado</h2>
              <p>Use textos curtos. O conteúdo comercial, valores e condições continuam sendo preenchidos pelo orçamento.</p>
            </div>
          </div>

          {!planLoading && !isPro ? (
            <div className="pdf-branding-pro-notice">
              <PdfBrandingIcon type="lock" />
              <div>
                <strong>Personalização disponível no Pro</strong>
                <span>
                  {isNativeStoreApp()
                    ? 'Você pode montar sua prévia agora; salvar e aplicar aos PDFs é um recurso do plano Pro.'
                    : 'Você pode montar sua prévia agora; para salvar e aplicar aos PDFs, ative o plano Pro.'}
                </span>
              </div>
              <Link to="/subscription">{planLinkLabel('Conhecer o Pro')}</Link>
            </div>
          ) : null}

          <fieldset disabled={loading || planLoading}>
            <section className="pdf-branding-section">
              <div className="pdf-branding-section-title">
                <span>1</span>
                <div><strong>Marca e título</strong><small>O cabeçalho que o cliente verá primeiro.</small></div>
              </div>
              <div className="pdf-branding-fields pdf-branding-fields--split">
                <label>
                  <span>Nome da marca</span>
                  <input maxLength="80" name="brand_name" onChange={updateField} placeholder="Ex.: Bem Instalado" value={form.brand_name} />
                </label>
                <label>
                  <span>Título do documento</span>
                  <input maxLength="100" name="document_title" onChange={updateField} value={form.document_title} />
                </label>
              </div>
            </section>

            <section className="pdf-branding-section">
              <div className="pdf-branding-section-title">
                <span>2</span>
                <div><strong>Cor de destaque</strong><small>Usada no nome da marca, status e mensagens.</small></div>
              </div>
              <div className="pdf-branding-swatches" role="radiogroup" aria-label="Cor de destaque">
                {ACCENT_OPTIONS.map((option) => (
                  <label className={form.accent_color === option.value ? 'is-selected' : ''} key={option.value}>
                    <input checked={form.accent_color === option.value} name="accent_color" onChange={updateField} type="radio" value={option.value} />
                    <i style={{ backgroundColor: option.value }} />
                    <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                  </label>
                ))}
              </div>
            </section>

            <section className="pdf-branding-section">
              <div className="pdf-branding-section-title">
                <span>3</span>
                <div><strong>Mensagens opcionais</strong><small>Uma abertura e um fechamento para deixar a proposta mais pessoal.</small></div>
              </div>
              <div className="pdf-branding-fields">
                <label>
                  <span>Mensagem de apresentação <TextCounter current={form.intro_text} max={320} /></span>
                  <textarea maxLength="320" name="intro_text" onChange={updateField} placeholder="Ex.: Preparamos esta proposta para transformar seu ambiente com cuidado e acabamento profissional." rows="3" value={form.intro_text} />
                </label>
                <label>
                  <span>Mensagem final <TextCounter current={form.closing_text} max={320} /></span>
                  <textarea maxLength="320" name="closing_text" onChange={updateField} placeholder="Ex.: Ficamos à disposição para ajustar esta proposta e agendar a instalação." rows="3" value={form.closing_text} />
                </label>
              </div>
            </section>

            <section className="pdf-branding-section pdf-branding-section--last">
              <div className="pdf-branding-section-title">
                <span>4</span>
                <div><strong>Elementos visíveis</strong><small>Controle o que entra no cabeçalho e no rodapé.</small></div>
              </div>
              <div className="pdf-branding-toggle-grid">
                <label><input checked={form.show_logo} name="show_logo" onChange={updateField} type="checkbox" /><span><PdfBrandingIcon type="image" /><strong>Exibir logo</strong><small>Usa a logo salva no perfil.</small></span></label>
                <label><input checked={form.show_installer_photo} name="show_installer_photo" onChange={updateField} type="checkbox" /><span><PdfBrandingIcon type="image" /><strong>Exibir foto</strong><small>Mostra sua foto profissional.</small></span></label>
                <label><input checked={form.show_contact} name="show_contact" onChange={updateField} type="checkbox" /><span><PdfBrandingIcon type="file" /><strong>Exibir telefone</strong><small>Mostra o contato no rodapé.</small></span></label>
              </div>
            </section>
          </fieldset>

          <div className="pdf-branding-actions">
            <p><PdfBrandingIcon type="file" /> Depois de salvo, baixe um orçamento para receber o PDF personalizado.</p>
            <button className="gold-button" disabled={saving || loading || planLoading || !isPro} type="submit">
              {saving ? 'Salvando...' : 'Salvar personalização'}
            </button>
          </div>
        </form>

        <aside className="pdf-branding-preview-wrap">
          <div className="pdf-branding-preview-label"><span /> PRÉVIA DO PDF</div>
          <div className="pdf-branding-preview" style={{ '--pdf-accent': form.accent_color }}>
            <header>
              <div className="pdf-branding-preview-brand">
                {form.show_logo ? <span className="pdf-branding-preview-logo">BI</span> : null}
                <div><strong>{brandName}</strong><small>{documentTitle}</small></div>
              </div>
              {form.show_installer_photo ? <span className="pdf-branding-preview-photo">Foto</span> : null}
            </header>
            <div className="pdf-branding-preview-body">
              <div className="pdf-branding-preview-meta"><span>ORÇAMENTO #1024</span><b>EM ANÁLISE</b></div>
              {form.intro_text ? <section className="pdf-branding-preview-message"><strong>Mensagem de apresentação</strong><p>{form.intro_text}</p></section> : null}
              <section className="pdf-branding-preview-details"><strong>Dados do projeto</strong><div><span>Instalador</span><span>Cliente e local</span></div></section>
              <section className="pdf-branding-preview-lines"><strong>Resumo financeiro</strong><p>Material e instalação <b>R$ 1.280,00</b></p><p>Pagamento <b>À vista</b></p></section>
              {form.closing_text ? <section className="pdf-branding-preview-message"><strong>Mensagem final</strong><p>{form.closing_text}</p></section> : null}
            </div>
            <footer><span>{brandName} · Orçamento #1024</span><span>{form.show_contact ? 'Contato: (48) 99999-0000' : 'Documento profissional'}</span></footer>
          </div>
          <p className="pdf-branding-preview-note">A prévia mostra a identidade visual. As informações reais são preenchidas conforme cada orçamento.</p>
        </aside>
      </div>
    </div>
  );
}
