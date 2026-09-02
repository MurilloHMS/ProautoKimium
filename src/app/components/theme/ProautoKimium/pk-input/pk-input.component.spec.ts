import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PkInputComponent } from './pk-input.component';

describe('PkInputComponent', () => {
  let component: PkInputComponent;
  let fixture: ComponentFixture<PkInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [PkInputComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PkInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('máscara decimal', () => {

    /** `pkDecimals` é signal input: só dá para setá-lo pela fixture. */
    function comMascara(casas: number): void {
      fixture.componentRef.setInput('pkDecimals', casas);
      fixture.detectChanges();
    }

    it('escreve um número com as casas que ele tem, e não com os dígitos que aparenta', () => {
      // O erro que isto tranca: a máscara olha só os dígitos, então o número
      // 10 sairia '0,10' e 3,5 sairia '0,35' — uma e duas ordens de grandeza
      // de diferença, num campo de preço.
      comMascara(2);

      component.writeValue(10);
      expect(component.innerValue).toBe('10,00');

      component.writeValue(3.5);
      expect(component.innerValue).toBe('3,50');

      component.writeValue(0.5);
      expect(component.innerValue).toBe('0,50');
    });

    it('acerta também o preço de duas casas, que acertava por coincidência', () => {
      // Sozinho, este teste passa com e sem o defeito. Está aqui porque é o
      // valor que alguém escolheria para conferir a mão — e é justamente o que
      // escondia o problema.
      comMascara(2);
      component.writeValue(3.79);
      expect(component.innerValue).toBe('3,79');
    });

    it('mascara o texto que já vem escrito, sem mexer nele', () => {
      // O caminho normal: o valor volta do próprio campo, já formatado.
      comMascara(2);
      component.writeValue('3,79');
      expect(component.innerValue).toBe('3,79');
    });

    it('respeita as casas pedidas quando o número tem outras tantas', () => {
      comMascara(1);
      component.writeValue(8.5);
      expect(component.innerValue).toBe('8,5');

      component.writeValue(12);
      expect(component.innerValue).toBe('12,0');
    });

    it('deixa o campo vazio para nulo, e não zerado', () => {
      comMascara(2);
      component.writeValue(null);
      expect(component.innerValue).toBe('');
    });

    it('não mexe em campo sem máscara', () => {
      // `pkDecimals` nulo é o padrão: nenhum dos campos que já existem muda.
      component.writeValue('texto livre');
      expect(component.innerValue).toBe('texto livre');
    });
  });
});
