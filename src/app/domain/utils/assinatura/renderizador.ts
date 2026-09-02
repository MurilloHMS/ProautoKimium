// ═══════════════════════════════════════════════════════════════════════════
// O canvas
//
// A única parte que toca pixels. Tudo que decide posição está em `desenho.ts`,
// que não conhece canvas nenhum — aqui só se executa a lista de operações.
//
// A prévia do editor e o PNG chamam `desenharNoContexto` igual, no mesmo
// canvas de tamanho igual. É por isso que o que o designer vê é o arquivo: não
// há um segundo desenho para discordar do primeiro.
// ═══════════════════════════════════════════════════════════════════════════

import type { TemplateDeAssinatura } from '../../models/assinatura-template.model';
import { operacoesDoTemplate, type Medidor } from './desenho';

/**
 * O medidor de verdade, sobre um contexto 2D.
 *
 * `fontBoundingBoxAscent`, e nunca `actualBoundingBoxAscent`: o segundo mede a
 * tinta que existe, então "acme" e "Acme" dão valores diferentes e o texto
 * pula verticalmente enquanto se digita.
 */
export function medidorDoContexto(ctx: CanvasRenderingContext2D): Medidor {
  return (texto, fonte) => {
    ctx.font = fonte;
    const m = ctx.measureText(texto);
    return {
      largura: m.width,
      // O fallback é para navegador antigo que não expõe a caixa da fonte.
      ascent: m.fontBoundingBoxAscent ?? parseFloat(fonte) * 0.8,
    };
  };
}

/**
 * Desenha o template inteiro no contexto, em coordenadas do template.
 *
 * NUNCA lê `devicePixelRatio`, `canvas.width` nem zoom. A escala é
 * responsabilidade de quem chama, via `setTransform` — no dia em que esta
 * função precisar saber do zoom, a exportação já quebrou.
 */
export function desenharNoContexto(
  ctx: CanvasRenderingContext2D,
  template: TemplateDeAssinatura,
  valores: Record<string, string>,
  fundo: CanvasImageSource | null,
): void {
  const { largura, altura, corDeFundo } = template.canvas;

  ctx.clearRect(0, 0, largura, altura);
  ctx.fillStyle = corDeFundo;
  ctx.fillRect(0, 0, largura, altura);

  if (fundo) ctx.drawImage(fundo, 0, 0, largura, altura);

  const medir = medidorDoContexto(ctx);

  for (const op of operacoesDoTemplate(template, valores, medir)) {
    if (op.recorte) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(op.recorte.x, op.recorte.y, op.recorte.largura, op.recorte.altura);
      ctx.clip();
    }

    ctx.font = op.fonte;
    ctx.fillStyle = op.cor;
    ctx.textAlign = op.alinhamento;
    // 'alphabetic' porque o `y` das operações é a baseline. Trocar por 'top'
    // aqui deslocaria tudo pelo ascent, silenciosamente.
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(op.texto, op.x, op.y);

    if (op.recorte) ctx.restore();
  }
}

/**
 * O PNG, no tamanho exato que o template declara.
 *
 * Canvas próprio, fora da tela, transform identidade. Exportar do canvas
 * visível traria o `devicePixelRatio` junto — no Windows a 125% o arquivo
 * sairia 875x375, e a assinatura chegaria no e-mail com o tamanho errado.
 */
export async function paraPng(
  template: TemplateDeAssinatura,
  valores: Record<string, string>,
  fundo: CanvasImageSource | null,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = template.canvas.largura;
  canvas.height = template.canvas.altura;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('O navegador não forneceu um contexto 2D.');

  desenharNoContexto(ctx, template, valores, fundo);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Não foi possível gerar a imagem.');
  return blob;
}

/**
 * Espera as fontes do template ficarem prontas.
 *
 * `fillText` não dispara carregamento e não espera: com a fonte faltando, o
 * canvas desenha na substituta **sem erro nenhum** e o PNG sai com a
 * tipografia errada. E é uma corrida — com cache quente funciona, no primeiro
 * acesso do designer não.
 */
export async function esperarFontes(template: TemplateDeAssinatura): Promise<void> {
  const pedidos = template.campos.map(c =>
    document.fonts.load(`${c.peso} ${c.tamanho}px "${c.fonte}"`));

  await Promise.all(pedidos);
  await document.fonts.ready;
}

/**
 * Confere se a fonte pedida está mesmo em uso, e não a substituta.
 *
 * Mede o mesmo texto com a fonte do template e com uma família que não existe.
 * Larguras iguais querem dizer que as duas caíram na mesma substituta — e aí é
 * melhor recusar a exportação do que entregar o PNG errado calado.
 */
export function fonteEstaDisponivel(ctx: CanvasRenderingContext2D, familia: string): boolean {
  const amostra = 'Mmmm WWW iii';

  ctx.font = `700 40px "${familia}", __familia_inexistente__`;
  const comAFonte = ctx.measureText(amostra).width;

  ctx.font = '700 40px __familia_inexistente__';
  const semAFonte = ctx.measureText(amostra).width;

  return Math.abs(comAFonte - semAFonte) > 0.01;
}

/**
 * Carrega a arte de fundo como `Blob`, e nunca por URL.
 *
 * Desenhar imagem de outra origem contamina o canvas e faz `toBlob` lançar —
 * e a arte vem do host da API, que em produção é outro domínio. O detalhe
 * cruel: em desenvolvimento o proxy põe tudo na mesma origem, então o defeito
 * não aparece na máquina de quem escreveu. Blob não tem origem: imune.
 *
 * É o mesmo caminho que a galeria já usa (`gallery.component.ts`).
 */
export async function fundoDoBlob(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}
