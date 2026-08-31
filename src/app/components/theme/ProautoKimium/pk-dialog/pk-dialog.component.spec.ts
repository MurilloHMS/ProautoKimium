import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PkDialogComponent } from './pk-dialog.component';

describe('PkDialogComponent', () => {
  let component: PkDialogComponent;
  let fixture: ComponentFixture<PkDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [PkDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PkDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
