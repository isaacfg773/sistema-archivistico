import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// Coincide con tu hoja "Registros"
export interface BackendDocument {
  fecha: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  enlace: string;
  fileId?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {

  // 👉 URL NUEVA de tu Apps Script
  private readonly BASE_URL =
    'https://script.google.com/macros/s/AKfycbwJJJwPSBxtCjtkoC1BoBR3H9MDqYN5nF9HUye6Sfmhp6OYUUCjAQe2rYgcWu-AKe4U/exec';

  constructor(private http: HttpClient) {}

  // ============================================
  // LISTAR DOCUMENTOS (lee registros de la hoja)
  // ============================================
  getDocuments(): Observable<BackendDocument[]> {
    // aunque no pases action=list igual funciona,
    // pero lo dejamos explícito:
    const params = new HttpParams().set('action', 'list');
    return this.http.get<BackendDocument[]>(this.BASE_URL, { params });
  }
// LOGIN
  login(user: string, pass: string): Observable<{ ok: boolean }> {
    const params = new HttpParams()
      .set('action', 'login')
      .set('user', user)
      .set('pass', pass);

    return this.http.get<{ ok: boolean }>(this.BASE_URL, { params });
  }

  // ============================================
  // GUARDAR DOCUMENTO (agregar a la hoja)
  // ============================================
  saveDocument(payload: {
    codigo: string;
    titulo: string;
    descripcion: string;
    categoria: string;
    enlace: string;
  }): Observable<{ ok: boolean; error?: string; fileId?: string }> {

    let params = new HttpParams()
      .set('action', 'save')
      .set('codigo', payload.codigo)
      .set('titulo', payload.titulo)
      .set('descripcion', payload.descripcion)
      .set('categoria', payload.categoria)
      .set('enlace', payload.enlace);

    return this.http.get<{ ok: boolean; error?: string; fileId?: string }>(
      this.BASE_URL,
      { params }
    );
  }
}
