import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import DecoratingWallLoader from '../Layout/DecoratingWallLoader';
import './InstallerProfile.css';
import { formatCurrency, formatLongDate, formatShortDate } from '../../utils/formatters';
import { formatInstallationDays } from '../../utils/installerDays';
import PageMetadata from './PageMetadata';
import Turnstile, { isTurnstileEnabled } from '../Security/Turnstile';
import {
  buildClientRequestTrackingHash,
  readClientRequestTrackingHash,
  readPublishedClientRequest,
  writePublishedClientRequest,
} from '../../utils/clientRequest';
import {
  PROFILE_SECTIONS, REVIEW_FORM_ANCHOR, buildProfileSectionHash, readProfileSection,
} from '../../utils/installerProfileSections';

const emptyReviewForm = { reviewer_name: '', reviewer_region: '', rating: 5, comment: '' };

const defaultMarketplace = {
  title: 'Loja Oficial InstalaPro',
  description: 'Materiais para deixar o seu ambiente ainda mais bonito.',
  url: 'https://www.beminstalado.com.br',
  cta_label: 'Conhecer a loja',
  highlights: ['Papel de parede', 'Pagamento via Pix'],
};

function getInitials(name) {
  return (name || 'IP').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function getHandle(name) {
  const handle = String(name || 'instalapro')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20);
  return `@${handle || 'instalapro'}`;
}

function ProfileIcon({ name, size = 20 }) {
  const common = { fill: 'none', height: size, stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.9, viewBox: '0 0 24 24', width: size };
  const icons = {
    arrow: <><path d="m14.5 5-7 7 7 7" /><path d="M8 12h11" /></>,
    briefcase: <><rect height="13" rx="2" width="18" x="3" y="7" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    calendar: <><rect height="17" rx="2" width="18" x="3" y="4" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
    check: <><path d="m5 12 4.2 4L19 6" /></>,
    checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.7L16.4 9" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.3 2" /></>,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
    grid: <><rect height="7" rx="1" width="7" x="3" y="3" /><rect height="7" rx="1" width="7" x="14" y="3" /><rect height="7" rx="1" width="7" x="3" y="14" /><rect height="7" rx="1" width="7" x="14" y="14" /></>,
    image: <><rect height="17" rx="2" width="18" x="3" y="4" /><circle cx="8.5" cy="9" r="1.5" /><path d="m3 17 5-5 3.2 3.1 2.1-2.1L21 20" /></>,
    location: <><path d="M20 10c0 5.2-8 11-8 11S4 15.2 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    message: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.4-.7L4 20l1.5-3.8A7.3 7.3 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></>,
    pin: <><path d="M20 10c0 5.2-8 11-8 11S4 15.2 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    shield: <><path d="M12 21s8-3.5 8-10V5l-8-3-8 3v6c0 6.5 8 10 8 10Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
    star: <><path d="m12 3 2.75 5.57L21 9.48l-4.5 4.38 1.06 6.2L12 17.17l-5.56 2.89 1.06-6.2L3 9.48l6.25-.91L12 3Z" /></>,
  };
  return <svg aria-hidden="true" {...common}>{icons[name] || icons.grid}</svg>;
}

function RatingStars({ value, compact = false }) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(value || 0))));
  return (
    <span aria-label={`${rounded} de 5 estrelas`} className={`ig-profile-stars${compact ? ' is-compact' : ''}`}>
      {Array.from({ length: 5 }).map((_, index) => <i aria-hidden="true" className={index < rounded ? 'is-filled' : ''} key={index}>★</i>)}
    </span>
  );
}

function groupAvailabilitySlots(slots = []) {
  return slots.reduce((all, slot) => {
    if (!slot.slot_date) return all;
    all[slot.slot_date] = all[slot.slot_date] || [];
    all[slot.slot_date].push(slot);
    return all;
  }, {});
}

function getClientLoginPath(nextPath) {
  return `/cliente/entrar?next=${encodeURIComponent(nextPath)}`;
}

