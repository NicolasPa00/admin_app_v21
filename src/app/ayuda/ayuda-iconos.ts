import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import {
  // Aplicativos
  UtensilsCrossed, CalendarCheck, LayoutDashboard, Car, Dumbbell, Store,
  // Módulos de restaurante
  Home, Receipt, Grid3x3, ChefHat, Bike, BookOpen, Calculator, Package, Truck, Users,
  BarChart3, Clock, UserCog, Settings, MessageCircle, Megaphone,
  // Módulos de reserva
  CalendarDays, CalendarPlus, Scissors, UserCheck, Armchair, Dog, BedDouble, Globe,
  // Módulos de la consola
  Rocket, CreditCard, BadgeCheck, FileText, Building2, User,
  // Interfaz del centro de ayuda
  Search, ChevronRight, ChevronLeft, ArrowLeft, ArrowRight, X, Check, Play, CirclePlay,
  CircleHelp, Loader2, Lock, Sparkles, ExternalLink, ThumbsUp, ThumbsDown, Link2,
  ListOrdered, Video, Film, Eye, EyeOff, Tag, Timer, Hash, Plus, Trash2, Save, Pencil,
  GripVertical, Clapperboard, AlertCircle, Info, ChevronDown, ChevronUp, Copy,
} from 'lucide-angular';

/**
 * Los iconos del Centro de ayuda.
 *
 * ## Por qué es una lista fija y no «el icono que diga la base de datos»
 *
 * Porque `lucide-angular` registra los iconos por componente y solo pinta los que estén en el
 * proveedor: un nombre no registrado no da error de compilación, simplemente no dibuja nada. Y
 * aquí los nombres vienen de `ayuda_modulo.icono`, o sea de la base, así que **hay que registrar
 * de antemano todo lo que el catálogo pueda pedir**. Esta lista cubre lo que siembra
 * `migrate_ayuda_centro.js`; al añadir un módulo con un icono nuevo, hay que añadirlo aquí.
 *
 * El panel de administración enseña esta misma lista como un selector, en vez de un campo de
 * texto libre: así no se puede guardar un icono que no se vaya a pintar.
 *
 * ## Los cuatro nombres con alias
 *
 * `home`, `bar-chart-3`, `circle-help` y `loader-2` ya no existen con ese nombre en lucide — se
 * llaman `house`, `chart-column`, `circle-question-mark` y `loader-circle`. Se importan por su
 * **alias**, que lucide sigue exportando, porque `<lucide-icon name="home">` resuelve a la clave
 * `Home` del proveedor. Dicho de otra forma: lo que manda es la clave de este objeto, no el
 * nombre del archivo de lucide.
 */
export const ICONOS_AYUDA = {
  UtensilsCrossed, CalendarCheck, LayoutDashboard, Car, Dumbbell, Store,
  Home, Receipt, Grid3x3, ChefHat, Bike, BookOpen, Calculator, Package, Truck, Users,
  BarChart3, Clock, UserCog, Settings, MessageCircle, Megaphone,
  CalendarDays, CalendarPlus, Scissors, UserCheck, Armchair, Dog, BedDouble, Globe,
  Rocket, CreditCard, BadgeCheck, FileText, Building2, User,
  Search, ChevronRight, ChevronLeft, ArrowLeft, ArrowRight, X, Check, Play, CirclePlay,
  CircleHelp, Loader2, Lock, Sparkles, ExternalLink, ThumbsUp, ThumbsDown, Link2,
  ListOrdered, Video, Film, Eye, EyeOff, Tag, Timer, Hash, Plus, Trash2, Save, Pencil,
  GripVertical, Clapperboard, AlertCircle, Info, ChevronDown, ChevronUp, Copy,
};

/** `providers: [...PROVEEDOR_ICONOS_AYUDA]` en cada componente del centro de ayuda. */
export const PROVEEDOR_ICONOS_AYUDA = [
  {
    provide: LUCIDE_ICONS,
    multi: true,
    useValue: new LucideIconProvider(ICONOS_AYUDA),
  },
];

/**
 * La MISMA conversión que hace `lucide-angular` por dentro (`LucideAngularComponent.toPascalCase`).
 *
 * Está copiada a propósito, en vez de derivar el kebab desde el PascalCase: esa dirección es
 * ambigua y me costó un fallo. `Grid3x3` se convertiría en `grid3x3`, pero el nombre que guarda
 * la base es `grid-3x3`; igual con `bar-chart-3` → `BarChart3` y `loader-2` → `Loader2`. En el
 * sentido kebab → PascalCase no hay ambigüedad, y además es exactamente la cuenta que va a hacer
 * lucide al pintar, así que comprobar aquí es comprobar lo que de verdad va a pasar.
 */
function aPascalCase(nombre: string): string {
  return nombre.replace(
    /(\w)([a-z0-9]*)(_|-|\s*)/g,
    (_todo, primera: string, resto: string) => primera.toUpperCase() + resto.toLowerCase(),
  );
}

/**
 * Los nombres que el panel ofrece para `icono`, en kebab-case (como se guardan en la base).
 *
 * Es una lista explícita y no una derivación, por lo dicho en `aPascalCase`. Lo que impide que
 * se desincronice de `ICONOS_AYUDA` es `ayuda-iconos.spec.ts`, que comprueba la correspondencia
 * en las dos direcciones: un icono añadido en un sitio y no en el otro rompe el test.
 */
export const NOMBRES_ICONOS: string[] = [
  'alert-circle', 'armchair', 'arrow-left', 'arrow-right', 'badge-check', 'bar-chart-3',
  'bed-double', 'bike', 'book-open', 'building-2', 'calculator', 'calendar-check',
  'calendar-days', 'calendar-plus', 'car', 'chef-hat', 'check', 'chevron-down', 'chevron-left',
  'chevron-right', 'chevron-up', 'circle-help', 'circle-play', 'clapperboard', 'clock', 'copy',
  'credit-card', 'dog', 'dumbbell', 'external-link', 'eye', 'eye-off', 'file-text', 'film',
  'globe', 'grid-3x3', 'grip-vertical', 'hash', 'home', 'info', 'layout-dashboard', 'link-2',
  'list-ordered', 'loader-2', 'lock', 'megaphone', 'message-circle', 'package', 'pencil', 'play',
  'plus', 'receipt', 'rocket', 'save', 'scissors', 'search', 'settings', 'sparkles', 'store',
  'tag', 'timer', 'thumbs-down', 'thumbs-up', 'trash-2', 'truck', 'user', 'user-check',
  'user-cog', 'users', 'utensils-crossed', 'video', 'x',
];

/** El icono que se pinta cuando el de la base no está registrado. */
export const ICONO_POR_DEFECTO = 'circle-help';

/**
 * Devuelve `nombre` si de verdad está registrado, y si no el de por defecto.
 *
 * Comprueba contra `ICONOS_AYUDA` pasando por `aPascalCase`, que es la cuenta que hará lucide:
 * así lo que se valide y lo que se pinte no puedan discrepar. Hace falta porque un nombre
 * desconocido no da error — deja un hueco en silencio, y una rejilla con huecos parece una
 * página a medio cargar.
 */
export function iconoSeguro(nombre: string | null | undefined): string {
  if (!nombre) return ICONO_POR_DEFECTO;
  return aPascalCase(nombre) in ICONOS_AYUDA ? nombre : ICONO_POR_DEFECTO;
}

export { aPascalCase as aPascalCaseParaTests };
