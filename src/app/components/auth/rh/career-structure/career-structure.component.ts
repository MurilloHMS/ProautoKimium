import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PositionService } from '../../../../infrastructure/services/hr/position.service';
import { PositionLevelService } from '../../../../infrastructure/services/hr/position-level.service';
import { CollectiveBargainingAdjustmentService } from '../../../../infrastructure/services/hr/collective-bargaining-adjustment.service';
import {
  AdjustmentScope,
  CollectiveBargainingAdjustmentResult,
  Position,
  PositionLevel,
  SalaryAdjustmentType
} from '../../../../domain/models/hr/career.model';

@Component({
  selector: 'app-career-structure',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TableModule, SelectModule, DatePickerModule, Toast,
    PkButtonComponent, PkDialogComponent, PkTableComponent, PkInputComponent,
  ],
  templateUrl: './career-structure.component.html',
  styleUrl: './career-structure.component.scss',
  providers: [MessageService],
})
export class CareerStructureComponent implements OnInit {
  // Posições
  positions: Position[] = [];
  loadingPositions = false;
  positionDialogVisible = false;
  positionForm: FormGroup;

  // Níveis da posição selecionada
  selectedPosition: Position | null = null;
  levels: PositionLevel[] = [];
  loadingLevels = false;
  levelDialogVisible = false;
  levelForm: FormGroup;

  // Dissídio
  adjustmentDialogVisible = false;
  adjustmentForm: FormGroup;
  adjustmentResult: CollectiveBargainingAdjustmentResult | null = null;
  applyingAdjustment = false;

  adjustmentTypeOptions: { label: string; value: SalaryAdjustmentType }[] = [
    { label: 'Valor fixo', value: 'FIXED' },
    { label: 'Percentual sobre o nível anterior', value: 'PERCENTAGE' },
  ];

  scopeOptions: { label: string; value: AdjustmentScope }[] = [
    { label: 'Todas as posições', value: 'ALL_POSITIONS' },
    { label: 'Uma posição específica', value: 'SPECIFIC_POSITION' },
  ];

  constructor(
    private positionService: PositionService,
    private positionLevelService: PositionLevelService,
    private adjustmentService: CollectiveBargainingAdjustmentService,
    private fb: FormBuilder,
    private msgService: MessageService
  ) {
    this.positionForm = this.fb.group({
      name: ['', Validators.required],
    });

    this.levelForm = this.fb.group({
      name: ['', Validators.required],
      levelOrder: [null, [Validators.required, Validators.min(1)]],
      adjustmentType: ['FIXED', Validators.required],
      fixedAmount: [null],
      percentageIncrease: [null],
    });

    this.adjustmentForm = this.fb.group({
      percentage: [null, [Validators.required, Validators.min(0.01)]],
      effectiveDate: [null, Validators.required],
      scope: ['ALL_POSITIONS', Validators.required],
      positionId: [null],
    });
  }

  ngOnInit(): void {
    this.loadPositions();
  }

  // ---- Posições ----

  loadPositions(): void {
    this.loadingPositions = true;
    this.positionService.getAll().subscribe({
      next: (list) => {
        this.positions = list;
        this.loadingPositions = false;
      },
      error: (err) => {
        this.loadingPositions = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  showPositionDialog(): void {
    this.positionForm.reset();
    this.positionDialogVisible = true;
  }

  savePosition(): void {
    if (!this.positionForm.valid) return;

    this.positionService.create(this.positionForm.value).subscribe({
      next: () => {
        this.positionDialogVisible = false;
        this.loadPositions();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Cargo cadastrado com sucesso!' });
      },
      error: (err) => {
        this.positionDialogVisible = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  // ---- Níveis ----

  selectPosition(position: Position): void {
    this.selectedPosition = position;
    this.loadLevels();
  }

  loadLevels(): void {
    if (!this.selectedPosition) return;

    this.loadingLevels = true;
    this.positionLevelService.getByPosition(this.selectedPosition.id).subscribe({
      next: (list) => {
        this.levels = list;
        this.loadingLevels = false;
      },
      error: (err) => {
        this.loadingLevels = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  get isFixedLevel(): boolean {
    return this.levelForm.get('adjustmentType')?.value === 'FIXED';
  }

  showLevelDialog(): void {
    this.levelForm.reset({ adjustmentType: 'FIXED' });
    this.levelDialogVisible = true;
  }

  saveLevel(): void {
    if (!this.levelForm.valid || !this.selectedPosition) return;

    const { name, levelOrder, adjustmentType, fixedAmount, percentageIncrease } = this.levelForm.value;

    this.positionLevelService.create({
      name,
      levelOrder,
      positionId: this.selectedPosition.id,
      adjustmentType,
      fixedAmount: adjustmentType === 'FIXED' ? fixedAmount : null,
      percentageIncrease: adjustmentType === 'PERCENTAGE' ? percentageIncrease : null,
    }).subscribe({
      next: () => {
        this.levelDialogVisible = false;
        this.loadLevels();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Nível cadastrado com sucesso!' });
      },
      error: (err) => {
        this.levelDialogVisible = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  // ---- Dissídio ----

  get isSpecificPositionScope(): boolean {
    return this.adjustmentForm.get('scope')?.value === 'SPECIFIC_POSITION';
  }

  showAdjustmentDialog(): void {
    this.adjustmentForm.reset({ scope: 'ALL_POSITIONS' });
    this.adjustmentResult = null;
    this.adjustmentDialogVisible = true;
  }

  applyAdjustment(): void {
    if (!this.adjustmentForm.valid) return;

    const { percentage, effectiveDate, scope, positionId } = this.adjustmentForm.value as {
      percentage: number;
      effectiveDate: Date;
      scope: AdjustmentScope;
      positionId: string | null;
    };

    this.applyingAdjustment = true;
    this.adjustmentService.apply({
      percentage,
      effectiveDate: this.toIsoDate(effectiveDate),
      scope,
      positionId: scope === 'SPECIFIC_POSITION' ? positionId : null,
    }).subscribe({
      next: (result) => {
        this.applyingAdjustment = false;
        this.adjustmentResult = result;
        this.msgService.add({ severity: 'success', summary: 'Dissídio aplicado', detail: `${result.positionLevelsUpdated} nível(is) atualizado(s), ${result.employeesAffected} funcionário(s) afetado(s).` });
        if (this.selectedPosition) this.loadLevels();
      },
      error: (err) => {
        this.applyingAdjustment = false;
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
