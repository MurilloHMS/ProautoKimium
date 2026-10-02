export type SubmissionType = 'PHOTO' | 'FILE';

/** Onde o atestado está na conferência do RH. Recusado não é final: a pessoa reenvia. */
export type MedicalCertificateStatus = 'PENDING' | 'RECEIVED' | 'REJECTED';

/** Um arquivo recusado e substituído, com a recusa que levou. */
export interface MedicalCertificateAttempt {
  id: string;
  submissionType: SubmissionType;
  originalFilename: string;
  submittedAt: string;
  comment: string | null;
  reviewedByName: string | null;
  reviewedAt: string;
  reviewNotes: string;
}

export interface MedicalCertificate {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  submissionType: SubmissionType;
  confirmedLegible: boolean | null;
  originalFilename: string;
  /** O primeiro envio. O arquivo em vigor pode ser de um reenvio: `resubmittedAt`. */
  submittedAt: string;
  status: MedicalCertificateStatus;
  /** Nulo também nos atestados de antes da conferência existir: contam como recebidos, sem ninguém. */
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  resubmittedAt: string | null;
  resubmitComment: string | null;
  /** Só vem quando dá para reenviar agora — a tela não repete a regra do prazo. */
  resubmitDeadline: string | null;
  previousAttempts: MedicalCertificateAttempt[];
}

/** Rótulo, ícone e tom de cada situação — uma fonte só para as duas telas. */
export const MEDICAL_CERTIFICATE_STATUS_INFO: Record<MedicalCertificateStatus, {
  label: string;
  /** Como quem enviou lê. */
  ownerLabel: string;
  icon: string;
  tone: 'warning' | 'active' | 'danger';
}> = {
  PENDING:  { label: 'Em conferência', ownerLabel: 'Aguardando o RH',   icon: 'pi pi-clock',        tone: 'warning' },
  RECEIVED: { label: 'Recebido',       ownerLabel: 'Recebido pelo RH',  icon: 'pi pi-check-circle', tone: 'active'  },
  REJECTED: { label: 'Recusado',       ownerLabel: 'Recusado pelo RH',  icon: 'pi pi-times-circle', tone: 'danger'  },
};
