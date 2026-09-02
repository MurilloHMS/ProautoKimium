import { mascararDecimal, lerDecimal, formatarDecimal } from './decimal-br';

describe('mascararDecimal', () => {

  it('preenche as casas da direita para a esquerda, tecla a tecla', () => {
    expect(mascararDecimal('3', 2)).toBe('0,03');
    expect(mascararDecimal('37', 2)).toBe('0,37');
    expect(mascararDecimal('379', 2)).toBe('3,79');
    expect(mascararDecimal('3799', 2)).toBe('37,99');
  });

  it('é idempotente — o próprio resultado volta igual', () => {
    // A máscara roda a cada tecla sobre o que ela mesma escreveu. Sem isto
    // ela brigaria consigo: '0,03' viraria '003' e cresceria sozinha.
    expect(mascararDecimal('3,79', 2)).toBe('3,79');
    expect(mascararDecimal('0,03', 2)).toBe('0,03');
    expect(mascararDecimal('1.234,56', 2)).toBe('1.234,56');
  });

  it('não acumula o zero que ela mesma escreveu', () => {
    // A segunda tecla, e o caso que quase escapou: com '0,03' no campo,
    // digitar 7 entrega '0,037' — quatro dígitos, sendo o primeiro um zero
    // que a própria máscara pôs ali. Deixá-lo passar mostra '00,37', e o
    // campo ganha um zero a cada tecla.
    expect(mascararDecimal('0,037', 2)).toBe('0,37');
    expect(mascararDecimal('00,375', 2)).toBe('3,75');
  });

  it('apaga da direita quando se apaga um caractere', () => {
    // O que o backspace entrega: '3,79' sem o último caractere.
    expect(mascararDecimal('3,7', 2)).toBe('0,37');
  });

  it('agrupa os milhares com ponto', () => {
    expect(mascararDecimal('123456', 2)).toBe('1.234,56');
    expect(mascararDecimal('123456789', 2)).toBe('1.234.567,89');
  });

  it('respeita o número de casas pedido', () => {
    expect(mascararDecimal('85', 1)).toBe('8,5');
    expect(mascararDecimal('500', 1)).toBe('50,0');
    expect(mascararDecimal('50', 0)).toBe('50');
  });

  it('descarta letras e sinais em vez de escrevê-los no campo', () => {
    // O campo é `text` para aceitar vírgula, então letra entra. Se a máscara
    // deixasse passar, o valor viraria NaN mais adiante sem aviso nenhum.
    expect(mascararDecimal('3a7b9', 2)).toBe('3,79');
    expect(mascararDecimal('abc', 2)).toBe('');
  });

  it('devolve vazio para campo vazio, e não zero', () => {
    // '0,00' num campo recém-limpo pareceria valor preenchido.
    expect(mascararDecimal('', 2)).toBe('');
  });
});

describe('lerDecimal', () => {

  it('lê a vírgula como decimal e o ponto como milhar', () => {
    expect(lerDecimal('3,79')).toBe(3.79);
    expect(lerDecimal('1.234,56')).toBe(1234.56);
    // Sem tratar o ponto, este daria 1,234 — três ordens de grandeza errado.
    expect(lerDecimal('1.234')).toBe(1234);
  });

  it('devolve nulo para campo vazio ou sem número', () => {
    expect(lerDecimal('')).toBeNull();
    expect(lerDecimal('   ')).toBeNull();
    expect(lerDecimal('abc')).toBeNull();
  });
});

describe('formatarDecimal', () => {

  it('escreve o número do jeito que a máscara escreveria', () => {
    expect(formatarDecimal(3.79, 2)).toBe('3,79');
    expect(formatarDecimal(4.5, 2)).toBe('4,50');
    expect(formatarDecimal(1234.56, 2)).toBe('1.234,56');
    expect(formatarDecimal(50, 1)).toBe('50,0');
  });

  it('fecha o ciclo: formatar e ler devolve o mesmo número', () => {
    // É o que sustenta o campo calculado do CMV, que é preenchido pela tela e
    // pode ser digitado por cima logo em seguida.
    for (const valor of [0.03, 3.79, 4.5, 1234.56, 0.5]) {
      expect(lerDecimal(formatarDecimal(valor, 2))).toBeCloseTo(valor, 6);
    }
  });

  it('mantém o sinal de um valor negativo', () => {
    // A margem do CMV fica negativa quando a venda está abaixo do custo.
    expect(formatarDecimal(-1, 2)).toBe('-1,00');
  });

  it('arredonda em vez de truncar', () => {
    expect(formatarDecimal(3.999, 2)).toBe('4,00');
    expect(formatarDecimal(0.005, 2)).toBe('0,01');
  });
});
