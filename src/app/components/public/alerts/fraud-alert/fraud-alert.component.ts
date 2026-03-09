import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-fraud-alert',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './fraud-alert.component.html',
  styleUrl: './fraud-alert.component.scss'
})
export class FraudAlertComponent implements OnInit {
  visible = false;

  private readonly STORAGE_KEY = 'proauto_fraud_alert_dismissed';

  ngOnInit(): void {
    const dismissed = sessionStorage.getItem(this.STORAGE_KEY);
    if (!dismissed) {
      setTimeout(() => (this.visible = true), 400);
    }
  }

  close(): void {
    this.visible = false;
    sessionStorage.setItem(this.STORAGE_KEY, 'true');
  }
}
