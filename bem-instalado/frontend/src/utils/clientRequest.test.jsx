import { describe, expect, it } from 'vitest';
import { buildClientRequestTrackingHash, readClientRequestTrackingHash } from './clientRequest';

describe('acompanhamento de pedido', () => {
  it('cria e recupera um link seguro de acompanhamento', () => {
    const token = '1234567890abcdef1234567890abcdef1234567890abcdef';
    const hash = buildClientRequestTrackingHash({ id: 42, client_access_token: token });
    expect(hash).toContain('pedido=42');
    expect(readClientRequestTrackingHash(hash)).toMatchObject({
      id: 42,
      client_access_token: token,
    });
  });

  it('rejeita identificador ou token incompleto', () => {
    expect(readClientRequestTrackingHash('#pedido=0&acesso=curto')).toBeNull();
  });
});
