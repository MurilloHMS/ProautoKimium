import { directionsLinks, formatAddress, isUsableAddress, looksSwapped, maskZip, mapEmbedUrl, onlyZipDigits, parseCoordinates } from './address';
import { Address } from '../models/address.model';

const matriz: Address = {
  zipCode: '87020-900', street: 'Av. Colombo', number: '5790', complement: 'Bloco A',
  district: 'Zona 7', city: 'Maringá', state: 'pr',
};

const PONTO = { latitude: -23.422847, longitude: -51.93205 };

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
  });

  // O primeiro formato usava `dropoff[formatted_address]`, do widget aposentado.
  // O Uber não recusa parâmetro que não conhece: abria o app com a origem e o
  // destino em branco. O link de hoje leva `drop[0]` com um `Location` em JSON.
  it('manda o destino do Uber como Location em JSON, e não pelo formato do widget antigo', () => {
    const l = directionsLinks('Av. Colombo, 5790 - Zona 7, Maringá - PR', PONTO);

    expect(l.uber).not.toContain('dropoff');
    const destino = JSON.parse(new URL(l.uber!).searchParams.get('drop[0]')!);
    expect(destino.addressLine1).toBe('Av. Colombo, 5790 - Zona 7, Maringá - PR');
  });

  // A documentação é explícita: `addressLine2` "will not override the
  // latitude/longitude". O texto é o rótulo do pino; quem localiza é o par de
  // números. Sem eles o app abre pedindo o destino — foi o que ele viu no
  // iPhone em 2026-09-19.
  it('leva o ponto do mapa para o Uber, que não roteia por texto', () => {
    const destino = JSON.parse(new URL(directionsLinks('Av. Colombo', PONTO).uber!).searchParams.get('drop[0]')!);

    expect(destino.latitude).toBe(-23.422847);
    expect(destino.longitude).toBe(-51.93205);
  });

  it('sem coordenadas não oferece o Uber, em vez de oferecer um botão que abre vazio', () => {
    const l = directionsLinks('Av. Colombo, 5790 - Zona 7, Maringá - PR');

    expect(l.uber).toBeNull();
    // Os outros três procuram por texto e continuam valendo.
    expect(l.waze).toContain('Av.%20Colombo');
    expect(l.googleMaps).toContain('Av.%20Colombo');
    expect(l.appleMaps).toContain('Av.%20Colombo');
  });

  it('um & no nome do lugar não quebra a URL', () => {
    expect(directionsLinks('Rua A & B, Maringá').waze).toContain('Rua%20A%20%26%20B');
  });
});

describe('mapEmbedUrl', () => {

  it('usa o embed sem chave', () => {
    expect(mapEmbedUrl('Maringá - PR')).toBe('https://maps.google.com/maps?q=Maring%C3%A1%20-%20PR&z=16&output=embed');
  });

  it('com o ponto, aponta a coordenada em vez de buscar pelo texto', () => {
    // Busca por texto às vezes cai no centro da cidade; a coordenada é o ponto.
    expect(mapEmbedUrl('Av. Colombo, 5790', PONTO))
      .toBe('https://maps.google.com/maps?q=-23.422847%2C-51.93205&z=17&output=embed');
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

/**
 * O ponto digitado à mão.
 *
 * Existe porque o Nominatim não conhece toda rua — medido em 2026-09-22 com
 * `Avenida João do Prado, Santo André - SP`, que o OpenStreetMap não tem e o
 * Google tem.
 */
describe('parseCoordinates', () => {

  it('entende o par que o Google Maps copia', () => {
    expect(parseCoordinates('-23.652345, -46.456789'))
      .toEqual({ latitude: -23.652345, longitude: -46.456789 });
  });

  it('entende sem espaço e com ponto-e-vírgula', () => {
    expect(parseCoordinates('-23.652,-46.456')).toEqual({ latitude: -23.652, longitude: -46.456 });
    expect(parseCoordinates('-23.652; -46.456')).toEqual({ latitude: -23.652, longitude: -46.456 });
  });

  /** É o que costuma estar na área de transferência, mais que o par solto. */
  it('extrai o par de uma URL do Google Maps', () => {
    expect(parseCoordinates('https://www.google.com/maps/@-23.652345,-46.456789,17z'))
      .toEqual({ latitude: -23.652345, longitude: -46.456789 });
  });

  it('extrai o par de uma URL com q=', () => {
    expect(parseCoordinates('https://maps.google.com/?q=-23.652,-46.456'))
      .toEqual({ latitude: -23.652, longitude: -46.456 });
  });

  /**
   * <b>Fora de URL, o texto tem que casar inteiro.</b>
   *
   * Sem essa exigência `Rua 25, 30` — pedaço de endereço colado por engano —
   * vira um ponto no Egito. E o `looksSwapped` não salva: nem `25,30` nem
   * `30,25` caem no Brasil, então ele não tem o que acusar.
   *
   * Medido em 2026-09-22: o `17z` do zoom, que eu supunha ser o caso
   * perigoso, não engana forma nenhuma.
   */
  it('recusa pedaço de endereço que parece um par', () => {
    expect(parseCoordinates('Rua 25, 30')).toBeNull();
  });

  it('arredonda em seis casas, como a coluna do banco', () => {
    expect(parseCoordinates('-23.6523456789, -46.4')!.latitude).toBe(-23.652346);
  });

  it('recusa o que não é coordenada', () => {
    expect(parseCoordinates('Avenida João do Prado, 300')).toBeNull();
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates(null)).toBeNull();
  });

  it('recusa número fora de faixa', () => {
    expect(parseCoordinates('-100, -46')).toBeNull();
    expect(parseCoordinates('-23, -200')).toBeNull();
  });

  /** 0,0 é o Golfo da Guiné, e quase sempre é campo vazio virando número. */
  it('recusa o par zerado', () => {
    expect(parseCoordinates('0, 0')).toBeNull();
  });
});

describe('looksSwapped', () => {

  it('o ponto certo de Santo André não parece trocado', () => {
    expect(looksSwapped({ latitude: -23.652, longitude: -46.456 })).toBeFalse();
  });

  /**
   * O erro mais comum de quem digita à mão, e o único totalmente silencioso:
   * `-46.45, -23.65` é válido e cai no Atlântico.
   */
  it('acusa a latitude e a longitude trocadas', () => {
    expect(looksSwapped({ latitude: -46.456, longitude: -23.652 })).toBeTrue();
  });

  /** Só acusa quando inverter resolve — endereço fora do Brasil não é erro. */
  it('não acusa um ponto legitimamente fora do Brasil', () => {
    expect(looksSwapped({ latitude: 38.7223, longitude: -9.1393 })).toBeFalse();
  });
});
