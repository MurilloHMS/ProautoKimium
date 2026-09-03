import { Component, computed, inject, input, signal } from '@angular/core';

import { InstalacaoService } from '../../../infrastructure/services/instalacao.service';

/**
 * O convite para instalar o app.
 *
 * Muda de forma por plataforma, e é aí que está o ponto: no Android existe um
 * botão que instala com um toque; no iPhone **não existe API nenhuma**, só o
 * gesto de Compartilhar → Adicionar à Tela de Início. Mostrar "Instalar" para
 * quem não tem botão seria mentir; mostrar instruções para quem tem botão
 * seria trabalho à toa.
 *
 * O público é 40+, então o passo a passo do iPhone desenha os ícones em vez de
 * descrevê-los: "o quadradinho com a seta" é mais difícil de achar por nome do
 * que de reconhecer por forma.
 */
@Component({
  selector: 'app-instalar',
  standalone: true,
  templateUrl: './instalar.component.html',
  styleUrl: './instalar.component.scss',
})
export class InstalarComponent {

  private readonly instalacao = inject(InstalacaoService);

  /**
   * `faixa` é a barra dispensável do topo; `bloco` é o convite dentro de uma
   * tela, que não se dispensa porque a pessoa foi até lá de propósito.
   */
  readonly formato = input<'faixa' | 'bloco'>('faixa');

  /** Explica POR QUE instalar, quando quem chama tem um motivo melhor. */
  readonly motivo = input<string>('');

  /**
   * A faixa do topo some por 14 dias quando dispensada; o bloco dentro de uma
   * tela, não. Quem navegou até a tela foi atrás disso — esconder ali seria
   * punir a pessoa por um toque que ela deu em outro lugar.
   */
  readonly aparecer = computed(() =>
    this.instalacao.podeConvidar()
    && (this.formato() === 'bloco' || !this.instalacao.dispensadoRecentemente()));
  readonly plataforma = this.instalacao.plataforma;
  readonly podeInstalarDireto = this.instalacao.podeInstalarDireto;

  readonly instalando = signal(false);
  readonly passosAbertos = signal(false);

  readonly ehIos = computed(() => this.plataforma() === 'ios');

  async instalar(): Promise<void> {
    this.instalando.set(true);
    try {
      await this.instalacao.instalar();
    } finally {
      this.instalando.set(false);
    }
  }

  dispensar(): void {
    this.instalacao.dispensar();
  }

  alternarPassos(): void {
    this.passosAbertos.update(aberto => !aberto);
  }
}
