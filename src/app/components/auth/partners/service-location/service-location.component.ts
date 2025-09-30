import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators,} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { serviceLocation } from '../../../../domain/models/serviceLocation.model';
import { ServiceLocationsService } from '../../../../infrastructure/services/partners/serviceLocations/service-locations.service';

@Component({
  selector: 'app-service-location',
  imports: [
    TableModule,
    CommonModule,
    ButtonModule,
    ToolbarModule,
    DialogModule,
    InputTextModule,
    ReactiveFormsModule,
    CheckboxModule,
  ],
  templateUrl: './service-location.component.html',
  styleUrl: './service-location.component.scss',
})
export class ServiceLocationComponent {
  serviceLocations: serviceLocation[] = [];
  loading: boolean = false;
  visible: boolean = false;
  serviceLocation: serviceLocation | null = null;
  form: FormGroup;
  dialogTitle: string = 'Adicionar Prestador de Serviço';
  sl2Edit: serviceLocation | null = null;

  constructor(
    private serviceLocationService: ServiceLocationsService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      codParceiro: ['', Validators.required],
      documento: ['', Validators.required],
      nome: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      ativo: [true, Validators.required],
      address: ['', Validators.required],
    });
  }

  loadServiceLocations() {
    this.loading = true;
    this.serviceLocationService.getServiceLocations().subscribe({
      next: (sls) => {
        this.serviceLocations = sls;
        this.loading = false;
      },
      error: (err) => {
        alert('Error Loading data ' + err.message);
        this.loading = false;
      },
    });
  }

  editServiceLocation(serviceLocation: serviceLocation) {
    this.dialogTitle = 'Editar prestadores de serviços';
    this.sl2Edit = serviceLocation;

    this.form.patchValue({
      codParceiro: serviceLocation.codParceiro,
      documento: serviceLocation.documento,
      nome: serviceLocation.nome,
      email: serviceLocation.email,
      ativo: serviceLocation.ativo,
      address: serviceLocation.address,
    });
    this.visible = true;
  }

  showDialog() {
    this.dialogTitle = 'Adicionar Prestador de serviço';
    this.sl2Edit = null;
    this.visible = true;
  }

  saveSL() {
    if(this.form.valid) {
      const sl: serviceLocation = this.form.value;

      if (this.sl2Edit) {
        this.serviceLocationService.updateServiceLocation(sl).subscribe({
          next: () => {
            this.visible = false;
            this.loadServiceLocations();
          },
          error: (err) => {
            alert('Error updating data: ' + err.message);
          }
        });
      } else {
        this.serviceLocationService.addServiceLocation(sl).subscribe({
          next: () => {
            this.visible = false;
            this.loadServiceLocations();
          },
          error: (err) => {
            alert('Error adding data: ' + err.message);
          }
        });
      }
    };
  }
}
