/**
 * Máquinas do ProStock — hoje uma projeção de `products` onde `isMachine`.
 *
 * Os nomes dos campos seguem o DTO do desktop (`MachineDTO.java`), inclusive o
 * `minimum_stock` em snake_case — o desktop continua no ar e escreve na mesma
 * base, então renomear aqui quebraria a serialização de um dos dois.
 */
export interface Machine {
  id: string;
  systemCode: string;
  name: string;
  brand: string;
  machineType: MachineType | null;
  /** Pode vir nulo: são campos do produto, preenchidos só se alguém preencheu. */
  machineStatus: MachineStatus | null;
  minimum_stock: number;
  active: boolean;
}

export interface MachineMovement {
  id: string;
  movementDate: string;
  quantity: number;
}

/**
 * Estado da máquina — os seis valores da planilha de programação.
 *
 * Quem usa é quem manda: o enum antigo da API (PRONTA, MANUTENCAO, ENTRADA)
 * não era o vocabulário do time, e a pessoa que preenche a planilha procuraria
 * "DISPONÍVEL" sem achar. O enum da API passa a ser este.
 */
export enum MachineStatus {
  DISPONIVEL = 'DISPONIVEL',
  ENTREGUE = 'ENTREGUE',
  RESERVADA = 'RESERVADA',
  AGUARDANDO_AQUISICAO = 'AGUARDANDO_AQUISICAO',
  LIBERAR_EQUIPAMENTOS = 'LIBERAR_EQUIPAMENTOS',
  REFORMA = 'REFORMA',
}

export const MACHINE_STATUS_LABEL: Record<MachineStatus, string> = {
  [MachineStatus.DISPONIVEL]: 'Disponível',
  [MachineStatus.ENTREGUE]: 'Entregue',
  [MachineStatus.RESERVADA]: 'Reservada',
  [MachineStatus.AGUARDANDO_AQUISICAO]: 'Aguardando aquisição',
  [MachineStatus.LIBERAR_EQUIPAMENTOS]: 'Liberar equipamentos',
  [MachineStatus.REFORMA]: 'Reforma',
};

export type StatusSeverity = 'success' | 'info' | 'warning' | 'work' | 'danger' | 'neutral';

/**
 * Cor por PAPEL — **um papel por status, sem repetição**.
 *
 * Eram quatro papéis para seis status, e três pares saíam idênticos na tela:
 * Entregue igual a Reservada, Reforma igual a Liberar equipamentos. Quem lia a
 * grade não distinguia uma máquina que já foi de uma que está prometida.
 *
 * O critério é o que o status pede de quem olha:
 *
 * - `success` — está aqui e pode ser vendida. A única assim.
 * - `info` — está aqui, mas com dono. Não é problema nem conclusão.
 * - `warning` — está aqui e alguém trabalha nela agora.
 * - `work` — trava interna, esperando ação NOSSA para liberar.
 * - `danger` — nem foi comprada. É a única que promete o que não existe.
 * - `neutral` — assunto encerrado; o que não pede nada recua na tela.
 *
 * Repetir papel aqui é o defeito de origem, e ele volta em silêncio: o
 * compilador aceita, a tela desenha, e só quem usa percebe — meses depois.
 */
export const MACHINE_STATUS_SEVERITY: Record<MachineStatus, StatusSeverity> = {
  [MachineStatus.DISPONIVEL]: 'success',
  [MachineStatus.RESERVADA]: 'info',
  [MachineStatus.REFORMA]: 'warning',
  [MachineStatus.LIBERAR_EQUIPAMENTOS]: 'work',
  [MachineStatus.AGUARDANDO_AQUISICAO]: 'danger',
  [MachineStatus.ENTREGUE]: 'neutral',
};

/**
 * O ícone que acompanha a cor.
 *
 * **Não é enfeite: é o que faz o status sobreviver sem cor.** Seis cores viram
 * três tons em escala de cinza, que é o que acontece com daltonismo
 * vermelho-verde — cerca de 8% dos homens — e em qualquer impressão em preto e
 * branco. Com o ícone, a informação não depende de enxergar a diferença entre
 * âmbar e violeta.
 *
 * A classe `.status-chip` já reservava espaço para ele em `chips.scss`; nenhuma
 * tela usava.
 */
export const MACHINE_STATUS_ICON: Record<MachineStatus, string> = {
  [MachineStatus.DISPONIVEL]: 'pi pi-check-circle',
  [MachineStatus.RESERVADA]: 'pi pi-bookmark-fill',
  [MachineStatus.REFORMA]: 'pi pi-wrench',
  [MachineStatus.LIBERAR_EQUIPAMENTOS]: 'pi pi-flag',
  [MachineStatus.AGUARDANDO_AQUISICAO]: 'pi pi-shopping-cart',
  [MachineStatus.ENTREGUE]: 'pi pi-truck',
};

