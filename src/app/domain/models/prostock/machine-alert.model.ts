/**
 * Configuração dos alertas de previsão de saída.
 *
 * Uma configuração só para a empresa inteira (não é por usuário): quem decide
 * é o RH/almoxarifado, e todo mundo na lista recebe o mesmo aviso.
 *
 * Contrato esperado da API:
 *   GET  api/machine/alert-config   → MachineAlertConfig
 *   PUT  api/machine/alert-config   → MachineAlertConfig (mesmo corpo)
 */
export interface MachineAlertConfig {
  /** Liga e desliga sem perder a configuração. */
  active: boolean;

  /**
   * Antecedências em dias. Vários avisos por registro: `[7, 1]` manda um com
   * uma semana, para planejar, e outro na véspera, para cobrar.
   */
  daysBefore: number[];

  /** Continua avisando todo dia enquanto a previsão estiver vencida sem entrega. */
  alertWhenLate: boolean;

  /** Hora do disparo, `HH:mm`. O job roda uma vez por dia nesse horário. */
  sendAt: string;

  /**
   * Quem recebe, por id de funcionário. Guardamos o id e não o e-mail: se a
   * pessoa trocar de endereço no cadastro, o alerta acompanha sozinho.
   */
  recipientEmployeeIds: string[];
}

export const DEFAULT_ALERT_CONFIG: MachineAlertConfig = {
  active: false,
  daysBefore: [3],
  alertWhenLate: true,
  sendAt: '08:00',
  recipientEmployeeIds: [],
};
