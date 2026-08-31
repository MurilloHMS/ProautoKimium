import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PkBtnSharedComponent } from './pk-btn-shared.component';

describe('PkBtnSharedComponent', () => {
  let component: PkBtnSharedComponent;
  let fixture: ComponentFixture<PkBtnSharedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [PkBtnSharedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PkBtnSharedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
