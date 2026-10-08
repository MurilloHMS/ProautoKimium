/**
 * Solicitações do RH — espelha os DTOs de `/api/hr/document-requests`.
 *
 * Uma solicitação é uma lista de campos, e "Arquivo" é só um tipo de campo: o
 * RG, o contrato para assinar e os tamanhos de uniforme são a mesma ferramenta.
 */

export type RequestStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type RecipientStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'RETURNED';
export type FieldType = 'FILE' | 'CHOICE' | 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'YES_NO';

export interface RequestField {
  /** Estável: as respostas usam a chave, nunca o rótulo. Nasce no site e não muda mais. */
  key: string;
  label: string;
  help: string | null;
  type: FieldType;
  required: boolean;
  /** Só Escolha. */
  options: string[];
  /** Só Arquivo: o tipo de documento em que ele vira quando o RH aprova. */
  documentTypeId: string | null;
}

export interface RequestCounts {
  total: number;
  pending: number;
  submitted: number;
  approved: number;
  returned: number;
}

export interface DocumentRequest {
  id: string;
  title: string;
  instructions: string | null;
  dueDate: string | null;
  status: RequestStatus;
  form: RequestField[];
  templateFilename: string | null;
  createdBy: string;
  createdAt: string;
  sentAt: string | null;
  closedAt: string | null;
  counts: RequestCounts;
}

export interface RequestFile {
  id: string;
  fieldKey: string;
  originalFilename: string;
  uploadedAt: string;
}

/** Uma resposta: de uma pessoa a uma solicitação. Serve ao RH e ao funcionário. */
export interface Recipient {
  id: string;
  requestId: string;
  requestTitle: string;
  requestInstructions: string | null;
  requestDueDate: string | null;
  requestStatus: RequestStatus;
  form: RequestField[];
  requestTemplateFilename: string | null;
  employeeId: string;
  employeeName: string;
  status: RecipientStatus;
  answers: Record<string, unknown>;
  addedAt: string;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  returnReason: string | null;
  files: RequestFile[];
  /** Tem login ativo: recebe pelo portal. Sem acesso, o RH registra a resposta (V123). */
  hasAccess?: boolean;
  /** Login do RH que registrou no lugar do funcionário; nulo = ele respondeu pelo portal. */
  registeredBy?: string | null;
}

/** A confirmação do envio: quantos recebem pelo portal e quem o RH vai registrar. */
export interface AudiencePreview {
  total: number;
  withAccess: number;
  withoutAccess: { id: string; name: string }[];
}

/** Quem ainda pode receber o lembrete: pendente ou devolvida, e com login. */
export function remindable(recipients: Recipient[]): number {
  return recipients.filter(r => (r.status === 'PENDING' || r.status === 'RETURNED') && r.hasAccess !== false).length;
}

/** Quem pode ter a resposta registrada pelo RH: ainda não respondeu, ou foi devolvido. */
export function canRegister(r: Recipient): boolean {
  return r.status === 'PENDING' || r.status === 'RETURNED';
}

export interface UpdateDocumentRequest {
  title: string;
  instructions: string | null;
  dueDate: string | null;
  form: RequestField[];
}

/** O público, como nos Eventos: todos, ou a soma das empresas, dos setores e das pessoas. */
export interface Audience {
  all: boolean;
  companyIds: string[];
  departmentIds: string[];
  employeeIds: string[];
}

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  FILE: 'Arquivo',
  CHOICE: 'Escolha',
  SHORT_TEXT: 'Texto curto',
  LONG_TEXT: 'Texto longo',
  NUMBER: 'Número',
  DATE: 'Data',
  YES_NO: 'Sim/Não',
};

export const FIELD_TYPES = Object.keys(FIELD_TYPE_LABEL) as FieldType[];

/**
 * Cor e texto de cada situação, do vocabulário de status: pendente espera o
 * funcionário (warning), enviada espera o RH (work), devolvida é bloqueio
 * (danger), aprovada encerra (success). O ícone é o que sobra na escala de cinza.
 */
