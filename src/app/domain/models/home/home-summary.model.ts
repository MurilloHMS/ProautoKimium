/**
 * O resumo da home — espelha `HomeSummaryDTO` da API.
 *
 * Notificações e avisos não estão aqui de propósito: a contagem de notificações
 * chega ao vivo por STOMP no `NotificationService`, e o mural devolve a lista
 * que a tela exibe. Repetir os dois no resumo criaria duas verdades.
 */
export type PendingType =
  | 'HOLERITE_NAO_CONFIRMADO'
  | 'FERIAS_AGUARDANDO'
  | 'REEMBOLSO_AGUARDANDO'
  | 'APROVACAO_FERIAS'
  | 'APROVACAO_REEMBOLSO';

export interface PendingItem {
  type: PendingType;
  title: string;
  detail: string;
  since: string | null;
}

export interface HomeSummary {
  mine: PendingItem[];
  approvals: PendingItem[];
  vacationBalanceDays: number | null;
}

/**
 * Ícone e destino de cada tipo.
 *
 * A rota mora aqui e não na API: o servidor não deve conhecer o roteador do
 * Angular. Tipo novo na API sem entrada aqui cai no `?` e vai para a home —
 * feio, mas não quebra a tela.
 */
export const PENDING_INFO: Record<PendingType, { icon: string; rota: string }> = {
  HOLERITE_NAO_CONFIRMADO: { icon: 'pi pi-receipt',  rota: '/documentos/holerites' },
  FERIAS_AGUARDANDO:       { icon: 'pi pi-sun',      rota: '/documentos/rh/vacation-requests' },
  REEMBOLSO_AGUARDANDO:    { icon: 'pi pi-wallet',   rota: '/documentos/rh/reimbursements' },
  APROVACAO_FERIAS:        { icon: 'pi pi-sun',      rota: '/rh/vacation-requests' },
  APROVACAO_REEMBOLSO:     { icon: 'pi pi-wallet',   rota: '/rh/reimbursements' },
};
