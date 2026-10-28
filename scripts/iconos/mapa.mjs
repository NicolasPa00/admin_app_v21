// Mapea cada identificador de lucide usado en EscalApp a su equivalente en Phosphor.
// Primero la tabla a mano (donde los nombres difieren), luego el kebab directo.
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.resolve(import.meta.dirname).split(path.sep).join('/');

export const ALIAS = {
  // Avisos y estados
  'alert-circle': 'warning-circle', 'circle-alert': 'warning-circle',
  'alert-triangle': 'warning', 'triangle-alert': 'warning',
  'check-circle': 'check-circle', 'check-circle-2': 'check-circle',
  'circle-check': 'check-circle', 'circle-check-big': 'check-circle',
  'circle-x': 'x-circle', 'circle-slash': 'prohibit', 'ban': 'prohibit',
  'circle-help': 'question', 'circle-play': 'play-circle', 'circle-plus': 'plus-circle',
  'circle-dollar-sign': 'currency-circle-dollar',
  'check-check': 'checks', 'shield-alert': 'shield-warning',
  'loader': 'spinner-gap', 'loader-2': 'spinner-gap', 'loader-circle': 'spinner-gap',

  // Flechas y navegacion
  'chevron-down': 'caret-down', 'chevron-up': 'caret-up',
  'chevron-left': 'caret-left', 'chevron-right': 'caret-right',
  'arrow-left-right': 'arrows-left-right', 'arrow-right-left': 'arrows-left-right',
  'arrow-up-down': 'arrows-down-up', 'corner-down-right': 'arrow-elbow-down-right',
  'rotate-cw': 'arrow-clockwise', 'rotate-ccw': 'arrow-counter-clockwise',
  'refresh-cw': 'arrows-clockwise', 'undo-2': 'arrow-u-up-left',
  'reply': 'arrow-bend-up-left', 'external-link': 'arrow-square-out',
  'ellipsis-vertical': 'dots-three-vertical', 'grip-vertical': 'dots-six-vertical',
  'menu': 'list', 'history': 'clock-counter-clockwise',

  // Acciones
  'pencil': 'pencil-simple', 'square-pen': 'note-pencil', 'notebook-pen': 'note-pencil',
  'pen-tool': 'pen-nib', 'trash-2': 'trash', 'save': 'floppy-disk',
  'search': 'magnifying-glass', 'search-x': 'magnifying-glass-minus',
  'send': 'paper-plane-tilt', 'filter': 'funnel', 'settings': 'gear-six',
  'share-2': 'share-network', 'download': 'download-simple', 'upload': 'upload-simple',
  'copy-plus': 'copy-simple', 'unlink': 'link-break', 'link-2': 'link',
  'mouse-pointer-click': 'cursor-click', 'crop': 'crop',

  // Dinero
  'banknote': 'money', 'dollar-sign': 'currency-dollar', 'landmark': 'bank',
  'badge-check': 'seal-check', 'badge-percent': 'seal-percent',
  'receipt-text': 'receipt', 'scale': 'scales', 'award': 'medal',

  // Graficos
  'bar-chart-3': 'chart-bar', 'chart-column': 'chart-bar',
  'chart-pie': 'chart-pie-slice', 'trending-up': 'trend-up', 'trending-down': 'trend-down',

  // Calendario y tiempo
  // calendar-clock marca un momento concreto (un dot); calendar-days, la rejilla del mes
  'calendar-check-2': 'calendar-check', 'calendar-clock': 'calendar-dot',
  'calendar-cog': 'calendar-dots', 'calendar-days': 'calendar-dots',
  'calendar-off': 'calendar-slash', 'calendar-range': 'calendar-blank',
  'clock-3': 'clock', 'sunrise': 'sun-horizon', 'sunset': 'sun-dim',

  // Archivos
  'file-down': 'file-arrow-down', 'file-up': 'file-arrow-up',
  'file-plus-2': 'file-plus', 'file-spreadsheet': 'file-xls',
  'folder-x': 'folder-minus', 'clapperboard': 'film-slate', 'film': 'film-strip',
  'image-icon': 'image', 'image-off': 'image-broken', 'image-plus': 'image-square',
  'sticky-note': 'note', 'inbox': 'tray', 'list-ordered': 'list-numbers',
  'type-icon': 'text-t', 'layers': 'stack', 'database': 'database',

  // Interfaz
  'layout-dashboard': 'squares-four', 'layout-grid': 'squares-four',
  'grid-3x3': 'grid-nine', 'panel-left': 'sidebar-simple', 'panel-left-close': 'sidebar',
  'panel-top': 'browser', 'eye-off': 'eye-slash', 'x-circle': 'x-circle',
  'smartphone': 'device-mobile', 'video': 'video-camera', 'zap': 'lightning',
  'sparkles': 'sparkle', 'equal': 'equals', 'key-round': 'key',
  'bell-off': 'bell-slash', 'bell-ring': 'bell-ringing', 'power': 'power',

  // Personas
  'user-round': 'user', 'users-round': 'users', 'user-cog': 'user-gear',
  'user-check': 'user-check', 'contact': 'address-book',
  'log-in': 'sign-in', 'log-out': 'sign-out',

  // Comunicacion  (el logo real de WhatsApp, con el auricular)
  'message-circle': 'whatsapp-logo', 'message-square': 'chat',
  'bot-message-square': 'chat-teardrop-dots', 'bot': 'robot',
  'mail': 'envelope', 'facebook': 'facebook-logo', 'instagram': 'instagram-logo',
  'youtube': 'youtube-logo', 'megaphone': 'megaphone',

  // Negocio / restaurante
  'flame': 'fire', 'store': 'storefront', 'building-2': 'buildings', 'hotel': 'buildings',
  'utensils-crossed': 'fork-knife', 'utensils': 'bowl-food', 'salad': 'bowl-food',
  'chef-hat': 'chef-hat', 'croissant': 'bread', 'cake-slice': 'cake',
  'ice-cream-cone': 'ice-cream', 'beer': 'beer-stein', 'bike': 'bicycle',
  'dumbbell': 'barbell', 'bed-double': 'bed', 'flower-2': 'flower',
  // El par Si/No de «configuracion-inicial»: Phosphor no trae una caja tachada.
  'hand-platter': 'hand-arrow-up', 'package-check': 'package', 'package-x': 'x-circle',
  'book-open': 'book-open-text', 'bookmark': 'bookmark-simple', 'bookmark-plus': 'bookmarks',
  'archive-restore': 'archive-box', 'rocket': 'rocket-launch',
  'home': 'house', 'tags': 'tag-simple', 'car': 'car', 'truck': 'truck',
};

