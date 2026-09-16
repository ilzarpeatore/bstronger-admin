// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import Loadable from '../layouts/full/shared/loadable/Loadable';
import RequireAuth from './RequireAuth';
import RequirePermission from './RequirePermission';
import { RouteError } from '../components/shared/RouteError';
import { PERMISSIONS } from '../constants/permissions';

/* ***Layouts**** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));

// mightyfitness auth
const Login = Loadable(lazy(() => import('../views/authentication/login')));

// mightyfitness dashboard
const Dashboard = Loadable(lazy(() => import('../views/dashboard')));

// mightyfitness users/security
const Users = Loadable(lazy(() => import('../views/users/UsersView')));
const PersonalClientInvites = Loadable(lazy(() => import('../views/users/PersonalClientInvitesView')));
const OnboardingList = Loadable(lazy(() => import('../views/users/OnboardingListView')));
const UserDetail = Loadable(lazy(() => import('../views/users/UserDetailPage')));
const SubAdmins = Loadable(lazy(() => import('../views/users/SubAdminView')));
const Permissions = Loadable(lazy(() => import('../views/security/PermissionsView')));
const Roles = Loadable(lazy(() => import('../views/security/RolesView')));
const LoginHistory = Loadable(lazy(() => import('../views/security/LoginHistoryView')));
const LoginDevices = Loadable(lazy(() => import('../views/security/LoginDevicesView')));
const AuditLog = Loadable(lazy(() => import('../views/security/AuditLogView')));
const TwoFactor = Loadable(lazy(() => import('../views/security/TwoFactorView')));

// mightyfitness fitness library
const Exercises = Loadable(lazy(() => import('../views/fitness/ExerciseView')));
const BodyParts = Loadable(lazy(() => import('../views/fitness/BodyPartView')));
const Equipment = Loadable(lazy(() => import('../views/fitness/EquipmentView')));
const Levels = Loadable(lazy(() => import('../views/fitness/LevelView')));
const Categories = Loadable(lazy(() => import('../views/fitness/CategoryView')));
const ClassSchedules = Loadable(lazy(() => import('../views/fitness/ClassScheduleView')));
const WorkoutTypes = Loadable(lazy(() => import('../views/fitness/WorkoutTypeView')));
const Workouts = Loadable(lazy(() => import('../views/fitness/WorkoutView')));
const Tags = Loadable(lazy(() => import('../views/fitness/TagsView')));

// mightyfitness diet/recipes
const Diets = Loadable(lazy(() => import('../views/diet/DietView')));
const DietMealItems = Loadable(lazy(() => import('../views/diet/DietMealItemsView')));
const DietCategories = Loadable(lazy(() => import('../views/diet/CategoryDietView')));
const Recipes = Loadable(lazy(() => import('../views/recipes/RecipeView')));
const RecipeCategories = Loadable(lazy(() => import('../views/recipes/RecipeCategoryView')));
const RecipeTags = Loadable(lazy(() => import('../views/recipes/RecipeTagView')));
const Ingredients = Loadable(lazy(() => import('../views/recipes/IngredientView')));
const IngredientCategories = Loadable(lazy(() => import('../views/recipes/IngredientCategoryView')));
const MeasurementUnits = Loadable(lazy(() => import('../views/recipes/MeasurementUnitView')));
const UnitConversions = Loadable(lazy(() => import('../views/recipes/UnitConversionView')));
const AssignDiets = Loadable(lazy(() => import('../views/assignments/AssignDietView')));

// mightyfitness commerce
const Products = Loadable(lazy(() => import('../views/commerce/ProductView')));
const ProductCategories = Loadable(lazy(() => import('../views/commerce/ProductCategoryView')));
const Plans = Loadable(lazy(() => import('../views/commerce/PackageView')));
const Subscriptions = Loadable(lazy(() => import('../views/commerce/SubscriptionView')));

// mightyfitness settings/tasks
const Settings = Loadable(lazy(() => import('../views/settings/SettingsView')));
const AppSettings = Loadable(lazy(() => import('../views/settings/AppSettingsView')));
const Tasks = Loadable(lazy(() => import('../views/tasks/TasksView')));

// mightyfitness coaching/community/assignments
const AssignWorkouts = Loadable(lazy(() => import('../views/assignments/AssignWorkoutView')));
const Informes = Loadable(lazy(() => import('../views/reports')));
const ClientCalendar = Loadable(lazy(() => import('../views/coaching/ClientCalendarView')));
const ClientMealCalendar = Loadable(lazy(() => import('../views/coaching/ClientMealCalendarView')));
const MealPlanTemplates = Loadable(lazy(() => import('../views/coaching/MealPlanTemplatesListView')));
const MealPlanTemplateDetail = Loadable(lazy(() => import('../views/coaching/MealPlanTemplateDetailPage')));
const ClientTags = Loadable(lazy(() => import('../views/coaching/ClientTagsView')));
const SectionTemplates = Loadable(lazy(() => import('../views/coaching/SectionsView')));
const WorkoutTemplates = Loadable(lazy(() => import('../views/coaching/WorkoutTemplatesView')));
const TrainingPrograms = Loadable(lazy(() => import('../views/coaching/TrainingProgramsView')));
const Resources = Loadable(lazy(() => import('../views/coaching/ResourcesView')));
const SessionDetail = Loadable(lazy(() => import('../views/coaching/SessionDetailView')));
const FormsCheckIns = Loadable(lazy(() => import('../views/forms/FormsCheckInsView')));
const Metrics = Loadable(lazy(() => import('../views/metrics/MetricsView')));
const Habits = Loadable(lazy(() => import('../views/coaching/HabitsView')));
const Challenges = Loadable(lazy(() => import('../views/coaching/ChallengesView')));
// Motor de Auto-Regulación de Carga -- estas dos vistas ya existían en el
// repo pero nunca se habían registrado en el router ni en el sidebar
// (ver CLAUDE.md/nota de la tarea). Se registran aquí junto con la nueva
// pantalla de sustituciones de ejercicio.
const ProgressionRules = Loadable(lazy(() => import('../views/coaching/ProgressionRulesView')));
const ExerciseSubstitutions = Loadable(lazy(() => import('../views/coaching/ExerciseSubstitutionsView')));
const ProgressionDecisions = Loadable(lazy(() => import('../views/coaching/ProgressionDecisionsView')));
// CoachExceptionsView.tsx tampoco estaba enrutada -- el botón "Ver todas
// las excepciones" de la campana de notificaciones (Notifications.tsx)
// enlazaba a /coach-exceptions sin que esa ruta existiera.
const CoachExceptions = Loadable(lazy(() => import('../views/coaching/CoachExceptionsView')));

// mightyfitness content
const Quotes = Loadable(lazy(() => import('../views/content/QuotesView')));
const BannerSliders = Loadable(lazy(() => import('../views/content/BannerSliderView')));
const PushNotifications = Loadable(lazy(() => import('../views/content/PushNotificationView')));
const Postings = Loadable(lazy(() => import('../views/community/PostingView')));
const ReportedPostings = Loadable(lazy(() => import('../views/community/ReportedPostingView')));
const ReportedComments = Loadable(lazy(() => import('../views/community/ReportedCommentView')));
const AppFeedback = Loadable(lazy(() => import('../views/community/AppFeedbackView')));
const Languages = Loadable(lazy(() => import('../views/languages/LanguageView')));
const LanguageKeywords = Loadable(lazy(() => import('../views/languages/LanguageKeywordView')));
const DefaultKeywords = Loadable(lazy(() => import('../views/pages-config/DefaultKeywordView')));
const Screens = Loadable(lazy(() => import('../views/pages-config/ScreenView')));


// dashboards

const ModernDashboard = Loadable(lazy(() => import('../views/dashboards/modern')));

const Error = Loadable(lazy(() => import('../views/auth/error')));

//apps
const Blog = Loadable(lazy(() => import('../views/apps/blog/post')));
const BlogDetail = Loadable(lazy(() => import('../views/apps/blog/detail')));
const BlogAdd = Loadable(lazy(() => import('../views/apps/blog/create')));
const BlogEdit = Loadable(lazy(() => import('../views/apps/blog/edit')));
const BlogTable = Loadable(lazy(() => import('../views/apps/blog/manage-blog')));
const BlogCategories = Loadable(lazy(() => import('../views/apps/blog/categories')));

const Notes = Loadable(lazy(() => import('../views/apps/notes')));

const Tickets = Loadable(lazy(() => import('../views/apps/tickets')));
const TicketCreate = Loadable(lazy(() => import('../views/apps/tickets/create')));

// pages
const TablesPage = Loadable(lazy(() => import('../views/pages/tables')));
const FormPage = Loadable(lazy(() => import('../views/pages/form')));
const UserProfilePage = Loadable(lazy(() => import('../views/pages/user-profile')));

//icons
const SolarIcon = Loadable(lazy(() => import('../views/icons/iconify')));

// heroui showcase
const HeroUIShowcase = Loadable(lazy(() => import('../views/ui/heroui-showcase')));

// authentication

const Login2 = Loadable(lazy(() => import('../views/auth/auth2/login')));

const Register2 = Loadable(lazy(() => import('../views/auth/auth2/register')));

const ForgotPassword2 = Loadable(lazy(() => import('../views/auth/auth2/forgot-password')));

const TwoSteps2 = Loadable(lazy(() => import('../views/auth/auth2/two-steps')));

const Maintainance = Loadable(lazy(() => import('../views/auth/maintenance')));

const Router = [
  {
    errorElement: <RouteError />,
    children: [
  {
    path: '/',
    element: (
      <RequireAuth>
        <FullLayout />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },

      { path: '/dashboard', element: <Dashboard /> },
      { path: '/users', element: <Users /> },
      { path: '/client-invites', element: <PersonalClientInvites /> },
      { path: '/onboarding', element: <OnboardingList /> },
      { path: '/users/:id', element: <UserDetail /> },
      { path: '/users/:id/:tab', element: <UserDetail /> },
      {
        path: '/sub-admins',
        element: (
          <RequirePermission permission={PERMISSIONS.SUB_ADMINS}>
            <SubAdmins />
          </RequirePermission>
        ),
      },
      {
        path: '/permissions',
        element: (
          <RequirePermission permission={PERMISSIONS.PERMISSIONS}>
            <Permissions />
          </RequirePermission>
        ),
      },
      {
        path: '/roles',
        element: (
          <RequirePermission permission={PERMISSIONS.ROLES}>
            <Roles />
          </RequirePermission>
        ),
      },
      { path: '/admin-login-history', element: <LoginHistory /> },
      { path: '/admin-login-devices', element: <LoginDevices /> },
      {
        path: '/audit-log',
        element: (
          <RequirePermission permission={PERMISSIONS.AUDIT_LOG}>
            <AuditLog />
          </RequirePermission>
        ),
      },
      { path: '/two-factor', element: <TwoFactor /> },

      { path: '/exercises', element: <Exercises /> },
      { path: '/body-parts', element: <BodyParts /> },
      { path: '/equipment', element: <Equipment /> },
      { path: '/levels', element: <Levels /> },
      { path: '/categories', element: <Categories /> },
      { path: '/class-schedules', element: <ClassSchedules /> },
      { path: '/workout-types', element: <WorkoutTypes /> },
      { path: '/workouts', element: <Workouts /> },
      { path: '/tags', element: <Tags /> },

      { path: '/diets', element: <Diets /> },
      { path: '/diet-meal-items', element: <DietMealItems /> },
      { path: '/diet-categories', element: <DietCategories /> },
      { path: '/recipes', element: <Recipes /> },
      { path: '/recipe-categories', element: <RecipeCategories /> },
      { path: '/recipe-tags', element: <RecipeTags /> },
      { path: '/ingredients', element: <Ingredients /> },
      { path: '/ingredient-categories', element: <IngredientCategories /> },
      { path: '/measurement-units', element: <MeasurementUnits /> },
      { path: '/unit-conversions', element: <UnitConversions /> },
      { path: '/assign-diets', element: <AssignDiets /> },

      { path: '/products', element: <Products /> },
      { path: '/product-categories', element: <ProductCategories /> },
      { path: '/plans', element: <Plans /> },
      { path: '/subscriptions', element: <Subscriptions /> },
      { path: '/revenue', element: <Navigate to="/subscriptions" replace /> },
      { path: '/transactions', element: <Navigate to="/subscriptions" replace /> },

      { path: '/assign-workouts', element: <AssignWorkouts /> },
      { path: '/client-calendar', element: <ClientCalendar /> },
      { path: '/client-meal-calendar', element: <ClientMealCalendar /> },
      { path: '/meal-plan-templates', element: <MealPlanTemplates /> },
      { path: '/meal-plan-templates/:id', element: <MealPlanTemplateDetail /> },
      { path: '/client-tags', element: <ClientTags /> },
      { path: '/section-templates', element: <SectionTemplates /> },
      { path: '/section-templates/:id', element: <SectionTemplates /> },
      { path: '/workout-templates', element: <WorkoutTemplates /> },
      { path: '/workout-templates/:id', element: <WorkoutTemplates /> },
      { path: '/training-programs', element: <TrainingPrograms /> },
      { path: '/training-programs/:id', element: <TrainingPrograms /> },
      { path: '/training-programs/:id/asignar-dia/:mode', element: <TrainingPrograms /> },
      { path: '/resources', element: <Resources /> },
      { path: '/session-detail', element: <SessionDetail /> },
      { path: '/forms-checkins', element: <FormsCheckIns /> },
      { path: '/forms-checkins/:tab', element: <FormsCheckIns /> },
      { path: '/metrics', element: <Metrics /> },
      { path: '/habits', element: <Habits /> },
      { path: '/habits/:tab', element: <Habits /> },
      { path: '/challenges', element: <Challenges /> },
      { path: '/progression-rules', element: <ProgressionRules /> },
      { path: '/exercise-substitutions', element: <ExerciseSubstitutions /> },
      { path: '/progression-decisions', element: <ProgressionDecisions /> },
      { path: '/coach-exceptions', element: <CoachExceptions /> },

      { path: '/settings', element: <Settings /> },
      { path: '/settings/:tab', element: <Settings /> },
      { path: '/app-settings', element: <AppSettings /> },
      { path: '/tasks', element: <Tasks /> },

      // /posts (CrudView genérico) solo exponía título/descripción/destacado/estado --
      // sin contenido, imagen ni bibliografía, aunque el backend y el editor de
      // /apps/blog/* ya los soportan por completo (misma API /admin/posts). En vez
      // de duplicar esa lógica (subida de imagen, etc.) dentro de CrudView, se
      // redirige al editor real.
      { path: '/posts', element: <Navigate to="/apps/blog/manage-blog" replace /> },
      { path: '/quotes', element: <Quotes /> },
      { path: '/banner-sliders', element: <BannerSliders /> },
      { path: '/push-notifications', element: <PushNotifications /> },
      { path: '/postings', element: <Postings /> },
      { path: '/reported-postings', element: <ReportedPostings /> },
      { path: '/reported-comments', element: <ReportedComments /> },
      { path: '/app-feedback', element: <AppFeedback /> },
      { path: '/languages', element: <Languages /> },
      { path: '/language-keywords', element: <LanguageKeywords /> },
      { path: '/default-keywords', element: <DefaultKeywords /> },
      { path: '/screens', element: <Screens /> },

      { path: '/dashboards/modern', element: <ModernDashboard /> },
      { path: '/reports', element: <Informes /> },

      { path: '/apps/blog/post', element: <Blog /> },
      { path: '/apps/blog/detail/:id', element: <BlogDetail /> },
      { path: '/apps/blog/create', element: <BlogAdd /> },
      { path: '/apps/blog/edit', element: <BlogEdit /> },
      { path: '/apps/blog/manage-blog', element: <BlogTable /> },
      { path: '/apps/blog/categories', element: <BlogCategories /> },

      { path: '/apps/notes', element: <Notes /> },

      { path: '/apps/tickets', element: <Tickets /> },
      { path: '/apps/tickets/create', element: <TicketCreate /> },

      { path: '/pages/tables', element: <TablesPage /> },
      { path: '/pages/form', element: <FormPage /> },
      { path: '/pages/user-profile', element: <UserProfilePage /> },

      { path: '/icons/iconify', element: <SolarIcon /> },

      { path: '/ui/heroui', element: <HeroUIShowcase /> },

    
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
  {
    path: '/',
    element: <BlankLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/auth/login', element: <Login /> },

      { path: '/auth/auth2/login', element: <Login2 /> },

      { path: '/auth/auth2/register', element: <Register2 /> },

      { path: '/auth/auth2/forgot-password', element: <ForgotPassword2 /> },

      { path: '/auth/auth2/two-steps', element: <TwoSteps2 /> },
      { path: '/auth/maintenance', element: <Maintainance /> },
      { path: '404', element: <Error /> },
      { path: '/auth/404', element: <Error /> },
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
    ],
  },
];

const router = createBrowserRouter(Router);

export default router;
