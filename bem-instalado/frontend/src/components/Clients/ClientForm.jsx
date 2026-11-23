import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatDocument, isValidDocument, normalizeDocument } from '../../../../shared/documents.mjs';
import './ClientForm.css';

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
  const raw = digitsOnly(value);
  const digits = (raw.startsWith('55') && (raw.length === 12 || raw.length === 13) ? raw.slice(2) : raw).slice(0, 11);

  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatZipCode(value) {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function ClientCloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="m7 7 10 10M17 7 7 17" /></svg>;
}

export default function ClientForm({ allowIncomplete = false, client = null, quickCreate = false, onClose, onSaved }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const nameRef = useRef(null);
  const titleRef = useRef(null);
  const formRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [samePhoneAsWhatsApp, setSamePhoneAsWhatsApp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookingUpZip, setLookingUpZip] = useState(false);
  const [error, setError] = useState(null);
  const [zipStatus, setZipStatus] = useState(null);
  const onlyName = quickCreate && !client;
  const requireDetails = !client && !onlyName && !allowIncomplete;
  const requireContact = requireDetails || Boolean(client && client.client_type !== 'company');
  const isCompany = form.client_type === 'company';
  const documentLabel = isCompany ? 'CNPJ' : 'CPF';
  const nameLabel = isCompany ? 'Razão social' : 'Nome completo';
  const documentPlaceholder = isCompany ? '00.000.000/0000-00' : '000.000.000-00';

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    if (window.matchMedia?.('(pointer: fine)').matches) nameRef.current?.focus({ preventScroll: true });
    else titleRef.current?.focus({ preventScroll: true });
  }, []);

  const dismiss = () => {
    dialogRef.current?.close();
    onClose?.();
  };

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
    setSamePhoneAsWhatsApp(phone === whatsapp);
  }, [client]);

  const handleChange = (event) => {
    const { name } = event.target;
    let { value } = event.target;
    setError((current) => current?.field === name ? null : current);
    if (name === 'zip_code') setZipStatus(null);

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
    if (clientType === form.client_type) return;
    setError(null);
    setForm((current) => ({
      ...current,
      client_type: clientType,
      document_id: '',
    }));
  };

  const handleSamePhoneChange = () => {
    const next = !samePhoneAsWhatsApp;
    setSamePhoneAsWhatsApp(next);
    if (next) setForm((current) => ({ ...current, whatsapp: current.phone }));
  };

  const lookupZipCode = async () => {
    const zipCode = digitsOnly(form.zip_code);
    if (zipCode.length !== 8) {
      setZipStatus({ error: true, text: 'Informe um CEP com 8 números.' });
      return;
    }

    setLookingUpZip(true);
    setZipStatus(null);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`);
      if (!response.ok) throw new Error('lookup_failed');
      const data = await response.json();
      if (data.erro) {
        setZipStatus({ error: true, text: 'CEP não encontrado. Confira e tente novamente.' });
        return;
      }

      setForm((current) => ({
        ...current,
        ...(digitsOnly(current.zip_code) === zipCode ? {
          street: data.logradouro || current.street,
          neighborhood: data.bairro || current.neighborhood,
          city: data.localidade || current.city,
          state: data.uf || current.state,
        } : {}),
      }));
      setZipStatus({ error: false, text: 'Endereço preenchido pelo CEP.' });
    } catch (_error) {
      setZipStatus({ error: true, text: 'Não foi possível consultar esse CEP agora. Você pode preencher o endereço manualmente.' });
    } finally {
      setLookingUpZip(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || lookingUpZip) return;
    setError(null);
    const showError = (text, field) => {
      setError({ text, field });
      if (field) formRef.current?.elements.namedItem(field)?.focus();
    };
    const documentUnchanged = client && form.client_type === (client.client_type === 'company' ? 'company' : 'person')
      && normalizeDocument(form.document_id) === normalizeDocument(client.document_id);

    const hasCompleteAddress = [form.zip_code, form.street, form.house_number, form.neighborhood, form.city, form.state]
      .every((value) => String(value || '').trim());

    if (!form.name.trim()) {
      showError('Preencha o nome do cliente.', 'name');
      return;
    }

    if (requireDetails && !form.phone.trim()) {
      showError('Preencha o telefone do cliente.', 'phone');
      return;
    }

    if (!onlyName && !documentUnchanged && (requireDetails || client || form.document_id.trim()) && !isValidDocument(form.document_id, form.client_type)) {
      showError(`Informe um ${documentLabel} válido.`, 'document_id');
      return;
    }

    if (isCompany && requireContact && !form.contact_name.trim()) {
      showError('Informe a pessoa responsável pela empresa.', 'contact_name');
      return;
    }

    if (requireDetails && !hasCompleteAddress) {
      showError('Complete o endereço da instalação.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        phone: form.phone.trim(),
        whatsapp: (form.whatsapp || form.phone).trim(),
        state: form.state.toUpperCase(),
      };
      // An unrelated edit must not replace or invalidate a legacy document.
      if (documentUnchanged) {
        delete payload.document_id;
        delete payload.client_type;
      }
      if (client && !payload.phone) delete payload.phone;
      if (client && !payload.contact_name.trim()) delete payload.contact_name;
      const response = client?.id
        ? await api.put(`/clients/${client.id}`, payload)
        : await api.post('/clients', onlyName
          ? { name: payload.name, quick_create: true }
          : allowIncomplete ? { ...payload, allow_incomplete: true } : payload);

      toast.success(client ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      onSaved?.(response.data);
      dismiss();
    } catch (requestError) {
      showError(requestError.response?.data?.error || 'Não foi possível salvar o cliente.');
    } finally {
      setSaving(false);
    }
  };

  const title = client ? 'Atualizar cliente' : onlyName ? 'Adicionar cliente ao orçamento' : 'Cadastrar cliente';
  const description = client ? 'Atualize os dados disponíveis. Você pode completar o cadastro depois.'
    : onlyName ? 'Só o nome é necessário para continuar com o orçamento.'
      : allowIncomplete ? 'Só o nome é obrigatório. Você pode completar o cadastro depois.'
        : 'Salve os dados de contato e o endereço da instalação.';

  const marker = (required) => required ? <b aria-hidden="true"> *</b> : null;
  const field = (label, name, { required, type, className = '', ...attributes } = {}) => (
    <label className={`quote-client-field ${className}`}>
      <span>{label}{marker(required)}</span>
      <input {...attributes} aria-describedby={error?.field === name ? `${titleId}-error` : undefined} aria-invalid={error?.field === name || undefined} name={name} onChange={handleChange} required={required} type={type || 'text'} value={form[name]} />
    </label>
  );

  return (
    <dialog
      aria-describedby={`${titleId}-description`}
      aria-labelledby={titleId}
      className={`quote-client-modal${onlyName ? ' quote-client-modal--quick' : ''}`}
      onCancel={(event) => { event.preventDefault(); if (!saving) dismiss(); }}
      ref={dialogRef}
    >
      <header className="quote-client-header">
        <h2 id={titleId} ref={titleRef} tabIndex={-1}>{title}</h2>
        <p id={`${titleId}-description`}>{description}</p>
        <button aria-label="Fechar cadastro de cliente" className="quote-client-close" disabled={saving} onClick={dismiss} type="button"><ClientCloseIcon /></button>
      </header>

      <form className="quote-client-form" onSubmit={handleSubmit} ref={formRef}>
        {onlyName ? (
          <div className="quote-client-quick-body">
            {field('Nome do cliente', 'name', { autoComplete: 'name', maxLength: 100, ref: nameRef, required: true, placeholder: 'Ex.: Mariana Silva' })}
          </div>
        ) : (
          <>
            <div aria-label="Tipo de cliente" className="quote-client-type" role="group">
              <button aria-pressed={!isCompany} onClick={() => handleClientTypeChange('person')} type="button">Pessoa física</button>
              <button aria-pressed={isCompany} onClick={() => handleClientTypeChange('company')} type="button">Empresa</button>
            </div>
            <div className="quote-client-sections">
              <section aria-label="Dados do cliente" className="quote-client-section">
                <h3>Dados do cliente</h3>
                {field(nameLabel, 'name', { autoComplete: isCompany ? 'organization' : 'name', maxLength: 100, ref: nameRef, required: true })}
                {isCompany && field('Responsável', 'contact_name', { autoComplete: 'name', required: requireContact })}
                {field('Telefone', 'phone', { autoComplete: 'tel', inputMode: 'tel', required: requireDetails, type: 'tel' })}
                <label className="quote-client-check">
                  <input checked={samePhoneAsWhatsApp} onChange={handleSamePhoneChange} type="checkbox" />
                  Usar telefone no WhatsApp
                </label>
                {!samePhoneAsWhatsApp && field('WhatsApp', 'whatsapp', { type: 'tel', inputMode: 'tel' })}
                {field('E-mail', 'email', { autoComplete: 'email', type: 'email' })}
                {field(documentLabel, 'document_id', { inputMode: isCompany ? 'text' : 'numeric', maxLength: isCompany ? 18 : 14, placeholder: requireDetails ? documentPlaceholder : undefined, required: requireDetails })}
              </section>

              <section aria-label="Endereço da instalação" className="quote-client-section">
                <h3>Endereço da instalação</h3>
                <div className="quote-client-cep quote-client-field">
                  <label htmlFor={`${titleId}-cep`}>CEP{marker(requireDetails)}</label>
                  <div className="quote-client-cep-row">
                    <input aria-describedby={zipStatus ? `${titleId}-cep-status` : undefined} aria-invalid={zipStatus?.error || undefined} autoComplete="postal-code" id={`${titleId}-cep`} inputMode="numeric" name="zip_code" onChange={handleChange} required={requireDetails} value={form.zip_code} />
                    <button className="quote-client-button" disabled={lookingUpZip} onClick={lookupZipCode} type="button">{lookingUpZip ? 'Buscando…' : 'Buscar CEP'}</button>
                  </div>
                  {zipStatus && <p className="quote-client-cep-status" data-error={zipStatus.error} id={`${titleId}-cep-status`} role={zipStatus.error ? 'alert' : 'status'}>{zipStatus.text}</p>}
                </div>
                <div className="quote-client-address-row">
                  {field('Rua', 'street', { autoComplete: 'address-line1', required: requireDetails })}
                  {field('Número', 'house_number', { required: requireDetails })}
                </div>
                {field('Bairro', 'neighborhood', { required: requireDetails })}
                <div className="quote-client-address-row">
                  {field('Cidade', 'city', { autoComplete: 'address-level2', required: requireDetails })}
                  <label className="quote-client-field">
                    <span>UF{marker(requireDetails)}</span>
                    <select autoComplete="address-level1" name="state" onChange={handleChange} required={requireDetails} value={form.state}>
                      <option value=""> </option>
                      {BRAZILIAN_STATES.map(([value, label]) => <option key={value} value={value} title={label}>{value}</option>)}
                    </select>
                  </label>
                </div>
                {field('Complemento ou referência', 'address_reference')}
                {client?.address && field('Complemento do endereço', 'address', { autoComplete: 'address-line2' })}
              </section>
            </div>
          </>
        )}
        {error && <p className="quote-client-error" id={`${titleId}-error`} role="alert">{error.text}</p>}
        <footer className="quote-client-footer">
          <button className="quote-client-button" disabled={saving} onClick={dismiss} type="button">Cancelar</button>
          <button className="quote-client-button quote-client-button--primary" disabled={saving || lookingUpZip} type="submit">{saving ? 'Salvando…' : client ? 'Salvar alterações' : 'Salvar e continuar'}</button>
        </footer>
      </form>
    </dialog>
  );
}
