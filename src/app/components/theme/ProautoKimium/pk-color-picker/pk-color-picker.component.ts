import { ChangeDetectorRef, Component, computed, inject, input, Optional, Self, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  ControlValueAccessor,
  FormsModule,
  NgControl,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { ColorPickerModule } from 'primeng/colorpicker';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

/**
 * A paleta que o guia usa para dar nome à cor — cópia fiel de
 * `ColorNameUtil.PALETTE`, na API.
 *
 * Não é decoração: o PDF não imprime o hex, imprime o nome da cor mais próxima
 * destas onze por distância euclidiana em RGB. Escolher daqui é o único jeito
 * de o nome impresso ser exatamente o que a pessoa quis dizer — `#1e5ab4` sai
 * como "Azul", e um azul qualquer também sai como "Azul", mas aí é sorte.
 *
 * Se a paleta mudar na API, muda aqui junto. As duas listas não têm como se
 * conversar, e desalinhadas o seletor promete um nome e o PDF imprime outro.
 */
export const PALETA_GUIA: ReadonlyArray<{ nome: string; hex: string }> = [
  { nome: 'Branco',   hex: '#ffffff' },
  { nome: 'Preto',    hex: '#000000' },
  { nome: 'Cinza',    hex: '#808080' },
  { nome: 'Vermelho', hex: '#dc2626' },
  { nome: 'Laranja',  hex: '#ea8c1e' },
  { nome: 'Amarelo',  hex: '#f5d228' },
  { nome: 'Verde',    hex: '#22a050' },
  { nome: 'Azul',     hex: '#1e5ab4' },
  { nome: 'Roxo',     hex: '#783ca0' },
  { nome: 'Rosa',     hex: '#eb6eaa' },
  { nome: 'Marrom',   hex: '#784828' },
];

/**
 * Normaliza para `#rrggbb`, ou devolve nulo se não der.
 *
 * O atalho de três dígitos do CSS (`#abc`) é expandido de propósito:
 * `ColorCircleRenderer` aceita ele (exige só `#` e comprimento ≥ 4), mas
 * `ColorNameUtil` devolve nulo abaixo de 6 dígitos. Gravar `#abc` produziria
 * bolinha sem nome no guia — meio caminho, que é pior que os dois extremos.
 */
export function normalizarHex(valor: string | null | undefined): string | null {
  if (!valor) return null;

  let h = valor.trim().toLowerCase();
  if (!h.startsWith('#')) h = '#' + h;

  if (/^#[0-9a-f]{3}$/.test(h)) {
    h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }

  return /^#[0-9a-f]{6}$/.test(h) ? h : null;
}

/** O nome que o guia vai imprimir para este hex — mesma conta da API. */
export function nomeNoGuia(hex: string): string | null {
  const c = normalizarHex(hex);
  if (!c) return null;

  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);

  let melhor = PALETA_GUIA[0];
  let menor = Number.MAX_VALUE;

  for (const cor of PALETA_GUIA) {
    const pr = parseInt(cor.hex.slice(1, 3), 16);
    const pg = parseInt(cor.hex.slice(3, 5), 16);
    const pb = parseInt(cor.hex.slice(5, 7), 16);
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < menor) { menor = d; melhor = cor; }
  }

  return melhor.nome;
}

/** Uma cor já escolhida, com tudo que a tela precisa saber sobre ela. */
export interface PkColorChip {
  /** Exatamente o que está gravado — inclusive lixo legado como "Vermelho". */
  valor: string;
  /** O mesmo valor em `#rrggbb`, ou nulo se não for um hex. */
  hex: string | null;
  /** O nome que o guia imprimiria. Nulo quando o valor não é hex. */
  nome: string | null;
  /** Se esta cor chega ao guia. Falso para valor inválido e para o excedente. */
  noGuia: boolean;
}

/**
 * Escolha das cores de um produto, escrita para o que o guia de utilização faz
 * com elas.
 *
 * Era `p-colorPicker` + campo de hex + botão Adicionar, duplicado nos dois
 * formulários da tela de produtos, com duas portas de entrada incompatíveis: o
 * botão validava `#rrggbb` e um segundo caminho aceitava texto livre separado
 * por vírgula. Por isso existem produtos com a cor gravada como "Vermelho".
 *
 * O que o componente resolve é que **a lista não é uma lista de cores, é o que
 * vai sair impresso**, e o guia descarta em silêncio:
 *
 * - `ColorCircleRenderer` só desenha valores que começam com `#`. "Vermelho"
 *   não vira bolinha nenhuma — e o JRXML então imprime o texto cru na coluna.
 * - Ele desenha **no máximo quatro**, contadas depois do descarte. A quinta
 *   cor válida não existe para o PDF.
 *
 * Nada disso aparece em lugar nenhum: o produto salva, o guia gera, e a falha
 * é uma célula estranha num PDF que ninguém confere. Aqui os dois casos ficam
 * marcados enquanto a pessoa escolhe.
 *
 * Não há migração automática dos valores legados de propósito. "Vermelho" não
 * tem um hex certo — o vermelho da paleta é `#dc2626`, mas o produto pode ser
 * outro vermelho, e chutar mudaria a cor impressa de um produto real. O
 * componente mostra, marca, e deixa a correção para quem conhece o produto.
 */
