export type ReportFormat = 'PDF' | 'XLSX';

export interface FuelSupplyReportRequest {
  month: number;
  year: number;
  format: ReportFormat;
}

export interface MonthOption {
  label: string;
  value: number;
}

export const MONTH_OPTIONS: MonthOption[] = [
  { label: 'Janeiro',   value: 1  },
  { label: 'Fevereiro', value: 2  },
  { label: 'Março',     value: 3  },
  { label: 'Abril',     value: 4  },
  { label: 'Maio',      value: 5  },
  { label: 'Junho',     value: 6  },
  { label: 'Julho',     value: 7  },
  { label: 'Agosto',    value: 8  },
  { label: 'Setembro',  value: 9  },
  { label: 'Outubro',   value: 10 },
  { label: 'Novembro',  value: 11 },
  { label: 'Dezembro',  value: 12 },
];

export interface FormatOption {
  label: string;
  value: ReportFormat;
  icon: string;
  description: string;
}

export const FORMAT_OPTIONS: FormatOption[] = [
  {
    label: 'PDF',
    value: 'PDF',
    icon: 'pi pi-file-pdf',
    description: 'Geral + 1 página por setor'
  },
  {
    label: 'Excel',
    value: 'XLSX',
    icon: 'pi pi-file-excel',
    description: 'Aba Geral + 1 aba por setor'
  }
];
