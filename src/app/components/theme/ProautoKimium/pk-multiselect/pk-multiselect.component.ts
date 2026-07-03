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
import { MultiSelectModule } from 'primeng/multiselect';

@Component({
  selector: 'pk-multiselect',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MultiSelectModule],
  templateUrl: './pk-multiselect.component.html',
  styleUrl: './pk-multiselect.component.scss',
})
export class PkMultiselectComponent implements ControlValueAccessor, Validator {
  private cdr = inject(ChangeDetectorRef);

  // ── Inputs visuais ────────────────────────────────────────
  label       = input<string>('');
  placeholder = input<string>('Selecione');
  options     = input<any[]>([]);
  optionLabel = input<string>('label');
  optionValue = input<string>('value');
  display     = input<'chip' | 'comma'>('chip');
  filter      = input<boolean>(true);
  pkRequired  = input<boolean>(false);
  errorMsg    = input<string>('');

  // ── Estado interno ────────────────────────────────────────
  innerValue: any[] = [];
  isDisabled = false;

  // ── CVA callbacks ─────────────────────────────────────────
  private onChange  = (_: any) => {};
  private onTouched = () => {};

  constructor(@Optional() @Self() public ngControl: NgControl) {
    if (ngControl) ngControl.valueAccessor = this;
  }

  // ── ControlValueAccessor ──────────────────────────────────
  writeValue(val: any): void { this.innerValue = val ?? []; this.cdr.markForCheck(); }
  registerOnChange(fn: any): void  { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.isDisabled = disabled; this.cdr.markForCheck(); }

  onModelChange(val: any[]): void {
    this.innerValue = val ?? [];
    this.onChange(this.innerValue);
    this.onTouched();
  }

  validate(_: AbstractControl): ValidationErrors | null { return null; }

  // ── Erro ──────────────────────────────────────────────────
  get showError(): boolean {
    const ctrl = this.ngControl?.control;
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  get resolvedStyleClass(): string {
    return this.showError ? 'pk-multiselect pk-multiselect--error' : 'pk-multiselect';
  }

  get resolvedError(): string {
    if (this.errorMsg()) return this.errorMsg();
    const errors = this.ngControl?.control?.errors;
    if (!errors) return '';
    if (errors['required']) return 'Selecione ao menos uma opção';
    return 'Campo inválido';
  }
}
