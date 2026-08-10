/**
 * Catálogo das ferramentas de PDF.
 *
 * Fica separado do componente porque duas telas leem a mesma lista: o hub
 * monta os cartões e cada ferramenta pega daqui seu título e descrição — assim
 * o texto não é escrito duas vezes e não diverge.
 *
 * `available: false` é proposital: o cartão aparece desabilitado em vez de
 * sumir. Um pdf24 mostra o que existe; esconder a ferramenta faria o usuário
 * procurar por ela em outro lugar.
 */
export interface PdfTool {
  key: string;
  label: string;
  description: string;
  icon: string;
  /** Tom do cartão — categoria, não estado (ver os acentos da home). */
  accent: 'navy' | 'teal' | 'amber' | 'purple' | 'red' | 'green';
  /**
   * SEMPRE com barra no início. O hub já vive em `/tools/pdf`, e link sem
   * barra é resolvido relativo à rota atual — `['tools/pdf/unlock']` viraria
   * `/tools/pdf/tools/pdf/unlock` e cairia no 404.
   */
  routerLink?: string[];
  available: boolean;
}

export const PDF_TOOLS: PdfTool[] = [
  {
    key: 'unlock',
    label: 'Desbloquear PDF',
    description: 'Remove a senha de um PDF protegido. Você precisa saber a senha atual.',
    icon: 'pi pi-unlock',
    accent: 'navy',
    routerLink: ['/tools/pdf/unlock'],
    available: true,
  },
  {
    key: 'nfse-rename',
    label: 'Renomear NFS-e',
    description: 'Renomeia notas em lote pelo conteúdo do arquivo e devolve tudo num ZIP.',
    icon: 'pi pi-tag',
    accent: 'teal',
    routerLink: ['/tools/pdf/nfse-rename'],
    available: true,
  },
  {
    key: 'split',
    label: 'Dividir PDF',
    description: 'Separa um PDF em vários arquivos, por página ou por intervalo.',
    icon: 'pi pi-clone',
    accent: 'amber',
    available: false,
  },
  {
    key: 'merge',
    label: 'Juntar PDF',
    description: 'Combina vários PDFs num só, na ordem que você escolher.',
    icon: 'pi pi-copy',
    accent: 'purple',
    available: false,
  },
  {
    key: 'crop',
    label: 'Recortar PDF',
    description: 'Ajusta as margens das páginas.',
    icon: 'pi pi-expand',
    accent: 'green',
    available: false,
  },
  {
    key: 'rotate',
    label: 'Girar páginas',
    description: 'Corrige páginas digitalizadas de lado ou de cabeça para baixo.',
    icon: 'pi pi-refresh',
    accent: 'red',
    available: false,
  },
];

export function pdfTool(key: string): PdfTool {
  const tool = PDF_TOOLS.find(item => item.key === key);
  if (!tool) throw new Error(`Ferramenta de PDF desconhecida: ${key}`);
  return tool;
}
