// ═══════════════════════════════════════════════════════════════════════════
// Banco de talentos — as regras da tela que não dependem de Angular
// ═══════════════════════════════════════════════════════════════════════════

/** O mesmo teto do `CurriculoValidator` da API. Passar dele vira 413. */
export const TAMANHO_MAXIMO_DO_CURRICULO = 10 * 1024 * 1024;

/**
 * O que a tela recusa antes de mandar. A API confere os bytes de novo — isto só
 * poupa a pessoa de esperar o upload inteiro para ouvir "não é PDF".
 *
 * Aceita pelo nome **ou** pelo tipo: alguns navegadores de celular entregam o
 * arquivo com `type` vazio, e recusar por isso barraria um PDF de verdade.
 */
export function erroDoCurriculo(arquivo: File): string | null {
  const pareceUmPdf = arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name);
  if (!pareceUmPdf) return 'Envie o currículo em PDF.';
  if (arquivo.size > TAMANHO_MAXIMO_DO_CURRICULO) return 'O arquivo passa de 10 MB.';
  return null;
}

/** A palavra que libera o botão de apagar. */
export const PALAVRA_DE_CONFIRMACAO = 'APAGAR';

/**
 * Sem diferença de maiúsculas e sem espaço nas pontas: o teclado do celular
 * escreve "Apagar " sozinho, e recusar isso não protege ninguém — o que a
 * palavra impede é o clique distraído, não a digitação.
 */
export function confirmouExclusao(texto: string | null | undefined): boolean {
  return (texto ?? '').trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO;
}

export type PapelDaAutorizacao = 'success' | 'warning' | 'neutral';

export interface SituacaoDaAutorizacao {
  papel: PapelDaAutorizacao;
  icone: string;
  rotulo: string;
}

/** A partir de quantos dias antes do vencimento o chip avisa. É o mesmo prazo do e-mail de aviso. */
export const DIAS_DE_AVISO = 30;

const UM_DIA = 24 * 60 * 60 * 1000;

/**
 * O chip da coluna "Autorização" da aba do RH.
 *
 * **Sem `consentimentoEm` é um terceiro estado, e não "vencido".** São as
 * pessoas que se candidataram antes de 2026-09-11: não disseram sim nem não, e
 * o expurgo não as toca. Tratar como vencido as esconderia do RH; tratar como
 * autorizado prometeria um aceite que ninguém deu.
 */
export function situacaoDaAutorizacao(
  consentimentoEm: string | null,
  expiraEm: string | null,
  agora: Date,
): SituacaoDaAutorizacao {
  if (!consentimentoEm) {
    return { papel: 'neutral', icone: 'pi pi-question-circle', rotulo: 'Sem registro' };
  }

  const expira = lerDataHora(expiraEm);
  if (!expira) {
    return { papel: 'success', icone: 'pi pi-check-circle', rotulo: 'Autorizado' };
  }

  const restante = expira.getTime() - agora.getTime();
  if (restante <= 0) {
    return { papel: 'neutral', icone: 'pi pi-clock', rotulo: `Venceu em ${formatarData(expiraEm)}` };
  }

  const dias = Math.ceil(restante / UM_DIA);
  if (dias <= DIAS_DE_AVISO) {
    return {
      papel: 'warning',
      icone: 'pi pi-hourglass',
      rotulo: dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`,
    };
  }

  return { papel: 'success', icone: 'pi pi-check-circle', rotulo: `Até ${formatarData(expiraEm)}` };
}

/**
 * `LocalDateTime` da API, sem fuso. `new Date("2026-09-14T10:32:00")` já é hora
 * local em todo navegador atual; só a data sozinha ("2026-09-14") seria UTC, e
 * por isso ela ganha a meia-noite explícita.
 */
export function lerDataHora(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const texto = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T00:00:00` : valor;
  const data = new Date(texto);
  return isNaN(data.getTime()) ? null : data;
}

export function formatarData(valor: string | null | undefined): string {
  const data = lerDataHora(valor);
  if (!data) return '—';
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
}

/**
 * O prazo que a renovação vai gravar, para a tela dizer antes de salvar.
 *
 * Imita o `plusMonths` do Java, que encosta no último dia do mês: 29/02 mais
 * 24 meses é 28/02, e não 01/03 — que é o que o `Date` faria sozinho.
 */
export function prazoAoRenovar(agora: Date, meses = 24): string {
  const ultimoDiaDoMes = new Date(agora.getFullYear(), agora.getMonth() + meses + 1, 0).getDate();
  const data = new Date(
    agora.getFullYear(),
    agora.getMonth() + meses,
    Math.min(agora.getDate(), ultimoDiaDoMes),
  );
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
}
