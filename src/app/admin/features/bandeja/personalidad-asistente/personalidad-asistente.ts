import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';

import { environment } from '../../../../../environments/environment';

/** Lo que guarda el backend (`intelligence/core/personalidad.js`). */
export interface PersonalidadAsistente {
  nombre: string | null;
  trato: string | null;
  bienvenida: string | null;
  emojis: 'normal' | 'pocos' | 'ninguno';
}

const VACIA: PersonalidadAsistente = { nombre: null, trato: null, bienvenida: null, emojis: 'normal' };

/** Los tratos que más se oyen en Colombia; «Otro» deja escribir el del negocio. */
export const TRATOS_COMUNES = ['veci', 'amigo', 'parce', 'sumercé', 'mi rey'];

export const MARCAS_BIENVENIDA = [
  { marca: '{saludo}', etiqueta: 'Saludo', ayuda: '«¡Buenas tardes!», según la hora' },
  { marca: '{trato}', etiqueta: 'Trato', ayuda: 'Cómo llamas a tus clientes' },
  { marca: '{negocio}', etiqueta: 'Negocio', ayuda: 'El nombre del negocio' },
  { marca: '{asistente}', etiqueta: 'Asistente', ayuda: 'El nombre del asistente' },
];

function saludoPorLaHora(d = new Date()): string {
  const h = d.getHours();
  return h < 12 ? '¡Buenos días!' : h < 19 ? '¡Buenas tardes!' : '¡Buenas noches!';
}

/**
 * La entrada del saludo, igual que la arma el backend (`personalidad.entradaDeBienvenida`): lo
 * que se ve en la vista previa es lo que va a recibir el cliente. Pura.
 */
export function entradaDeBienvenida(p: PersonalidadAsistente, negocio: string, saludo: string): string {
  const neg = `*${negocio || 'el negocio'}*`;
  const trato = p.trato?.trim() || '';
  if (p.bienvenida?.trim()) {
    const base = trato ? p.bienvenida : p.bienvenida.replace(/[,\s]*\{trato\}/gi, '');
    return base
      .replace(/\{saludo\}/gi, saludo)
      .replace(/\{trato\}/gi, trato)
      .replace(/\{negocio\}/gi, neg)
      .replace(/\{asistente\}/gi, p.nombre?.trim() || 'el asistente')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/([!?.]),/g, '$1')
      .trim();
  }
  const icono = p.emojis === 'ninguno' ? '' : '👋 ';
  const hola = trato ? saludo.replace(/^(.*?)([!.?]*)$/, (_m, a: string, b: string) => `${a}, ${trato}${b || '!'}`) : saludo;
  const quien = p.nombre?.trim() ? `Soy ${p.nombre.trim()}, de ${neg}.` : `Te saluda ${neg}.`;
  return `${icono}${hola} ${quien}`;
}

/** `*negrita*` de WhatsApp → partes para pintarla sin `innerHTML`. Pura. */
export function partesWhatsapp(texto: string): { t: string; negrita: boolean }[] {
  return texto.split(/(\*[^*\n]+\*)/g).filter(Boolean).map((t) =>
    t.startsWith('*') && t.endsWith('*') && t.length > 2 ? { t: t.slice(1, -1), negrita: true } : { t, negrita: false },
  );
}

/**
 * «Cómo se presenta tu asistente» (2026-11-03): nombre, cómo les dice a los clientes, cuántos
 * emojis y la bienvenida con las palabras del negocio. Con vista previa del saludo tal como llega
 * por WhatsApp.
 *
 * Lo que viene detrás de la bienvenida —abierto o cerrado, el enlace de la carta— lo sigue
 * poniendo la plataforma, y la vista previa lo dice: un texto fijo no puede saber si hoy abrieron.
 *
 * ⚠️ Es copia de la de `restaurante_app` (`features/conversaciones/bandeja/personalidad-asistente/`): si se
 * cambia una, se cambia la otra. Solo difieren en la URL de la API.
 */
