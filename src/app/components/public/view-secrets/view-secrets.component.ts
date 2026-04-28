import { Component } from '@angular/core';
import {SecretsService} from "../../../infrastructure/services/communication/secrets/secrets.service";
import {ActivatedRoute} from "@angular/router";
import {NgIf} from "@angular/common";

@Component({
  selector: 'app-view-secrets',
  imports: [
    NgIf
  ],
  templateUrl: './view-secrets.component.html',
  styleUrl: './view-secrets.component.scss',
})
export class ViewSecretsComponent {
  content = '';
  loading = true;
  errorMsg = '';

  constructor(private route: ActivatedRoute, private svc: SecretsService) { }

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token')!;
    this.svc.getSecret(token).subscribe({
      next: r => { this.content = r.content; this.loading = false; },
      error: err => {
        this.loading = false;
        this.errorMsg = err.status === 410 ? 'Este segredo já foi utilizado ou expirou.' : 'Segredo não encontrado.'
      }
    });
  }

  copy(){
    navigator.clipboard.writeText(this.content);
  }
}
