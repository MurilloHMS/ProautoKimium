import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { EquipmentAssignmentService } from '../../../../infrastructure/services/hr/equipment-assignment.service';
import { EmployeeService } from '../../../../infrastructure/services/partners/employee/employee.service';
import { EquipmentAssignment } from '../../../../domain/models/hr/equipment-assignment.model';

@Component({
  selector: 'app-hr-equipment-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, SelectModule, DatePickerModule, Toast, PkButtonComponent, PkDialogComponent, PkTableComponent],
  templateUrl: './hr-equipment-assignments.component.html',
  styleUrl: './hr-equipment-assignments.component.scss',
  providers: [MessageService],
})
export class HrEquipmentAssignmentsComponent implements OnInit {
  assignments: EquipmentAssignment[] = [];
  loading = false;
  employeeNames = new Map<string, string>();
  employeeOptions: { label: string; value: string }[] = [];

  employeeFilter: string | null = null;

  deliverDialogVisible = false;
  deliverEmployeeId: string | null = null;
  deliverEquipmentType = '';
  deliverDescription = '';
  deliverDeliveredAt: Date = new Date();
  deliverNotes = '';
  deliverSaving = false;

  returnDialogVisible = false;
  returnTarget: EquipmentAssignment | null = null;
  returnDate: Date = new Date();
  returnSaving = false;

  constructor(
    private equipmentService: EquipmentAssignmentService,
    private employeeService: EmployeeService,
    private msgService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadEmployees();
    this.load();
  }

  loadEmployees(): void {
    this.employeeService.getEmployes().subscribe({
      next: (list) => {
        const withId = list.filter((e) => e.id);
        this.employeeNames = new Map(withId.map((e) => [e.id as string, e.name]));
        this.employeeOptions = withId.map((e) => ({ label: e.name, value: e.id as string }));
      },
      error: () => {
        this.employeeNames = new Map();
        this.employeeOptions = [];
      },
    });
  }

  employeeName(employeeId: string): string {
    return this.employeeNames.get(employeeId) ?? employeeId;
  }

  load(): void {
    this.loading = true;
    const source = this.employeeFilter
      ? this.equipmentService.getByEmployee(this.employeeFilter)
      : this.equipmentService.listCurrentlyWithEmployees();

    source.subscribe({
      next: (list) => {
        this.assignments = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  get listTitle(): string {
    return this.employeeFilter ? `Histórico — ${this.employeeName(this.employeeFilter)}` : 'Equipamentos em posse';
  }

  formatDate(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  // ---- Entregar ----

  showDeliverDialog(): void {
    this.deliverEmployeeId = this.employeeFilter;
    this.deliverEquipmentType = '';
    this.deliverDescription = '';
    this.deliverDeliveredAt = new Date();
    this.deliverNotes = '';
    this.deliverDialogVisible = true;
  }

  get canConfirmDeliver(): boolean {
    return !!this.deliverEmployeeId && this.deliverEquipmentType.trim().length > 0 && !!this.deliverDeliveredAt;
  }

  confirmDeliver(): void {
    if (!this.canConfirmDeliver) return;

    this.deliverSaving = true;
    this.equipmentService.deliver({
      employeeId: this.deliverEmployeeId as string,
      equipmentType: this.deliverEquipmentType.trim(),
      description: this.deliverDescription.trim(),
      deliveredAt: this.toIsoDate(this.deliverDeliveredAt),
      notes: this.deliverNotes.trim(),
    }).subscribe({
      next: () => {
        this.deliverSaving = false;
        this.deliverDialogVisible = false;
        this.load();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Equipamento registrado com sucesso!' });
      },
      error: (err) => {
        this.deliverSaving = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  // ---- Devolver ----

  openReturn(assignment: EquipmentAssignment): void {
    this.returnTarget = assignment;
    this.returnDate = new Date();
    this.returnDialogVisible = true;
  }

  confirmReturn(): void {
    if (!this.returnTarget || !this.returnDate) return;

    this.returnSaving = true;
    this.equipmentService.returnEquipment(this.returnTarget.id, { returnedAt: this.toIsoDate(this.returnDate) }).subscribe({
      next: () => {
        this.returnSaving = false;
        this.returnDialogVisible = false;
        this.load();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Devolução registrada!' });
      },
      error: (err) => {
        this.returnSaving = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 400: return 'Requisição inválida';
      case 401: return 'Não autorizado. Faça login novamente';
      case 403: return 'Você não tem permissão para esta ação';
      case 404: return 'Recurso não encontrado';
      case 409: return 'Registro já existe';
      case 422: return 'Dados inválidos';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
