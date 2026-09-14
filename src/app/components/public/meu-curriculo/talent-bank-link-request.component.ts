import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { apiMessage } from '../../../domain/utils/api-error';
import { TalentBankService } from '../../../infrastructure/services/processoSeletivo/talent-bank/talent-bank.service';

/** O mesmo intervalo em que a API ignora um novo pedido. */
const COOLDOWN_SEGUNDOS = 60;

/**
 * `/meu-curriculo` — pede o link para ver o que foi enviado.
 *
 * **A tela diz a mesma coisa para qualquer e-mail**, e não é por preguiça: a
 * API responde igual exista ou não o endereço, e a frase aqui é a única coisa
 * que a pessoa vê. Qualquer ramo que diferenciasse os dois casos revelaria quem
 * está procurando emprego — só que agora na tela.
 */
@Component({
  selector: 'app-talent-bank-link-request',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './talent-bank-link-request.component.html',
  styleUrl: './meu-curriculo.scss',
})
export class TalentBankLinkRequestComponent {
  private readonly service = inject(TalentBankService);

  readonly email = signal('');
  readonly estado = signal<'pedir' | 'enviado'>('pedir');
  readonly enviando = signal(false);
  readonly erro = signal('');

  /**
   * A contagem não protege nada — quem protege é a API. Ela existe para a
   * pessoa não achar que o botão quebrou quando o segundo pedido não gera
   * e-mail nenhum.
   */
  readonly segundosParaReenviar = signal(0);

  private relogio?: ReturnType<typeof setInterval>;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pararRelogio());
  }

  emailValido(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim());
  }

  enviar(): void {
    if (!this.emailValido() || this.enviando() || this.segundosParaReenviar() > 0) return;

    this.enviando.set(true);
    this.erro.set('');

    this.service.pedirLink(this.email().trim().toLowerCase()).subscribe({
      next: () => {
        this.enviando.set(false);
        this.estado.set('enviado');
        this.iniciarContagem();
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        this.erro.set(
          err?.status === 400
            ? apiMessage(err) ?? 'Confira o e-mail digitado.'
            : 'Não conseguimos enviar agora. Tente de novo em instantes.',
        );
      },
    });
  }

  /** O intervalo da API é por pessoa: outro e-mail não precisa esperar este. */
  trocarEmail(): void {
    this.pararRelogio();
    this.segundosParaReenviar.set(0);
    this.estado.set('pedir');
    this.erro.set('');
  }

  contagemFormatada(): string {
    const s = this.segundosParaReenviar();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  private iniciarContagem(): void {
    this.pararRelogio();
    this.segundosParaReenviar.set(COOLDOWN_SEGUNDOS);
    this.relogio = setInterval(() => {
      const restante = this.segundosParaReenviar() - 1;
      this.segundosParaReenviar.set(Math.max(restante, 0));
      if (restante <= 0) this.pararRelogio();
    }, 1000);
  }

  private pararRelogio(): void {
    if (this.relogio) {
      clearInterval(this.relogio);
      this.relogio = undefined;
    }
  }
}
