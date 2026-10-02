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
  | 'APROVACAO_REEMBOLSO'
  | 'ATESTADO_AGUARDANDO'
  | 'ATESTADO_RECUSADO'
  | 'CONFERENCIA_ATESTADO'
  | 'EVENT_RSVP';

export interface PendingItem {
  type: PendingType;
  title: string;
  detail: string;
  since: string | null;
  /** O registro de que a pendência fala, quando a tela abre aquele um: o evento do convite. */
  refId?: string | null;
}

export interface HomeSummary {
  mine: PendingItem[];
  approvals: PendingItem[];
  vacationBalanceDays: number | null;
}

/** Cor de cada assunto. Férias é âmbar, dinheiro é teal, documento é navy. */
export type PendingAccent = 'navy' | 'amber' | 'teal';

/**
 * Ícone, cor e destino de cada tipo.
 *
 * A rota mora aqui e não na API: o servidor não deve conhecer o roteador do
 * Angular. Tipo novo na API sem entrada aqui cai no genérico e vai para a home
 * — feio, mas não quebra a tela.
 *
 * O `accent` existe porque a primeira versão pintava tudo do mesmo cinza com o
 * mesmo ícone navy: holerite, férias e reembolso ficavam idênticos e o olho não
 * tinha onde pousar. A cor aqui é por **assunto**, não por urgência — urgência
 * é o que a ordenação já diz.
 */
export const PENDING_INFO: Record<PendingType, { icon: string; rota: string; accent: PendingAccent }> = {
  HOLERITE_NAO_CONFIRMADO: { icon: 'pi pi-receipt',  rota: '/documentos/holerites',              accent: 'navy'  },
  FERIAS_AGUARDANDO:       { icon: 'pi pi-sun',      rota: '/documentos/rh/vacation-requests',   accent: 'amber' },
  REEMBOLSO_AGUARDANDO:    { icon: 'pi pi-wallet',   rota: '/documentos/rh/reimbursements',      accent: 'teal'  },
  APROVACAO_FERIAS:        { icon: 'pi pi-sun',      rota: '/rh/vacation-requests',              accent: 'amber' },
  APROVACAO_REEMBOLSO:     { icon: 'pi pi-wallet',   rota: '/rh/reimbursements',                 accent: 'teal'  },
  ATESTADO_AGUARDANDO:     { icon: 'pi pi-file-check', rota: '/documentos/rh/medical-certificates', accent: 'navy' },
  ATESTADO_RECUSADO:       { icon: 'pi pi-file-check', rota: '/documentos/rh/medical-certificates', accent: 'navy' },
  CONFERENCIA_ATESTADO:    { icon: 'pi pi-file-check', rota: '/rh/medical-certificates',            accent: 'navy' },
  EVENT_RSVP:              { icon: 'pi pi-calendar', rota: '/convites',                          accent: 'navy'  },
};

/** O convite abre direto no evento: `/convites?evento=<id>`. Os outros tipos abrem a lista. */
export function pendingQuery(item: PendingItem): Record<string, string> | null {
  return item.type === 'EVENT_RSVP' && item.refId ? { evento: item.refId } : null;
}
