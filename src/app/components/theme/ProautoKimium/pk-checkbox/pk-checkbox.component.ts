import {ChangeDetectorRef, Component, inject, input, Optional, Self} from '@angular/core';
import {Checkbox} from "primeng/checkbox";
import {
  AbstractControl,
  ControlValueAccessor,
  FormsModule,
  NgControl,
  ReactiveFormsModule, ValidationErrors,
  Validator
} from "@angular/forms";

@Component({
  selector: 'pk-checkbox',
    imports: [
        Checkbox,
        FormsModule,
        ReactiveFormsModule
    ],
  templateUrl: './pk-checkbox.component.html',
  styleUrl: './pk-checkbox.component.scss',
})

export class PkCheckboxComponent implements ControlValueAccessor, Validator {
  private cdr = inject(ChangeDetectorRef);

  label = input<string>('');
  description = input<string>('');
  inputId = input<string>('');

  innerValue = false;
  isDisabled = false;

  private onChange = (_: boolean) => {};
  private onTouched = () => {};

  constructor(@Optional() @Self() public ngControl: NgControl) {
    if (ngControl) {
      ngControl.valueAccessor = this;
    }
  }

  writeValue(value: boolean): void {
    this.innerValue = value ?? false;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.isDisabled = disabled;
    this.cdr.markForCheck();
  }

  onValueChange(value: boolean): void {
    this.innerValue = value;
    this.onChange(value);
    this.onTouched();
  }

  validate(control: AbstractControl): ValidationErrors | null {
    return null;
  }
}
