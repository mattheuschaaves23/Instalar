import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPreciseBrowserPosition, describeGpsAddress, manualAddressFromGps } from './requestGeolocation';
import { buildManualLocation } from './requestAddress';

function gps() {
  let success;
  let failure;
  const geolocation = { watchPosition: vi.fn((onSuccess, onFailure) => {
    success = onSuccess; failure = onFailure; return 7;
  }), clearWatch: vi.fn() };
  return { geolocation, success: (position) => success(position), failure: (error) => failure(error) };
}
const position = (accuracy, latitude = -23.561414) => ({ coords: { latitude, longitude: -46.655881, accuracy } });
afterEach(() => vi.useRealTimers());

describe('GPS para endereço de instalação', () => {
  it('espera uma leitura de rua mais precisa, sem aceitar a primeira leitura de 150 m', async () => {
    vi.useFakeTimers();
    const mock = gps();
    const result = getPreciseBrowserPosition(null, { geolocation: mock.geolocation });
    expect(mock.geolocation.watchPosition.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });
    mock.success(position(150));
    expect(mock.geolocation.clearWatch).not.toHaveBeenCalled();
    mock.success(position(20));
    expect((await result).coords.accuracy).toBe(20);
    expect(mock.geolocation.clearWatch).toHaveBeenCalledWith(7);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('usa a melhor leitura disponível ao vencer o prazo, sem esperar indefinidamente', async () => {
    vi.useFakeTimers();
    const mock = gps();
    const result = getPreciseBrowserPosition(null, { geolocation: mock.geolocation, timeout: 1000 });
    mock.success(position(300)); mock.success(position(90)); mock.success(position(700));
    await vi.advanceTimersByTimeAsync(1000);
    expect((await result).coords.accuracy).toBe(90);
    expect(mock.geolocation.clearWatch).toHaveBeenCalledWith(7);
  });
  it('interrompe o GPS quando a pessoa muda de ideia e remove observador e prazo', async () => {
    vi.useFakeTimers();
    const mock = gps();
    const controller = new AbortController();
    const result = getPreciseBrowserPosition(controller.signal, { geolocation: mock.geolocation });
    const check = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await check;
    expect(mock.geolocation.clearWatch).toHaveBeenCalledWith(7);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('trata permissão negada e não atribui um endereço quando não recebe coordenadas válidas', async () => {
    vi.useFakeTimers();
    const mock = gps();
    const result = getPreciseBrowserPosition(null, { geolocation: mock.geolocation });
    const check = expect(result).rejects.toMatchObject({ code: 1 });
    mock.failure({ code: 1 });
    await check;
    const timeout = getPreciseBrowserPosition(null, { geolocation: mock.geolocation, timeout: 1000 });
    const timedOut = expect(timeout).rejects.toThrow('LOCATION_TIMEOUT');
    mock.success(position(10, 100));
    await vi.advanceTimersByTimeAsync(1000);
    await timedOut;
  });
  it('preserva rua e bairro sem usar número de um imóvel vizinho e exige rua para avançar', () => {
    const address = manualAddressFromGps({ street: 'Av. Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP', houseNumber: '1578', zipCode: '01310-200' });
    expect(address).toMatchObject({ street: 'Av. Paulista', neighborhood: 'Bela Vista', number: '' });
    expect(buildManualLocation(address).addressReference).toBe('Av. Paulista');
    expect(() => buildManualLocation(manualAddressFromGps({ city: 'São Paulo', state: 'SP', label: 'São Paulo' }))).toThrow(/rua/);
  });
  it('avisa quando o GPS é impreciso ou a rua não está mapeada', () => {
    expect(describeGpsAddress({ street: 'Rua Turquesa' }, 20)).toMatch(/Rua encontrada/);
    expect(describeGpsAddress({ street: 'Rua Turquesa' }, 800)).toMatch(/baixa precisão/);
    expect(describeGpsAddress({ street: 'Rua Turquesa' }, 50000)).toMatch(/50 km/);
    expect(describeGpsAddress({ street: 'Rua Turquesa' }, 50000)).toMatch(/pode estar incorreta.*use o CEP/);
    expect(describeGpsAddress({ street: 'Rua Turquesa' }, null)).toMatch(/baixa precisão/);
    expect(describeGpsAddress({ city: 'Palhoça' }, 20)).toMatch(/Informe a rua/);
  });
});
