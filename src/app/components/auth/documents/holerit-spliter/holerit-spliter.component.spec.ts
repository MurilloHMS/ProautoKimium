import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HoleritSpliterComponent } from './holerit-spliter.component';

describe('HoleritSpliterComponent', () => {
  let component: HoleritSpliterComponent;
  let fixture: ComponentFixture<HoleritSpliterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoleritSpliterComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HoleritSpliterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
