import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../components/layout/header/header.component';
import { FooterComponent } from '../../components/layout/footer/footer.component';
import { ScrollToTopComponent } from '../../components/shared/scroll-to-top/scroll-to-top.component';
import { WhatsappComponent } from '../../components/shared/whatsapp/whatsapp.component';

@Component({
    selector: 'app-public-layout',
    imports: [RouterOutlet, HeaderComponent, FooterComponent, ScrollToTopComponent, WhatsappComponent],
    templateUrl: './public-layout.component.html',
    styleUrl: './public-layout.component.scss'
})
export class PublicLayoutComponent {

}
