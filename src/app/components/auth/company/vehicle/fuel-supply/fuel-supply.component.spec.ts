import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FuelSupplyComponent } from './fuel-supply.component';

describe('FuelSupplyComponent', () => {
  let component: FuelSupplyComponent;
  let fixture: ComponentFixture<FuelSupplyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FuelSupplyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FuelSupplyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
