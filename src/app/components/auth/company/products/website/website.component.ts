import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

// PrimeNG
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
import {
  ProductWebSiteCreateDTO,
  ProductWebSiteResponseDTO,
  ProductWebSiteUpdateDTO
} from "../../../../../domain/models/products.model";
import {WebsiteService} from "../../../../../infrastructure/services/company/products/website/website.service";

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
  private readonly API_URL = 'http://localhost:5007/api/product/website';

  // ── dados ──────────────────────────────────────
  allProducts    = signal<ProductWebSiteResponseDTO[]>([]);
  activeProducts = signal<ProductWebSiteResponseDTO[]>([]);
  hiddenProducts = signal<ProductWebSiteResponseDTO[]>([]);

  loading       = signal(false);
  dialogVisible = signal(false);
  editingProduct = signal<ProductWebSiteResponseDTO | null>(null);

  // ── tabs ───────────────────────────────────────
  activeTab = signal<TabKey>('active');

  tabs = [
    { key: 'active' as TabKey, label: 'Visíveis no Site', icon: 'pi-eye'       },
    { key: 'hidden' as TabKey, label: 'Ocultos',          icon: 'pi-eye-slash' },
  ];

  filteredCores: string[] = [];

  filtrarCores(event: any) {
    const query = event.query?.toLowerCase() || '';

    const coresBase = ['Vermelho', 'Azul', 'Verde', 'Preto', 'Branco'];

    this.filteredCores = coresBase.filter(c =>
      c.toLowerCase().includes(query)
    );
  }

  setTab(key: TabKey): void {
    this.activeTab.set(key);
    this.termoBusca = '';
  }

  // ── busca ──────────────────────────────────────
  termoBusca = '';

  produtosFiltrados = computed(() => {
    const lista = this.activeTab() === 'active'
      ? this.activeProducts()
      : this.hiddenProducts();

    const termo = this.termoBusca.toLowerCase().trim();
    if (!termo) return lista;

    return lista.filter(p =>
      p.name.toLowerCase().includes(termo)       ||
      p.systemCode.toLowerCase().includes(termo) ||
      p.finalidade.toLowerCase().includes(termo) ||
      p.diluicao.toLowerCase().includes(termo)
    );
  });

  // Chamado pelo (input) do campo de busca para forçar atualização do signal
  aplicarFiltro(): void {
    // O computed já reage ao termoBusca, mas como termoBusca não é um signal
    // precisamos de um "trigger". Usamos um signal auxiliar.
    this._buscaTrigger.update(v => v + 1);
  }
  private _buscaTrigger = signal(0);

  // ── form ───────────────────────────────────────
  editForm!: FormGroup;

  constructor(
    private service: WebsiteService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.initCreateForm();
    this.loadAllProducts();
  }

  initForm(): void {
    this.editForm = this.fb.group({
      name:       ['', [Validators.required, Validators.minLength(2)]],
      active:     [true],
      cores:      [[]],
      finalidade: ['', Validators.required],
      diluicao:   ['', Validators.required],
      descricao:  ['', Validators.required],
    });
  }

  // ── API ────────────────────────────────────────
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
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar produtos.' });
        this.loading.set(false);
      },
    });
  }

  openEditDialog(product: ProductWebSiteResponseDTO): void {
    this.editingProduct.set(product);
    this.editForm.patchValue({
      name:       product.name,
      active:     product.active,
      cores:      product.cores ?? [],
      finalidade: product.finalidade,
      diluicao:   product.diluicao,
      descricao:  product.descricao,
    });
    this.dialogVisible.set(true);
  }

  saveEdit(): void {
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }
    const product = this.editingProduct();
    if (!product) return;

    const dto: ProductWebSiteUpdateDTO = this.editForm.value;
    this.service.update(dto, product.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Produto atualizado com sucesso!' });
        this.dialogVisible.set(false);
        this.loadAllProducts();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao atualizar produto.' });
      },
    });
  }

  confirmHide(product: ProductWebSiteResponseDTO): void {
    this.confirmationService.confirm({
      message: `Deseja ocultar o produto <strong>${product.name}</strong>? Ele não será mais exibido no site.`,
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
        this.messageService.add({ severity: 'warn', summary: 'Produto Ocultado', detail: `${product.name} foi ocultado do site.` });
        this.loadAllProducts();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao ocultar produto.' });
      },
    });
  }

  confirmUnhide(product: ProductWebSiteResponseDTO): void {
    this.confirmationService.confirm({
      message: `Deseja tornar o produto <strong>${product.name}</strong> visível novamente no site?`,
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
        this.messageService.add({ severity: 'success', summary: 'Produto Reexibido', detail: `${product.name} está visível no site novamente.` });
        this.loadAllProducts();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao reexibir produto.' });
      },
    });
  }

  closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingProduct.set(null);
    this.editForm.reset();
  }

  isFieldInvalid(field: string): boolean {
    const control = this.editForm.get(field);
    return !!(control && control.invalid && control.touched);
  }

  onKeyDown(event: any) {
    if (event.key !== 'Tab' && event.key !== 'Enter') return;

    const valor = event.target?.value?.trim();

    this.addCores(valor);

    if (event.target) {
      event.target.value = '';
    }

    event.preventDefault();
  }

  onBlurAdd(event: any) {
    const valor = event.target?.value?.trim();

    this.addCores(valor);

    if (event.target) {
      event.target.value = '';
    }
  }

  private addCores(valor: string) {
    this.addCoresToForm(this.editForm, valor);
  }

  createDialogVisible = signal(false);
  createForm!: FormGroup;

  initCreateForm(): void {
    this.createForm = this.fb.group({
      systemCode: ['', [Validators.required, Validators.minLength(2)]],
      name:       ['', [Validators.required, Validators.minLength(2)]],
      cores:      [[]],
      finalidade: ['', Validators.required],
      diluicao:   ['', Validators.required],
      descricao:  ['', Validators.required],
    });
  }

  openCreateDialog(): void {
    this.createForm.reset({ cores: [] });
    this.createDialogVisible.set(true);
  }

  closeCreateDialog(): void {
    this.createDialogVisible.set(false);
    this.createForm.reset({ cores: [] });
  }

  saveCreate(): void {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }

    const dto: ProductWebSiteCreateDTO = this.createForm.value;
    this.service.create(dto).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Produto cadastrado com sucesso!' });
        this.createDialogVisible.set(false);
        this.loadAllProducts();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao cadastrar produto.' });
      },
    });
  }

  isCreateFieldInvalid(field: string): boolean {
    const control = this.createForm.get(field);
    return !!(control && control.invalid && control.touched);
  }

  onCreateKeyDown(event: any) {
    if (event.key !== 'Tab' && event.key !== 'Enter') return;
    const valor = event.target?.value?.trim();
    this.addCoresToForm(this.createForm, valor);
    if (event.target) event.target.value = '';
    event.preventDefault();
  }

  onCreateBlurAdd(event: any) {
    const valor = event.target?.value?.trim();
    this.addCoresToForm(this.createForm, valor);
    if (event.target) event.target.value = '';
  }

  private addCoresToForm(form: FormGroup, valor: string) {
    if (!valor) return;
    const control = form.get('cores');
    const atual: string[] = control?.value || [];
    const novas = valor.split(/[,\n;]+/).map(v => v.trim()).filter(v => v.length > 0);
    const resultado = [...atual];
    for (const cor of novas) {
      if (!resultado.some(c => c.toLowerCase() === cor.toLowerCase())) {
        resultado.push(cor);
      }
    }
    control?.setValue(resultado);
  }
}
