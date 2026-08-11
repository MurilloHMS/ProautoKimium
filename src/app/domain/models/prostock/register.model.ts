import { MachineStatus } from './machine.model';

/**
 * Registro de programação de máquina — o que hoje vive na planilha
 * "PROGRAMAÇÃO MÁQUINAS e IMPLANTAÇÕES".
 *
 * `Observacao` começa com **O maiúsculo** porque é assim que a API serializa
 * (o record Java declara o campo com maiúscula). Renomear aqui faria o campo
 * chegar vazio do outro lado.
 *
 * Faltam `regiao` e `consultor`, que existem na planilha e ainda não na API.
 * Enquanto não existirem, a tela não substitui a planilha por completo.
 */
export interface MachineRegister {
  id: string;
  machineId: string;
  nomeCliente: string;
  tag: number;
  solicitante: string;
  status: MachineStatus;
  Observacao: string;
  previsaoEntrega: string | null;
  tecnico: string;
}

export interface CreateMachineRegister {
  machineId: string;
  nomeCliente: string;
  tag: number;
  solicitante: string;
  status: MachineStatus;
  Observacao: string;
  previsaoEntrega: string | null;
  tecnico: string;
}

/** O update não leva `machineId`: a máquina do registro não muda. */
export type UpdateMachineRegister = Omit<CreateMachineRegister, 'machineId'>;
