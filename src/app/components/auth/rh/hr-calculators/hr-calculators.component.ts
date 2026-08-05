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
  BulkFuelResponse,
  BulkTransportVoucherResponse,
  CltPjComparisonResult,
  MealVoucherResult,
  TicketPriceAdjustmentResponse,
} from '../../../../domain/models/hr/calculator.model';
import * as XLSX from 'xlsx';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

type MainTab = 'transport' | 'vr' | 'clt-pj';
type TransportSub = 'municipal' | 'intermunicipal' | 'fuel' | 'adjustment';

@Component({
  selector: 'app-hr-calculators',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, SelectModule, Toast, PkButtonComponent, PkInputComponent, PageHeaderComponent],
  templateUrl: './hr-calculators.component.html',
  styleUrl: './hr-calculators.component.scss',
  providers: [MessageService],
})
export class HrCalculatorsComponent implements OnInit {
  activeTab = signal<MainTab>('transport');
  activeSub = signal<TransportSub>('municipal');

  tabs: { key: MainTab; label: string; icon: string }[] = [
    { key: 'transport', label: 'Transporte', icon: 'pi pi-car' },
    { key: 'vr', label: 'Vale Refeição', icon: 'pi pi-shopping-bag' },
    { key: 'clt-pj', label: 'CLT × PJ', icon: 'pi pi-chart-bar' },
  ];

  transportSubs: { key: TransportSub; label: string }[] = [
    { key: 'municipal', label: 'Municipal' },
    { key: 'intermunicipal', label: 'Intermunicipal' },
    { key: 'fuel', label: 'Combustível' },
    { key: 'adjustment', label: 'Reajuste' },
  ];

  employeeOptions: { label: string; value: string }[] = [];

  // Bulk VT
  bulkVtForm: FormGroup;
  bulkVtResult: BulkTransportVoucherResponse[] = [];
  bulkVtLoading = false;

  // Bulk Fuel
  bulkFuelForm: FormGroup;
  bulkFuelResult: BulkFuelResponse[] = [];
  bulkFuelLoading = false;

  // Fare Adjustment
  adjustmentForm: FormGroup;
  adjustmentResult: TicketPriceAdjustmentResponse | null = null;
  adjustmentLoading = false;
  adjustmentTypeOptions: { label: string; value: string }[] = [
    { label: 'Ônibus Municipal', value: 'MUNICIPAL_BUS' },
    { label: 'Ônibus Intermunicipal', value: 'INTERMUNICIPAL_BUS' },
  ];

  // VR (per-employee)
  vrForm: FormGroup;
  vrResult: MealVoucherResult | null = null;
  vrLoading = false;

  // CLT×PJ (per-employee)
  cltPjEmployeeId: string | null = null;
  cltPjResult: CltPjComparisonResult | null = null;
  cltPjLoading = false;

  constructor(
    private employeeService: EmployeeService,
    private calculatorService: PayrollCalculatorService,
    private fb: FormBuilder,
    private msgService: MessageService
  ) {
    this.bulkVtForm = this.fb.group({
      workingDays: [null, [Validators.required, Validators.min(1)]],
    });

    this.bulkFuelForm = this.fb.group({
      fuelPricePerLiter: [null, [Validators.required, Validators.min(0.01)]],
      workingDays: [null, [Validators.required, Validators.min(1)]],
    });

    this.adjustmentForm = this.fb.group({
      transportType: [null, Validators.required],
      newTicketPrice: [null, [Validators.required, Validators.min(0.01)]],
    });

    this.vrForm = this.fb.group({
      employeeId: [null, Validators.required],
      mealValue: [null, [Validators.required, Validators.min(0.01)]],
      workingDays: [null, [Validators.required, Validators.min(1)]],
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

  selectTab(tab: MainTab): void {
    this.activeTab.set(tab);
  }

  selectSub(sub: TransportSub): void {
    this.activeSub.set(sub);
  }

  // --- Bulk VT ---

  calculateBulkVt(): void {
    if (!this.bulkVtForm.valid) return;
    const sub = this.activeSub();
    const transportType = sub === 'municipal' ? 'MUNICIPAL_BUS' : 'INTERMUNICIPAL_BUS';

    this.bulkVtLoading = true;
    this.calculatorService.calculateBulkTransportVoucher({
      transportType: transportType as any,
      workingDays: this.bulkVtForm.value.workingDays,
    }).subscribe({
      next: (result) => {
        this.bulkVtLoading = false;
        this.bulkVtResult = result;
        if (result.length === 0) {
          this.msgService.add({ severity: 'info', summary: 'Sem resultados', detail: 'Nenhum funcionário com esse tipo de transporte cadastrado.' });
        }
      },
      error: (err) => {
        this.bulkVtLoading = false;
        this.bulkVtResult = [];
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  get bulkVtGrandTotal(): number {
    return this.bulkVtResult.reduce((sum, g) => sum + g.grandTotal, 0);
  }

  exportBulkVt(): void {
    const sub = this.activeSub();
    const rows = this.bulkVtResult.flatMap(g => g.employees.map(e => ({ CPF: e.document, Valor: e.totalAmount })));
    const prefix = sub === 'municipal' ? 'vt_municipal' : 'vt_intermunicipal';
    this.exportExcel(rows, prefix);
  }

  // --- Bulk Fuel ---

  calculateBulkFuel(): void {
    if (!this.bulkFuelForm.valid) return;

    this.bulkFuelLoading = true;
    this.calculatorService.calculateBulkFuel(this.bulkFuelForm.value).subscribe({
      next: (result) => {
        this.bulkFuelLoading = false;
        this.bulkFuelResult = result;
        if (result.length === 0) {
          this.msgService.add({ severity: 'info', summary: 'Sem resultados', detail: 'Nenhum funcionário com veículo cadastrado.' });
        }
      },
      error: (err) => {
        this.bulkFuelLoading = false;
        this.bulkFuelResult = [];
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  get bulkFuelGrandTotal(): number {
    return this.bulkFuelResult.reduce((sum, g) => sum + g.grandTotal, 0);
  }

  exportBulkFuel(): void {
    const rows = this.bulkFuelResult.flatMap(g => g.employees.map(e => ({ CPF: e.document, Valor: e.totalAmount })));
    this.exportExcel(rows, 'combustivel');
  }

  // --- Fare Adjustment ---

  adjustTicketPrices(): void {
    if (!this.adjustmentForm.valid) return;

    this.adjustmentLoading = true;
    this.calculatorService.adjustTicketPrices(this.adjustmentForm.value).subscribe({
      next: (result) => {
        this.adjustmentLoading = false;
        this.adjustmentResult = result;
        this.msgService.add({
          severity: 'success',
          summary: 'Reajuste aplicado',
          detail: `${result.affectedCount} funcionário(s) atualizado(s).`,
        });
      },
      error: (err) => {
        this.adjustmentLoading = false;
        this.adjustmentResult = null;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  // --- VR ---

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

  // --- CLT×PJ ---

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

  // --- Helpers ---

  private exportExcel(rows: { CPF: string; Valor: number }[], prefix: string): void {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    const now = new Date().toISOString().slice(0, 7);
    XLSX.writeFile(wb, `${prefix}_${now}.xlsx`);
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 400: return 'Requisição inválida';
      case 401: return 'Não autorizado. Faça login novamente';
      case 403: return 'Você não tem permissão para esta ação';
      case 404: return 'Funcionário não encontrado ou sem dados cadastrados';
      case 409: return err.error?.message ?? 'Funcionário sem dados necessários para o cálculo (refeições, histórico de carreira, etc.)';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
