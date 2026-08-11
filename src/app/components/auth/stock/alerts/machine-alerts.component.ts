import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { PkMultiselectComponent } from '../../../theme/ProautoKimium/pk-multiselect/pk-multiselect.component';
import { Toast } from 'primeng/toast';

import { DEFAULT_ALERT_CONFIG, MachineAlertConfig } from '../../../../domain/models/prostock/machine-alert.model';
import { MachineAlertService } from '../../../../infrastructure/services/prostock/machine-alert.service';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { MachineStatus } from '../../../../domain/models/prostock/machine.model';
import { parseDateOnly } from '../../../../domain/utils/date-only';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkCheckboxComponent } from '../../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component';

/**
 * Configuração dos alertas de previsão de saída.
 *
 * A tela é pequena de propósito: quem configura isso mexe uma vez e esquece.
 * O que ela precisa deixar claro é o efeito — por isso a prévia diz quantos
 * registros seriam avisados hoje com a configuração atual.
 */
@Component({
  selector: 'app-machine-alerts',
  standalone: true,
  imports: [
    CommonModule, FormsModule, InputTextModule, Toast,
    PageHeaderComponent, PkButtonComponent, PkCheckboxComponent, PkMultiselectComponent,
  ],
  templateUrl: './machine-alerts.component.html',
  styleUrl: './machine-alerts.component.scss',
  providers: [MessageService],
})
export class MachineAlertsComponent implements OnInit, TabDirtyCheck {

  private readonly service = inject(MachineAlertService);
  private readonly employeeStore = inject(EmployeeStore);
  private readonly registerStore = inject(MachineRegisterStore);
  private readonly messageService = inject(MessageService);

  /** Só ativos: alerta para quem saiu da empresa volta como e-mail perdido. */
  readonly employeeOptions = this.employeeStore.activeOptions;

  readonly config = signal<MachineAlertConfig>({ ...DEFAULT_ALERT_CONFIG });
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly dirty = signal(false);

  /** Campo de texto: "7, 1" é mais rápido de digitar do que uma lista de chips. */
  daysInput = '3';

  isTabDirty(): boolean {
    return this.dirty();
  }

  ngOnInit(): void {
    this.employeeStore.load();
    this.registerStore.load();
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service.get().subscribe({
      next: (config) => {
        this.config.set(config ?? { ...DEFAULT_ALERT_CONFIG });
        this.daysInput = (config?.daysBefore ?? []).join(', ');
        this.loading.set(false);
        this.dirty.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        // 404 = nunca configurado. Não é erro, é o primeiro acesso.
        if (err.status !== 404) this.showError(err);
      },
    });
  }

  patch<K extends keyof MachineAlertConfig>(key: K, value: MachineAlertConfig[K]): void {
    this.config.update(current => ({ ...current, [key]: value }));
    this.dirty.set(true);
  }

  /** Aceita "7, 1" ou "7 1"; ignora o que não for número positivo. */
  onDaysChange(raw: string): void {
    this.daysInput = raw;
    const days = raw
      .split(/[,\s]+/)
      .map(part => Number(part.trim()))
      .filter(value => Number.isInteger(value) && value >= 0)
      .filter((value, index, list) => list.indexOf(value) === index)
      .sort((a, b) => b - a);

    this.patch('daysBefore', days);
  }

  get daysInvalid(): boolean {
    return this.config().daysBefore.length === 0;
  }

  get recipientsInvalid(): boolean {
    return this.config().recipientEmployeeIds.length === 0;
  }

  get canSave(): boolean {
    return !this.daysInvalid && !this.recipientsInvalid && !this.saving();
  }

  /**
   * Prévia: quantos registros o alerta pegaria se rodasse agora. Sem isto o
   * usuário só descobre se acertou quando o e-mail chega — ou não chega.
   */
  readonly preview = computed(() => {
    const { daysBefore, alertWhenLate } = this.config();
    const today = startOfToday();

    return this.registerStore.items()
      .filter(register => register.status !== MachineStatus.ENTREGUE && register.previsaoEntrega)
      .filter(register => {
        const date = parseDateOnly(register.previsaoEntrega)!;
        const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);

        if (days < 0) return alertWhenLate;
        return daysBefore.includes(days);
      })
      .length;
  });

  save(): void {
    if (!this.canSave) return;

    this.saving.set(true);
    this.service.save(this.config()).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.dirty.set(false);
        if (saved) this.config.set(saved);
        this.messageService.add({
          severity: 'success',
          summary: 'Configuração salva',
          detail: this.config().active ? 'Os alertas estão ativos.' : 'Salvo, mas os alertas estão desligados.',
        });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.showError(err);
      },
    });
  }

  sendTest(): void {
    this.testing.set(true);
    this.service.sendTest().subscribe({
      next: () => {
        this.testing.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Teste enviado',
          detail: 'O e-mail entrou na fila e sai no próximo ciclo.',
        });
      },
      error: (err: HttpErrorResponse) => {
        this.testing.set(false);
        this.showError(err);
      },
    });
  }

  private showError(err: HttpErrorResponse): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Erro',
      detail: err.status === 0 ? 'Sem conexão com o servidor.'
        : err.status === 404 ? 'A API ainda não tem o endpoint de configuração de alertas.'
        : typeof err.error === 'string' ? err.error : 'Erro inesperado.',
    });
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
