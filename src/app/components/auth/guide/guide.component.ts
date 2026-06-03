import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import {ProductWebSiteResponseDTO} from "../../../domain/models/products.model";
import {WebsiteService} from "../../../infrastructure/services/company/products/website/website.service";
import {environment} from "../../../../environments/environment";

@Component({
  selector: 'app-guide',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    SkeletonModule,
  ],
  templateUrl: './guide.component.html',
  styleUrl: './guide.component.scss',
})
export class GuideComponent implements OnInit {
  // ─── State ──────────────────────────────────────────────────────────────────
  products: ProductWebSiteResponseDTO[] = [];
  filteredProducts: ProductWebSiteResponseDTO[] = [];
  selectedProducts: ProductWebSiteResponseDTO[] = [];
  selectedIds = new Set<string>();

  searchTerm = '';
  guideTitle = '';
  logoFile: File | null = null;
  logoPreview: string | null = null;
  isDragging = false;

  loadingProducts = false;
  generating = false;

  titleInvalid = false;

  // ─── Computed ───────────────────────────────────────────────────────────────
  get allSelected(): boolean {
    return this.filteredProducts.length > 0 &&
      this.filteredProducts.every(p => this.selectedIds.has(p.id));
  }

  get canGenerate(): boolean {
    return this.guideTitle.trim().length > 0 && this.selectedProducts.length > 0;
  }

  constructor(private http: HttpClient,
              private service: WebsiteService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  // ─── Products ───────────────────────────────────────────────────────────────
  loadProducts(): void {
    this.loadingProducts = true;
    this.service.getAllProducts()
      .subscribe({
        next: (data) => {
          this.products = data;
          this.filteredProducts = [...data];
          this.loadingProducts = false;
        },
        error: () => {
          this.loadingProducts = false;
        }
      });
  }

  onSearch(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredProducts = [...this.products];
      return;
    }
    this.filteredProducts = this.products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.systemCode.toLowerCase().includes(term)
    );
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredProducts = [...this.products];
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
      this.filteredProducts.forEach(p => {
        if (!this.selectedIds.has(p.id)) {
          this.selectedIds.add(p.id);
          this.selectedProducts = [...this.selectedProducts, p];
        }
      });
    } else {
      this.filteredProducts.forEach(p => {
        this.selectedIds.delete(p.id);
      });
      this.selectedProducts = this.selectedProducts.filter(p => !this.filteredProducts.some(fp => fp.id === p.id));
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
  gerarGuia(): void {
    this.titleInvalid = !this.guideTitle.trim();
    if (!this.canGenerate) return;

    this.generating = true;

    const formData = new FormData();

    const requestPayload = {
      tituloGuia: this.guideTitle.trim(),
      productIds: this.selectedProducts.map(p => p.id),
    };
    formData.append('request', new Blob([JSON.stringify(requestPayload)], { type: 'application/json' }));

    if (this.logoFile) {
      formData.append('logoCliente', this.logoFile);
    } else {
      formData.append('logoCliente', new Blob([], { type: 'image/png' }), 'empty.png');
    }

    this.http.post(`${environment.apiUrl}/v1/reports/guide`, formData, { responseType: 'blob' })
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
        error: () => {
          this.generating = false;
        }
      });
  }
}
