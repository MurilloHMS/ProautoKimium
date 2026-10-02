import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import {ProductWebSiteResponseDTO} from "../../../domain/models/products.model";
import {WebsiteProductStore} from "../../../infrastructure/state/website-product.store";
import {PkInputComponent} from "../../theme/ProautoKimium/pk-input/pk-input.component";
import {PkSegmentedComponent} from "../../theme/ProautoKimium/pk-segmented/pk-segmented.component";
import {PkButtonComponent} from "../../theme/ProautoKimium/pk-button/pk-button.component";
import {PermissionStore} from "../../../infrastructure/state/permission.store";
import {GuideLayoutService} from "../../../infrastructure/services/guide-layout.service";
import {apiMessageOrFallback} from "../../../domain/utils/api-error";
import {GuideLayoutEditorComponent} from "./layout-editor/guide-layout-editor.component";

type GuideMode = 'gerar' | 'layout';

/** A tela é uma só: INCLUIR gera guia (Contratos), CONFIGURAR edita o layout (Design). */
export const GUIDE_SCREEN = 'company/guide';

@Component({
  selector: 'app-guide',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    SkeletonModule,
    PkInputComponent,
    PkSegmentedComponent,
    PkButtonComponent,
    GuideLayoutEditorComponent,
  ],
  templateUrl: './guide.component.html',
  styleUrl: './guide.component.scss',
})
export class GuideComponent implements OnInit {
  private readonly permissions = inject(PermissionStore);
  private readonly layoutService = inject(GuideLayoutService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  // ─── Modo ───────────────────────────────────────────────────────────────────
  /**
   * Quem só gera (Contratos) nunca vê o Layout; quem só edita (Design) cai
   * direto nele. As duas permissões juntas mostram a troca.
   */
  readonly canGenerate = computed(() => this.permissions.can(GUIDE_SCREEN, 'INCLUIR'));
  readonly canEditLayout = computed(() => this.permissions.can(GUIDE_SCREEN, 'CONFIGURAR'));
  readonly mode = signal<GuideMode>('gerar');
  readonly modeOptions = [
    { label: 'Gerar', value: 'gerar' },
    { label: 'Layout', value: 'layout' },
  ];
  readonly showLayout = computed(() => this.canEditLayout() && (this.mode() === 'layout' || !this.canGenerate()));

  // ─── Prévia e erros do Gerar ────────────────────────────────────────────────
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly previewLoading = signal(false);
  readonly error = signal('');
  private previewObjectUrl: string | null = null;

  // ─── State ──────────────────────────────────────────────────────────────────
  /**
   * A lista é a mesma de Produtos do site, e é a lista **inteira**: `items()`,
   * não `active()`.
   *
   * Ocultar um produto lá **não** tira ele daqui — ocultar decide só a vitrine
   * do site. O guia mostra o oculto marcado, e o PDF sai com ele. É o que
   * impede a tela de produtos de passar a publicar por padrão.
   */
  private readonly productStore = inject(WebsiteProductStore);
  readonly products = this.productStore.items;
  readonly loadingProducts = this.productStore.loading;

  /** A busca é sobre um campo com ngModel, então precisa de um gatilho próprio. */
  private readonly searchTrigger = signal(0);

  readonly filteredProducts = computed(() => {
    this.searchTrigger();

    const term = this.searchTerm.toLowerCase().trim();
    const list = this.products();
    if (!term) return list;

    return list.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.systemCode.toLowerCase().includes(term)
    );
  });

  selectedProducts: ProductWebSiteResponseDTO[] = [];
  selectedIds = new Set<string>();

  searchTerm = '';
  guideTitle = '';
  logoFile: File | null = null;
  logoPreview: string | null = null;
  isDragging = false;

  generating = false;

  titleInvalid = false;

  // ─── Computed ───────────────────────────────────────────────────────────────
  get allSelected(): boolean {
    return this.filteredProducts().length > 0 &&
      this.filteredProducts().every(p => this.selectedIds.has(p.id));
  }

  get readyToGenerate(): boolean {
    return this.guideTitle.trim().length > 0 && this.selectedProducts.length > 0;
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
    });
  }

  ngOnInit(): void {
    this.productStore.load();
  }

  // ─── Products ───────────────────────────────────────────────────────────────
  onSearch(): void {
    this.searchTrigger.update(v => v + 1);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearch();
  }

  trackById(_: number, product: ProductWebSiteResponseDTO): string {
    return product.id;
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleProduct(product: ProductWebSiteResponseDTO): void {
    if (this.selectedIds.has(product.id)) {
      this.selectedIds.delete(product.id);
      this.selectedProducts = this.selectedProducts.filter(p => p.id !== product.id);
    } else {
      this.selectedIds.add(product.id);
      this.selectedProducts = [...this.selectedProducts, product];
    }
  }

  toggleAll(checked: boolean): void {
    if (checked) {
      this.filteredProducts().forEach(p => {
        if (!this.selectedIds.has(p.id)) {
          this.selectedIds.add(p.id);
          this.selectedProducts = [...this.selectedProducts, p];
        }
      });
    } else {
      this.filteredProducts().forEach(p => {
        this.selectedIds.delete(p.id);
      });
      this.selectedProducts = this.selectedProducts.filter(p => !this.filteredProducts().some(fp => fp.id === p.id));
    }
  }

  // ─── Logo ───────────────────────────────────────────────────────────────────
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.setLogo(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(): void {
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
      this.setLogo(file);
    }
  }

  setLogo(file: File): void {
    this.logoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.logoPreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeLogo(event: Event): void {
    event.stopPropagation();
    this.logoFile = null;
    this.logoPreview = null;
  }

  // ─── Generate ───────────────────────────────────────────────────────────────
  /** Baixa o PDF. O desenho é sempre o do layout publicado. */
  gerarGuia(): void {
    this.titleInvalid = !this.guideTitle.trim();
    if (!this.readyToGenerate) return;

    this.generating = true;
    this.error.set('');
    this.layoutService.generate(this.guideTitle.trim(), this.selectedProducts.map(p => p.id), this.logoFile, false)
      .subscribe({
        next: (blob) => {
          this.generating = false;
          const filename = `guia-${this.guideTitle.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.pdf`;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: async (err) => {
          this.generating = false;
          this.error.set(await apiMessageOrFallback(err, 'Não foi possível gerar o guia. Tente de novo.'));
        }
      });
  }

  /** O mesmo PDF do download, mostrado aqui antes de baixar. */
  verPrevia(): void {
    this.titleInvalid = !this.guideTitle.trim();
    if (!this.readyToGenerate) return;

    this.previewLoading.set(true);
    this.error.set('');
    this.layoutService.generate(this.guideTitle.trim(), this.selectedProducts.map(p => p.id), this.logoFile, true)
      .subscribe({
        next: (blob) => {
          this.previewLoading.set(false);
          if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
          this.previewObjectUrl = URL.createObjectURL(blob);
          this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl + '#view=FitH'));
        },
        error: async (err) => {
          this.previewLoading.set(false);
          this.error.set(await apiMessageOrFallback(err, 'Não foi possível gerar a prévia. Tente de novo.'));
        }
      });
  }
}
