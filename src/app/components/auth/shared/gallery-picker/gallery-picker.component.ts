import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';

import { GalleryCategory, GalleryDocument } from '../../../../domain/models/gallery.model';
import { GalleryService } from '../../../../infrastructure/services/gallery/gallery.service';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';

/** O que o pai recebe ao escolher: o id que vai para a API e o que mostrar na tela. */
export interface GalleryEscolha {
  documento: GalleryDocument;
  previewUrl: string;
}

/**
 * Escolher uma imagem já existente na galeria, em vez de subir a mesma arte
 * duas vezes.
 *
 * **A miniatura não é uma URL, é um blob.** `GET /api/gallery/{id}/file` exige
 * autenticação e responde `Content-Disposition: attachment` — um `<img src>`
 * apontado para lá não renderiza nada. Por isso cada imagem é baixada pelo
 * HttpClient (que carrega o token) e vira um object URL. É o mesmo caminho que
 * a tela da galeria já faz.
 *
 * O filtro por categoria é feito aqui e não na API de propósito: o
 * `GalleryDocumentResponseDTO` já devolve `category`, e o que trafega é
 * metadado — as imagens são requisições separadas, e só as da categoria
 * escolhida são baixadas.
 *
 * **Escolher aqui não aponta o produto para a galeria.** A API copia os bytes
 * para o acervo do produto. Quem depende disso é a vitrine pública, que serve
 * `/upload/images` sem autenticação, e o guia, que lê a imagem do disco.
 */
@Component({
  selector: 'app-gallery-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, SkeletonModule,
            PkDialogComponent, PkButtonComponent],
  templateUrl: './gallery-picker.component.html',
  styleUrl: './gallery-picker.component.scss',
})
export class GalleryPickerComponent implements OnDestroy {

  private readonly galleryService = inject(GalleryService);

  visible = input<boolean>(false);
  categoria = input<GalleryCategory>('PRODUCT');
  titulo = input<string>('Escolher da galeria');

  visibleChange = output<boolean>();
  escolhido = output<GalleryEscolha>();

  readonly carregando = signal(false);
  readonly erro = signal(false);
  readonly documentos = signal<GalleryDocument[]>([]);
  readonly miniaturas = signal<Record<string, string>>({});

  /** Registro que existe no banco e não no disco — o card fica cinza em vez de girar para sempre. */
  readonly quebrados = signal<Set<string>>(new Set());

  readonly selecionado = signal<string | null>(null);

  termo = '';
  private readonly buscaTrigger = signal(0);

  private jaCarregou = false;

  constructor() {
    // Carrega só ao abrir pela primeira vez. Baixar a galeria inteira no
    // ngOnInit custaria uma requisição por imagem numa tela onde talvez
    // ninguém clique no botão.
    effect(() => {
      if (this.visible() && !this.jaCarregou) {
        this.jaCarregou = true;
        this.carregar();
      }
    });
  }

  readonly filtrados = computed(() => {
    this.buscaTrigger();

    const termo = this.termo.toLowerCase().trim();
    const lista = this.documentos();
    if (!termo) return lista;

    return lista.filter(d =>
      (d.title ?? '').toLowerCase().includes(termo) ||
      (d.description ?? '').toLowerCase().includes(termo) ||
      (d.originalFilename ?? '').toLowerCase().includes(termo)
    );
  });

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(false);

    this.galleryService.list().subscribe({
      next: (todos) => {
        const daCategoria = (todos ?? []).filter(d =>
          d.category === this.categoria() && this.ehImagem(d)
        );

        this.documentos.set(daCategoria);
        this.carregando.set(false);
        this.baixarMiniaturas(daCategoria);
      },
      error: () => {
        this.erro.set(true);
        this.carregando.set(false);
      },
    });
  }

  private baixarMiniaturas(docs: GalleryDocument[]): void {
    for (const doc of docs) {
      this.galleryService.download(doc.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.miniaturas.update(mapa => ({ ...mapa, [doc.id]: url }));
        },
        error: () => this.quebrados.update(set => new Set(set).add(doc.id)),
      });
    }
  }

  private ehImagem(doc: GalleryDocument): boolean {
    return !!doc.contentType?.startsWith('image/');
  }

  selecionar(doc: GalleryDocument): void {
    if (this.quebrados().has(doc.id)) return;
    this.selecionado.set(doc.id);
  }

  confirmar(): void {
    const id = this.selecionado();
    if (!id) return;

    const documento = this.documentos().find(d => d.id === id);
    const previewUrl = this.miniaturas()[id];
    if (!documento || !previewUrl) return;

    this.escolhido.emit({ documento, previewUrl });
    this.fechar();
  }

  fechar(): void {
    this.selecionado.set(null);
    this.visibleChange.emit(false);
  }

  aplicarBusca(): void {
    this.buscaTrigger.update(v => v + 1);
  }

  limparBusca(): void {
    this.termo = '';
    this.aplicarBusca();
  }

  /**
   * Object URL é memória presa até alguém soltar.
   *
   * A escolhida não é revogada aqui: o pai está usando ela como preview, e
   * revogar deixaria a imagem quebrada na tela dele.
   */
  ngOnDestroy(): void {
    const escolhida = this.selecionado();
    for (const [id, url] of Object.entries(this.miniaturas())) {
      if (id !== escolhida) URL.revokeObjectURL(url);
    }
  }
}
