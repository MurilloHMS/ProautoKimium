import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PkBtnSharedComponent } from './pk-btn-shared.component';

describe('PkBtnSharedComponent', () => {
  let component: PkBtnSharedComponent;
  let fixture: ComponentFixture<PkBtnSharedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
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
