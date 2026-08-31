import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { ContatoEventosComponent } from './contato-eventos.component';

describe('ContatoEventosComponent', () => {
  let component: ContatoEventosComponent;
  let fixture: ComponentFixture<ContatoEventosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [ContatoEventosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContatoEventosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
