import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HoleritSpliterComponent } from './holerit-spliter.component';

import { MessageService } from 'primeng/api';
import { providersDeTeste } from '../../../../../testing/test-setup';

describe('HoleritSpliterComponent', () => {
  let component: HoleritSpliterComponent;
  let fixture: ComponentFixture<HoleritSpliterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoleritSpliterComponent],
      providers: providersDeTeste([
        // Ele injeta MessageService e NÃO o declara: quem provê é o
        // holerite-hub, que o hospeda. Montado sozinho, precisa do seu.
        MessageService,
      ])
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HoleritSpliterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
