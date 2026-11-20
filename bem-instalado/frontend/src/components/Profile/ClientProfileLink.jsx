import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { getInstallerRequirements } from '../../utils/installerRequirements';
import legalDocuments from '../../../../shared/legalDocuments.json';

export default function ClientProfileLink({ profile, preview, failed, onRetry }) {
  const { hash } = useLocation();
  const headingRef = useRef(null);
  const manualLinkRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState('');
  const isPublic = Boolean(profile.public_profile && profile.certification_verified);
  const hasEssentials = getInstallerRequirements(profile).every(({ complete }) => complete);
  const canShare = isPublic && hasEssentials && preview?.accepts_direct_requests === true;
  const url = `${legalDocuments.publicOrigin}/installers/${profile.id}?orcamento=1`;

  useEffect(() => {
    if (hash !== '#link-para-clientes') return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [hash]);

  useEffect(() => {
    if (!canShare || copyStatus !== 'manual') return;
    manualLinkRef.current?.focus();
    manualLinkRef.current?.select();
  }, [canShare, copyStatus]);

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
        <p>Use com clientes que você encontrou por fora da InstalarPro. Mande pelo WhatsApp ou por onde preferir: o cliente preenche o pedido sem criar conta, e ele chega só para você em <strong>Oportunidades</strong>.</p>
      </div>

      {canShare ? (
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
          {!isPublic ? (
            <><p><strong>Link ainda indisponível.</strong> Ele só funciona com o perfil público, liberado após análise. Você ainda pode aceitar pedidos comuns com os dados essenciais completos.</p><Link className="profile-inline-button" to="/profile?editar=1&secao=perfil">Ver configuração do perfil</Link></>
          ) : !hasEssentials ? (
            <><p><strong>Faltam dados no seu perfil.</strong> Complete os dados essenciais e confirme o e-mail para liberar o link.</p><Link className="profile-inline-button" to="/profile?editar=1&secao=dados">Conferir dados para pedidos</Link></>
          ) : failed ? (
            <><p role="status">Não foi possível confirmar se seu perfil pode receber pedidos pelo link.</p><button className="profile-inline-button" onClick={onRetry} type="button">Tentar novamente</button></>
          ) : preview ? (
            <p role="status">Seu perfil está público, mas o envio de pedidos pelo link ainda não está disponível.</p>
          ) : <p role="status">Verificando disponibilidade do link…</p>}
        </div>
      )}
    </section>
  );
}