@Component({
  selector: 'pk-color-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, ColorPickerModule, InputTextModule, TooltipModule],
  templateUrl: './pk-color-picker.component.html',
  styleUrl: './pk-color-picker.component.scss',
})
export class PkColorPickerComponent implements ControlValueAccessor, Validator {

  private readonly cdr = inject(ChangeDetectorRef);

  label = input<string>('Cores');
  inputId = input<string>('');

  /** Quantas chegam ao guia. Quatro é o limite do `ColorCircleRenderer`. */
  max = input<number>(4);

  readonly paleta = PALETA_GUIA;

  private readonly valores = signal<string[]>([]);
  readonly erro = signal<string>('');
  readonly rascunho = signal<string>('');

  isDisabled = false;

  /**
   * A conta do excedente é feita **sobre as válidas**, na mesma ordem da API:
   * `filter(...).limit(4)`. Uma lista com "Vermelho" na frente e quatro hexes
   * atrás entrega as quatro — o valor inválido não ocupa vaga.
   */
  readonly chips = computed<PkColorChip[]>(() => {
    let validas = 0;

    return this.valores().map(valor => {
      const hex = normalizarHex(valor);
      const noGuia = hex !== null && ++validas <= this.max();

      return {
        valor,
        hex,
        nome: hex ? nomeNoGuia(hex) : null,
        noGuia,
      };
    });
  });

  readonly temInvalida = computed(() => this.chips().some(c => !c.hex));
  readonly temExcedente = computed(() => this.chips().some(c => c.hex && !c.noGuia));

  private onChange = (_: string[]) => {};
  private onTouched = () => {};

  constructor(@Optional() @Self() public ngControl: NgControl) {
    if (ngControl) {
      ngControl.valueAccessor = this;
    }
  }

  writeValue(value: string[] | null): void {
    this.valores.set(value ?? []);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }

  setDisabledState(disabled: boolean): void {
    this.isDisabled = disabled;
    this.cdr.markForCheck();
  }

  validate(_: AbstractControl): ValidationErrors | null {
    return null;
  }

  /** Clique numa cor da paleta: adiciona, ou remove se já estiver escolhida. */
  alternarDaPaleta(hex: string): void {
    if (this.isDisabled) return;

    const jaTem = this.valores().some(v => normalizarHex(v) === hex);
    if (jaTem) {
      this.publicar(this.valores().filter(v => normalizarHex(v) !== hex));
      return;
    }

    this.publicar([...this.valores(), hex]);
  }

  estaEscolhida(hex: string): boolean {
    return this.valores().some(v => normalizarHex(v) === hex);
  }

  /** Adiciona o que está no campo de hex ou no seletor livre. */
  adicionar(): void {
    if (this.isDisabled) return;

    const bruto = this.rascunho().trim();
    if (!bruto) return;

    const hex = normalizarHex(bruto);
    if (!hex) {
      this.erro.set('Use um hex no formato #RRGGBB — ex.: #1E90FF.');
      return;
    }

    if (this.valores().some(v => normalizarHex(v) === hex)) {
      this.erro.set('Essa cor já está na lista.');
      return;
    }

    this.publicar([...this.valores(), hex]);
    this.rascunho.set('');
  }

  remover(valor: string): void {
    if (this.isDisabled) return;
    this.publicar(this.valores().filter(v => v !== valor));
  }

  /** O seletor visual devolve o hex sem '#'; o campo de texto trabalha com ele. */
  aoEscolherNoSeletor(valor: string): void {
    if (!valor) return;
    this.rascunho.set(valor.startsWith('#') ? valor : '#' + valor);
    this.erro.set('');
  }

  aoDigitar(valor: string): void {
    this.rascunho.set(valor);
    this.erro.set('');
  }

  /** Texto legível sobre uma amostra — claro em fundo escuro e vice-versa. */
  contraste(hex: string | null): string {
    const c = normalizarHex(hex);
    if (!c) return 'var(--app-action)';

    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);

    // Luminância relativa aproximada, a mesma conta que a tela já fazia.
    const luz = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luz > 0.6 ? '#1f2937' : '#ffffff';
  }

  private publicar(lista: string[]): void {
    this.valores.set(lista);
    this.erro.set('');
    this.onChange(lista);
    this.onTouched();
  }
}
