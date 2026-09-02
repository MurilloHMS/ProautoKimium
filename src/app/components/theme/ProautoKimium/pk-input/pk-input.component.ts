import {
  Component, input, computed, viewChild, ElementRef,
  Optional, Self, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormsModule,
  NgControl,
  ControlValueAccessor,
  Validator,
  AbstractControl, ValidationErrors,
  NG_VALIDATORS
} from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

import { mascararDecimal, formatarDecimal } from '../../../../domain/utils/decimal-br';
import { mascararTelefone } from '../../../../domain/utils/telefone-br';

export type PkInputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'search';

@Component({
  selector: 'pk-input',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputTextModule],
  templateUrl: './pk-input.component.html',
  styleUrl: './pk-input.component.scss',
})
export class PkInputComponent implements ControlValueAccessor, Validator {
  private cdr = inject(ChangeDetectorRef);

  // ── Inputs visuais ────────────────────────────────────────
  label       = input<string>('');
  placeholder = input<string>('');
  type        = input<PkInputType>('text');
  icon        = input<string>('');
  iconPos     = input<'left' | 'right'>('left');
  hint        = input<string>('');
  pkRequired  = input<boolean>(false);
  pkReadonly  = input<boolean>(false);
  errorMsg    = input<string>('');

  /**
   * Liga a máscara decimal em português, com este número de casas.
   *
   * Com ela o campo vai preenchendo os decimais da direita para a esquerda
   * enquanto se digita — 3, 37, 379 viram 0,03, 0,37, 3,79 — e a vírgula
   * aparece sozinha, que é como se escreve número no Brasil.
   *
   * `null` (o padrão) deixa o campo exatamente como sempre foi.
   */
  pkDecimals  = input<number | null>(null);

  /**
   * Liga a mascara de telefone brasileiro: `(11) 95778-2766`, montada
   * enquanto se digita. Nao combina com `pkDecimals` — os dois disputariam o
   * mesmo texto, e a decimal ganha por vir antes.
   */
  pkTelefone  = input<boolean>(false);

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  // ── Estado interno ────────────────────────────────────────
  innerValue  = '';
  isDisabled  = false;

  // ── CVA callbacks ─────────────────────────────────────────
  private onChange   = (_: any) => {};
  private onTouched  = () => {};

  constructor(@Optional() @Self() public ngControl: NgControl) {
    if (ngControl) ngControl.valueAccessor = this;
  }

  // ── ControlValueAccessor ──────────────────────────────────
  writeValue(val: any): void {
    const casas = this.pkDecimals();
    if (casas !== null) {
      // Número e texto entram por caminhos diferentes, e tratar os dois igual
      // é errado por uma ordem de grandeza: a máscara só olha os dígitos, então
      // o número 10 viraria '0,10' e 3,5 viraria '0,35'. Passa despercebido
      // porque um preço de duas casas — 3,79 — acerta por coincidência.
      this.innerValue = typeof val === 'number'
        ? formatarDecimal(val, casas)
        : mascararDecimal(String(val ?? ''), casas);
      this.cdr.markForCheck();
      return;
    }

    if (this.pkTelefone()) {
      this.innerValue = mascararTelefone(String(val ?? ''));
      this.cdr.markForCheck();
      return;
    }

    let value = val ?? '';
    const max = this.pkMaxLength();
    if (max && value.length > max) {
      value = value.slice(0, max);
    }
    this.innerValue = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void   { this.onChange = fn; }
  registerOnTouched(fn: any): void  { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void {
    this.isDisabled = disabled;
    this.cdr.markForCheck();
  }

  onInput(val: string): void {
    const casas = this.pkDecimals();
    if (casas !== null) {
      this.aplicarMascara(mascararDecimal(val, casas));
      return;
    }

    if (this.pkTelefone()) {
      this.aplicarMascara(mascararTelefone(val));
      return;
    }

    const max = this.pkMaxLength();

    if (max !== null && val.length > max) {
      val = val.slice(0, max);
      this.innerValue = val;
      this.cdr.markForCheck();
      return;
    }

    this.innerValue = val;
    this.onChange(val);
  }

  /**
   * Escreve o texto mascarado, no estado e no elemento.
   *
   * O `[value]` sozinho nao basta: quando a mascara descarta o que foi
   * digitado — uma letra, um parentese a mais — o valor ligado nao muda, o
   * Angular nao reescreve o DOM, e o caractere recusado fica na tela.
   */
  private aplicarMascara(mascarado: string): void {
    this.innerValue = mascarado;

    const elemento = this.campo()?.nativeElement;
    if (elemento && elemento.value !== mascarado) elemento.value = mascarado;

    this.onChange(mascarado);
  }

  onBlur(): void {
    this.onTouched();
  }

  onKeydown(event: KeyboardEvent): void {
    const max = this.pkMaxLength();
    if (!max || this.type() !== 'number') return;

    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (allowedKeys.includes(event.key)) return;

    const input = event.target as HTMLInputElement;
    if (input.value.length >= max) {
      event.preventDefault();
    }
  }

  validate(control: AbstractControl): ValidationErrors | null {
    return null;
  }

  // ── Computed ──────────────────────────────────────────────
  hasIcon = computed(() => !!this.icon());

  /**
   * `number` recusa a vírgula — é justamente o que obrigava a digitar ponto.
   * Com a máscara ligada o campo vira `text`, e o `inputmode` abaixo é o que
   * mantém o teclado numérico no celular.
   */
  tipoEfetivo = computed(() => (this.pkDecimals() !== null ? 'text' : this.type()));

  /**
   * `decimal` em vez de `numeric`: os dois abrem o teclado de números, mas o
   * `decimal` traz a vírgula junto — e sem ela não há como digitar centavo.
   */
  modoDeEntrada = computed(() => (this.pkDecimals() !== null ? 'decimal' : null));

  get showError(): boolean {
    const ctrl = this.ngControl?.control;
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  get resolvedError(): string {
    if (this.errorMsg()) return this.errorMsg();
    const errors = this.ngControl?.control?.errors;
    if (!errors) return '';
    if (errors['required'])  return 'Campo obrigatório';
    if (errors['email'])     return 'E-mail inválido';
    if (errors['minlength']) return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    if (errors['pattern'])   return 'Formato inválido';
    return 'Campo inválido';
  }

  // Max length
  pkMaxLength = input<number | null>(null);

  get charCount(): number {
    return this.innerValue?.length ?? 0;
  }

  get isNearLimit(): boolean {
    const max = this.pkMaxLength();
    if (!max) return false;
    return this.charCount >= max * 0.85;
  }

  get isAtLimit(): boolean {
    const max = this.pkMaxLength();
    if (!max) return false;
    return this.charCount >= max;
  }

  protected readonly matchMedia = matchMedia;
}
