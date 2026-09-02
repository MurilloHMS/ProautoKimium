import {
  Component, ElementRef, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkSegmentedComponent } from '../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { PkComboboxComponent } from '../../../theme/ProautoKimium/pk-combobox/pk-combobox.component';
import { PkFileUploadComponent } from '../../../theme/ProautoKimium/pk-file-upload/pk-file-upload.component';
import { EmailSignatureService } from '../../../../infrastructure/services/emailSignature/email-signature.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import type { CampoDoTemplate, TemplateDeAssinatura } from '../../../../domain/models/assinatura-template.model';
import {
  desenharNoContexto, paraPng, esperarFontes, fonteEstaDisponivel,
} from '../../../../domain/utils/assinatura/renderizador';
import {
  pontoNoTemplate, prenderNaTela, chaveDisponivel, campoNovo, comCampoTrocado, semCampo,
} from '../../../../domain/utils/assinatura/editor';

type Modo = 'gerar' | 'layout';

/** A tela é uma só, e a permissão de configurar decide se o modo Layout existe. */
export const TELA = 'communication/email-signature';

@Component({
  selector: 'app-email-signature',
  standalone: true,
  imports: [
    FormsModule, PageHeaderComponent, PkInputComponent, PkButtonComponent,
    PkSegmentedComponent, PkComboboxComponent, PkFileUploadComponent,
  ],
  templateUrl: './email-signature.component.html',
  styleUrl: './email-signature.component.scss',
})
export class EmailSignatureComponent {

  private readonly service = inject(EmailSignatureService);
  private readonly permissions = inject(PermissionStore);

  private readonly telaCanvas = viewChild<ElementRef<HTMLCanvasElement>>('tela');

  readonly modo = signal<Modo>('gerar');
  readonly podeEditar = computed(() => this.permissions.can(TELA, 'CONFIGURAR'));

  readonly opcoesDeModo = [
    { label: 'Gerar', value: 'gerar' },
    { label: 'Layout', value: 'layout' },
  ];

  readonly template = signal<TemplateDeAssinatura | null>(null);
  readonly valores = signal<Record<string, string>>({});
  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly aviso = signal('');

  /** A arte de fundo já decodificada. Nula enquanto não chega. */
  private fundo: ImageBitmap | null = null;

  /**
   * Os campos na ordem que o designer definiu — é a ordem do formulário e a
   * do empilhamento no desenho.
   */
  readonly campos = computed(() =>
    [...(this.template()?.campos ?? [])].sort((a, b) => a.ordem - b.ordem));

  constructor() {
    // Redesenha quando o template, os valores ou o modo mudam. O canvas é a
    // própria prévia: não existe um segundo desenho para discordar do PNG.
    effect(() => {
      this.template();
      this.valores();
      this.modo();
      queueMicrotask(() => {
        this.desenhar();
        this.medirEscala();
      });
    });

    void this.carregar();
  }

  // ── Carga ───────────────────────────────────────────────────────────────
  private async carregar(): Promise<void> {
    try {
      const template = await firstValueFrom(this.service.buscar());

      this.valores.set(Object.fromEntries(template.campos.map(c => [c.chave, ''])));

      await this.carregarFundo(template);
      await esperarFontes(template);

      this.template.set(template);
    } catch {
      // Falha alto de propósito: um formulário vazio cravado no código seria
      // uma segunda verdade sobre quais campos a assinatura tem.
      this.erro.set('Não foi possível carregar o modelo da assinatura. Recarregue a página.');
    } finally {
      this.carregando.set(false);
    }
  }

  private async carregarFundo(template: TemplateDeAssinatura): Promise<void> {
    const caminho = template.canvas.fundo.caminho;
    const blob = await firstValueFrom(
      caminho ? this.service.baixarFundo(caminho) : this.service.baixarFundoPadrao());
    this.fundo = await createImageBitmap(blob);
  }

  // ── Desenho ─────────────────────────────────────────────────────────────
  private desenhar(): void {
    const template = this.template();
    const canvas = this.telaCanvas()?.nativeElement;
    if (!template || !canvas) return;

    canvas.width = template.canvas.largura;
    canvas.height = template.canvas.altura;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    desenharNoContexto(ctx, template, this.valoresParaDesenho(), this.fundo);
  }

  /** No Layout, campo vazio mostra o exemplo — senão não há o que posicionar. */
  private valoresParaDesenho(): Record<string, string> {
    const digitados = this.valores();
    if (this.modo() === 'gerar') return digitados;

    return Object.fromEntries(
      this.campos().map(c => [c.chave, digitados[c.chave]?.trim() || c.exemplo]));
  }

  // ── Formulário ──────────────────────────────────────────────────────────
  aoDigitar(chave: string, valor: string): void {
    this.valores.update(atual => ({ ...atual, [chave]: valor }));
  }

  valorDe(campo: CampoDoTemplate): string {
    return this.valores()[campo.chave] ?? '';
  }