/**
 * O que conta como "está no galpão" — espelha `MachineReconciliationService.IN_STOCK`.
 *
 * Não confundir com `OPEN_STATUSES`, que é só "≠ ENTREGUE": AGUARDANDO_AQUISICAO
 * e LIBERAR_EQUIPAMENTOS estão abertas e **não** estão em estoque. Usar a lista
 * errada aqui ofereceria para entregar uma máquina que ainda não chegou.
 *
 * REFORMA entra: fisicamente está lá, mesmo sem poder ser vendida.
 *
 * A API valida de novo. Isto é conveniência de tela, não a regra — a regra mora
 * no servidor, e é o servidor que recusa.
 */
export const IN_STOCK_STATUSES: MachineStatus[] = [
  MachineStatus.DISPONIVEL, MachineStatus.RESERVADA, MachineStatus.REFORMA,
];

/** Status que ainda esperam saída — usado no Hub e nos alertas. */
export const OPEN_STATUSES: MachineStatus[] = Object.values(MachineStatus)
  .filter(status => status !== MachineStatus.ENTREGUE);

export enum MachineType {
  CAPO = 'CAPO',
  FRONTAL = 'FRONTAL',
  ESTEIRA = 'ESTEIRA',
}

export const MACHINE_TYPE_LABEL: Record<MachineType, string> = {
  [MachineType.CAPO]: 'Capô',
  [MachineType.FRONTAL]: 'Frontal',
  [MachineType.ESTEIRA]: 'Esteira',
};

export function machineTypeOptions(): { label: string; value: MachineType }[] {
  return Object.values(MachineType).map(value => ({ label: MACHINE_TYPE_LABEL[value], value }));
}

export function machineStatusOptions(): { label: string; value: MachineStatus }[] {
  return Object.values(MachineStatus).map(value => ({ label: MACHINE_STATUS_LABEL[value], value }));
}

/**
 * As duas contagens da mesma máquina, lado a lado.
 *
 * Existe por causa de uma decisão de projeto: o estoque de máquina é contado
 * por dois caminhos, e a escolha foi sincronizar em vez de derivar um do outro.
 * O custo assumido é que todo caminho novo precisa lembrar de conciliar — e no
 * dia em que alguém esquecer, os números separam em silêncio.
 */
export interface MachineDivergence {
  machineId: string;
  systemCode: string;
  name: string;
  /** O que `products_movements` diz. */
  stock: number;
  /** Quantas linhas de programação estão em estoque. */
  scheduled: number;
}

/** Positivo, sobra no estoque; negativo, sobra na programação. */
export function divergenceOf(item: MachineDivergence): number {
  return item.stock - item.scheduled;
}

/** O que o acerto fez — espelha `AlignResultDTO`. */
export interface AlignResult {
  systemCode: string;
  name: string;
  stockBefore: number;
  scheduledBefore: number;
  created: number;
  stockAfter: number;
}

/**
 * Conciliação entre o estoque e a programação (`POST api/machine/reconcile`).
 *
 * `delta` e não estoque absoluto — ao contrário de `InventoryMovement`. A
 * diferença é de propósito: o servidor precisa saber **quantas** máquinas
 * mudaram para conferir que os dois lados contam o mesmo número, e ele lê o
 * estoque atual do banco em vez de aceitar o que a tela tinha em cache.
 */
export interface ReconcileRequest {
  systemCode: string;
  /** Positivo entra, negativo sai. Zero é recusado. */
  delta: number;
  movementDate: string;
  /** Quais programações viram ENTREGUE. Só quando `delta` é negativo. */
  registersToDeliver: string[];
  /** Quantas programações nascem DISPONIVEL. Só quando `delta` é positivo. */
  registersToCreate: number;
}

/**
 * Quanto o estoque anda quando o status de uma programação muda.
 *
 * Espelha `MachineReconciliationService.stockDeltaFor`. Existe aqui para a tela
 * saber **se precisa perguntar** alguma coisa antes de gravar — quem decide de
 * verdade continua sendo o servidor, que recalcula e recusa.
 *
 * A regra é "só ENTREGUE", com uma segunda metade que não é óbvia: o ajuste só
 * vale quando o outro lado da transição está em estoque. AGUARDANDO_AQUISICAO
 * é máquina que ainda não chegou, e entregá-la não pode baixar nada.
 *
 * `before` nulo é linha nova: nascer em estoque é entrada.
 */
export function stockDeltaFor(
  before: MachineStatus | null,
  after: MachineStatus,
): number {
  const inStock = (status: MachineStatus) => IN_STOCK_STATUSES.includes(status);

  if (before === null) return inStock(after) ? 1 : 0;

  if (inStock(before) && after === MachineStatus.ENTREGUE) return -1;
  if (before === MachineStatus.ENTREGUE && inStock(after)) return 1;

  return 0;
}
