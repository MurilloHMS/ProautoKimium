import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { OrcamentoService } from '../../../../../infrastructure/services/company/products/website/orcamento/orcamento.service';

@Component({
  selector: 'app-orcamento-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './orcamento-drawer.component.html',
  styleUrl: './orcamento-drawer.component.scss',
})
export class OrcamentoDrawerComponent {

  orcamento = inject(OrcamentoService);

  drawerAberto = this.orcamento.drawerAberto;
  modalAberto = signal(false);
  enviado = signal(false);

  fb = inject(FormBuilder);
  form = this.fb.group({
    nome:      ['', [Validators.required, Validators.minLength(2)]],
    email:     ['', [Validators.required, Validators.email]],
    telefone:  ['', Validators.required],
    mensagem:  [''],
  });


  toggleDrawer(): void {
    this.orcamento.drawerAberto.update(v => !v);
  }

  abrirModal(): void {
    this.orcamento.abrirModal(); // usa o service
  }

  fecharModal(): void {
    this.orcamento.fecharModal();
    this.form.reset();
    this.enviado.set(false);
  }
}
