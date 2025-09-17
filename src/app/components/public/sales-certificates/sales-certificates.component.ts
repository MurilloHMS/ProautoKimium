import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

declare const generateCertificate: any;

@Component({
  selector: 'app-sales-certificates',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sales-certificates.component.html',
  styleUrl: './sales-certificates.component.scss'
})
export class SalesCertificatesComponent implements OnInit{
  form: FormGroup;
  type: number | null = null;
  isMobile: boolean = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router
  ){
    this.form = this.fb.group({
      nome: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      contato: ['', [Validators.required, Validators.pattern('^[0-9]{10,11}$')]]
    });
  }

  ngOnInit(): void {
    this.type = Number(this.route.snapshot.queryParamMap.get('type'));

    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if(!this.isMobile){
      this.router.navigate(['/']);
    }
  }

  gerarCertificado(){
    if(this.form.valid){
      const nomeFormatado = this.capitalize(this.form.value.nome);

      if(this.type != 0){
        generateCertificate(nomeFormatado, this.type);
      }else{
        generateCertificate(nomeFormatado,2);
      }
    }
  }

  private capitalize(str: string): string{
    return str
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
  }
}
