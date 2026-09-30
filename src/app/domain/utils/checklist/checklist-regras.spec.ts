import { checklistValido } from '../../../../testing/checklist-fixtures';
import { checklistVazio, nomeCompleto, normalizar, problemas, totalDaLinha, totalDoPedido } from './checklist-regras';

/**
 * As regras do celular são as da API (ChecklistRules), com as mesmas frases:
 * o que o celular deixa enviar, o servidor aceita.
 */
describe('checklist-regras', () => {

  it('o checklist de exemplo passa', () => {
    expect(problemas(checklistValido())).toEqual([]);
  });

  it('um checklist em branco aponta as etapas 1, 2 e 4', () => {
    const etapas = new Set(problemas(checklistVazio()).map(p => p.etapa));
    expect([...etapas].sort()).toEqual([1, 2, 4]);
  });

  it('dados do contrato: as mesmas frases da API', () => {
    const c = checklistValido();
    c.customer!.document = '11222333000180';
    c.customer!.signatoryCpf = '12345678900';
    c.customer!.invoiceEmail = 'financeiro@';
    c.customer!.mobile = '3234567';
    const msgs = problemas(c).map(p => p.mensagem);
    expect(msgs).toEqual([
      'Etapa 3 — o CNPJ (ou CPF) do cliente é inválido.',
      'Etapa 3 — informe o celular com DDD.',
      'Etapa 3 — o CPF de quem assina é inválido.',
      'Etapa 3 — o e-mail para as notas fiscais é inválido.',
    ]);
  });

  it('entrega em outro endereço exige o endereço de entrega', () => {
    const c = checklistValido();
    c.deliverySameAsMain = false;
    expect(problemas(c).map(p => p.mensagem)).toEqual(['Etapa 2 — endereço de entrega: preencha o endereço.']);
  });

  it('máquina "Outra" pede o nome; mesa é só Sim ou Não', () => {
    const c = checklistValido();
    c.installation!.machines = [{ type: 'OUTRA', otherType: ' ', quantity: 1, withTable: null }];
    expect(problemas(c).map(p => p.mensagem)).toEqual([
      'Etapa 4 — máquina 1: escreva qual é a máquina.',
      'Etapa 4 — máquina 1: responda se vai com mesa.',
    ]);
  });

  it('quem assina: nome e sobrenome — a mesma regra e a mesma frase da API', () => {
    expect(nomeCompleto('Maria Souza')).toBeTrue();
    expect(nomeCompleto("  João   D'Ávila ")).toBeTrue();
    expect(nomeCompleto('Maria')).toBeFalse();
    expect(nomeCompleto('Maria S.')).toBeFalse();
    const c = checklistValido();
    c.customer!.signatory = 'Maria';
    expect(problemas(c).map(p => p.mensagem)).toEqual(['Etapa 3 — escreva o nome e o sobrenome de quem assina.']);
  });

  it('pedido desligado não é conferido; ligado e vazio, é', () => {
    const c = checklistValido();
    c.order = { enabled: false, kind: null, items: [], total: null };
    expect(problemas(c)).toEqual([]);
    c.order.enabled = true;
    c.order.kind = 'VENDA';
    expect(problemas(c)[0].mensagem).toContain('pelo menos um produto');
  });

  it('a conta do pedido é a da planilha e a da API: 680,21 + 529,65 = 1.209,86', () => {
    const itens = checklistValido().order!.items;
    expect(itens.map(totalDaLinha)).toEqual([680.21, 529.65]);
    expect(totalDoPedido(itens)).toBe(1209.86);
  });

  it('busca sem acento, caixa ou espaço sobrando', () => {
    expect(normalizar('  Padaria   SÃO João ')).toBe('padaria sao joao');
  });
});
