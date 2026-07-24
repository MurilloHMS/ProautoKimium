export type NotificationType = 'HOLERITE' | 'DOCUMENTO' | 'REEMBOLSO' | 'PERSONALIZADA' | 'GERAL';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}
