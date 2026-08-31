import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PkQrcodeComponent } from './pk-qrcode.component';

describe('PkQrcodeComponent', () => {
  let component: PkQrcodeComponent;
  let fixture: ComponentFixture<PkQrcodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [PkQrcodeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PkQrcodeComponent);
    component = fixture.componentInstance;

    // Com `url` vazia a biblioteca do QR Code loga um erro no console a cada
    // execução. Não quebra o teste, mas polui a saída — e saída poluída é onde
    // um erro de verdade passa despercebido.
    component.url = 'https://proautokimium.com.br';

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
