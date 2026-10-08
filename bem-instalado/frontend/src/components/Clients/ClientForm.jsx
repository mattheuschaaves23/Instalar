import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatDocument, isValidDocument, normalizeDocument } from '../../../../shared/documents.mjs';

const BRAZILIAN_STATES = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'],
  ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'],
  ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'],
  ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'],
  ['RS', 'Rio Grande do Sul'], ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'], ['SP', 'São Paulo'],
  ['SE', 'Sergipe'], ['TO', 'Tocantins'],
];

const emptyForm = {
  client_type: 'person',
  name: '',
  document_id: '',
  contact_name: '',
  phone: '',
  whatsapp: '',
  email: '',
  street: '',
  house_number: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
  address_reference: '',
  address: '',
};

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatPhone(value) {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatZipCode(value) {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function ClientFormIcon({ type }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  switch (type) {
    case 'person':
      return <svg {...props}><circle cx="12" cy="8" r="3" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></svg>;
    case 'company':
      return <svg {...props}><path d="M4.5 20V7.5h9V20M13.5 10.5h6V20M7.5 10.5h2M7.5 14h2M16 14h1.5" /><path d="M3.5 20h17" /></svg>;
    case 'user':
      return <svg {...props}><circle cx="12" cy="8" r="3" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></svg>;
    case 'pin':
      return <svg {...props}><path d="M19 10.2c0 5-7 10.3-7 10.3S5 15.2 5 10.2a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.2" /></svg>;
    case 'phone':
      return <svg {...props}><path d="M7 4.5 5.4 6.1c-1 1 1 5.6 4.1 8.7 3.1 3.1 7.7 5.1 8.7 4.1l1.6-1.6-3.1-3.1-1.8 1c-1.1-.5-2.1-1.2-3-2.1-.9-.9-1.6-1.9-2.1-3l1-1.8L7 4.5Z" /></svg>;
    case 'message':
      return <svg {...props}><path d="M20 11.5a7.5 7.5 0 0 1-11.2 6.5L4.5 19l1-4.1A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8.5 11.5h7M8.5 14.5h4" /></svg>;
    case 'mail':
      return <svg {...props}><rect x="4" y="5.5" width="16" height="13" rx="2" /><path d="m5 7 7 5 7-5" /></svg>;
    case 'search':
      return <svg {...props}><circle cx="10.5" cy="10.5" r="4.5" /><path d="m14 14 4.5 4.5" /></svg>;
    case 'info':
      return <svg {...props}><circle cx="12" cy="12" r="8" /><path d="M12 10v5M12 7.5h.01" /></svg>;
    case 'close':
      return <svg {...props}><path d="m7 7 10 10M17 7 7 17" /></svg>;
    case 'save':
      return <svg {...props}><path d="M5 4.5h11l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V4.5Z" /><path d="M8 4.5V9h7V4.5M8 20.5v-6h8v6" /></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

export default function ClientForm({ client = null, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [samePhoneAsWhatsApp, setSamePhoneAsWhatsApp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookingUpZip, setLookingUpZip] = useState(false);
  const isCompany = form.client_type === 'company';
  const documentLabel = isCompany ? 'CNPJ' : 'CPF';
  const nameLabel = isCompany ? 'Razão social' : 'Nome completo';
  const documentPlaceholder = isCompany ? '00.000.000/0000-00' : '000.000.000-00';

  const contactDescription = useMemo(
    () => (isCompany
      ? 'No cadastro de empresa, informe a razão social, CNPJ e a pessoa responsável pelo atendimento.'
      : 'Cadastre as informações de contato e o endereço para usar em orçamentos, atendimentos e rota.'),
    [isCompany]
  );

  useEffect(() => {
    if (!client) {
      setForm(emptyForm);
      setSamePhoneAsWhatsApp(true);
      return;
    }

    const clientType = client.client_type === 'company' ? 'company' : 'person';
    const phone = formatPhone(client.phone || '');
    const whatsapp = formatPhone(client.whatsapp || client.phone || '');

    setForm({
      client_type: clientType,
      name: client.name || '',
      document_id: formatDocument(client.document_id || '', clientType),
      contact_name: client.contact_name || '',
      phone,
      whatsapp,
      email: client.email || '',
      street: client.street || '',
      house_number: client.house_number || '',
      neighborhood: client.neighborhood || '',
      city: client.city || '',
      state: client.state || '',
      zip_code: formatZipCode(client.zip_code || ''),
      address_reference: client.address_reference || '',
      address: client.address || '',
    });
    setSamePhoneAsWhatsApp(Boolean(phone) && phone === whatsapp);
  }, [client]);

  const handleChange = (event) => {
    const { name } = event.target;
    let { value } = event.target;

    if (name === 'phone' || name === 'whatsapp') value = formatPhone(value);
    if (name === 'document_id') value = formatDocument(value, form.client_type);
    if (name === 'zip_code') value = formatZipCode(value);
    if (name === 'state') value = value.toUpperCase().slice(0, 2);

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'phone' && samePhoneAsWhatsApp ? { whatsapp: value } : {}),
    }));
  };

  const handleClientTypeChange = (clientType) => {
    setForm((current) => ({
      ...current,
      client_type: clientType,
      document_id: '',
    }));
  };

  const handleSamePhoneChange = () => {
    setSamePhoneAsWhatsApp((current) => {
      const next = !current;
      if (next) setForm((formCurrent) => ({ ...formCurrent, whatsapp: formCurrent.phone }));
      return next;
    });
  };

  const lookupZipCode = async () => {
    const zipCode = digitsOnly(form.zip_code);
    if (zipCode.length !== 8) {
      toast.error('Informe um CEP com 8 números.');
      return;
    }

    setLookingUpZip(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`);
      if (!response.ok) throw new Error('lookup_failed');
      const data = await response.json();
      if (data.erro) {
        toast.error('CEP não encontrado. Confira e tente novamente.');
        return;
      }

      setForm((current) => ({
        ...current,
        street: data.logradouro || current.street,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        state: data.uf || current.state,
      }));
      toast.success('Endereço preenchido pelo CEP.');
    } catch (_error) {
      toast.error('Não foi possível consultar esse CEP agora.');
    } finally {
      setLookingUpZip(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const documentUnchanged = client && form.client_type === (client.client_type === 'company' ? 'company' : 'person')
      && normalizeDocument(form.document_id) === normalizeDocument(client.document_id);

    const hasCompleteAddress = [form.zip_code, form.street, form.house_number, form.neighborhood, form.city, form.state]
      .every((value) => String(value || '').trim());

    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Preencha o nome e o telefone do cliente.');
      return;
    }

    if (!documentUnchanged && !isValidDocument(form.document_id, form.client_type)) {
      toast.error(`Informe um ${documentLabel} válido.`);
      return;
    }

    if (isCompany && !form.contact_name.trim()) {
      toast.error('Informe a pessoa responsável pela empresa.');
      return;
    }

    if (!hasCompleteAddress) {
      toast.error('Complete o endereço da instalação.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        phone: form.phone.trim(),
        whatsapp: (form.whatsapp || form.phone).trim(),
        state: form.state.toUpperCase(),
      };
      // An unrelated edit must not replace or invalidate a legacy document.
      if (documentUnchanged) {
        delete payload.document_id;
        delete payload.client_type;
      }
      const response = client?.id
        ? await api.put(`/clients/${client.id}`, payload)
        : await api.post('/clients', payload);

      toast.success(client ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      onSaved?.(response.data);
      onClose?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível salvar o cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div aria-modal="true" className="client-form-overlay" role="dialog">
      <section className="client-form-modal">
        <header className="client-form-header">
          <div>
            <p>{client ? 'Editar contato' : 'Novo contato'}</p>
            <h2>{client ? 'Atualizar cliente' : 'Cadastrar cliente'}</h2>
            <span>Salve as informações do cliente e do endereço para usar em orçamentos, atendimentos e rota.</span>
          </div>
          <button aria-label="Fechar cadastro de cliente" className="client-form-close" onClick={onClose} type="button">
            <ClientFormIcon type="close" />
          </button>
        </header>

        <div className="client-form-type-row">
          <div className="client-form-type-switch" role="group" aria-label="Tipo de cliente">
            <button className={!isCompany ? 'is-active' : ''} onClick={() => handleClientTypeChange('person')} type="button">
              <ClientFormIcon type="person" />
              Pessoa física
            </button>
            <button className={isCompany ? 'is-active' : ''} onClick={() => handleClientTypeChange('company')} type="button">
              <ClientFormIcon type="company" />
              Empresa
            </button>
          </div>
          <p className="client-form-tip"><ClientFormIcon type="info" />{contactDescription}</p>
        </div>

        <form className="client-form-body" onSubmit={handleSubmit}>
          <section className="client-form-section">
            <div className="client-form-section-heading">
              <div><ClientFormIcon type="user" /><strong>1. Dados do cliente</strong></div>
            </div>

            <div className="client-form-grid client-form-grid--contact">
              <label className="client-form-field client-form-field--wide">
                <span>{nameLabel} <b>*</b></span>
                <input autoFocus name="name" onChange={handleChange} placeholder={isCompany ? 'Digite a razão social' : 'Digite o nome completo'} value={form.name} />
              </label>
              <label className="client-form-field">
                <span>{documentLabel} <b>*</b></span>
                <input inputMode={isCompany ? 'text' : 'numeric'} maxLength={isCompany ? 18 : 14} name="document_id" onChange={handleChange} placeholder={documentPlaceholder} value={form.document_id} />
              </label>
              {isCompany ? (
                <label className="client-form-field">
                  <span>Responsável <b>*</b></span>
                  <input name="contact_name" onChange={handleChange} placeholder="Nome do responsável" value={form.contact_name} />
                </label>
              ) : null}
              <label className="client-form-field">
                <span>Telefone <b>*</b></span>
                <div className="client-form-input-icon"><ClientFormIcon type="phone" /><input inputMode="tel" name="phone" onChange={handleChange} placeholder="(00) 00000-0000" value={form.phone} /></div>
              </label>
              <label className="client-form-field">
                <span>WhatsApp</span>
                <div className="client-form-input-icon"><ClientFormIcon type="message" /><input disabled={samePhoneAsWhatsApp} inputMode="tel" name="whatsapp" onChange={handleChange} placeholder="(00) 00000-0000" value={form.whatsapp} /></div>
              </label>
              <label className="client-form-field client-form-same-phone">
                <span>Contato principal</span>
                <button aria-pressed={samePhoneAsWhatsApp} className={samePhoneAsWhatsApp ? 'is-active' : ''} onClick={handleSamePhoneChange} type="button">
                  <i aria-hidden="true" />
                  Usar telefone no WhatsApp
                </button>
              </label>
              <label className="client-form-field">
                <span>E-mail</span>
                <div className="client-form-input-icon"><ClientFormIcon type="mail" /><input name="email" onChange={handleChange} placeholder="exemplo@email.com" type="email" value={form.email} /></div>
              </label>
            </div>
          </section>

          <section className="client-form-section">
            <div className="client-form-section-heading">
              <div><ClientFormIcon type="pin" /><strong>2. Endereço da instalação</strong></div>
            </div>

            <div className="client-form-grid client-form-grid--address">
              <label className="client-form-field">
                <span>CEP <b>*</b></span>
                <div className="client-form-zip-control">
                  <input inputMode="numeric" name="zip_code" onChange={handleChange} placeholder="00000-000" value={form.zip_code} />
                  <button disabled={lookingUpZip} onClick={lookupZipCode} type="button"><ClientFormIcon type="search" />{lookingUpZip ? 'Buscando' : 'Buscar'}</button>
                </div>
                <small>Buscar endereço pelo CEP</small>
              </label>
              <label className="client-form-field client-form-field--span-2">
                <span>Rua <b>*</b></span>
                <input name="street" onChange={handleChange} placeholder="Nome da rua" value={form.street} />
              </label>
              <label className="client-form-field">
                <span>Número <b>*</b></span>
                <input name="house_number" onChange={handleChange} placeholder="Número" value={form.house_number} />
              </label>
              <label className="client-form-field client-form-field--span-2">
                <span>Complemento</span>
                <input name="address" onChange={handleChange} placeholder="Apto, sala, bloco, etc." value={form.address} />
              </label>
              <label className="client-form-field">
                <span>Bairro <b>*</b></span>
                <input name="neighborhood" onChange={handleChange} placeholder="Nome do bairro" value={form.neighborhood} />
              </label>
              <label className="client-form-field client-form-field--span-2">
                <span>Cidade <b>*</b></span>
                <input name="city" onChange={handleChange} placeholder="Nome da cidade" value={form.city} />
              </label>
              <label className="client-form-field">
                <span>Estado <b>*</b></span>
                <select name="state" onChange={handleChange} value={form.state}>
                  <option value="">UF</option>
                  {BRAZILIAN_STATES.map(([value, label]) => <option key={value} value={value}>{value} — {label}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="client-form-section client-form-section--reference">
            <div className="client-form-section-heading">
              <div><ClientFormIcon type="message" /><strong>3. Referência do local</strong></div>
            </div>
            <label className="client-form-field">
              <span>Especificação / referência</span>
              <textarea name="address_reference" onChange={handleChange} placeholder="Ex.: casa com portão preto, bloco B, apartamento 203, ponto de referência..." rows="2" value={form.address_reference} />
              <small>Informações que ajudam o instalador a localizar o endereço com mais facilidade.</small>
            </label>
          </section>

          <footer className="client-form-footer">
            <button className="client-form-cancel" onClick={onClose} type="button">Cancelar</button>
            <button className="client-form-submit" disabled={saving} type="submit"><ClientFormIcon type="save" />{saving ? 'Salvando...' : client ? 'Salvar alterações' : 'Salvar e continuar'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
