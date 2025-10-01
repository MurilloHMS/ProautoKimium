import { AuthService } from './../../../infrastructure/services/auth.service';
import { Component } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Button } from "primeng/button";
import { Toast } from 'primeng/toast';

@Component({
    selector: 'app-admin-center',
    imports: [Button, Toast],
    templateUrl: './admin-center.component.html',
    styleUrl: './admin-center.component.scss',
    providers: [MessageService]
})
export class AdminCenterComponent {
  loading: boolean = false;

  constructor(private authService: AuthService,
              private messageService: MessageService
  ) {}

  generateAccessTokens() {
    this.loading = true;
    this.authService.getStockControlToken().subscribe(token => {
      navigator.clipboard.writeText(token);
      this.messageService.add({severity:'success', summary: 'Success', detail: 'Token copiado para o clipboard!'});
      this.loading = false;
    })
  }
}
