import { Injectable, signal, computed, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ProductWebSitePublicResponseDTO } from '../../../../../../domain/models/products.model';
import { documentoBr, formatarDocumento } from '../../../../../validators/documento-br';

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

    // CPF ou CNPJ, num campo só: a contagem de dígitos decide qual dos dois é,
    // e ninguém precisa escolher antes de digitar.
    //
    // O `documentoBr` confere dígito verificador, e não só o tamanho. O que sai
    // daqui abre o WhatsApp do comercial e vira cadastro de cliente do outro
    // lado — `111.111.111-11` tem onze dígitos e não é documento de ninguém.
    documento: ['', [Validators.required, documentoBr]],

    segmento:  ['', Validators.required],
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
    const { nome, telefone, email, segmento, documento } = this.form.value;
    const texto = this.gerarTextoWhatsApp(nome!, telefone!, email!, segmento!, documento!);
    window.open(`https://wa.me/${this.WHATSAPP_NUMBER}?text=${texto}`, '_blank');
    this.finalizarEnvio();
  }

  enviarFormulario(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nome, email, telefone, mensagem, segmento, documento } = this.form.value;

    const linhasProdutos = this._itens()
      .map(i => `- ${i.produto.name} (${i.produto.systemCode}) — Qtd: ${i.quantidade}`)
      .join('%0A');

    const assunto = encodeURIComponent('Solicitação de Orçamento');
    const corpo = encodeURIComponent(
      `Nome: ${nome}\nTelefone: ${telefone}\nE-mail: ${email}\n` +
      `CPF/CNPJ: ${formatarDocumento(documento ?? '')}\n` +
      `Segmento: ${segmento}\nMensagem: ${mensagem ?? ''}\n\nProdutos:\n`
    ) + linhasProdutos;

    window.open(`mailto:seuemail@empresa.com.br?subject=${assunto}&body=${corpo}`, '_blank');
    this.finalizarEnvio();
  }

  abrirWhatsapp() : void{
    let mensagem = 'Olá, vim pelo site e gostaria de falar com um consultor';
    window.open(`https://wa.me/${this.WHATSAPP_NUMBER}?text=${mensagem}`, '_blank');
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

  gerarTextoWhatsApp(nome: string, telefone: string, email : string, segmento : string, documento : string): string {
    const linhas = this._itens().map(i =>
      `• ${i.produto.name} (${i.produto.systemCode}) — Qtd: ${i.quantidade}`
    );
    return encodeURIComponent(
      `Olá! Vim do site e gostaria de solicitar um orçamento.\n\n` +
      `*Nome:* ${nome}\n` +
      `*Telefone:* ${telefone}\n` +
      `*Email:* ${email}\n` +
      // Formatado, e não os dígitos crus guardados no formulário: quem lê é uma
      // pessoa no WhatsApp, e catorze números seguidos não se conferem de olho.
      `*CPF/CNPJ:* ${formatarDocumento(documento)}\n` +
      `*Segmento:* ${segmento}\n\n` +
      `*Produtos:*\n${linhas.join('\n')}`
    );
  }
}
