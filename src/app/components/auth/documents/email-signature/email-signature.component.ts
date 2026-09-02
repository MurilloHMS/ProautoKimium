import {
  Component, ElementRef, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkSegmentedComponent } from '../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { EmailSignatureService } from '../../../../infrastructure/services/emailSignature/email-signature.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import type { CampoDoTemplate, TemplateDeAssinatura } from '../../../../domain/models/assinatura-template.model';
import {
  desenharNoContexto, paraPng, esperarFontes, fonteEstaDisponivel,
} from '../../../../domain/utils/assinatura/renderizador';

type Modo = 'gerar' | 'layout';

/** A tela é uma só, e a permissão de configurar decide se o modo Layout existe. */
export const TELA = 'communication/email-signature';

@Component({
  selector: 'app-email-signature',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, PkInputComponent, PkButtonComponent, PkSegmentedComponent],
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
      queueMicrotask(() => this.desenhar());
    });

    void this.carregar();
  }

  // ── Carga ───────────────────────────────────────────────────────────────
  private async carregar(): Promise<void> {
    try {
      const template = await firstValueFrom(this.service.buscar());

      // Valores de exemplo no modo Layout: sem eles o designer posiciona
      // caixas contra strings vazias e não enxerga nada.
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
}
