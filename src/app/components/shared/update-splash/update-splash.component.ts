import { Component, DestroyRef, DOCUMENT, inject, signal } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';

/**
 * O intervalo MÍNIMO entre duas checagens, valendo para os dois gatilhos.
 *
 * Cada checagem baixa o `ngsw.json` inteiro: 21 KB, ~8,8 KB comprimidos na
 * rede. E baixa mesmo quando nada mudou — o servidor manda
 * `Cache-Control: no-store`, então não existe `304` aqui. O ETag está lá e é
 * inútil enquanto essa diretiva estiver.
 *
 * Por isso o intervalo é um TETO e não só um timer: sem ele, quem alterna entre
 * o app e o WhatsApp cinquenta vezes num dia dispararia cinquenta downloads,
 * porque cada volta é um `visibilitychange`. Com o teto, o pior caso do dia
 * inteiro são 48 checagens — cerca de 420 KB, ou ~13 MB por mês para quem
 * deixa o app aberto o tempo todo.
 */
const INTERVALO_DE_CHECAGEM_MS = 30 * 60 * 1000;

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

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Em desenvolvimento o service worker não é registrado
    // (`app.config.ts`), então nada disto roda e a tela nunca aparece.
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.subscribe(evento => this.reagir(evento));
    this.agendarChecagens();
  }

  /**
   * Pergunta ao servidor se existe versão nova — de tempos em tempos e ao
   * voltar para o app.
   *
   * **Por que não basta o registro.** O service worker do Angular só procura
   * versão nova quando a página carrega e a cada navegação. Numa SPA que fica
   * aberta o dia todo não existe nem uma coisa nem outra, então a sessão nunca
   * pergunta e fica na versão que pegou ao abrir.
   *
   * O caso pior é o app instalado na tela de início: ele abre uma vez e vive
   * meses sem recarregar. Foi assim que uma correção de 24/08 continuou
   * invisível no iPhone em 01/09 — o Safari já tinha pego a versão nova, e o
   * ícone da tela de início ainda servia a antiga.
   *
   * Dois gatilhos, e o segundo é o que resolve o app instalado: meia em meia
   * hora, e toda vez que a aba volta a ficar visível. Voltar para o app é
   * exatamente o momento em que se quer a versão de hoje.
   */
  private agendarChecagens(): void {
    const timer = setInterval(() => this.checkNow(), INTERVALO_DE_CHECAGEM_MS);

    // `visibilitychange` e não `focus`: o `focus` dispara ao clicar de volta na
    // janela mesmo sem ela ter saído de vista, e faria uma requisição a cada
    // ida e volta entre o app e outra janela na mesma tela.
    const aoVoltar = () => this.checkNow();
    this.document.addEventListener('visibilitychange', aoVoltar);

    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      this.document.removeEventListener('visibilitychange', aoVoltar);
    });
  }

  /** Quando foi a última pergunta ao servidor. Zero = nunca. */
  private ultimaChecagem = 0;

  /**
   * Uma checagem, sem barulho nenhum e no máximo uma a cada meia hora.
   *
   * Não pergunta com a aba escondida: o timer continua correndo em segundo
   * plano, e checar ali gasta rede para um resultado que ninguém vai ver — se
   * houver versão nova, a volta para o app pergunta de novo em seguida.
   *
   * O teto vale para os DOIS gatilhos somados, e é o que torna o
   * `visibilitychange` seguro: cada alternância entre o app e outro aplicativo
   * é uma volta, e num celular isso acontece dezenas de vezes por dia. Sem o
   * teto, cada uma delas baixaria 8,8 KB.
   *
   * A promessa é engolida de propósito. `checkForUpdate` rejeita quando o
   * aparelho está sem rede, que é situação normal num celular, e uma falha
   * dessas não é assunto de quem está usando o sistema. O `versionUpdates`
   * continua sendo o único caminho por onde uma atualização aparece na tela.
   */
  checkNow(): void {
    if (this.document.visibilityState === 'hidden') return;

    const agora = Date.now();
    if (agora - this.ultimaChecagem < INTERVALO_DE_CHECAGEM_MS) return;

    // Marcado antes de perguntar, e não depois: marcar no retorno deixaria duas
    // voltas rápidas dispararem duas requisições, porque a segunda chegaria
    // antes de a primeira responder.
    this.ultimaChecagem = agora;
    this.swUpdate.checkForUpdate().catch(() => undefined);
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
