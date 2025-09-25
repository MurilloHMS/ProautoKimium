import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoHeaderLayoutComponent } from './no-header-layout.component';

describe('NoHeaderLayoutComponent', () => {
  let component: NoHeaderLayoutComponent;
  let fixture: ComponentFixture<NoHeaderLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoHeaderLayoutComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NoHeaderLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
