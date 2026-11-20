import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import api from '../../services/api';
import Turnstile, { isTurnstileEnabled } from '../Security/Turnstile';
import { buildClientRequestTrackingHash } from '../../utils/clientRequest';
import linkContract from '../../../../shared/installerClientLink.json';
import quoteContract from '../../../../shared/directQuoteDetails.json';

const STATES = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const emptyRequest = { client_name: '', client_phone: '', city: '', state: '', details: '', privacy_consent: false };
const emptyQuote = {
  client_email: '', zip_code: '', street: '', house_number: '', neighborhood: '', address_reference: '', place_type: '', material_type: '',
};
const newRoom = (id) => ({ id, name: '', width: '', height: '', rolls: '', removal: 'unknown' });
const optionalNumber = (value) => value === '' ? null : Number(value);

export default function DirectProfileRequest({ installer, inviteToken, onClose }) {
  const titleId = useId();
  const dialog = useRef(null);
  const heading = useRef(null);
  const scrollArea = useRef(null);
  const roomId = useRef(1);
  const postalLookup = useRef(null);
  const pending = useRef(false);
  const [form, setForm] = useState(emptyRequest);
  const [quote, setQuote] = useState(emptyQuote);
  const [rooms, setRooms] = useState(() => [newRoom(1)]);
  const [checkingPostal, setCheckingPostal] = useState(false);
  const [postalStatus, setPostalStatus] = useState('');
  const [token, setToken] = useState('');
  const [challengeReset, setChallengeReset] = useState(0);
  const [challengeRetry, setChallengeRetry] = useState(0);
  const [challengeFailed, setChallengeFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [trackingHash, setTrackingHash] = useState('');
  const verificationAvailable = isTurnstileEnabled();

  useLayoutEffect(() => {
    const frame = dialog.current;
    if (!frame) return;
    if (!frame.open) frame.showModal();
    if (scrollArea.current) scrollArea.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [trackingHash]);

  useEffect(() => () => postalLookup.current?.abort(), []);

  function change(event) {
    const { name, type, checked, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function changeQuote(event) {
    const { name, value } = event.target;
    if (name === 'zip_code') {
      postalLookup.current?.abort();
      postalLookup.current = null;
      setCheckingPostal(false);
      setPostalStatus('');
    }
    setQuote((current) => ({ ...current, [name]: value }));
  }

  async function fillPostalAddress() {
    const cep = quote.zip_code.replace(/\D/g, '');
    if (cep.length !== 8) {
      setPostalStatus('Digite os 8 números do CEP ou preencha o endereço manualmente.');
      return;
    }
    if (postalLookup.current) return;
    const controller = new AbortController();
    postalLookup.current = controller;
    setCheckingPostal(true);
    setPostalStatus('');
    try {
      const { data } = await api.get('/public/location/search', { params: { q: cep }, signal: controller.signal, timeout: 7000 });
      if (controller.signal.aborted) return;
      if (!data?.city || data.zipCode?.replace(/\D/g, '') !== cep) throw new Error('postal_address_missing');
      setQuote((current) => ({ ...current, street: current.street || data.street || '', neighborhood: current.neighborhood || data.neighborhood || '' }));
      setForm((current) => ({ ...current, city: current.city || data.city, state: current.state || (STATES.includes(data.state) ? data.state : '') }));
      setPostalStatus('Confira o endereço e preencha os campos que faltam.');
    } catch {
      if (!controller.signal.aborted) setPostalStatus('Não encontrei o CEP agora. Você pode preencher o endereço manualmente.');
    } finally {
      if (postalLookup.current === controller) {
        postalLookup.current = null;
        setCheckingPostal(false);
      }
    }
  }

  function changeRoom(id, event) {
    const { name, value } = event.target;
    setRooms((current) => current.map((room) => room.id === id ? { ...room, [name]: value } : room));
  }

  async function send(event) {
    event.preventDefault();
    if (pending.current || !form.privacy_consent || !verificationAvailable || !token) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      const config = inviteToken ? { headers: { [linkContract.authorizationHeader]: inviteToken } } : undefined;
      const { data } = await api.post(`/public/installers/${installer.id}/direct-requests`, {
        ...form, turnstile_token: token,
        quote_details: {
          ...quote,
          environments: rooms.map(({ name, width, height, rolls, removal }) => ({
            name, width: optionalNumber(width), height: optionalNumber(height), rolls: optionalNumber(rolls), removal,
          })),
        },
      }, config);
      const hash = buildClientRequestTrackingHash(data?.service_request);
      if (!hash) throw new Error('missing_tracking_code');
      setTrackingHash(hash);
      setForm(emptyRequest);
    } catch (cause) {
      setError(cause.response?.data?.error || 'Não foi possível confirmar o envio. Confira sua conexão antes de tentar novamente.');
      setToken('');
      setChallengeReset((key) => key + 1);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog
      aria-describedby={`${titleId}-description`}
      aria-labelledby={titleId}
      aria-modal="true"
      className="ig-direct-request"
      id="ig-direct-request-dialog"
      onCancel={(event) => { if (pending.current) event.preventDefault(); }}
      onClose={onClose}
      ref={dialog}
    >
      <header className="ig-direct-request-header">
        <div>
          <h2 id={titleId} ref={heading} tabIndex={-1}>{trackingHash ? 'Pedido direto enviado' : 'Pedir orçamento a este instalador'}</h2>
          <p id={`${titleId}-description`}>{trackingHash
            ? `Só ${installer.display_name} recebeu o pedido. Guarde o link privado para acompanhar a resposta.`
            : `Envie uma solicitação só para ${installer.display_name}. Você não precisa criar conta e o envio não contrata o serviço.`}</p>
        </div>
        <button aria-label="Fechar formulário" className="ig-direct-secondary ig-direct-close" disabled={saving} onClick={() => dialog.current?.close()} type="button">
          <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="ig-direct-request-body" ref={scrollArea}>
      {trackingHash ? <Link className="ig-profile-primary-action" to={`/cliente/pedido${trackingHash}`}>Acompanhar pedido</Link> : (
        <form onSubmit={send}>
          <fieldset className="ig-direct-fields">
            <legend>1. Seus dados</legend>
            <label>Seu nome<input autoComplete="name" maxLength={100} minLength={2} name="client_name" onChange={change} required value={form.client_name} /></label>
            <label>WhatsApp com DDD<input autoComplete="tel" maxLength={22} name="client_phone" onChange={change} placeholder="(48) 99999-0000" required type="tel" value={form.client_phone} /></label>
            <label>E-mail (opcional)<input autoComplete="email" maxLength={150} name="client_email" onChange={changeQuote} type="email" value={quote.client_email} /></label>
          </fieldset>
          <fieldset className="ig-direct-fields">
            <legend>2. Endereço da instalação</legend>
            <label>CEP (opcional)<input autoComplete="postal-code" inputMode="numeric" maxLength={9} name="zip_code" onChange={changeQuote} placeholder="00000-000" value={quote.zip_code} /></label>
            <button className="ig-direct-secondary ig-direct-lookup" disabled={checkingPostal} onClick={() => void fillPostalAddress()} type="button">{checkingPostal ? 'Buscando…' : 'Buscar pelo CEP'}</button>
            {postalStatus ? <p className="ig-direct-message" role="status">{postalStatus}</p> : null}
            <label>Bairro<input autoComplete="address-level3" maxLength={120} name="neighborhood" onChange={changeQuote} required value={quote.neighborhood} /></label>
            <label>Rua ou avenida<input autoComplete="address-line1" maxLength={160} minLength={2} name="street" onChange={changeQuote} required value={quote.street} /></label>
            <label>Número<input maxLength={30} name="house_number" onChange={changeQuote} placeholder="Ex.: 120 ou S/N" required value={quote.house_number} /></label>
            <label>Cidade da instalação<input maxLength={120} minLength={2} name="city" onChange={change} required value={form.city} /></label>
            <label><span id={`${titleId}-state`}>Estado</span><select aria-labelledby={`${titleId}-state`} name="state" onChange={change} required value={form.state}><option value="">Selecione a UF</option>{STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></label>
            <label className="ig-direct-message">Complemento ou referência (opcional)<input autoComplete="address-line2" maxLength={300} name="address_reference" onChange={changeQuote} placeholder="Ex.: bloco B, apto. 203" value={quote.address_reference} /></label>
          </fieldset>
          <fieldset className="ig-direct-fields">
            <legend>3. Sobre o serviço</legend>
            <label>Tipo de local<select name="place_type" onChange={changeQuote} required value={quote.place_type}><option value="">Selecione</option>{Object.entries(quoteContract.places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Tipo de papel<select name="material_type" onChange={changeQuote} required value={quote.material_type}><option value="">Selecione</option>{Object.entries(quoteContract.materials).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <p className="ig-direct-message">Se souber as medidas, informe em metros. O instalador pode confirmar ou ajustar depois.</p>
            {rooms.map((room, index) => (
              <fieldset className="ig-direct-fields ig-direct-room ig-direct-message" key={room.id}>
                <legend>Ambiente {index + 1}</legend>
                <label>Nome do ambiente<input maxLength={80} name="name" onChange={(event) => changeRoom(room.id, event)} placeholder="Ex.: sala ou quarto" required value={room.name} /></label>
                <label>Precisa remover papel antigo?<select name="removal" onChange={(event) => changeRoom(room.id, event)} value={room.removal}><option value="unknown">Ainda não sei</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
                <label>Largura (m, opcional)<input inputMode="decimal" max={quoteContract.maxDimension} min="0.01" name="width" onChange={(event) => changeRoom(room.id, event)} step="0.01" type="number" value={room.width} /></label>
                <label>Altura (m, opcional)<input inputMode="decimal" max={quoteContract.maxDimension} min="0.01" name="height" onChange={(event) => changeRoom(room.id, event)} step="0.01" type="number" value={room.height} /></label>
                <label>Quantidade de rolos (opcional)<input inputMode="numeric" max={quoteContract.maxRolls} min="1" name="rolls" onChange={(event) => changeRoom(room.id, event)} step="1" type="number" value={room.rolls} /></label>
                {rooms.length > 1 ? <button aria-label={`Remover ambiente ${index + 1}`} className="ig-direct-secondary" onClick={() => setRooms((current) => current.filter((item) => item.id !== room.id))} type="button">Remover ambiente</button> : null}
              </fieldset>
            ))}
            {rooms.length < quoteContract.maxEnvironments ? <button className="ig-direct-secondary ig-direct-add-room" onClick={() => { roomId.current += 1; setRooms((current) => [...current, newRoom(roomId.current)]); }} type="button">Adicionar ambiente</button> : null}
            <label className="ig-direct-message">O que você precisa?<textarea maxLength={800} name="details" onChange={change} placeholder="Ex.: instalar papel de parede na sala. Já tenho o material." required rows={4} value={form.details} /></label>
          </fieldset>
          <label className="ig-direct-consent">
            <input checked={form.privacy_consent} name="privacy_consent" onChange={change} required type="checkbox" />
            <span>Autorizo compartilhar os dados deste pedido só com {installer.display_name}, para contato sobre o serviço. Concordo com os <Link to="/termos" target="_blank" rel="noopener">Termos de Uso</Link> e a <Link to="/privacidade" target="_blank" rel="noopener">Política de Privacidade</Link>.</span>
          </label>
          <Turnstile key={challengeRetry} action="direct_service_request" onError={() => { setToken(''); setChallengeFailed(true); }} onExpire={() => setToken('')} onVerify={(value) => { setChallengeFailed(false); setToken(value); }} resetKey={challengeReset} />
          {challengeFailed ? <div>
            <p className="ig-direct-error" role="alert">Não foi possível carregar a verificação antirrobô.</p>
            <button className="ig-direct-secondary" type="button" onClick={() => { setChallengeFailed(false); setChallengeRetry((value) => value + 1); }}>Tentar verificação novamente</button>
          </div> : null}
          {!verificationAvailable ? <p role="status">A verificação antirrobô não está disponível. Tente novamente mais tarde.</p> : null}
          {error ? <p className="ig-direct-error" role="alert">{error}</p> : null}
          <button className="ig-profile-primary-action" disabled={saving || !form.privacy_consent || !verificationAvailable || !token} type="submit">{saving ? 'Enviando…' : 'Enviar pedido ao instalador'}</button>
        </form>
      )}
      </div>
    </dialog>
  );
}
