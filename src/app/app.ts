import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService, BackendDocument } from './api';

interface Documento {
  id: number;
  codigo: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  url: string;      // URL que se usará para el visor
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

  // ========= REGISTRO / TABLA =========
  documentos: Documento[] = [];
  nextId = 1;

  formCodigo = '';
  formTitulo = '';
  formDescripcion = '';
  formCategoria = '';
  formUrl = '';
  registroMsg = '';

  // Mensaje específico para la tabla (cargando / vacío / error)
  tablaMsg = '';

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

    // 🔹 LOGIN LOCAL principal
    if (this.loginUser === 'admin' && this.loginPass === '1234') {
      this.loggedIn = true;
      this.loginMsg = '';
      this.loginError = false;

      // Al entrar, intentamos cargar la tabla desde Apps Script
      this.cargarDesdeBackend();
      return;
    }

    // 🔹 Opcional: login contra Apps Script para otros usuarios
    this.api.login(this.loginUser, this.loginPass).subscribe({
      next: (resp: { ok: boolean }) => {
        if (resp.ok) {
          this.loggedIn = true;
          this.loginMsg = '';
          this.cargarDesdeBackend();
        } else {
          this.loginMsg = 'Usuario o contraseña incorrectos.';
          this.loginError = true;
        }
      },
      error: (err) => {
        console.error('Error en login backend', err);
        this.loginMsg = 'Error de login en el servidor (Apps Script).';
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
    this.documentos = [];
    this.resultadosTexto = [];
    this.resultadosVoz = [];
    this.tablaMsg = '';
  }

  // ---------- UTILIDAD: sacar fileId de enlace de Drive ----------
  private extraerFileId(desdeUrl: string): string | null {
    if (!desdeUrl) return null;

    // https://drive.google.com/file/d/ID/...
    let m = desdeUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return m[1];

    // ...?id=ID
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

    const payload = {
      codigo: this.formCodigo.trim(),
      titulo: this.formTitulo.trim(),
      descripcion: this.formDescripcion.trim(),
      categoria: this.formCategoria.trim(),
      enlace: this.formUrl.trim(),   // enlace de Google Drive o PDF
    };

    this.registroMsg = 'Guardando en el sistema...';

    this.api.saveDocument(payload).subscribe({
      next: (resp: any) => {
        console.log('Respuesta saveDocument', resp);

        if (resp.ok) {
          this.registroMsg = 'Documento guardado correctamente.';

          // limpiar formulario
          this.formCodigo = '';
          this.formTitulo = '';
          this.formDescripcion = '';
          this.formCategoria = '';
          this.formUrl = '';

          // recargar todo desde la hoja
          this.cargarDesdeBackend();
        } else {
          this.registroMsg = 'No se pudo guardar: ' + (resp.error || '');
        }

        setTimeout(() => (this.registroMsg = ''), 3000);
      },
      error: (err) => {
        console.error('Error al guardar en el servidor', err);
        this.registroMsg = 'Error al guardar en el servidor.';
        setTimeout(() => (this.registroMsg = ''), 4000);
      },
    });
  }

  // ---------- CARGAR DESDE BACKEND (HOJA DE CÁLCULO) ----------
  cargarDesdeBackend() {
    this.tablaMsg = 'Cargando documentos desde el sistema...';

    this.api.getDocuments().subscribe({
      next: (docs: BackendDocument[]) => {
        console.log('Docs desde backend:', docs);

        const lista = docs || [];

        this.documentos = lista.map((d, idx) => {
          // Si el backend ya devuelve fileId, lo usamos; si no, lo intentamos extraer
          const fileId = d.fileId || this.extraerFileId(d.enlace || '');

          const urlPreview = fileId
            ? `https://drive.google.com/file/d/${fileId}/preview`
            : (d.enlace || '');

          return {
            id: idx + 1,
            codigo: d.codigo || '',
            titulo: d.titulo || '',
            descripcion: d.descripcion || '',
            categoria: d.categoria || '',
            url: urlPreview,
            fileId,
          } as Documento;
        });

        if (this.documentos.length === 0) {
          this.tablaMsg = 'No hay documentos registrados todavía.';
        } else {
          this.tablaMsg = '';
        }

        // Limpiar resultados de búsqueda y visor
        this.resultadosTexto = [];
        this.resultadosVoz = [];
        this.selectedDocumentUrl = null;
        this.selectedDocumentTitle = '';
      },
      error: (err) => {
        console.error('Error al cargar documentos', err);
        this.tablaMsg = 'Error al cargar documentos desde el sistema.';
      },
    });
  }

  // ---------- ELIMINAR DOCUMENTO (solo en memoria por ahora) ----------
  eliminarDocumento(id: number) {
    const docActual = this.documentos.find((d) => d.id === id);
    if (docActual && this.selectedDocumentTitle === (docActual.titulo || docActual.codigo)) {
      this.selectedDocumentUrl = null;
      this.selectedDocumentTitle = '';
    }

    this.documentos = this.documentos.filter((d) => d.id !== id);

    if (this.documentos.length === 0) {
      this.tablaMsg = 'No hay documentos registrados todavía.';
    }
  }

  // ---------- TABLA / VISOR ----------
  verDocumento(doc: Documento) {
    this.selectedDocumentTitle = doc.titulo || doc.codigo;

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
