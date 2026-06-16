import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PkInputComponent } from './pk-input.component';

describe('PkInputComponent', () => {
  let component: PkInputComponent;
  let fixture: ComponentFixture<PkInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PkInputComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PkInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
