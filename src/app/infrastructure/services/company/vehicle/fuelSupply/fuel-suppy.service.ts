import { Injectable } from '@angular/core';
import {FuelSupplyReportRequest, ReportFormat} from "../../../../../domain/models/report.model";
import {environment} from "../../../../../../environments/environment";
import {Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {FuelSupply} from "../../../../../domain/models/fuel-supply.model";
import {
  DepartmentOption,
  FuelSupplyImportResult,
  FuelSupplyImportRow,
  FuelSupplyPreviewRow
} from "../../../../../domain/models/fuel-supply-audit.model";

@Injectable({
  providedIn: 'root',
})
export class FuelSuppyService {
  constructor(private http: HttpClient) {}

  /**
   * Abastecimentos de um período, para o Hub montar os indicadores.
   *
   * Datas em `yyyy-MM-dd` — a API recebe `LocalDate`, e o intervalo inclui as
   * duas pontas (`findByFuelSupplyDateBetween`).
   */
  listByPeriod(start: string, end: string): Observable<FuelSupply[]> {
    return this.http.get<FuelSupply[]>(`${environment.apiUrl}/fuelsupply`, {
      params: { start, end },
    });
  }

  generateReport(request: FuelSupplyReportRequest): Observable<Blob> {
    return this.http.post(`${environment.apiUrl}/fuelsupply`, request, {
      responseType: 'blob'
    });
  }

  // ── Conferência ───────────────────────────────────────────────────────────

  /**
   * Passo 1: lê a planilha e devolve o diagnóstico de cada linha.
   *
   * **Não grava nada.** Quem grava é o `gravarConferidos`, com o que a tela
   * devolver — e não com o arquivo de novo.
   */
  conferirPlanilha(file: File): Observable<FuelSupplyPreviewRow[]> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<FuelSupplyPreviewRow[]>(
      `${environment.apiUrl}/fuelsupply/preview`, formData);
  }

  /**
   * Passo 2: grava as linhas marcadas.
   *
   * Responde **422** quando alguma linha é recusada, e aí nenhuma é gravada —
   * o corpo do erro é um {@link FuelSupplyImportResult} com os motivos.
   */
  gravarConferidos(linhas: FuelSupplyImportRow[]): Observable<FuelSupplyImportResult> {
    return this.http.post<FuelSupplyImportResult>(
      `${environment.apiUrl}/fuelsupply/import`, linhas);
  }

  /**
   * Os departamentos do combo da conferência.
   *
   * Vem do próprio módulo de abastecimento, e não de `/hr/departments`: aquele
   * exige autoridade de RH, e quem cuida de frota abriria o combo vazio.
   */
  listarDepartamentos(): Observable<DepartmentOption[]> {
    return this.http.get<DepartmentOption[]>(`${environment.apiUrl}/fuelsupply/departments`);
  }

  // ── Planilhas ─────────────────────────────────────────────────────────────

  /** O modelo em branco, com as 13 colunas na ordem que o importador lê. */
  baixarModelo(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/fuelsupply/model`, { responseType: 'blob' });
  }

  /** Os dados já gravados do período, no mesmo formato do modelo. */
  exportarPeriodo(start: string, end: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/fuelsupply/export`, {
      params: { start, end },
      responseType: 'blob'
    });
  }

  // ── Download ──────────────────────────────────────────────────────────────

  downloadFile(blob: Blob, format: ReportFormat, mes: number, ano: number): void {
    const mimeType  = format === 'PDF'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const extension = format === 'PDF' ? 'pdf' : 'xlsx';

    this.salvar(blob, `abastecimento_${this.padMes(mes)}_${ano}.${extension}`, mimeType);
  }

  /**
   * Salva um blob com o nome dado.
   *
   * O download passa pelo `HttpClient` de propósito: `window.open` na URL da
   * API não leva o JWT, e volta 403.
   */
  salvarPlanilha(blob: Blob, filename: string): void {
    this.salvar(blob, filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  private salvar(blob: Blob, filename: string, mimeType: string): void {
    const file = new Blob([blob], { type: mimeType });
    const url  = URL.createObjectURL(file);
    const link = document.createElement('a');

    link.href     = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  private padMes(mes: number): string {
    return String(mes).padStart(2, '0');
  }
}
