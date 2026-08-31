import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { MotivosContratarComponent } from './motivos-contratar.component';

describe('MotivosContratarComponent', () => {
  let component: MotivosContratarComponent;
  let fixture: ComponentFixture<MotivosContratarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [MotivosContratarComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MotivosContratarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
