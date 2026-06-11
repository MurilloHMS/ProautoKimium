import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PKTitleComponent } from './pk-title.component';

describe('PKTitleComponent', () => {
  let component: PKTitleComponent;
  let fixture: ComponentFixture<PKTitleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PKTitleComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PKTitleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
