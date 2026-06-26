import { Component, OnInit, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';

import { environment } from '../../../../../environments/environment';
import {
  EquipmentCreateDTO,
  EquipmentResponseDTO,
  EquipmentUpdateDTO
} from '../../../../domain/models/equipment.model';
import { EquipmentService } from '../../../../infrastructure/services/company/equipment/equipment.service';

@Component({
  selector: 'app-equipments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ToastModule,
    TooltipModule,
    ConfirmDialogModule,
    PkTableComponent,
    PkDialogComponent,
    PkInputComponent,
    PkButtonComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './equipments.component.html',
  styleUrl: './equipments.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class EquipmentsComponent implements OnInit {
  equipments = signal<EquipmentResponseDTO[]>([]);

  loading = signal(false);
  saving = signal(false);

  createDialogVisible = signal(false);
  editDialogVisible = signal(false);

  editingEquipment = signal<EquipmentResponseDTO | null>(null);

  selectedCreateImage: File | null = null;
  selectedEditImage: File | null = null;
  createImagePreview: string | null = null;
  editImagePreview: string | null = null;

  createForm!: FormGroup;
  editForm!: FormGroup;

  constructor(
    private service: EquipmentService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initCreateForm();
    this.initEditForm();
    this.loadEquipments();
  }

  initCreateForm(): void {
    this.createForm = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2)]],
    });
  }

  initEditForm(): void {
    this.editForm = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2)]],
    });
  }

  loadEquipments(): void {
    this.loading.set(true);

    this.service.getAll().subscribe({
      next: (list) => {
        this.equipments.set(list ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao carregar equipamentos.'
        });
        this.loading.set(false);
      },
    });
  }

  // ── CREATE ──────────────────────────────────────────────────
  openCreateDialog(): void {
    this.createForm.reset({ nome: '' });
    this.selectedCreateImage = null;
    this.createImagePreview = null;
    this.createDialogVisible.set(true);
  }

  closeCreateDialog(): void {
    this.createDialogVisible.set(false);
    this.createForm.reset({ nome: '' });
    this.selectedCreateImage = null;
    this.createImagePreview = null;
  }

  saveCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    if (!this.selectedCreateImage) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Imagem obrigatória',
        detail: 'Selecione uma imagem para o equipamento.'
      });
      return;
    }

    const dto: EquipmentCreateDTO = { nome: this.createForm.value.nome };
    this.saving.set(true);

    this.service.create(dto, this.selectedCreateImage).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Equipamento cadastrado com sucesso!'
        });
        this.closeCreateDialog();
        this.loadEquipments();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao cadastrar equipamento.'
        });
      },
      complete: () => this.saving.set(false),
    });
  }

  // ── EDIT ────────────────────────────────────────────────────
  openEditDialog(equipment: EquipmentResponseDTO): void {
    this.editingEquipment.set(equipment);
    this.selectedEditImage = null;
    this.editImagePreview = null;

    this.editForm.patchValue({
      nome: equipment.nome,
    });

    this.editDialogVisible.set(true);
  }

  closeEditDialog(): void {
    this.editDialogVisible.set(false);
    this.editingEquipment.set(null);
    this.editForm.reset({ nome: '' });
    this.selectedEditImage = null;
    this.editImagePreview = null;
  }

  saveEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const equipment = this.editingEquipment();
    if (!equipment) return;

    const dto: EquipmentUpdateDTO = { nome: this.editForm.value.nome };
    this.saving.set(true);

    this.service.update(equipment.id, dto, this.selectedEditImage).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Equipamento atualizado com sucesso!'
        });
        this.closeEditDialog();
        this.loadEquipments();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao atualizar equipamento.'
        });
      },
      complete: () => this.saving.set(false),
    });
  }

  // ── DELETE ──────────────────────────────────────────────────
  confirmDelete(equipment: EquipmentResponseDTO): void {
    this.confirmationService.confirm({
      message: `Deseja excluir o equipamento <strong>${equipment.nome}</strong>? Esta ação não pode ser desfeita.`,
      header: 'Confirmar Exclusão',
      icon: 'pi pi-trash',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-outlined p-button-sm',
      accept: () => {
        this.service.delete(equipment.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Excluído',
              detail: `Equipamento "${equipment.nome}" removido.`
            });
            this.loadEquipments();
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Erro',
              detail: 'Não foi possível excluir o equipamento.'
            });
          },
        });
      },
    });
  }

  // ── IMAGEM ──────────────────────────────────────────────────
  onCreateImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.selectedCreateImage = file;
    this.createImagePreview = file ? URL.createObjectURL(file) : null;
  }

  onEditImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.selectedEditImage = file;
    this.editImagePreview = file ? URL.createObjectURL(file) : null;
  }

  removerImagemCreate(): void {
    this.selectedCreateImage = null;
    this.createImagePreview = null;
  }

  removerImagemEdit(): void {
    this.selectedEditImage = null;
    this.editImagePreview = null;
  }

  resolverImagem(path: string | null): string {
    if (!path) {
      return 'images/products/placeholder.png';
    }

    if (path.startsWith('http')) {
      return path;
    }

    const origem = new URL(environment.apiUrl).origin;
    const caminho = path.startsWith('/') ? path : `/${path}`;
    return `${origem}${caminho}`;
  }
}
