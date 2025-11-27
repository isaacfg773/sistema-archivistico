import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from './api';

interface Documento {
  id: number;
  codigo: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  url: string;      // lo que escribes en el formulario
  fileId?: string;  // ID de Drive si el enlace es de Google Drive
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // ========= LOGIN =========
  loggedIn = false;
  loginUser = '';
  loginPass = '';
  loginMsg = '';
  loginError = false;

  // ========= MENÚ LATERAL =========
  selectedModule: 'registro' | 'tabla' | 'texto' | 'voz' = 'registro';

  // ========= REGISTRO DE DOCUMENTOS =========
  documentos: Documento[] = [];
  nextId = 1;

  formCodigo = '';
  formTitulo = '';
  formDescripcion = '';
  formCategoria = '';
  formUrl = '';
  registroMsg = '';

  // ========= BÚSQUEDA POR TEXTO =========
  searchText = '';
  resultadosTexto: Documento[] = [];

  // ========= BÚSQUEDA POR VOZ =========
  vozTexto = '';
  vozEstado = 'Listo para escuchar…';
  resultadosVoz: Documento[] = [];
  vozSoportada = true;
  private recognition: any;
  private escuchando = false;

  // ========= VISOR DE DOCUMENTOS =========
  selectedDocumentUrl: SafeResourceUrl | null = null;
  selectedDocumentTitle = '';

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {
    this.initSpeechRecognition();
  }

  // ---------- LOGIN ----------
  onLogin() {
    this.loginMsg = 'Verificando...';
    this.loginError = false;

    this.api.login(this.loginUser, this.loginPass).subscribe({
      next: (resp: { ok: boolean }) => {
        if (resp.ok) {
          this.loggedIn = true;
          this.loginMsg = '';
        } else {
          this.loginMsg = 'Usuario o contraseña incorrectos.';
          this.loginError = true;
        }
      },
      error: () => {
        this.loginMsg = 'Error de login.';
        this.loginError = true;
      },
    });
  }

  cerrarSesion() {
    this.loggedIn = false;
    this.loginUser = '';
    this.loginPass = '';
    this.loginMsg = '';
    this.loginError = false;

    // Limpiar visor
    this.selectedDocumentUrl = null;
    this.selectedDocumentTitle = '';
  }

  // ---------- UTILIDAD: sacar fileId de enlace de Drive ----------
  private extraerFileId(desdeUrl: string): string | null {
    if (!desdeUrl) return null;

    // Formato: https://drive.google.com/file/d/ID/...
    let m = desdeUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return m[1];

    // Formato: ...?id=ID
    m = desdeUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return m[1];

    return null;
  }

  // ---------- REGISTRO ----------
  agregarDocumento() {
    if (!this.formCodigo || !this.formTitulo || !this.formUrl) {
      this.registroMsg = 'Código, Título y URL son obligatorios.';
      return;
    }

    const urlLimpia = this.formUrl.trim();
    const fileId = this.extraerFileId(urlLimpia);

    const doc: Documento = {
      id: this.nextId++,
      codigo: this.formCodigo.trim(),
      titulo: this.formTitulo.trim(),
      descripcion: this.formDescripcion.trim(),
      categoria: this.formCategoria.trim(),
      url: urlLimpia,
      fileId: fileId || undefined,
    };

    this.documentos.push(doc);
    this.registroMsg = fileId
      ? 'Documento registrado. Se detectó ID de Drive correctamente.'
      : 'Documento registrado. (No parece ser un enlace de Drive, se usará la URL tal cual).';

    // Limpiar formulario
    this.formCodigo = '';
    this.formTitulo = '';
    this.formDescripcion = '';
    this.formCategoria = '';
    this.formUrl = '';

    setTimeout(() => (this.registroMsg = ''), 3000);
  }

  // ---------- ELIMINAR DOCUMENTO ----------
  eliminarDocumento(id: number) {
    const docActual = this.documentos.find((d) => d.id === id);
    if (docActual && this.selectedDocumentTitle === (docActual.titulo || docActual.codigo)) {
      this.selectedDocumentUrl = null;
      this.selectedDocumentTitle = '';
    }

    this.documentos = this.documentos.filter((d) => d.id !== id);
  }

  // ---------- TABLA / VISOR ----------
  verDocumento(doc: Documento) {
    this.selectedDocumentTitle = doc.titulo || doc.codigo;

    // Si hay fileId de Drive, usamos /preview
    let finalUrl = doc.url;
    if (doc.fileId) {
      finalUrl = `https://drive.google.com/file/d/${doc.fileId}/preview`;
    }

    this.selectedDocumentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      finalUrl
    );
  }

  // ---------- BÚSQUEDA TEXTO ----------
  private filtrar(query: string): Documento[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.documentos;

    return this.documentos.filter((d) => {
      const texto = `${d.codigo} ${d.titulo} ${d.descripcion} ${d.categoria}`.toLowerCase();
      return texto.includes(q);
    });
  }

  buscarPorTexto() {
    this.resultadosTexto = this.filtrar(this.searchText);
    if (this.resultadosTexto.length === 0) {
      this.selectedDocumentUrl = null;
      this.selectedDocumentTitle = '';
    }
  }

  // ---------- BÚSQUEDA VOZ ----------
  private initSpeechRecognition() {
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.vozSoportada = false;
      this.vozEstado =
        'Tu navegador no soporta búsqueda por voz. Prueba con Google Chrome.';
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-ES';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.escuchando = true;
      this.vozEstado = 'Escuchando... habla ahora.';
    };

    this.recognition.onend = () => {
      this.escuchando = false;
      if (this.vozEstado.startsWith('Escuchando')) {
        this.vozEstado = 'Listo para escuchar…';
      }
    };

    this.recognition.onerror = (event: any) => {
      this.escuchando = false;
      this.vozEstado = 'Error: ' + event.error;
    };

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      this.vozTexto = transcript;
      this.vozEstado = `Texto reconocido: "${transcript}"`;
    };
  }

  iniciarDictado() {
    if (!this.vozSoportada || !this.recognition) return;

    if (this.escuchando) {
      this.recognition.stop();
    } else {
      this.recognition.start();
    }
  }

  buscarPorVoz() {
    this.resultadosVoz = this.filtrar(this.vozTexto);
    if (this.resultadosVoz.length === 0) {
      this.selectedDocumentUrl = null;
      this.selectedDocumentTitle = '';
    }
  }
}
