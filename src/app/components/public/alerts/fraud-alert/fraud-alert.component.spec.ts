import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { FraudAlertComponent } from './fraud-alert.component';

describe('FraudAlertComponent', () => {
  let component: FraudAlertComponent;
  let fixture: ComponentFixture<FraudAlertComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [FraudAlertComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FraudAlertComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
