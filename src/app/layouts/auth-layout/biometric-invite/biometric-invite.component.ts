import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PkButtonComponent } from '../../../components/theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../components/theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../components/theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { BiometricError, BiometricLoginService } from '../../../infrastructure/services/auth/biometric-login.service';
import { WebAuthnApiService } from '../../../infrastructure/services/auth/webauthn-api.service';
import { ehCelular } from '../../../infrastructure/state/eh-celular';

/**
 * "Entrar com a digital da próxima vez?" — uma vez, logo depois de entrar com
 * a senha (mockup aprovado em 2026-09-30). Folha no celular, diálogo no
 * computador; mora no layout, como o aviso de saída.
 *
 * Não aparece quando: o aparelho não tem leitor, a pessoa disse "não perguntar
 * de novo" aqui, ou este aparelho já tem a digital DELA ativa. "Já tem" é
 * conferido na API: se o RH removeu, o aparelho ainda lembraria de uma
 * credencial morta, e o convite nunca mais voltaria.
 */
@Component({
  selector: 'app-biometric-invite',
  standalone: true,
  imports: [NgTemplateOutlet, PkButtonComponent, PkDialogComponent, PkSheetComponent],
  templateUrl: './biometric-invite.component.html',
  styleUrl: './biometric-invite.component.scss',
})
export class BiometricInviteComponent implements OnInit {

  protected readonly biometric = inject(BiometricLoginService);
  private readonly api = inject(WebAuthnApiService);
  protected readonly isPhone = ehCelular();

  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal(false);
  private login = '';

  protected readonly title = 'Entrada rápida';

  async ngOnInit(): Promise<void> {
    const login = this.biometric.takeInvite();
    if (!login || this.biometric.declined(login) || !(await this.biometric.available())) return;

    const device = this.biometric.remembered();
    if (device?.login === login) {
      try {
        const mine = await firstValueFrom(this.api.myDevices());
        if (mine.some(d => d.credentialId === device.credentialId)) return;
        this.biometric.forget();
      } catch {
        return; // sem como conferir agora: melhor não perguntar do que perguntar errado
      }
    }
    this.login = login;
    this.open.set(true);
  }

  /** "celular" ou "computador": o convite diz onde a digital vai valer. */
  protected get place(): string {
    return this.isPhone() ? 'celular' : 'computador';
  }

  async enable(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.biometric.enable();
      this.done.set(true);
    } catch (e) {
      this.error.set(e instanceof BiometricError ? e.message : 'Não deu para ativar agora. Tente de novo pelo Perfil.');
    } finally {
      this.busy.set(false);
    }
  }

  notNow(): void {
    this.open.set(false);
  }

  neverHere(): void {
    this.biometric.decline(this.login);
    this.open.set(false);
  }
}
