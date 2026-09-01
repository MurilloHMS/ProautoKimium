import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { PositionStore } from '../../../../infrastructure/state/position.store';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import { PositionLevelStore } from '../../../../infrastructure/state/position.store';
import { CollectiveBargainingAdjustmentService } from '../../../../infrastructure/services/hr/collective-bargaining-adjustment.service';
import {
  AdjustmentScope,
  CollectiveBargainingAdjustmentResult,
  Position,
  PositionLevel,
  SalaryAdjustmentType
} from '../../../../domain/models/hr/career.model';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';

@Component({
  selector: 'app-career-structure',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TableModule, SelectModule, DatePickerModule, Toast,
    PkButtonComponent, PkDialogComponent, PkTableComponent, PkInputComponent,
    ToolbarComponent, FormScreenComponent,
  ],
  templateUrl: './career-structure.component.html',
  styleUrl: './career-structure.component.scss',
  providers: [MessageService],
})
export class CareerStructureComponent implements OnInit, TabDirtyCheck {

  // Precisam vir antes dos campos que os consomem: campo de classe é
  // inicializado na ordem em que é declarado.
  private readonly positionStore = inject(PositionStore);
  private readonly levelStore = inject(PositionLevelStore);

  // Posições
  readonly positions = this.positionStore.items;
  readonly loadingPositions = this.positionStore.loading;
  /** grid, ou o formulario de cargo, ou o de nivel. O dissidio segue em dialogo. */
  readonly mode = signal<'grid' | 'position' | 'level'>('grid');

  positionForm: FormGroup;

  // Níveis da posição selecionada
  readonly selectedPosition = signal<Position | null>(null);

  /** Níveis do cargo selecionado, direto do store: criar um nível reflete aqui na hora. */
  readonly levels = computed(() => {
    const position = this.selectedPosition();
    return position ? this.levelStore.levelsOf(position.id) : [];
  });
  readonly loadingLevels = computed(() => {
    const position = this.selectedPosition();
    return position ? this.levelStore.isLoading(position.id) : false;
  });
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

  /**
   * A aba avisa antes de fechar se houver formulário preenchido — seja um dos
   * modos de cadastro, seja o dissídio, que continua em diálogo por ser uma
   * ação em lote e não um cadastro.
   */
  isTabDirty(): boolean {
    return (this.mode() === 'position' && this.positionForm.dirty)
      || (this.mode() === 'level' && this.levelForm.dirty)
      || (this.adjustmentDialogVisible && this.adjustmentForm.dirty);
  }

  ngOnInit(): void {
    this.positionStore.load();
  }

  // ---- Posições ----

  loadPositions(): void {
    this.positionStore.refresh();
  }

  openPositionForm(): void {
    this.positionForm.reset();
    this.mode.set('position');
  }

  closeForm(): void {
    this.mode.set('grid');
  }

  savePosition(): void {
    if (!this.positionForm.valid) return;

    // O store insere o cargo na lista compartilhada: o formulário de
    // funcionário aberto em outra aba já enxerga o cargo novo.
    this.positionStore.create(this.positionForm.value).subscribe({
      next: () => {
        this.closeForm();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Cargo cadastrado com sucesso!' });
      },
      error: (err) => {
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  // ---- Níveis ----

  selectPosition(position: Position): void {
    this.selectedPosition.set(position);
    this.levelStore.load(position.id);
  }

  loadLevels(): void {
    const position = this.selectedPosition();
    if (position) this.levelStore.load(position.id, true);
  }

  get isFixedLevel(): boolean {
    return this.levelForm.get('adjustmentType')?.value === 'FIXED';
  }

  openLevelForm(): void {
    this.levelForm.reset({ adjustmentType: 'FIXED' });
    this.mode.set('level');
  }

  saveLevel(): void {
    const position = this.selectedPosition();
    if (!this.levelForm.valid || !position) return;

    const { name, levelOrder, adjustmentType, fixedAmount, percentageIncrease } = this.levelForm.value;

    this.levelStore.create({
      name,
      levelOrder,
      positionId: position.id,
      adjustmentType,
      fixedAmount: adjustmentType === 'FIXED' ? fixedAmount : null,
      percentageIncrease: adjustmentType === 'PERCENTAGE' ? percentageIncrease : null,
    }).subscribe({
      next: () => {
        this.closeForm();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Nível cadastrado com sucesso!' });
      },
      error: (err) => {
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

        // O dissídio recalcula salário de todos os níveis: o cache inteiro
        // fica velho, não só o do cargo selecionado.
        this.levelStore.invalidateAll();
        this.loadLevels();
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
