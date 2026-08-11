import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';

import {
  MACHINE_STATUS_LABEL,
  MACHINE_STATUS_SEVERITY,
  MACHINE_TYPE_LABEL,
  Machine,
  MachineStatus,
  MachineType,
  machineStatusOptions,
  machineTypeOptions,
} from '../../../../domain/models/prostock/machine.model';
import { MachineStore } from '../../../../infrastructure/state/machine.store';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkCheckboxComponent } from '../../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';

/**
 * Catálogo de máquinas — deliberadamente simples.
 *
 * São sete itens na prática (CAPÔ NT 300, FRONTAL NT 210, ESTEIRA NT 810…), e o
 * trabalho de verdade acontece na Programação. Aqui é só manter a lista.
 */
@Component({
  selector: 'app-machines',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TableModule, ButtonModule, SelectModule, Toast, Tooltip,
    FormScreenComponent, ToolbarComponent, PkButtonComponent, PkCheckboxComponent,
    PkDialogComponent, PkTableComponent,
  ],
  templateUrl: './machines.component.html',
  styleUrl: './machines.component.scss',
  providers: [MessageService],
})
export class MachinesComponent implements OnInit, TabDirtyCheck {

  private readonly store = inject(MachineStore);
  private readonly messageService = inject(MessageService);

  readonly machines = this.store.items;
  readonly loading = this.store.loading;
  readonly mode = signal<'grid' | 'form'>('grid');

  readonly statusOptions = machineStatusOptions();
  readonly typeOptions = machineTypeOptions();

  form: FormGroup;
  formTitle = 'Nova Máquina';
  editing: Machine | null = null;

  deleteTarget: Machine | null = null;
  deleteVisible = false;
  deleting = false;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      systemCode: ['', Validators.required],
      name: ['', Validators.required],
      brand: [''],
      machineType: [MachineType.CAPO, Validators.required],
      machineStatus: [MachineStatus.DISPONIVEL, Validators.required],
      minimum_stock: [0],
      active: [true],
    });
  }

  isTabDirty(): boolean {
    return this.mode() === 'form' && this.form.dirty;
  }

  closeForm(): void {
    this.mode.set('grid');
  }

  ngOnInit(): void {
    this.store.load();
  }

  refresh(): void {
    this.store.refresh();
  }

  statusLabel(status: MachineStatus): string {
    return MACHINE_STATUS_LABEL[status] ?? status;
  }

  statusClass(status: MachineStatus): string {
    return `status-chip status-chip--${MACHINE_STATUS_SEVERITY[status] ?? 'neutral'}`;
  }

  typeLabel(type: MachineType): string {
    return MACHINE_TYPE_LABEL[type] ?? type;
  }

  newMachine(): void {
    this.formTitle = 'Nova Máquina';
    this.editing = null;
    this.form.reset({
      machineType: MachineType.CAPO,
      machineStatus: MachineStatus.DISPONIVEL,
      minimum_stock: 0,
      active: true,
    });
    this.mode.set('form');
  }

  edit(machine: Machine): void {
    this.formTitle = 'Editar Máquina';
    this.editing = machine;
    this.form.patchValue(machine);
    this.mode.set('form');
  }

  save(): void {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const request = this.editing
      ? this.store.update({ ...value, id: this.editing.id })
      : this.store.create(value);

    request.subscribe({
      next: () => {
        this.mode.set('grid');
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: this.editing ? 'Máquina atualizada.' : 'Máquina cadastrada.',
        });
      },
      error: (err: HttpErrorResponse) => this.showError(err),
    });
  }

  askDelete(machine: Machine): void {
    this.deleteTarget = machine;
    this.deleteVisible = true;
  }

  confirmDelete(): void {
    const target = this.deleteTarget;
    if (!target) return;

    this.deleting = true;
    this.store.deleteById(target.id).subscribe({
      next: () => {
        this.deleting = false;
        this.deleteVisible = false;
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Máquina excluída.' });
      },
      error: (err: HttpErrorResponse) => {
        this.deleting = false;
        this.showError(err);
      },
    });
  }

  private showError(err: HttpErrorResponse): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Erro',
      detail: err.status === 0 ? 'Sem conexão com o servidor.'
        : typeof err.error === 'string' ? err.error : 'Erro inesperado.',
    });
  }
}
