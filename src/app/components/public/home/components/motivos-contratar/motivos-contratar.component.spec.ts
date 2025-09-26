import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MotivosContratarComponent } from './motivos-contratar.component';

describe('MotivosContratarComponent', () => {
  let component: MotivosContratarComponent;
  let fixture: ComponentFixture<MotivosContratarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotivosContratarComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MotivosContratarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
