import { VehicleService } from './../../../../../infrastructure/services/vehicle/vehicle.service';
import { serviceLocation } from './../../../../../domain/models/serviceLocation.model';
import { Maintenance } from './../../../../../domain/models/maintenance.model';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from "primeng/dialog";
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { MaintenanceService } from '../../../../../infrastructure/services/vehicle/maintenance/maintenance.service';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { Vehicle } from '../../../../../domain/models/vehicle.model';
import { ServiceLocationsService } from '../../../../../infrastructure/services/partners/serviceLocations/service-locations.service';
import { Select, SelectModule } from "primeng/select";


@Component({
  selector: 'app-maintenance',
  imports: [TableModule, CommonModule, ButtonModule, ToolbarModule,
    DialogModule, InputTextModule, ReactiveFormsModule, CheckboxModule, SelectModule],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.scss',
  providers: [provideNgxMask()]
})
export class MaintenanceComponent implements OnInit{
  maintenances: Maintenance[] = [];
  loading: boolean = false;
  visible: boolean = false;
  maintenance: any = null;
  form: FormGroup;
  dialogTitle: string = 'Adicionar Manutenção';
  maintenanceToEdit: Maintenance | null = null;

  // Lists for dropdowns
  vehicles: Vehicle[] = [];
  serviceLocations: serviceLocation[] = [];

  vehicleSelected: Vehicle | null = null;
  locationSelected: serviceLocation | null = null;

  mask: string = 'SSS-0000';

  observationLength = 0;

  constructor(private maintenanceService : MaintenanceService ,
    private fb: FormBuilder,
    private VehicleService: VehicleService,
    private serviceLocationService: ServiceLocationsService) {

    this.form = this.fb.group({
      revisionDate: ['', Validators.required],
      vehiclePlate: ['', Validators.required],
      kilometer: [0, Validators.required],
      nfe: ['', Validators.required],
      type: ['', Validators.required],
      driver: ['', Validators.required],
      observation: [''],
      localSystemCode: ['', Validators.required],
    })

    this.VehicleService.getVehicles().subscribe(vehicles => {
      this.vehicles = vehicles;
    });
    this.serviceLocationService.getServiceLocations().subscribe(locations => {
      this.serviceLocations = locations;
    });
  }

  showDialog(){
    this.dialogTitle = 'Adicionar Manutenção';
    this.maintenanceToEdit = null;
    this.visible = true;
    this.form.reset();
  }

  editMaintenance(maintenance: Maintenance){
    this.dialogTitle = 'Editar Manutenção';
    this.maintenanceToEdit = maintenance;
    this.form.patchValue({
      revisionDate: maintenance.revisionDate,
      vehiclePlate: maintenance.vehiclePlate,
      kilometer: maintenance.kilometer,
      nfe: maintenance.nfe,
      type: maintenance.type,
      driver: maintenance.driver,
      observation: maintenance.observation,
      localSystemCode: maintenance.localSystemCode,
    });
    this.visible = true;
  }

  save(){
    if(this.form.valid){
      const maintenanceData: Maintenance = this.form.value;
      maintenanceData.localSystemCode = this.locationSelected?.codParceiro ?? '';
      maintenanceData.vehiclePlate = this.vehicleSelected?.placa ?? '';
      maintenanceData.driver.toUpperCase();
      maintenanceData.type.toUpperCase();

      if(maintenanceData.observation.length > 0){
        maintenanceData.observation.toUpperCase();
      }

      if(maintenanceData.localSystemCode === '' || maintenanceData.vehiclePlate === ''){
        return alert("Por favor selecione um veiculo ou um local de serviço válido.");
      }

      if(this.maintenanceToEdit){
        this.maintenanceService.updateMaintenance(maintenanceData).subscribe({
          next: () => {
            this.visible = false;
            this.loadMaintenances();
          },
          error: (err) => {
            alert("Error updating maintenance: " + err.message);
          }
        });
      } else {
        this.maintenanceService.addMaintenance(maintenanceData).subscribe({
          next: () => {
            this.visible = false;
            this.loadMaintenances();
          },
          error: (err) => {
            alert("Error adding maintenance: " + err.message);
          }
        });
      }
    };
  }

  loadMaintenances(){
    this.loading = true;
    this.maintenanceService.getMaintenances().subscribe({
      next: (maintenances) => {
        this.maintenances = maintenances;
        this.loading = false;
      },
      error: (err) => {
        alert("Error Loading maintenances" + err.message);
        this.loading = false;
      }
    });
  }

  ngOnInit(): void{
    const value = this.form.get('observation')?.value || '';
    this.observationLength = value.length;
    }

  onObservationInput(event: Event) {
    const input = event.target as HTMLTextAreaElement;
    const upperValue = input.value.toUpperCase();

    this.form.get('observation')?.setValue(upperValue, { emitEvent: false });
    this.observationLength = upperValue.length;
  }

  updateMask(value: string) {
    const upper = value?.toUpperCase() || '';
    const plateControl = this.form.get('vehiclePlate');

    if (plateControl?.value !== upper) {
      plateControl?.setValue(upper, { emitEvent: false });
    }

    this.form.get('vehiclePlate')?.setValue(upper, { emitEvent: false });

    if (/^[A-Z]{3}-[0-9][A-Z]/.test(upper)) {
      this.mask = 'SSS-0S00';
    } else {
      this.mask = 'SSS-0000';
    }
  }

}
