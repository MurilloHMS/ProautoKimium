import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopMenuComponent } from "../../components/auth/shared/top-menu/top-menu.component";
import { NotificationService } from '../../infrastructure/services/notification.service';

@Component({
    selector: 'app-auth-layout',
    imports: [RouterOutlet, TopMenuComponent],
    templateUrl: './auth-layout.component.html',
    styleUrl: './auth-layout.component.scss'
})
export class AuthLayoutComponent implements OnInit, OnDestroy {

  constructor(private notifications: NotificationService) {}

  ngOnInit(): void {
    this.notifications.start();
  }

  ngOnDestroy(): void {
    this.notifications.stop();
  }
}
