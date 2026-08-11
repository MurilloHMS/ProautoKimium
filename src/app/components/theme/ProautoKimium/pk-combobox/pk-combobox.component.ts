import {
  Component, ChangeDetectorRef, inject, input, output,
  Optional, Self
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule, ReactiveFormsModule, NgControl,
  ControlValueAccessor, Validator,
  AbstractControl, ValidationErrors
} from '@angular/forms';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'pk-combobox',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SelectModule],
  templateUrl: './pk-combobox.component.html',
  styleUrl: './pk-combobox.component.scss',
})
export class PkComboboxComponent implements ControlValueAccessor, Validator {
  private cdr = inject(ChangeDetectorRef);

  label       = input<string>('');
  placeholder = input<string>('Selecione');
  options     = input<any[]>([]);
  optionLabel = input<string>('');
  optionValue = input<string>('');
  filter      = input<boolean>(false);
  showClear   = input<boolean>(false);
  pkRequired  = input<boolean>(false);
  errorMsg    = input<string>('');

  /**
   * `dense` tira a folga do campo de formulário: sem rótulo e sem rodapé de
   * erro, para caber numa toolbar ou dentro de uma célula de tabela, onde a
   * altura é a do controle e não a de um campo com legenda.
   */
  dense       = input<boolean>(false);

  changed = output<any>();

  innerValue: any = null;
  isDisabled = false;

  private onChange  = (_: any) => {};
  private onTouched = () => {};

  constructor(@Optional() @Self() public ngControl: NgControl) {
    if (ngControl) ngControl.valueAccessor = this;
  }

  writeValue(val: any): void {
    this.innerValue = val ?? null;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void  { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }

  setDisabledState(disabled: boolean): void {
    this.isDisabled = disabled;
    this.cdr.markForCheck();
  }

  onModelChange(val: any): void {
    this.innerValue = val;
    this.onChange(val);
    this.onTouched();
    this.changed.emit(val);
  }

  validate(_: AbstractControl): ValidationErrors | null { return null; }

  get showError(): boolean {
    const ctrl = this.ngControl?.control;
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  get resolvedStyleClass(): string {
    const classes = ['pk-combobox'];
    if (this.showError) classes.push('pk-combobox--error');
    if (this.dense()) classes.push('pk-combobox--dense');
    return classes.join(' ');
  }

  get resolvedError(): string {
    if (this.errorMsg()) return this.errorMsg();
    const errors = this.ngControl?.control?.errors;
    if (!errors) return '';
    if (errors['required']) return 'Selecione uma opção';
    return 'Campo inválido';
  }
}
