import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';

import { MedicalCertificatesManagerComponent } from './medical-certificates-manager.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { MedicalCertificate } from '../../../../domain/models/hr/medical-certificate.model';
import { environment } from '../../../../../environments/environment';
import { NO_CELULAR, NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';

const API = `${environment.apiUrl}/hr/medical-certificates`;

function atestado(extra: Partial<MedicalCertificate> = {}): MedicalCertificate {
  return {
    id: 'm1', employeeId: 'e1', employeeName: 'Ana Souza', startDate: '2026-09-29', endDate: '2026-09-30',
    daysCount: 2, submissionType: 'FILE', confirmedLegible: null, originalFilename: 'scan.pdf',
    submittedAt: '2026-10-01T08:00:00', status: 'PENDING', reviewedByName: null, reviewedAt: null,
    reviewNotes: null, resubmittedAt: null, resubmitComment: null, resubmitDeadline: null, previousAttempts: [],
    ...extra,
  };
}

const REENVIADO = atestado({
  resubmittedAt: '2026-10-02T08:14:00',
  resubmitComment: 'Agora escaneado',
  previousAttempts: [{
    id: 'a1', submissionType: 'PHOTO', originalFilename: 'foto.jpg', submittedAt: '2026-10-01T08:00:00',
    comment: null, reviewedByName: 'Rita', reviewedAt: '2026-10-01T09:10:00', reviewNotes: 'Foto borrada',
  }],
});

describe('MedicalCertificatesManagerComponent — conferência', () => {
  let fixture: ComponentFixture<MedicalCertificatesManagerComponent>;
  let component: MedicalCertificatesManagerComponent;
  let http: HttpTestingController;

  async function montar(permissoes: string[] = ['CONSULTAR', 'ALTERAR'], largura = NO_COMPUTADOR): Promise<void> {
    larguraDaJanela(largura);
    await TestBed.configureTestingModule({
      imports: [MedicalCertificatesManagerComponent],
      providers: providersDeTeste(),
    }).compileComponents();
    fixture = TestBed.createComponent(MedicalCertificatesManagerComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    // Quem carrega as permissões no app é a guarda da rota; aqui, o teste.
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(r => r.url.endsWith('/me/permissions')).flush({ 'rh/medical-certificates': permissoes });
    fixture.detectChanges();
  }

  function listas(): TestRequest[] {
    return http.match(r => r.url === API);
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  }

  function botao(label: string): HTMLButtonElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  }

  afterEach(() => {
    http.verify();
    restaurarLargura();
  });

  it('abre em "Em conferência", pedindo à API só os pendentes, e mostra quantos são', async () => {
    await montar();
    const [lista] = listas();
    expect(lista.request.params.get('status')).toBe('PENDING');
    lista.flush([atestado(), atestado({ id: 'm2', employeeName: 'Carlos' })]);
    fixture.detectChanges();

    const chip = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.chip'))
      .find(c => c.textContent!.includes('Em conferência'))!;
    expect(chip.classList).toContain('is-on');
    expect(chip.querySelector('small')?.textContent?.trim()).toBe('2');
  });

  it('trocar para Recusados pede os recusados e mantém a contagem dos pendentes', async () => {
    await montar();
    listas()[0].flush([atestado()]);
    component.filterByStatus('REJECTED');

    const reqs = listas();
    expect(reqs.map(r => r.request.params.get('status')).sort()).toEqual(['PENDING', 'REJECTED']);
    reqs.forEach(r => r.flush(r.request.params.get('status') === 'PENDING' ? [atestado()] : []));
    expect(component.pendingCount).toBe(1);
  });

  it('recusar exige o motivo e manda o texto para a API', async () => {
    await montar();
    listas()[0].flush([atestado()]);
    fixture.detectChanges();

    botao('Recusar o atestado de Ana Souza')!.click();
    fixture.detectChanges();
    expect(component.canConfirmReview).toBeFalse();

    component.reviewNotes = '  Foto borrada  ';
    component.confirmReview();
    const req = http.expectOne(`${API}/m1/reject`);
    expect(req.request.body).toEqual({ notes: 'Foto borrada' });
    req.flush(atestado({ status: 'REJECTED' }));
    listas().forEach(r => r.flush([]));
    expect(component.reviewVisible()).toBeFalse();
  });

  it('confirmar não exige observação e manda nulo quando ela está vazia', async () => {
    await montar();
    listas()[0].flush([atestado()]);
    fixture.detectChanges();

    botao('Confirmar o recebimento do atestado de Ana Souza')!.click();
    expect(component.canConfirmReview).toBeTrue();
    component.confirmReview();
    const req = http.expectOne(`${API}/m1/receive`);
    expect(req.request.body).toEqual({ notes: null });
    req.flush(atestado({ status: 'RECEIVED' }));
    listas().forEach(r => r.flush([]));
  });

  it('o reenvio mostra a recusa anterior na linha e a trilha inteira na janela', async () => {
    await montar();
    listas()[0].flush([REENVIADO]);
    fixture.detectChanges();
    expect(texto()).toContain('Reenviado');
    expect(texto()).toContain('2º arquivo · antes: “Foto borrada”');

    component.openReview(REENVIADO, 'reject');
    fixture.detectChanges();
    const dialogo = document.body.textContent!.replace(/\s+/g, ' ');
    expect(dialogo).toContain('Rita recusou: “Foto borrada”');
    expect(dialogo).toContain('Ana Souza reenviou: “Agora escaneado”');
    expect(dialogo).toContain('1º envio · recusado');
    expect(dialogo).toContain('foto.jpg');
  });

  it('quem só consulta não vê confirmar nem recusar, mas baixa', async () => {
    await montar(['CONSULTAR']);
    listas()[0].flush([atestado()]);
    fixture.detectChanges();

    expect(botao('Recusar o atestado de Ana Souza')).toBeNull();
    expect(botao('Confirmar o recebimento do atestado de Ana Souza')).toBeNull();
    expect(botao('Baixar o atestado de Ana Souza')).not.toBeNull();
  });

  it('no celular, o cartão também esconde confirmar e recusar de quem só consulta', async () => {
    await montar(['CONSULTAR'], NO_CELULAR);
    listas()[0].flush([atestado()]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.pk-cartao')).not.toBeNull();
    expect(botao('Recusar o atestado de Ana Souza')).toBeNull();
    expect(botao('Baixar o atestado de Ana Souza')).not.toBeNull();
  });
});
