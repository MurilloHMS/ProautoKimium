import {
  Component, input, computed,
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
