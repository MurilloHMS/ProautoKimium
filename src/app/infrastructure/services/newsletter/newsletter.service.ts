import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NewsletterService {
  constructor(private http: HttpClient){}

  createNewsletters(files: File[]) {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    return this.http.post(`${environment.apiUrl}/newsletter/upload`, formData, {responseType: 'text'});
  }

  sendPendingNewsletters(){
    return this.http.post(`${environment.apiUrl}/newsletter/pending/send`, "", {responseType: 'text'});
  }
}
