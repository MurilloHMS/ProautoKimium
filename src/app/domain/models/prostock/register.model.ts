import { MachineStatus } from './machine.model';

/**
 * Registro de programação de máquina — o que hoje vive na planilha
 * "PROGRAMAÇÃO MÁQUINAS e IMPLANTAÇÕES".
 *
 * `Observacao` começa com **O maiúsculo** porque é assim que a API serializa
 * (o record Java declara o campo com maiúscula). Renomear aqui faria o campo
 * chegar vazio do outro lado.
 *
 * `regiao` e `consultor` vieram da planilha (colunas C e H).
 */
export interface MachineRegister {
  id: string;
  machineId: string;
  nomeCliente: string;
  tag: number;
  regiao: string;
  solicitante: string;
  status: MachineStatus;
  Observacao: string;
  previsaoEntrega: string | null;
  consultor: string;
  tecnico: string;
}

export interface CreateMachineRegister {
  machineId: string;
  nomeCliente: string;
  tag: number;
  regiao: string;
  solicitante: string;
  status: MachineStatus;
  Observacao: string;
  previsaoEntrega: string | null;
  consultor: string;
  tecnico: string;
}

/** O update não leva `machineId`: a máquina do registro não muda. */
export type UpdateMachineRegister = Omit<CreateMachineRegister, 'machineId'>;
