export interface ChildItem {
  id?: number | string;
  name: string;
  icon?: LucideIcon;
  items?: ChildItem[];
  item?: unknown;
  url?: string;
  color?: string;
  disabled?: boolean;
  subtitle?: string;
  badge?: boolean;
  badgeType?: string;
  badgeContent?: string;
  isActive?: boolean;
  external?: boolean;
  isPro?: boolean
}

export interface MenuItem {
  heading?: string;
  name?: string;
  icon?: LucideIcon;
  id?: number;
  to?: string;
  item?: MenuItem[];
  items?: ChildItem[];
  url?: string;
  disabled?: boolean;
  subtitle?: string;
  badgeType?: string;
  badge?: boolean;
  badgeContent?: string;
  isActive?: boolean;
  isPro?: boolean
}

import { uniqueId } from "lodash";

import {
  LayoutDashboard,
  Users,
  PenTool,
  FileText,
  Ticket,
  Link as LinkIcon,
  CalendarDays,
  Tag,
  CheckSquare,
  ShoppingCart,
  CreditCard,
  MessageSquare,
  Dumbbell,
  UtensilsCrossed,
  ListChecks,
  ClipboardCheck,
  BarChart3,
  LayoutGrid,
  FolderOpen,
  Quote,
  Image,
  Calendar,
  Package,
  Bell,
  Globe,
  Shield,
  Settings,
  Smartphone,
  UserCog,
  UserPlus,
  Flame,
  Trophy,
  SlidersHorizontal,
  ArrowLeftRight,
  History,
  LucideIcon,
} from "lucide-react"

