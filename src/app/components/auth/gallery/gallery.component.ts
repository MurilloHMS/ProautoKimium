import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GalleryService } from '../../../infrastructure/services/gallery/gallery.service';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { GalleryDocument, GalleryCategory, CreateGalleryDocumentDTO } from '../../../domain/models/gallery.model';
import { PkDialogComponent } from '../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';

type Filtro = 'TODOS' | GalleryCategory;

interface CategoryTab {
  key: Filtro;
  label: string;
  icon: string;
  accent: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule, PkDialogComponent, PkButtonComponent, PageHeaderComponent],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements OnInit {
  documents = signal<GalleryDocument[]>([]);
  loading = signal(true);
  erro = signal(false);
  filtro = signal<Filtro>('TODOS');
  downloadingId = signal<string | null>(null);
  sharingId = signal<string | null>(null);

  /** Aviso curto no rodapé — o compartilhamento falha em silêncio sem isso. */
  aviso = signal('');
  private avisoTimer?: ReturnType<typeof setTimeout>;
  uploadDialogVisible = signal(false);
  uploading = signal(false);
  thumbnails = signal<Record<string, string>>({});
  viewerDoc = signal<GalleryDocument | null>(null);

  uploadTitle = '';
  uploadDescription = '';
  uploadCategory: GalleryCategory = 'PRODUCT';
  selectedFile: File | null = null;
  filePreview: string | null = null;

  isAdmin = false;

  categories: CategoryTab[] = [
    { key: 'TODOS',   label: 'Todos',           icon: 'pi pi-th-large', accent: '' },
    { key: 'PRODUCT', label: 'Fotos Produtos',  icon: 'pi pi-camera',   accent: '#e07b4c' },
    { key: 'LOGO',    label: 'Logos',            icon: 'pi pi-palette',  accent: '#7c5cbf' },
    { key: 'CATALOG', label: 'Catálogos',        icon: 'pi pi-book',     accent: '#3e9e8e' },
    { key: 'HOLIDAY', label: 'Datas Comemorativas', icon: 'pi pi-star-fill', accent: '#c0455e' },
  ];

  filtrados = computed(() => {
    const f = this.filtro();
    const all = this.documents();
    return f === 'TODOS' ? all : all.filter(d => d.category === f);
  });

  constructor(
    private galleryService: GalleryService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole(['ADMIN', 'DESIGN']);
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.loading.set(true);
    this.galleryService.list().subscribe({
      next: (data) => {
        this.documents.set(data ?? []);
        this.loading.set(false);
        this.loadThumbnails(data ?? []);
      },
      error: () => {
        this.erro.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadThumbnails(docs: GalleryDocument[]): void {
    const imageDocs = docs.filter(d => this.isImage(d));
    for (const doc of imageDocs) {
      this.galleryService.download(doc.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.thumbnails.update(map => ({ ...map, [doc.id]: url }));
        },
      });
    }
  }

  setFiltro(f: Filtro): void {
    this.filtro.set(f);
  }

  getCategoryTab(category: GalleryCategory): CategoryTab {
    return this.categories.find(c => c.key === category) ?? this.categories[0];
  }

  isImage(doc: GalleryDocument): boolean {
    return doc.contentType?.startsWith('image/') ?? false;
  }

  openViewer(doc: GalleryDocument): void {
    if (this.isImage(doc) && this.thumbnails()[doc.id]) {
      this.viewerDoc.set(doc);
    }
  }

  closeViewer(): void {
    this.viewerDoc.set(null);
  }

  download(doc: GalleryDocument): void {
    this.downloadingId.set(doc.id);
    this.galleryService.download(doc.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.originalFilename;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingId.set(null);
      },
      error: () => this.downloadingId.set(null),
    });
  }

  /**
   * Manda o arquivo para o WhatsApp pelo caminho mais curto que o navegador
   * oferecer.
   *
   * No celular é a folha nativa de compartilhamento (`navigator.share` com
   * arquivo), que lista o WhatsApp junto com o resto — um toque e acabou. É
   * para isso que a tela existe: a equipe abre a galeria no telefone e
   * reencaminha a arte do dia.
   *
   * `wa.me` não serve aqui: aquele link só carrega texto, e a imagem da galeria
   * está atrás de autenticação — o destinatário receberia uma URL que ele não
   * consegue abrir.
   */
  async share(doc: GalleryDocument): Promise<void> {
    if (this.sharingId()) return;

    this.sharingId.set(doc.id);

    try {
      const file = await this.fileFor(doc);

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: doc.title, text: doc.description || doc.title });
        return;
      }

      // Desktop quase nunca compartilha arquivo. Copiar a imagem faz o Ctrl+V
      // funcionar no WhatsApp Web, que é o mesmo destino por outro caminho.
      if (await this.copyImage(file)) {
        this.flash('Imagem copiada. Cole no WhatsApp com Ctrl+V.');
        return;
      }

      this.download(doc);
      this.flash('Seu navegador não compartilha arquivos. Baixamos a imagem para você anexar.');
    } catch (err) {
      // Fechar a folha de compartilhamento cancela a promessa. Não é falha.
      if ((err as DOMException)?.name !== 'AbortError') {
        this.flash('Não foi possível compartilhar agora.');
      }
    } finally {
      this.sharingId.set(null);
    }
  }

  /**
   * A miniatura já está no navegador como object URL — reaproveitar evita uma
   * segunda ida à API e é o que faz o compartilhamento parecer instantâneo.
   */
  private async fileFor(doc: GalleryDocument): Promise<File> {
    const cached = this.thumbnails()[doc.id];

    const blob = cached
      ? await (await fetch(cached)).blob()
      : await firstValueFrom(this.galleryService.download(doc.id));

    return new File([blob], doc.originalFilename, { type: blob.type || doc.contentType });
  }

  /** A área de transferência só aceita PNG de forma confiável; o resto é convertido. */
  private async copyImage(file: File): Promise<boolean> {
    if (!file.type.startsWith('image/') || typeof ClipboardItem === 'undefined') return false;

    try {
      const png = file.type === 'image/png' ? file : await this.toPng(file);
      if (!png) return false;

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return true;
    } catch {
      return false;
    }
  }

  private async toPng(file: Blob): Promise<Blob | null> {
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
      bitmap.close();

      return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    } catch {
      return null;
    }
  }

  private flash(message: string): void {
    clearTimeout(this.avisoTimer);
    this.aviso.set(message);
    this.avisoTimer = setTimeout(() => this.aviso.set(''), 5000);
  }

  openUploadDialog(): void {
    this.uploadTitle = '';
    this.uploadDescription = '';
    this.uploadCategory = 'PRODUCT';
    this.selectedFile = null;
    this.filePreview = null;
    this.uploadDialogVisible.set(true);
  }

  closeUploadDialog(): void {
    if (this.filePreview) {
      URL.revokeObjectURL(this.filePreview);
    }
    this.uploadDialogVisible.set(false);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile = file;
    if (this.filePreview) URL.revokeObjectURL(this.filePreview);
    this.filePreview = file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
  }

  submitUpload(): void {
    if (!this.selectedFile || !this.uploadTitle.trim()) return;

    this.uploading.set(true);
    const dto: CreateGalleryDocumentDTO = {
      title: this.uploadTitle.trim(),
      description: this.uploadDescription.trim(),
      category: this.uploadCategory,
    };

    this.galleryService.upload(dto, this.selectedFile).subscribe({
      next: () => {
        this.uploading.set(false);
        this.closeUploadDialog();
        this.loadDocuments();
      },
      error: () => {
        this.uploading.set(false);
      },
    });
  }

  deleteDoc(doc: GalleryDocument): void {
    this.galleryService.delete(doc.id).subscribe({
      next: () => this.loadDocuments(),
    });
  }
}
