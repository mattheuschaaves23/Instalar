import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import api from '../../services/api';
import Turnstile, { isTurnstileEnabled } from '../Security/Turnstile';
import { buildClientRequestTrackingHash } from '../../utils/clientRequest';
import linkContract from '../../../../shared/installerClientLink.json';

const STATES = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const emptyRequest = { client_name: '', client_phone: '', city: '', state: '', details: '', privacy_consent: false };

export default function DirectProfileRequest({ installer, inviteToken, onClose }) {
  const titleId = useId();
  const heading = useRef(null);
  const pending = useRef(false);
  const [form, setForm] = useState(emptyRequest);
  const [token, setToken] = useState('');
  const [challengeReset, setChallengeReset] = useState(0);
  const [challengeRetry, setChallengeRetry] = useState(0);
  const [challengeFailed, setChallengeFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [trackingHash, setTrackingHash] = useState('');
  const verificationAvailable = isTurnstileEnabled();

  useEffect(() => {
    heading.current?.focus();
    heading.current?.scrollIntoView?.({ block: 'nearest' });
  }, [trackingHash]);

  function change(event) {
    const { name, type, checked, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  async function send(event) {
    event.preventDefault();
    if (pending.current || !form.privacy_consent || !verificationAvailable || !token) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      const config = inviteToken ? { headers: { [linkContract.authorizationHeader]: inviteToken } } : undefined;
      const { data } = await api.post(`/public/installers/${installer.id}/direct-requests`, { ...form, turnstile_token: token }, config);
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
    <section className="ig-profile-panel ig-direct-request" aria-labelledby={titleId}>
      <header>
        <div>
          <h2 id={titleId} ref={heading} tabIndex={-1}>{trackingHash ? 'Pedido direto enviado' : 'Pedir orçamento a este instalador'}</h2>
          <p>{trackingHash
            ? `Só ${installer.display_name} recebeu o pedido. Guarde o link privado para acompanhar a resposta.`
            : `Envie uma solicitação só para ${installer.display_name}. Você não precisa criar conta e o envio não contrata o serviço.`}</p>
        </div>
        {!trackingHash ? <button className="ig-direct-secondary" type="button" onClick={onClose} disabled={saving}>Fechar formulário</button> : null}
      </header>
      {trackingHash ? <Link className="ig-profile-primary-action" to={`/cliente/pedido${trackingHash}`}>Acompanhar pedido</Link> : (
        <form onSubmit={send}>
          <div className="ig-direct-fields">
            <label>Seu nome<input autoComplete="name" maxLength={120} minLength={2} name="client_name" onChange={change} required value={form.client_name} /></label>
            <label>WhatsApp com DDD<input autoComplete="tel" maxLength={22} name="client_phone" onChange={change} placeholder="(48) 99999-0000" required type="tel" value={form.client_phone} /></label>
            <label>Cidade da instalação<input maxLength={120} minLength={2} name="city" onChange={change} required value={form.city} /></label>
            <label><span id={`${titleId}-state`}>Estado</span><select aria-labelledby={`${titleId}-state`} name="state" onChange={change} required value={form.state}><option value="">Selecione a UF</option>{STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></label>
            <label className="ig-direct-message">O que você precisa?<textarea maxLength={800} name="details" onChange={change} placeholder="Ex.: instalar papel de parede na sala. Já tenho o material." required rows={4} value={form.details} /></label>
          </div>
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
    </section>
  );
}