@Component({
  selector: 'app-personalidad-asistente',
  imports: [LucideAngularModule],
  templateUrl: './personalidad-asistente.html',
  styleUrl: './personalidad-asistente.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalidadAsistenteComponent {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  readonly idNegocio = input.required<number>();
  readonly nombreNegocio = input<string>('');
  readonly valor = input<PersonalidadAsistente | null>(null);
  readonly puedeEditar = input(false);
  /** Guardado: el padre actualiza su copia de la configuración. */
  readonly guardado = output<PersonalidadAsistente | null>();
  /** Un error del servidor, con su mensaje: el padre lo enseña con su aviso de siempre. */
  readonly fallo = output<unknown>();

  readonly tratos = TRATOS_COMUNES;
  readonly marcas = MARCAS_BIENVENIDA;

  readonly nombre = signal('');
  readonly trato = signal('');
  readonly tratoPropio = signal(false);
  readonly emojis = signal<PersonalidadAsistente['emojis']>('normal');
  readonly propia = signal(false);
  readonly bienvenida = signal('');
  readonly guardando = signal(false);

  private readonly caja = viewChild<ElementRef<HTMLTextAreaElement>>('cajaBienvenida');

  constructor() {
    // Cuando llega (o cambia) lo guardado, el formulario se pone igual.
    effect(() => this.cargar(this.valor() ?? VACIA));
  }

  readonly actual = computed<PersonalidadAsistente>(() => ({
    nombre: this.nombre().trim() || null,
    trato: this.trato().trim() || null,
    bienvenida: this.propia() ? this.bienvenida().trim() || null : null,
    emojis: this.emojis(),
  }));

  readonly sucio = computed(() => JSON.stringify(this.actual()) !== JSON.stringify(this.valor() ?? VACIA));
  readonly esLaDeSiempre = computed(() => JSON.stringify(this.actual()) === JSON.stringify(VACIA));

  readonly tratoInvalido = computed(() => {
    const t = this.trato().trim();
    return !!t && !/^[\p{L}][\p{L} '’.-]*$/u.test(t);
  });
  readonly valido = computed(
    () => !this.tratoInvalido() && this.trato().trim().length <= 24 && this.nombre().trim().length <= 30,
  );

  readonly vistaPrevia = computed(() =>
    partesWhatsapp(entradaDeBienvenida(this.actual(), this.nombreNegocio(), saludoPorLaHora())),
  );

  elegirTrato(t: string | null): void {
    this.tratoPropio.set(false);
    this.trato.set(t ?? '');
  }

  otroTrato(): void {
    this.tratoPropio.set(true);
    if (TRATOS_COMUNES.includes(this.trato())) this.trato.set('');
  }

  /** Pone la marca donde está el cursor de la bienvenida. */
  insertarMarca(marca: string): void {
    const el = this.caja()?.nativeElement;
    const texto = this.bienvenida();
    const desde = el?.selectionStart ?? texto.length;
    const hasta = el?.selectionEnd ?? texto.length;
    const nuevo = (texto.slice(0, desde) + marca + texto.slice(hasta)).slice(0, 400);
    this.bienvenida.set(nuevo);
    queueMicrotask(() => {
      el?.focus();
      el?.setSelectionRange(desde + marca.length, desde + marca.length);
    });
  }

  activarPropia(si: boolean): void {
    this.propia.set(si);
    // Una plantilla de arranque: más fácil corregir que empezar de cero.
    if (si && !this.bienvenida().trim()) {
      this.bienvenida.set('{saludo} Bienvenido a {negocio}, {trato}. ¿Qué se te antoja hoy?');
    }
  }

  deshacer(): void {
    this.cargar(this.valor() ?? VACIA);
  }

  guardar(): void {
    if (!this.sucio() || !this.valido() || this.guardando()) return;
    this.enviar(this.esLaDeSiempre() ? null : this.actual());
  }

  volverALaDeSiempre(): void {
    if (this.guardando()) return;
    this.enviar(null);
  }

  private enviar(valor: PersonalidadAsistente | null): void {
    this.guardando.set(true);
    this.http
      .put<{ data?: { asistente_personalidad?: PersonalidadAsistente | null } }>(
        `${this.API}/intelligence/bandeja/configuracion`,
        { id_negocio: this.idNegocio(), asistente_personalidad: valor },
      )
      .subscribe({
        next: (r) => {
          this.guardando.set(false);
          const guardada = r?.data?.asistente_personalidad ?? valor;
          this.cargar(guardada ?? VACIA);
          this.guardado.emit(guardada ?? null);
        },
        error: (err) => {
          this.guardando.set(false);
          this.fallo.emit(err);
        },
      });
  }

  private cargar(p: PersonalidadAsistente): void {
    this.nombre.set(p.nombre ?? '');
    this.trato.set(p.trato ?? '');
    this.tratoPropio.set(!!p.trato && !TRATOS_COMUNES.includes(p.trato));
    this.emojis.set(p.emojis ?? 'normal');
    this.propia.set(!!p.bienvenida);
    this.bienvenida.set(p.bienvenida ?? '');
  }
}
