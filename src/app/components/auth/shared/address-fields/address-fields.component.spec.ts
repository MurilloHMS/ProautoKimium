import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';

import { AddressFieldsComponent, addressFromGroup, addressGroup } from './address-fields.component';
import { ZipCodeService } from '../../../../infrastructure/services/address/zip-code.service';
import { providersDeTeste } from '../../../../../testing/test-setup';

/** O app é zoneless e não carrega zone-testing: o debounce se espera de verdade. */
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('AddressFieldsComponent', () => {
  const zip = { lookup: jasmine.createSpy('lookup') };

  function montar(inicial: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [AddressFieldsComponent],
      providers: [...providersDeTeste(), { provide: ZipCodeService, useValue: zip }],
    });
    const group = addressGroup(TestBed.inject(FormBuilder), inicial as any);
    const fixture = TestBed.createComponent(AddressFieldsComponent);
    fixture.componentRef.setInput('group', group);
    fixture.detectChanges();
    return { fixture, group };
  }

  beforeEach(() => zip.lookup.calls.reset());

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
    });
  });
});
