import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

/**
 * Ferramentas de PDF.
 *
 * Cada ferramenta devolve um arquivo, não JSON: a resposta vem como `blob` e o
 * nome do arquivo vem no `Content-Disposition`. Por isso os métodos entregam a
 * `HttpResponse` inteira em vez do corpo — sem os cabeçalhos, o download
 * perderia o nome que a API escolheu.
 */
@Injectable({ providedIn: 'root' })
export class PdfToolsService {

  private readonly http = inject(HttpClient);

  /** Remove a senha de um PDF protegido. A senha é a de abertura do arquivo. */
  unlock(file: File, password: string): Observable<HttpResponse<Blob>> {
    const form = new FormData();
    form.append('file', file);
    form.append('password', password);

    return this.http.post(`${environment.apiUrl}/tools/pdf/unlock`, form, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  /** Renomeia NFS-e em lote pelo conteúdo do arquivo. Responde um ZIP. */
  renameNfse(files: File[]): Observable<HttpResponse<Blob>> {
    const form = new FormData();
    files.forEach(file => form.append('files', file));

    return this.http.post(`${environment.apiUrl}/nfe/nfse/upload`, form, {
      responseType: 'blob',
      observe: 'response',
    });
  }
}

/**
 * Dispara o download de uma resposta de arquivo.
 *
 * Preferimos o nome que veio no `Content-Disposition`: é a API que sabe se
 * saiu um PDF ou um ZIP. `fallbackName` cobre o caso do cabeçalho não estar
 * exposto (CORS sem `Access-Control-Expose-Headers`), senão o navegador salva
 * como "download" sem extensão.
 *
 * Devolve `false` quando não veio conteúdo. Isso acontece de verdade: um 200
 * com corpo vazio (a API respondendo `body(null)`) baixaria um arquivo de 0
 * byte com cara de sucesso. Melhor a tela avisar do que o usuário descobrir
 * ao abrir o arquivo.
 */
export function downloadFileResponse(response: HttpResponse<Blob>, fallbackName: string): boolean {
  const blob = response.body;
  if (!blob || blob.size === 0) return false;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileNameFrom(response) ?? fallbackName;

  // O Firefox só dispara o clique de um link que esteja no documento, e
  // revogar a URL no mesmo tick pode cancelar o download antes de começar.
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return true;
}

function fileNameFrom(response: HttpResponse<Blob>): string | null {
  const disposition = response.headers.get('Content-Disposition');
  if (!disposition) return null;

  const match = /filename\*?=(?:UTF-8'')?"?([^;"]+)"?/i.exec(disposition);
  return match ? decodeURIComponent(match[1].trim()) : null;
}
