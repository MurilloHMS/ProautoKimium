import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { urlDeMidia } from '../../config/media-url';
import type {
  TemplateDeAssinatura, RespostaDeTemplate, RespostaDeFundo,
} from '../../../domain/models/assinatura-template.model';

/**
 * O template da assinatura de e-mail.
 *
 * A geração do PNG NÃO passa por aqui: ela acontece no navegador, em
 * `domain/utils/assinatura`. Este serviço só lê e grava o layout, e envia a
 * arte de fundo.
 */
@Injectable({
  providedIn: 'root',
})
export class EmailSignatureService {

  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/email/signature/template`;

  /**
   * O documento vem como texto e é decodificado aqui, num lugar só.
   *
   * Se o JSON estiver quebrado, `JSON.parse` lança — e é o certo. Um template
   * pela metade desenharia uma assinatura pela metade, sem ninguém perceber.
   */
  buscar(): Observable<TemplateDeAssinatura> {
    return this.http.get<RespostaDeTemplate>(this.url)
      .pipe(map(resposta => JSON.parse(resposta.document) as TemplateDeAssinatura));
  }

  salvar(template: TemplateDeAssinatura): Observable<TemplateDeAssinatura> {
    return this.http.put<RespostaDeTemplate>(this.url, { document: JSON.stringify(template) })
      .pipe(map(resposta => JSON.parse(resposta.document) as TemplateDeAssinatura));
  }

  /** Devolve o caminho gravado e o tamanho natural da imagem. */
  enviarFundo(arquivo: File): Observable<RespostaDeFundo> {
    const corpo = new FormData();
    corpo.append('file', arquivo);
    return this.http.post<RespostaDeFundo>(`${this.url}/background`, corpo);
  }

  /**
   * A arte de fundo como `Blob`, e nunca como URL.
   *
   * Desenhar imagem de outra origem contamina o canvas e faz `toBlob` lançar —
   * e a arte vem do host da API, que em produção é outro domínio. Blob não tem
   * origem: imune. É o mesmo caminho da galeria.
   */
  baixarFundo(caminho: string): Observable<Blob> {
    return this.http.get(urlDeMidia(caminho), { responseType: 'blob' });
  }

  /**
   * A arte padrão, que vem no bundle do site.
   *
   * É o que o template semeado usa (`fundo.caminho` nulo): assim o dia um não
   * depende de ninguém ter copiado arquivo para pasta nenhuma.
   */
  baixarFundoPadrao(): Observable<Blob> {
    return this.http.get('assets/assinatura/fundo-padrao.png', { responseType: 'blob' });
  }

  baixar(blob: Blob, nome = 'assinatura_email.png'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Copia o PNG para a área de transferência.
   *
   * É o que a pessoa realmente quer: o destino é colar no Outlook. Devolve
   * `false` em vez de lançar — navegador sem permissão de área de transferência
   * é caso previsto, e a tela oferece o download.
   */
  async copiar(png: Blob): Promise<boolean> {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return true;
    } catch {
      return false;
    }
  }
}
