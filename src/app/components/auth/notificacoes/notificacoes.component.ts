import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../../infrastructure/services/notification.service';
import { PushNotificationService } from '../../../infrastructure/services/push-notification.service';
import { AppNotification } from '../../../domain/models/notification.model';

@Component({
  selector: 'app-notificacoes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificacoes.component.html',
  styleUrl: './notificacoes.component.scss',
})
export class NotificacoesComponent implements OnInit {
  pushAtivando = false;
  pushAtivado = false;

  constructor(
    public notifications: NotificationService,
    private push: PushNotificationService,
    private router: Router
  ) {}

  get pushSuportado(): boolean {
    return this.push.isEnabled;
  }

  ngOnInit(): void {
    this.notifications.refresh();
  }

  abrir(n: AppNotification): void {
    if (!n.read) this.notifications.markRead(n.id);
    if (n.link) this.router.navigateByUrl(n.link);
  }

  marcarTodas(): void {
    this.notifications.markAllRead();
  }

  async ativarPush(): Promise<void> {
    this.pushAtivando = true;
    this.pushAtivado = await this.push.enable();
    this.pushAtivando = false;
  }

  iconFor(type: string): string {
    switch (type) {
      case 'HOLERITE': return 'pi pi-receipt';
      default: return 'pi pi-bell';
    }
  }

  tempo(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} h`;
    const dias = Math.floor(h / 24);
    if (dias < 7) return `há ${dias} d`;
    return d.toLocaleDateString('pt-BR');
  }
}
