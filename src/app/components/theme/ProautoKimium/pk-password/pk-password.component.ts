import {
  Component, ChangeDetectorRef, inject, input,
  Optional, Self
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule, ReactiveFormsModule, NgControl,
  ControlValueAccessor, Validator,
  AbstractControl, ValidationErrors
} from '@angular/forms';
import { PasswordModule } from 'primeng/password';

@Component({
  selector: 'pk-password',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PasswordModule],
  templateUrl: './pk-password.component.html',
  styleUrl: './pk-password.component.scss',
})
export class PkPasswordComponent implements ControlValueAccessor, Validator {
  private cdr = inject(ChangeDetectorRef);

  // ── Inputs visuais ────────────────────────────────────────
  label       = input<string>('');
  placeholder = input<string>('');
  feedback    = input<boolean>(false);
  pkRequired  = input<boolean>(false);
  errorMsg    = input<string>('');

  /**
   * Sem isto o navegador trata todo campo de senha como login e preenche a
   * credencial salva do usuário. Em tela de login é o certo; em senha de
   * documento é vazamento: a senha pessoal vai preenchida para uma requisição
   * que não é de login.
   *
   * Nesses casos use **`new-password`**, não `off` — o Chrome ignora `off` em
   * campo de senha, porque sites abusaram do atributo.
   */
  autocomplete = input<string>('current-password');

  // ── Estado interno ────────────────────────────────────────
  innerValue = '';
  isDisabled = false;

  // ── CVA callbacks ─────────────────────────────────────────
  private onChange  = (_: any) => {};
  private onTouched = () => {};

  constructor(@Optional() @Self() public ngControl: NgControl) {
    if (ngControl) ngControl.valueAccessor = this;
  }

  // ── ControlValueAccessor ──────────────────────────────────
  writeValue(val: any): void { this.innerValue = val ?? ''; this.cdr.markForCheck(); }
  registerOnChange(fn: any): void  { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.isDisabled = disabled; this.cdr.markForCheck(); }

  onModelChange(val: string): void {
    this.innerValue = val ?? '';
    this.onChange(this.innerValue);
    this.onTouched();
  }

  validate(_: AbstractControl): ValidationErrors | null { return null; }

  // ── Erro ──────────────────────────────────────────────────
  get showError(): boolean {
    const ctrl = this.ngControl?.control;
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  get resolvedError(): string {
    if (this.errorMsg()) return this.errorMsg();
    const errors = this.ngControl?.control?.errors;
    if (!errors) return '';
    if (errors['required'])         return 'Campo obrigatório';
    if (errors['minlength'])        return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    if (errors['passwordMismatch']) return 'As senhas não coincidem';
    return 'Campo inválido';
  }
}
