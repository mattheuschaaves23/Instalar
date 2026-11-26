// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import QuoteProductCatalog from './QuoteProductCatalog';
import api from '../../services/api';

vi.mock('../../services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }));

const product = (id, name, hasPhoto = false) => ({ id, name, price: '60.00', photo_version: hasPhoto ? 'test-revision' : null });

function Catalog({ products }) {
  const [selected, setSelected] = useState([]);
  return <QuoteProductCatalog products={products} selected={selected} onAdd={(item) => setSelected([...selected, { product_id: item.id }])} onReload={() => {}} />;
}

it('ordena os produtos em português e combina busca sem acento, seleção e foto', async () => {
  const view = render(<MemoryRouter><Catalog products={[product(1, 'Zebra'), product(2, 'Ágata', true), product(3, 'Linho 10'), product(4, 'Linho 2')]} /></MemoryRouter>);
  const list = () => screen.getByRole('list', { name: 'Produtos do catálogo' });
  expect(within(list()).getAllByRole('listitem').map((row) => row.querySelector('strong').textContent))
    .toEqual(['Ágata', 'Linho 2', 'Linho 10', 'Zebra']);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nome' }), { target: { value: 'agata' } });
  fireEvent.change(screen.getByLabelText('Foto'), { target: { value: 'with' } });
  expect(within(list()).getAllByRole('listitem')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar Ágata' }));
  fireEvent.change(screen.getByLabelText('Seleção'), { target: { value: 'added' } });
  expect(within(list()).getByText('Adicionado')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Seleção'), { target: { value: 'available' } });
  expect(screen.getByText('Nenhum produto com esses filtros.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(within(list()).getAllByRole('listitem')).toHaveLength(4);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/products/photos', expect.objectContaining({ params: { ids: '2' } })));
  view.unmount();
});

it('consulta miniaturas em lotes limitados à página visível', async () => {
  api.get.mockClear();
  const view = render(<MemoryRouter><Catalog products={Array.from({ length: 11 }, (_, i) => product(i + 1, `Papel ${i + 1}`, true))} /></MemoryRouter>);
  await waitFor(() => expect(api.get).toHaveBeenNthCalledWith(1, '/products/photos', expect.objectContaining({ params: { ids: '1,2,3,4,5,6,7,8' } })));
  fireEvent.click(screen.getByRole('button', { name: /^Próxima/ }));
  await waitFor(() => expect(api.get).toHaveBeenNthCalledWith(2, '/products/photos', expect.objectContaining({ params: { ids: '9,10,11' } })));
  view.unmount();
});
