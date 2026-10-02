import {
  Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkComboboxComponent } from '../../../theme/ProautoKimium/pk-combobox/pk-combobox.component';
import { PkCheckboxComponent } from '../../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component';
import { PkSegmentedComponent } from '../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { nomeNoGuia } from '../../../theme/ProautoKimium/pk-color-picker/pk-color-picker.component';
import { GuideLayoutService } from '../../../../infrastructure/services/guide-layout.service';
import { WebsiteProductStore } from '../../../../infrastructure/state/website-product.store';
import { urlDeMidia } from '../../../../infrastructure/config/media-url';
import { apiMessageOrFallback } from '../../../../domain/utils/api-error';
import type { ProductWebSiteResponseDTO } from '../../../../domain/models/products.model';
import type {
  ElementType, GuideBlock, GuideColumn, GuideElement, GuideFieldKind, GuideLayoutCatalog, GuideLayoutDocument,
  GuideLayoutVersionSummary, GuidePage, GuideSelection, HAlign, VAlign,
} from '../../../../domain/models/guide-layout.model';
import {
  BLOCK_GAP, BandKey, addBlock, addColumn, addElement, columnsTotal, layoutProblems, moveColumn, newBlock,
  pageSize, removeBlock, removeColumn, removeElement, shiftBlock, updateBlock, updateColumn, updateElement,
  updatePage, widthLeft,
} from '../../../../domain/utils/guide/layout-editor';

type SideTab = 'props' | 'preview';

/** Quanto esperar depois da última mudança antes de pedir a prévia à API. */
const PREVIEW_DEBOUNCE_MS = 1000;

/**
 * O editor do layout do Guia de Utilização — só para quem tem
 * `company/guide:CONFIGURAR` (o Design).
 *
 * <h2>Duas pranchas, uma verdade</h2>
 * A página da esquerda é HTML, desenhada para editar: arrastar, puxar a borda
 * da coluna, clicar na célula. Ela é uma APROXIMAÇÃO — o navegador não quebra
 * linha igual ao Jasper. Quem diz como sai é a aba "Prévia do PDF", que é o
 * arquivo de verdade, gerado pela API com o layout da tela (salvo ou não).
 *
 * <h2>Rascunho e publicação</h2>
 * Salvar grava o rascunho; ninguém mais vê. Publicar troca o guia de
 * Contratos. O botão Publicar salva antes, para nunca publicar algo diferente
 * do que está na tela.
 */
@Component({
  selector: 'app-guide-layout-editor',
  standalone: true,
  imports: [
    FormsModule, PkButtonComponent, PkInputComponent, PkComboboxComponent, PkCheckboxComponent,
    PkSegmentedComponent, PkDialogComponent,
  ],
  templateUrl: './guide-layout-editor.component.html',
  styleUrl: './guide-layout-editor.component.scss',
})
export class GuideLayoutEditorComponent {

