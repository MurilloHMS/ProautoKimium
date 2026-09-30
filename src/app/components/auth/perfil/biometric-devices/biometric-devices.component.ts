import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WebAuthnDevice } from '../../../../domain/models/webauthn.model';
import { apiMessageOrFallback } from '../../../../domain/utils/api-error';
import { BiometricError, BiometricLoginService } from '../../../../infrastructure/services/auth/biometric-login.service';
import { WebAuthnApiService } from '../../../../infrastructure/services/auth/webauthn-api.service';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import { activatedText, isMobileLabel, lastUseText } from '../../../../infrastructure/webauthn/device-texts';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';

/**
 * "Entrar sem senha", no Perfil: os aparelhos em que a pessoa entra com a
 * digital, qual é o atual, e onde se desliga (mockup, 2026-09-30).
 */
@Component({
  selector: 'app-biometric-devices',
  standalone: true,
  imports: [NgTemplateOutlet, PkButtonComponent, PkDialogComponent, PkSheetComponent],
  templateUrl: './biometric-devices.component.html',
  styleUrl: './biometric-devices.component.scss',
})
export class BiometricDevicesComponent implements OnInit {

  protected readonly biometric = inject(BiometricLoginService);
  private readonly api = inject(WebAuthnApiService);
  protected readonly isPhone = ehCelular();

  protected readonly devices = signal<WebAuthnDevice[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly available = signal(false);
  protected readonly busy = signal(false);
  protected readonly confirming = signal<WebAuthnDevice | null>(null);
  private readonly current = signal(this.biometric.remembered()?.credentialId ?? null);

  /** Este aparelho já tem a digital desta pessoa? Então não se oferece ativar de novo. */
  protected readonly activeHere = computed(() => this.devices().some(d => d.credentialId === this.current()));

  protected readonly isMobileLabel = isMobileLabel;
  protected readonly activatedText = activatedText;
  protected readonly lastUseText = lastUseText;

  async ngOnInit(): Promise<void> {
    this.available.set(await this.biometric.available());
    await this.load();
  }

  protected isCurrent(device: WebAuthnDevice): boolean {
    return device.credentialId === this.current();
  }

  async enableHere(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const device = await this.biometric.enable();
      this.current.set(device.credentialId);
      await this.load();
    } catch (e) {
      this.error.set(e instanceof BiometricError ? e.message : 'Não deu para ativar agora. Tente de novo.');
    } finally {
      this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    const device = this.confirming();
    if (!device || this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.removeMine(device.id));
      // Era este aparelho: ele para de oferecer a digital no login.
      if (this.isCurrent(device)) {
        this.biometric.forget();
        this.current.set(null);
      }
      this.confirming.set(null);
      await this.load();
    } catch (e) {
      this.error.set(await apiMessageOrFallback(e, 'Não deu para remover agora. Tente de novo.'));
      this.confirming.set(null);
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      this.devices.set(await firstValueFrom(this.api.myDevices()));
    } catch (e) {
      this.error.set(await apiMessageOrFallback(e, 'Não deu para carregar os aparelhos.'));
    } finally {
      this.loading.set(false);
    }
  }
}
