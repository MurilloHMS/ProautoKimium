import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs';

import { Address } from '../../../../domain/models/address.model';
import { Coordinates, coordinatesOf, formatAddress, isUsableAddress, maskZip, onlyZipDigits } from '../../../../domain/utils/address';
import { GeocodingService } from '../../../../infrastructure/services/address/geocoding.service';
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
    // Sem campo na tela: quem preenche é o Nominatim, e quem lê é o Uber e o
    // mapa. Ficam no grupo para ir junto no salvar e voltar junto no editar.
    latitude: [value?.latitude ?? null],
    longitude: [value?.longitude ?? null],
  });
}

/**
 * O molde para `form.reset()` / `patchValue()` de quem embute este grupo.
 *
 * Existe porque `reset` com objeto parcial **zera o que ficou de fora**: as
 * telas montavam o endereço campo a campo, esqueciam latitude e longitude, e
 * editar o nome de uma empresa apagava o ponto dela no mapa.
 */
export function addressPatch(a: Address | null | undefined): Record<string, unknown> {
  return {
    zipCode: a?.zipCode ?? '',
    street: a?.street ?? '',
    number: a?.number ?? '',
    complement: a?.complement ?? '',
    district: a?.district ?? '',
    city: a?.city ?? '',
    state: a?.state ?? '',
    latitude: a?.latitude ?? null,
    longitude: a?.longitude ?? null,
  };
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
    // Ou as duas ou nenhuma, como o CHECK da V107 exige.
    latitude: temPonto(v) ? v.latitude : null,
    longitude: temPonto(v) ? v.longitude : null,
  };
}

function temPonto(v: { latitude?: unknown; longitude?: unknown }): boolean {
  return typeof v.latitude === 'number' && typeof v.longitude === 'number';
}

/**
 * Os campos de endereço, iguais na empresa do RH, no evento e na palestra.
 *
 * **O CEP preenche o resto**, e só o que estiver vazio: quem corrigiu a rua à
 * mão e depois mexeu no CEP não perde a correção. Número e complemento nunca
 * vêm do CEP.
 *
 * **E o endereço pronto vira um ponto no mapa**, pelo Nominatim, guardado em
 * campos sem tela. É o que faz o Uber abrir no lugar certo — ele roteia por
 * coordenada, não por texto (ver `GeocodingService`). Endereço que o Nominatim
 * não acha é salvo sem ponto: o cadastro segue, e o botão do Uber é o único que
 * não aparece.
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
  private readonly geo = inject(GeocodingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly group = input.required<FormGroup>();
  /** Na palestra fora da empresa, rua e cidade são obrigatórias. */
  readonly required = input(false);

  readonly buscando = signal(false);
  readonly naoEncontrado = signal(false);

  /** O estado do ponto no mapa, para a linha de aviso embaixo dos campos. */
  readonly localizando = signal(false);
  readonly semPonto = signal(false);

  ngOnInit(): void {
    this.ligarBuscaDeCep();
    this.ligarBuscaDoPonto();
    this.localizarOQueJaVeio();
  }

  /**
   * O endereço que já estava no grupo quando a tela abriu também precisa de
   * ponto.
   *
   * Sem isto o componente só reagia a mudanças, e endereço salvo antes da V107
   * — que não tem coordenada — nunca ganhava uma: abrir o cadastro e salvar de
   * novo não adiantava, porque nada mudava. Foi o que ele encontrou na
   * produção em 2026-09-21.
   *
   * Quem já tem ponto é deixado em paz: a consulta seria desperdício, e trocar
   * um ponto conferido por outro do Nominatim seria pior.
   *
   * Na prática não briga com `ligarBuscaDoPonto`: as telas preenchem o
   * formulário **antes** de mostrá-lo, então este componente nasce depois do
   * `reset` e aquele fluxo nem chega a ver a mudança.
   */
  private localizarOQueJaVeio(): void {
    const atual = addressFromGroup(this.group());
    if (!isUsableAddress(atual) || coordinatesOf(atual)) return;

    this.localizando.set(true);
    this.geo.lookup(formatAddress(atual))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ponto => {
        this.localizando.set(false);
        this.semPonto.set(!ponto);
        if (ponto) this.gravarPonto(ponto);
      });
  }

  private ligarBuscaDeCep(): void {
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

  /**
   * O ponto é refeito sempre que o endereço muda de verdade.
   *
   * O gatilho é o texto formatado, e não cada tecla: trocar "Bloco A" no
   * complemento não move o pino, e `distinctUntilChanged` sobre o texto já
   * descarta isso — o complemento fica de fora de `formatAddress`. A espera de
   * 900 ms é maior que a do CEP porque aqui se digita rua e número seguidos, e
   * também porque o Nominatim é um serviço gratuito que pede parcimônia.
   *
   * **Coordenada velha é apagada antes da busca.** Sem isso, mudar a rua e o
   * Nominatim não achar a nova deixaria o pino da anterior — e o Uber abriria
   * confiante no endereço errado, que é pior do que não abrir.
   */
  private ligarBuscaDoPonto(): void {
    const g = this.group();

    g.valueChanges.pipe(
      map(() => formatAddress(addressFromGroup(g))),
      debounceTime(900),
      distinctUntilChanged(),
      tap(() => this.limparPonto()),
      filter(() => isUsableAddress(addressFromGroup(g))),
      switchMap(texto => {
        this.localizando.set(true);
        return this.geo.lookup(texto);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(ponto => {
      this.localizando.set(false);
      this.semPonto.set(!ponto);
      if (ponto) this.gravarPonto(ponto);
    });
  }

  private limparPonto(): void {
    this.semPonto.set(false);
    this.gravarPonto(null);
  }

  /** `emitEvent: false`: gravar o ponto não pode disparar outra busca. */
  private gravarPonto(ponto: Coordinates | null): void {
    const g = this.group();
    g.get('latitude')!.setValue(ponto?.latitude ?? null, { emitEvent: false });
    g.get('longitude')!.setValue(ponto?.longitude ?? null, { emitEvent: false });
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