  /** Falta algum obrigatório? É o que trava os botões. */
  readonly incompleto = computed(() =>
    this.campos().some(c => c.obrigatorio && !(this.valores()[c.chave] ?? '').trim()));

  // ── Saída ───────────────────────────────────────────────────────────────
  private async png(): Promise<Blob | null> {
    const template = this.template();
    if (!template) return null;

    const ctx = this.telaCanvas()?.nativeElement.getContext('2d');
    const familia = template.campos[0]?.fonte;

    // A guarda que troca um erro silencioso por um alto: com a fonte ainda
    // não carregada, o canvas desenha na substituta sem avisar e o PNG sai
    // com a tipografia errada.
    if (ctx && familia && !fonteEstaDisponivel(ctx, familia)) {
      this.aviso.set(`A fonte ${familia} ainda não carregou. Aguarde um instante e tente de novo.`);
      return null;
    }

    this.aviso.set('');
    return paraPng(template, this.valores(), this.fundo);
  }

  async baixar(): Promise<void> {
    const png = await this.png();
    if (png) this.service.baixar(png);
  }

  async copiar(): Promise<void> {
    const png = await this.png();
    if (!png) return;

    const copiou = await this.service.copiar(png);
    this.aviso.set(copiou
      ? 'Assinatura copiada. Cole no Outlook.'
      : 'O navegador não deixou copiar. Use o botão Baixar.');
  }

  limpar(): void {
    this.valores.set(Object.fromEntries(this.campos().map(c => [c.chave, ''])));
    this.aviso.set('');
  }

  // ══ Layout ══════════════════════════════════════════════════════════════
  //
  // O canvas é a própria prévia; as alças são elementos por cima, sem conteúdo
  // nenhum. Nada desenhado passa pelo DOM, então não há como o editor divergir
  // do PNG. E as alças sendo botões de verdade dão foco, Tab e setas de graça
  // — que no canvas puro precisariam ser reinventados.

  readonly selecionado = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly enviandoFundo = signal(false);

  readonly campoSelecionado = computed(() =>
    this.campos().find(c => c.id === this.selecionado()) ?? null);

