import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkMultiselectComponent } from '../../../theme/ProautoKimium/pk-multiselect/pk-multiselect.component';
import { EmployeeService } from '../../../../infrastructure/services/partners/employee/employee.service';
import { EmployeeNotificationService } from '../../../../infrastructure/services/hr/employee-notification.service';
import { SendNotificationResult } from '../../../../domain/models/hr/employee-notification.model';

type SendMode = 'specific' | 'all';

@Component({
  selector: 'app-hr-notifications',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast, PkButtonComponent, PkInputComponent, PkMultiselectComponent],
  templateUrl: './hr-notifications.component.html',
  styleUrl: './hr-notifications.component.scss',
  providers: [MessageService],
})
export class HrNotificationsComponent implements OnInit {
  employeeOptions: { label: string; value: string }[] = [];

  sendMode: SendMode = 'specific';
  form: FormGroup;

  sending = false;
  lastResult: SendNotificationResult | null = null;

  constructor(
    private employeeService: EmployeeService,
    private notificationService: EmployeeNotificationService,
    private fb: FormBuilder,
    private msgService: MessageService
  ) {
    this.form = this.fb.group({
      employeeIds: [[]],
      title: ['', [Validators.required, Validators.maxLength(200)]],
      message: ['', [Validators.required, Validators.maxLength(500)]],
      link: ['', Validators.maxLength(300)],
    });
  }

  ngOnInit(): void {
    this.employeeService.getEmployes().subscribe({
      next: (list) => {
        this.employeeOptions = list.filter((e) => e.id).map((e) => ({ label: e.name, value: e.id as string }));
      },
      error: () => (this.employeeOptions = []),
    });
  }

  setMode(mode: SendMode): void {
    this.sendMode = mode;
    this.form.get('employeeIds')?.setValue([]);
  }

  get canSend(): boolean {
    if (this.form.get('title')?.invalid || this.form.get('message')?.invalid) return false;
    if (this.sendMode === 'specific' && (this.form.value.employeeIds ?? []).length === 0) return false;
    return true;
  }

  send(): void {
    if (!this.canSend) return;

    this.sending = true;
    const { employeeIds, title, message, link } = this.form.value;

    this.notificationService.send({
      employeeIds: this.sendMode === 'all' ? null : employeeIds,
      title: (title as string).trim(),
      message: (message as string).trim(),
      link: (link as string)?.trim() || null,
    }).subscribe({
      next: (result) => {
        this.sending = false;
        this.lastResult = result;
        this.form.reset({ employeeIds: [], title: '', message: '', link: '' });
        this.msgService.add({ severity: 'success', summary: 'Enviado', detail: `${result.notified} funcionário(s) notificado(s).` });
      },
      error: (err) => {
        this.sending = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 400: return 'Requisição inválida';
      case 401: return 'Não autorizado. Faça login novamente';
      case 403: return 'Você não tem permissão para esta ação';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
