import { Component, inject } from '@angular/core';
import { ChecklistCustomer } from '../../../../../domain/models/sales/checklist.model';
import { mascararTelefone } from '../../../../../domain/utils/telefone-br';
import { apenasDigitos, formatarDocumento } from '../../../../../infrastructure/validators/documento-br';
import { ChecklistSessao } from '../checklist-sessao';

type Campo = keyof Pick<ChecklistCustomer, 'document' | 'stateRegistration' | 'mainPhone' | 'mobile' | 'signatory'
  | 'signatoryCpf' | 'invoiceEmail' | 'contractEmail'>;

interface Definicao {
  campo: Campo;
  erro: string;
  rotulo: string;
  ajuda?: string;
  exemplo: string;
  teclado: 'text' | 'numeric' | 'tel' | 'email';
  mascara?: 'documento' | 'telefone';
  auto: string;
  /** Aceita vários separados por ";": vai como texto, porque `type=email` atrapalha o ";" em alguns navegadores. */
  varios?: boolean;
}

/**
 * Etapa 3 — dados cadastrais / contrato. Tudo obrigatório (decisão dele).
 * CPF e CNPJ conferidos pelo dígito na hora; pontos e traços aparecem sozinhos.
 */
@Component({
  selector: 'ck-etapa-contrato',
  standalone: true,
  templateUrl: './etapa-contrato.component.html',
  styleUrl: './etapa.scss',
})
export class EtapaContratoComponent {

  protected readonly s = inject(ChecklistSessao);

  protected readonly campos: Definicao[] = [
    { campo: 'document', erro: 'documento', rotulo: 'CNPJ do cliente', exemplo: '00.000.000/0000-00', teclado: 'numeric', mascara: 'documento', auto: 'off' },
    { campo: 'stateRegistration', erro: 'ie', rotulo: 'Inscrição estadual', ajuda: 'Se o cliente não tem, toque em ISENTO.', exemplo: 'Ex.: 123.456.789.110', teclado: 'text', auto: 'off' },
    { campo: 'mainPhone', erro: 'telefone', rotulo: 'Telefone principal (com DDD)', exemplo: '(19) 3234-5678', teclado: 'tel', mascara: 'telefone', auto: 'off' },
    { campo: 'signatory', erro: 'assinante', rotulo: 'Quem assina o contrato', exemplo: 'Nome completo', teclado: 'text', auto: 'off' },
    { campo: 'signatoryCpf', erro: 'cpf', rotulo: 'CPF de quem assina', exemplo: '000.000.000-00', teclado: 'numeric', mascara: 'documento', auto: 'off' },
    // Pode ter mais de um, separado por ";" — é assim que o Sankhya guarda.
    { campo: 'invoiceEmail', erro: 'emailNf', rotulo: 'E-mail para as notas fiscais', ajuda: 'Pode ter mais de um e-mail: separe por ponto e vírgula (;).',
      exemplo: 'financeiro@empresa.com.br; compras@empresa.com.br', teclado: 'email', auto: 'off', varios: true },
    { campo: 'contractEmail', erro: 'emailContrato', rotulo: 'E-mail para o contrato', exemplo: 'contrato@empresa.com.br', teclado: 'email', auto: 'off' },
    { campo: 'mobile', erro: 'celular', rotulo: 'Celular (com DDD)', exemplo: '(19) 98765-4321', teclado: 'tel', mascara: 'telefone', auto: 'off' },
  ];

  protected valor(d: Definicao): string {
    const bruto = this.s.conteudo().customer?.[d.campo] ?? '';
    if (d.mascara === 'documento') return formatarDocumento(String(bruto));
    if (d.mascara === 'telefone') return mascararTelefone(String(bruto));
    return String(bruto);
  }

  protected mudar(d: Definicao, texto: string): void {
    const valor = d.mascara ? apenasDigitos(texto).slice(0, d.mascara === 'documento' ? 14 : 11)
      : d.teclado === 'email' ? texto.trim() : texto;
    this.s.atualizar(c => {
      if (c.customer) c.customer[d.campo] = valor || null;
    });
  }

  protected isento(): void {
    this.s.atualizar(c => { if (c.customer) c.customer.stateRegistration = 'ISENTO'; });
  }

  protected diverge(d: Definicao): string | null {
    return this.s.divergencia(d.campo, this.s.conteudo().customer?.[d.campo] as string | null);
  }
}
