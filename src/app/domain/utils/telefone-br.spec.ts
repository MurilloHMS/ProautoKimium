import { mascararTelefone, apenasDigitosDoTelefone, telefoneCompleto } from './telefone-br';

describe('mascararTelefone', () => {

  it('monta a mascara tecla a tecla', () => {
    expect(mascararTelefone('1')).toBe('(1');
    expect(mascararTelefone('11')).toBe('(11');
    expect(mascararTelefone('119')).toBe('(11) 9');
    expect(mascararTelefone('119577')).toBe('(11) 9577');
    expect(mascararTelefone('11957782')).toBe('(11) 9577-82');
    expect(mascararTelefone('11957782766')).toBe('(11) 95778-2766');
  });

  it('poe quatro digitos antes do traco no fixo, e cinco no celular', () => {
    // O corte muda com o total. Cravar um dos dois deixaria o outro torto:
    // um fixo viraria (11) 34567-890.
    expect(mascararTelefone('1134567890')).toBe('(11) 3456-7890');
    expect(mascararTelefone('11934567890')).toBe('(11) 93456-7890');
  });

  it('e idempotente: o proprio resultado volta igual', () => {
    // A mascara roda a cada tecla sobre o que ela mesma escreveu. Sem isto,
    // os parenteses e o traco se acumulariam a cada digito.
    expect(mascararTelefone('(11) 95778-2766')).toBe('(11) 95778-2766');
    expect(mascararTelefone('(11) 3456-7890')).toBe('(11) 3456-7890');
  });

  it('descarta o que passa de onze digitos', () => {
    expect(mascararTelefone('119577827669999')).toBe('(11) 95778-2766');
  });

  it('descarta letra em vez de escrever no campo', () => {
    expect(mascararTelefone('11a9b5778c2766')).toBe('(11) 95778-2766');
  });

  it('devolve vazio para campo vazio, e nao um parentese solto', () => {
    // '(' num campo recem-limpo pareceria que sobrou alguma coisa.
    expect(mascararTelefone('')).toBe('');
    expect(mascararTelefone('abc')).toBe('');
  });

  it('encolhe quando se apaga', () => {
    // O que o backspace entrega: o texto sem o ultimo caractere.
    expect(mascararTelefone('(11) 9')).toBe('(11) 9');
    expect(mascararTelefone('(11) 3456-789')).toBe('(11) 3456-789');
  });

  it('volta ao formato de fixo ao apagar o ultimo digito do celular', () => {
    // Apagar o 11o digito deixa 10, e 10 digitos SAO um fixo: o traco anda uma
    // casa. Parece estranho no meio da digitacao e e o comportamento certo -
    // o formato vem do tamanho, e nao de um palpite sobre o que a pessoa quis.
    expect(mascararTelefone('(11) 95778-2766')).toBe('(11) 95778-2766');
    expect(mascararTelefone('(11) 95778-276')).toBe('(11) 9577-8276');
  });
});

describe('apenasDigitosDoTelefone', () => {

  it('devolve so os numeros', () => {
    expect(apenasDigitosDoTelefone('(11) 95778-2766')).toBe('11957782766');
  });
});

describe('telefoneCompleto', () => {

  it('aceita fixo com dez e celular com onze', () => {
    expect(telefoneCompleto('(11) 3456-7890')).toBeTrue();
    expect(telefoneCompleto('(11) 95778-2766')).toBeTrue();
  });

  it('recusa o que esta pela metade', () => {
    expect(telefoneCompleto('(11) 9577')).toBeFalse();
    expect(telefoneCompleto('')).toBeFalse();
  });
});
