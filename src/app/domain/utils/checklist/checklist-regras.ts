import { apenasDigitos, cnpjValido, cpfValido } from '../../../infrastructure/validators/documento-br';
import {
  ChecklistAddress, ChecklistContent, ChecklistCustomer, ChecklistOrderItem,
} from '../../models/sales/checklist.model';

/**
 * O que um checklist precisa ter para ser enviado — a mesma regra do
 * `ChecklistRules` da API, com as mesmas frases. O celular confere aqui, sem
 * internet, e a revisão aponta a etapa; a API confere de novo ao receber.
 *
 * Obrigatórios por decisão dele (2026-09-29): endereço e dados cadastrais /
 * contrato. O resto é o que a planilha já pedia, e o pedido — opcional, mas
 * quando existe precisa fechar a conta.
 */

/** As oito etapas, na ordem da planilha. */
export const ETAPAS = [
  { numero: 1, titulo: 'Qual é o cliente?', curto: 'Cliente' },
  { numero: 2, titulo: 'Endereço', curto: 'Endereço' },
  { numero: 3, titulo: 'Dados do contrato', curto: 'Contrato' },
  { numero: 4, titulo: 'Instalação e máquinas', curto: 'Instalação' },
  { numero: 5, titulo: 'Equipamentos em comodato', curto: 'Comodato' },
  { numero: 6, titulo: 'Comunicação visual', curto: 'Comunicação' },
  { numero: 7, titulo: 'Pedido', curto: 'Pedido' },
  { numero: 8, titulo: 'Conferir e enviar', curto: 'Enviar' },
] as const;

export interface Problema {
  etapa: number;
  /** O campo, para a etapa rolar até ele e marcá-lo. */
  campo: string;
  mensagem: string;
}

