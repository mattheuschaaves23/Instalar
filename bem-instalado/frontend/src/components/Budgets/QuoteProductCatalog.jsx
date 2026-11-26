import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { formatCurrency } from '../../utils/formatters';
import PaginationControls from '../Layout/PaginationControls';
import ProductThumbnail from '../Products/ProductThumbnail';
import { matchesProductName, sortProducts, useProductPhotos } from '../Products/productPhotos';
import limits from '../../../../shared/quoteProducts.json';

export default function QuoteProductCatalog({ products, selected, onAdd, onReload }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [photoFilter, setPhotoFilter] = useState('all');
  const [page, setPage] = useState(1);
  const selectedIds = useMemo(() => new Set(selected.map((item) => Number(item.product_id))), [selected]);
  const sorted = useMemo(() => sortProducts(products), [products]);
  const matches = sorted.filter((item) => matchesProductName(item.name, query)
    && (filter === 'all' || selectedIds.has(item.id) === (filter === 'added'))
    && (photoFilter === 'all' || Boolean(item.photo_version) === (photoFilter === 'with')));
  const totalPages = Math.max(1, Math.ceil(matches.length / limits.catalogPageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = matches.slice((currentPage - 1) * limits.catalogPageSize, currentPage * limits.catalogPageSize);
  const photos = useProductPhotos(visible);
  const atLimit = selected.length >= limits.maximumItems;

  function clear() {
    setQuery('');
    setFilter('all');
    setPhotoFilter('all');
    setPage(1);
  }

  if (!products.length) return (
    <div className="quote-catalog-empty">
      <p>Seu catálogo está vazio. Cadastre um produto para usar o preço dele neste orçamento.</p>
      <div className="quote-catalog-actions">
        <Link className="quote-action-link" to="/products" target="_blank" rel="noopener noreferrer">Cadastrar produto</Link>
        <button className="quote-action-link" onClick={onReload} type="button">Atualizar lista</button>
      </div>
    </div>
  );

  return (
    <div className="quote-catalog">
      <div className="quote-catalog-filters" role="group" aria-label="Filtros do catálogo">
        <label className="quote-field">
          <span>Buscar por nome</span>
          <input type="search" value={query} placeholder="Ex.: Papel linho" onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        </label>
        <label className="quote-field">
          <span>Seleção</span>
          <select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
            <option value="all">Todos</option>
            <option value="available">Não adicionados</option>
            <option value="added">No orçamento</option>
          </select>
        </label>
        <label className="quote-field">
          <span>Foto</span>
          <select value={photoFilter} onChange={(event) => { setPhotoFilter(event.target.value); setPage(1); }}>
            <option value="all">Todas</option>
            <option value="with">Com foto</option>
            <option value="without">Sem foto</option>
          </select>
        </label>
      </div>
      <div className="quote-catalog-meta">
        <p role="status">{matches.length === 1 ? '1 produto' : `${matches.length} produtos`} · A–Z</p>
        {(query || filter !== 'all' || photoFilter !== 'all') && <button className="quote-action-link" type="button" onClick={clear}>Limpar filtros</button>}
      </div>
      {atLimit && <p className="quote-help">Limite de {limits.maximumItems} produtos por orçamento. Remova um item para adicionar outro.</p>}
      {visible.length ? (
        <ul className="quote-catalog-list" aria-label="Produtos do catálogo">
          {visible.map((item) => {
            const added = selectedIds.has(item.id);
            return <li className="quote-catalog-row" key={item.id} data-added={added}>
              <ProductThumbnail photo={photos[item.id]} />
              <div className="quote-catalog-info"><strong>{item.name}</strong><span>{formatCurrency(item.price)}</span></div>
              <button className={added ? 'quote-button quote-catalog-added' : 'quote-button'} type="button"
                disabled={atLimit && !added} aria-disabled={added || undefined}
                aria-label={added ? `${item.name}: adicionado` : `Adicionar ${item.name}`}
                onClick={() => { if (!added) onAdd(item); }}
              >{added ? 'Adicionado' : 'Adicionar'}</button>
            </li>;
          })}
        </ul>
      ) : <p className="quote-catalog-empty">Nenhum produto com esses filtros.</p>}
      <PaginationControls className="quote-catalog-pagination" currentPage={currentPage} onPageChange={setPage} totalPages={totalPages} />
    </div>
  );
}
