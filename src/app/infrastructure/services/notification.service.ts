import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Client, IMessage } from '@stomp/stompjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { AppNotification } from '../../domain/models/notification.model';

/**
 * Notificações do usuário: lê o histórico via REST (fonte da verdade) e recebe
 * empurrões ao vivo via STOMP/WebSocket. Mantém signals para a lista e o nº de não lidas.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = signal(0);
  /** Última notificação recebida ao vivo — para exibir toast/feedback. */
  readonly latest = signal<AppNotification | null>(null);

  private client?: Client;

  constructor(private http: HttpClient, private auth: AuthService) {}

  /** Chamado quando o usuário entra na área autenticada. */
  start(): void {
    if (!this.auth.getToken()) return;
    this.refresh();
    this.connect();
  }

  /** Encerra a conexão (logout / saída da área autenticada). */
  stop(): void {
    this.client?.deactivate();
    this.client = undefined;
  }

  refresh(): void {
    this.http.get<AppNotification[]>(`${environment.apiUrl}/notifications`).subscribe({
      next: (list) => {
        this.notifications.set(list ?? []);
        this.recountUnread();
      },
      error: () => {},
    });
  }

  markRead(id: string): void {
    this.http.put(`${environment.apiUrl}/notifications/${id}/read`, {}).subscribe({
      next: () => {
        this.notifications.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
        this.recountUnread();
      },
      error: () => {},
    });
  }

  markAllRead(): void {
    this.http.put(`${environment.apiUrl}/notifications/read-all`, {}).subscribe({
      next: () => {
        this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
        this.unreadCount.set(0);
      },
      error: () => {},
    });
  }

  private recountUnread(): void {
    this.unreadCount.set(this.notifications().filter((n) => !n.read).length);
  }

  private connect(): void {
    if (this.client?.active) return;
    const token = this.auth.getToken();
    if (!token) return;

    this.client = new Client({
      brokerURL: environment.wsUrl,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.client!.subscribe('/user/queue/notifications', (msg: IMessage) => {
          try {
            const n: AppNotification = JSON.parse(msg.body);
            this.notifications.update((list) => [n, ...list]);
            this.unreadCount.update((c) => c + 1);
            this.latest.set(n);
          } catch {
            // payload inesperado — ignora
          }
        });
      },
    });

    this.client.activate();
  }
}
