import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { Vehicle } from '../../../../../domain/models/vehicle.model';
import { VehicleService } from '../../../../../infrastructure/services/vehicle/vehicle.service';

@Component({
  selector: 'app-vehicles',
  imports: [TableModule, CommonModule, ButtonModule, ToolbarModule,
    DialogModule, InputTextModule, ReactiveFormsModule, CheckboxModule],
  templateUrl: './vehicles.component.html',
  styleUrl: './vehicles.component.scss',
  providers: []
})
export class VehiclesComponent {
  vehicles: Vehicle[] = [];
  loading: boolean = false;
  visible: boolean = false;
  vehicle: Vehicle | null = null;
  form: FormGroup;
  dialogTitle: string = 'Adicionar Veículo';
  vehicleToEdit: Vehicle | null = null;

  constructor(private vehicleService: VehicleService, private fb: FormBuilder){
    this.form = this.fb.group({
      nome: ['', Validators.required],
      placa: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{3}-([0-9]{4}|[0-9][A-Za-z][0-9]{2})$/)]],
      marca: ['', Validators.required],
      consumoUrbanoAlcool: [0],
      consumoUrbanoGasolina: [0],
      consumoRodoviarioAlcool: [0],
      consumoRodoviarioGasolina: [0],
    })
  }

  loadVehicles(){
    this.loading = true;
    this.vehicleService.getVehicles().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles;
        this.loading = false;
      },
      error: (err) => {
        alert("Error Loading vehicles" + err.message);
        this.loading = false;
      }
    });
  }

  editVehicle(vehicle: Vehicle){
    this.dialogTitle = 'Editar Veículo';
    this.vehicleToEdit = vehicle;
    this.form.patchValue({
      nome: vehicle.nome,
      placa: vehicle.placa,
      marca: vehicle.marca,
      consumoUrbanoAlcool: vehicle.consumoUrbanoAlcool,
      consumoUrbanoGasolina: vehicle.consumoUrbanoGasolina,
      consumoRodoviarioAlcool: vehicle.consumoRodoviarioAlcool,
      consumoRodoviarioGasolina: vehicle.consumoRodoviarioGasolina,
    });
    this.visible = true;
  }

  showDialog(){
    this.dialogTitle = 'Adicionar Veículo';
    this.vehicleToEdit = null;
    this.visible = true;
    this.form.reset();
  }

  saveVehicle(){
    if(this.form.valid){
      const vehicleData: Vehicle = this.form.value;
      vehicleData.nome.toUpperCase();
      vehicleData.marca.toUpperCase();
      vehicleData.placa.toUpperCase();

      if(this.vehicleToEdit){
        this.vehicleService.updateVehicle(vehicleData).subscribe({
          next: () => {
            this.visible = false;
            this.loadVehicles();
          },
          error: (err) => {
            alert('Error updating vehicle: ' + err.message);
          }
        });
      } else {
        this.vehicleService.addVehicle(vehicleData).subscribe({
          next: () => {
            this.visible = false;
            this.loadVehicles();
          },
          error: (err) => {
            alert('Error adding vehicle: ' + err.message);
          }
        });
      }
    };
  }
}
