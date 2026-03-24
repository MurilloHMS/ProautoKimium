import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExcelCredentialsComponent } from './excel-credentials.component';

describe('ExcelCredentialsComponent', () => {
  let component: ExcelCredentialsComponent;
  let fixture: ComponentFixture<ExcelCredentialsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExcelCredentialsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExcelCredentialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
