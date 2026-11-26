import { useEffect, useState } from 'react';
import api from '../../services/api';
import limits from '../../../../shared/quoteProducts.json';

const JPEG_PREFIX = 'data:image/jpeg;base64,';
const photoTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const fold = (value) => String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLocaleLowerCase('pt-BR');

export function sortProducts(products) {
  return [...products].sort((a, b) => collator.compare(a.name, b.name) || a.id - b.id);
}

export function matchesProductName(name, query) {
  const label = fold(name);
  return fold(query).split(/\s+/).every((word) => label.includes(word));
}

export function useProductPhotos(products) {
  const key = products.filter((item) => item.photo_version)
    .slice(0, limits.catalogPageSize).map(({ id, photo_version: version }) => `${id}@${version}`).join(',');
  const [batch, setBatch] = useState({ key: '', photos: {} });
  useEffect(() => {
    if (!key) return undefined;
    const request = new AbortController();
    const ids = key.split(',').map((item) => item.split('@')[0]).join(',');
    api.get(`${limits.catalogPath}/photos`, { params: { ids }, signal: request.signal })
      .then(({ data }) => {
        if (!request.signal.aborted) setBatch({ key, photos: data ?? {} });
      })
      .catch(() => {}); // An unavailable thumbnail must not block adding products.
    return () => request.abort();
  }, [key]);
  return key === batch.key ? batch.photos : {};
}

export function isProductPhoto(value) {
  return typeof value === 'string' && value.startsWith(JPEG_PREFIX);
}

export async function prepareProductPhoto(file) {
  if (!file || !photoTypes.has(file.type) || !file.size) {
    throw new Error('Escolha uma foto JPG, PNG ou WebP.');
  }
  if (file.size > limits.photoInputBytes) throw new Error('A foto pode ter até 12 MB.');
  const resource = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const picture = new Image();
      picture.onload = () => resolve(picture);
      picture.onerror = () => reject(new Error('Não foi possível abrir a foto. Escolha outro arquivo.'));
      picture.src = resource;
    });
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height || width * height > 50_000_000) throw new Error('A foto é muito grande. Escolha uma versão menor.');
    const scale = Math.min(1, limits.photoEdge / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a foto neste navegador.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.84, 0.64, 0.44]) {
      const photo = canvas.toDataURL('image/jpeg', quality);
      if (isProductPhoto(photo) && photo.length <= JPEG_PREFIX.length + 4 * Math.ceil(limits.photoBytes / 3)) return photo;
    }
    throw new Error('Não foi possível reduzir o tamanho da foto.');
  } finally {
    URL.revokeObjectURL(resource);
  }
}
