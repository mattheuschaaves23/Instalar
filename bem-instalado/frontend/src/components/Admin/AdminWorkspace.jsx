import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { formatStatusLabel } from '../../utils/formatters';
import './AdminWorkspace.css';

export const adminSections = [
  ['overview', 'Visão geral', 'Veja o que precisa de atenção hoje.'],
  ['requests', 'Pedidos', 'Acompanhe solicitações e instaladores interessados.'],
  ['verifications', 'Aprovações', 'Revise certificados e gerencie a publicação do perfil.'],
  ['users', 'Usuários', 'Encontre contas e consulte perfis, planos e permissões.'],
  ['payments', 'Pagamentos', 'Acompanhe cobranças e confirme pendências.'],
  ['advertising', 'Propaganda', 'Organize o que aparece no site e no painel.'],
  ['announcements', 'Comunicados', 'Envie avisos para todos os usuários.'],
  ['monitoring', 'Monitoramento', 'Veja os erros recentes do site e da API.'],
  ['support', 'Suporte', 'Responda às conversas e acompanhe sugestões.'],
  ['settings', 'Configurações', 'Preferências do dispositivo e dados da sua conta.'],
];

export function getAdminSection(search) {
  const key = search.get('section');
  return key === 'stores' ? 'advertising'
    : !['support', 'settings'].includes(key) && adminSections.some(([entry]) => entry === key) ? key : 'overview';
}

export const adminHref = (key) => ['support', 'settings'].includes(key) ? `/${key}`
  : key === 'overview' ? '/admin' : `/admin?section=${key}`;