const SidebarContent: MenuItem[] = [
  {
    heading: "Principal",
    items: [
      {
        id: uniqueId(),
        name: "Panel de control",
        icon: LayoutDashboard,
        url: "/dashboard",
      },
      {
        id: uniqueId(),
        name: "Informes",
        icon: BarChart3,
        url: "/reports",
      },
      {
        id: uniqueId(),
        name: "Clientes",
        icon: Users,
        url: "/users",
      },
      {
        id: uniqueId(),
        name: "Invitaciones de clientes",
        icon: UserPlus,
        url: "/client-invites",
      },
      {
        id: uniqueId(),
        name: "Onboarding",
        icon: ClipboardCheck,
        url: "/onboarding",
      },
    ],
  },
  {
    heading: "Coaching",
    items: [
      {
        id: uniqueId(),
        name: "Asignaciones",
        icon: LinkIcon,
        items: [
          { id: uniqueId(), name: "Asignar dieta", url: "/assign-diets" },
          { id: uniqueId(), name: "Asignar entrenamiento", url: "/assign-workouts" },
        ],
      },
      {
        id: uniqueId(),
        name: "Calendario del cliente",
        icon: CalendarDays,
        url: "/client-calendar",
      },
      {
        id: uniqueId(),
        name: "Calendario de comidas",
        icon: UtensilsCrossed,
        url: "/client-meal-calendar",
      },
      {
        id: uniqueId(),
        name: "Plantillas de plan de comidas",
        icon: ListChecks,
        url: "/meal-plan-templates",
      },
      {
        id: uniqueId(),
        name: "Etiquetas de clientes",
        icon: Tag,
        url: "/client-tags",
      },
      {
        id: uniqueId(),
        name: "Formularios y check-ins",
        icon: ClipboardCheck,
        url: "/forms-checkins",
      },
      {
        id: uniqueId(),
        name: "Métricas",
        icon: BarChart3,
        url: "/metrics",
      },
      {
        id: uniqueId(),
        name: "Hábitos",
        icon: Flame,
        url: "/habits",
      },
      {
        id: uniqueId(),
        name: "Retos",
        icon: Trophy,
        url: "/challenges",
      },
      {
        id: uniqueId(),
        name: "Recursos",
        icon: FolderOpen,
        url: "/resources",
      },
      {
        id: uniqueId(),
        name: "Reglas de progresión",
        icon: SlidersHorizontal,
        url: "/progression-rules",
      },
      {
        id: uniqueId(),
        name: "Sustituciones de ejercicio",
        icon: ArrowLeftRight,
        url: "/exercise-substitutions",
      },
      {
        id: uniqueId(),
        name: "Decisiones del motor",
        icon: History,
        url: "/progression-decisions",
      },
    ],
  },
  {
    heading: "Biblioteca",
    items: [
      {
        id: uniqueId(),
        name: "Entrenamiento",
        icon: Dumbbell,
        items: [
          { id: uniqueId(), name: "Ejercicios", url: "/exercises" },
          { id: uniqueId(), name: "Entrenamientos", url: "/workouts" },
          { id: uniqueId(), name: "Plantillas de entrenamiento", url: "/workout-templates" },
          { id: uniqueId(), name: "Secciones", url: "/section-templates" },
          { id: uniqueId(), name: "Programas de entrenamiento", url: "/training-programs" },
          { id: uniqueId(), name: "Partes del cuerpo", url: "/body-parts" },
          { id: uniqueId(), name: "Equipamiento", url: "/equipment" },
          { id: uniqueId(), name: "Niveles", url: "/levels" },
          { id: uniqueId(), name: "Categorías", url: "/categories" },
          { id: uniqueId(), name: "Tipos de entrenamiento", url: "/workout-types" },
          { id: uniqueId(), name: "Etiquetas", url: "/tags" },
        ],
      },
      {
        id: uniqueId(),
        name: "Nutrición",
        icon: UtensilsCrossed,
        items: [
          { id: uniqueId(), name: "Dietas", url: "/diets" },
          { id: uniqueId(), name: "Elementos de comidas", url: "/diet-meal-items" },
          { id: uniqueId(), name: "Categorías de dietas", url: "/diet-categories" },
          { id: uniqueId(), name: "Recetas", url: "/recipes" },
          { id: uniqueId(), name: "Categorías de recetas", url: "/recipe-categories" },
          { id: uniqueId(), name: "Etiquetas de recetas", url: "/recipe-tags" },
          { id: uniqueId(), name: "Ingredientes", url: "/ingredients" },
          { id: uniqueId(), name: "Categorías de ingredientes", url: "/ingredient-categories" },
          { id: uniqueId(), name: "Unidades de medida", url: "/measurement-units" },
          { id: uniqueId(), name: "Conversiones de unidades", url: "/unit-conversions" },
        ],
      },
      {
        id: uniqueId(),
        name: "Horarios de clases",
        icon: Calendar,
        url: "/class-schedules",
      },
    ],
  },
  {
    heading: "Comercio",
    items: [
      {
        id: uniqueId(),
        name: "Productos",
        icon: Package,
        items: [
          { id: uniqueId(), name: "Productos", url: "/products" },
          { id: uniqueId(), name: "Categorías de productos", url: "/product-categories" },
        ],
      },
      {
        id: uniqueId(),
        name: "Planes",
        icon: ShoppingCart,
        url: "/plans",
      },
      {
        id: uniqueId(),
        name: "Suscripciones",
        icon: CreditCard,
        url: "/subscriptions",
      },
      {
        id: uniqueId(),
        name: "Comunidad",
        icon: MessageSquare,
        items: [
          { id: uniqueId(), name: "Publicaciones", url: "/postings" },
          { id: uniqueId(), name: "Publicaciones reportadas", url: "/reported-postings" },
          { id: uniqueId(), name: "Feedback de la app", url: "/app-feedback" },
        ],
      },
      {
        id: uniqueId(),
        name: "Tareas",
        icon: CheckSquare,
        url: "/tasks",
      },
    ],
  },
  {
    heading: "Contenido",
    items: [
      {
        id: uniqueId(),
        name: "Entradas de blog",
        icon: FileText,
        url: "/posts",
      },
      {
        id: uniqueId(),
        name: "Categorías de blog",
        icon: FileText,
        url: "/apps/blog/categories",
      },
      {
        id: uniqueId(),
        name: "Frases",
        icon: Quote,
        url: "/quotes",
      },
      {
        id: uniqueId(),
        name: "Banners deslizantes",
        icon: Image,
        url: "/banner-sliders",
      },
      {
        id: uniqueId(),
        name: "Notificaciones push",
        icon: Bell,
        url: "/push-notifications",
      },
    ],
  },
  {
    heading: "Aplicaciones",
    items: [
      {
        id: uniqueId(),
        name: "Blog",
        icon: PenTool,
        url: "/apps/blog/manage-blog",
      },
      {
        id: uniqueId(),
        name: "Notas",
        icon: FileText,
        url: "/apps/notes",
      },
      {
        id: uniqueId(),
        name: "Tickets",
        icon: Ticket,
        url: "/apps/tickets",
      },
      {
        id: uniqueId(),
        name: "Perfil",
        icon: UserCog,
        url: "/pages/user-profile",
      },
      {
        id: uniqueId(),
        name: "Iconos",
        icon: LayoutGrid,
        url: "/icons/iconify",
      },
    ],
  },
  {
    heading: "Configuración",
    items: [
      {
        id: uniqueId(),
        name: "Ajustes",
        icon: Settings,
        url: "/settings",
      },
      {
        id: uniqueId(),
        name: "Ajustes de la aplicación",
        icon: Smartphone,
        url: "/app-settings",
      },
      {
        id: uniqueId(),
        name: "Seguridad",
        icon: Shield,
        items: [
          { id: uniqueId(), name: "Roles", url: "/roles" },
          { id: uniqueId(), name: "Permisos", url: "/permissions" },
          { id: uniqueId(), name: "Subadministradores", url: "/sub-admins" },
          { id: uniqueId(), name: "Historial de inicio de sesión", url: "/admin-login-history" },
          { id: uniqueId(), name: "Dispositivos de inicio de sesión", url: "/admin-login-devices" },
          { id: uniqueId(), name: "Registro de auditoría", url: "/audit-log" },
          { id: uniqueId(), name: "Autenticación 2FA", url: "/two-factor" },
        ],
      },
      {
        id: uniqueId(),
        name: "Idiomas",
        icon: Globe,
        items: [
          { id: uniqueId(), name: "Idiomas", url: "/languages" },
          { id: uniqueId(), name: "Palabras clave", url: "/language-keywords" },
          { id: uniqueId(), name: "Palabras clave predeterminadas", url: "/default-keywords" },
          { id: uniqueId(), name: "Pantallas", url: "/screens" },
        ],
      },
    ],
  },
];

export default SidebarContent;