export default function InstallerProfile() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [payload, setPayload] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [requestContext, setRequestContext] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [reviewForm, setReviewForm] = useState(emptyReviewForm);
  const [sendingReview, setSendingReview] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const requestedId = Number(new URLSearchParams(location.search).get('pedido'));
  const tracking = readClientRequestTrackingHash(location.hash);
  const saved = tracking?.id === requestedId ? tracking : readPublishedClientRequest();
  const requestToken = saved?.id === requestedId ? saved.client_access_token : '';
  const linkedRequest = useMemo(() => Number.isSafeInteger(requestedId) && requestedId > 0
    ? { id: requestedId, token: requestToken } : null, [requestedId, requestToken]);

  const sectionAnchor = readProfileSection(location.hash);
  const activeSection = sectionAnchor === REVIEW_FORM_ANCHOR ? 'avaliacoes' : sectionAnchor || 'projetos';
  const sectionPath = (section) => ({
    pathname: location.pathname, search: location.search, hash: buildProfileSectionHash(section, location.hash),
  });
  const reviewLoginPath = getClientLoginPath(`${location.pathname}${location.search}#${REVIEW_FORM_ANCHOR}`);

  const requestProfile = useCallback(async (signal) => {
    const headers = linkedRequest?.token ? { 'X-Client-Request-Token': linkedRequest.token } : {};
    const params = linkedRequest ? { pedido: linkedRequest.id } : {};
    const { data } = await api.get(`/public/installers/${id}`, { headers, params, signal });
    return data;
  }, [id, linkedRequest]);

  useEffect(() => {
    const controller = new AbortController();
    setPayload(null);
    setProfileError('');
    requestProfile(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setPayload(data); })
      .catch((error) => {
        if (!controller.signal.aborted) setProfileError({
          status: error.response?.status,
          message: error.response?.data?.error || 'Não foi possível carregar o perfil do instalador.',
        });
      });
    return () => controller.abort();
  }, [requestProfile, user?.id, user?.account_type]);

  const profileLoaded = Boolean(payload);
  useEffect(() => {
    if (!profileLoaded || !sectionAnchor) return;
    const destination = sectionAnchor === REVIEW_FORM_ANCHOR ? REVIEW_FORM_ANCHOR : 'perfil-secoes';
    document.getElementById(destination)?.scrollIntoView({ block: 'start' });
  }, [profileLoaded, sectionAnchor]);

  useEffect(() => {
    let active = true;
    setRequestContext(null);
    if (!linkedRequest || (!linkedRequest.token && user?.account_type !== 'client')) return undefined;

    const headers = linkedRequest.token ? { 'X-Client-Request-Token': linkedRequest.token } : {};
    api.get(`/public/service-requests/${linkedRequest.id}/interests`, { headers })
      .then(({ data }) => {
        if (!active || !data?.request) return;
        const interest = data.interests?.find((item) => Number(item.installer_id) === Number(id));
        setRequestContext({ request: data.request, interest, installerId: id });
        if (linkedRequest.token && writePublishedClientRequest(data.request)) {
          const currentHash = window.location.hash;
          if (readClientRequestTrackingHash(currentHash)?.id === linkedRequest.id) {
            const currentSection = readProfileSection(currentHash);
            navigate({ hash: currentSection ? `#${currentSection}` : '', search: location.search }, { replace: true });
          }
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [id, linkedRequest, location.search, navigate, user?.account_type, user?.id]);

  const linkedContext = requestContext?.installerId === id && requestContext.request.id === linkedRequest?.id
    ? requestContext : null;
  const request = linkedContext?.request;
  const interest = linkedContext?.interest;
  const trackingPath = linkedRequest ? `/cliente/pedido${buildClientRequestTrackingHash(request || linkedRequest)}` : '/cliente';
  const clientLoginPath = getClientLoginPath(`${location.pathname}${location.search}`);
  const needsClientLogin = Boolean(linkedRequest && !linkedRequest.token && user?.account_type !== 'client');
  const canChoose = Boolean(interest && request?.status === 'open'
    && (!request.expires_at || Date.parse(request.expires_at) > Date.now()));

  const chooseInstaller = async () => {
    if (!canChoose || selecting) return;
    setSelecting(true);
    try {
      const accepted = await confirm({
        title: 'Escolher este instalador?',
        message: `Ao escolher ${interest.display_name}, você libera os dados completos da instalação para esse profissional. A escolha é definitiva para este pedido.`,
        confirmText: 'Confirmar escolha',
      });
      if (!accepted) return;

      const headers = linkedRequest.token ? { 'X-Client-Request-Token': linkedRequest.token } : {};
      const { data } = await api.post(`/public/service-requests/${request.id}/interests/${interest.id}/select`, {}, { headers });
      const selectedRequest = { ...request, ...data.request };
      writePublishedClientRequest(selectedRequest);
      toast.success('Instalador escolhido. Acompanhe seu pedido para conversar com o profissional.');
      navigate(`/cliente/pedido${buildClientRequestTrackingHash(selectedRequest)}`, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível escolher o instalador.');
    } finally {
      setSelecting(false);
    }
  };

  const handleReviewChange = (event) => {
    const { name, value } = event.target;
    setReviewForm((current) => ({ ...current, [name]: name === 'rating' ? Number(value) : value }));
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    const reviewerName = reviewForm.reviewer_name.trim();

    if (!user) {
      toast('Entre para avaliar o instalador escolhido.');
      navigate(reviewLoginPath);
      return;
    }

    if (Number(user.id) === Number(id)) {
      toast.error('Você não pode avaliar o seu próprio perfil.');
      return;
    }

    if (!reviewerName) {
      toast.error('Informe seu nome para enviar a avaliação.');
      return;
    }

    if (isTurnstileEnabled() && !turnstileToken) {
      toast.error('Conclua a verificação de segurança antes de enviar a avaliação.');
      return;
    }

    setSendingReview(true);
    try {
      await api.post(`/public/installers/${id}/reviews`, {
        service_request_id: Number(new URLSearchParams(location.search).get('pedido')) || undefined,
        reviewer_name: reviewerName,
        reviewer_region: reviewForm.reviewer_region.trim(),
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
        turnstile_token: turnstileToken,
      });
      toast.success('Avaliação enviada com sucesso.');
      setReviewForm(emptyReviewForm);
      try {
        const refreshed = await requestProfile();
        setPayload((current) => current?.installer.id === refreshed.installer.id ? refreshed : current);
      } catch {
        toast('Avaliação salva. Reabra o perfil para atualizar a lista.');
      }
    } catch (error) {
      setTurnstileToken('');
      setTurnstileResetKey((current) => current + 1);
      toast.error(error.response?.data?.error || 'Não foi possível enviar a avaliação.');
    } finally {
      setSendingReview(false);
    }
  };

  const requireClientLogin = (event) => {
    if (user) return;
    event.preventDefault();
    toast('Entre para avaliar este profissional.');
    navigate(reviewLoginPath);
  };

  const handleTabKeyDown = (event, index) => {
    const last = PROFILE_SECTIONS.length - 1;
    const next = {
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowRight: index === last ? 0 : index + 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const section = PROFILE_SECTIONS[next].id;
    document.getElementById(`perfil-aba-${section}`)?.focus();
    if (section !== activeSection) navigate(sectionPath(section));
  };

  const ratingDistribution = useMemo(() => {
    const counts = new Map([5, 4, 3, 2, 1].map((rating) => [rating, 0]));
    (payload?.reviews || []).forEach((review) => {
      const rating = Math.max(1, Math.min(5, Math.round(Number(review.rating || 0))));
      counts.set(rating, (counts.get(rating) || 0) + 1);
    });
    const maximum = Math.max(1, ...counts.values());
    return [5, 4, 3, 2, 1].map((rating) => ({ rating, count: counts.get(rating) || 0, width: `${((counts.get(rating) || 0) / maximum) * 100}%` }));
  }, [payload?.reviews]);

  if (profileError) return (
    <main className="ig-installer-profile ig-profile-unavailable">
      <h1>Perfil indisponível</h1>
      <p>{needsClientLogin && profileError.status === 404
        ? 'Entre com a conta que fez o pedido ou acesse com o código do pedido para ver este perfil.'
        : profileError.message}</p>
      {needsClientLogin && profileError.status === 404 ? (
        <Link className="ig-profile-primary-action" to={clientLoginPath}>Entrar para ver o perfil</Link>
      ) : null}
      <Link className={needsClientLogin && profileError.status === 404 ? 'ig-profile-back' : 'ig-profile-primary-action'} to={trackingPath}>
        {linkedRequest ? 'Voltar ao pedido' : 'Encontrar instaladores'}
      </Link>
    </main>
  );
  if (!payload) return <DecoratingWallLoader phrase="Abrindo o perfil deste profissional." />;

  const { installer, reviews = [], marketplace: apiMarketplace } = payload;
  const marketplace = apiMarketplace || defaultMarketplace;
  const gallery = Array.isArray(installer.installation_gallery) ? installer.installation_gallery.filter(Boolean) : [];
  const slots = Object.entries(groupAvailabilitySlots(installer.availability_slots || [])).sort(([a], [b]) => a.localeCompare(b));
  const requestId = linkedRequest?.id;
  const requestPath = trackingPath;
  const requestLabel = requestId ? 'Voltar ao pedido' : 'Solicitar orçamento';
  const isOwnProfile = Boolean(user && Number(user.id) === Number(installer.id));
  const profilePhoto = installer.installer_photo || installer.logo;
  const coverPhoto = gallery[0] || profilePhoto;
  const locationLabel = [installer.city, installer.state].filter(Boolean).join(' · ') || installer.service_region || 'Região a confirmar';
  const warrantyLabel = installer.safety?.provides_warranty ? `${installer.safety.warranty_days || 0} dias de garantia` : 'Garantia a combinar';
  const hasAvailability = Boolean(slots.length || installer.available_dates?.length);
  const rating = Number(installer.average_rating || 0);
  const reviewCount = Number(installer.review_count || 0);
  const certified = Boolean(installer.certificate_verified || installer.safety?.document_masked);
  const profileActionPath = isOwnProfile ? '/profile'
    : needsClientLogin ? clientLoginPath : requestPath;
  const profileActionLabel = isOwnProfile ? 'Editar perfil'
    : interest?.selected ? 'Ver pedido com instalador escolhido'
      : needsClientLogin ? 'Entrar para escolher este instalador' : requestLabel;
  const chooseAction = canChoose && !isOwnProfile;
  const trustItems = [
    { icon: 'clock', label: 'Horários', value: installer.service_hours || 'A combinar', detail: hasAvailability ? 'Agenda atualizada' : 'Consulte a agenda' },
    { icon: 'briefcase', label: 'Projetos', value: `${gallery.length} no portfólio`, detail: gallery.length ? 'Trabalhos publicados' : 'Portfólio em montagem' },
    { icon: 'shield', label: 'Garantia', value: warrantyLabel, detail: installer.safety?.accepts_service_contract ? 'Contrato disponível' : 'Detalhes no orçamento' },
    { icon: 'checkCircle', label: 'Atendimento', value: locationLabel, detail: certified ? 'Perfil conferido' : 'Perfil profissional' },
  ];

  return (
    <main className="ig-installer-profile">
      <PageMetadata
        canonicalPath={`/installers/${installer.id}`}
        description={`${installer.display_name || installer.name} é instalador(a) de papel de parede${installer.city ? ` em ${installer.city}` : ''}. Veja trabalhos, avaliações e disponibilidade na InstalaPro.`}
        title={`${installer.display_name || installer.name} | Instalador de papel de parede`}
      />

      <nav aria-label="Navegação do perfil" className="ig-profile-topbar">
        <Link aria-label="Voltar à página inicial" className="ig-profile-brand" to="/">Instala<span>Pro</span></Link>
        <Link className="ig-profile-back" to={requestPath}><ProfileIcon name="arrow" size={17} />{requestId ? 'Meu pedido' : 'Encontrar instaladores'}</Link>
      </nav>

      <section className="ig-profile-shell">
        <div className={`ig-profile-cover${coverPhoto ? ' has-image' : ''}`}>
          {coverPhoto ? <img alt="" decoding="async" src={coverPhoto} /> : null}
          <div className="ig-profile-cover-overlay" />
          <span><ProfileIcon name="image" size={15} /> Perfil profissional</span>
        </div>

        <header className="ig-profile-hero-card">
          <div className="ig-profile-avatar-wrap">
            <div className="ig-profile-avatar">
              {profilePhoto ? <img alt={`Foto de ${installer.display_name}`} src={profilePhoto} /> : <span>{getInitials(installer.display_name)}</span>}
            </div>
            <i aria-label={hasAvailability ? 'Agenda aberta' : 'Agenda a consultar'} className={hasAvailability ? 'is-available' : ''} />
          </div>

          <div className="ig-profile-hero-copy">
            <div className="ig-profile-name-row">
              <h1>{installer.display_name}</h1>
              {certified ? <span aria-label="Perfil verificado" className="ig-profile-verified"><ProfileIcon name="check" size={13} /></span> : null}
            </div>
            <p className="ig-profile-role">Instalador de papel de parede</p>
            <div className="ig-profile-meta">
              <span><ProfileIcon name="location" size={16} />{locationLabel}</span>
              {reviewCount ? <Link to={sectionPath('avaliacoes')}><ProfileIcon name="star" size={15} /><strong>{rating.toFixed(1)}</strong> ({reviewCount} avaliações)</Link> : <span><ProfileIcon name="shield" size={15} />Perfil profissional</span>}
            </div>
          </div>

          <div className="ig-profile-hero-actions">
            <span className={`ig-profile-availability${hasAvailability ? ' is-open' : ''}`}><i />{hasAvailability ? 'Agenda aberta' : 'Consulte a agenda'}</span>
            {chooseAction ? (
              <button className="ig-profile-primary-action ig-profile-choose" disabled={selecting} onClick={chooseInstaller} type="button">
                <ProfileIcon name="check" size={20} />
                {selecting ? 'Confirmando escolha…' : 'Escolher este instalador'}
              </button>
            ) : <Link className="ig-profile-primary-action" to={profileActionPath}><ProfileIcon name={isOwnProfile ? 'document' : 'message'} size={18} />{profileActionLabel}</Link>}
            {needsClientLogin ? <Link className="ig-profile-back" to={trackingPath}>Acessar com o código do pedido</Link> : null}
          </div>

          <div className="ig-profile-bio-block">
            <strong>{getHandle(installer.display_name || installer.name)}</strong>
            <p>{installer.bio || 'Instalações cuidadosas, com atenção aos detalhes e acabamento profissional para transformar cada ambiente.'}</p>
          </div>

          <div aria-label="Estatísticas do profissional" className="ig-profile-stats">
            <Link to={sectionPath('projetos')}><strong>{gallery.length}</strong><span>projetos</span></Link>
            <Link to={sectionPath('avaliacoes')}><strong>{reviewCount}</strong><span>avaliações</span></Link>
            <Link to={sectionPath('informacoes')}><strong>{installer.unique_clients_served || 0}</strong><span>clientes</span></Link>
          </div>
        </header>

        <section aria-label="Destaques do profissional" className="ig-profile-trust-grid">
          {trustItems.map((item) => (
            <article key={item.label}>
              <span className="ig-trust-icon"><ProfileIcon name={item.icon} size={25} /></span>
              <div><strong>{item.label}</strong><b>{item.value}</b><small>{item.detail}</small></div>
            </article>
          ))}
        </section>

        <div aria-label="Conteúdos do perfil" className="ig-profile-tabs" id="perfil-secoes" role="tablist">
          {PROFILE_SECTIONS.map(({ id: section, icon, label }, index) => (
            <button
              aria-controls={section}
              aria-selected={activeSection === section}
              id={`perfil-aba-${section}`}
              key={section}
              onClick={() => navigate(sectionPath(section))}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={activeSection === section ? 0 : -1}
              type="button"
            >
              <ProfileIcon name={icon} size={16} /><span>{label}</span>
            </button>
          ))}
        </div>

        <section aria-labelledby="perfil-aba-projetos" className="ig-profile-panel ig-profile-projects ig-profile-tabpanel" hidden={activeSection !== 'projetos'} id="projetos" role="tabpanel" tabIndex={0}>
            <div className="ig-panel-heading"><div><span><ProfileIcon name="image" size={18} /></span><h2>Projetos</h2></div>{gallery.length ? <Link to={sectionPath('informacoes')}>Ver detalhes <ProfileIcon name="chevron" size={15} /></Link> : null}</div>
            {gallery.length ? (
              <div className="ig-project-grid">
                {gallery.map((photo, index) => <figure key={`${photo}-${index}`}><img alt={`Projeto ${index + 1} de ${installer.display_name}`} decoding="async" loading="lazy" src={photo} /></figure>)}
              </div>
            ) : (
              <div className="ig-project-empty"><ProfileIcon name="image" size={28} /><strong>Portfólio em atualização</strong><p>As fotos de instalações publicadas por este profissional aparecerão aqui.</p></div>
            )}
        </section>

        <section aria-labelledby="perfil-aba-avaliacoes" className="ig-profile-tabpanel" hidden={activeSection !== 'avaliacoes'} id="avaliacoes" role="tabpanel" tabIndex={0}>
          <div className="ig-profile-panel ig-profile-review-summary">
            <div className="ig-panel-heading"><div><span><ProfileIcon name="star" size={18} /></span><h2>Avaliações</h2></div>{!isOwnProfile ? <Link to={sectionPath(REVIEW_FORM_ANCHOR)} onClick={requireClientLogin}>Avaliar <ProfileIcon name="chevron" size={15} /></Link> : null}</div>
            {reviewCount ? (
              <div className="ig-review-summary-body">
                <div className="ig-rating-score"><strong>{rating.toFixed(1)}</strong><RatingStars value={rating} /><span>{reviewCount} avaliações</span></div>
                <div className="ig-rating-distribution">
                  {ratingDistribution.map((item) => <div key={item.rating}><span>{item.rating}</span><ProfileIcon name="star" size={13} /><i><b style={{ width: item.width }} /></i><em>{item.count}</em></div>)}
                </div>
                <div className="ig-review-snippets">
                  {reviews.slice(0, 2).map((review, index) => <article key={`${review.reviewer_name}-${review.created_at}-${index}`}><span>{getInitials(review.reviewer_name)}</span><div><strong>{review.reviewer_name}</strong><RatingStars compact value={review.rating} /><p>{review.comment || 'Cliente recomendou este profissional.'}</p><time>{formatShortDate(review.created_at)}</time></div></article>)}
                </div>
              </div>
            ) : <div className="ig-review-empty"><ProfileIcon name="star" size={27} /><strong>Sem avaliações ainda</strong><p>Clientes poderão avaliar o atendimento após a conclusão do serviço.</p></div>}
          </div>
          <section className="ig-profile-panel ig-profile-review-form" id={REVIEW_FORM_ANCHOR}>
            <div className="ig-panel-heading"><div><span><ProfileIcon name="star" size={18} /></span><div><p>Sua experiência</p><h2>Avalie este instalador</h2></div></div></div>
            {!user ? <div className="ig-review-locked"><p>Sua avaliação ajuda outras pessoas a escolherem com mais segurança.</p><Link className="ig-profile-primary-action" to={reviewLoginPath}>Entrar para avaliar</Link></div>
              : isOwnProfile ? <p className="ig-profile-note">Este é o seu perfil. Autoavaliações não são permitidas.</p>
                : <form className="ig-profile-form" onSubmit={handleReviewSubmit}><label><span>Seu nome</span><input name="reviewer_name" onChange={handleReviewChange} placeholder="Como você quer aparecer" required value={reviewForm.reviewer_name} /></label><label><span>Sua região</span><input name="reviewer_region" onChange={handleReviewChange} placeholder="Cidade ou bairro" value={reviewForm.reviewer_region} /></label><label><span>Nota</span><select name="rating" onChange={handleReviewChange} value={reviewForm.rating}><option value={5}>5 estrelas</option><option value={4}>4 estrelas</option><option value={3}>3 estrelas</option><option value={2}>2 estrelas</option><option value={1}>1 estrela</option></select></label><label className="ig-profile-comment-field"><span>Comentário</span><textarea name="comment" onChange={handleReviewChange} placeholder="Conte como foi sua experiência" rows="3" value={reviewForm.comment} /></label><Turnstile action="installer_review" onExpire={() => setTurnstileToken('')} onVerify={setTurnstileToken} resetKey={turnstileResetKey} /><button className="ig-profile-primary-action" disabled={sendingReview || (isTurnstileEnabled() && !turnstileToken)} type="submit">{sendingReview ? 'Enviando...' : 'Enviar avaliação'}</button></form>}
          </section>
        </section>

        <section aria-labelledby="perfil-aba-agenda" className="ig-profile-panel ig-profile-agenda ig-profile-tabpanel" hidden={activeSection !== 'agenda'} id="agenda" role="tabpanel" tabIndex={0}>
          <div className="ig-panel-heading"><div><span><ProfileIcon name="calendar" size={18} /></span><div><p>Disponibilidade</p><h2>Próximos horários livres</h2></div></div><Link to={profileActionPath}>{profileActionLabel}</Link></div>
          {slots.length ? (
            <div className="ig-slot-grid">{slots.slice(0, 4).map(([date, dateSlots]) => <article key={date}><strong>{formatLongDate(`${date}T12:00:00`)}</strong><span>{dateSlots.map((slot) => `${slot.start_time} – ${slot.end_time}`).join(' · ')}</span></article>)}</div>
          ) : installer.available_dates?.length ? (
            <div className="ig-slot-grid">{installer.available_dates.slice(0, 4).map((date) => <article key={date}><strong>{formatLongDate(date)}</strong><span>Data disponível para combinar</span></article>)}</div>
          ) : <p className="ig-profile-note">Este profissional ainda não informou horários livres. Envie o pedido para combinar a melhor data de atendimento.</p>}
        </section>

        <section aria-labelledby="perfil-aba-informacoes" className="ig-profile-info-grid ig-profile-tabpanel" hidden={activeSection !== 'informacoes'} id="informacoes" role="tabpanel" tabIndex={0}>
          <article className="ig-profile-panel ig-profile-about-panel"><div className="ig-panel-heading"><div><span><ProfileIcon name="briefcase" size={18} /></span><h2>Como atende</h2></div></div><p>{installer.installation_method || 'O ambiente é analisado antes da instalação para orientar o melhor material, preparo e acabamento.'}</p><div className="ig-info-tags"><span>{installer.safety?.accepts_service_contract ? 'Contrato disponível' : 'Combinações registradas'}</span><span>{warrantyLabel}</span><span>{formatInstallationDays(installer.installation_days)}</span></div></article>
          <article className="ig-profile-panel ig-profile-details-panel"><div className="ig-panel-heading"><div><span><ProfileIcon name="document" size={18} /></span><h2>Dados do perfil</h2></div></div><dl><div><dt>Atende em</dt><dd>{installer.service_region || locationLabel}</dd></div><div><dt>Documento</dt><dd>{installer.safety?.document_masked || 'Cadastro profissional'}</dd></div></dl>{installer.certificate_file ? <a href={installer.certificate_file} rel="noreferrer" target="_blank">Ver certificado <ProfileIcon name="chevron" size={15} /></a> : null}</article>
          <article className="ig-profile-panel ig-profile-prices-panel"><div className="ig-panel-heading"><div><span><ProfileIcon name="star" size={18} /></span><h2>Valores de referência</h2></div></div><div><span>Visita técnica</span><strong>{formatCurrency(installer.base_service_cost)}</strong></div><div><span>Deslocamento</span><strong>{formatCurrency(installer.travel_fee)}</strong></div><div><span>Instalação por rolo</span><strong>{formatCurrency(installer.default_price_per_roll)}</strong></div><small>O orçamento final considera as medidas e condições do ambiente.</small></article>
        </section>

        <aside className="ig-profile-store"><div><span>Parceiro recomendado</span><h2>{marketplace.title}</h2><p>{marketplace.description}</p><small>{(marketplace.highlights || []).slice(0, 2).join(' · ')}</small></div><a href={marketplace.url || 'https://www.beminstalado.com.br'} rel="noreferrer" target="_blank">{marketplace.cta_label || 'Conhecer a loja'} <ProfileIcon name="chevron" size={16} /></a></aside>
      </section>

      <div className="ig-profile-mobile-action">
        {chooseAction ? (
          <button className="ig-profile-primary-action ig-profile-choose" disabled={selecting} onClick={chooseInstaller} type="button">
            <ProfileIcon name="check" size={20} />
            {selecting ? 'Confirmando escolha…' : 'Escolher este instalador'}
          </button>
        ) : <Link to={profileActionPath}><ProfileIcon name={isOwnProfile ? 'document' : 'message'} size={18} />{profileActionLabel}</Link>}
      </div>
    </main>
  );
}
