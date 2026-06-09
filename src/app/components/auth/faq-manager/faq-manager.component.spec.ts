import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaqManagerComponent } from './faq-manager.component';

describe('FaqManagerComponent', () => {
  let component: FaqManagerComponent;
  let fixture: ComponentFixture<FaqManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqManagerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FaqManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
