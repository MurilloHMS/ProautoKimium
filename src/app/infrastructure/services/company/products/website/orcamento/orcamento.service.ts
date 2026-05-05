import { Injectable, signal, computed, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ProductWebSitePublicResponseDTO } from '../../../../../../domain/models/products.model';

export interface ItemOrcamento {
  produto: ProductWebSitePublicResponseDTO;
  quantidade: number;
}

@Injectable({ providedIn: 'root' })
export class OrcamentoService {

  private fb = inject(FormBuilder);

  private _itens = signal<ItemOrcamento[]>([]);

  // ── Signals de estado ─────────────────────────────────────────────────────

  drawerAberto = signal(false);
  modalAberto  = signal(false);
  enviado      = signal(false);

  lista     = this._itens.asReadonly();
  total     = computed(() => this._itens().reduce((s, i) => s + i.quantidade, 0));
  estaVazio = computed(() => this._itens().length === 0);

  // ── Formulário ────────────────────────────────────────────────────────────

  form = this.fb.group({
    nome:      ['', [Validators.required, Validators.minLength(2)]],
    email:     ['', [Validators.required, Validators.email]],
    telefone:  ['', Validators.required],
    mensagem:  [''],
  });

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c?.invalid && c.touched);
  }

  // ── Drawer ────────────────────────────────────────────────────────────────

  abrirDrawer(): void {
    this.drawerAberto.set(true);
  }

  fecharDrawer(): void {
    this.drawerAberto.set(false);
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  abrirModal(): void {
    this.fecharDrawer();
    this.modalAberto.set(true);
  }

  fecharModal(): void {
    this.modalAberto.set(false);
    this.form.reset();
    this.enviado.set(false);
  }

  // ── Envios ────────────────────────────────────────────────────────────────

  readonly WHATSAPP_NUMBER = '5511983583564';

  enviarWhatsApp(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nome, telefone, email } = this.form.value;
    const texto = this.gerarTextoWhatsApp(nome!, telefone!, email!);
    window.open(`https://wa.me/${this.WHATSAPP_NUMBER}?text=${texto}`, '_blank');
    this.finalizarEnvio();
  }

  enviarFormulario(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nome, email, telefone, mensagem } = this.form.value;

    const linhasProdutos = this._itens()
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
      this.limpar();
      this.fecharModal();
    }, 2500);
  }

  // ── Itens ─────────────────────────────────────────────────────────────────

  adicionar(produto: ProductWebSitePublicResponseDTO): void {
    this._itens.update(lista => {
      const idx = lista.findIndex(i => i.produto.systemCode === produto.systemCode);
      if (idx >= 0) {
        return lista.map((i, n) =>
          n === idx ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [...lista, { produto, quantidade: 1 }];
    });
  }

  remover(systemCode: string): void {
    this._itens.update(l => l.filter(i => i.produto.systemCode !== systemCode));
  }

  ajustarQuantidade(systemCode: string, delta: number): void {
    this._itens.update(lista =>
      lista
        .map(i => i.produto.systemCode === systemCode
          ? { ...i, quantidade: i.quantidade + delta }
          : i
        )
        .filter(i => i.quantidade > 0)
    );
  }

  limpar(): void {
    this._itens.set([]);
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────

  gerarTextoWhatsApp(nome: string, telefone: string, email : string): string {
    const linhas = this._itens().map(i =>
      `• ${i.produto.name} (${i.produto.systemCode}) — Qtd: ${i.quantidade}`
    );
    return encodeURIComponent(
      `Olá! Gostaria de solicitar um orçamento.\n\n` +
      `*Nome:* ${nome}\n` +
      `*Telefone:* ${telefone}\n` +
      `*Email:* ${email}\n\n` +
      `*Produtos:*\n${linhas.join('\n')}`
    );
  }
}
