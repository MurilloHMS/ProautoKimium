import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CardCaseSucessoComponent } from "../../Components/card-case-sucesso/card-case-sucesso.component";

@Component({
  selector: 'app-clientes',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CardCaseSucessoComponent],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.scss'
})
export class ClientesComponent {

}
