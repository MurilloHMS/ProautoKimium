import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DividerModule } from 'primeng/divider';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { environment } from '../../../../../../environments/environment';

import {
  ProductWebSiteCreateDTO,
  ProductWebSiteResponseDTO,
  ProductWebSiteUpdateDTO
} from '../../../../../domain/models/products.model';

import { WebsiteService } from '../../../../../infrastructure/services/company/products/website/website.service';

export type TabKey = 'active' | 'hidden';

@Component({
  selector: 'app-website',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    ToastModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    ConfirmDialogModule,
    SkeletonModule,
    TooltipModule,
    AutoCompleteModule,
    DividerModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './website.component.html',
  styleUrls: ['./website.component.scss'],
})
export class WebsiteComponent implements OnInit {
  allProducts = signal<ProductWebSiteResponseDTO[]>([]);
  activeProducts = signal<ProductWebSiteResponseDTO[]>([]);
  hiddenProducts = signal<ProductWebSiteResponseDTO[]>([]);

  loading = signal(false);
  dialogVisible = signal(false);
  createDialogVisible = signal(false);
  editingProduct = signal<ProductWebSiteResponseDTO | null>(null);

  activeTab = signal<TabKey>('active');
  termoBusca = '';

  selectedCreateImage: File | null = null;
  selectedEditImage: File | null = null;
  createImagePreview: string | null = null;
  editImagePreview: string | null = null;

  filteredCores: string[] = [];

  tabs = [
    { key: 'active' as TabKey, label: 'Visíveis no Site', icon: 'pi-eye' },
    { key: 'hidden' as TabKey, label: 'Ocultos', icon: 'pi-eye-slash' },
  ];

  private _buscaTrigger = signal(0);

  editForm!: FormGroup;
  createForm!: FormGroup;

  produtosFiltrados = computed(() => {
    this._buscaTrigger();

    const lista =
      this.activeTab() === 'active'
        ? this.activeProducts()
        : this.hiddenProducts();

    const termo = this.termoBusca.toLowerCase().trim();
    if (!termo) return lista;

    return lista.filter(p =>
      (p.name ?? '').toLowerCase().includes(termo) ||
      (p.systemCode ?? '').toLowerCase().includes(termo) ||
      (p.finalidade ?? '').toLowerCase().includes(termo) ||
      (p.diluicao ?? '').toLowerCase().includes(termo)
    );
  });

  constructor(
    private service: WebsiteService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initEditForm();
    this.initCreateForm();
    this.loadAllProducts();
  }

