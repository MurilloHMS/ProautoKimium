import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HeroComponent } from "./components/hero/hero.component";
import { ProcessoConsultoriaComponent } from "./components/processo-consultoria/processo-consultoria.component";
import { MotivosContratarComponent } from "./components/motivos-contratar/motivos-contratar.component";
import { ServicosOfertadosComponent } from "./components/servicos-ofertados/servicos-ofertados.component";
import { DuvidasComponent } from "./components/duvidas/duvidas.component";
import { AboutUsComponent } from "./components/about-us/about-us.component";

@Component({
    selector: 'app-home',
    imports: [HeroComponent, ProcessoConsultoriaComponent, MotivosContratarComponent, ServicosOfertadosComponent, DuvidasComponent, AboutUsComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss'
})
export class HomeComponent {

}
