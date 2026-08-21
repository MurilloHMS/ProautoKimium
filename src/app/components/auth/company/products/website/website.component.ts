import { ToolbarComponent } from '../../../shared/toolbar/toolbar.component';
import { FormScreenComponent } from '../../../shared/form-screen/form-screen.component';
import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkCheckboxComponent } from '../../../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component';
import { PkColorPickerComponent } from '../../../../theme/ProautoKimium/pk-color-picker/pk-color-picker.component';
import { PkSegmentedComponent, PkSegmentedOption } from '../../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { TabDirtyCheck } from '../../../../../infrastructure/routing/tab-dirty-check';
import { Component, OnInit, signal, computed, inject } from '@angular/core';
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
import { SelectModule } from 'primeng/select';
import { EquipmentService } from '../../../../../infrastructure/services/company/equipment/equipment.service';
import { EquipmentResponseDTO } from '../../../../../domain/models/equipment.model';

import {
  ProductWebSiteCreateDTO, ProductWebSitePublicResponseDTO,
  ProductWebSiteResponseDTO,
  ProductWebSiteUpdateDTO
} from '../../../../../domain/models/products.model';

import { WebsiteProductStore } from '../../../../../infrastructure/state/website-product.store';

/**
 * Os três recortes da mesma lista.
 *
 * Eram duas abas — "Visíveis no Site" e "Ocultos" — e a tela abria na primeira.
 * Produto novo nasce oculto, então ele caía na aba que ninguém estava vendo, e
 * a que estava aberta dizia "Nenhum produto encontrado". Daí o relato de que o
 * cadastro tinha sumido: ele estava do outro lado, atrás de um clique.
 */
export type FiltroProduto = 'todos' | 'publicados' | 'ocultos';

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
    SelectModule,
    DividerModule,
    ToolbarComponent,
    FormScreenComponent,
    PkButtonComponent,
    PkCheckboxComponent,
    PkColorPickerComponent,
    PkSegmentedComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './website.component.html',
  styleUrls: ['./website.component.scss'],
})
export class WebsiteComponent implements OnInit, TabDirtyCheck {

  /** Cadastro ou edição em andamento avisa antes de fechar a aba. */
  isTabDirty(): boolean {
    return (this.mode() === 'create' && this.createForm.dirty)
      || (this.mode() === 'edit' && this.editForm.dirty);
  }

  /**
   * A lista vem do store: esta tela cadastra e oculta, e o Guia monta catálogo
   * a partir dela — as duas abas veem a mesma coisa sem recarregar a página.
   */
  private readonly productStore = inject(WebsiteProductStore);
  readonly allProducts = this.productStore.items;
  readonly activeProducts = this.productStore.active;
  readonly hiddenProducts = this.productStore.hidden;

  readonly loading = this.productStore.loading;
  saving = signal(false);
  /** grade, edição ou cadastro — os dois formulários saíram do diálogo. */
  readonly mode = signal<'grid' | 'edit' | 'create'>('grid');
  editingProduct = signal<ProductWebSiteResponseDTO | null>(null);

  filtro = signal<FiltroProduto>('todos');
  termoBusca = '';

  selectedCreateImage: File | null = null;
  selectedEditImage: File | null = null;
  createImagePreview: string | null = null;
  editImagePreview: string | null = null;

  /** Equipamentos disponíveis para vincular ao produto (1 por produto). */
  equipamentos = signal<EquipmentResponseDTO[]>([]);

  /**
   * O que era aba virou recorte da mesma lista.
   *
   * As contagens continuam nos cards acima, sempre as três. O que sumiu foi o
   * badge da aba, que só mostrava o número do recorte selecionado: "Ocultos 4"
   * aparecia depois de clicar em Ocultos, e quem não clicava não tinha como
   * saber que existia.
   */
  readonly filtros: PkSegmentedOption[] = [
    { value: 'todos',      label: 'Todos' },
    { value: 'publicados', label: 'Publicados' },
    { value: 'ocultos',    label: 'Ocultos' },
  ];

  private _buscaTrigger = signal(0);

  editForm!: FormGroup;
  createForm!: FormGroup;

