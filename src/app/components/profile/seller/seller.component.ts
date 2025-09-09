import { Component, OnInit } from '@angular/core';
import { Seller, sellers } from '../../../../Type/sellers';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-seller',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seller.component.html',
  styleUrl: './seller.component.scss'
})
export class SellerComponent implements OnInit {
  selectedSeller: Seller | null = null;
  cargo: string | null = null;

  constructor(private route: ActivatedRoute){}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const sellerQuery = params['seller']?.toLowerCase();
      if(sellerQuery){
        const result = this.findSellerByName(sellerQuery);
        if(result){
          this.selectedSeller = result.seller;
          this.cargo = result.cargo;
        }
      }
    });
  }

  private findSellerByName(name: string): { seller: Seller; cargo: string } | null {
    for(const [category, sellersArray] of Object.entries(sellers)){
      const found = sellersArray.find(s => s.nome.toLowerCase() === name);
      if(found) return {seller: found, cargo: category};
    }
    return null;
  }
}
