import { Component, DOCUMENT, inject, signal } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';

/** Os dois momentos que a tela mostra. Fora deles, ela não existe. */
export type UpdatePhase = 'baixando' | 'instalando';

/**
 * A tela que aparece quando uma versão nova do app chega.
 *
 * Antes disto o `app.component` chamava `location.reload()` no instante em que
 * a versão ficava pronta. A tela piscava, e quem estava usando não sabia se
 * travou, se caiu ou se tinha apertado algo.
 *
 * O comportamento continua o mesmo — atualiza sozinho, ninguém decide nada. Só
 * deixou de ser invisível.
 *
 * **Não existe porcentagem, e não é escolha de layout.** O `SwUpdate` avisa
 * quando o download começa e quando termina, e nada entre as duas coisas: não
 * há bytes baixados nem total. Qualquer número aqui seria inventado. Por isso o
 * indicador é indeterminado — ele diz *está acontecendo*, que é a única coisa
 * verdadeira que se sabe.
 *
 * O indicador são as barras do símbolo da marca. O logo já é uma pilha de
 * traços horizontais de comprimentos diferentes, ou seja, a marca já desenha
 * movimento; usar isso é mais honesto do que um spinner que poderia estar em
 * qualquer aplicação.
 */
@Component({
  selector: 'app-update-splash',
  imports: [],
  templateUrl: './update-splash.component.html',
  styleUrl: './update-splash.component.scss',
})
export class UpdateSplashComponent {
  private readonly swUpdate = inject(SwUpdate);

  /**
   * O `document` injetado, e não o global.
   *
   * `document.location.reload()` direto funciona em produção e é impossível de
   * testar: o teste recarrega a própria página do Karma no meio da suíte. Pelo
   * token, o teste troca por um dublê e afirma que o reload foi pedido — que é
   * a metade mais importante desta tela, e a que não dá para ver olhando.
   */
  private readonly document = inject(DOCUMENT);

  /** Nulo enquanto não há atualização — e é assim quase o tempo todo. */
  readonly fase = signal<UpdatePhase | null>(null);

  constructor() {
    // Em desenvolvimento o service worker não é registrado
    // (`app.config.ts`), então nada disto roda e a tela nunca aparece.
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.subscribe(evento => this.reagir(evento));
  }

  /**
   * Um `switch` sobre os quatro eventos, e não um `filter` por
   * `VERSION_READY`.
   *
   * O filtro era o que existia antes e escondia dois casos que importam: o
   * começo do download, que é a espera de verdade, e a falha, que precisa tirar
   * a tela da frente.
   */
  private reagir(evento: VersionEvent): void {
    switch (evento.type) {
      case 'VERSION_DETECTED':
        // Começou a baixar. É aqui que a espera real acontece.
        this.fase.set('baixando');
        break;

      case 'VERSION_READY':
        // Já está tudo em cache: o reload daqui é quase instantâneo, e o texto
        // muda mais para fechar a frase do que porque haja o que esperar.
        this.fase.set('instalando');
        this.document.location.reload();
        break;

      case 'VERSION_INSTALLATION_FAILED':
        // Sai da frente e o app segue na versão atual. Uma tela azul travada
        // seria pior do que não atualizar.
        this.fase.set(null);
        break;

      // NO_NEW_VERSION_DETECTED é a maioria absoluta das checagens e não muda
      // nada na tela. Listado para o `switch` não parecer incompleto.
      default:
        break;
    }
  }
}
