import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ProductWebSiteCreateDTO,
  ProductWebSiteResponseDTO,
  ProductWebSiteUpdateDTO
} from '../../../../../domain/models/products.model';
import { environment } from '../../../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class WebsiteService {

  constructor(private http: HttpClient) {}

  getAllProducts(): Observable<ProductWebSiteResponseDTO[]> {
    return this.http.get<ProductWebSiteResponseDTO[]>(
      `${environment.apiUrl}/product/website`
    );
  }

  getAllActiveProducts(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/product/website/active`);
  }

  setHide(id: string): Observable<string> {
    return this.http.put(
      `${environment.apiUrl}/product/website/${id}/hide`,
      null,
      { responseType: 'text' }
    );
  }

  setUnhide(id: string): Observable<string> {
    return this.http.put(
      `${environment.apiUrl}/product/website/${id}/unhide`,
      null,
      { responseType: 'text' }
    );
  }

  create(entity: ProductWebSiteCreateDTO, imagem?: File | null): Observable<string> {
    const formData = new FormData();

    formData.append(
      'dados',
      new Blob([JSON.stringify(entity)], { type: 'application/json' })
    );

    if (imagem) {
      formData.append('imagem', imagem);
    }

    return this.http.post(
      `${environment.apiUrl}/product/website`,
      formData,
      { responseType: 'text' }
    );
  }

  update(entity: ProductWebSiteUpdateDTO, id: string, imagem?: File | null): Observable<string> {
    const formData = new FormData();

    formData.append(
      'dados',
      new Blob([JSON.stringify(entity)], { type: 'application/json' })
    );

    if (imagem) {
      formData.append('imagem', imagem);
    }

    return this.http.put(
      `${environment.apiUrl}/product/website/${id}`,
      formData,
      { responseType: 'text' }
    );
  }
}
