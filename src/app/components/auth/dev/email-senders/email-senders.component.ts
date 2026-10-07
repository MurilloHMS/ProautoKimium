import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { EmailSendersService } from '../../../../infrastructure/services/email/email-senders.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import {
  SENDER_DOMAIN,
  Sender,
  SenderRoute,
  deactivateBlock,
  senderChoices,
  senderOptionLabel,
  usedByText,
  validateNewSender,
} from '../../../../domain/models/email/email-queue.model';
import { apiMessage } from '../../../../domain/utils/api-error';

const SCREEN = 'dev/email-senders';

/**
 * Remetentes: os e-mails da empresa de onde o ERP envia, e qual serviço sai
 * por qual. Mudar uma rota vale para os próximos e-mails — o que já está na
 * fila guarda o remetente do momento em que entrou.
 */
@Component({
  selector: 'app-email-senders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, Toast, InputTextModule, PkButtonComponent],
  templateUrl: './email-senders.component.html',
  styleUrl: './email-senders.component.scss',
  providers: [MessageService],
})
export class EmailSendersComponent implements OnInit {
  private readonly service = inject(EmailSendersService);
  private readonly permissions = inject(PermissionStore);
  private readonly messages = inject(MessageService);

  readonly ehCelular = ehCelular();
  readonly domain = SENDER_DOMAIN;

  readonly senders = signal<Sender[]>([]);
  readonly routes = signal<SenderRoute[]>([]);
  readonly loading = signal(false);
  /** Id do remetente ou origem da rota sendo salva: trava só aquele controle. */
  readonly saving = signal<string | null>(null);

  readonly adding = signal(false);
  newName = '';
  newDisplay = '';
  readonly formError = signal<string | null>(null);
  readonly creating = signal(false);

  readonly canCreate = computed(() => this.permissions.can(SCREEN, 'INCLUIR'));
  readonly canEdit = computed(() => this.permissions.can(SCREEN, 'ALTERAR'));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: list => { this.senders.set(list); this.loading.set(false); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.fail(err, 'Não foi possível carregar os remetentes.'); },
    });
    this.loadRoutes();
  }

  private loadSenders(): void {
    this.service.list().subscribe({ next: list => this.senders.set(list), error: () => undefined });
  }

  private loadRoutes(): void {
    this.service.routes().subscribe({
      next: r => this.routes.set(r),
      error: (err: HttpErrorResponse) => this.fail(err, 'Não foi possível carregar os serviços.'),
    });
  }

  // ── Remetentes ──

  blockReason(s: Sender): string | null {
    return deactivateBlock(s);
  }

  usedBy(s: Sender): string {
    return usedByText(s, this.routes());
  }

  deactivate(s: Sender): void {
    if (deactivateBlock(s) || !this.canEdit() || this.saving()) return;
    this.setActive(s, false);
  }

  activate(s: Sender): void {
    if (!this.canEdit() || this.saving()) return;
    this.setActive(s, true);
  }

  private setActive(s: Sender, active: boolean): void {
    this.saving.set(s.id);
    this.service.update(s.id, { active }).subscribe({
      next: updated => {
        this.saving.set(null);
        this.replaceSender(updated);
        this.toast(active ? `${updated.address} ativado.` : `${updated.address} desativado.`);
      },
      error: (err: HttpErrorResponse) => { this.saving.set(null); this.fail(err, 'Não foi possível salvar.'); },
    });
  }

  makeDefault(s: Sender): void {
    if (!s.active || s.isDefault || !this.canEdit() || this.saving()) return;
    this.saving.set(s.id);
    this.service.makeDefault(s.id).subscribe({
      next: updated => {
        this.saving.set(null);
        // O anterior deixa de ser padrão: a lista inteira muda.
        this.senders.update(list => list.map(x => x.id === updated.id ? updated : { ...x, isDefault: false }));
        this.toast(`${updated.address} é o remetente padrão.`);
      },
      error: (err: HttpErrorResponse) => { this.saving.set(null); this.fail(err, 'Não foi possível tornar padrão.'); },
    });
  }

  openNew(): void {
    this.newName = '';
    this.newDisplay = '';
    this.formError.set(null);
    this.adding.set(true);
  }

  cancelNew(): void {
    this.adding.set(false);
    this.formError.set(null);
  }

  createSender(): void {
    if (this.creating()) return;
    const error = validateNewSender(this.newName, this.newDisplay, this.senders());
    this.formError.set(error);
    if (error) return;
    this.creating.set(true);
    this.service.create(this.newName.trim().toLowerCase(), this.newDisplay.trim()).subscribe({
      next: created => {
        this.creating.set(false);
        this.adding.set(false);
        this.senders.update(list => [...list, created]);
        this.toast(`${created.address} cadastrado. Confira se ele está autorizado no SMTP.`);
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        this.formError.set(apiMessage(err) ?? 'Não foi possível cadastrar.');
      },
    });
  }

  // ── Rotas ──

  choices(currentId: string | null): Sender[] {
    return senderChoices(this.senders(), currentId);
  }

  optionLabel(s: Sender): string {
    return senderOptionLabel(s);
  }

  /** Salva na hora. Erro devolve o select ao que a API tem. */
  changeRoute(route: SenderRoute, field: 'senderId' | 'replyToId', value: string | null): void {
    if (!this.canEdit()) return;
    const next = { ...route, [field]: value || null };
    this.routes.update(list => list.map(r => r.origin === route.origin ? next : r));
    this.saving.set(route.origin);
    this.service.updateRoute(route.origin, next.senderId, next.replyToId).subscribe({
      next: saved => {
        this.saving.set(null);
        this.routes.update(list => list.map(r => r.origin === saved.origin ? saved : r));
        this.loadSenders();
        this.toast(this.routeMessage(saved, field));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(null);
        this.fail(err, 'Não foi possível salvar.');
        this.loadRoutes();
      },
    });
  }

  private routeMessage(r: SenderRoute, field: 'senderId' | 'replyToId'): string {
    const addr = (id: string | null) => this.senders().find(s => s.id === id)?.address;
    if (field === 'senderId') {
      return r.senderId ? `${r.label}: passa a sair como ${addr(r.senderId) ?? 'o remetente escolhido'}.`
        : `${r.label}: passa a sair pelo remetente padrão.`;
    }
    return r.replyToId ? `${r.label}: resposta vai para ${addr(r.replyToId) ?? 'o remetente escolhido'}.`
      : `${r.label}: resposta desligada.`;
  }

  private replaceSender(updated: Sender): void {
    this.senders.update(list => list.map(s => s.id === updated.id ? updated : s));
  }

  private toast(detail: string): void {
    this.messages.add({ severity: 'success', summary: 'Salvo', detail });
  }

  private fail(err: HttpErrorResponse, fallback: string): void {
    this.messages.add({ severity: 'warn', summary: 'Erro', detail: apiMessage(err) ?? fallback });
  }
}
