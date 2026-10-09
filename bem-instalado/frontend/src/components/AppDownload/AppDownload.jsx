import { useEffect, useState } from 'react';
import api from '../../services/api';

const FALLBACK_DOWNLOAD_URL = 'https://github.com/mattheuschaaves23/Instalar/releases/latest/download/InstalaPro-Instaladores.apk';
const FALLBACK_VERSION = '1.0.29';

function formatFileSize(value) {
  const bytes = Number(value || 0);

  if (!bytes) {
    return null;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function IphoneIcon() {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">
      <rect height="19" rx="3" width="12" x="6" y="2.5" />
      <path d="M10 5h4" />
      <path d="M11.95 18.5h.1" />
    </svg>
  );
}

export default function AppDownload() {
  const [release, setRelease] = useState({
    downloadUrl: FALLBACK_DOWNLOAD_URL,
    size: null,
    version: FALLBACK_VERSION,
  });

  useEffect(() => {
    let active = true;

    api.get('/public/installer-app-release')
      .then(({ data }) => {
        if (!active) return;

        setRelease({
          downloadUrl: data.downloadUrl || FALLBACK_DOWNLOAD_URL,
          size: formatFileSize(data.size),
          version: data.version || FALLBACK_VERSION,
        });
      })
      .catch(() => {
        // O link permanente continua disponível se a consulta da versão falhar.
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="installer-app-page">
      <header className="installer-app-page-header">
        <div>
          <p>APLICATIVO</p>
          <h1>iPhone e Android</h1>
          <span>O mesmo painel, preparado para os dois sistemas.</span>
        </div>
        <span className="installer-app-page-status"><i /> Android + iOS</span>
      </header>

      <aside aria-labelledby="installer-app-download-title" className="installer-app-download installer-app-download--page">
        <div aria-hidden="true" className="installer-app-download-visual">
          <span className="installer-app-download-orbit" />
          <span className="installer-app-download-phone">
            <i />
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
              <rect height="14" rx="2.5" width="16" x="4" y="6" />
              <path d="M4 12h16M9 15.5h6" />
            </svg>
          </span>
        </div>

        <div className="installer-app-download-copy">
          <span className="installer-app-download-kicker"><i /> InstalaPro para instaladores</span>
          <h2 id="installer-app-download-title">Seu trabalho inteiro no iPhone e Android</h2>
          <p>Acesse oportunidades, agenda, clientes e orçamentos de onde estiver.</p>
          <div className="installer-app-download-meta">
            <span>Android 7+</span>
            <span>iOS 16.4+</span>
            <span>Versão {release.version}</span>
            {release.size ? <span>{release.size}</span> : null}
          </div>
        </div>

        <div className="installer-app-download-actions">
          <a
            className="installer-app-download-button"
            href={release.downloadUrl}
            rel="noreferrer"
            target="_blank"
          >
            <DownloadIcon />
            <span><small>Disponível agora</small><strong>Baixar para Android</strong></span>
            <b aria-hidden="true">→</b>
          </a>

          <div aria-label="Aplicativo para iPhone aguardando publicação na App Store" className="installer-app-download-button installer-app-download-button--ios">
            <IphoneIcon />
            <span><small>Em preparação</small><strong>Aplicativo para iPhone</strong></span>
            <b aria-hidden="true">•••</b>
          </div>
        </div>
      </aside>

      <div className="installer-app-page-notes">
        <article>
          <span>A</span>
          <div>
            <strong>Android disponível</strong>
            <p>Baixe o APK oficial e receba as próximas atualizações pelo próprio aplicativo.</p>
          </div>
        </article>
        <article>
          <span>i</span>
          <div>
            <strong>iPhone em preparação</strong>
            <p>A versão para iOS será disponibilizada após os testes e a aprovação na App Store.</p>
          </div>
        </article>
        <article>
          <span>✓</span>
          <div>
            <strong>Uma única conta</strong>
            <p>O mesmo login de instalador funciona no site, Android e iPhone.</p>
          </div>
        </article>
      </div>
    </section>
  );
}
