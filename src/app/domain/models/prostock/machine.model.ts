/**
 * Máquinas do ProStock.
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
  machineType: MachineType;
  machineStatus: MachineStatus;
  minimum_stock: number;
  active: boolean;
}

export interface MachineMovement {
  id: string;
  movementDate: string;
  quantity: number;
}

/**
 * Estado da máquina.
 *
 * ATENÇÃO: esta lista é a do enum da API. A planilha de programação usa outra
 * (DISPONÍVEL, AGUARDANDO AQUISIÇÃO, LIBERAR EQUIPAMENTOS) e só três valores
 * coincidem. Enquanto o enum não for decidido, a tela mostra o que a API aceita.
 */
export enum MachineStatus {
  PRONTA = 'PRONTA',
  REFORMA = 'REFORMA',
  MANUTENCAO = 'MANUTENCAO',
  ENTREGUE = 'ENTREGUE',
  RESERVADA = 'RESERVADA',
  ENTRADA = 'ENTRADA',
}

export const MACHINE_STATUS_LABEL: Record<MachineStatus, string> = {
  [MachineStatus.PRONTA]: 'Pronta',
  [MachineStatus.REFORMA]: 'Reforma',
  [MachineStatus.MANUTENCAO]: 'Manutenção',
  [MachineStatus.ENTREGUE]: 'Entregue',
  [MachineStatus.RESERVADA]: 'Reservada',
  [MachineStatus.ENTRADA]: 'Aguardando entrada',
};

/**
 * Cor por PAPEL, não por enfeite: pronta é sucesso, reforma e manutenção avisam,
 * entregue é informação neutra concluída.
 */
export const MACHINE_STATUS_SEVERITY: Record<MachineStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  [MachineStatus.PRONTA]: 'success',
  [MachineStatus.REFORMA]: 'warning',
  [MachineStatus.MANUTENCAO]: 'warning',
  [MachineStatus.ENTREGUE]: 'neutral',
  [MachineStatus.RESERVADA]: 'warning',
  [MachineStatus.ENTRADA]: 'danger',
};

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
