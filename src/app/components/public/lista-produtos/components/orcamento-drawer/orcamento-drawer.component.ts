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

  readonly WHATSAPP_NUMBER = '5511983583564';

  fb = inject(FormBuilder);
  form = this.fb.group({
    nome:      ['', [Validators.required, Validators.minLength(2)]],
    email:     ['', [Validators.required, Validators.email]],
    telefone:  ['', Validators.required],
    mensagem:  [''],
  });

  // ── Drawer ──────────────────────────────────────────────────────────────────

  toggleDrawer(): void {
    this.orcamento.drawerAberto.update(v => !v);
  }

  // ── Modal ───────────────────────────────────────────────────────────────────

  // orcamento-drawer.component.ts
  // REMOVA: modalAberto = signal(false);

  abrirModal(): void {
    this.orcamento.abrirModal(); // usa o service
  }

  fecharModal(): void {
    this.orcamento.fecharModal();
    this.form.reset();
    this.enviado.set(false);
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c?.invalid && c.touched);
  }

  // ── Envios ──────────────────────────────────────────────────────────────────

  enviarWhatsApp(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nome, telefone, email } = this.form.value;
    const texto = this.orcamento.gerarTextoWhatsApp(nome!, telefone!, email!);
    window.open(`https://wa.me/${this.WHATSAPP_NUMBER}?text=${texto}`, '_blank');
    this.finalizarEnvio();
  }

  enviarFormulario(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nome, email, telefone, mensagem } = this.form.value;

    const linhasProdutos = this.orcamento.lista()
      .map(i => `- ${i.produto.name} (${i.produto.systemCode}) — Qtd: ${i.quantidade}`)
      .join('%0A');

    const assunto = encodeURIComponent('Solicitação de Orçamento');
    const corpo = encodeURIComponent(
      `Nome: ${nome}\nTelefone: ${telefone}\nE-mail: ${email}\nMensagem: ${mensagem ?? ''}\n\nProdutos:\n`
    ) + linhasProdutos;

    window.open(`mailto:seuemail@empresa.com.br?subject=${assunto}&body=${corpo}`, '_blank');
    this.finalizarEnvio();
  }

  private finalizarEnvio(): void {
    this.enviado.set(true);
    setTimeout(() => {
      this.orcamento.limpar();
      this.fecharModal();
    }, 2500);
  }
}
