import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PkTableComponent } from './pk-table.component';

describe('PkTableComponent', () => {
  let component: PkTableComponent;
  let fixture: ComponentFixture<PkTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
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