export function AdminIcon({ name, size = 20 }) {
  const icons = {
    overview: <><path d="m3 11 9-8 9 8M5 10v11h5v-6h4v6h5V10" /></>,
    requests: <><rect x="5" y="5" width="14" height="16" rx="2" /><rect x="9" y="3" width="6" height="4" rx="1" /></>,
    verifications: <><path d="M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10Z" /><path d="m9 12 2 2 4-4" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m2-15a3 3 0 0 1 0 6m4 9v-2a4 4 0 0 0-3-4" /></>,
    payments: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M6 15h3" /></>,
    advertising: <><path d="M3 10v4a2 2 0 0 0 2 2h4l10 4V4L9 8H5a2 2 0 0 0-2 2Zm6-2v8m-3 0 2 5h3l-2-5" /></>,
    announcements: <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-6 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />,
    monitoring: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M12 17v4m-4 0h8" /></>,
    support: <><path d="M3 14v-2a9 9 0 1 1 18 0v2m0 2v1a4 4 0 0 1-4 4h-3" /><rect x="3" y="12" width="4" height="6" rx="1" /><rect x="17" y="12" width="4" height="6" rx="1" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.2 13.4a7.9 7.9 0 0 0 0-2.8l2-1.55-2-3.46-2.43.98a7.25 7.25 0 0 0-2.4-1.39L14 2.6h-4l-.37 2.58a7.25 7.25 0 0 0-2.4 1.39L4.8 5.59l-2 3.46 2 1.55a7.9 7.9 0 0 0 0 2.8l-2 1.55 2 3.46 2.43-.98a7.25 7.25 0 0 0 2.4 1.39L10 21.4h4l.37-2.58a7.25 7.25 0 0 0 2.4-1.39l2.43.98 2-3.46z" /></>,
    back: <path d="m11 5-7 7 7 7M4 12h16" />,
    search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
    right: <path d="m9 5 7 7-7 7" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    add: <path d="M12 5v14M5 12h14" />,
    file: <><path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h8" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5M5.5 8a7 7 0 0 1 12-2L20 9M4 15l2.5 3a7 7 0 0 0 12-2" /></>,
    external: <><path d="M13 4h7v7m0-7-9 9m0-8H5v14h14v-6" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{icons[name] || icons.file}</svg>;
}

export function AdminWorkspace({ children }) {
  const location = useLocation();
  const menuRef = useRef(null);
  const search = new URLSearchParams(location.search);
  const active = location.pathname.match(/^\/(support|settings)\/?$/)?.[1] || getAdminSection(search);
  useEffect(() => {
    const nav = menuRef.current;
    const link = nav?.querySelector('[aria-current="page"]');
    if (!link || nav.scrollWidth <= nav.clientWidth) return;
    const left = link.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    nav.scrollLeft = Math.max(0, left - (nav.clientWidth - link.offsetWidth) / 2);
  }, [active]);
  return (
    <div className="ip-admin">
      <a className="ip-admin-skip" href="#admin-content">Ir para o conteúdo</a>
      <aside className="ip-admin-rail">
        <Link className="ip-admin-brand" to="/admin" aria-label="InstalarPro, visão geral do painel ADM">
          <strong>Instalar<span>Pro</span></strong><small>Painel ADM</small>
        </Link>
        <nav ref={menuRef} className="ip-admin-nav" aria-label="Áreas administrativas">
          {adminSections.map(([key, label]) => (
            <Link key={key} to={adminHref(key)} aria-current={active === key ? 'page' : undefined}
              onFocus={(event) => {
                if (menuRef.current?.scrollWidth > menuRef.current?.clientWidth) {
                  event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
              }}>
              <AdminIcon name={key} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <Link className="ip-admin-back" to="/dashboard"><AdminIcon name="back" />Voltar ao painel</Link>
      </aside>
      <main className="ip-admin-main" id="admin-content" tabIndex={-1}>{children}</main>
    </div>
  );
}

export function AdminHeading({ section, children }) {
  const [, title, copy] = adminSections.find(([key]) => key === section) || adminSections[0];
  return <header className="ip-admin-heading"><div><h1>{title}</h1><p>{copy}</p></div>{children}</header>;
}

export function AdminButton({ tone = '', children, className = '', type = 'button', ...props }) {
  return <button className={`ip-admin-btn ${tone ? `is-${tone}` : ''} ${className}`.trim()} type={type} {...props}>{children}</button>;
}

export function AdminTabs({ label, options, value, onChange }) {
  return <div className="ip-admin-tabs" role="group" aria-label={label}>{options.map(([key, text]) => (
    <button type="button" aria-pressed={value === key} key={key} onClick={() => onChange(key)}>{text}</button>
  ))}</div>;
}

const tones = {
  active: 'success', approved: 'success', paid: 'success', done: 'success', selected: 'info', planned: 'info',
  pending: 'warning', reviewing: 'warning', open: 'warning', direct_pending: 'warning', expired: 'warning',
  failed: 'danger', rejected: 'danger', refunded: 'danger', canceled: 'danger',
};
export function AdminBadge({ status, children, tone }) {
  return <span className="ip-admin-status" data-tone={tone || tones[status] || 'neutral'}>{children || formatStatusLabel(status)}</span>;
}

export function AdminSearch({ label, ...props }) {
  return <label className="ip-admin-search"><AdminIcon name="search" /><span className="ip-admin-sr">{label}</span><input type="search" placeholder={label} {...props} /></label>;
}

export function AdminEmpty({ busy, error, children, onRetry }) {
  return (
    <div className="ip-admin-empty" role={error ? 'alert' : 'status'}>
      <p>{busy ? 'Carregando…' : error || children}</p>
      {!busy && error && onRetry ? <AdminButton onClick={onRetry}>Tentar novamente</AdminButton> : null}
    </div>
  );
}

export function AdminTable({ label, columns, rows, selected, onSelect, footer, empty = 'Nenhum item encontrado.', loading, error, onRetry }) {
  return (
    <div className="ip-admin-table-card ip-admin-card" aria-busy={loading || undefined}>
      <table aria-label={label} className="ip-admin-table">
        <thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
        <tbody>{!loading && !error && rows.map(({ id, cells, title }) => (
          <tr key={id} data-selected={selected === id || undefined}>
            {cells.map((cell, index) => index === 0 ? (
              <th key={columns[index]} data-label={columns[index]} scope="row">{onSelect
                ? <button className="ip-admin-row-button" type="button" aria-pressed={selected === id} aria-label={title || undefined} onClick={() => onSelect(id)}>{cell}</button>
                : cell}</th>
            ) : <td key={columns[index]} data-label={columns[index]}>{cell}</td>)}
          </tr>
        ))}</tbody>
      </table>
      {loading || error || !rows.length ? <AdminEmpty busy={loading} error={error} onRetry={onRetry}>{empty}</AdminEmpty> : null}
      {footer ? <div className="ip-admin-table-footer">{footer}</div> : null}
    </div>
  );
}

export function AdminDetail({ id, title, onClose, children }) {
  return <section id={id} aria-label={title} className="ip-admin-card ip-admin-detail">
    <header><h2>{title}</h2>{onClose ? <AdminButton className="ip-admin-icon-btn" aria-label="Fechar detalhes" onClick={onClose}><AdminIcon name="close" /></AdminButton> : null}</header>
    {children}
  </section>;
}

export function AdminFacts({ facts }) {
  return <dl className="ip-admin-facts">{facts.map(([label, value, key = label]) => <div key={key}><dt>{label}</dt><dd>{value == null || value === '' ? '—' : value}</dd></div>)}</dl>;
}

export function scrollAdminDetail(elementId) {
  if (typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 880px)').matches) return;
  window.requestAnimationFrame(() => document.getElementById(elementId)?.scrollIntoView?.({ block: 'start' }));
}
