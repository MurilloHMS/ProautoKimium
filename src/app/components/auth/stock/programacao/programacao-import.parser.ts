import * as XLSX from 'xlsx';

import { MachineStatus } from '../../../../domain/models/prostock/machine.model';

/**
 * Leitura da planilha "PROGRAMAÇÃO MÁQUINAS e IMPLANTAÇÕES".
 *
 * Fica fora do componente porque o difícil aqui não é a tela, é a planilha:
 * ela tem cabeçalho na segunda linha, uma legenda nas colunas K e L que
 * convive com os dados nas MESMAS linhas, datas gravadas como número de série
 * do Excel misturadas com texto livre, e nomes de máquina com espaço na frente.
 */

/** Colunas A–I. K e L são a legenda de validação e não entram. */
const COLUMNS = {
  maquina: 0,
  cliente: 1,
  regiao: 2,
  solicitante: 3,
  status: 4,
  observacao: 5,
  previsao: 6,
  consultor: 7,
  tecnico: 8,
} as const;

/** O cabeçalho está na linha 2 — a linha 1 é "última atualização 04/08 - LARISSA". */
const HEADER_ROW_INDEX = 1;

export interface ParsedRow {
  /** Linha na planilha, para o usuário achar o problema no arquivo original. */
  sheetRow: number;
  maquinaNome: string;
  nomeCliente: string;
  regiao: string;
  solicitante: string;
  status: MachineStatus;
  observacao: string;
  previsao: Date | null;
  consultor: string;
  tecnico: string;
  /** O que não deu para converter com certeza. A linha ainda é importável. */
  warnings: string[];
}

export interface ParseResult {
  sheetName: string;
  rows: ParsedRow[];
  /** Nomes de máquina distintos encontrados na coluna A. */
  machineNames: string[];
  ignoredRows: number;
}

/** Aba de trabalho; `ARQUIVO ...` é cópia arquivada e não deve ser importada. */
function pickSheet(workbook: XLSX.WorkBook): string {
  return workbook.SheetNames.find(name => normalize(name) === 'ESTOQUE') ?? workbook.SheetNames[0];
}

export function parseProgramacaoSheet(data: ArrayBuffer): ParseResult {
  // `cellDates` faz o SheetJS devolver Date onde a célula está formatada como
  // data — resolve os 46050 da coluna G sem fazer conta de número de série.
  const workbook = XLSX.read(data, { cellDates: true });
  const sheetName = pickSheet(workbook);
  const sheet = workbook.Sheets[sheetName];

  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });

  const rows: ParsedRow[] = [];
  const machineNames = new Set<string>();
  let ignoredRows = 0;

  for (let index = HEADER_ROW_INDEX + 1; index < grid.length; index++) {
    const line = grid[index] ?? [];

    const maquinaNome = text(line[COLUMNS.maquina]);
    const nomeCliente = text(line[COLUMNS.cliente]);

    // Sem máquina e sem cliente é linha vazia ou resto de formatação.
    if (!maquinaNome && !nomeCliente) {
      ignoredRows++;
      continue;
    }

    const warnings: string[] = [];
    const statusRaw = text(line[COLUMNS.status]);
    const status = toStatus(statusRaw);

    if (statusRaw && !status) warnings.push(`Status "${statusRaw}" não reconhecido — entrou como Disponível.`);
    if (!maquinaNome) warnings.push('Sem máquina na coluna A.');

    const { date, warning } = toDate(line[COLUMNS.previsao]);
    if (warning) warnings.push(warning);

    if (maquinaNome) machineNames.add(maquinaNome);

    rows.push({
      sheetRow: index + 1,
      maquinaNome,
      nomeCliente,
      regiao: text(line[COLUMNS.regiao]),
      solicitante: text(line[COLUMNS.solicitante]),
      status: status ?? MachineStatus.DISPONIVEL,
      observacao: text(line[COLUMNS.observacao]),
      previsao: date,
      consultor: text(line[COLUMNS.consultor]),
      tecnico: text(line[COLUMNS.tecnico]),
      warnings,
    });
  }

  return { sheetName, rows, machineNames: [...machineNames].sort(), ignoredRows };
}

/** Compara ignorando acento, caixa e espaço sobrando — " CAPÔ NT 300" = "capo nt 300". */
export function normalize(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

const STATUS_BY_TEXT: Record<string, MachineStatus> = {
  'DISPONIVEL': MachineStatus.DISPONIVEL,
  'ENTREGUE': MachineStatus.ENTREGUE,
  'RESERVADA': MachineStatus.RESERVADA,
  'AGUARDANDO AQUISICAO': MachineStatus.AGUARDANDO_AQUISICAO,
  'LIBERAR EQUIPAMENTOS': MachineStatus.LIBERAR_EQUIPAMENTOS,
  'REFORMA': MachineStatus.REFORMA,
};

function toStatus(raw: string): MachineStatus | null {
  return STATUS_BY_TEXT[normalize(raw)] ?? null;
}

/**
 * A coluna PREVISÃO SAÍDA mistura três coisas: data de verdade, número de
 * série do Excel e texto livre ("07/11 - Sexta"). Só a data entra; o resto
 * vira aviso, porque adivinhar o ano de "07/11" seria inventar dado.
 */
function toDate(value: unknown): { date: Date | null; warning?: string } {
  if (value === null || value === undefined || value === '') return { date: null };

  if (value instanceof Date) {
    return { date: new Date(value.getFullYear(), value.getMonth(), value.getDate()) };
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return { date: fromExcelSerial(value) };
  }

  const raw = String(value).trim();
  const match = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/.exec(raw);

  if (match) {
    const [, day, month, year] = match;
    if (!year) return { date: null, warning: `Previsão "${raw}" está sem ano — ficou em branco.` };

    const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
    return { date: new Date(fullYear, Number(month) - 1, Number(day)) };
  }

  return { date: null, warning: `Previsão "${raw}" não é uma data — ficou em branco.` };
}

/**
 * Número de série do Excel → data. A época é 1899-12-30 por causa do bug do
 * ano bissexto de 1900, que a Microsoft manteve por compatibilidade.
 */
function fromExcelSerial(serial: number): Date {
  const epoch = Date.UTC(1899, 11, 30);
  const utc = new Date(epoch + Math.round(serial) * 86_400_000);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}
