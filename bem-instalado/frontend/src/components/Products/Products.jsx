import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import api from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import { formatCurrency } from '../../utils/formatters';
import PaginationControls from '../Layout/PaginationControls';
import ProductThumbnail from './ProductThumbnail';
import { prepareProductPhoto, sortProducts, useProductPhotos } from './productPhotos';
import limits from '../../../../shared/quoteProducts.json';
import '../Budgets/BudgetWizard.css';
import './Products.css';

const emptyProduct = { id: null, name: '', price: '' };

export default function Products() {
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [failure, setFailure] = useState('');
  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [newPhoto, setNewPhoto] = useState(undefined);
  const [photoError, setPhotoError] = useState('');
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const lock = useRef(false);
  const photoRequest = useRef(0);
  const nameInput = useRef(null);
  const createTrigger = useRef(null);
  const pageSize = limits.catalogPageSize;
  const totalPages = Math.max(1, Math.ceil((items?.length ?? 0) / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = items ? sortProducts(items).slice((currentPage - 1) * pageSize, currentPage * pageSize) : [];
  const photos = useProductPhotos(visible);
  const editorPhotos = useProductPhotos(editor?.id && !visible.some((item) => item.id === editor.id) ? [editor] : []);
  const previewPhoto = newPhoto === undefined ? photos[editor?.id] ?? editorPhotos[editor?.id] : newPhoto;

  useEffect(() => {
    const request = new AbortController();
    api.get(limits.catalogPath, { signal: request.signal }).then(({ data }) => {
      if (!request.signal.aborted) setItems(Array.isArray(data) ? data : []);
    }).catch((error) => {
      if (!request.signal.aborted) setFailure(error.response?.data?.error || 'Não foi possível carregar os produtos.');
    });
    return () => request.abort();
  }, [retry]);

  function open(item = emptyProduct) {
    setFailure('');
    resetPhoto();
    setEditor(item);
    requestAnimationFrame(() => nameInput.current?.focus());
  }

  function close() {
    resetPhoto();
    setEditor(null);
    requestAnimationFrame(() => createTrigger.current?.focus());
  }

  function resetPhoto() {
    photoRequest.current += 1;
    setNewPhoto(undefined);
    setPhotoError('');
    setPreparingPhoto(false);
  }

  async function choosePhoto(file) {
    if (!file) return;
    const request = ++photoRequest.current;
    setPhotoError('');
    setPreparingPhoto(true);
    try {
      const photo = await prepareProductPhoto(file);
      if (photoRequest.current === request) setNewPhoto(photo);
    } catch (error) {
      if (photoRequest.current === request) setPhotoError(error.message || 'Não foi possível abrir a foto.');
    } finally {
      if (photoRequest.current === request) setPreparingPhoto(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    if (!editor || lock.current || preparingPhoto) return;
    const name = editor.name.trim();
    if (!name) { setFailure('Informe o nome do produto.'); return; }
    lock.current = true;
    setSaving(true);
    setFailure('');
    try {
      const input = { name, price: Number(editor.price), ...(newPhoto !== undefined ? { photo: newPhoto } : {}) };
      const { data } = editor.id
        ? await api.put(`${limits.catalogPath}/${editor.id}`, input)
        : await api.post(limits.catalogPath, input);
      setItems((current) => [...(current ?? []).filter((item) => item.id !== data.id), data]);
      close();
    } catch (error) {
      setFailure(error.response?.data?.error || 'Não foi possível salvar.');
    } finally { lock.current = false; setSaving(false); }
  }

  async function archive(item) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setFailure('');
    try {
      const approved = await confirm({
        title: 'Arquivar produto?', message: `“${item.name}” sai do catálogo. Os orçamentos já feitos não mudam.`,
        confirmText: 'Arquivar produto',
      });
      if (!approved) return;
      await api.delete(`${limits.catalogPath}/${item.id}`);
      setItems((current) => current.filter((product) => product.id !== item.id));
      if (editor?.id === item.id) close();
    } catch (error) {
      setFailure(error.response?.data?.error || 'Não foi possível arquivar.');
    } finally { lock.current = false; setSaving(false); }
  }

  return (
    <section className="quote-wizard product-board">
      <header className="quote-heading product-board-header">
        <div><h1>Produtos</h1><p>Salve os itens e preços que usa nos orçamentos.</p></div>
        <button className="quote-button quote-button--primary" disabled={saving || !items} onClick={() => open()} ref={createTrigger} type="button">Novo produto</button>
      </header>
      {failure && !editor && <p role="alert">{failure}</p>}
      {editor && <form onSubmit={save} className="quote-card product-editor">
        <h2>{editor.id ? 'Editar produto' : 'Novo produto'}</h2>
        <label className="quote-field"><span>Nome do produto</span><input maxLength={limits.maximumNameLength} ref={nameInput} required value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></label>
        <label className="quote-field"><span>Preço padrão (R$)</span><input type="number" min="0.01" max={limits.maximumPrice} step="0.01" inputMode="decimal" required value={editor.price} onChange={(event) => setEditor({ ...editor, price: event.target.value })} /></label>
        <div className="product-photo-field">
          <ProductThumbnail photo={previewPhoto} preview />
          <div>
            <label className="quote-field"><span>Foto do produto (opcional)</span><input
              type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              aria-describedby="product-photo-help" aria-invalid={photoError ? true : undefined} disabled={saving}
              onChange={(event) => { void choosePhoto(event.target.files?.[0]); event.target.value = ''; }}
            /></label>
            <p className="quote-help" id="product-photo-help">JPG, PNG ou WebP, até 12 MB.</p>
            {preparingPhoto && <p className="quote-help" role="status">Preparando a miniatura…</p>}
            {photoError && <p className="product-form-error" role="alert">{photoError}</p>}
            {(newPhoto || (newPhoto === undefined && editor.photo_version)) && <button
              className="quote-action-link" disabled={saving} type="button"
              onClick={() => { resetPhoto(); setNewPhoto(null); }}
            >Remover foto</button>}
          </div>
        </div>
        {failure && <p className="product-form-error" role="alert">{failure}</p>}
        <div className="product-actions"><button className="quote-button" disabled={saving} type="button" onClick={close}>Cancelar</button><button className="quote-button quote-button--primary" disabled={saving || preparingPhoto} type="submit">Salvar produto</button></div>
      </form>}
      <section className="quote-card product-list" aria-labelledby="product-catalog">
        <h2 id="product-catalog">Catálogo de produtos</h2>
        {items === null ? (failure
          ? <button className="quote-button" type="button" onClick={() => { setFailure(''); setRetry((n) => n + 1); }}>Tentar novamente</button>
          : <p role="status">Carregando produtos…</p>) : items.length ? (
          <><ul className="product-rows">{visible.map((item) => (
            <li key={item.id}><div className="product-row-lead"><ProductThumbnail photo={photos[item.id]} /><div><strong>{item.name}</strong><span>{formatCurrency(item.price)}</span></div></div>
              <div className="product-actions">
                <button className="quote-button" type="button" aria-label={`Editar ${item.name}`} onClick={() => open(item)} disabled={saving}>Editar</button>
                <button className="quote-action-link" type="button" aria-label={`Arquivar ${item.name}`} onClick={() => archive(item)} disabled={saving}>Arquivar</button>
              </div></li>
          ))}</ul><PaginationControls currentPage={currentPage} onPageChange={setPage} totalPages={totalPages} /></>
        ) : <p className="quote-help">Nenhum produto ainda. Use “Novo produto” para salvar o primeiro.</p>}
      </section>
      <Link className="quote-action-link" to="/budgets/new">Criar orçamento</Link>
    </section>
  );
}
