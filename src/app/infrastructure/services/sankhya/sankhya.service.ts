import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { emLinhas, type ResultadoSankhya } from '../../../domain/utils/sankhya-resultado';
import type { ProdutoCmv } from '../../../domain/models/sankhya/produto-cmv.model';

/**
 * Consultas ao ERP, pela ponte que a API expõe.
 *
 * **O SQL sai daqui, e isso é o desenho — não descuido.** A API recebe a
 * consulta e devolve o resultado como veio; quem monta a consulta é quem sabe
 * o que quer. A permissão `integracao/sankhya:CONSULTAR` é o que protege o
 * endpoint, e quem a tiver pode ver esta consulta no DevTools.
 *
 * Cada método guarda o seu SQL numa constante nomeada. Não é enfeite: quando a
 * consulta muda, ela muda num lugar só, e o nome diz para que ela serve sem
 * precisar ler o SQL.
 */
@Injectable({ providedIn: 'root' })
export class SankhyaService {

  private readonly http = inject(HttpClient);

  /**
   * Produtos com CMV calculado, com nome e unidade vindos do cadastro.
   *
   * `RTRIM` porque `DESCRPROD` é coluna de largura fixa: o nome chega com
   * espaços à direita e desalinha tudo na tela.
   *
   * **Traz também os de CMV zerado**, que são 3 de cada 4. Decisão dele: eles
   * aparecem marcados na lista em vez de sumir — some esconderia que aquele
   * produto existe e só falta calcular.
   */
  private static readonly SQL_PRODUTOS_CMV = `
    SELECT c.CODPROD,
           RTRIM(p.DESCRPROD) AS PRODUTO,
           p.CODVOL,
           c.CMV
      FROM AD_CMVPROD c
      JOIN TGFPRO p ON p.CODPROD = c.CODPROD
     ORDER BY p.DESCRPROD`;

  /** Roda uma consulta e devolve as linhas já com nome de coluna. */
  consultar(sql: string): Observable<ResultadoSankhya> {
    return this.http.post<ResultadoSankhya>(
      `${environment.apiUrl}/sankhya/query`,
      { query: sql },
    );
  }

  produtosComCmv(): Observable<ProdutoCmv[]> {
    return this.consultar(SankhyaService.SQL_PRODUTOS_CMV).pipe(
      map(resultado => emLinhas(resultado).map(linha => ({
        codigo: Number(linha['CODPROD']),
        nome: String(linha['PRODUTO'] ?? '').trim(),
        unidade: String(linha['CODVOL'] ?? '').trim(),
        custo: Number(linha['CMV'] ?? 0),
      }))),
    );
  }
}
