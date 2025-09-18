import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

export enum PkStyle {
  One = 'one',
  Two = 'two',
  TwoAlt = 'two alt-two',
  Three = 'three',
  Four = 'four',
  Five = 'five',
  Six = 'six',
  Seven = 'seven',
  Eight = 'eight',
  Nine = 'nine',
  Ten = 'ten',
  Eleven = 'eleven',
  Twelve = 'twelve',
  Thirteen = 'thirteen',
}

@Component({
    selector: 'pk-title',
    imports: [NgClass],
    templateUrl: './pk-title.component.html',
    styleUrls: ['./pk-title.component.scss']
})
export class PKTitleComponent {
  @Input() text: string = '';
  @Input() tagLine?: string;
  @Input() style: PkStyle = PkStyle.One;

  PkStyle = PkStyle; 

  getPkTitleClass(): string{
    return this.style;
  }

  hasTagline(): boolean {
    return [PkStyle.Two, PkStyle.TwoAlt, PkStyle.Five, PkStyle.Six, PkStyle.Nine].includes(this.style);
  }
}
