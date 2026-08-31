import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { InstitucionalComponent } from './institucional.component';

describe('InstitucionalComponent', () => {
  let component: InstitucionalComponent;
  let fixture: ComponentFixture<InstitucionalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [InstitucionalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InstitucionalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
