import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  ChevronDown,
  TriangleAlert,
} from 'lucide-angular';

import { PaisDisponible, PaisesService } from '../../core/services/paises.service';
import { BanderaComponent } from '../bandera/bandera.component';

/**
 * Teléfono con indicativo: bandera y «+57» a la izquierda, número nacional a la derecha.
 *
 * Mismo aspecto que el de `reserva_app`, con una diferencia de contrato: aquí entra y sale **un
 * solo valor**, el teléfono completo (`+573001234567`). En la consola el teléfono se guarda tal
 * cual en columnas de texto libre (negocio, facturación, usuario) y no hay un backend que junte
 * país + número, así que el componente parte el valor al pintarlo y lo recompone al escribir.
 * Los formularios solo hacen `[valor]` / `(valorChange)`.
 *
 * Un teléfono antiguo sin `+` se muestra con el país por defecto y queda normalizado la próxima
 * vez que se guarde.
 *
 * El desplegable es propio y no un `select` porque un `option` no admite el SVG de la bandera.
 * Se cierra al elegir, al pulsar fuera y con Escape.
 */
@Component({
  selector: 'app-telefono-pais',
  standalone: true,
  imports: [LucideAngularModule, BanderaComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ ChevronDown, TriangleAlert }),
    },
  ],
  templateUrl: './telefono-pais.component.html',
  styleUrl: './telefono-pais.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TelefonoPaisComponent implements OnInit {
  private readonly paisesSrv = inject(PaisesService);
  private readonly host = inject(ElementRef);

  /** Teléfono completo, `+573001234567`, o vacío. */
  readonly valor = input<string | null | undefined>('');
  /** Indicativo con el que arranca un campo vacío (ISO alfa-2). */
  readonly paisPorDefecto = input<string>('CO');
  readonly deshabilitado = input<boolean>(false);
  /** `id` del input, para enlazarlo con su `<label for>`. */
  readonly campoId = input<string>('telefono');
  readonly placeholder = input<string | null>(null);

  readonly valorChange = output<string>();

  protected readonly abierto = signal(false);
  protected readonly paises = this.paisesSrv.paises;

  /** País que eligió el usuario en el desplegable; manda sobre el de por defecto. */
  private readonly paisManual = signal<string | null>(null);

  /** El valor partido. Se recalcula cuando llega el catálogo. */
  private readonly partido = computed(() => {
    this.paises();
    return this.paisesSrv.partir(this.valor(), this.paisManual() ?? this.paisPorDefecto());
  });

  protected readonly pais = computed(() => this.partido().pais);
  protected readonly numero = computed(() => this.partido().numero);

  /** Tipado a mano: sin él TypeScript da `paises()[0]` por no-nulo y el primer render revienta. */
  protected readonly elegido = computed<PaisDisponible | null>(
    () => this.paises().find((p) => p.codigo === this.pais()) ?? null,
  );

  protected readonly largoEsperado = computed(() => this.elegido()?.largo ?? 10);
  protected readonly ejemplo = computed(
    () => this.placeholder() ?? '3'.padEnd(this.largoEsperado(), '0'),
  );

  /** Solo avisa del largo; no bloquea el guardado. */
  protected readonly largoMal = computed(() => {
    const n = this.numero();
    return n.length > 0 && !!this.elegido() && n.length !== this.largoEsperado();
  });

  ngOnInit(): void {
    this.paisesSrv.cargar().subscribe();
  }

  protected alternar(): void {
    if (this.deshabilitado()) return;
    this.abierto.update((v) => !v);
  }

  protected elegir(codigo: string): void {
    this.abierto.set(false);
    if (codigo === this.pais()) return;
    this.paisManual.set(codigo);
    const numero = this.numero();
    if (numero) this.valorChange.emit(this.paisesSrv.componer(codigo, numero));
  }

  /**
   * Solo dígitos. Si se pega «+57 318 888 7013» con el indicativo del país elegido, se descuenta
   * en vez de quedarse dentro del número.
   */
  protected escribir(valor: string): void {
    let digitos = String(valor ?? '').replace(/\D/g, '');
    const cc = this.elegido()?.indicativo.replace('+', '') ?? '';
    const largo = this.largoEsperado();
    if (cc && digitos.length === cc.length + largo && digitos.startsWith(cc)) {
      digitos = digitos.slice(cc.length);
    }
    this.valorChange.emit(this.paisesSrv.componer(this.pais(), digitos.slice(0, largo)));
  }

  @HostListener('document:click', ['$event'])
  protected cerrarSiFuera(evento: MouseEvent): void {
    if (!this.abierto()) return;
    if (!this.host.nativeElement.contains(evento.target as Node)) this.abierto.set(false);
  }

  @HostListener('document:keydown.escape')
  protected cerrarConEscape(): void {
    if (this.abierto()) this.abierto.set(false);
  }
}