const EMAIL = /^[a-zA-Z0-9_+&*-]+(?:\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

export function emailValido(valor: string | null | undefined): boolean {
  return !!valor && EMAIL.test(valor.trim());
}

function vazio(valor: string | null | undefined): boolean {
  return !valor || !valor.trim();
}

/**
 * Nome e sobrenome: duas palavras com duas letras ou mais ("Maria Souza").
 * Pedido dele (2026-09-30); "Maria S." não passa. A mesma regra da API.
 */
export function nomeCompleto(valor: string | null | undefined): boolean {
  return (valor ?? '').trim().split(/\s+/).filter(p => p.replace(/[^\p{L}]/gu, '').length >= 2).length >= 2;
}

function telefone(valor: string | null | undefined): boolean {
  const n = apenasDigitos(valor ?? '').length;
  return n === 10 || n === 11;
}

export function problemas(c: ChecklistContent): Problema[] {
  const lista: Problema[] = [];
  cliente(c.customer, lista);
  endereco(2, 'Etapa 2 — endereço principal', 'principal', c.mainAddress, lista);
  if (c.deliverySameAsMain === null || c.deliverySameAsMain === undefined) {
    lista.push({ etapa: 2, campo: 'entregaIgual', mensagem: 'Etapa 2 — responda se a entrega é no mesmo endereço.' });
  } else if (!c.deliverySameAsMain) {
    endereco(2, 'Etapa 2 — endereço de entrega', 'entrega', c.deliveryAddress, lista);
  }
  instalacao(c, lista);
  comodato(c, lista);
  visual(c, lista);
  pedido(c, lista);
  return lista;
}

export function problemasDaEtapa(c: ChecklistContent, etapa: number): Problema[] {
  return problemas(c).filter(p => p.etapa === etapa);
}

function cliente(c: ChecklistCustomer | null, lista: Problema[]): void {
  if (!c || (vazio(c.name) && c.code === null && !c.newCustomer)) {
    lista.push({ etapa: 1, campo: 'cliente', mensagem: 'Etapa 1 — escolha o cliente ou cadastre um cliente novo.' });
    return;
  }
  const add = (etapa: number, campo: string, mensagem: string) => lista.push({ etapa, campo, mensagem });
  if (vazio(c.name)) add(1, 'nome', 'Etapa 1 — informe o nome do cliente.');
  const doc = apenasDigitos(c.document ?? '');
  if (!(doc.length === 11 ? cpfValido(doc) : cnpjValido(doc))) add(3, 'documento', 'Etapa 3 — o CNPJ (ou CPF) do cliente é inválido.');
  if (vazio(c.stateRegistration)) add(3, 'ie', 'Etapa 3 — informe a inscrição estadual (ou ISENTO).');
  if (!telefone(c.mainPhone)) add(3, 'telefone', 'Etapa 3 — informe o telefone principal com DDD.');
  if (!telefone(c.mobile)) add(3, 'celular', 'Etapa 3 — informe o celular com DDD.');
  if (vazio(c.signatory)) add(3, 'assinante', 'Etapa 3 — informe quem assina o contrato.');
  else if (!nomeCompleto(c.signatory)) add(3, 'assinante', 'Etapa 3 — escreva o nome e o sobrenome de quem assina.');
  if (!cpfValido(c.signatoryCpf ?? '')) add(3, 'cpf', 'Etapa 3 — o CPF de quem assina é inválido.');
  if (!emailValido(c.invoiceEmail)) add(3, 'emailNf', 'Etapa 3 — o e-mail para as notas fiscais é inválido.');
  if (!emailValido(c.contractEmail)) add(3, 'emailContrato', 'Etapa 3 — o e-mail para o contrato é inválido.');
}

function endereco(etapa: number, onde: string, prefixo: string, a: ChecklistAddress | null, lista: Problema[]): void {
  const add = (campo: string, texto: string) => lista.push({ etapa, campo: `${prefixo}.${campo}`, mensagem: `${onde}: ${texto}` });
  if (!a) {
    add('cep', 'preencha o endereço.');
    return;
  }
  if (apenasDigitos(a.zipCode ?? '').length !== 8) add('cep', 'o CEP precisa ter 8 números.');
  if (vazio(a.street)) add('rua', 'informe a rua.');
  if (vazio(a.number)) add('numero', 'informe o número (ou S/N).');
  if (vazio(a.district)) add('bairro', 'informe o bairro.');
  if (vazio(a.city)) add('cidade', 'informe a cidade.');
  if (!/^[A-Za-z]{2}$/.test((a.state ?? '').trim())) add('uf', 'informe o estado (UF), como SP.');
}

function instalacao(c: ChecklistContent, lista: Problema[]): void {
  const i = c.installation;
  const add = (campo: string, mensagem: string) => lista.push({ etapa: 4, campo, mensagem });
  if (!i || i.withMaintenance === null || i.withMaintenance === undefined) {
    add('manutencao', 'Etapa 4 — responda se o pedido vai com a manutenção.');
  }
  if (!i || i.needsMachine === null || i.needsMachine === undefined) {
    add('precisaMaquina', 'Etapa 4 — responda se vai precisar de máquina no cliente.');
    return;
  }
  if (!i.needsMachine) return;
  if (!i.machines.length) add('maquinas', 'Etapa 4 — informe qual máquina vai para o cliente.');
  i.machines.forEach((m, n) => {
    const onde = `Etapa 4 — máquina ${n + 1}`;
    if (!m.type) add(`maquina${n}.tipo`, `${onde}: escolha o tipo.`);
    else if (m.type === 'OUTRA' && vazio(m.otherType)) add(`maquina${n}.outra`, `${onde}: escreva qual é a máquina.`);
    if (!(m.quantity >= 1)) add(`maquina${n}.qtd`, `${onde}: a quantidade precisa ser pelo menos 1.`);
    if (m.withTable === null || m.withTable === undefined) add(`maquina${n}.mesa`, `${onde}: responda se vai com mesa.`);
  });
}

function comodato(c: ChecklistContent, lista: Problema[]): void {
  const k = c.comodato;
  if (!k) return;
  for (const item of k.items) {
    if (!(item.quantity >= 1)) {
      lista.push({ etapa: 5, campo: `comodato.${item.productCode}`,
        mensagem: `Etapa 5 — a quantidade de "${item.popularName || item.name}" precisa ser pelo menos 1.` });
    }
  }
  k.extraItems.forEach((item, n) => {
    if (vazio(item.description)) {
      lista.push({ etapa: 5, campo: `extra${n}`, mensagem: 'Etapa 5 — escreva o nome do item que não estava na lista.' });
    } else if (!(item.quantity >= 1)) {
      lista.push({ etapa: 5, campo: `extra${n}`,
        mensagem: `Etapa 5 — a quantidade de "${item.description.trim()}" precisa ser pelo menos 1.` });
    }
  });
}

function visual(c: ChecklistContent, lista: Problema[]): void {
  const v = c.visual;
  if (v?.technicalDocs && !emailValido(v.technicalDocsEmail)) {
    lista.push({ etapa: 6, campo: 'emailDocs', mensagem: 'Etapa 6 — informe o e-mail para a documentação técnica.' });
  }
}

function pedido(c: ChecklistContent, lista: Problema[]): void {
  const o = c.order;
  if (!o || !o.enabled) return;
  const add = (campo: string, mensagem: string) => lista.push({ etapa: 7, campo, mensagem });
  if (o.kind !== 'VENDA' && o.kind !== 'BONIFICADO') add('tipoPedido', 'Etapa 7 — escolha se o pedido é venda ou bonificado.');
  if (!o.items.length) add('itens', 'Etapa 7 — o pedido precisa de pelo menos um produto (ou marque "sem pedido").');
  for (const item of o.items) {
    const nome = `"${item.name}"`;
    if (!(item.packages >= 1)) add(`item.${item.productCode}`, `Etapa 7 — a quantidade de ${nome} precisa ser pelo menos 1.`);
    if (!(item.packageSize && item.packageSize > 0)) add(`item.${item.productCode}`, `Etapa 7 — informe o tamanho da embalagem de ${nome}.`);
    if (item.unitPrice === null || item.unitPrice < 0) add(`item.${item.productCode}`, `Etapa 7 — ${nome} está sem preço.`);
  }
}

// ─── Conta do pedido ────────────────────────────────────────────────────────

/**
 * embalagens × tamanho × preço, mais o IPI — a conta da planilha, em
 * centavos para não acumular erro de ponto flutuante. A API refaz a mesma
 * conta e é a dela que vale no comprovante.
 */
export function totalDaLinha(item: Pick<ChecklistOrderItem, 'packages' | 'packageSize' | 'unitPrice' | 'ipiPercent'>): number {
  if (!item.packageSize || item.unitPrice === null || item.unitPrice === undefined) return 0;
  const base = item.packages * item.packageSize * item.unitPrice;
  const comIpi = base * (1 + (item.ipiPercent ?? 0) / 100);
  return Math.round((comIpi + Number.EPSILON) * 100) / 100;
}

export function totalDoPedido(itens: ChecklistOrderItem[]): number {
  return Math.round(itens.reduce((soma, i) => soma + totalDaLinha(i), 0) * 100) / 100;
}

// ─── Um checklist em branco ─────────────────────────────────────────────────

export function enderecoVazio(): ChecklistAddress {
  return { zipCode: null, street: null, number: null, complement: null, district: null, city: null, state: null };
}

export function checklistVazio(): ChecklistContent {
  return {
    customer: null,
    mainAddress: enderecoVazio(),
    deliverySameAsMain: true,
    deliveryAddress: null,
    unitContact: { name: null, receivingHours: null, phone: null },
    installation: { withMaintenance: null, needsMachine: null, machines: [], notes: null },
    comodato: { items: [], extraItems: [], notes: null },
    visual: { items: [], products: [], technicalDocs: null, technicalDocsEmail: null },
    order: { enabled: false, kind: 'VENDA', items: [], total: null },
  };
}

/** Busca sem acento, caixa ou espaço sobrando — "mercado cen" acha "MERCADO CENTRAL". */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
