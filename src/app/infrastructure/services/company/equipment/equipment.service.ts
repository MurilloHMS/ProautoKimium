import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  EquipmentCreateDTO,
  EquipmentResponseDTO,
  EquipmentUpdateDTO
} from '../../../../domain/models/equipment.model';
import { environment } from '../../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class EquipmentService {

  private readonly baseUrl = `${environment.apiUrl}/product/website/equipment`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<EquipmentResponseDTO[]> {
    return this.http.get<EquipmentResponseDTO[]>(this.baseUrl);
  }

  create(dto: EquipmentCreateDTO, image: File): Observable<string> {
    const formData = new FormData();

    formData.append(
      'data',
      new Blob([JSON.stringify(dto)], { type: 'application/json' })
    );

    formData.append('image', image);

    return this.http.post(this.baseUrl, formData, { responseType: 'text' });
  }

  update(id: string, dto: EquipmentUpdateDTO, image: File | null): Observable<string> {
    const formData = new FormData();

    formData.append(
      'data',
      new Blob([JSON.stringify(dto)], { type: 'application/json' })
    );

    // O backend exige o part 'image' também na edição. Quando o usuário não
    // troca a imagem, reenviamos um placeholder vazio para que a parte exista.
    if (image) {
      formData.append('image', image);
    } else {
      formData.append(
        'image',
        new Blob([], { type: 'application/octet-stream' }),
        ''
      );
    }

    return this.http.put(`${this.baseUrl}/${id}`, formData, { responseType: 'text' });
  }

  delete(id: string): Observable<string> {
    return this.http.delete(`${this.baseUrl}/${id}`, { responseType: 'text' });
  }
}
