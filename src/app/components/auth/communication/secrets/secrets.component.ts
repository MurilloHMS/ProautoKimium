import { Component } from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NgIf} from "@angular/common";
import {HttpClient} from "@angular/common/http";
import {SecretsService} from "../../../../infrastructure/services/communication/secrets/secrets.service";
import {CreateSecretRequest} from "../../../../domain/models/secrets.model";

@Component({
  selector: 'app-secrets',
  imports: [FormsModule, NgIf],
  templateUrl: './secrets.component.html',
  styleUrl: './secrets.component.scss',
})
export class SecretsComponent {
  content = '';
  secretUrl = '';
  loading = false;

  constructor(private svc: SecretsService) { }

  create() {
    this.loading = true;
    const secret : CreateSecretRequest = { content: this.content };
    this.svc.createSecret(secret).subscribe({
      next: r => {this.secretUrl = r.url; this.loading = false;},
      error: () => { this.loading = false; }
    })
  }

  copy(){
    navigator.clipboard.writeText(this.secretUrl);
  }
}
