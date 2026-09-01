import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { EquipmentAssignmentService } from '../../../../infrastructure/services/hr/equipment-assignment.service';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { EquipmentAssignment } from '../../../../domain/models/hr/equipment-assignment.model';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { formatDateBr } from '../../../../domain/utils/date-only';

@Component({
  selector: 'app-hr-equipment-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, SelectModule, DatePickerModule, Toast, PkButtonComponent, PkDialogComponent, FormScreenComponent, PkTableComponent, ToolbarComponent],
  templateUrl: './hr-equipment-assignments.component.html',
  styleUrl: './hr-equipment-assignments.component.scss',
  providers: [MessageService],
})
export class HrEquipmentAssignmentsComponent implements OnInit, TabDirtyCheck {

  /** Entrega em andamento avisa antes de fechar a aba. */
  isTabDirty(): boolean {
    return this.mode() === 'form' && !!this.deliverEmployeeId;
  }

  closeForm(): void {
    this.mode.set('grid');
  }

  assignments: EquipmentAssignment[] = [];
  loading = false;
  private readonly employeeStore = inject(EmployeeStore);
  /** Filtro da grade: inclui desligado, que continua tendo entrega no histórico. */
  readonly employeeOptions = this.employeeStore.options;
  /** Entrega nova: só para quem está na casa. */
  readonly deliverEmployeeOptions = this.employeeStore.activeOptions;

  employeeFilter: string | null = null;

  /** grade ou formulário de entrega. A devolução continua em diálogo: é confirmação. */
  readonly mode = signal<'grid' | 'form'>('grid');
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
    private msgService: MessageService
  ) {}

  ngOnInit(): void {
    this.employeeStore.load();
    this.load();
  }

  /** O nome vem do store: a entrega guarda o id, quem traduz é a lista compartilhada. */
  employeeName(employeeId: string): string {
    return this.employeeStore.nameOf(employeeId);
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
    return formatDateBr(iso);
  }

  // ---- Entregar ----

  showDeliverDialog(): void {
    this.deliverEmployeeId = this.employeeFilter;
    this.deliverEquipmentType = '';
    this.deliverDescription = '';
    this.deliverDeliveredAt = new Date();
    this.deliverNotes = '';
    this.mode.set('form');
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
        this.mode.set('grid');
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
