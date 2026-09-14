import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';

import { Address } from '../../../../domain/models/address.model';
import { maskZip, onlyZipDigits } from '../../../../domain/utils/address';
import { ZipCodeService } from '../../../../infrastructure/services/address/zip-code.service';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';

/** O `FormGroup` que este componente preenche. Quem usa cria com `addressGroup`. */
export function addressGroup(fb: FormBuilder, value?: Address | null): FormGroup {
  return fb.group({
    zipCode: [value?.zipCode ?? '', [Validators.pattern(/^$|^\d{5}-?\d{3}$/)]],
    street: [value?.street ?? '', [Validators.maxLength(150)]],
    number: [value?.number ?? '', [Validators.maxLength(20)]],
    complement: [value?.complement ?? '', [Validators.maxLength(100)]],
    district: [value?.district ?? '', [Validators.maxLength(100)]],
    city: [value?.city ?? '', [Validators.maxLength(100)]],
    state: [value?.state ?? '', [Validators.pattern(/^$|^[A-Za-z]{2}$/)]],
  });
}

/** Do formulário para a API: campo em branco vai `null`. */
export function addressFromGroup(group: FormGroup): Address {
  const v = group.getRawValue();
  const limpo = (x: string | null | undefined) => (x ?? '').trim() || null;
  return {
    zipCode: limpo(v.zipCode),
    street: limpo(v.street),
    number: limpo(v.number),
    complement: limpo(v.complement),
    district: limpo(v.district),
    city: limpo(v.city),
    state: limpo(v.state)?.toUpperCase() ?? null,
  };
}

/**
 * Os campos de endereço, iguais na empresa do RH, no evento e na palestra.
 *
 * **O CEP preenche o resto**, e só o que estiver vazio: quem corrigiu a rua à
 * mão e depois mexeu no CEP não perde a correção. Número e complemento nunca
 * vêm do CEP.
 */
@Component({
  selector: 'app-address-fields',
  standalone: true,
  imports: [ReactiveFormsModule, PkInputComponent],
  templateUrl: './address-fields.component.html',
  styleUrl: './address-fields.component.scss',
})
export class AddressFieldsComponent implements OnInit {
  private readonly zip = inject(ZipCodeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly group = input.required<FormGroup>();
  /** Na palestra fora da empresa, rua e cidade são obrigatórias. */
  readonly required = input(false);

  readonly buscando = signal(false);
  readonly naoEncontrado = signal(false);

  ngOnInit(): void {
    const cep = this.group().get('zipCode')!;

    cep.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      filter(v => {
        this.naoEncontrado.set(false);
        return !!onlyZipDigits(v);
      }),
      switchMap(v => {
        this.buscando.set(true);
        return this.zip.lookup(v);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(achado => {
      this.buscando.set(false);
      if (!achado) {
        this.naoEncontrado.set(true);
        return;
      }
      this.preencherVazios(achado);
    });
  }

  aoDigitarCep(event: Event): void {
    const campo = event.target as HTMLInputElement;
    const mascarado = maskZip(campo.value);
    if (mascarado !== campo.value) campo.value = mascarado;
  }

  private preencherVazios(achado: Partial<Address>): void {
    const g = this.group();
    for (const campo of ['street', 'district', 'city', 'state'] as const) {
      const controle = g.get(campo)!;
      if (!(controle.value ?? '').trim() && achado[campo]) {
        controle.setValue(achado[campo]);
        controle.markAsDirty();
      }
    }
  }
}
