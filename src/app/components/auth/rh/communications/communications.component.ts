import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkMultiselectComponent } from '../../../theme/ProautoKimium/pk-multiselect/pk-multiselect.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { AnnouncementService } from '../../../../infrastructure/services/hr/announcement.service';
import { EmployeeNotificationService } from '../../../../infrastructure/services/hr/employee-notification.service';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { Announcement } from '../../../../domain/models/hr/announcement.model';
import { SendNotificationResult } from '../../../../domain/models/hr/employee-notification.model';
import { apiMessage } from '../../../../domain/utils/api-error';

/**
 * Onde o comunicado sai.
 *
 * Não existe "mural sem sino": publicar no mural já toca o sino de todos os
 * ativos (AnnouncementService.publish). Por isso as opções são duas, e não
 * duas caixas independentes como no mockup de 2026-10-02.
 */
export type Channel = 'MURAL' | 'BELL';
export type Audience = 'specific' | 'all';

/** O limite de cada canal na API: o aviso do mural é longo, a notificação é curta. */
export const TEXT_LIMIT: Record<Channel, number> = { MURAL: 4000, BELL: 500 };

/**
 * Comunicados do RH (2026-10-05): Mural de Avisos e Notificações numa tela só.
 *
 * Eram duas telas com quase o mesmo formulário. Aqui o RH escreve uma vez e
 * escolhe onde sai. Cada canal continua com a tela dele na grade — quem só
 * publicava no mural vê só o mural, e não precisou de migration.
 */
@Component({
  selector: 'app-communications',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast, PkButtonComponent, PkInputComponent, PkMultiselectComponent,
            PageHeaderComponent],
  templateUrl: './communications.component.html',
  styleUrl: './communications.component.scss',
  providers: [MessageService],
})
export class CommunicationsComponent implements OnInit {
  private readonly announcements = inject(AnnouncementService);
  private readonly notifications = inject(EmployeeNotificationService);
  private readonly employees = inject(EmployeeStore);
  private readonly permissions = inject(PermissionStore);
  private readonly messages = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  readonly limits = TEXT_LIMIT;
  readonly employeeOptions = this.employees.activeOptions;

  /** Os canais que esta pessoa pode usar, na ordem da tela. */
  readonly channels = computed<Channel[]>(() => [
    ...(this.permissions.can('rh/announcements', 'INCLUIR') ? ['MURAL' as Channel] : []),
    ...(this.permissions.can('rh/notifications', 'ENVIAR') ? ['BELL' as Channel] : []),
  ]);
  readonly canReadMural = computed(() => this.permissions.can('rh/announcements', 'CONSULTAR'));

  readonly channel = signal<Channel>('MURAL');
  readonly audience = signal<Audience>('specific');

  readonly form = this.fb.nonNullable.group({
    employeeIds: [[] as string[]],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    text: ['', [Validators.required, Validators.maxLength(TEXT_LIMIT.MURAL)]],
    link: ['', Validators.maxLength(300)],
  });

  readonly sending = signal(false);
  readonly lastResult = signal<SendNotificationResult | null>(null);
  readonly published = signal<Announcement[]>([]);
  readonly loadingList = signal(false);

  ngOnInit(): void {
    const first = this.channels()[0];
    if (first) this.setChannel(first);
    if (this.channels().includes('BELL')) this.employees.load();
    if (this.canReadMural()) this.loadMural();
  }

  setChannel(channel: Channel): void {
    this.channel.set(channel);
    this.lastResult.set(null);
    const text = this.form.controls.text;
    text.setValidators([Validators.required, Validators.maxLength(TEXT_LIMIT[channel])]);
    text.updateValueAndValidity();
  }

  setAudience(audience: Audience): void {
    this.audience.set(audience);
    this.form.controls.employeeIds.setValue([]);
  }

  get canSend(): boolean {
    const { title, text } = this.form.controls;
    if (title.invalid || text.invalid) return false;
    if (this.channel() === 'BELL' && this.audience() === 'specific') {
      return this.form.controls.employeeIds.value.length > 0;
    }
    return true;
  }

  send(): void {
    if (!this.canSend || this.sending()) return;
    const { employeeIds, title, text, link } = this.form.getRawValue();
    this.sending.set(true);

    if (this.channel() === 'MURAL') {
      this.announcements.publish({ title: title.trim(), content: text.trim() }).subscribe({
        next: () => {
          this.done('Publicado no mural. Todos os funcionários ativos receberam o aviso no sino.');
          this.loadMural();
        },
        error: (err: HttpErrorResponse) => this.fail(err),
      });
      return;
    }

    this.notifications.send({
      employeeIds: this.audience() === 'all' ? null : employeeIds,
      title: title.trim(),
      message: text.trim(),
      link: link.trim() || null,
    }).subscribe({
      next: result => {
        this.lastResult.set(result);
        this.done(`${result.notified} funcionário(s) notificado(s).`);
      },
      error: (err: HttpErrorResponse) => this.fail(err),
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  private loadMural(): void {
    this.loadingList.set(true);
    this.announcements.getAll().subscribe({
      next: list => {
        this.published.set(list);
        this.loadingList.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingList.set(false);
        this.messages.add({ severity: 'warn', summary: 'Erro', detail: apiMessage(err) ?? 'Não foi possível carregar o mural.' });
      },
    });
  }

  private done(detail: string): void {
    this.sending.set(false);
    this.form.reset({ employeeIds: [], title: '', text: '', link: '' });
    this.messages.add({ severity: 'success', summary: 'Enviado', detail });
  }

  private fail(err: HttpErrorResponse): void {
    this.sending.set(false);
    this.messages.add({ severity: 'warn', summary: 'Erro', detail: apiMessage(err) ?? 'Não foi possível enviar.' });
  }
}
