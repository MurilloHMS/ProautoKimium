import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PkTableComponent } from './pk-table.component';

describe('PkTableComponent', () => {
  let component: PkTableComponent<unknown>;
  let fixture: ComponentFixture<PkTableComponent<unknown>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [PkTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PkTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
