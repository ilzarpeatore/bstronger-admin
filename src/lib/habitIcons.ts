import {
  Droplet, Footprints, Bed, Leaf, BookOpen, Dumbbell, Bike, Apple, Sun, Coffee,
  Timer, Flame, Smile, Smartphone, Users, Stethoscope, Activity, Utensils,
  PenLine, Home, Moon, Heart, Snowflake, type LucideIcon,
} from 'lucide-react'

/**
 * Set de iconos de hábitos compartido conceptualmente con la app móvil
 * (constants/habitIcons.ts) — misma `key` semántica en ambos lados, cada
 * lado la traduce a su propia librería de iconos (lucide-react aquí,
 * Ionicons en la app). No se guarda un nombre de icono de una librería
 * concreta en el backend para no acoplar el dato a una sola plataforma.
 */
export type HabitIconKey =
  | 'water' | 'steps' | 'sleep' | 'meditate' | 'read' | 'workout' | 'bike'
  | 'nutrition' | 'sun' | 'coffee' | 'timer' | 'fire' | 'mood' | 'phone'
  | 'social' | 'health' | 'fitness' | 'meal' | 'journal' | 'home' | 'moon' | 'heart' | 'cold'

export const HABIT_ICONS: { key: HabitIconKey; label: string; icon: LucideIcon }[] = [
  { key: 'water', label: 'Beber agua', icon: Droplet },
  { key: 'steps', label: 'Pasos diarios', icon: Footprints },
  { key: 'sleep', label: 'Dormir', icon: Bed },
  { key: 'meditate', label: 'Meditar', icon: Leaf },
  { key: 'read', label: 'Leer', icon: BookOpen },
  { key: 'workout', label: 'Entrenar', icon: Dumbbell },
  { key: 'bike', label: 'Ciclismo', icon: Bike },
  { key: 'nutrition', label: 'Comer sano', icon: Apple },
  { key: 'sun', label: 'Aire libre', icon: Sun },
  { key: 'coffee', label: 'Sin cafeína/alcohol', icon: Coffee },
  { key: 'timer', label: 'Tiempo enfocado', icon: Timer },
  { key: 'fire', label: 'Constancia', icon: Flame },
  { key: 'mood', label: 'Gratitud', icon: Smile },
  { key: 'phone', label: 'Desconexión digital', icon: Smartphone },
  { key: 'social', label: 'Vida social', icon: Users },
  { key: 'health', label: 'Vitaminas / salud', icon: Stethoscope },
  { key: 'fitness', label: 'Actividad física', icon: Activity },
  { key: 'meal', label: 'Comidas', icon: Utensils },
  { key: 'journal', label: 'Diario', icon: PenLine },
  { key: 'home', label: 'Rutina en casa', icon: Home },
  { key: 'moon', label: 'Rutina nocturna', icon: Moon },
  { key: 'heart', label: 'Bienestar', icon: Heart },
  { key: 'cold', label: 'Frío / baño de hielo', icon: Snowflake },
]

const ICON_MAP = new Map<string, LucideIcon>(HABIT_ICONS.map(i => [i.key, i.icon]))

export function habitIconFor(key: string | null | undefined): LucideIcon {
  return (key && ICON_MAP.get(key)) || Activity
}
