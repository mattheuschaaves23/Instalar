import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { useSubscription } from '../../contexts/SubscriptionContext';
import api from '../../services/api';
import pdfDesign from '../../../../shared/pdfBranding.json';
import './PdfBranding.css';

const { defaults, templates, accentOptions, limits, validityOptions, defaultScope, sample } = pdfDesign;
const CURRENCY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUMBER = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATE = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });
const validHex = value => /^#[0-9a-f]{6}$/i.test(value);
const visibility = [
  ['show_logo', 'Logo da marca'],
  ['show_installer_photo', 'Foto profissional'],
  ['show_contact', 'Meu telefone e e-mail'],
  ['show_client_contact', 'Telefone e e-mail do cliente'],
  ['show_measurements', 'Medidas, área e rolos'],
  ['show_scope', 'Escopo e observações'],
  ['show_signature', 'Linhas para assinatura'],
];

function Icon({ name, size = 18 }) {
  const shapes = {
    file: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z" /><path d="M14 3v6h5M8 13h8M8 17h5" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}

function isPdfImage(source) {
  return typeof source === 'string' && (/^data:image\/(?:png|jpeg);base64,/i.test(source) || /^\/api\/public\/assets\/[\w-]+$/.test(source));
}

function Preview({ form, owner }) {
  const {
    brand_name, document_title, accent_color, validity_days, template,
    show_logo, show_installer_photo, show_contact, show_client_contact, show_measurements,
    show_scope, show_signature, scope_text, intro_text, closing_text,
  } = form;
  const logo = show_logo && isPdfImage(owner.logo) ? owner.logo : null;
  const photo = show_installer_photo && isPdfImage(owner.installer_photo) ? owner.installer_photo : null;
  const brand = brand_name.trim() || owner.business_name || owner.name || 'Sua marca';
  const validUntil = new Date(sample.budget.created_at);
  validUntil.setUTCDate(validUntil.getUTCDate() + validity_days);

  return (
    <article className="quote-paper" data-template={template} aria-label="Prévia ilustrativa do orçamento"
      style={{ '--paper-accent': validHex(accent_color) ? accent_color : defaults.accent_color }}>
      <header className="quote-paper-head">
        <div className="quote-paper-brand">
          <div>{logo && <img src={logo} alt="" />}<strong>{brand}</strong></div>
          <h3>{document_title.trim() || defaults.document_title}</h3>
        </div>
        <div className="quote-paper-meta">
          <div><strong>Orçamento #{sample.budget.id}</strong><span>Emissão: {DATE.format(new Date(sample.budget.created_at))}</span><span>Exemplo ilustrativo</span></div>
          {photo && <img src={photo} alt="" />}
        </div>
      </header>
      <div className="quote-paper-body">
        {intro_text.trim() && <PaperMessage title="Apresentação">{intro_text}</PaperMessage>}
        <div className="quote-paper-parties">
          <div><span>Preparado por</span><strong>{owner.name || brand}</strong>{show_contact && <><span>{owner.phone}</span><span>{owner.email}</span></>}</div>
          <div><span>Cliente e local</span><strong>{sample.client.name}</strong>{show_client_contact && <span>{sample.client.phone}</span>}<span>{sample.client.city} - {sample.client.state}</span></div>
        </div>
        <table className="quote-paper-table">
          <caption>Ambientes</caption>
          <thead><tr><th scope="col">Ambiente</th>{show_measurements && <><th scope="col">Medidas</th><th scope="col">Área</th><th scope="col">Rolos</th></>}<th scope="col">Valor</th></tr></thead>
          <tbody>
            {sample.environments.map(room => (
              <tr key={room.name}><th scope="row">{room.name}</th>{show_measurements && <>
                <td>{NUMBER.format(room.width)} x {NUMBER.format(room.height)} m</td>
                <td>{NUMBER.format(room.area)} m²</td><td>{room.rolls_auto}</td>
              </>}<td>{CURRENCY.format(room.total)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="quote-paper-subtotal">
          {show_measurements && <p>{NUMBER.format(sample.budget.total_area)} m² / {sample.budget.total_rolls} rolos</p>}
          <p><span>Subtotal do serviço</span><span>{CURRENCY.format(sample.budget.subtotal_rolls)}</span></p>
        </div>
        <div className="quote-paper-total"><span>Total do orçamento</span><strong>{CURRENCY.format(sample.budget.total_amount)}</strong></div>
        <div className="quote-paper-conditions">
          <strong>Pagamento e condições</strong><span>À vista: Pix</span><span>Validade: {DATE.format(validUntil)} ({validity_days} dias da emissão)</span>
        </div>
        {show_scope && <PaperMessage title="Escopo e observações">{scope_text.trim() || defaultScope}</PaperMessage>}
        {closing_text.trim() && <PaperMessage title="Mensagem final">{closing_text}</PaperMessage>}
        {show_signature && <div className="quote-paper-signature"><span>Assinatura do cliente</span><span>Assinatura do instalador</span></div>}
      </div>
      <footer className="quote-paper-footer"><span>{brand} / Orçamento #{sample.budget.id}</span>{show_contact && owner.phone && <span>{owner.phone}</span>}<span>1</span></footer>
    </article>
  );
}

function PaperMessage({ title, children }) {
  return <section className="quote-paper-message"><strong>{title}</strong><p>{children}</p></section>;
}

function EditorField({ field, label, form, update, placeholder, multiline = false }) {
  const Component = multiline ? 'textarea' : 'input';
  return (
    <label className="quote-studio-field">
      <span>{label}</span>
      <Component
        name={field} value={form[field]} maxLength={limits[field]} placeholder={placeholder}
        onChange={event => update(field, event.target.value)} {...(multiline ? { rows: 3 } : {})}
      />
    </label>
  );
}

export default function PdfBranding() {
  const { isPro, loading: planLoading } = useSubscription();
  const [form, setForm] = useState(defaults);
  const [saved, setSaved] = useState(defaults);
  const [owner, setOwner] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [mobileView, setMobileView] = useState('edit');

  useEffect(() => {
    let active = true;
    api.get('/users/pdf-branding')
      .then(({ data }) => {
        if (!active) return;
        const values = { ...defaults, ...data?.branding };
        setForm(values);
        setSaved(values);
        setOwner(data?.profile || {});
      })
      .catch(error => {
        if (active) setLoadError(error.response?.data?.error || 'Não foi possível carregar suas preferências.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  const color = validHex(form.accent_color) ? form.accent_color.toUpperCase() : null;
  const ready = !loading && !loadError && Boolean(color);
  const dirty = Object.keys(defaults).some(field => form[field] !== saved[field]);
  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }));
    setSaveError('');
    setExportError('');
  }

  async function save(event) {
    event.preventDefault();
    if (!isPro || !dirty || !ready || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const { data } = await api.put('/users/pdf-branding', form);
      const values = { ...defaults, ...data?.branding };
      setForm(values);
      setSaved(values);
      toast.success('Preferências do PDF salvas.');
    } catch (error) {
      setSaveError(error.response?.data?.error || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function downloadExample() {
    if (!ready || exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const { data } = await api.post('/users/pdf-branding/preview', form, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'orcamento-exemplo.pdf';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      setExportError(error.response?.status === 429
        ? 'Aguarde um minuto antes de baixar outro exemplo.'
        : 'Não foi possível baixar o exemplo. Tente novamente.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="quote-studio" data-mobile-view={mobileView}>
      <header className="quote-studio-top">
        <div><h1>PDF profissional</h1><p>Deixe a proposta de instalação com a identidade do seu negócio.</p></div>
        <Link to="/budgets" className="quote-studio-button"><Icon name="file" /> Ver orçamentos</Link>
      </header>
      {loadError && <div className="quote-studio-notice" role="alert">{loadError}{' '}
        <button type="button" onClick={() => { setLoadError(''); setLoading(true); setRetry(current => current + 1); }}>Tentar novamente</button>
      </div>}
      {!isPro && !planLoading && <div className="quote-studio-notice"><span>Experimente os modelos à vontade. Para aplicar o visual aos seus orçamentos, é preciso ter o plano Pro.</span><Link to="/subscription">Conhecer o Pro</Link></div>}
      <div className="quote-studio-mobile-views" aria-label="Área de trabalho">
        <button type="button" aria-pressed={mobileView === 'edit'} onClick={() => setMobileView('edit')}>Personalizar</button>
        <button type="button" aria-pressed={mobileView === 'preview'} onClick={() => setMobileView('preview')}>Ver prévia</button>
      </div>
      <div className="quote-studio-grid">
        <form className="quote-studio-editor" onSubmit={save} aria-label="Personalizar PDF" aria-busy={loading}>
          <fieldset className="quote-studio-editable" disabled={loading || Boolean(loadError) || saving}>
            <section>
              <h2>Modelo</h2>
              <p>Escolha a apresentação do documento.</p>
              <div className="quote-studio-templates" role="radiogroup" aria-label="Modelo do PDF">
                {templates.map(item => (
                  <label key={item.id} data-selected={form.template === item.id ? 'true' : 'false'} title={item.description}>
                    <input type="radio" name="template" value={item.id} checked={form.template === item.id} onChange={() => update('template', item.id)} />
                    <span className="quote-template-icon" data-template={item.id} aria-hidden="true"><i /><i /><i /></span>
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              <p className="quote-studio-template-note">{templates.find(item => item.id === form.template)?.description}</p>
            </section>
            <section>
              <h2>Identidade</h2>
              <div className="quote-studio-fields">
                <EditorField field="brand_name" label="Nome da marca" form={form} update={update} placeholder={owner.business_name || owner.name || 'Ex.: Seu negócio'} />
                <EditorField field="document_title" label="Título do documento" form={form} update={update} placeholder={defaults.document_title} />
                <div className="quote-studio-colors">
                  <span>Cor de destaque</span>
                  <div className="quote-studio-swatches" aria-label="Cores prontas">
                    {accentOptions.map(item => (
                      <button key={item.value} type="button" title={item.label} aria-label={item.label} aria-pressed={color === item.value}
                        style={{ '--swatch': item.value }} onClick={() => update('accent_color', item.value)}>
                        {color === item.value && <Icon name="check" size={15} />}
                      </button>
                    ))}
                  </div>
                  <div className="quote-studio-custom-color">
                    <input type="color" aria-label="Escolher cor personalizada" value={color || defaults.accent_color} onChange={event => update('accent_color', event.target.value.toUpperCase())} />
                    <input aria-label="Código hexadecimal da cor" aria-invalid={!color} aria-describedby={color ? undefined : 'quote-color-error'}
                      spellCheck={false} type="text" maxLength={7} value={form.accent_color}
                      onChange={event => update('accent_color', event.target.value.toUpperCase())} />
                  </div>
                  {!color && <small className="quote-studio-error" id="quote-color-error">Use uma cor no formato #175DAA.</small>}
                </div>
                <Link className="quote-studio-profile-link" to="/profile">Alterar logo e foto no perfil</Link>
                <p className="quote-studio-image-note">O PDF aceita logo e foto em PNG ou JPG.</p>
              </div>
            </section>
            <details>
              <summary>Textos e validade <Icon name="chevron" /></summary>
              <div className="quote-studio-fields">
                <label className="quote-studio-field"><span>Validade a partir da emissão</span>
                  <select value={form.validity_days} onChange={event => update('validity_days', Number(event.target.value))}>
                    {validityOptions.map(days => <option key={days} value={days}>{days} dias</option>)}
                  </select>
                </label>
                <EditorField field="intro_text" label="Mensagem de apresentação" form={form} update={update} placeholder="Opcional: apresente a proposta ao cliente." multiline />
                {form.show_scope && <EditorField field="scope_text" label="Escopo e observações" form={form} update={update} placeholder="Se ficar vazio, o PDF usa o texto padrão." multiline />}
                <EditorField field="closing_text" label="Mensagem final" form={form} update={update} placeholder="Opcional: explique o próximo passo." multiline />
              </div>
            </details>
            <details>
              <summary>O que aparece no PDF <Icon name="chevron" /></summary>
              <div className="quote-studio-visibility">
                {visibility.map(([field, label]) => (
                  <label key={field}><input type="checkbox" checked={form[field]} onChange={event => update(field, event.target.checked)} />{label}</label>
                ))}
              </div>
            </details>
          </fieldset>
          <footer className="quote-studio-save">
            <span aria-live="polite">{loading ? 'Carregando…' : loadError ? 'Preferências indisponíveis' : dirty ? 'Alterações não salvas' : 'Aplica aos próximos downloads'}</span>
            <button className="quote-studio-button quote-studio-primary" disabled={!ready || !isPro || !dirty || saving || planLoading} type="submit">
              {saving ? 'Salvando…' : 'Salvar modelo'}
            </button>
            {saveError && <small className="quote-studio-error" role="alert">{saveError}</small>}
          </footer>
        </form>
        <section className="quote-studio-preview" aria-label="Prévia do PDF">
          <div className="quote-studio-preview-top">
            <div><h2>Prévia do PDF</h2><p>Exemplo com dados fictícios de cliente.</p></div>
            <button className="quote-studio-button" type="button" disabled={!ready || exporting} onClick={downloadExample}>
              <Icon name="download" /> {exporting ? 'Gerando…' : 'Baixar PDF de teste'}
            </button>
          </div>
          {exportError && <p className="quote-studio-error" role="alert">{exportError}</p>}
          <div className="quote-studio-desk">{loading ? <p role="status">Carregando prévia…</p> : <Preview form={form} owner={owner} />}</div>
          <p className="quote-studio-preview-note">O download usa as configurações desta prévia, mesmo antes de salvar.</p>
        </section>
      </div>
    </div>
  );
}
