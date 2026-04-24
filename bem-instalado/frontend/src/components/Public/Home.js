import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import BrandMark from '../Layout/BrandMark';
import PaginationControls from '../Layout/PaginationControls';

const AUTO_LOCATION_SESSION_KEY = 'bem_instalado_client_location_checked';
const INSTALLERS_PER_PAGE = 6;

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Todos', keywords: [] },
  { value: 'residential', label: 'Residencial', keywords: ['residencial', 'casa', 'apartamento', 'sala', 'quarto'] },
  { value: 'commercial', label: 'Comercial', keywords: ['comercial', 'empresa', 'escritorio', 'escritório', 'loja'] },
  { value: 'textured', label: 'Texturizados', keywords: ['textura', 'texturizado', 'texturizados'] },
  { value: 'vinyl', label: 'Vinilicos', keywords: ['vinil', 'vinílico', 'vinilico', 'vinilicos', 'vinílicos'] },
  { value: 'kids', label: 'Infantil', keywords: ['infantil', 'crianca', 'criança', 'kids', 'bebê', 'bebe'] },
];

const QUICK_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'verified', label: 'Verificados' },
  { value: 'available', label: 'Disponiveis' },
  { value: 'featured', label: 'Destaques' },
];

function AppIcon({ name, className = '' }) {
  const commonProps = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  };

  switch (name) {
    case 'bell':
      return (
        <svg {...commonProps}>
          <path d="M6 9a6 6 0 0 1 12 0v4.2l1.6 2.4a1 1 0 0 1-.83 1.55H5.23a1 1 0 0 1-.83-1.55L6 13.2V9Z" />
          <path d="M10 18a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'map-pin':
      return (
        <svg {...commonProps}>
          <path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      );
    case 'target':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22" />
        </svg>
      );
    case 'search':
      return (
        <svg {...commonProps}>
          <circle cx="11" cy="11" r="6.8" />
          <path d="m20 20-3.7-3.7" />
        </svg>
      );
    case 'filter':
      return (
        <svg {...commonProps}>
          <path d="M4 6h16l-6.4 7.1v4.9l-3.2-1.8v-3.1L4 6Z" />
        </svg>
      );
    case 'sort':
      return (
        <svg {...commonProps}>
          <path d="M8 6v12" />
          <path d="m5 9 3-3 3 3" />
          <path d="M16 18V6" />
          <path d="m13 15 3 3 3-3" />
        </svg>
      );
    case 'users':
      return (
        <svg {...commonProps}>
          <path d="M16 21v-1.3A4.7 4.7 0 0 0 11.3 15H7.7A4.7 4.7 0 0 0 3 19.7V21" />
          <circle cx="9.5" cy="8" r="3.2" />
          <path d="M21 21v-1.3a4.3 4.3 0 0 0-3.1-4.15" />
          <path d="M15.8 4.9a3.2 3.2 0 0 1 0 6.2" />
        </svg>
      );
    case 'home':
      return (
        <svg {...commonProps}>
          <path d="m3 10.6 9-7 9 7" />
          <path d="M5.5 9.8V20h13V9.8" />
        </svg>
      );
    case 'building':
      return (
        <svg {...commonProps}>
          <path d="M4 21V6.5A1.5 1.5 0 0 1 5.5 5H14v16" />
          <path d="M14 21V3.5A1.5 1.5 0 0 1 15.5 2H19a1 1 0 0 1 1 1V21" />
          <path d="M8 9h2M8 13h2M8 17h2M16 9h1.5M16 13h1.5M16 17h1.5" />
        </svg>
      );
    case 'texture':
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="16" height="16" rx="2.4" />
          <path d="M8 8h8M8 12h8M8 16h8" />
          <path d="M8 8v8M12 8v8M16 8v8" />
        </svg>
      );
    case 'roller':
      return (
        <svg {...commonProps}>
          <path d="M5 7.5A1.5 1.5 0 0 1 6.5 6H16a2 2 0 0 1 2 2v2H9a2 2 0 0 0-2 2v6" />
          <path d="M9 18h4" />
          <path d="M13 18v2.5" />
        </svg>
      );
    case 'smile':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9 10h.01M15 10h.01" />
          <path d="M8.5 14a5 5 0 0 0 7 0" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...commonProps}>
          <path d="M12 3.2 5.4 5.9v5.2c0 4.2 2.8 8 6.6 9.7 3.8-1.7 6.6-5.5 6.6-9.7V5.9L12 3.2Z" />
          <path d="m9.5 12 1.7 1.8 3.4-3.8" />
        </svg>
      );
    case 'star':
      return (
        <svg {...commonProps}>
          <path d="m12 3.8 2.45 4.96 5.48.8-3.97 3.86.94 5.46L12 16.5l-4.9 2.58.94-5.46-3.97-3.86 5.48-.8L12 3.8Z" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...commonProps}>
          <path d="m12 20.5-1.2-1.08C5.8 14.95 3 12.4 3 9.26A4.26 4.26 0 0 1 7.35 5a4.7 4.7 0 0 1 4.65 2.82A4.7 4.7 0 0 1 16.65 5 4.26 4.26 0 0 1 21 9.26c0 3.14-2.8 5.69-7.8 10.16L12 20.5Z" />
        </svg>
      );
    case 'message':
      return (
        <svg {...commonProps}>
          <path d="M5 6.5h14A1.5 1.5 0 0 1 20.5 8v8A1.5 1.5 0 0 1 19 17.5H9L4.5 20v-4A1.5 1.5 0 0 1 3.5 14.5V8A1.5 1.5 0 0 1 5 6.5Z" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8.1" r="3.2" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'check-badge':
      return (
        <svg {...commonProps}>
          <path d="M12 3.4 14.7 5l3.08-.11.87 2.95L21 10l-1.35 2.16.52 3.02-2.8 1.22L15.9 19l-2.9-.64L10.1 19l-1.47-2.6-2.8-1.22.52-3.02L3 10l2.35-2.16.87-2.95L9.3 5 12 3.4Z" />
          <path d="m9.3 12 1.8 1.8 3.7-4" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function getInitials(name) {
  return (name || 'IL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function installerTextBlob(installer) {
  return normalizeText([
    installer.display_name,
    installer.bio,
    installer.installation_method,
    installer.service_region,
    installer.city,
    installer.state,
  ].join(' '));
}

function matchesCategory(installer, categoryValue) {
  if (categoryValue === 'all') {
    return true;
  }

  const category = CATEGORY_OPTIONS.find((item) => item.value === categoryValue);
  if (!category) {
    return true;
  }

  const text = installerTextBlob(installer);
  return category.keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function deriveInstallerTags(installer) {
  const matched = CATEGORY_OPTIONS.filter((item) => item.value !== 'all' && matchesCategory(installer, item.value)).map(
    (item) => item.label
  );

  if (matched.length > 0) {
    return matched.slice(0, 3);
  }

  if (installer.installation_method) {
    return [installer.installation_method.split(',')[0].trim().slice(0, 28)];
  }

  return ['Papel de parede'];
}

function getAvailabilityState(installer) {
  if ((installer.availability_slots || []).length > 0) {
    return { label: 'Disponivel', tone: 'available' };
  }

  if ((installer.available_dates || []).length > 0) {
    return { label: 'Agenda aberta', tone: 'scheduled' };
  }

  return { label: 'Agenda cheia', tone: 'busy' };
}

function sortInstallers(items, sortBy) {
  const nextItems = [...items];

  nextItems.sort((left, right) => {
    if (sortBy === 'reviews') {
      return Number(right.review_count || 0) - Number(left.review_count || 0);
    }

    if (sortBy === 'available') {
      return (right.availability_slots || []).length - (left.availability_slots || []).length;
    }

    if (sortBy === 'name') {
      return String(left.display_name || '').localeCompare(String(right.display_name || ''), 'pt-BR');
    }

    const leftScore = Number(left.average_rating || 0) * 100 + Number(left.review_count || 0);
    const rightScore = Number(right.average_rating || 0) * 100 + Number(right.review_count || 0);
    return rightScore - leftScore;
  });

  return nextItems;
}

function RatingStars({ value }) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(value || 0))));

  return (
    <span className="client-app-rating-stars" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <span className={index < rounded ? 'is-on' : ''} key={index}>
          ★
        </span>
      ))}
    </span>
  );
}

