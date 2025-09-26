import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuccessCaseComponent } from './success-case.component';

describe('SuccessCaseComponent', () => {
  let component: SuccessCaseComponent;
  let fixture: ComponentFixture<SuccessCaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuccessCaseComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SuccessCaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
