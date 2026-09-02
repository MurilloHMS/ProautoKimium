/**
 * Catálogo das calculadoras.
 *
 * Mesmo arranjo do catálogo de PDF, e pelo mesmo motivo: duas telas leem a
 * mesma lista — o hub monta os cartões e cada calculadora pega daqui seu
 * título e sua descrição, então o texto existe uma vez só e não diverge.
 */
export interface Calculadora {
  key: string;
  label: string;
  description: string;
  icon: string;
  /** Tom do cartão — categoria, não estado (ver os acentos da home). */
  accent: 'navy' | 'teal' | 'amber' | 'purple';
  /**
   * SEMPRE com barra no início. O hub vive em `/documentos/calculadoras`, e
   * link sem barra é resolvido relativo à rota atual — cairia em
   * `/documentos/calculadoras/documentos/calculadoras/combustivel`.
   *
   * É também o código da tela no catálogo de permissões, sem a barra.
   */
  routerLink: string[];
}

export const CALCULADORAS: Calculadora[] = [
  {
    key: 'combustivel',
    label: 'Álcool ou gasolina',
    description: 'Compara o custo por quilômetro rodado, e não o preço da bomba.',
    icon: 'pi pi-bolt',
    accent: 'teal',
    routerLink: ['/documentos/calculadoras/combustivel'],
  },
  {
    key: 'cmv',
    label: 'CMV',
    description: 'Custo, preço de venda e percentual: informe dois, receba o terceiro.',
    icon: 'pi pi-percentage',
    accent: 'navy',
    routerLink: ['/documentos/calculadoras/cmv'],
  },
];

export function calculadora(key: string): Calculadora {
  const item = CALCULADORAS.find(c => c.key === key);
  if (!item) throw new Error(`Calculadora desconhecida: ${key}`);
  return item;
}
