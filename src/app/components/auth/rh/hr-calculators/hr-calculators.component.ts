import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { EmployeeService } from '../../../../infrastructure/services/partners/employee/employee.service';
import { PayrollCalculatorService } from '../../../../infrastructure/services/hr/payroll-calculator.service';
import {
  CltPjComparisonResult,
  FuelResult,
  MealVoucherResult,
  TransportationVoucherResult,
} from '../../../../domain/models/hr/calculator.model';

type CalculatorSection = 'vt' | 'vr' | 'fuel' | 'clt-pj';

@Component({
  selector: 'app-hr-calculators',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, SelectModule, Toast, PkButtonComponent, PkInputComponent],
  templateUrl: './hr-calculators.component.html',
  styleUrl: './hr-calculators.component.scss',
  providers: [MessageService],
})
export class HrCalculatorsComponent implements OnInit {
  activeSection = signal<CalculatorSection>('vt');

  sections: { key: CalculatorSection; label: string; icon: string }[] = [
    { key: 'vt', label: 'Vale Transporte', icon: 'pi pi-car' },
    { key: 'vr', label: 'Vale Refeição', icon: 'pi pi-utensils' },
    { key: 'fuel', label: 'Combustível', icon: 'pi pi-gauge' },
    { key: 'clt-pj', label: 'CLT × PJ', icon: 'pi pi-balance-scale' },
  ];

  employeeOptions: { label: string; value: string }[] = [];

  vtForm: FormGroup;
  vtResult: TransportationVoucherResult | null = null;
  vtLoading = false;

  vrForm: FormGroup;
  vrResult: MealVoucherResult | null = null;
  vrLoading = false;

  fuelForm: FormGroup;
  fuelResult: FuelResult | null = null;
  fuelLoading = false;

  cltPjEmployeeId: string | null = null;
  cltPjResult: CltPjComparisonResult | null = null;
  cltPjLoading = false;

  constructor(
    private employeeService: EmployeeService,
    private calculatorService: PayrollCalculatorService,
    private fb: FormBuilder,
    private msgService: MessageService
  ) {
    this.vtForm = this.fb.group({
      employeeId: [null, Validators.required],
      fareValue: [null, [Validators.required, Validators.min(0.01)]],
      workingDays: [null, [Validators.required, Validators.min(1)]],
    });

    this.vrForm = this.fb.group({
      employeeId: [null, Validators.required],
      mealValue: [null, [Validators.required, Validators.min(0.01)]],
      workingDays: [null, [Validators.required, Validators.min(1)]],
    });

    this.fuelForm = this.fb.group({
      employeeId: [null, Validators.required],
      distanceKm: [null, [Validators.required, Validators.min(0.01)]],
      vehicleConsumptionKmPerLiter: [null, [Validators.required, Validators.min(0.01)]],
      literPrice: [null, [Validators.required, Validators.min(0.01)]],
    });
  }

  ngOnInit(): void {
    this.employeeService.getEmployes().subscribe({
      next: (list) => {
        this.employeeOptions = list
          .filter((e) => e.id)
          .map((e) => ({ label: e.name, value: e.id as string }));
      },
      error: () => (this.employeeOptions = []),
    });
  }

  select(section: CalculatorSection): void {
    this.activeSection.set(section);
  }

  calculateVt(): void {
    if (!this.vtForm.valid) return;

    this.vtLoading = true;
    this.calculatorService.calculateTransportationVoucher(this.vtForm.value).subscribe({
      next: (result) => {
        this.vtLoading = false;
        this.vtResult = result;
      },
      error: (err) => {
        this.vtLoading = false;
        this.vtResult = null;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  calculateVr(): void {
    if (!this.vrForm.valid) return;

    this.vrLoading = true;
    this.calculatorService.calculateMealVoucher(this.vrForm.value).subscribe({
      next: (result) => {
        this.vrLoading = false;
        this.vrResult = result;
      },
      error: (err) => {
        this.vrLoading = false;
        this.vrResult = null;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  calculateFuel(): void {
    if (!this.fuelForm.valid) return;

    this.fuelLoading = true;
    this.calculatorService.calculateFuel(this.fuelForm.value).subscribe({
      next: (result) => {
        this.fuelLoading = false;
        this.fuelResult = result;
      },
      error: (err) => {
        this.fuelLoading = false;
        this.fuelResult = null;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  calculateCltPj(): void {
    if (!this.cltPjEmployeeId) return;

    this.cltPjLoading = true;
    this.calculatorService.compareCltPj(this.cltPjEmployeeId).subscribe({
      next: (result) => {
        this.cltPjLoading = false;
        this.cltPjResult = result;
      },
      error: (err) => {
        this.cltPjLoading = false;
        this.cltPjResult = null;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 400: return 'Requisição inválida';
      case 401: return 'Não autorizado. Faça login novamente';
      case 403: return 'Você não tem permissão para esta ação';
      case 404: return 'Funcionário não encontrado ou sem dados de folha cadastrados';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
