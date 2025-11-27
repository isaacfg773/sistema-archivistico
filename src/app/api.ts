import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {

  constructor() {}

  // Por ahora login local de prueba (luego lo cambiamos a Apps Script)
  login(user: string, pass: string): Observable<{ ok: boolean }> {
    const ok =
      (user === 'admin' && pass === '1234') ||
      (user === 'archivista' && pass === '2024');

    return of({ ok });
  }
}
