import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { useSubscription } from '../../contexts/SubscriptionContext';
import api from '../../services/api';
import { isNativeStoreApp } from '../../utils/nativePlatform';
import { exportErrorMessage, exportFile } from '../../utils/exportFile';
import { planLinkLabel } from '../../utils/storePlanCopy';
import pdfDesign from '../../../../shared/pdfBranding.json';
import { accentInk, tint } from '../../../../shared/pdfColors.mjs';
import './PdfBranding.css';

const { defaults, basic, templates, accentOptions, appearanceOptions, limits, validityOptions, defaultScope, sample } = pdfDesign;
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
  ['show_environment_prices', 'Valores por ambiente'],
  ['show_status', 'Status do orçamento'],
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
    brand_name, document_title, document_subtitle, footer_text, accent_color, validity_days, template,
    heading_font, paper_tone, density, show_pattern, show_environment_prices, show_status,
    show_logo, show_installer_photo, show_contact, show_client_contact, show_measurements,
    show_scope, show_signature, scope_text, intro_text, closing_text,
  } = form;
  const logo = show_logo && isPdfImage(owner.logo) ? owner.logo : null;
  const photo = show_installer_photo && isPdfImage(owner.installer_photo) ? owner.installer_photo : null;
  const studio = template === 'studio';
  const classic = template === 'classic';
  const technical = template === 'compact';
  const free = template === 'basic';
  const brand = free ? 'InstalarPro' : brand_name.trim() || owner.business_name || owner.name || 'Sua marca';
  const accent = validHex(accent_color) ? accent_color : defaults.accent_color;
  const paper = paper_tone === 'tinted' ? tint(accent, 0.035) : classic && paper_tone === 'auto' ? '#FCF9F3' : '#FFFFFF';
  const validUntil = new Date(sample.budget.created_at);
  validUntil.setUTCDate(validUntil.getUTCDate() + validity_days);
  const number = `Orçamento #${sample.budget.id}`;
  const provider = <div key="provider"><span>Preparado por</span><strong>{owner.name || brand}</strong>{show_contact && <><span>{owner.phone}</span><span>{owner.email}</span></>}</div>;
  const customer = <div key="customer"><span>Cliente e local</span><strong>{sample.client.name}</strong>{show_client_contact && <span>{sample.client.phone}</span>}<span>{sample.client.city} - {sample.client.state}</span></div>;
  const total = <div className="quote-paper-total"><span>Total do orçamento</span><strong>{CURRENCY.format(sample.budget.total_amount)}</strong></div>;
  const conditions = <div className="quote-paper-conditions"><strong>Pagamento e condições</strong><span>À vista: Pix</span><span>Validade: {DATE.format(validUntil)} ({validity_days} dias da emissão)</span></div>;
  const measure = room => `${NUMBER.format(room.width)} x ${NUMBER.format(room.height)} m`;
  const amount = room => CURRENCY.format(room.total);
  const rank = index => String(index + 1).padStart(2, '0');

  return (
    <article className="quote-paper" data-template={template} data-pattern={show_pattern} data-density={density} data-font={heading_font} aria-label="Prévia ilustrativa do orçamento"
      style={{ '--paper-accent': accent, '--paper-accent-ink': accentInk(accent), '--paper-tint': free ? '#F1F3F5' : tint(accent, 0.09), '--paper-background': paper }}>
      <header className="quote-paper-head">
        <div className="quote-paper-brand">
          <div>{logo && <img src={logo} alt="" />}<strong>{brand}</strong></div>
          <h3>{document_title.trim() || defaults.document_title}</h3>
          {document_subtitle.trim() && <p className="quote-paper-subtitle">{document_subtitle}</p>}
        </div>
        <div className="quote-paper-meta">
          <div><strong>{number}</strong><span>Emissão: {DATE.format(new Date(sample.budget.created_at))}</span>{show_status && <span>Pendente</span>}<span>Exemplo ilustrativo</span></div>
          {photo && <img src={photo} alt="" />}
          {studio && total}
        </div>
      </header>
      <div className="quote-paper-body">
        {intro_text.trim() && <PaperMessage title="Apresentação">{intro_text}</PaperMessage>}
        <div className="quote-paper-parties">{studio || technical ? [customer, provider] : [provider, customer]}</div>
        {studio ? (
          <section className="quote-paper-cards" aria-label="Ambientes">
            <strong>Ambientes</strong>
            <ol>{sample.environments.map((room, index) => (
              <li key={room.name}><span className="quote-room-index">{rank(index)}</span>
                <div><strong>{room.name}</strong>{show_measurements && <p>{measure(room)} / {NUMBER.format(room.area)} m² / {room.rolls_auto} {room.rolls_auto === 1 ? 'rolo' : 'rolos'}</p>}</div>
                {show_environment_prices && <strong className="quote-room-value">{amount(room)}</strong>}
              </li>
            ))}</ol>
          </section>
        ) : <table className="quote-paper-table">
          <caption>Ambientes</caption>
          <thead><tr>{technical && <th scope="col">Nº</th>}<th scope="col">Ambiente</th>{show_measurements && <><th scope="col">Medidas</th><th scope="col">Área</th><th scope="col">Rolos</th></>}{show_environment_prices && <th scope="col">Valor</th>}</tr></thead>
          <tbody>
            {sample.environments.map((room, index) => (
              <tr key={room.name}>{technical && <td>{rank(index)}</td>}<th scope="row">{room.name}</th>{show_measurements && <>
                <td>{measure(room)}</td>
                <td>{NUMBER.format(room.area)} m²</td><td>{room.rolls_auto}</td>
              </>}{show_environment_prices && <td>{amount(room)}</td>}</tr>
            ))}
          </tbody>
        </table>}
        <div className="quote-paper-subtotal">
          {show_measurements && <p>{NUMBER.format(sample.budget.total_area)} m² / {sample.budget.total_rolls} rolos</p>}
          <p><span>Subtotal do serviço</span><span>{CURRENCY.format(sample.budget.subtotal_rolls)}</span></p>
        </div>
        {classic ? <div className="quote-paper-editorial-close">{conditions}{total}</div> : <>{!studio && total}{conditions}</>}
        {show_scope && <PaperMessage title="Escopo e observações">{scope_text.trim() || defaultScope}</PaperMessage>}
        {closing_text.trim() && <PaperMessage title="Mensagem final">{closing_text}</PaperMessage>}
        {show_signature && <div className="quote-paper-signature"><span>Assinatura do cliente</span><span>Assinatura do instalador</span></div>}
      </div>
      <footer className="quote-paper-footer"><span>{free ? 'Gerado com InstalarPro' : footer_text.trim() || `${brand} / ${number}`}</span>{show_contact && owner.phone && <span>{owner.phone}</span>}<span>1 / 1</span></footer>
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
  const [freePreview, setFreePreview] = useState(null);

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

  const template = isPro ? form.template : freePreview || basic.template;
  const free = template === basic.template;
  const preview = free ? { ...defaults, ...basic } : { ...form, template };
  const color = validHex(form.accent_color) ? form.accent_color.toUpperCase() : null;
  const ready = !loading && !planLoading && !loadError && (free || Boolean(color));
  const dirty = Object.keys(defaults).some(field => form[field] !== saved[field]);
  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }));
    setSaveError('');
    setExportError('');
  }

  function selectModel(id) {
    if (isPro) {
      setFreePreview(null);
      setForm(current => ({
        ...current, template: id,
        // Keep unfinished edits when changing layout, but never save an incomplete hex.
        accent_color: id === basic.template && !validHex(current.accent_color) ? saved.accent_color : current.accent_color,
      }));
    } else {
      setFreePreview(id);
    }
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
      const { data } = await api.post('/users/pdf-branding/preview', preview, { responseType: 'blob' });
      const { saved } = await exportFile(data, 'orcamento-exemplo.pdf', 'application/pdf');
      if (saved && isNativeStoreApp()) toast.success('PDF de teste salvo no local escolhido.');
    } catch (error) {
      setExportError(error.response?.status === 429
        ? 'Aguarde um minuto antes de baixar outro exemplo.'
        : await exportErrorMessage(error, 'Não foi possível baixar o exemplo. Tente novamente.'));
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
      {!isPro && !planLoading && <div className="quote-studio-notice">
        <span>{isNativeStoreApp()
          ? 'Seus orçamentos usam o modelo Gratuito. Os outros três modelos estão disponíveis para experimentar e baixar como exemplo.'
          : 'Seus orçamentos usam o modelo Gratuito. Você pode experimentar os outros três e baixar exemplos antes de assinar.'}</span>
        <Link to="/subscription">{planLinkLabel('Conhecer o Pro')}</Link>
      </div>}
      <div className="quote-studio-mobile-views" aria-label="Área de trabalho">
        <button type="button" aria-pressed={mobileView === 'edit'} onClick={() => setMobileView('edit')}>Personalizar</button>
        <button type="button" aria-pressed={mobileView === 'preview'} onClick={() => setMobileView('preview')}>Ver prévia</button>
      </div>
      <div className="quote-studio-grid">
        <form className="quote-studio-editor" onSubmit={save} aria-label="Personalizar PDF" aria-busy={loading}>
          <fieldset className="quote-studio-editable" disabled={loading || planLoading || Boolean(loadError) || saving}>
            <section>
              <h2>Modelo</h2>
              <p>Compare as quatro formas de apresentar sua proposta.</p>
              <div className="quote-studio-templates" role="radiogroup" aria-label="Modelo do PDF">
                {templates.map(item => (
                  <label key={item.id} data-selected={template === item.id} title={item.description}>
                    <input type="radio" aria-label={item.label} name="template" value={item.id} checked={template === item.id} onChange={() => selectModel(item.id)} />
                    <span className="quote-template-icon" data-template={item.id} aria-hidden="true"><i /><i /><i /><i /></span>
                    <span className="quote-template-label">{item.label}{item.id !== 'basic' && <small>Pro</small>}</span>
                  </label>
                ))}
              </div>
              <p className="quote-studio-template-note">{templates.find(item => item.id === template)?.description}</p>
            </section>
            {free ? <section className="quote-studio-basic-info">
              <h2>Pronto para usar</h2>
              <p>O modelo Gratuito já vem com os dados do orçamento, do cliente e do instalador. Para mudar a identidade e o conteúdo visível, escolha um modelo Pro.</p>
            </section> : <>
            <section>
              <h2>Identidade</h2>
              <div className="quote-studio-fields">
                <EditorField field="brand_name" label="Nome da marca" form={form} update={update} placeholder={owner.business_name || owner.name || 'Ex.: Seu negócio'} />
                <EditorField field="document_title" label="Título do documento" form={form} update={update} placeholder={defaults.document_title} />
                <EditorField field="document_subtitle" label="Subtítulo" form={form} update={update} placeholder="Ex.: Instalação de revestimento decorativo" />
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
              <summary>Aparência do papel <Icon name="chevron" /></summary>
              <div className="quote-studio-fields">
                {Object.entries({ heading_font: 'Fonte dos títulos', paper_tone: 'Fundo da página', density: 'Espaçamento' }).map(([field, label]) => (
                  <label className="quote-studio-field" key={field}><span>{label}</span>
                    <select aria-label={label} value={form[field]} onChange={event => update(field, event.target.value)}>
                      {appearanceOptions[field].map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
                    </select>
                  </label>
                ))}
                <div className="quote-studio-visibility">
                  <label><input type="checkbox" checked={form.show_pattern} onChange={event => update('show_pattern', event.target.checked)} />Exibir grafismo do modelo</label>
                </div>
              </div>
            </details>
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
                <EditorField field="footer_text" label="Texto do rodapé" form={form} update={update} placeholder="Ex.: Ateliê Linha de Parede | São José, SC" />
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
            </>}
          </fieldset>
          <footer className="quote-studio-save">
            <span aria-live="polite">{loading ? 'Carregando…' : loadError ? 'Preferências indisponíveis' : !isPro ? (free ? 'Modelo usado nos seus orçamentos' : 'Prévia de um modelo Pro') : dirty ? 'Alterações não salvas' : 'Aplica aos próximos downloads'}</span>
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
          <div className="quote-studio-desk">{loading ? <p role="status">Carregando prévia…</p> : <Preview form={preview} owner={owner} />}</div>
          <p className="quote-studio-preview-note">O download usa as configurações desta prévia, mesmo antes de salvar.</p>
        </section>
      </div>
    </div>
  );
}