  initEditForm(): void {
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      active: [true],
      cores: [[]],
      finalidade: ['', Validators.required],
      diluicao: ['', Validators.required],
      descricao: ['', Validators.required],
    });
  }

  initCreateForm(): void {
    this.createForm = this.fb.group({
      systemCode: ['', [Validators.required, Validators.minLength(2)]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      cores: [[]],
      finalidade: ['', Validators.required],
      diluicao: ['', Validators.required],
      descricao: ['', Validators.required],
    });
  }

  loadAllProducts(): void {
    this.loading.set(true);

    this.service.getAllProducts().subscribe({
      next: (products) => {
        this.allProducts.set(products);
        this.activeProducts.set(products.filter(p => p.active));
        this.hiddenProducts.set(products.filter(p => !p.active));
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao carregar produtos.'
        });
        this.loading.set(false);
      },
    });
  }

  setTab(key: TabKey): void {
    this.activeTab.set(key);
    this.termoBusca = '';
    this.aplicarFiltro();
  }

  aplicarFiltro(): void {
    this._buscaTrigger.update(v => v + 1);
  }

  filtrarCores(event: any): void {
    const query = event.query?.toLowerCase() || '';
    const coresBase = ['Vermelho', 'Azul', 'Verde', 'Preto', 'Branco', 'Amarelo', 'Cinza'];

    this.filteredCores = coresBase.filter(c =>
      c.toLowerCase().includes(query)
    );
  }

  openCreateDialog(): void {
    this.createForm.reset({
      systemCode: '',
      name: '',
      cores: [],
      finalidade: '',
      diluicao: '',
      descricao: '',
    });

    this.selectedCreateImage = null;
    this.createImagePreview = null;
    this.createDialogVisible.set(true);
  }

  closeCreateDialog(): void {
    this.createDialogVisible.set(false);
    this.createForm.reset({ cores: [] });
    this.selectedCreateImage = null;
    this.createImagePreview = null;
  }

  openEditDialog(product: ProductWebSiteResponseDTO): void {
    this.editingProduct.set(product);
    this.selectedEditImage = null;
    this.editImagePreview = null;

    this.editForm.patchValue({
      name: product.name,
      active: product.active,
      cores: product.cores ?? [],
      finalidade: product.finalidade,
      diluicao: product.diluicao,
      descricao: product.descricao,
    });

    this.dialogVisible.set(true);
  }

  closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingProduct.set(null);
    this.editForm.reset({ cores: [] });
    this.selectedEditImage = null;
    this.editImagePreview = null;
  }

  saveCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const dto: ProductWebSiteCreateDTO = this.createForm.getRawValue();

    this.service.create(dto, this.selectedCreateImage).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Produto cadastrado com sucesso!'
        });
        this.closeCreateDialog();
        this.loadAllProducts();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao cadastrar produto.'
        });
      },
    });
  }

  saveEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const product = this.editingProduct();
    if (!product) return;

    const dto: ProductWebSiteUpdateDTO = this.editForm.getRawValue();

    this.service.update(dto, product.id, this.selectedEditImage).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Produto atualizado com sucesso!'
        });
        this.closeDialog();
        this.loadAllProducts();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao atualizar produto.'
        });
      },
    });
  }

  confirmHide(product: ProductWebSiteResponseDTO): void {
    this.confirmationService.confirm({
      message: `Deseja ocultar o produto ${product.name}? Ele não será mais exibido no site.`,
      header: 'Ocultar Produto',
      icon: 'pi pi-eye-slash',
      acceptLabel: 'Ocultar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => this.hideProduct(product),
    });
  }

  hideProduct(product: ProductWebSiteResponseDTO): void {
    this.service.setHide(product.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Produto ocultado',
          detail: `${product.name} foi ocultado do site.`
        });
        this.loadAllProducts();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao ocultar produto.'
        });
      },
    });
  }

  confirmUnhide(product: ProductWebSiteResponseDTO): void {
    this.confirmationService.confirm({
      message: `Deseja tornar o produto ${product.name} visível novamente no site?`,
      header: 'Reexibir Produto',
      icon: 'pi pi-eye',
      acceptLabel: 'Reexibir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.unhideProduct(product),
    });
  }

  unhideProduct(product: ProductWebSiteResponseDTO): void {
    this.service.setUnhide(product.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Produto reexibido',
          detail: `${product.name} está visível no site novamente.`
        });
        this.loadAllProducts();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao reexibir produto.'
        });
      },
    });
  }

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

  isFieldInvalid(field: string): boolean {
    const control = this.editForm.get(field);
    return !!(control && control.invalid && control.touched);
  }

  isCreateFieldInvalid(field: string): boolean {
    const control = this.createForm.get(field);
    return !!(control && control.invalid && control.touched);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' && event.key !== 'Enter') return;
    const target = event.target as HTMLInputElement;
    const valor = target?.value?.trim();
    this.addCoresToForm(this.editForm, valor);
    if (target) target.value = '';
    event.preventDefault();
  }

  onBlurAdd(event: Event): void {
    const target = event.target as HTMLInputElement;
    const valor = target?.value?.trim();
    this.addCoresToForm(this.editForm, valor);
    if (target) target.value = '';
  }

  onCreateKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' && event.key !== 'Enter') return;
    const target = event.target as HTMLInputElement;
    const valor = target?.value?.trim();
    this.addCoresToForm(this.createForm, valor);
    if (target) target.value = '';
    event.preventDefault();
  }

  onCreateBlurAdd(event: Event): void {
    const target = event.target as HTMLInputElement;
    const valor = target?.value?.trim();
    this.addCoresToForm(this.createForm, valor);
    if (target) target.value = '';
  }

  removerCor(form: FormGroup, cor: string): void {
    const control = form.get('cores');
    const atual: string[] = control?.value || [];
    control?.setValue(atual.filter(c => c !== cor));
  }

  private addCoresToForm(form: FormGroup, valor?: string): void {
    if (!valor) return;

    const control = form.get('cores');
    const atual: string[] = control?.value || [];

    const novas = valor
      .split(/[,\n;]+/)
      .map(v => v.trim())
      .filter(v => v.length > 0);

    const resultado = [...atual];

    for (const cor of novas) {
      if (!resultado.some(c => c.toLowerCase() === cor.toLowerCase())) {
        resultado.push(cor);
      }
    }

    control?.setValue(resultado);
    control?.markAsDirty();
    control?.markAsTouched();
  }

  resolverImagem(path?: string | null): string {
    if (!path) return 'images/products/placeholder.png';
    if (path.startsWith('http')) return path;

    const baseUrl = environment.apiUrl.replace('/api', '');
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  get totalProdutos(): number {
    return this.allProducts().length;
  }

  get totalAtivos(): number {
    return this.activeProducts().length;
  }

  get totalOcultos(): number {
    return this.hiddenProducts().length;
  }
}
