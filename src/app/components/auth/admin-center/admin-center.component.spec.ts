import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCenterComponent } from './admin-center.component';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('AdminCenterComponent', () => {
  let component: AdminCenterComponent;
  let fixture: ComponentFixture<AdminCenterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCenterComponent],
      providers: providersDeTeste()
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdminCenterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
