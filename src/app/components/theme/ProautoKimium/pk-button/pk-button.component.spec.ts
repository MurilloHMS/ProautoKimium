import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PkButtonComponent } from './pk-button.component';

describe('PkButtonComponent', () => {
  let component: PkButtonComponent;
  let fixture: ComponentFixture<PkButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [PkButtonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PkButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
