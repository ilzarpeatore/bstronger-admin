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
  isPro?: boolean;
  /** Permission key (see src/constants/permissions.ts) required to see this entry. */
  requiredPermission?: string
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
import { PERMISSIONS } from "@/constants/permissions";

import {
  LayoutDashboard,
  Users,
  PenTool,
  FileText,
  Link as LinkIcon,
  CalendarDays,
  Tag,
  CheckSquare,
  ShoppingCart,
  CreditCard,
  Gift,
  PackageOpen,
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
  AlertTriangle,
  TrendingUp,
  ShoppingBasket,
  Mail,
  Inbox,
  Activity,
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
        name: "Tareas",
        icon: CheckSquare,
        url: "/tasks",
      },
      {
        // Bandeja del chat cliente <-> entrenador. Cada coach ve solo los hilos
        // de sus clientes; el filtro lo hace el backend, no esta entrada.
        id: uniqueId(),
        name: "Chat",
        icon: MessageSquare,
        url: "/chat",
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
      {
        id: uniqueId(),
        name: "Panel de Excepciones",
        icon: AlertTriangle,
        url: "/coach-exceptions",
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
          { id: uniqueId(), name: "Plantillas de entrenamiento", url: "/workout-templates" },
          { id: uniqueId(), name: "Biblioteca Hyrox", url: "/hyrox-library" },
          { id: uniqueId(), name: "Programas de entrenamiento", url: "/training-programs" },
          { id: uniqueId(), name: "Macrociclos", url: "/macrociclos" },
          { id: uniqueId(), name: "Técnicas especiales", url: "/tecnicas-especiales" },
          {
            id: uniqueId(),
            name: "Contenido",
            items: [
              { id: uniqueId(), name: "Ejercicios", url: "/exercises" },
              { id: uniqueId(), name: "Entrenamientos", url: "/workouts" },
              { id: uniqueId(), name: "Secciones", url: "/section-templates" },
            ],
          },
          {
            id: uniqueId(),
            name: "Características",
            items: [
              { id: uniqueId(), name: "Partes del cuerpo", url: "/body-parts" },
              { id: uniqueId(), name: "Equipamiento", url: "/equipment" },
              { id: uniqueId(), name: "Niveles", url: "/levels" },
            ],
          },
          {
            id: uniqueId(),
            name: "Clasificación",
            items: [
              { id: uniqueId(), name: "Categorías", url: "/categories" },
              { id: uniqueId(), name: "Tipos de entrenamiento", url: "/workout-types" },
              { id: uniqueId(), name: "Etiquetas", url: "/tags" },
            ],
          },
        ],
      },
      {
        id: uniqueId(),
        name: "Nutrición",
        icon: UtensilsCrossed,
        items: [
          { id: uniqueId(), name: "Dietas", url: "/diets" },
          { id: uniqueId(), name: "Dietas (catálogo de la app)", url: "/legacy-diets" },
          { id: uniqueId(), name: "Recetas", url: "/recipes" },
          { id: uniqueId(), name: "Elementos de comidas", url: "/diet-meal-items" },
          {
            id: uniqueId(),
            name: "Ingredientes",
            items: [
              { id: uniqueId(), name: "Ingredientes", url: "/ingredients" },
              { id: uniqueId(), name: "Categorías de ingredientes", url: "/ingredient-categories" },
              { id: uniqueId(), name: "Unidades de medida", url: "/measurement-units" },
              { id: uniqueId(), name: "Conversiones de unidades", url: "/unit-conversions" },
            ],
          },
          {
            id: uniqueId(),
            name: "Clasificación",
            items: [
              { id: uniqueId(), name: "Categorías de dietas", url: "/diet-categories" },
              { id: uniqueId(), name: "Categorías de recetas", url: "/recipe-categories" },
              { id: uniqueId(), name: "Etiquetas de recetas", url: "/recipe-tags" },
            ],
          },
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
    heading: "Marketing",
    items: [
      {
        id: uniqueId(),
        name: "Analítica web",
        icon: TrendingUp,
        url: "/analytics",
      },
      {
        id: uniqueId(),
        name: "Cestas abandonadas",
        icon: ShoppingBasket,
        url: "/abandoned-carts",
      },
      {
        id: uniqueId(),
        name: "Newsletter",
        icon: Mail,
        url: "/newsletter",
      },
      {
        id: uniqueId(),
        name: "Mensajes de contacto",
        icon: Inbox,
        url: "/contact-messages",
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
        name: "Packs",
        icon: PackageOpen,
        url: "/packs",
      },
      {
        id: uniqueId(),
        name: "Compras de packs",
        icon: Gift,
        url: "/pack-purchases",
      },
      {
        id: uniqueId(),
        name: "Comunidad",
        icon: MessageSquare,
        items: [
          { id: uniqueId(), name: "Publicaciones", url: "/postings" },
          { id: uniqueId(), name: "Publicaciones reportadas", url: "/reported-postings" },
          { id: uniqueId(), name: "Comentarios reportados", url: "/reported-comments" },
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
        url: "/apps/blog/manage-blog",
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
        name: "Errores y uso de la app",
        icon: Activity,
        url: "/app-monitoring",
      },
      {
        id: uniqueId(),
        name: "Seguridad",
        icon: Shield,
        items: [
          { id: uniqueId(), name: "Roles", url: "/roles", requiredPermission: PERMISSIONS.ROLES },
          { id: uniqueId(), name: "Permisos", url: "/permissions", requiredPermission: PERMISSIONS.PERMISSIONS },
          { id: uniqueId(), name: "Subadministradores", url: "/sub-admins", requiredPermission: PERMISSIONS.SUB_ADMINS },
          { id: uniqueId(), name: "Historial de inicio de sesión", url: "/admin-login-history" },
          { id: uniqueId(), name: "Dispositivos de inicio de sesión", url: "/admin-login-devices" },
          { id: uniqueId(), name: "Registro de auditoría", url: "/audit-log", requiredPermission: PERMISSIONS.AUDIT_LOG },
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
