import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VcardComponent } from './vcard.component';

describe('VcardComponent', () => {
  let component: VcardComponent;
  let fixture: ComponentFixture<VcardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VcardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VcardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
