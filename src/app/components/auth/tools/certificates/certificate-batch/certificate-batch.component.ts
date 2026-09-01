import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TextareaModule } from 'primeng/textarea';

import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { CertificateService } from '../../../../../infrastructure/services/certificate/certificate.service';
import { downloadFileResponse } from '../../../../../infrastructure/services/tools/pdf-tools.service';

/** O que a tela entendeu da lista colada, antes de mandar qualquer coisa. */
interface AnaliseDaLista {
  nomes: string[];
  linhasEmBranco: number;
  repetidos: number;
  excedente: number;
}

/**
 * Gera um certificado por nome e devolve tudo num ZIP.
 *
 * A entrada é um `textarea` de propósito: a lista quase sempre vem colada de
 * uma coluna do Excel, e um campo por nome transformaria isso em cinquenta
 * cliques. Uma linha, um nome.
 *
 * **A tela mostra o que entendeu antes de gerar.** Colar uma coluna traz linha
 * em branco e nome repetido sem ninguém perceber, e o erro só apareceria no
 * ZIP — depois de esperar a geração. Aqui a contagem aparece enquanto se
 * digita, e o botão diz quantos certificados vai produzir.
 *
 * O limite de 200 é o mesmo da API. Ele existe porque o ZIP é montado em
 * memória e PDF com imagem de fundo não comprime: o arquivo final é a soma dos
 * PDFs. A tela bloqueia antes de chegar lá, mas a API recusa de qualquer
 * forma — validação de tela é conforto, não defesa.
 */
@Component({
  selector: 'app-certificate-batch',
  standalone: true,
  imports: [FormsModule, Toast, TextareaModule, PageHeaderComponent, PkButtonComponent],
  templateUrl: './certificate-batch.component.html',
  styleUrl: './certificate-batch.component.scss',
  providers: [MessageService],
})
export class CertificateBatchComponent {

  private readonly service = inject(CertificateService);
  private readonly messageService = inject(MessageService);

  /** O mesmo teto do `@Size` no CertificateBatchDTO. Mudou lá, muda aqui. */
  readonly LIMITE = 200;

  readonly texto = signal('');
  readonly gerando = signal(false);

  /**
   * `texto` é signal, e não campo comum, porque este `computed` lê ele.
   *
   * `computed` só recalcula quando um **signal** que ele leu muda. Sobre um
   * campo comum ele avaliaria uma vez, guardaria o primeiro valor e nunca mais
   * atualizaria — sem erro de build e sem aviso no console. A tela ficaria
   * parada mostrando "0 nomes" para sempre.
   */
  readonly analise = computed<AnaliseDaLista>(() => {
    // `trim()` antes de dividir: quase toda colagem termina em Enter, e sem
    // isso a tela acusaria uma linha em branco que ninguém digitou.
    const linhas = this.texto().trim().split(/\r?\n/);

    const nomes: string[] = [];
    let linhasEmBranco = 0;

    for (const linha of linhas) {
      const nome = linha.trim();
      if (!nome) {
        linhasEmBranco++;
        continue;
      }
      nomes.push(nome);
    }

    // Repetido não é erro: dois homônimos na mesma turma existem, e a API dá
    // nome distinto para cada arquivo. É só um aviso, para o caso de a pessoa
    // ter colado a mesma coluna duas vezes.
    const vistos = new Set<string>();
    let repetidos = 0;

    for (const nome of nomes) {
      const chave = nome.toLowerCase();
      if (vistos.has(chave)) {
        repetidos++;
      } else {
        vistos.add(chave);
      }
    }

    return {
      nomes,
      linhasEmBranco,
      repetidos,
      excedente: Math.max(0, nomes.length - this.LIMITE),
    };
  });

  readonly podeGerar = computed(() => {
    const { nomes, excedente } = this.analise();
    return nomes.length > 0 && excedente === 0 && !this.gerando();
  });

  aoDigitar(valor: string): void {
    this.texto.set(valor);
  }

  limpar(): void {
    this.texto.set('');
  }

  gerar(): void {
    if (!this.podeGerar()) return;

    const nomes = this.analise().nomes;
    this.gerando.set(true);

    this.service.generateBatch(nomes).subscribe({
      next: (response) => {
        this.gerando.set(false);

        if (!downloadFileResponse(response, 'certificados.zip')) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Nenhum arquivo retornado',
            detail: 'O servidor respondeu vazio. Nada foi baixado.',
          });
          return;
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Certificados gerados',
          detail: `${nomes.length} certificado(s) no ZIP. O download começou.`,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.gerando.set(false);
        this.mensagemDeErro(err).then(detail =>
          this.messageService.add({
            severity: 'error',
            summary: 'Não foi possível gerar',
            detail,
          })
        );
      },
    });
  }

  /**
   * A resposta é `blob`, então o corpo de erro também chega como Blob.
   *
   * Sem ler o Blob, um 400 viraria "dados inválidos" genérico e a mensagem que
   * a API escreveu — "Máximo de 200 nomes por lote" — se perderia. Um 400 aqui
   * significa que a conta da tela discordou da do servidor, e é justamente a
   * hora de mostrar o que ele disse.
   */
  private async mensagemDeErro(err: HttpErrorResponse): Promise<string> {
    if (err.status === 400 && err.error instanceof Blob) {
      try {
        const corpo = JSON.parse(await err.error.text());
        if (corpo?.message) return corpo.message;
      } catch {
        // Corpo não era o ErrorResponse esperado: cai no texto por status.
      }
    }

    switch (err.status) {
      case 0:   return 'Sem conexão com o servidor.';
      case 400: return 'A lista foi recusada pelo servidor.';
      case 403: return 'Só um administrador pode gerar certificados em lote.';
      case 413: return 'O lote ficou grande demais. Tente em partes menores.';
      case 503: return 'O gerador de certificados está indisponível. Tente em alguns minutos.';
      default:  return 'Falha inesperada ao gerar os certificados.';
    }
  }
}
