import { FormScreenComponent } from '../shared/form-screen/form-screen.component';
import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { TabDirtyCheck } from '../../../infrastructure/routing/tab-dirty-check';
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { Textarea } from 'primeng/textarea';

import { FaqResponseDTO, StatusPostagem } from '../../../domain/models/faq.model';
import { FaqService } from '../../../infrastructure/services/faq/faq.service';

@Component({
  selector: 'app-faq-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    DialogModule,
    InputTextModule,
    TooltipModule,
    ToastModule,
    Textarea,
    FormScreenComponent,
    PkButtonComponent,
  ],
  providers: [MessageService],
  templateUrl: './faq-manager.component.html',
  styleUrl: './faq-manager.component.scss',
})
export class FaqManagerComponent implements OnInit, TabDirtyCheck {

  /** Pergunta em edição avisa antes de fechar a aba. */
  isTabDirty(): boolean {
    return this.mode() === 'form' && (!!this.form.title.trim() || !!this.form.body.trim());
  }

  closeForm(): void {
    this.mode.set('grid');
    this.resetForm();
  }

  items: FaqResponseDTO[] = [];
  filteredItems: FaqResponseDTO[] = [];
  loading = false;
  saving = false;
  submitted = false;

  loadingAction: Record<string, string> = {};

  searchTerm = '';
  selectedStatus: StatusPostagem | 'ALL' = 'ALL';

  /** grade ou formulário — a pergunta não é mais cadastrada em diálogo. */
  readonly mode = signal<'grid' | 'form'>('grid');
  editingItem: FaqResponseDTO | null = null;

  form = { title: '', body: '' };

  readonly statusOptions: { label: string; value: StatusPostagem | 'ALL'; dotClass: string }[] = [
    { label: 'Todos',     value: 'ALL',       dotClass: 'dot-all'      },
    { label: 'Publicado', value: 'PUBLICADO', dotClass: 'dot-published' },
    { label: 'Rascunho',  value: 'RASCUNHO',  dotClass: 'dot-draft'    },
    { label: 'Arquivado', value: 'ARQUIVADO', dotClass: 'dot-archived'  },
  ];

  constructor(
    private faqService: FaqService,
    private msg: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.faqService.getAll().subscribe({
      next: data => {
        this.items = data;
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar FAQs.' });
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    let result = [...this.items];
    if (this.selectedStatus !== 'ALL') {
      result = result.filter(i => i.status === this.selectedStatus);
    }
    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(
        i => i.title.toLowerCase().includes(term) || i.body.toLowerCase().includes(term),
      );
    }
    this.filteredItems = result;
  }

  filterByStatus(status: StatusPostagem | 'ALL'): void {
    this.selectedStatus = status;
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  getCountByStatus(status: StatusPostagem | 'ALL'): number {
    if (status === 'ALL') return this.items.length;
    return this.items.filter(i => i.status === status).length;
  }

  getStatusLabel(status: StatusPostagem): string {
    const map: Record<StatusPostagem, string> = {
      PUBLICADO: 'Publicado',
      RASCUNHO:  'Rascunho',
      ARQUIVADO: 'Arquivado',
    };
    return map[status] ?? status;
  }

  getStatusClass(status: StatusPostagem): string {
    const map: Record<StatusPostagem, string> = {
      PUBLICADO: 'badge-published',
      RASCUNHO:  'badge-draft',
      ARQUIVADO: 'badge-archived',
    };
    return map[status] ?? '';
  }

  // ── Dialog ────────────────────────────────────────────────────────────────────

  openCreateDialog(): void {
    this.editingItem = null;
    this.submitted = false;
    this.form = { title: '', body: '' };
    this.mode.set('form');
  }

  openEditDialog(item: FaqResponseDTO): void {
    this.editingItem = item;
    this.submitted = false;
    this.form = { title: item.title, body: item.body };
    this.mode.set('form');
  }

  resetForm(): void {
    this.form = { title: '', body: '' };
    this.editingItem = null;
    this.submitted = false;
  }

  save(): void {
    this.submitted = true;
    if (!this.form.title.trim() || !this.form.body.trim()) return;

    this.saving = true;
    const request$ = this.editingItem
      ? this.faqService.update(this.editingItem.id, this.form)
      : this.faqService.create(this.form);

    const successDetail = this.editingItem ? 'FAQ atualizado com sucesso.' : 'FAQ criado com sucesso.';
    const errorDetail   = this.editingItem ? 'Não foi possível atualizar o FAQ.' : 'Não foi possível criar o FAQ.';

    request$.subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Salvo!', detail: successDetail, life: 3000 });
        this.mode.set('grid');
        this.loadAll();
        this.saving = false;
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Erro', detail: errorDetail, life: 4000 });
        this.saving = false;
      },
    });
  }

  // ── Status actions ────────────────────────────────────────────────────────────

  publish(item: FaqResponseDTO): void {
    this.loadingAction[item.id] = 'publish';
    this.faqService.publish(item.id).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Publicado!', detail: `"${item.title}" agora está visível no site.`, life: 3000 });
        delete this.loadingAction[item.id];
        this.loadAll();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível publicar o FAQ.', life: 4000 });
        delete this.loadingAction[item.id];
      },
    });
  }

  archive(item: FaqResponseDTO): void {
    this.loadingAction[item.id] = 'archive';
    this.faqService.archive(item.id).subscribe({
      next: () => {
        this.msg.add({ severity: 'info', summary: 'Arquivado', detail: `"${item.title}" foi removido do site.`, life: 3000 });
        delete this.loadingAction[item.id];
        this.loadAll();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível arquivar o FAQ.', life: 4000 });
        delete this.loadingAction[item.id];
      },
    });
  }

  setDraft(item: FaqResponseDTO): void {
    this.loadingAction[item.id] = 'draft';
    this.faqService.setDraft(item.id).subscribe({
      next: () => {
        this.msg.add({ severity: 'warn', summary: 'Rascunho', detail: `"${item.title}" movido para rascunho.`, life: 3000 });
        delete this.loadingAction[item.id];
        this.loadAll();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível mover para rascunho.', life: 4000 });
        delete this.loadingAction[item.id];
      },
    });
  }
}
