import { Injectable, computed, inject, signal } from '@angular/core';
import { CatalogCustomer, ChecklistContent } from '../../../../domain/models/sales/checklist.model';
import { checklistVazio, normalizar, problemas } from '../../../../domain/utils/checklist/checklist-regras';
import { apenasDigitos } from '../../../../infrastructure/validators/documento-br';
import { ChecklistOfflineStore } from '../../../../infrastructure/state/checklist-offline.store';

/** Os campos que o celular compara com o Sankhya — os mesmos da API. */
const DIGITOS = new Set(['document', 'mainPhone', 'zipCode']);

/**
 * Um checklist aberto no formulário. Uma instância por formulário (provida no
 * componente das etapas), com o conteúdo num signal: cada etapa lê dele e
 * muda por {@link atualizar}, e quem salva no aparelho observa o signal.
 */
@Injectable()
export class ChecklistSessao {

  private readonly store = inject(ChecklistOfflineStore);

  readonly conteudo = signal<ChecklistContent>(checklistVazio());
  readonly indice = this.store.indice;
  readonly online = this.store.online;

  /** Etapas que a pessoa já passou: é nelas que o erro aparece junto do campo. */
  readonly visitadas = signal<Set<number>>(new Set());

  readonly problemas = computed(() => problemas(this.conteudo()));

  /** Muda uma cópia e troca: o signal só avisa quando a referência muda. */
  atualizar(mudar: (c: ChecklistContent) => void): void {
    const copia = structuredClone(this.conteudo());
    mudar(copia);
    this.conteudo.set(copia);
  }

  /** A frase do problema de um campo, se a etapa já foi visitada. */
  erro(etapa: number, campo: string): string | null {
    if (!this.visitadas().has(etapa)) return null;
    const p = this.problemas().find(x => x.etapa === etapa && x.campo === campo);
    return p ? p.mensagem.replace(/^Etapa \d+ — /, '').replace(/^[^:]+: /, '') : null;
  }

  // ── Cliente do Sankhya ───────────────────────────────────────────────────

  /**
   * Escolher um cliente do Sankhya preenche o que o ERP tem, e guarda o
   * retrato — é com ele que a Controladoria vê o que o vendedor mudou.
   */
  escolherCliente(c: CatalogCustomer): void {
    this.atualizar(x => {
      const anterior = x.customer;
      x.customer = {
        code: c.code,
        newCustomer: false,
        name: c.name,
        legalName: c.legalName,
        document: c.document,
        stateRegistration: c.stateRegistration,
        mainPhone: c.phone,
        // Celular, assinante, CPF e e-mail do contrato não estão no Sankhya:
        // quem já digitou não perde ao trocar de cliente.
        mobile: anterior?.mobile ?? null,
        signatory: anterior?.signatory ?? null,
        signatoryCpf: anterior?.signatoryCpf ?? null,
        invoiceEmail: c.invoiceEmail,
        contractEmail: anterior?.contractEmail ?? null,
        priceTable: c.priceTable,
        erp: retratoDoErp(c),
      };
      x.mainAddress = {
        zipCode: c.zipCode, street: c.street, number: c.number, complement: c.complement,
        district: c.district, city: c.city, state: c.state,
      };
    });
  }

  clienteNovo(nome: string): void {
    this.atualizar(x => {
      x.customer = {
        code: null, newCustomer: true, name: nome || null, legalName: null, document: null,
        stateRegistration: null, mainPhone: null, mobile: null, signatory: null, signatoryCpf: null,
        invoiceEmail: null, contractEmail: null, priceTable: null, erp: null,
      };
      x.mainAddress = { zipCode: null, street: null, number: null, complement: null, district: null, city: null, state: null };
    });
  }

  /**
   * O que o Sankhya tinha, quando o valor atual é diferente — para a frase
   * "No Sankhya está X". Caixa, acento, espaço e pontuação não contam: o ERP
   * grava tudo em maiúsculas.
   */
  divergencia(campo: string, atual: string | null | undefined): string | null {
    const erp = this.conteudo().customer?.erp;
    if (!erp || !(campo in erp)) return null;
    const antes = erp[campo] ?? '';
    const igual = DIGITOS.has(campo)
      ? apenasDigitos(antes) === apenasDigitos(atual ?? '')
      : normalizar(antes) === normalizar(atual ?? '');
    return igual ? null : (antes || '(vazio)');
  }
}

export function retratoDoErp(c: CatalogCustomer): Record<string, string> {
  const r: Record<string, string> = {};
  const par = (k: string, v: string | null) => { r[k] = v ?? ''; };
  par('name', c.name);
  par('legalName', c.legalName);
  par('document', c.document);
  par('stateRegistration', c.stateRegistration);
  par('mainPhone', c.phone);
  par('invoiceEmail', c.invoiceEmail);
  par('zipCode', c.zipCode);
  par('street', c.street);
  par('number', c.number);
  par('complement', c.complement);
  par('district', c.district);
  par('city', c.city);
  par('state', c.state);
  return r;
}