function buildSuggestionScenarios(filters) {
  const scenarios = [];
  const city = String(filters.city || '').trim();
  const state = String(filters.state || '').trim();
  const search = String(filters.search || '').trim();

  if (state) {
    scenarios.push({
      label: `Profissionais proximos em ${state}`,
      params: { search: '', city: '', state },
    });
  }

  if (city) {
    scenarios.push({
      label: `Resultados parecidos com ${city}`,
      params: { search: city, city: '', state },
    });
  }

  if (search) {
    scenarios.push({
      label: 'Sugestoes relacionadas',
      params: { search, city: '', state: '' },
    });
  }

  scenarios.push({
    label: 'Instaladores em destaque',
    params: { search: '', city: '', state: '' },
  });

  const seen = new Set();
  return scenarios.filter((scenario) => {
    const key = JSON.stringify(scenario.params);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getRegionLabel(installer) {
  return [installer.city, installer.state].filter(Boolean).join(', ') || installer.service_region || 'Regiao nao informada';
}

export default function Home() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ search: '', city: '', state: '' });
  const [directory, setDirectory] = useState({ installers: [], ranking: [], reviews: [], marketplace: null });
  const [loading, setLoading] = useState(true);
  const [locationState, setLocationState] = useState({
    status: 'idle',
    message: 'Ative sua localizacao para encontrar profissionais mais proximos.',
  });
  const [installersPage, setInstallersPage] = useState(1);
  const [category, setCategory] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rating');
  const [favorites, setFavorites] = useState({});
  const [noResultsSuggestions, setNoResultsSuggestions] = useState({
    loading: false,
    label: '',
    items: [],
  });

  const hasActiveFilters = useMemo(
    () => Boolean(filters.search.trim() || filters.city.trim() || filters.state.trim()),
    [filters.search, filters.city, filters.state]
  );

  const filteredInstallers = useMemo(() => {
    const categoryFiltered = directory.installers.filter((installer) => matchesCategory(installer, category));

    const quickFiltered = categoryFiltered.filter((installer) => {
      if (quickFilter === 'verified') {
        return Boolean(installer.certificate_verified || installer.safety?.document_masked);
      }

      if (quickFilter === 'available') {
        return Boolean((installer.availability_slots || []).length > 0 || (installer.available_dates || []).length > 0);
      }

      if (quickFilter === 'featured') {
        return Boolean(installer.featured_installer);
      }

      return true;
    });

    return sortInstallers(quickFiltered, sortBy);
  }, [category, directory.installers, quickFilter, sortBy]);

  const favoriteInstallers = useMemo(
    () => filteredInstallers.filter((installer) => favorites[installer.id]),
    [favorites, filteredInstallers]
  );

  const totalInstallersPages = Math.max(1, Math.ceil(filteredInstallers.length / INSTALLERS_PER_PAGE));
  const normalizedInstallersPage = Math.min(installersPage, totalInstallersPages);
  const installersStart = (normalizedInstallersPage - 1) * INSTALLERS_PER_PAGE;
  const paginatedInstallers = useMemo(
    () => filteredInstallers.slice(installersStart, installersStart + INSTALLERS_PER_PAGE),
    [filteredInstallers, installersStart]
  );

  const loadDirectory = async (nextFilters = filters) => {
    setLoading(true);

    try {
      const response = await api.get('/public/installers', { params: nextFilters });
      setDirectory(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nao foi possivel carregar os instaladores.');
    } finally {
      setLoading(false);
    }
  };

  const reverseLocation = async (latitude, longitude) => {
    const response = await api.get('/public/location/reverse', {
      params: { lat: latitude, lon: longitude },
    });

    return response.data;
  };

  const requestLocationSearch = async ({ silent = false } = {}) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationState({
        status: 'unsupported',
        message: 'Seu navegador nao oferece localizacao automatica. Voce pode buscar manualmente.',
      });
      return;
    }

    setLocationState({
      status: 'locating',
      message: 'Buscando sua regiao para filtrar os instaladores.',
    });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const region = await reverseLocation(position.coords.latitude, position.coords.longitude);
          const nextFilters = {
            ...filters,
            city: region.city || '',
            state: region.state || '',
            search: region.city || filters.search,
          };

          setFilters(nextFilters);
          setInstallersPage(1);
          setLocationState({
            status: 'resolved',
            message: region.label
              ? `Mostrando profissionais proximos de ${region.label}.`
              : 'Mostrando profissionais da sua regiao.',
          });

          if (!silent) {
            toast.success(region.label ? `Regiao encontrada: ${region.label}.` : 'Regiao encontrada.');
          }

          await loadDirectory(nextFilters);
        } catch (error) {
          setLocationState({
            status: 'error',
            message: error.response?.data?.error || 'Nao foi possivel localizar sua regiao agora.',
          });

          if (!silent) {
            toast.error(error.response?.data?.error || 'Nao foi possivel localizar sua regiao agora.');
          }
        }
      },
      (error) => {
        const permissionDenied = error.code === 1;
        setLocationState({
          status: permissionDenied ? 'denied' : 'error',
          message: permissionDenied
            ? 'Permita a localizacao para mostrar primeiro os profissionais da sua regiao.'
            : 'Nao foi possivel usar sua localizacao no momento.',
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.sessionStorage.getItem(AUTO_LOCATION_SESSION_KEY) === 'done') {
      return;
    }

    window.sessionStorage.setItem(AUTO_LOCATION_SESSION_KEY, 'done');
    requestLocationSearch({ silent: true });
  }, []);

  useEffect(() => {
    setInstallersPage(1);
  }, [category, quickFilter, sortBy]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (directory.installers.length > 0 || !hasActiveFilters) {
      setNoResultsSuggestions({ loading: false, label: '', items: [] });
      return;
    }

    let cancelled = false;

    const fetchSuggestions = async () => {
      setNoResultsSuggestions({ loading: true, label: '', items: [] });
      const scenarios = buildSuggestionScenarios(filters);

      for (const scenario of scenarios) {
        try {
          const response = await api.get('/public/installers', { params: scenario.params });
          const suggestions = (response.data?.installers || []).slice(0, 4);

          if (suggestions.length > 0) {
            if (!cancelled) {
              setNoResultsSuggestions({
                loading: false,
                label: scenario.label,
                items: suggestions,
              });
            }
            return;
          }
        } catch (_error) {
          // Tenta o proximo cenario automaticamente.
        }
      }

      if (!cancelled) {
        setNoResultsSuggestions({ loading: false, label: '', items: [] });
      }
    };

    fetchSuggestions();

    return () => {
      cancelled = true;
    };
  }, [directory.installers.length, filters, hasActiveFilters, loading]);

  const handleFilterChange = (event) => {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setInstallersPage(1);
    await loadDirectory(filters);
  };

  const clearFilters = async () => {
    const nextFilters = { search: '', city: '', state: '' };
    setFilters(nextFilters);
    setCategory('all');
    setQuickFilter('all');
    setSortBy('rating');
    setInstallersPage(1);
    await loadDirectory(nextFilters);
  };

  const toggleFavorite = (installerId) => {
    setFavorites((current) => ({
      ...current,
      [installerId]: !current[installerId],
    }));
  };

  const cycleQuickFilter = () => {
    const currentIndex = QUICK_FILTER_OPTIONS.findIndex((item) => item.value === quickFilter);
    const nextIndex = (currentIndex + 1) % QUICK_FILTER_OPTIONS.length;
    setQuickFilter(QUICK_FILTER_OPTIONS[nextIndex].value);
  };

  return (
    <div className="client-app-page" id="top">
      <div className="client-app-shell">
        <header className="client-app-topbar fade-up">
          <div className="client-app-brand">
            <BrandMark className="client-app-brand-mark" />
            <div className="client-app-brand-copy">
              <strong>InstaLar</strong>
              <span>Encontre instaladores no Brasil</span>
            </div>
          </div>

          <div className="client-app-top-actions">
            <button className="client-app-icon-button" type="button">
              <AppIcon name="bell" />
            </button>
            {user ? (
              <Link className="client-app-chip-link" to="/dashboard">
                Meu painel
              </Link>
            ) : (
              <Link className="client-app-chip-link" to="/instalador/entrar">
                Entrar
              </Link>
            )}
          </div>
        </header>

        <section className="client-app-hero fade-up">
          <div className="client-app-hero-copy">
            <p className="client-app-kicker">Area do cliente</p>
            <h1>
              Encontre instaladores
              <br />
              de <span>papel de parede</span>
            </h1>
            <p>Profissionais qualificados proximos de voce.</p>
          </div>

          <div className="client-app-hero-visual" aria-hidden="true">
            <div className="client-app-roll-shadow" />
            <div className="client-app-roll-sheet" />
            <div className="client-app-roll-core" />
            <span className="client-app-leaf client-app-leaf--one" />
            <span className="client-app-leaf client-app-leaf--two" />
          </div>
        </section>

        <section className="client-app-search-card fade-up" id="busca">
          <form className="client-app-search-form" onSubmit={handleSearch}>
            <div className="client-app-search-main">
              <div className="client-app-search-inputwrap">
                <AppIcon className="client-app-inline-icon" name="map-pin" />
                <input
                  name="search"
                  onChange={handleFilterChange}
                  placeholder="Digite sua cidade ou CEP"
                  value={filters.search}
                />
                <button
                  className="client-app-locate-button"
                  onClick={() => requestLocationSearch()}
                  type="button"
                >
                  <AppIcon name="target" />
                </button>
              </div>

              <button className="client-app-search-submit" type="submit">
                Buscar
              </button>
            </div>

            <div className="client-app-search-advanced">
              <label>
                <span>Cidade</span>
                <input
                  name="city"
                  onChange={handleFilterChange}
                  placeholder="Ex.: Sao Paulo"
                  value={filters.city}
                />
              </label>

              <label>
                <span>Estado</span>
                <input
                  name="state"
                  onChange={handleFilterChange}
                  placeholder="Ex.: SP"
                  value={filters.state}
                />
              </label>
            </div>
          </form>
        </section>

        <section className="client-app-category-row fade-up">
          {CATEGORY_OPTIONS.map((item) => (
            <button
              className={`client-app-category ${category === item.value ? 'is-active' : ''}`}
              key={item.value}
              onClick={() => setCategory(item.value)}
              type="button"
            >
              <span className="client-app-category-icon">
                <AppIcon
                  name={
                    item.value === 'all'
                      ? 'users'
                      : item.value === 'residential'
                        ? 'home'
                        : item.value === 'commercial'
                          ? 'building'
                          : item.value === 'textured'
                            ? 'texture'
                            : item.value === 'vinyl'
                              ? 'roller'
                              : 'smile'
                  }
                />
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </section>

        <section className="client-app-toolbar fade-up">
          <button className="client-app-toolbar-pill" onClick={() => requestLocationSearch()} type="button">
            <AppIcon name="map-pin" />
            <span>
              {filters.city
                ? `${filters.city}${filters.state ? `, ${filters.state}` : ''}`
                : 'Minha localizacao'}
            </span>
          </button>

          <div className="client-app-toolbar-actions">
            <button className="client-app-toolbar-action" onClick={cycleQuickFilter} type="button">
              <AppIcon name="filter" />
              <span>{QUICK_FILTER_OPTIONS.find((item) => item.value === quickFilter)?.label || 'Filtro'}</span>
            </button>

            <label className="client-app-toolbar-select">
              <AppIcon name="sort" />
              <select onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
                <option value="rating">Melhor avaliados</option>
                <option value="reviews">Mais avaliacoes</option>
                <option value="available">Mais disponiveis</option>
                <option value="name">Ordem alfabetica</option>
              </select>
            </label>
          </div>
        </section>

        <section className="client-app-results-head fade-up">
          <div>
            <h2>Instaladores encontrados</h2>
          </div>
          <span className="client-app-count-badge">{filteredInstallers.length} profissionais</span>
        </section>

        {loading ? <div className="client-app-empty fade-up">Carregando instaladores...</div> : null}

        {!loading && filteredInstallers.length === 0 ? (
          <div className="client-app-empty fade-up">
            <strong>Nenhum instalador encontrado com esse filtro.</strong>
            <p>
              Ajuste sua busca ou limpe os filtros para ver novamente todos os profissionais disponiveis.
            </p>
            {hasActiveFilters ? (
              <button className="client-app-ghost-button" onClick={clearFilters} type="button">
                Limpar filtros
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && filteredInstallers.length === 0 && hasActiveFilters && noResultsSuggestions.items.length > 0 ? (
          <section className="client-app-suggestion-box fade-up">
            <div className="client-app-section-copy">
              <p className="client-app-kicker">Sugestoes automaticas</p>
              <h3>{noResultsSuggestions.label || 'Confira outros profissionais parecidos'}</h3>
            </div>

            <div className="client-app-suggestion-grid">
              {noResultsSuggestions.items.map((installer) => (
                <Link className="client-app-suggestion-card" key={`suggestion-${installer.id}`} to={`/installers/${installer.id}`}>
                  {installer.installer_photo ? (
                    <img alt={`Foto de ${installer.display_name}`} src={installer.installer_photo} />
                  ) : installer.logo ? (
                    <img alt={`Logo de ${installer.display_name}`} src={installer.logo} />
                  ) : (
                    <span className="client-app-avatar-fallback">{getInitials(installer.display_name)}</span>
                  )}
                  <div>
                    <strong>{installer.display_name}</strong>
                    <span>{getRegionLabel(installer)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {favoriteInstallers.length > 0 ? (
          <section className="client-app-favorites fade-up" id="favoritos">
            <div className="client-app-results-head client-app-results-head--small">
              <div>
                <h2>Favoritos</h2>
              </div>
              <span className="client-app-count-badge">{favoriteInstallers.length} salvos</span>
            </div>

            <div className="client-app-results-list">
              {favoriteInstallers.slice(0, 3).map((installer) => {
                const availability = getAvailabilityState(installer);
                const tags = deriveInstallerTags(installer);
                const isVerified = Boolean(installer.certificate_verified || installer.safety?.document_masked);

                return (
                  <article className="client-app-installer-card" key={`favorite-${installer.id}`}>
                    <div className="client-app-status-badge" data-tone={availability.tone}>
                      <span />
                      {availability.label}
                    </div>

                    <div className="client-app-installer-main">
                      <div className="client-app-installer-media">
                        {installer.installer_photo ? (
                          <img alt={`Foto de ${installer.display_name}`} src={installer.installer_photo} />
                        ) : installer.logo ? (
                          <img alt={`Logo de ${installer.display_name}`} src={installer.logo} />
                        ) : (
                          <div className="client-app-avatar-fallback">{getInitials(installer.display_name)}</div>
                        )}
                      </div>

                      <div className="client-app-installer-content">
                        <div className="client-app-installer-head">
                          <div>
                            <h3>{installer.display_name}</h3>
                            <p>{getRegionLabel(installer)}</p>
                          </div>
                          <button
                            className={`client-app-favorite-button ${favorites[installer.id] ? 'is-active' : ''}`}
                            onClick={() => toggleFavorite(installer.id)}
                            type="button"
                          >
                            <AppIcon name="heart" />
                          </button>
                        </div>

                        <div className="client-app-rating-line">
                          <AppIcon name="star" />
                          <strong>{Number(installer.average_rating || 0).toFixed(1)}</strong>
                          <span>({installer.review_count || 0} avaliacoes)</span>
                        </div>

                        <div className="client-app-tag-row">
                          {tags.map((tag) => (
                            <span className="client-app-tag" key={`${installer.id}-${tag}`}>
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="client-app-detail-line">
                          <AppIcon name="shield" />
                          <span>{isVerified ? 'Perfil verificado' : 'Contato direto com o profissional'}</span>
                          <span className="client-app-dot">•</span>
                          <span>{(installer.available_dates || []).length > 0 ? 'Datas disponiveis' : 'Perfil completo'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="client-app-installer-footer">
                      <Link className="client-app-primary-link" to={`/installers/${installer.id}`}>
                        Ver perfil
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {!loading && filteredInstallers.length > 0 ? (
          <section className="client-app-results-list fade-up">
            {paginatedInstallers.map((installer) => {
              const availability = getAvailabilityState(installer);
              const tags = deriveInstallerTags(installer);
              const isVerified = Boolean(installer.certificate_verified || installer.safety?.document_masked);

              return (
                <article className="client-app-installer-card" key={installer.id}>
                  <div className="client-app-status-badge" data-tone={availability.tone}>
                    <span />
                    {availability.label}
                  </div>

                  <div className="client-app-installer-main">
                    <div className="client-app-installer-media">
                      {installer.installer_photo ? (
                        <img alt={`Foto de ${installer.display_name}`} src={installer.installer_photo} />
                      ) : installer.logo ? (
                        <img alt={`Logo de ${installer.display_name}`} src={installer.logo} />
                      ) : (
                        <div className="client-app-avatar-fallback">{getInitials(installer.display_name)}</div>
                      )}
                    </div>

                    <div className="client-app-installer-content">
                      <div className="client-app-installer-head">
                        <div>
                          <h3>
                            {installer.display_name}
                            {isVerified ? (
                              <span className="client-app-verified-mark">
                                <AppIcon name="check-badge" />
                              </span>
                            ) : null}
                          </h3>
                          <p>{getRegionLabel(installer)}</p>
                        </div>

                        <button
                          className={`client-app-favorite-button ${favorites[installer.id] ? 'is-active' : ''}`}
                          onClick={() => toggleFavorite(installer.id)}
                          type="button"
                        >
                          <AppIcon name="heart" />
                        </button>
                      </div>

                      <div className="client-app-rating-line">
                        <AppIcon name="star" />
                        <strong>{Number(installer.average_rating || 0).toFixed(1)}</strong>
                        <span>({installer.review_count || 0} avaliacoes)</span>
                      </div>

                      <div className="client-app-tag-row">
                        {tags.map((tag) => (
                          <span className="client-app-tag" key={`${installer.id}-${tag}`}>
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="client-app-detail-line">
                        <AppIcon name="shield" />
                        <span>{isVerified ? 'Profissional verificado' : 'Contato direto disponivel'}</span>
                        <span className="client-app-dot">•</span>
                        <span>
                          {(installer.availability_slots || []).length > 0 || (installer.available_dates || []).length > 0
                            ? 'Horarios disponiveis'
                            : 'Agenda a confirmar'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="client-app-installer-footer">
                    <Link className="client-app-primary-link" to={`/installers/${installer.id}`}>
                      Ver perfil
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {!loading && filteredInstallers.length > 0 ? (
          <PaginationControls
            currentPage={normalizedInstallersPage}
            onPageChange={setInstallersPage}
            totalPages={totalInstallersPages}
          />
        ) : null}

        <section className="client-app-trust-strip fade-up">
          <article>
            <AppIcon name="shield" />
            <div>
              <strong>Profissionais verificados</strong>
              <span>Todos passam por analise</span>
            </div>
          </article>
          <article>
            <AppIcon name="star" />
            <div>
              <strong>Avaliacoes reais</strong>
              <span>Baseadas em clientes</span>
            </div>
          </article>
          <article>
            <AppIcon name="shield" />
            <div>
              <strong>Contato direto</strong>
              <span>Fale com quem vai atender</span>
            </div>
          </article>
        </section>
      </div>

      <nav className="client-app-mobile-dock">
        <a href="#top">
          <AppIcon name="home" />
          <span>Inicio</span>
        </a>
        <a href="#busca">
          <AppIcon name="search" />
          <span>Buscar</span>
        </a>
        <a href="#favoritos">
          <AppIcon name="heart" />
          <span>Favoritos</span>
        </a>
        <a href="https://api.whatsapp.com/send?phone=5548999816000" rel="noreferrer" target="_blank">
          <AppIcon name="message" />
          <span>Mensagens</span>
        </a>
        {user ? (
          <Link to="/dashboard">
            <AppIcon name="profile" />
            <span>Perfil</span>
          </Link>
        ) : (
          <Link to="/instalador/entrar">
            <AppIcon name="profile" />
            <span>Perfil</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
