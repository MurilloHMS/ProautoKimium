import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';

import { AddressFieldsComponent, addressFromGroup, addressGroup, addressPatch } from './address-fields.component';
import { GeocodingService } from '../../../../infrastructure/services/address/geocoding.service';
import { ZipCodeService } from '../../../../infrastructure/services/address/zip-code.service';
import { providersDeTeste } from '../../../../../testing/test-setup';

/** O app é zoneless e não carrega zone-testing: o debounce se espera de verdade. */
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('AddressFieldsComponent', () => {
  const zip = { lookup: jasmine.createSpy('lookup') };
  const geo = { lookup: jasmine.createSpy('lookup') };

  function montar(inicial: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      imports: [AddressFieldsComponent],
      providers: [
        ...providersDeTeste(),
        { provide: ZipCodeService, useValue: zip },
        { provide: GeocodingService, useValue: geo },
      ],
    });
    const group = addressGroup(TestBed.inject(FormBuilder), inicial as any);
    const fixture = TestBed.createComponent(AddressFieldsComponent);
    fixture.componentRef.setInput('group', group);
    fixture.detectChanges();
    return { fixture, group };
  }

  beforeEach(() => {
    zip.lookup.calls.reset();
    geo.lookup.calls.reset();
    geo.lookup.and.returnValue(of(null));
  });

  it('o CEP preenche rua, bairro, cidade e UF', async () => {
    zip.lookup.and.returnValue(of({ zipCode: '87020-900', street: 'Av. Colombo', district: 'Zona 7', city: 'Maringá', state: 'PR' }));
    const { group } = montar();

    group.get('zipCode')!.setValue('87020900');
    await esperar(400);

    expect(group.get('street')!.value).toBe('Av. Colombo');
    expect(group.get('city')!.value).toBe('Maringá');
    expect(group.get('state')!.value).toBe('PR');
  });

  /** Quem corrigiu a rua à mão e depois mexeu no CEP não perde a correção. */
  it('não sobrescreve o que já foi digitado', async () => {
    zip.lookup.and.returnValue(of({ street: 'Av. Colombo', district: 'Zona 7', city: 'Maringá', state: 'PR' }));
    const { group } = montar({ street: 'Avenida Colombo (portaria 2)' });

    group.get('zipCode')!.setValue('87020-900');
    await esperar(400);

    expect(group.get('street')!.value).toBe('Avenida Colombo (portaria 2)');
    expect(group.get('district')!.value).toBe('Zona 7');
  });

  it('CEP incompleto não consulta nada', async () => {
    const { group } = montar();

    group.get('zipCode')!.setValue('8702');
    await esperar(400);

    expect(zip.lookup).not.toHaveBeenCalled();
  });

  it('CEP que o ViaCEP não acha avisa, e deixa os campos livres', async () => {
    zip.lookup.and.returnValue(of(null));
    const { fixture, group } = montar();

    group.get('zipCode')!.setValue('99999999');
    await esperar(400);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('CEP não encontrado');
    expect(group.get('street')!.value).toBe('');
  });

  it('campo em branco vai nulo para a API, e a UF em maiúsculas', () => {
    const { group } = montar({ street: ' Av. Colombo ', city: 'Maringá', state: 'pr', number: ' ' });

    expect(addressFromGroup(group)).toEqual({
      zipCode: null, street: 'Av. Colombo', number: null, complement: null, district: null, city: 'Maringá', state: 'PR',
      latitude: null, longitude: null,
    });
  });

  // ── O ponto no mapa ─────────────────────────────────────────────────────────
  // Sem ele o Uber abre pedindo o destino: ele roteia por coordenada, e o
  // endereço em texto é só o rótulo do pino.

  it('endereço completo vira um ponto, que vai junto para a API', async () => {
    geo.lookup.and.returnValue(of({ latitude: -23.422847, longitude: -51.93205 }));
    const { group } = montar({ street: 'R. Néo Alves Martins', number: '2100' });

    group.get('city')!.setValue('Maringá');
    await esperar(1000);

    expect(geo.lookup).toHaveBeenCalledWith('R. Néo Alves Martins, 2100, Maringá');
    expect(addressFromGroup(group).latitude).toBe(-23.422847);
    expect(addressFromGroup(group).longitude).toBe(-51.93205);
  });

  it('sem rua ou sem cidade não gasta consulta no Nominatim', async () => {
    const { group } = montar();

    group.get('street')!.setValue('R. Néo Alves Martins');
    await esperar(1000);

    expect(geo.lookup).not.toHaveBeenCalled();
  });

  /**
   * O caso que mais importa: o pino do endereço anterior não pode sobrar. Se
   * sobrasse, o Uber abriria confiante no endereço errado — pior do que não
   * abrir.
   */
  it('trocar o endereço apaga o ponto antigo quando o novo não é encontrado', async () => {
    geo.lookup.and.returnValue(of({ latitude: -23.422847, longitude: -51.93205 }));
    const { fixture, group } = montar({ street: 'R. Néo Alves Martins', number: '2100' });

    group.get('city')!.setValue('Maringá');
    await esperar(1000);
    expect(addressFromGroup(group).latitude).toBe(-23.422847);

    geo.lookup.and.returnValue(of(null));
    group.get('street')!.setValue('Rua Que Não Existe');
    await esperar(1000);
    fixture.detectChanges();

    expect(addressFromGroup(group).latitude).toBeNull();
    expect(addressFromGroup(group).longitude).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Não encontramos este endereço no mapa');
  });

  it('mexer só no complemento não refaz a busca do ponto', async () => {
    geo.lookup.and.returnValue(of({ latitude: -23.422847, longitude: -51.93205 }));
    const { group } = montar({ street: 'R. Néo Alves Martins', number: '2100' });

    group.get('city')!.setValue('Maringá');
    await esperar(1000);
    expect(geo.lookup).toHaveBeenCalledTimes(1);

    // "Bloco A" não muda o ponto, e por isso fica de fora de `formatAddress`.
    group.get('complement')!.setValue('Bloco A');
    await esperar(1000);

    expect(geo.lookup).toHaveBeenCalledTimes(1);
    expect(addressFromGroup(group).latitude).toBe(-23.422847);
  });
  /**
   * O caso que ele encontrou na produção em 2026-09-21: a empresa já tinha
   * endereço (salvo antes da V107, portanto sem ponto), ele abriu, salvou, e o
   * Uber continuou sem aparecer. O componente só reagia a mudanças — o que já
   * estava no grupo ao montar nunca era localizado.
   */
  it('endereço que já vem preenchido é localizado ao montar', async () => {
    geo.lookup.and.returnValue(of({ latitude: -23.422847, longitude: -51.93205 }));
    const { group } = montar({ street: 'R. Néo Alves Martins', number: '2100', city: 'Maringá', state: 'PR' });

    await esperar(50);

    expect(geo.lookup).toHaveBeenCalledTimes(1);
    expect(addressFromGroup(group).latitude).toBe(-23.422847);
  });

  it('endereço que já vem com ponto não gasta consulta de novo', async () => {
    const { group } = montar({
      street: 'R. Néo Alves Martins', number: '2100', city: 'Maringá', state: 'PR',
      latitude: -23.422847, longitude: -51.93205,
    });

    await esperar(50);

    expect(geo.lookup).not.toHaveBeenCalled();
    expect(addressFromGroup(group).latitude).toBe(-23.422847);
  });

  it('endereço incompleto ao montar não consulta nada', async () => {
    montar({ street: 'R. Néo Alves Martins' });

    await esperar(50);

    expect(geo.lookup).not.toHaveBeenCalled();
  });

  /**
   * `reset` com um objeto parcial zera o que ficou de fora. Sem o ponto no
   * molde, editar o nome de uma empresa apagava a coordenada dela.
   */
  it('o molde do formulário carrega o ponto junto com o resto', () => {
    expect(addressPatch({
      zipCode: '87013-060', street: 'R. Néo Alves Martins', number: '2100', complement: null,
      district: 'Zona 01', city: 'Maringá', state: 'PR', latitude: -23.422847, longitude: -51.93205,
    })).toEqual({
      zipCode: '87013-060', street: 'R. Néo Alves Martins', number: '2100', complement: '',
      district: 'Zona 01', city: 'Maringá', state: 'PR', latitude: -23.422847, longitude: -51.93205,
    });
  });

  it('sem endereço, o molde vem vazio e sem ponto', () => {
    expect(addressPatch(null)).toEqual({
      zipCode: '', street: '', number: '', complement: '', district: '', city: '', state: '',
      latitude: null, longitude: null,
    });
  });
});
