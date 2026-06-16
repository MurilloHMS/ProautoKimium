import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PkCheckboxComponent } from './pk-checkbox.component';

describe('PkCheckboxComponent', () => {
  let component: PkCheckboxComponent;
  let fixture: ComponentFixture<PkCheckboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PkCheckboxComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PkCheckboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
