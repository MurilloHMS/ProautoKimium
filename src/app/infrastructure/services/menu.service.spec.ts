import { dobrarAcento } from './menu.service';

describe('dobrarAcento', () => {

  it('tira o acento e baixa a caixa', () => {
    expect(dobrarAcento('Férias')).toBe('ferias');
    expect(dobrarAcento('Comunicação')).toBe('comunicacao');
    expect(dobrarAcento('Permissões')).toBe('permissoes');
  });

  it('faz o texto com e sem acento virar a mesma coisa', () => {
    // É o ponto do recurso: quem digita "ferias" no teclado do celular precisa
    // achar a tela chamada "Férias".
    expect(dobrarAcento('ferias')).toBe(dobrarAcento('Férias'));
    expect(dobrarAcento('MANUTENCAO')).toBe(dobrarAcento('Manutenção'));
  });

  it('não perde letra nenhuma', () => {
    // A faixa removida é só a dos sinais soltos depois do NFD. Se ela fosse
    // larga demais, o "c" do cedilha e o "a" do til iriam junto.
    expect(dobrarAcento('ç')).toBe('c');
    expect(dobrarAcento('ã')).toBe('a');
    expect(dobrarAcento('Programação de máquinas'))
      .toBe('programacao de maquinas');
  });

  it('deixa em paz o que não tem acento', () => {
    expect(dobrarAcento('Estoque')).toBe('estoque');
    expect(dobrarAcento('rh/hub')).toBe('rh/hub');
    expect(dobrarAcento('')).toBe('');
  });

  it('sobrevive ao separador do breadcrumb', () => {
    // O breadcrumb usa "›" (U+203A), que não é letra nem sinal combinante.
    expect(dobrarAcento('RH › Aprovações › Férias'))
      .toBe('rh › aprovacoes › ferias');
  });
});