/**
 * Los identificadores que llevan un digito pegado (`Trash2`, `Grid3x3`) no vuelven a kebab sin
 * ambiguedad, asi que estos se resuelven por su nombre PascalCase tal cual.
 */
export const ALIAS_PASCAL = {
  ArchiveRestore: 'box-arrow-up',   // sacar del archivo
  BarChart3: 'chart-bar',
  Building2: 'buildings',
  CalendarCheck2: 'calendar-check',
  CheckCircle2: 'check-circle',
  ClipboardList: 'clipboard-text',
  Clock3: 'clock',
  FileCheck: 'certificate',         // Phosphor no trae file-check; es el consentimiento firmado
  FilePlus2: 'file-plus',
  Flower2: 'flower',
  Grid3x3: 'grid-nine',
  Link2: 'link',
  Loader2: 'spinner-gap',
  Sandwich: 'hamburger',            // Phosphor no trae sandwich
  Share2: 'share-network',
  Trash2: 'trash',
  Undo2: 'arrow-u-up-left',
};

// PascalCase -> kebab-case, igual que hace lucide-angular al revés
export const aKebab = (s) => s
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
  .toLowerCase();

export const candidatos = (pascal) => {
  const k = aKebab(pascal);
  const out = [];
  if (ALIAS_PASCAL[pascal]) out.push(ALIAS_PASCAL[pascal]);
  if (ALIAS[k]) out.push(ALIAS[k]);
  out.push(k);
  out.push(k.replace(/-(\d+)$/, ''));          // trash-2 -> trash
  out.push(k.replace(/^(.*)-(\d+)$/, '$1'));
  if (k.endsWith('s')) out.push(k.slice(0, -1));
  else out.push(k + 's');
  return [...new Set(out.filter(Boolean))];
};

if (process.argv[1].endsWith('mapa.mjs')) {
  const inv = JSON.parse(fs.readFileSync(AQUI + '/inventario.json', 'utf8'));
  // identificadores + los tres nombres huerfanos de plantilla
  const pascal = (s) => s.replace(/(\w)([a-z0-9]*)(_|-|\s*)/g, (a, b, c) => b.toUpperCase() + c.toLowerCase());
  const claves = new Set(inv.union);
  for (const n of ['hand-platter', 'package-x']) claves.add(pascal(n));

  const todos = new Set();
  for (const c of claves) candidatos(c).forEach((x) => todos.add(x));

  // pide a Iconify, en pesos regular y fill
  const nombres = [...todos];
  const pedir = async (lista) => {
    const r = await fetch('https://api.iconify.design/ph.json?icons=' + lista.join(','));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  };
  const icons = {};
  for (let i = 0; i < nombres.length; i += 50) {
    const j = await pedir(nombres.slice(i, i + 50));
    Object.assign(icons, j.icons || {});
  }

  const mapa = {}; const faltan = [];
  for (const c of [...claves].sort()) {
    const hit = candidatos(c).find((n) => icons[n]);
    if (hit) mapa[c] = hit; else faltan.push(c + '  (probado: ' + candidatos(c).join(', ') + ')');
  }

  fs.writeFileSync(AQUI + '/mapa.json', JSON.stringify({ mapa, faltan }, null, 2));
  console.error('Resueltos ' + Object.keys(mapa).length + ' de ' + claves.size);
  console.error('\nFALTAN ' + faltan.length + ':\n' + faltan.join('\n'));
}
