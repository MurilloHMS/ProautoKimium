import { NgTemplateOutlet } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WebAuthnDevice } from '../../../../../domain/models/webauthn.model';
import { apiMessageOrFallback } from '../../../../../domain/utils/api-error';
import { WebAuthnApiService } from '../../../../../infrastructure/services/auth/webauthn-api.service';
import { ehCelular } from '../../../../../infrastructure/state/eh-celular';
import { activatedText, lastUseText } from '../../../../../infrastructure/webauthn/device-texts';
import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';

/**
 * "Acesso com digital", no cadastro do funcionário: o RH e o ADMIN veem os
 * aparelhos e removem um, ou todos quando alguém sai da empresa (decisão dele,
 * 2026-09-30). A pessoa é avisada no sino pela API.
 */
@Component({
  selector: 'app-employee-biometric-devices',
  standalone: true,
  imports: [NgTemplateOutlet, PkButtonComponent, PkDialogComponent, PkSheetComponent],
  templateUrl: './employee-biometric-devices.component.html',
  styleUrl: './employee-biometric-devices.component.scss',
})
export class EmployeeBiometricDevicesComponent {

  readonly employeeId = input.required<string>();
  readonly employeeName = input('');

  private readonly api = inject(WebAuthnApiService);
  protected readonly isPhone = ehCelular();

  protected readonly devices = signal<WebAuthnDevice[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  /** O que o RH mandou remover: um aparelho, ou 'all'. */
  protected readonly confirming = signal<WebAuthnDevice | 'all' | null>(null);

  protected readonly activatedText = activatedText;
  protected readonly lastUseText = lastUseText;

  constructor() {
    effect(() => {
      const id = this.employeeId();
      void this.load(id);
    });
  }

  protected confirmTitle(target: WebAuthnDevice | 'all'): string {
    const who = this.employeeName() || 'o funcionário';
    return target === 'all'
      ? `Remover os ${this.devices().length} aparelhos de ${who}?`
      : `Remover ${target.deviceLabel} de ${who}?`;
  }

  async remove(): Promise<void> {
    const target = this.confirming();
    if (!target || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.removeFromEmployee(this.employeeId(), target === 'all' ? null : target.id));
      this.confirming.set(null);
      await this.load(this.employeeId());
    } catch (e) {
      this.confirming.set(null);
      this.error.set(await apiMessageOrFallback(e, 'Não deu para remover agora. Tente de novo.'));
    } finally {
      this.busy.set(false);
    }
  }

  private async load(employeeId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.devices.set(await firstValueFrom(this.api.employeeDevices(employeeId)));
    } catch (e) {
      this.error.set(await apiMessageOrFallback(e, 'Não deu para carregar os aparelhos.'));
    } finally {
      this.loading.set(false);
    }
  }
}