  private readonly service = inject(GuideLayoutService);
  private readonly productStore = inject(WebsiteProductStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  private readonly desk = viewChild<ElementRef<HTMLElement>>('desk');

  // ── Estado ──────────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly notice = signal('');
  readonly actionError = signal('');

  readonly catalog = signal<GuideLayoutCatalog | null>(null);
  readonly layout = signal<GuideLayoutDocument | null>(null);

  /** O texto do que está no servidor: o rascunho, ou o publicado se não há rascunho. */
  private readonly savedText = signal('');
  readonly hasDraft = signal(false);
  readonly publishedVersion = signal<number | null>(null);

  readonly selection = signal<GuideSelection>({ kind: 'page' });
  readonly sideTab = signal<SideTab>('props');
  readonly scale = signal(1);

  readonly saving = signal(false);
  readonly publishing = signal(false);

  readonly publishOpen = signal(false);
  publishNote = '';
  readonly versionsOpen = signal(false);
  readonly versions = signal<GuideLayoutVersionSummary[]>([]);

  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly previewLoading = signal(false);
  readonly previewError = signal('');
  private previewObjectUrl: string | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;

  /** Imagens enviadas pelo designer, já como object URL (a rota exige token). */
  readonly uploadedImages = signal<Record<string, string>>({});

  // ── Derivados ───────────────────────────────────────────────────────────
  readonly dirty = computed(() => {
    const l = this.layout();
    return l !== null && JSON.stringify(l) !== this.savedText();
  });

  readonly size = computed(() => {
    const l = this.layout();
    return l ? pageSize(l.page) : null;
  });

  readonly problems = computed(() => {
    const l = this.layout();
    return l ? layoutProblems(l) : [];
  });

  readonly total = computed(() => {
    const l = this.layout();
    return l ? columnsTotal(l) : 0;
  });

  readonly left = computed(() => {
    const l = this.layout();
    return l ? widthLeft(l) : 0;
  });

  /** O publicado pode ser pedido quando há rascunho e ele passa no que a API vai checar. */
  readonly canPublish = computed(() =>
    (this.hasDraft() || this.dirty()) && this.problems().length === 0 && !this.saving() && !this.publishing());

  /** Três produtos de verdade, para a página não ser desenhada com texto inventado. */
  readonly samples = computed<ProductWebSiteResponseDTO[]>(() => this.productStore.items().slice(0, 3));

  readonly fieldOptions = computed(() => this.catalog()?.fields ?? []);
  readonly imageOptions = computed(() => this.catalog()?.imageSources ?? []);
  readonly fontOptions = computed(() => (this.catalog()?.fonts ?? []).map(f => ({ label: f, value: f })));

  readonly selectedElement = computed<GuideElement | null>(() => {
    const s = this.selection();
    const l = this.layout();
    return s.kind === 'element' && l ? l[s.band].elements[s.index] ?? null : null;
  });

  readonly selectedColumn = computed<GuideColumn | null>(() => {
    const s = this.selection();
    const l = this.layout();
    return s.kind === 'column' && l ? l.table.columns[s.index] ?? null : null;
  });

  readonly selectedBlock = computed<GuideBlock | null>(() => {
    const s = this.selection();
    const column = this.selectedColumn();
    return s.kind === 'column' && column && s.block !== null ? column.blocks[s.block] ?? null : null;
  });

  readonly formatOptions = [{ label: 'Carta', value: 'LETTER' }, { label: 'A4', value: 'A4' }];
  readonly orientationOptions = [{ label: 'Paisagem', value: 'LANDSCAPE' }, { label: 'Retrato', value: 'PORTRAIT' }];
  readonly alignOptions = [{ label: 'Esq.', value: 'LEFT' }, { label: 'Centro', value: 'CENTER' }, { label: 'Dir.', value: 'RIGHT' }];
  readonly valignOptions = [{ label: 'Topo', value: 'TOP' }, { label: 'Meio', value: 'MIDDLE' }, { label: 'Base', value: 'BOTTOM' }];
  readonly sideOptions = [{ label: 'Propriedades', value: 'props' }, { label: 'Prévia do PDF', value: 'preview' }];
  readonly elementTypes: { type: ElementType; label: string }[] = [
    { type: 'TEXT', label: 'Texto' }, { type: 'IMAGE', label: 'Imagem' },
    { type: 'RECTANGLE', label: 'Retângulo' }, { type: 'LINE', label: 'Linha' },
  ];
  readonly countOptions = [1, 2, 3, 4, 5, 6].map(n => ({ label: String(n), value: n }));

  readonly BLOCK_GAP = BLOCK_GAP;
  readonly bands: BandKey[] = ['header', 'footer'];

  constructor() {
    this.productStore.load();
    void this.load();

    // A prévia acompanha a tela: pedida 1 s depois da última mudança, e só
    // com a aba aberta — cada pedido compila e gera um PDF no servidor.
    effect(() => {
      const layout = this.layout();
      const tab = this.sideTab();
      const samples = this.samples();
      if (!layout || tab !== 'preview' || samples.length === 0) return;
      this.schedulePreview();
    });

    const observer = new ResizeObserver(() => this.measure());
    effect(() => {
      const el = this.desk()?.nativeElement;
      if (el) {
        observer.disconnect();
        observer.observe(el);
        this.measure();
      }
    });

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      if (this.previewTimer) clearTimeout(this.previewTimer);
      if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
      Object.values(this.uploadedImages()).forEach(url => URL.revokeObjectURL(url));
    });
  }

  // ── Carga ───────────────────────────────────────────────────────────────
  private async load(): Promise<void> {
    try {
      const [state, catalog] = await Promise.all([
        firstValueFrom(this.service.state()),
        firstValueFrom(this.service.catalog()),
      ]);
      this.catalog.set(catalog);
      this.publishedVersion.set(state.published.version);
      const current = state.draft ?? state.published;
      this.hasDraft.set(state.draft !== null);
      this.adopt(current.document);
    } catch (err) {
      this.loadError.set(await apiMessageOrFallback(err, 'Não foi possível carregar o layout do guia. Recarregue a página.'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Passa a editar este documento, que é também o que está no servidor. */
  private adopt(document: GuideLayoutDocument): void {
    this.layout.set(document);
    this.savedText.set(JSON.stringify(document));
    void this.loadUploadedImages(document);
  }

  private async loadUploadedImages(document: GuideLayoutDocument): Promise<void> {
    const ids = [...document.header.elements, ...document.footer.elements]
      .filter(e => e.type === 'IMAGE' && e.image === 'UPLOADED' && e.imageId)
      .map(e => e.imageId!)
      .filter(id => !this.uploadedImages()[id]);
    for (const id of ids) {
      try {
        const blob = await firstValueFrom(this.service.image(id));
        this.uploadedImages.update(m => ({ ...m, [id]: URL.createObjectURL(blob) }));
      } catch {
        // Sem a imagem, o editor mostra a caixa vazia. A prévia do PDF diz a verdade.
      }
    }
  }

  private measure(): void {
    const el = this.desk()?.nativeElement;
    const size = this.size();
    if (!el || !size) return;
    const available = el.clientWidth - 48;
    this.scale.set(Math.max(0.4, Math.min(1.6, available / size.width)));
  }

  // ── Ações da barra ──────────────────────────────────────────────────────
  async save(): Promise<boolean> {
    const layout = this.layout();
    if (!layout) return false;
    this.saving.set(true);
    this.actionError.set('');
    try {
      const saved = await firstValueFrom(this.service.saveDraft(layout));
      this.hasDraft.set(true);
      this.savedText.set(JSON.stringify(layout));
      this.flash(`Rascunho salvo. Contratos continua usando a v${this.publishedVersion()}.`);
      return saved !== null;
    } catch (err) {
      this.actionError.set(await apiMessageOrFallback(err, 'Não foi possível salvar o rascunho.'));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  openPublish(): void {
    this.publishNote = '';
    this.publishOpen.set(true);
  }

  async publish(): Promise<void> {
    this.publishing.set(true);
    this.actionError.set('');
    try {
      // Publica o que está na TELA: se há mudança não salva, ela vai junto.
      if (this.dirty() && !(await this.save())) return;
      const published = await firstValueFrom(this.service.publish(this.publishNote.trim() || null));
      this.publishedVersion.set(published.version);
      this.hasDraft.set(false);
      this.savedText.set(JSON.stringify(this.layout()));
      this.publishOpen.set(false);
      this.flash(`v${published.version} publicada. Todo guia gerado a partir de agora usa este layout.`);
    } catch (err) {
      this.actionError.set(await apiMessageOrFallback(err, 'Não foi possível publicar.'));
    } finally {
      this.publishing.set(false);
    }
  }

  async discard(): Promise<void> {
    this.actionError.set('');
    try {
      await firstValueFrom(this.service.discardDraft());
      const state = await firstValueFrom(this.service.state());
      this.hasDraft.set(false);
      this.selection.set({ kind: 'page' });
      this.adopt(state.published.document);
      this.flash('Rascunho descartado. A tela voltou para o layout publicado.');
    } catch (err) {
      this.actionError.set(await apiMessageOrFallback(err, 'Não foi possível descartar o rascunho.'));
    }
  }

  async openVersions(): Promise<void> {
    this.versionsOpen.set(true);
    try {
      this.versions.set(await firstValueFrom(this.service.versions()));
    } catch (err) {
      this.actionError.set(await apiMessageOrFallback(err, 'Não foi possível carregar as versões.'));
    }
  }

  async restore(version: GuideLayoutVersionSummary): Promise<void> {
    try {
      const draft = await firstValueFrom(this.service.restore(version.id));
      this.hasDraft.set(true);
      this.selection.set({ kind: 'page' });
      this.adopt(draft.document);
      this.versionsOpen.set(false);
      this.flash(`v${version.version} aberta como rascunho. Confira a prévia antes de publicar.`);
    } catch (err) {
      this.actionError.set(await apiMessageOrFallback(err, 'Não foi possível restaurar a versão.'));
    }
  }

  private flash(text: string): void {
    this.notice.set(text);
    setTimeout(() => {
      if (this.notice() === text) this.notice.set('');
    }, 4000);
  }

  // ── Prévia do PDF ───────────────────────────────────────────────────────
  private schedulePreview(): void {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => void this.refreshPreview(), PREVIEW_DEBOUNCE_MS);
  }

  async refreshPreview(): Promise<void> {
    const layout = this.layout();
    const ids = this.samples().map(p => p.id);
    if (!layout || ids.length === 0) return;
    if (this.problems().length) {
      this.previewError.set(this.problems()[0]);
      return;
    }
    this.previewLoading.set(true);
    this.previewError.set('');
    try {
      const blob = await firstValueFrom(this.service.preview(layout, ids, 'Exemplo'));
      if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = URL.createObjectURL(blob);
      // O PDF vem de um blob local; o iframe precisa da URL marcada como confiável.
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl + '#toolbar=0&view=FitH'));
    } catch (err) {
      this.previewError.set(await apiMessageOrFallback(err, 'Não foi possível gerar a prévia.'));
    } finally {
      this.previewLoading.set(false);
    }
  }

  // ── Seleção ─────────────────────────────────────────────────────────────
  selectPage(): void {
    this.selection.set({ kind: 'page' });
    this.sideTab.set('props');
  }

  selectElement(band: BandKey, index: number): void {
    this.selection.set({ kind: 'element', band, index });
    this.sideTab.set('props');
  }

  selectColumn(index: number, block: number | null = null): void {
    this.selection.set({ kind: 'column', index, block });
    this.sideTab.set('props');
  }

  /** Escolhe um bloco da coluna que já está selecionada. */
  selectBlock(block: number): void {
    const s = this.selection();
    if (s.kind === 'column') this.selectColumn(s.index, block);
  }

  isElementSelected(band: BandKey, index: number): boolean {
    const s = this.selection();
    return s.kind === 'element' && s.band === band && s.index === index;
  }

  isColumnSelected(index: number): boolean {
    const s = this.selection();
    return s.kind === 'column' && s.index === index;
  }

  isBlockSelected(column: number, block: number): boolean {
    const s = this.selection();
    return s.kind === 'column' && s.index === column && s.block === block;
  }

  // ── Arrastar itens do cabeçalho e do rodapé ─────────────────────────────
  startDrag(event: PointerEvent, band: BandKey, index: number): void {
    const layout = this.layout();
    if (!layout || event.button !== 0) return;
    event.preventDefault();
    this.selectElement(band, index);
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    // clientX/Y e não offsetX: o offset é relativo ao alvo do evento, que muda
    // entre a caixa e o que está dentro dela — o item pularia no começo.
    const start = { x: event.clientX, y: event.clientY };
    const origin = layout[band].elements[index];
    const scale = this.scale();

    const move = (e: PointerEvent) => {
      const current = this.layout();
      if (!current) return;
      this.layout.set(updateElement(current, band, index, {
        x: origin.x + (e.clientX - start.x) / scale,
        y: origin.y + (e.clientY - start.y) / scale,
      }));
    };
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }

  startResize(event: PointerEvent, band: BandKey, index: number): void {
    const layout = this.layout();
    if (!layout) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY };
    const origin = layout[band].elements[index];
    const scale = this.scale();

    const move = (e: PointerEvent) => {
      const current = this.layout();
      if (!current) return;
      this.layout.set(updateElement(current, band, index, {
        width: origin.width + (e.clientX - start.x) / scale,
        height: origin.height + (e.clientY - start.y) / scale,
      }));
    };
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
  }

  /** Setas movem 1 pt; com Shift, 10 pt. */
  nudge(event: KeyboardEvent, band: BandKey, index: number): void {
    const step = event.shiftKey ? 10 : 1;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const d = delta[event.key];
    const layout = this.layout();
    if (!d || !layout) return;
    event.preventDefault();
    const e = layout[band].elements[index];
    this.selectElement(band, index);
    this.layout.set(updateElement(layout, band, index, { x: e.x + d[0], y: e.y + d[1] }));
  }

  // ── Colunas: largura e ordem ────────────────────────────────────────────
  startColumnResize(event: PointerEvent, index: number): void {
    const layout = this.layout();
    if (!layout) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const origin = layout.table.columns[index].width;
    const scale = this.scale();

    const move = (e: PointerEvent) => {
      const current = this.layout();
      if (current) this.layout.set(updateColumn(current, index, { width: origin + (e.clientX - startX) / scale }));
    };
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      this.selectColumn(index);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
  }

  private dragFrom: number | null = null;
  readonly dropTarget = signal<number | null>(null);

  onColumnDragStart(event: DragEvent, index: number): void {
    this.dragFrom = index;
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onColumnDragOver(event: DragEvent, index: number): void {
    if (this.dragFrom === null) return;
    event.preventDefault();
    this.dropTarget.set(index);
  }

  onColumnDrop(event: DragEvent, index: number): void {
    event.preventDefault();
    const from = this.dragFrom;
    this.dragFrom = null;
    this.dropTarget.set(null);
    const layout = this.layout();
    if (from === null || from === index || !layout) return;
    this.layout.set(moveColumn(layout, from, index));
    this.selectColumn(index);
  }

  onColumnDragEnd(): void {
    this.dragFrom = null;
    this.dropTarget.set(null);
  }

  // ── Edição pelo painel ──────────────────────────────────────────────────
  private edit(change: (l: GuideLayoutDocument) => GuideLayoutDocument): void {
    const layout = this.layout();
    if (layout) this.layout.set(change(layout));
  }

  setPage(patch: Partial<GuidePage>): void {
    this.edit(l => updatePage(l, patch));
  }

  setMargin(side: keyof GuidePage['margins'], value: unknown): void {
    const n = this.toNumber(value);
    if (n === null) return;
    this.edit(l => updatePage(l, { margins: { ...l.page.margins, [side]: Math.max(0, n) } }));
  }

  setTable(patch: Partial<GuideLayoutDocument['table']>): void {
    this.edit(l => ({ ...l, table: { ...l.table, ...patch } }));
  }

  setBandHeight(band: BandKey, value: unknown): void {
    const n = this.toNumber(value);
    if (n !== null) this.edit(l => ({ ...l, [band]: { ...l[band], height: Math.max(0, Math.round(n)) } }));
  }

  addElementTo(band: BandKey, type: ElementType): void {
    this.edit(l => addElement(l, band, type));
    const l = this.layout()!;
    this.selectElement(band, l[band].elements.length - 1);
  }

  setElement(patch: Partial<GuideElement>): void {
    const s = this.selection();
    if (s.kind === 'element') this.edit(l => updateElement(l, s.band, s.index, patch));
  }

  setElementNumber(key: 'x' | 'y' | 'width' | 'height' | 'fontSize', value: unknown): void {
    const n = this.toNumber(value);
    if (n !== null) this.setElement({ [key]: n });
  }

  deleteElement(): void {
    const s = this.selection();
    if (s.kind !== 'element') return;
    this.edit(l => removeElement(l, s.band, s.index));
    this.selectPage();
  }

  async uploadImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const saved = await firstValueFrom(this.service.uploadImage(file));
      this.uploadedImages.update(m => ({ ...m, [saved.id]: URL.createObjectURL(file) }));
      this.setElement({ image: 'UPLOADED', imageId: saved.id });
    } catch (err) {
      this.actionError.set(await apiMessageOrFallback(err, 'Não foi possível enviar a imagem.'));
    }
  }

  addColumnToTable(): void {
    this.edit(l => addColumn(l));
    this.selectColumn(this.layout()!.table.columns.length - 1);
  }

  setColumn(patch: Partial<GuideColumn>): void {
    const s = this.selection();
    if (s.kind === 'column') this.edit(l => updateColumn(l, s.index, patch));
  }

  setColumnNumber(key: 'width' | 'paddingTop', value: unknown): void {
    const n = this.toNumber(value);
    if (n !== null) this.setColumn({ [key]: Math.max(0, n) });
  }

  shiftColumn(direction: -1 | 1): void {
    const s = this.selection();
    if (s.kind !== 'column') return;
    const to = s.index + direction;
    if (to < 0 || to >= this.layout()!.table.columns.length) return;
    this.edit(l => moveColumn(l, s.index, to));
    this.selectColumn(to);
  }

  deleteColumn(): void {
    const s = this.selection();
    if (s.kind !== 'column') return;
    this.edit(l => removeColumn(l, s.index));
    this.selectPage();
    this.flash(`Coluna tirada. Sobram ${this.left()} pt para distribuir entre as outras.`);
  }

  addBlockToColumn(field: string | null): void {
    const s = this.selection();
    const def = this.fieldOptions().find(f => f.key === field);
    if (s.kind !== 'column' || !def) return;
    this.edit(l => addBlock(l, s.index, newBlock(def.key, def.kind)));
    this.selectColumn(s.index, this.layout()!.table.columns[s.index].blocks.length - 1);
  }

  setBlock(patch: Partial<GuideBlock>): void {
    const s = this.selection();
    if (s.kind === 'column' && s.block !== null) this.edit(l => updateBlock(l, s.index, s.block!, patch));
  }

  setBlockNumber(key: 'height' | 'fontSize', value: unknown): void {
    const n = this.toNumber(value);
    if (n !== null) this.setBlock({ [key]: n });
  }

  moveBlock(block: number, direction: -1 | 1): void {
    const s = this.selection();
    if (s.kind !== 'column') return;
    this.edit(l => shiftBlock(l, s.index, block, direction));
    this.selectColumn(s.index, block + direction);
  }

  deleteBlock(block: number): void {
    const s = this.selection();
    if (s.kind !== 'column') return;
    this.edit(l => removeBlock(l, s.index, block));
    this.selectColumn(s.index, null);
  }

  private toNumber(value: unknown): number | null {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  // ── Desenho da página (aproximação em HTML) ─────────────────────────────
  px(points: number): number {
    return points * this.scale();
  }

  columnX(index: number): number {
    return (this.layout()?.table.columns ?? []).slice(0, index).reduce((sum, c) => sum + c.width, 0);
  }

  fieldLabel(key: string): string {
    return this.fieldOptions().find(f => f.key === key)?.label ?? key;
  }

  fieldKind(key: string): GuideFieldKind {
    return this.fieldOptions().find(f => f.key === key)?.kind ?? 'TEXT';
  }

  imageLabel(key: string | null | undefined): string {
    return this.imageOptions().find(o => o.key === key)?.label ?? 'Imagem';
  }

  elementText(e: GuideElement): string {
    return (e.text ?? '').replace('{titulo}', 'EXEMPLO');
  }

  justify(align: HAlign | null | undefined): string {
    return align === 'CENTER' ? 'center' : align === 'RIGHT' ? 'flex-end' : 'flex-start';
  }

  alignItems(align: VAlign | null | undefined): string {
    return align === 'TOP' ? 'flex-start' : align === 'BOTTOM' ? 'flex-end' : 'center';
  }

  /** O texto que o PDF imprimiria para este produto. "—" onde a ausência é informação. */
  cellText(field: string, p: ProductWebSiteResponseDTO): string {
    const values: Record<string, string | null | undefined> = {
      NAME: p.name,
      CODE: p.systemCode,
      COLOR_NAME: (p.cores ?? []).map(c => nomeNoGuia(c) ?? c).filter((v, i, a) => a.indexOf(v) === i).join(' / '),
      PURPOSE: p.finalidade,
      DESCRIPTION: p.descricaoGuia || p.descricao,
      DILUTION: p.diluicao,
      CONCENTRATION: p.concentracao,
      USAGE_AREA: p.localUso,
      EQUIPMENT_NAMES: 'Equipamento',
    };
    if (!(field in values)) return `[${this.fieldLabel(field)}]`;
    const value = values[field];
    if (value && value.trim()) return value;
    return ['NAME', 'COLOR_NAME', 'DESCRIPTION'].includes(field) ? '' : '—';
  }

  photoUrl(p: ProductWebSiteResponseDTO): string {
    return urlDeMidia(p.imagem);
  }

  repeat(count: number | null | undefined): number[] {
    return Array.from({ length: Math.max(1, count ?? 1) }, (_, i) => i);
  }
}
