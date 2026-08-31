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
  tag: string | null;
  regiao: string;
  solicitante: string;
  status: MachineStatus;
  Observacao: string;
  previsaoEntrega: string | null;
  consultor: string;
  tecnico: string;

  /**
   * Auditoria — quem criou e quem mexeu por último.
   *
   * Opcionais porque quem preenche é a API: enquanto os campos não existirem
   * lá, e para os registros importados antes deles, a tela mostra "—" em vez
   * de quebrar. Nome de exibição, não id: é quem era a pessoa na hora da
   * alteração, e a grade não pode fazer um GET por linha para descobrir isso.
   */
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface CreateMachineRegister {
  machineId: string;
  nomeCliente: string;
  tag: string | null;
  regiao: string;
  solicitante: string;
  status: MachineStatus;
  Observacao: string;
  previsaoEntrega: string | null;
  consultor: string;
  tecnico: string;

  /**
   * Pedido explícito para lançar a movimentação de estoque junto.
   *
   * Omitido, a API cai em `false` — o campo é primitivo do outro lado. É o que
   * mantém a importação de planilha e o desktop inertes: eles nunca mandam.
   */
  adjustStock?: boolean;
}

/** O update não leva `machineId`: a máquina do registro não muda. */
export type UpdateMachineRegister = Omit<CreateMachineRegister, 'machineId'> & {
  /**
   * Obrigatório só quando a previsão **muda** e já havia data.
   *
   * A API recusa com 400 sem ele nesse caso. Preencher pela primeira vez não
   * é adiamento e não precisa de nada.
   */
  motivoAlteracaoPrevisao?: string | null;

  /** Ver `CreateMachineRegister.adjustStock`. */
  adjustStock?: boolean;
};

/**
 * Um adiamento com de quem ele é — espelha `ScheduleSlipDTO`.
 *
 * Diferente de `ScheduleChange`, que serve ao histórico de UMA linha: aqui
 * quem lê está olhando o conjunto e não sabe de qual programação cada
 * adiamento veio.
 */
export interface ScheduleSlip {
  registerId: string;
  nomeCliente: string;
  machineName: string;
  previsaoAnterior: string;
  previsaoNova: string | null;
  motivo: string;
  changedAt: string;
}

/**
 * Uma alteração já registrada — espelha `ScheduleChangeDTO`.
 *
 * `campo` diz qual dos oito mudou, e por isso os dois valores são **texto**: é
 * a mesma linha de tabela guardando data, nome de técnico e chave de status. A
 * tela é que devolve cada um ao seu formato, e precisa de `campo` para saber
 * qual aplicar.
 *
 * `motivo` é nulo na maioria das linhas desde que deixou de ser obrigatório.
 */
export interface ScheduleChange {
  id: string;
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
  motivo: string | null;
  changedBy: string | null;
  changedAt: string;
}

/**
 * Uma edição inteira: o que mudou de uma vez só.
 *
 * A API grava uma linha por campo, e todas as linhas de uma mesma edição saem
 * com o mesmo `changedAt`, o mesmo autor e o mesmo motivo — o serviço as grava
 * numa chamada só. Agrupar de volta é o que evita repetir a justificativa uma
 * vez por campo: quem arruma quatro coisas numa linha geraria quatro cartões
 * idênticos exceto pelo par de valores.
 *
 * Só existe na tela. A API não conhece esta forma.
 */
export interface ScheduleEdit {
  id: string;
  changedBy: string | null;
  changedAt: string;
  motivo: string | null;
  campos: ScheduleChange[];
}
