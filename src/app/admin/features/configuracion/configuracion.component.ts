import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule, LUCIDE_ICONS, LucideIconProvider,
  User, Lock, Building2, ChevronLeft, Save, Eye, EyeOff,
  CreditCard, Calendar, CheckCircle, XCircle, AlertCircle,
} from 'lucide-angular';

import { AuthService } from '../../../auth/data-access/auth.service';
import { NegocioPlanInfo } from '../../../auth/models/auth.models';

type Section = 'personal' | 'password' | 'negocios';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FormsModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        User, Lock, Building2, ChevronLeft, Save, Eye, EyeOff,
        CreditCard, Calendar, CheckCircle, XCircle, AlertCircle,
      }),
    },
  ],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.scss',
})
export class ConfiguracionComponent implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;

  // ── Sección activa ──────────────────────────────────────────
  readonly activeSection = signal<Section>('personal');

  // ── Info personal ───────────────────────────────────────────
  readonly personalForm = signal({
    primer_nombre:    '',
    segundo_nombre:   '',
    primer_apellido:  '',
    segundo_apellido: '',
    num_identificacion: '',
  });
  readonly email        = computed(() => this.user()?.email ?? '');
  readonly savingPerfil = signal(false);
  readonly perfilMsg    = signal<{ ok: boolean; text: string } | null>(null);

  // ── Cambio de contraseña ────────────────────────────────────
  readonly pwForm = signal({ currentPassword: '', newPassword: '', confirmPassword: '' });
  readonly showCurrent = signal(false);
  readonly showNew     = signal(false);
  readonly savingPw    = signal(false);
  readonly pwMsg       = signal<{ ok: boolean; text: string } | null>(null);

  // ── Negocios / planes ───────────────────────────────────────
  readonly negocios         = signal<NegocioPlanInfo[]>([]);
  readonly loadingNegocios  = signal(false);
  readonly negociosError    = signal<string | null>(null);

  // ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const u = this.user();
    if (u) {
      this.personalForm.set({
        primer_nombre:    u.primer_nombre ?? '',
        segundo_nombre:   u.segundo_nombre ?? '',
        primer_apellido:  u.primer_apellido ?? '',
        segundo_apellido: u.segundo_apellido ?? '',
        num_identificacion: u.num_identificacion ?? '',
      });
    }
  }

  setSection(s: Section): void {
    this.activeSection.set(s);
    if (s === 'negocios' && this.negocios().length === 0) this.loadNegocios();
  }

  goBack(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  // ── Guardar perfil ──────────────────────────────────────────
  savePerfil(): void {
    const f = this.personalForm();
    if (!f.primer_nombre.trim() || !f.primer_apellido.trim() || !f.num_identificacion.trim()) {
      this.perfilMsg.set({ ok: false, text: 'Completa los campos obligatorios.' });
      return;
    }
    this.savingPerfil.set(true);
    this.perfilMsg.set(null);
    this.auth.updatePerfil({
      primer_nombre:    f.primer_nombre.trim(),
      segundo_nombre:   f.segundo_nombre.trim() || null,
      primer_apellido:  f.primer_apellido.trim(),
      segundo_apellido: f.segundo_apellido.trim() || null,
      num_identificacion: f.num_identificacion.trim(),
    }).subscribe({
      next: () => {
        this.savingPerfil.set(false);
        this.perfilMsg.set({ ok: true, text: 'Información actualizada correctamente.' });
      },
      error: (err) => {
        this.savingPerfil.set(false);
        this.perfilMsg.set({ ok: false, text: err?.error?.message ?? 'Error al actualizar.' });
      },
    });
  }

  // ── Cambiar contraseña ──────────────────────────────────────
  changePw(): void {
    const f = this.pwForm();
    if (!f.currentPassword || !f.newPassword || !f.confirmPassword) {
      this.pwMsg.set({ ok: false, text: 'Completa todos los campos.' });
      return;
    }
    if (f.newPassword !== f.confirmPassword) {
      this.pwMsg.set({ ok: false, text: 'Las contraseñas nuevas no coinciden.' });
      return;
    }
    if (f.newPassword.length < 8) {
      this.pwMsg.set({ ok: false, text: 'La nueva contraseña debe tener mínimo 8 caracteres.' });
      return;
    }
    this.savingPw.set(true);
    this.pwMsg.set(null);
    this.auth.changePassword({ currentPassword: f.currentPassword, newPassword: f.newPassword })
      .subscribe({
        next: () => {
          this.savingPw.set(false);
          this.pwMsg.set({ ok: true, text: 'Contraseña cambiada correctamente.' });
          this.pwForm.set({ currentPassword: '', newPassword: '', confirmPassword: '' });
        },
        error: (err) => {
          this.savingPw.set(false);
          this.pwMsg.set({ ok: false, text: err?.error?.message ?? 'Error al cambiar la contraseña.' });
        },
      });
  }

  updatePersonalField(field: keyof ReturnType<typeof this.personalForm>, value: string): void {
    this.personalForm.update((f) => ({ ...f, [field]: value }));
  }

  updatePwField(field: keyof ReturnType<typeof this.pwForm>, value: string): void {
    this.pwForm.update((f) => ({ ...f, [field]: value }));
  }

  planStatus(plan: NegocioPlanInfo['plan']): 'vigente' | 'proximo' | 'vencido' | 'sin-plan' {
    if (!plan) return 'sin-plan';
    if (!plan.vigente) return 'vencido';
    if (plan.dias_restantes !== null && plan.dias_restantes <= 15) return 'proximo';
    return 'vigente';
  }

  formatDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatPrecio(precio: number, moneda: string): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(precio);
  }

  private loadNegocios(): void {
    this.loadingNegocios.set(true);
    this.negociosError.set(null);
    this.auth.getMisNegociosPlanInfo().subscribe({
      next: (data) => { this.negocios.set(data); this.loadingNegocios.set(false); },
      error: () => { this.negociosError.set('Error al cargar los negocios.'); this.loadingNegocios.set(false); },
    });
  }
}
