import { Injectable, computed, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import {
  ProductWebSiteCreateDTO,
  ProductWebSiteResponseDTO,
  ProductWebSiteUpdateDTO,
} from '../../domain/models/products.model';
import { WebsiteService } from '../services/company/products/website/website.service';
import { ReferenceStore } from './reference-store';

/**
 * Produtos do site.
 *
 * São duas telas sobre a mesma lista: Produtos do site cadastra e oculta, e o
 * Guia monta catálogo a partir dela. Com as duas abertas em abas, ocultar um
 * produto numa não sumia da outra — o Guia seguia oferecendo produto que já
 * não está no ar.
 */
@Injectable({ providedIn: 'root' })
export class WebsiteProductStore extends ReferenceStore<ProductWebSiteResponseDTO> {

  private readonly service = inject(WebsiteService);

  protected fetch(): Observable<ProductWebSiteResponseDTO[]> { return this.service.getAllProducts(); }
  protected idOf(item: ProductWebSiteResponseDTO): string { return item.id; }

  /** No ar e fora do ar — a tela de produtos separa as duas em abas. */
  readonly active = computed(() => this.items().filter(product => product.active));
  readonly hidden = computed(() => this.items().filter(product => !product.active));

  /**
   * Cadastro e edição são multipart e respondem texto, não o produto salvo:
   * sem o id gerado e sem o caminho da imagem processada, recarregar é o que
   * mantém a lista fiel ao servidor.
   */
  create(dto: ProductWebSiteCreateDTO, image?: File | null): Observable<string> {
    return this.refreshAfter(this.service.create(dto, image));
  }

  update(dto: ProductWebSiteUpdateDTO, id: string, image?: File | null): Observable<string> {
    return this.refreshAfter(this.service.update(dto, id, image));
  }

  hide(id: string): Observable<string> {
    return this.refreshAfter(this.service.setHide(id));
  }

  unhide(id: string): Observable<string> {
    return this.refreshAfter(this.service.setUnhide(id));
  }

  private refreshAfter(source: Observable<string>): Observable<string> {
    return source.pipe(tap(() => this.refresh()));
  }
}
