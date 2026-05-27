import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PageIntro from '../Layout/PageIntro';
import { notifyPanelBadgeCountsChanged } from '../Layout/panelBadgeCounts';

const FILTERS = [
  { value: 'open', label: 'Novas' },
  { value: 'interested', label: 'Meus interesses' },
  { value: 'selected', label: 'Escolhidas' },
];

function OpportunityIcon({ type }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  const icons = {
    briefcase: <><path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" /><rect x="4" y="6" width="16" height="14" rx="2.2" /><path d="M4 12h16" /></>,
    map: <><path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" /><circle cx="12" cy="11" r="2.3" /></>,
    phone: <><path d="M6.5 4.5h2l1.15 3.9-1.65 1.65a15.4 15.4 0 0 0 5.95 5.95l1.65-1.65 3.9 1.15v2a1.5 1.5 0 0 1-1.5 1.5A13.5 13.5 0 0 1 5 6a1.5 1.5 0 0 1 1.5-1.5Z" /></>,
    user: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></>,
    check: <path d="M5 12.5 10 17l9-10" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
    filter: <><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></>,
  };

  return <svg {...props}>{icons[type] || icons.briefcase}</svg>;
}

function formatDate(value) {
  if (!value) {
    return 'Agora';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function joinRegion(item) {
  return [item.neighborhood, item.city, item.state].filter(Boolean).join(' - ') || 'Regiao nao informada';
}

function getSummaryItems(item) {
  return [
    item.place_label,
    item.rooms?.length ? item.rooms.join(', ') : '',
    item.measurement_detail,
    item.material_label,
    item.urgency_label,
    item.photo_count > 0 ? `${item.photo_count} foto(s) de referencia` : '',
  ].filter(Boolean);
}

export default function Opportunities() {
  const [filter, setFilter] = useState('open');
  const [opportunities, setOpportunities] = useState([]);
  const [stats, setStats] = useState({ open: 0, interested: 0, selected: 0, matched: 0 });
  const [loading, setLoading] = useState(true);
  const [sendingInterestId, setSendingInterestId] = useState(null);

  const loadOpportunities = useCallback(async (nextFilter = filter) => {
    setLoading(true);

    try {
      const response = await api.get('/opportunities', { params: { status: nextFilter } });
      setOpportunities(response.data?.opportunities || []);
      setStats(response.data?.stats || { open: 0, interested: 0, selected: 0, matched: 0 });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel carregar oportunidades.');
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadOpportunities(filter);
  }, [filter, loadOpportunities]);

  const pageStats = useMemo(
    () => [
      { label: 'Novas', value: stats.open || opportunities.filter((item) => !item.interested_by_me).length, detail: 'Ainda sem seu interesse' },
      { label: 'Interesses', value: stats.interested || opportunities.filter((item) => item.my_interest_status === 'interested').length, detail: 'Aguardando escolha do cliente' },
      { label: 'Escolhidas', value: stats.selected || opportunities.filter((item) => item.selected_by_me).length, detail: 'WhatsApp liberado pelo cliente' },
      { label: 'Na sua regiao', value: stats.matched || opportunities.filter((item) => item.match_score >= 78).length, detail: 'Priorizadas por cidade/UF' },
    ],
    [opportunities, stats]
  );

  const handleInterest = async (opportunity) => {
    setSendingInterestId(opportunity.id);
    const wasOpen = !opportunity.interested_by_me;

    try {
      const response = await api.post(`/opportunities/${opportunity.id}/interest`);
      const interested = response.data?.opportunity;

      if (interested) {
        setOpportunities((current) =>
          current.map((item) => (item.id === interested.id ? { ...item, ...interested } : item))
        );
        setStats((current) => ({
          ...current,
          open: wasOpen ? Math.max(0, Number(current.open || 0) - 1) : Number(current.open || 0),
          interested: wasOpen ? Number(current.interested || 0) + 1 : Number(current.interested || 0),
        }));
        notifyPanelBadgeCountsChanged();
      }

      toast.success('Interesse enviado. O cliente vai escolher com quem quer falar.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel enviar interesse.');
    } finally {
      setSendingInterestId(null);
    }
  };

  return (
    <div className="page-shell opportunities-page">
      <PageIntro
        eyebrow="Operacao"
        title="Oportunidades"
        description="Solicitacoes publicadas por clientes proximos aparecem aqui. Envie interesse e aguarde o cliente escolher quem prefere chamar."
        actions={(
          <button className="ghost-button" onClick={() => loadOpportunities(filter)} type="button">
            <OpportunityIcon type="filter" />
            Atualizar
          </button>
        )}
        stats={pageStats}
      />

      <section className="opportunity-toolbar">
        <div className="opportunity-filter-tabs" role="group" aria-label="Filtrar oportunidades">
          {FILTERS.map((item) => (
            <button
              className={filter === item.value ? 'is-active' : ''}
              key={item.value}
              onClick={() => setFilter(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="opportunity-empty">Carregando oportunidades...</div>
      ) : null}

      {!loading && opportunities.length === 0 ? (
        <div className="opportunity-empty">
          <strong>Nenhuma oportunidade por enquanto.</strong>
          <span>Quando clientes publicarem solicitacoes, elas vao aparecer aqui.</span>
        </div>
      ) : null}

      {!loading && opportunities.length > 0 ? (
        <section className="opportunity-list" aria-label="Lista de oportunidades">
          {opportunities.map((opportunity) => {
            const summaryItems = getSummaryItems(opportunity);

            return (
              <article className="opportunity-row" key={opportunity.id}>
                <div className="opportunity-row-main">
                  <div className="opportunity-icon">
                    <OpportunityIcon type={opportunity.selected_by_me ? 'check' : 'briefcase'} />
                  </div>

                  <div className="opportunity-copy">
                    <div className="opportunity-heading">
                      <div>
                        <p>{formatDate(opportunity.created_at)}</p>
                        <h2>{opportunity.service_label || 'Instalacao de papel de parede'}</h2>
                      </div>
                      <span>{opportunity.match_score}% compativel</span>
                    </div>

                    <div className="opportunity-meta">
                      <span><OpportunityIcon type="user" />{opportunity.client_name || 'Cliente interessado'}</span>
                      <span><OpportunityIcon type="map" />{joinRegion(opportunity)}</span>
                      <span><OpportunityIcon type="phone" />{opportunity.client_phone || opportunity.client_phone_masked || 'WhatsApp se o cliente escolher voce'}</span>
                      <span><OpportunityIcon type="clock" />{opportunity.urgency_label || 'Prazo a combinar'}</span>
                      <span>{opportunity.distance_label || 'Regiao priorizada'}</span>
                    </div>

                    {summaryItems.length > 0 ? (
                      <div className="opportunity-tags">
                        {summaryItems.slice(0, 5).map((item) => (
                          <span key={`${opportunity.id}-${item}`}>{item}</span>
                        ))}
                      </div>
                    ) : null}

                    {opportunity.details ? <p className="opportunity-details">{opportunity.details}</p> : null}
                  </div>
                </div>

                <div className="opportunity-actions">
                  <span className={opportunity.selected_by_me ? 'is-accepted' : opportunity.interested_by_me ? 'is-interested' : ''}>
                    {opportunity.selected_by_me
                      ? 'Cliente escolheu voce'
                      : opportunity.interested_by_me
                        ? 'Interesse enviado'
                        : 'Nova solicitacao'}
                  </span>

                  {opportunity.selected_by_me && opportunity.whatsapp_url ? (
                    <a className="gold-button" href={opportunity.whatsapp_url} rel="noreferrer" target="_blank">
                      Chamar no WhatsApp
                    </a>
                  ) : opportunity.interested_by_me ? (
                    <button className="gold-button" disabled type="button">
                      Aguardando cliente
                    </button>
                  ) : (
                    <button
                      className="gold-button"
                      disabled={sendingInterestId === opportunity.id}
                      onClick={() => handleInterest(opportunity)}
                      type="button"
                    >
                      {sendingInterestId === opportunity.id ? 'Enviando...' : 'Tenho interesse'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
