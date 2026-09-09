/**
 * Um mês da fila de envio, contado por status.
 *
 * **A newsletter é mensal, e é assim que se fala dela** — "a de junho já saiu?".
 * A lista crua de clientes só responde isso lendo linha por linha; a contagem
 * responde de relance, e é por isso que a tela abre por aqui.
 */
export interface ResumoDoMes {
  mes: number;
  ano: number;
  nomeDoMes: string;
  total: number;
  /** Chaveado por `EmailStatus`: mapa e não campo por campo, para o oitavo status aparecer sozinho. */
  porStatus: Record<string, number>;
  /** `null` nos meses que vieram por planilha, antes da revisão existir. */
  confirmadoEm: string | null;
}

/** Os seis papéis de cor do tema, um por status. */
export type PapelDeStatus = 'success' | 'info' | 'warning' | 'work' | 'danger' | 'neutral';

export interface StatusDaFila {
  status: string;
  label: string;
  papel: PapelDeStatus;
  /** O ícone é o que sobrevive à escala de cinza — e ao daltonismo. */
  icone: string;
}

/**
 * O vocabulário da fila.
 *
 * Sete status para seis papéis, então `ERROR` e `FAILED` dividiriam `danger` —
 * e repetir papel é o defeito que ninguém vê: a tela desenha igual ao vizinho e
 * quem lê erra por meses. `FAILED` fica com o ícone próprio para os dois não
 * ficarem idênticos enquanto não se decide se ele ainda é usado.
 */
export const STATUS_DA_FILA: StatusDaFila[] = [
  { status: 'PENDING',   label: 'Pendente',   papel: 'work',    icone: 'pi pi-clock' },
  { status: 'SCHEDULED', label: 'Agendada',   papel: 'info',    icone: 'pi pi-calendar' },
  { status: 'RETRYING',  label: 'Reenviando', papel: 'warning', icone: 'pi pi-replay' },
  { status: 'SENT',      label: 'Enviada',    papel: 'success', icone: 'pi pi-check' },
  { status: 'ERROR',     label: 'Com erro',   papel: 'danger',  icone: 'pi pi-times-circle' },
  { status: 'FAILED',    label: 'Falhou',     papel: 'danger',  icone: 'pi pi-ban' },
  { status: 'CANCELED',  label: 'Cancelada',  papel: 'neutral', icone: 'pi pi-minus-circle' },
];

const PORStatus = new Map(STATUS_DA_FILA.map(s => [s.status, s]));

/** Status que a API mandou e a tela não conhece continua aparecendo, em cinza. */
export function descreverStatus(status: string): StatusDaFila {
  return PORStatus.get(status?.toUpperCase()) ??
    { status, label: status ?? '—', papel: 'neutral', icone: 'pi pi-question-circle' };
}

/** Quantos ainda esperam alguém apertar enviar. */
export function pendentesDe(mes: ResumoDoMes): number {
  return mes.porStatus?.['PENDING'] ?? 0;
}
