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

/**
 * Cor por PAPEL: disponível é bom, entregue é assunto encerrado, aguardando
 * aquisição está travado esperando terceiro, o resto pede ação nossa.
 */
export const MACHINE_STATUS_SEVERITY: Record<MachineStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  [MachineStatus.DISPONIVEL]: 'success',
  [MachineStatus.ENTREGUE]: 'neutral',
  [MachineStatus.RESERVADA]: 'neutral',
  [MachineStatus.AGUARDANDO_AQUISICAO]: 'danger',
  [MachineStatus.LIBERAR_EQUIPAMENTOS]: 'warning',
  [MachineStatus.REFORMA]: 'warning',
};

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
