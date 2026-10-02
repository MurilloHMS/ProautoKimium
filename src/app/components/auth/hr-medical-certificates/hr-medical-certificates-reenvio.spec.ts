import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { HrMedicalCertificatesComponent } from './hr-medical-certificates.component';
import { MedicalCertificate } from '../../../domain/models/hr/medical-certificate.model';
import { environment } from '../../../../environments/environment';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../testing/test-setup';

const API = `${environment.apiUrl}/hr/medical-certificates`;

function atestado(extra: Partial<MedicalCertificate> = {}): MedicalCertificate {
  return {
    id: 'm1', employeeId: 'e1', employeeName: 'Ana Souza', startDate: '2026-09-29', endDate: '2026-09-30',
    daysCount: 2, submissionType: 'PHOTO', confirmedLegible: true, originalFilename: 'foto.jpg',
    submittedAt: '2026-10-01T08:00:00', status: 'PENDING', reviewedByName: null, reviewedAt: null,
    reviewNotes: null, resubmittedAt: null, resubmitComment: null, resubmitDeadline: null, previousAttempts: [],
    ...extra,
  };
}

const RECUSADO = atestado({
  status: 'REJECTED', reviewedByName: 'Rita', reviewedAt: '2026-10-01T09:10:00',
  reviewNotes: 'Foto borrada', resubmitDeadline: '2026-10-31T09:10:00',
});

describe('HrMedicalCertificatesComponent — a resposta do RH', () => {
  let fixture: ComponentFixture<HrMedicalCertificatesComponent>;
  let component: HrMedicalCertificatesComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    larguraDaJanela(NO_COMPUTADOR);
    await TestBed.configureTestingModule({
      imports: [HrMedicalCertificatesComponent],
      providers: providersDeTeste(),
    }).compileComponents();
    fixture = TestBed.createComponent(HrMedicalCertificatesComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    restaurarLargura();
  });

  function carregar(lista: MedicalCertificate[]): void {
    http.expectOne(`${API}/me`).flush(lista);
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  }

  it('cada atestado diz o que o RH fez com ele', () => {
    carregar([
      atestado(),
      atestado({ id: 'm2', status: 'RECEIVED', reviewedAt: '2026-09-26T11:30:00' }),
      RECUSADO,
    ]);

    expect(texto()).toContain('Aguardando o RH');
    expect(texto()).toContain('Recebido pelo RH em 26/09/2026');
    expect(texto()).toContain('Motivo da recusa: Foto borrada');
    expect(texto()).toContain('Reenvie até 31/10/2026');
    expect(texto()).toContain('Enviar outro');
  });

  it('recusado fora do prazo mostra o motivo, mas não oferece reenvio', () => {
    carregar([atestado({ ...RECUSADO, resubmitDeadline: null })]);

    expect(texto()).toContain('Motivo da recusa: Foto borrada');
    expect(texto()).not.toContain('Enviar outro');
  });

  it('foto reenviada precisa da confirmação de legível', () => {
    carregar([RECUSADO]);
    component.openResubmit(RECUSADO);
    component.setResubmitType('PHOTO');
    component.onResubmitFile({ target: { files: [new File(['x'], 'nova.jpg')] } } as unknown as Event);

    expect(component.canResubmit).toBeFalse();
    component.resubmitLegible = true;
    expect(component.canResubmit).toBeTrue();
  });

  it('reenviar manda o arquivo e o comentário, recarrega e confirma que o RH foi avisado', () => {
    carregar([RECUSADO]);
    component.openResubmit(RECUSADO);
    component.onResubmitFile({ target: { files: [new File(['%PDF'], 'scan.pdf')] } } as unknown as Event);
    component.resubmitComment = ' Agora escaneado ';
    component.resubmit();

    const req = http.expectOne(`${API}/m1/resubmit`);
    const body = req.request.body as FormData;
    expect(body.get('submissionType')).toBe('FILE');
    expect(body.get('comment')).toBe('Agora escaneado');
    expect(body.has('confirmedLegible')).toBeFalse();
    expect((body.get('file') as File).name).toBe('scan.pdf');
    req.flush(atestado({ resubmittedAt: '2026-10-02T08:14:00' }));

    carregar([atestado({ resubmittedAt: '2026-10-02T08:14:00' })]);
    expect(component.resubmitTarget()).toBeNull();
    expect(texto()).toContain('O RH foi avisado');
    expect(texto()).toContain('reenviado em 02/10/2026');
  });

  it('a recusa do reenvio aparece na janela, e ela continua aberta', () => {
    carregar([RECUSADO]);
    component.openResubmit(RECUSADO);
    component.onResubmitFile({ target: { files: [new File(['%PDF'], 'scan.pdf')] } } as unknown as Event);
    component.resubmit();

    http.expectOne(`${API}/m1/resubmit`).flush(
      { message: 'O prazo para reenviar terminou em 31/10/2026' }, { status: 409, statusText: 'Conflict' });

    expect(component.resubmitError()).toBe('O prazo para reenviar terminou em 31/10/2026');
    expect(component.resubmitTarget()).not.toBeNull();
  });
});