// A chave é `string` (e não o union) porque as linhas da pk-table chegam como `any` no template.
export const RECIPIENT_STATUS_INFO: Record<RecipientStatus | string, { label: string; ownerLabel: string; chip: string; icon: string }> = {
  PENDING:   { label: 'Pendente',            ownerLabel: 'Para responder', chip: 'warning', icon: 'pi pi-clock' },
  SUBMITTED: { label: 'Aguardando revisão',  ownerLabel: 'Enviada ao RH',  chip: 'work',    icon: 'pi pi-inbox' },
  RETURNED:  { label: 'Devolvida',           ownerLabel: 'Devolvida',      chip: 'danger',  icon: 'pi pi-replay' },
  APPROVED:  { label: 'Aprovada',            ownerLabel: 'Aprovada',       chip: 'success', icon: 'pi pi-check' },
};

export const REQUEST_STATUS_INFO: Record<RequestStatus | string, { label: string; chip: string; icon: string }> = {
  DRAFT:  { label: 'Rascunho',  chip: 'neutral', icon: 'pi pi-pencil' },
  OPEN:   { label: 'Aberta',    chip: 'info',    icon: 'pi pi-send' },
  CLOSED: { label: 'Encerrada', chip: 'neutral', icon: 'pi pi-lock' },
};

/** Um campo novo, com chave que não colide com as que já existem no formulário. */
export function newField(type: FieldType, existing: RequestField[]): RequestField {
  const used = new Set(existing.map(f => f.key));
  let key = '';
  do {
    key = `f${Math.random().toString(36).slice(2, 8)}`;
  } while (used.has(key));
  return { key, label: '', help: null, type, required: true, options: [], documentTypeId: null };
}

/**
 * O que impede o envio, na língua do RH. Vazio = pode enviar. É a mesma regra
 * que a API confere; aqui ela só evita a ida e volta e explica antes.
 */
export function formProblems(title: string, form: RequestField[]): string[] {
  const problems: string[] = [];
  if (!title.trim()) problems.push('Dê um título para a solicitação.');
  if (form.length === 0) problems.push('Adicione pelo menos um campo.');
  form.forEach((f, i) => {
    const name = f.label.trim() || `Campo ${i + 1}`;
    if (!f.label.trim()) problems.push(`O campo ${i + 1} está sem nome.`);
    if (f.type === 'CHOICE' && f.options.length === 0) problems.push(`"${name}" precisa de pelo menos uma opção.`);
  });
  return problems;
}

/** A resposta de um campo para mostrar: Sim/Não por extenso, data no formato do Brasil. */
export function answerText(field: RequestField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field.type === 'YES_NO') return value === true || value === 'true' ? 'Sim' : 'Não';
  if (field.type === 'DATE' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  return String(value);
}

/**
 * A aba Totais (o uniforme): quantas pessoas escolheram cada opção, por campo
 * de Escolha. Conta só quem enviou ou foi aprovado — devolvida vai mudar, e
 * pendente não respondeu. As opções seguem a ordem que o RH definiu.
 */
export function tallyChoices(form: RequestField[], recipients: Recipient[]): { field: RequestField; counts: { option: string; n: number }[]; answered: number }[] {
  const counted = recipients.filter(r => r.status === 'SUBMITTED' || r.status === 'APPROVED');
  return form
    .filter(f => f.type === 'CHOICE')
    .map(field => {
      const counts = field.options.map(option => ({
        option,
        n: counted.filter(r => r.answers[field.key] === option).length,
      }));
      return { field, counts, answered: counted.filter(r => r.answers[field.key] != null).length };
    });
}

/** Uma linha por pessoa, uma coluna por campo: o que vai para o Excel. */
export function answersSheet(form: RequestField[], recipients: Recipient[]): Record<string, string>[] {
  return recipients.map(r => {
    const row: Record<string, string> = {
      Funcionário: r.employeeName,
      Situação: RECIPIENT_STATUS_INFO[r.status].label,
    };
    for (const f of form) {
      row[f.label] = f.type === 'FILE'
        ? (r.files.find(x => x.fieldKey === f.key)?.originalFilename ?? '—')
        : answerText(f, r.answers[f.key]);
    }
    return row;
  });
}

/** O funcionário pode mexer na resposta: aberta, e ainda não enviada (ou devolvida). */
export function canAnswer(r: Recipient): boolean {
  return r.requestStatus === 'OPEN' && (r.status === 'PENDING' || r.status === 'RETURNED');
}
