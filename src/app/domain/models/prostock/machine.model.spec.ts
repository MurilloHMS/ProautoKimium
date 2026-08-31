import {
  IN_STOCK_STATUSES,
  MACHINE_STATUS_ICON,
  MACHINE_STATUS_LABEL,
  MACHINE_STATUS_SEVERITY,
  MachineStatus,
  OPEN_STATUSES,
} from './machine.model';

/**
 * O vocabulário de status das máquinas.
 *
 * Não há componente aqui, e é de propósito: são tabelas de constantes, e o que
 * elas erram não aparece em teste de tela. Um status sem cor própria desenha
 * perfeitamente — só desenha **igual ao vizinho**, e ninguém percebe até alguém
 * ler a grade errado por meses.
 */
describe('machine.model — vocabulário de status', () => {
  const TODOS = Object.values(MachineStatus);

  /**
   * **O teste que existe por causa do defeito real.**
   *
   * Havia seis status e quatro papéis de cor, então três pares saíam idênticos:
   * Entregue igual a Reservada, Reforma igual a Liberar equipamentos. Na tela,
   * uma máquina que já foi embora era indistinguível de uma que está prometida.
   *
   * O compilador nunca reclamaria: repetir valor num `Record` é legal. Só uma
   * afirmação sobre o CONJUNTO pega isso — e é o tipo de defeito que volta na
   * primeira vez que alguém acrescentar um status sem pensar na cor.
   */
  it('cada status tem um papel de cor só dele', () => {
    const papeis = TODOS.map(status => MACHINE_STATUS_SEVERITY[status]);

    expect(new Set(papeis).size).toBe(TODOS.length);
  });

  /**
   * O par do de cima, e ele importa tanto quanto.
   *
   * Sem ícone, os seis chips viram três tons em escala de cinza — é o que
   * acontece com daltonismo vermelho-verde e em impressão preto e branco. Um
   * ícone repetido devolve a ambiguidade que a cor acabou de resolver.
   */
  it('cada status tem um ícone só dele', () => {
    const icones = TODOS.map(status => MACHINE_STATUS_ICON[status]);

    expect(new Set(icones).size).toBe(TODOS.length);
    expect(icones.every(icone => icone.startsWith('pi pi-'))).toBeTrue();
  });

  /**
   * As três tabelas andam juntas. Acrescentar um status e esquecer uma delas
   * dá `undefined` em runtime — chip sem texto, ou classe `status-chip--`
   * pendurada em nada, que é exatamente o vazio que o tema reserva.
   */
  it('rótulo, cor e ícone cobrem todos os status', () => {
    for (const status of TODOS) {
      expect(MACHINE_STATUS_LABEL[status]).toBeTruthy();
      expect(MACHINE_STATUS_SEVERITY[status]).toBeTruthy();
      expect(MACHINE_STATUS_ICON[status]).toBeTruthy();
    }
  });

  /**
   * O papel tem que existir no `chips.scss`. A lista está escrita à mão aqui de
   * propósito: é o contrato com o CSS, e o CSS não é tipado.
   *
   * Sem isto, `status-chip--roxo` compila, renderiza, e cai no vazio — o chip
   * fica sem fundo e sem cor, e a tela não acusa nada.
   */
  it('todo papel usado existe como classe no tema', () => {
    const noTema = ['success', 'info', 'warning', 'work', 'danger', 'neutral'];

    for (const status of TODOS) {
      expect(noTema).toContain(MACHINE_STATUS_SEVERITY[status]);
    }
  });

  // ─── As listas de status, que decidem estoque ─────────────────────────────

  /**
   * `IN_STOCK_STATUSES` não é "≠ ENTREGUE".
   *
   * Aguardando aquisição e Liberar equipamentos estão abertas e **não** estão
   * no galpão. Confundir as duas listas ofereceria para entregar uma máquina
   * que ainda não chegou.
   */
  it('estar em aberto não é estar em estoque', () => {
    expect(OPEN_STATUSES).toContain(MachineStatus.AGUARDANDO_AQUISICAO);
    expect(IN_STOCK_STATUSES).not.toContain(MachineStatus.AGUARDANDO_AQUISICAO);

    expect(OPEN_STATUSES).toContain(MachineStatus.LIBERAR_EQUIPAMENTOS);
    expect(IN_STOCK_STATUSES).not.toContain(MachineStatus.LIBERAR_EQUIPAMENTOS);
  });

  /** Em reforma a máquina está fisicamente lá, mesmo sem poder ser vendida. */
  it('reforma conta como estoque', () => {
    expect(IN_STOCK_STATUSES).toContain(MachineStatus.REFORMA);
  });
});
