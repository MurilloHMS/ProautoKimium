import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HeroComponent } from "./components/hero/hero.component";
import { ProcessoConsultoriaComponent } from "./components/processo-consultoria/processo-consultoria.component";
import { MotivosContratarComponent } from "./components/motivos-contratar/motivos-contratar.component";
import { ServicosOfertadosComponent } from "./components/servicos-ofertados/servicos-ofertados.component";
import { DuvidasComponent } from "./components/duvidas/duvidas.component";
import { SuccessCaseComponent } from "./components/success-case/success-case.component";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeroComponent, ProcessoConsultoriaComponent, MotivosContratarComponent, ServicosOfertadosComponent, DuvidasComponent, SuccessCaseComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

}
