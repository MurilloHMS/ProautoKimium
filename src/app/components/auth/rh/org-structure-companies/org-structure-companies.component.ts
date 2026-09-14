import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { startWith } from 'rxjs';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { AddressFieldsComponent, addressFromGroup, addressGroup } from '../../shared/address-fields/address-fields.component';
import { MapPreviewComponent } from '../../shared/map-preview/map-preview.component';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import { CompanyStore } from '../../../../infrastructure/state/org-structure.store';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';
import { Company } from '../../../../domain/models/hr/org-structure.model';
import { formatAddress, isUsableAddress } from '../../../../domain/utils/address';

@Component({
  selector: 'app-org-structure-companies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableModule, Toast, PkButtonComponent, PkTableComponent, PkInputComponent,
            FormScreenComponent, ToolbarComponent, AddressFieldsComponent, MapPreviewComponent, PkCanDirective],
  templateUrl: './org-structure-companies.component.html',
  styleUrl: './org-structure-companies.component.scss',
  providers: [MessageService],
})
export class OrgStructureCompaniesComponent implements OnInit, TabDirtyCheck {

  private readonly store = inject(CompanyStore);
  private readonly fb = inject(FormBuilder);
  private readonly msgService = inject(MessageService);

  /** Lista compartilhada: o cadastro feito aqui aparece em qualquer tela aberta. */
  readonly companies = this.store.items;
  readonly loading = this.store.loading;

  /** A tela alterna entre a grade e o formulário; não há mais diálogo. */
  readonly mode = signal<'grid' | 'form'>('grid');

  /** Nulo é "Nova empresa". Editar entrou junto com o endereço (2026-09-14). */
  readonly editing = signal<Company | null>(null);

  readonly address: FormGroup = addressGroup(this.fb);

  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    legalName: ['', Validators.required],
    cnpj: ['', Validators.required],
    address: this.address,
  });

  private readonly addressValue = toSignal(this.address.valueChanges.pipe(startWith(this.address.value)));

  /** O mapa acompanha o que se digita, para conferir o ponto antes de salvar. */
  readonly addressText = computed(() => {
    const valor = this.addressValue();
    return isUsableAddress(valor) ? formatAddress(valor) : '';
  });

  readonly formatAddress = formatAddress;

  /** A aba avisa antes de fechar se o formulário estiver preenchido. */
  isTabDirty(): boolean {
    return this.mode() === 'form' && this.form.dirty;
  }

  ngOnInit(): void {
    this.store.load();
  }

  reload(): void {
    this.store.refresh();
  }

  openForm(company: Company | null = null): void {
    this.editing.set(company);
    this.form.reset({
      name: company?.name ?? '',
      legalName: company?.legalName ?? '',
      cnpj: company?.cnpj ?? '',
      address: {
        zipCode: company?.address?.zipCode ?? '',
        street: company?.address?.street ?? '',
        number: company?.address?.number ?? '',
        complement: company?.address?.complement ?? '',
        district: company?.address?.district ?? '',
        city: company?.address?.city ?? '',
        state: company?.address?.state ?? '',
      },
    });
    this.mode.set('form');
  }

  closeForm(): void {
    this.mode.set('grid');
    this.editing.set(null);
  }

  save(): void {
    if (!this.form.valid) return;

    const v = this.form.getRawValue();
    const endereco = addressFromGroup(this.address);
    const request = {
      name: v.name,
      legalName: v.legalName,
      cnpj: v.cnpj,
      // Tudo em branco vai nulo: a API guarda "sem endereço", e não sete
      // colunas vazias que parecem preenchidas.
      address: Object.values(endereco).some(x => x) ? endereco : null,
    };

    const atual = this.editing();
    const chamada = atual ? this.store.update(atual.id, request) : this.store.create(request);

    chamada.subscribe({
      next: () => {
        this.closeForm();
        this.msgService.add({
          severity: 'success', summary: 'Sucesso',
          detail: atual ? 'Empresa atualizada.' : 'Empresa cadastrada com sucesso!',
        });
      },
      error: (err) => {
        // Erro mantém o formulário aberto: o usuário não perde o que digitou.
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 400: return err?.error?.message ?? 'Requisição inválida';
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
