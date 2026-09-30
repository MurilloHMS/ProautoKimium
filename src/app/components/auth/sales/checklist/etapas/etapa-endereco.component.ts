import { Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ChecklistAddress } from '../../../../../domain/models/sales/checklist.model';
import { maskZip } from '../../../../../domain/utils/address';
import { enderecoVazio } from '../../../../../domain/utils/checklist/checklist-regras';
import { mascararTelefone } from '../../../../../domain/utils/telefone-br';
import { apenasDigitos } from '../../../../../infrastructure/validators/documento-br';
import { ZipCodeService } from '../../../../../infrastructure/services/address/zip-code.service';
import { ChecklistSessao } from '../checklist-sessao';
import { SimNaoComponent } from '../ui/sim-nao.component';

type Qual = 'principal' | 'entrega';

/**
 * Etapa 2 — endereço principal, de entrega e o contato da unidade.
 *
 * O CEP completa rua, bairro e cidade quando há internet (ViaCEP), e só o que
 * está vazio — não apaga o que o vendedor digitou. Sem internet, digita-se.
 */
@Component({
  selector: 'ck-etapa-endereco',
  standalone: true,
  imports: [SimNaoComponent, NgTemplateOutlet],
  templateUrl: './etapa-endereco.component.html',
  styleUrl: './etapa.scss',
})
export class EtapaEnderecoComponent {

  protected readonly s = inject(ChecklistSessao);
  private readonly cep = inject(ZipCodeService);

  protected readonly zip = maskZip;
  protected readonly fone = mascararTelefone;

  protected endereco(qual: Qual): ChecklistAddress {
    const c = this.s.conteudo();
    return (qual === 'principal' ? c.mainAddress : c.deliveryAddress) ?? enderecoVazio();
  }

  protected mudar(qual: Qual, campo: keyof ChecklistAddress, valor: string): void {
    this.s.atualizar(c => {
      const alvo = qual === 'principal' ? (c.mainAddress ??= enderecoVazio()) : (c.deliveryAddress ??= enderecoVazio());
      const texto = campo === 'zipCode' ? apenasDigitos(valor).slice(0, 8)
        : campo === 'state' ? valor.toUpperCase().slice(0, 2) : valor;
      alvo[campo] = texto || null;
    });
    if (campo === 'zipCode' && apenasDigitos(valor).length === 8) {
      void this.completarPeloCep(qual, apenasDigitos(valor));
    }
  }

  /** O CEP completa só os campos vazios — o que o vendedor já digitou fica. */
  private async completarPeloCep(qual: Qual, cep: string): Promise<void> {
    if (!this.s.online()) return;
    const achado = await firstValueFrom(this.cep.lookup(cep));
    if (!achado) return;
    this.s.atualizar(c => {
      const alvo = qual === 'principal' ? c.mainAddress : c.deliveryAddress;
      if (!alvo || apenasDigitos(alvo.zipCode ?? '') !== cep) return;
      alvo.street ||= achado.street ?? null;
      alvo.district ||= achado.district ?? null;
      alvo.city ||= achado.city ?? null;
      alvo.state ||= achado.state ?? null;
    });
  }

  protected entregaIgual(igual: boolean | null): void {
    this.s.atualizar(c => {
      c.deliverySameAsMain = igual;
      if (igual === false && !c.deliveryAddress) c.deliveryAddress = enderecoVazio();
      if (igual === true) c.deliveryAddress = null;
    });
  }

  protected contato(campo: 'name' | 'receivingHours' | 'phone', valor: string): void {
    this.s.atualizar(c => {
      c.unitContact ??= { name: null, receivingHours: null, phone: null };
      c.unitContact[campo] = (campo === 'phone' ? apenasDigitos(valor) : valor) || null;
    });
  }

  /** O que diverge do Sankhya aparece só no endereço principal. */
  protected diverge(qual: Qual, campo: keyof ChecklistAddress): string | null {
    return qual === 'principal' ? this.s.divergencia(campo, this.endereco(qual)[campo]) : null;
  }

  protected erro(qual: Qual, campo: string): string | null {
    return this.s.erro(2, `${qual}.${campo}`);
  }
}
