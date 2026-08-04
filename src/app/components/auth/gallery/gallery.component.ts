import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GalleryService } from '../../../infrastructure/services/gallery/gallery.service';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { GalleryDocument, GalleryCategory, CreateGalleryDocumentDTO } from '../../../domain/models/gallery.model';
import { PkDialogComponent } from '../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';

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
  imports: [CommonModule, FormsModule, PkDialogComponent, PkButtonComponent],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements OnInit {
  documents = signal<GalleryDocument[]>([]);
  loading = signal(true);
  erro = signal(false);
  filtro = signal<Filtro>('TODOS');
  downloadingId = signal<string | null>(null);
  uploadDialogVisible = signal(false);
  uploading = signal(false);
  thumbnails = signal<Record<string, string>>({});

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
