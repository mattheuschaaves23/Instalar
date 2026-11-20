import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import api from '../../services/api';
import linkContract from '../../../../shared/installerClientLink.json';
import { isNativeStoreApp } from '../../utils/nativePlatform';
import { planLinkLabel } from '../../utils/storePlanCopy';

// No app das lojas nao se manda ativar/assinar o Pro (politica de pagamento das lojas).
export function clientLinkPlanCopy(storeApp = isNativeStoreApp()) {
  return storeApp
    ? 'Com o Pro, você recebe pedidos por um link direto, sem precisar publicar seu perfil.'
    : 'Ative o plano para receber pedidos por um link direto, sem precisar publicar seu perfil.';
}

export default function ClientProfileLink() {
  const { hash } = useLocation();
  const headingRef = useRef(null);
  const manualLinkRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [link, setLink] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const url = link?.status === linkContract.status.ready ? link.url : null;

  useEffect(() => {
    const controller = new AbortController();
    setLink(null);
    setCopyStatus('');
    setFailed(false);
    api.get(linkContract.ownerPath, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setLink(data);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (hash !== '#link-para-clientes') return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [hash]);

  useEffect(() => {
    if (!url || copyStatus !== 'manual') return;
    manualLinkRef.current?.focus();
    manualLinkRef.current?.select();
  }, [url, copyStatus]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('manual');
    }
  };

  return (
    <section aria-labelledby="client-profile-link-title" className="profile-client-link" id="link-para-clientes">
      <div className="profile-client-link-copy">
        <h3 id="client-profile-link-title" ref={headingRef} tabIndex={-1}>Link para clientes</h3>
        <p>Com o plano Pro, mande este link pelo WhatsApp. O cliente preenche o pedido sem criar conta, e ele chega só para você em <strong>Oportunidades</strong>. Quem tem o link pode abrir seu perfil, mesmo que ele não apareça na busca.</p>
      </div>

      {url ? (
        <div className="profile-client-link-actions">
          <button className="profile-client-link-button" onClick={copy} type="button">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 5a1 1 0 0 0-1-1H6a2 2 0 0 0-2 2v8a1 1 0 0 0 1 1" />
            </svg>
            Copiar link para clientes
          </button>
          {copyStatus === 'copied' ? <p role="status">Link copiado. Cole na conversa com o cliente.</p> : null}
          {copyStatus === 'manual' ? (
            <label>Copie o endereço abaixo:
              <input aria-label="Link para copiar manualmente" ref={manualLinkRef} onFocus={(event) => event.target.select()} readOnly value={url} />
            </label>
          ) : null}
        </div>
      ) : (
        <div className="profile-client-link-state">
          {link?.status === linkContract.status.planRequired ? (
            <><p><strong>Exclusivo do plano Pro.</strong> {clientLinkPlanCopy()}</p><Link className="profile-inline-button" to="/subscription">{planLinkLabel('Ver plano Pro')}</Link></>
          ) : link?.status === linkContract.status.incomplete ? (
            <><p><strong>Faltam dados no seu perfil.</strong> Complete os dados essenciais e confirme o e-mail para liberar o link.</p><Link className="profile-inline-button" to="/profile?editar=1&secao=dados">Conferir dados para pedidos</Link></>
          ) : failed ? (
            <><p role="status">Não foi possível carregar o link para clientes.</p><button className="profile-inline-button" onClick={() => setAttempt((value) => value + 1)} type="button">Tentar novamente</button></>
          ) : <p role="status">Verificando disponibilidade do link…</p>}
        </div>
      )}
    </section>
  );
}
