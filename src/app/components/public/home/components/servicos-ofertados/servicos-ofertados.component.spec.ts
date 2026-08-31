import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { ServicosOfertadosComponent } from './servicos-ofertados.component';

describe('ServicosOfertadosComponent', () => {
  let component: ServicosOfertadosComponent;
  let fixture: ComponentFixture<ServicosOfertadosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [ServicosOfertadosComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ServicosOfertadosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
