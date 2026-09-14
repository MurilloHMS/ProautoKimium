import { directionsLinks, formatAddress, isUsableAddress, maskZip, mapEmbedUrl, onlyZipDigits } from './address';
import { Address } from '../models/address.model';

const matriz: Address = {
  zipCode: '87020-900', street: 'Av. Colombo', number: '5790', complement: 'Bloco A',
  district: 'Zona 7', city: 'Maringá', state: 'pr',
};

describe('formatAddress', () => {

  it('monta o mesmo texto da API, sem o complemento', () => {
    // O complemento confunde a busca dos apps de rota e não muda o ponto.
    expect(formatAddress(matriz)).toBe('Av. Colombo, 5790 - Zona 7, Maringá - PR, 87020-900');
  });

  it('forma um texto usável mesmo sem número, bairro e CEP', () => {
    expect(formatAddress({ ...matriz, number: null, district: null, zipCode: '' })).toBe('Av. Colombo, Maringá - PR');
  });

  it('endereço vazio vira texto vazio', () => {
    expect(formatAddress(null)).toBe('');
  });
});

describe('isUsableAddress', () => {

  it('precisa de rua e cidade', () => {
    expect(isUsableAddress(matriz)).toBeTrue();
    expect(isUsableAddress({ ...matriz, city: ' ' })).toBeFalse();
    expect(isUsableAddress({ ...matriz, street: null })).toBeFalse();
  });
});

describe('directionsLinks', () => {

  it('codifica o endereço nos quatro apps', () => {
    const l = directionsLinks('Av. Colombo, 5790 - Zona 7, Maringá - PR');

    expect(l.waze).toBe('https://waze.com/ul?q=Av.%20Colombo%2C%205790%20-%20Zona%207%2C%20Maring%C3%A1%20-%20PR&navigate=yes');
    expect(l.googleMaps).toContain('query=Av.%20Colombo');
    expect(l.appleMaps).toContain('maps.apple.com/?q=Av.%20Colombo');
    // `dropoff[formatted_address]` com os colchetes codificados: sem isso o
    // Uber ignora o destino e abre só com a origem.
    expect(l.uber).toContain('dropoff%5Bformatted_address%5D=Av.%20Colombo');
  });

  it('um & no nome do lugar não quebra a URL', () => {
    expect(directionsLinks('Rua A & B, Maringá').waze).toContain('Rua%20A%20%26%20B');
  });
});

describe('mapEmbedUrl', () => {

  it('usa o embed sem chave', () => {
    expect(mapEmbedUrl('Maringá - PR')).toBe('https://maps.google.com/maps?q=Maring%C3%A1%20-%20PR&z=16&output=embed');
  });
});

describe('CEP', () => {

  it('aceita com e sem traço, e recusa incompleto', () => {
    expect(onlyZipDigits('87020-900')).toBe('87020900');
    expect(onlyZipDigits('87020900')).toBe('87020900');
    expect(onlyZipDigits('8702090')).toBeNull();
  });

  it('mascara enquanto se digita', () => {
    expect(maskZip('870')).toBe('870');
    expect(maskZip('87020')).toBe('87020');
    expect(maskZip('870209')).toBe('87020-9');
    expect(maskZip('87020-90099')).toBe('87020-900');
  });
});