  /** Só as fontes que o `index.html` carrega: as outras sairiam em fallback. */
  readonly fontes = [
    { label: 'Montserrat', value: 'Montserrat' },
    { label: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans' },
    { label: 'Roboto', value: 'Roboto' },
  ];

  readonly pesos = [{ label: 'Normal', value: 400 }, { label: 'Negrito', value: 700 }];
  readonly tipos = [
    { label: 'Texto', value: 'TEXTO' }, { label: 'E-mail', value: 'EMAIL' },
    { label: 'Telefone', value: 'TELEFONE' }, { label: 'Site', value: 'URL' },
  ];
  readonly alinhamentos = [
    { label: 'Esquerda', value: 'ESQUERDA' }, { label: 'Centro', value: 'CENTRO' },
    { label: 'Direita', value: 'DIREITA' },
  ];
  readonly verticais = [
    { label: 'Topo', value: 'TOPO' }, { label: 'Meio', value: 'MEIO' },
    { label: 'Base', value: 'BASE' },
  ];
  readonly estouros = [
    { label: 'Encolher', value: 'ENCOLHER' }, { label: 'Quebrar linha', value: 'QUEBRAR' },
    { label: 'Cortar', value: 'CORTAR' },
  ];

  /** A escala entre o arquivo e o que aparece na tela, para posicionar as alças. */
  readonly escala = signal(1);

  medirEscala(): void {
    const canvas = this.telaCanvas()?.nativeElement;
    const template = this.template();
    if (!canvas || !template) return;

    const area = canvas.getBoundingClientRect();
    if (area.width > 0) this.escala.set(area.width / template.canvas.largura);
  }

  // ── Arrastar ────────────────────────────────────────────────────────────
  private arrasto: { id: string; dx: number; dy: number } | null = null;

  aoPegar(evento: PointerEvent, campo: CampoDoTemplate): void {
    const template = this.template();
    const canvas = this.telaCanvas()?.nativeElement;
    if (!template || !canvas) return;

    this.selecionado.set(campo.id);

    const ponto = pontoNoTemplate(
      evento.clientX, evento.clientY, canvas.getBoundingClientRect(), template.canvas);

    // Guarda a distância do ponteiro até o canto do campo: sem isso o campo
    // salta para debaixo do cursor no primeiro movimento.
    this.arrasto = { id: campo.id, dx: ponto.x - campo.x, dy: ponto.y - campo.y };
    (evento.target as HTMLElement).setPointerCapture(evento.pointerId);
  }

  aoArrastar(evento: PointerEvent): void {
    const template = this.template();
    const canvas = this.telaCanvas()?.nativeElement;
    const arrasto = this.arrasto;
    if (!template || !canvas || !arrasto) return;

    const campo = this.campos().find(c => c.id === arrasto.id);
    if (!campo) return;

    const ponto = pontoNoTemplate(
      evento.clientX, evento.clientY, canvas.getBoundingClientRect(), template.canvas);

    this.trocarCampo(prenderNaTela(
      { ...campo, x: ponto.x - arrasto.dx, y: ponto.y - arrasto.dy }, template.canvas));
  }

  aoSoltar(evento: PointerEvent): void {
    if (this.arrasto) (evento.target as HTMLElement).releasePointerCapture(evento.pointerId);
    this.arrasto = null;
  }

  /** Setas movem 1px, com Shift movem 10. É o caminho sem mouse. */
  aoTeclar(evento: KeyboardEvent, campo: CampoDoTemplate): void {
    const passos: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const passo = passos[evento.key];
    const template = this.template();
    if (!passo || !template) return;

    evento.preventDefault();
    const fator = evento.shiftKey ? 10 : 1;
    this.trocarCampo(prenderNaTela(
      { ...campo, x: campo.x + passo[0] * fator, y: campo.y + passo[1] * fator },
      template.canvas));
  }

  // ── Propriedades ────────────────────────────────────────────────────────
  trocarCampo(campo: CampoDoTemplate): void {
    this.template.update(t => (t ? { ...t, campos: comCampoTrocado(t.campos, campo) } : t));
  }

  ajustar<K extends keyof CampoDoTemplate>(chave: K, valor: CampoDoTemplate[K]): void {
    const campo = this.campoSelecionado();
    if (campo) this.trocarCampo({ ...campo, [chave]: valor });
  }

  /** Número vindo de input: texto vazio ou lixo não pode virar NaN no desenho. */
  ajustarNumero(chave: 'x' | 'y' | 'largura' | 'altura' | 'tamanho', texto: string): void {
    const valor = Number(texto);
    if (Number.isFinite(valor)) this.ajustar(chave, Math.round(valor));
  }

  /**
   * Renomear a chave muda o contrato com quem gera, então é recusado quando já
   * existe. O rótulo pode repetir à vontade — ele não é chave de nada.
   */
  renomearChave(texto: string): void {
    const campo = this.campoSelecionado();
    if (!campo) return;

    if (!chaveDisponivel(this.campos(), texto, campo.id)) {
      this.aviso.set(`Já existe um campo com a chave "${texto.trim()}".`);
      return;
    }

    this.aviso.set('');
    const anterior = campo.chave;
    const nova = texto.trim();
    this.trocarCampo({ ...campo, chave: nova });

    // O valor digitado acompanha a chave; senão some da tela ao renomear.
    this.valores.update(v => {
      const copia: Record<string, string> = { ...v };
      const valor = copia[anterior] ?? '';
      delete copia[anterior];
      copia[nova] = valor;
      return copia;
    });
  }

  adicionarCampo(): void {
    const template = this.template();
    if (!template) return;

    const novo = campoNovo(template.campos, template.canvas);
    this.template.set({ ...template, campos: [...template.campos, novo] });
    this.valores.update(v => ({ ...v, [novo.chave]: '' }));
    this.selecionado.set(novo.id);
  }

  removerCampo(): void {
    const campo = this.campoSelecionado();
    if (!campo) return;

    this.template.update(t => (t ? { ...t, campos: semCampo(t.campos, campo.id) } : t));
    this.selecionado.set(null);
  }

  // ── Arte de fundo ───────────────────────────────────────────────────────
  async trocarFundo(arquivos: File[]): Promise<void> {
    const arquivo = arquivos[0];
    const template = this.template();
    if (!arquivo || !template) return;

    this.enviandoFundo.set(true);
    this.aviso.set('');

    try {
      const resposta = await firstValueFrom(this.service.enviarFundo(arquivo));

      // A tela adota o tamanho da arte: esticar uma imagem 1400x600 dentro de
      // 700x300 jogaria fora metade da resolução, calado.
      this.fundo = await createImageBitmap(arquivo);
      this.template.set({
        ...template,
        canvas: {
          ...template.canvas,
          largura: resposta.width,
          altura: resposta.height,
          fundo: { ...template.canvas.fundo, caminho: resposta.path },
        },
      });
      this.aviso.set(`Arte trocada. A tela agora é ${resposta.width}×${resposta.height}.`);
    } catch {
      this.aviso.set('Não foi possível enviar a arte. Confira se é uma imagem.');
    } finally {
      this.enviandoFundo.set(false);
    }
  }

  // ── Salvar ──────────────────────────────────────────────────────────────
  async salvar(): Promise<void> {
    const template = this.template();
    if (!template) return;

    this.salvando.set(true);
    try {
      await firstValueFrom(this.service.salvar(template));
      this.aviso.set('Layout salvo. Vale para todo mundo a partir de agora.');
    } catch {
      this.aviso.set('Não foi possível salvar o layout.');
    } finally {
      this.salvando.set(false);
    }
  }
}
