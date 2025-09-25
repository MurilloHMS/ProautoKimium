
import { Component, input, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
    selector: 'app-snackbar',
    imports: [],
    templateUrl: './snackbar.component.html',
    styleUrl: './snackbar.component.scss'
})
export class SnackbarComponent implements OnChanges {
  @Input() message: string = '';
  @Input() isOpen: boolean = false;

  ngOnChanges(changes: SimpleChanges): void {
      if (changes['isOpen'] && this.isOpen){
        setTimeout(() => {
          this.isOpen = false;
      }, 3000);
    }
  }
}