  produtosFiltrados = computed(() => {
    this._buscaTrigger();

    const lista =
      this.filtro() === 'publicados' ? this.activeProducts() :
      this.filtro() === 'ocultos'    ? this.hiddenProducts() :
                                       this.allProducts();

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
    private equipmentService: EquipmentService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initEditForm();
    this.initCreateForm();
    this.productStore.load();
    this.loadEquipamentos();
  }

  loadEquipamentos(): void {
    this.equipmentService.getAll().subscribe({
      next: (lista) => this.equipamentos.set(lista ?? []),
      error: () => this.equipamentos.set([]),
    });
  }

  initEditForm(): void {
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      active: [true],
      cores: [[]],
      finalidade: ['', Validators.required],
      diluicao: ['', Validators.required],
      concentracao: ['', Validators.required],
      localUso: ['', Validators.required],
      descricao: ['', Validators.required],
      descricaoGuia: [''],
      equipmentId: [null],
    });
  }

  initCreateForm(): void {
    this.createForm = this.fb.group({
      systemCode: ['', [Validators.required, Validators.minLength(2)]],
      // Desmarcado de propósito, e agora visível. O campo não existia: o JSON
      // ia sem a chave, o `boolean` primitivo da API virava `false`, e o
      // produto nascia oculto sem ninguém ter escolhido isso. O padrão
      // continua o mesmo — publicar sozinho um produto no site da empresa é
      // pior do que esquecer de publicar —, o que muda é que agora se vê.
      active: [false],
      name: ['', [Validators.required, Validators.minLength(2)]],
      cores: [[]],
      finalidade: ['', Validators.required],
      diluicao: ['', Validators.required],
      concentracao: ['', Validators.required],
      localUso: ['', Validators.required],
      descricao: ['', Validators.required],
      descricaoGuia: [''],
      equipmentId: [null],
    });
  }

  loadAllProducts(): void {
    this.productStore.refresh();
  }

  setFiltro(key: FiltroProduto): void {
    this.filtro.set(key);
    // A busca sobrevive à troca de recorte de propósito: com uma lista só,
    // "procurei X e mudei para Ocultos" é uma pergunta legítima. A aba antiga
    // limpava o campo, e o termo digitado sumia sem aviso.
    this.aplicarFiltro();
  }

  /** Usado pelo estado vazio, que oferece ver a lista inteira em vez de só dizer "nada aqui". */
  limparFiltros(): void {
    this.filtro.set('todos');
    this.termoBusca = '';
    this.aplicarFiltro();
  }

  aplicarFiltro(): void {
    this._buscaTrigger.update(v => v + 1);
  }

  openCreateDialog(): void {
    this.createForm.reset({
      systemCode: '',
      name: '',
      active: false,
      cores: [],
      finalidade: '',
      diluicao: '',
      concentracao: '',
      localUso: '',
      descricao: '',
      descricaoGuia: '',
      equipmentId: null,
    });

    this.selectedCreateImage = null;
    this.createImagePreview = null;
    this.mode.set('create');
  }

  closeCreateDialog(): void {
    this.mode.set('grid');
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
      concentracao: product.concentracao,
      localUso: product.localUso,
      descricao: product.descricao,
      descricaoGuia: product.descricaoGuia ?? '',
      equipmentId: product.equipmentId ?? null,
    });

    this.mode.set('edit');
  }

  closeDialog(): void {
    this.mode.set('grid');
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
    this.saving.set(true);

    this.productStore.create(dto, this.selectedCreateImage).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Produto cadastrado com sucesso!'
        });
        this.closeCreateDialog();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao cadastrar produto.'
        });
      },
      complete: () => this.saving.set(false),
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
    this.saving.set(true);

    this.productStore.update(dto, product.id, this.selectedEditImage).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Produto atualizado com sucesso!'
        });
        this.closeDialog();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao atualizar produto.'
        });
      },
      complete: () => this.saving.set(false),
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
    this.productStore.hide(product.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Produto ocultado',
          detail: `${product.name} foi ocultado do site.`
        });
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
    this.productStore.unhide(product.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Produto reexibido',
          detail: `${product.name} está visível no site novamente.`
        });
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

  /**
   * Texto legível (escuro/claro) para sobrepor a uma amostra de cor, na grade.
   *
   * O formulário não usa mais isto: quem cuida de cor lá é o `pk-color-picker`,
   * que traz a própria conta. Aqui ficou porque a tabela pinta os chips de cor
   * direto na linha.
   */
  corContraste(hex: string): string {
    const c = (hex || '').replace('#', '');
    if (c.length < 6) return '#1f2937';
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#1f2937' : '#ffffff';
  }

  resolverImagem(produto: ProductWebSiteResponseDTO): string {
    if (!produto.imagem) {
      return 'images/products/placeholder.png';
    }

    if (produto.imagem.startsWith('http')) {
      return produto.imagem;
    }

    const caminho = produto.imagem.startsWith('/') ? produto.imagem : `/${produto.imagem}`;
    return caminho;
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
