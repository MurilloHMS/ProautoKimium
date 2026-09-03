import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

import {
  detectarPlataforma, ehSafariNoIos, type PlataformaDeInstalacao,
} from '../../domain/utils/plataforma-de-instalacao';

/**
 * O evento que o Chrome dispara quando o PWA pode ser instalado.
 *
 * Não está no lib.dom do TypeScript porque nunca foi padronizado — só o
 * Chromium implementa. A tipagem mínima é a que se usa.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Quantos dias o convite fica escondido depois de dispensado. */
const DIAS_ESCONDIDO = 14;

const CHAVE_DISPENSA = 'instalacao:dispensado-em';

/**
 * O estado de "dá para instalar este app, e como".
 *
 * Existe como serviço, e não dentro do componente, por causa de UM detalhe: o
 * `beforeinstallprompt` é disparado **uma vez, cedo**, e some. Um componente
 * que ainda não montou perde o evento — e o evento é a única forma de abrir o
 * instalador do Chrome por código.
 */
@Injectable({
  providedIn: 'root',
})
export class InstalacaoService {

  private readonly document = inject(DOCUMENT);
  private readonly janela = this.document.defaultView;

  /** Guardado porque só pode ser usado uma vez, e não pode ser recriado. */
  private eventoDeInstalacao: BeforeInstallPromptEvent | null = null;

  private readonly temEventoGuardado = signal(false);
  private readonly instalouAgora = signal(false);
  private readonly dispensadoEm = signal<number | null>(this.lerDispensa());

  readonly plataforma = signal<PlataformaDeInstalacao>(this.detectar());

  /** No iOS, só o Safari tem "Adicionar à Tela de Início" no compartilhar. */
  readonly ehSafari = signal(ehSafariNoIos(this.janela?.navigator.userAgent ?? ''));

  /**
   * O Android só ganha botão quando o evento chegou. Antes disso, o Chrome não
   * considera o app instalável — mostrar um botão que não faz nada é pior que
   * não mostrar botão.
   */
  readonly podeInstalarDireto = computed(() =>
    this.plataforma() === 'android' && this.temEventoGuardado());

  /**
   * Quando mostrar o convite. `instalado` nunca; iOS fora do Safari nunca,
   * porque lá não existe caminho; e nada durante a quarentena da dispensa.
   */
  readonly deveConvidar = computed(() => {
    if (this.instalouAgora()) return false;

    const plataforma = this.plataforma();
    if (plataforma === 'instalado' || plataforma === 'desktop') return false;
    if (plataforma === 'ios' && !this.ehSafari()) return false;
    if (plataforma === 'android' && !this.temEventoGuardado()) return false;

    return !this.estaNaQuarentena();
  });

  constructor() {
    if (!this.janela) return;

    this.janela.addEventListener('beforeinstallprompt', evento => {
      // Sem o preventDefault, o Chrome mostra a própria barra — e aí são dois
      // convites competindo pela mesma decisão.
      evento.preventDefault();
      this.eventoDeInstalacao = evento as BeforeInstallPromptEvent;
      this.temEventoGuardado.set(true);
    });

    this.janela.addEventListener('appinstalled', () => {
      this.eventoDeInstalacao = null;
      this.temEventoGuardado.set(false);
      this.instalouAgora.set(true);
      this.plataforma.set('instalado');
    });
  }

  /**
   * Abre o instalador do Chrome. Devolve o que a pessoa escolheu.
   *
   * `dismissed` **não** esconde o convite: recusar uma vez não é a mesma coisa
   * que dispensar, e o Chrome já não mostra de novo na mesma sessão de
   * qualquer jeito.
   */
  async instalar(): Promise<'accepted' | 'dismissed' | 'indisponivel'> {
    const evento = this.eventoDeInstalacao;
    if (!evento) return 'indisponivel';

    await evento.prompt();
    const { outcome } = await evento.userChoice;

    // O evento não se reusa: depois do prompt ele está gasto.
    this.eventoDeInstalacao = null;
    this.temEventoGuardado.set(false);

    return outcome;
  }

  /** Esconde o convite por duas semanas. */
  dispensar(): void {
    const agora = Date.now();
    this.dispensadoEm.set(agora);
    try {
      this.janela?.localStorage.setItem(CHAVE_DISPENSA, String(agora));
    } catch {
      // Navegador com armazenamento bloqueado: o convite volta na próxima
      // visita. Chato, e melhor que quebrar a tela.
    }
  }

  private estaNaQuarentena(): boolean {
    const quando = this.dispensadoEm();
    if (quando === null) return false;

    const passou = Date.now() - quando;
    return passou < DIAS_ESCONDIDO * 24 * 60 * 60 * 1000;
  }

  private lerDispensa(): number | null {
    try {
      const bruto = this.janela?.localStorage.getItem(CHAVE_DISPENSA);
      const valor = Number(bruto);
      return bruto && Number.isFinite(valor) ? valor : null;
    } catch {
      return null;
    }
  }

  private detectar(): PlataformaDeInstalacao {
    const navegador = this.janela?.navigator;

    return detectarPlataforma({
      userAgent: navegador?.userAgent ?? '',
      displayStandalone: this.janela?.matchMedia('(display-mode: standalone)').matches ?? false,
      // `standalone` só existe no Safari, então não está no tipo Navigator.
      navigatorStandalone: (navegador as { standalone?: boolean } | undefined)?.standalone,
    });
  }
}
