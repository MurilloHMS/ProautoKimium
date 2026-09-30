import { ChecklistCatalog, ChecklistContent } from '../app/domain/models/sales/checklist.model';

/** Um checklist válido — os mesmos dados de teste da API (ChecklistFixtures). Documentos de teste, não de gente. */
export function checklistValido(): ChecklistContent {
  return {
    customer: {
      code: 3661, newCustomer: false, name: 'Mercado Central - Unid. 2', legalName: 'Mercado Central Ltda',
      document: '11222333000181', stateRegistration: 'ISENTO', mainPhone: '1932345678', mobile: '19987654321',
      signatory: 'Maria Aparecida Souza', signatoryCpf: '52998224725', invoiceEmail: 'financeiro@mercado.com.br',
      contractEmail: 'contrato@mercado.com.br', priceTable: 281,
      erp: { name: 'MERCADO CENTRAL - UNID. 2', district: 'VILA INDUSTRIAL', zipCode: '13015904', city: 'CAMPINAS' },
    },
    mainAddress: { zipCode: '13015904', street: 'Avenida Francisco Glicério', number: '1200', complement: null,
      district: 'Centro', city: 'Campinas', state: 'SP' },
    deliverySameAsMain: true,
    deliveryAddress: null,
    unitContact: { name: 'Jorge', receivingHours: '8h às 17h', phone: '1932345678' },
    installation: { withMaintenance: false, needsMachine: true,
      machines: [{ type: 'CAPO', otherType: null, quantity: 1, withTable: true }], notes: null, implantationDate: '2026-10-05' },
    comodato: { items: [{ productCode: 1998, name: 'DILUIDOR NTI - AZUL', popularName: 'Diluidor padrão', quantity: 2 }],
      extraItems: [], notes: null },
    visual: { items: [{ itemId: 'v1', name: 'Lave sempre as mãos', quantity: 3 }],
      products: [{ productCode: 197, name: 'PROAUTO REMOCON. - 20 LT BB PRETA', equipmentLabels: 2, bottleLabels: 1, dilution: '1:50' }] },
    order: { enabled: true, kind: 'VENDA', total: null, items: [
      { productCode: 197, name: 'PROAUTO REMOCON. - 20 LT BB PRETA', unit: 'LT', packageSize: 20, packageLabel: '20 LT',
        packages: 3, unitPrice: 10.98, ipiPercent: 3.25, priceTable: 281, priceSource: 'CLIENTE', tablePrice: 10.98, lineTotal: null },
      { productCode: 455, name: 'POSEIDON - 7,5 KG GL NATURAL', unit: 'KG', packageSize: 7.5, packageLabel: '7,5 KG GL',
        packages: 2, unitPrice: 35.31, ipiPercent: 0, priceTable: 80, priceSource: 'GERAL', tablePrice: 35.31, lineTotal: null },
    ] },
  };
}

export function catalogoDeTeste(): ChecklistCatalog {
  return {
    version: 'v1',
    erpFetchedAt: '2026-09-30T10:00:00',
    customers: [
      { code: 3661, name: 'MERCADO CENTRAL - UNID. 2', legalName: 'MERCADO CENTRAL LTDA', document: '11222333000181', personType: 'J',
        stateRegistration: 'ISENTO', phone: '1932345678', invoiceEmail: 'financeiro@mercado.com.br', zipCode: '13015904',
        street: 'Avenida FRANCISCO GLICERIO', number: '1200', complement: null, district: 'VILA INDUSTRIAL', city: 'CAMPINAS', state: 'SP', priceTable: 281 },
      { code: 5000, name: 'PADARIA SÃO JOÃO', legalName: null, document: '06990590000123', personType: 'J',
        stateRegistration: null, phone: null, invoiceEmail: null, zipCode: null, street: null, number: null, complement: null,
        district: null, city: 'JUNDIAI', state: 'SP', priceTable: null },
    ],
    products: [
      { code: 197, name: 'PROAUTO REMOCON. - 20 LT BB PRETA', usage: 'V', group: 100008001, unit: 'LT', ipi: 3.25, packageLabel: '20 LT', packageSize: 20, packageFromName: true },
      { code: 455, name: 'POSEIDON - 7,5 KG GL NATURAL', usage: 'V', group: 100008001, unit: 'KG', ipi: 0, packageLabel: '7,5 KG GL', packageSize: 7.5, packageFromName: false },
      { code: 900, name: 'DETERGENTE SEM PRECO', usage: 'V', group: 1, unit: 'LT', ipi: 0, packageLabel: null, packageSize: null, packageFromName: false },
      { code: 1998, name: 'DILUIDOR NTI - AZUL', usage: 'R', group: 800002000, unit: 'UN', ipi: 0, packageLabel: null, packageSize: null, packageFromName: false },
    ],
    prices: [
      { table: 80, product: 197, price: 10.98 },
      { table: 281, product: 197, price: 9.5 },
      { table: 80, product: 455, price: 35.31 },
    ],
    comodato: [
      { id: 'c1', productCode: 5112, name: 'BOMBA PERISTALTICA - TEKNA TPG800', popularName: 'Dosador frigorífico', active: true },
      { id: 'c2', productCode: 1998, name: 'DILUIDOR NTI - AZUL', popularName: 'Diluidor padrão', active: true },
    ],
    visualItems: [{ id: 'v1', name: 'Lave sempre as mãos' }, { id: 'v2', name: 'Utilize EPI' }],
  };
}
