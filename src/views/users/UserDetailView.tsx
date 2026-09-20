
import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { ArrowLeftIcon, DumbbellIcon, UtensilsIcon, CalendarIcon, ActivityIcon, CameraIcon, BarChart3Icon, SettingsIcon, WatchIcon, VaultIcon, ClipboardCheckIcon, ClipboardListIcon, CheckSquareIcon, HeartIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, DownloadIcon, CopyIcon, SearchIcon, XIcon, FileTextIcon, UploadIcon, CheckCircleIcon, MessageSquareIcon, TrophyIcon, MoreVerticalIcon, HistoryIcon, TargetIcon, AlertTriangleIcon, ScaleIcon, PencilIcon, ExternalLinkIcon, ClockIcon, TrashIcon, FlameIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Rating } from '@/components/ui/rating'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { fetchExerciseBodyparts, primaryBodypart, getMuscleCatalogStats, fetchExerciseCatalogEntries, type MuscleCatalogStats, type CatalogEntry } from '@/lib/muscle-groups'
import { useNavigate } from 'react-router'
import WorkoutPreviewModal from '@/components/coaching/WorkoutPreviewModal'
import { SessionDetailModal } from '@/views/coaching/SessionDetailView'
import HabitDialog from '@/components/coaching/HabitDialog'
import HabitProgressPanel, { type HabitProgressItem } from '@/components/coaching/HabitProgressPanel'
import ClientMealCalendarView from '@/views/coaching/ClientMealCalendarView'
import { DetailSkeleton } from '@/components/shared/skeletons'
import CoachExceptionsCard from '@/components/dashboard/CoachExceptionsCard'

const BodyMetricChart = lazy(() => import('@/components/charts/body-metric-chart'))
const ExerciseHistoryChart = lazy(() => import('@/components/charts/exercise-history-chart'))
const TotalVolumeChart = lazy(() => import('@/components/charts/training-volume-charts').then(m => ({ default: m.TotalVolumeChart })))
const MuscleVolumeChart = lazy(() => import('@/components/charts/training-volume-charts').then(m => ({ default: m.MuscleVolumeChart })))
const MuscleVolumeOverTimeChart = lazy(() => import('@/components/charts/training-volume-charts').then(m => ({ default: m.MuscleVolumeOverTimeChart })))
const MuscleVolumeStackedChart = lazy(() => import('@/components/charts/training-volume-charts').then(m => ({ default: m.MuscleVolumeStackedChart })))
const MuscleVolumeCompareChart = lazy(() => import('@/components/charts/training-volume-charts').then(m => ({ default: m.MuscleVolumeCompareChart })))
const MuscleBodyHeatmap = lazy(() => import('@/components/charts/training-volume-charts').then(m => ({ default: m.MuscleBodyHeatmap })))
const ChartFallback = ({ height = 200 }: { height?: number }) => (
  <div style={{ height }} className='flex items-center justify-center'>
    <div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' />
  </div>
)

type UserDetail = {
  id: number; first_name: string; last_name: string; email: string; username: string
  phone_number: string | null; gender: string | null; status: string; profile_image: string | null
  created_at: string; last_active_at: string | null; weight?: number | null; height?: number | null; age?: number | null
  timezone?: string | null; user_profile?: { goal?: string | null; activity?: string | null; macro_type?: string | null } | null
  is_personal_client?: boolean
}
type Tag = { id: number; title: string; color: string }
type TemplateAssignment = { template_id: number; title: string; type: 'sequential' | 'weekday'; start_date: string; end_date: string; days_count: number }
type WorkoutAssignment = { id: number; workout_id?: number; workout?: { id: number; title: string } }
type PersonalRecord = { id: string | number; exercise_id: number; date: string; weight: number | null; reps: number | null; one_rm: number | null; exercise?: { title: string } }
type SessionReview = { id: number; date: string | null; workout_title: string | null; duration_seconds: number | null; volume_kg: number | null; calories_burned: number | null; difficulty_rating: number | null; comment: string | null }
type ExerciseNote = { id: number; date: string | null; exercise_title: string; notes: string; program_day_assignment_id?: number | null; workout_template_id?: number | null }
type ReadinessCheck = { id: number; date: string | null; sleep_quality: number | null; soreness_level: number | null; energy_level: number | null; stress_level: number | null }
type ReadinessScoreRow = { date: string; combined_score: number | null; band: string | null; acwr: number | null; hrv_z_score: number | null; sueno_z_score: number | null; subjetivo_score: number | null; calculated_at: string | null }
const READINESS_BAND_LABEL: Record<string, string> = { optimo: 'Óptimo', reducido: 'Reducido', bajo: 'Bajo', dato_insuficiente: 'Datos insuficientes' }
const READINESS_BAND_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = { optimo: 'default', reducido: 'secondary', bajo: 'destructive', dato_insuficiente: 'outline' }
type ClientFeatureSettings = Record<string, boolean>
const FEATURE_LABELS: Record<string, string> = { workout: 'Entrenamiento', nutrition: 'Nutrición', habits: 'Hábitos', forms: 'Formularios y check-ins', resources: 'Recursos', chatbot: 'Chatbot de IA', readiness_check: 'Chequeo diario de preparación (obligatorio antes de entrenar)' }
type FormQuestion = { id: number; question_text: string; type: string; options: string[] | null; max_files: number | null; metric_id: number | null; sync_type: string | null; allow_multiple: boolean; placeholder: string | null; scale_max: number; star_max: number; order: number; is_required: boolean; metric?: { id: number; key: string; label: string; unit: string | null } }
type FormAnswer = { id: number; form_submission_id: number; form_question_id: number; answer_value: string; question: FormQuestion }
type CheckInForm = { id: number; title: string; recurrence: string | null; description?: string; questions_count?: number }
type FormSubmission = { id: number; submitted_at: string; coach_feedback: string | null; answers: FormAnswer[]; form_assignment: { id: number; form_id: number; client_id: number; form: CheckInForm; client: any } }
type FormAssignmentItem = { id: number; form_id: number; client_id: number; active: boolean; created_at: string; submitted: boolean; submitted_at: string | null; latest_submission_id: number | null; form: CheckInForm & { questions?: FormQuestion[] } }
type ClientNote = { id: number; content: string; author?: { id: number; first_name: string; last_name: string }; created_at: string }
type ProgressPhoto = { id: number; url: string; name: string; created_at: string }
type CalendarWorkout = { assignment_id: number; id: number; title: string; program_title: string | null; is_personal: boolean; thumbnail?: string | null; exercise_count?: number; training_program_id?: number | null; date?: string }
type CalendarDay = { date: string; in_month: boolean; personal_week_number: number; workouts: CalendarWorkout[] }
type CompletedSession = { id: number; program_day_assignment_id: number | null; workout_template_id: number | null; title: string; thumbnail: string | null; date: string | null; duration_seconds: number | null; volume_kg: number | null; calories_burned: number | null; difficulty_rating: number | null; difficulty_label: string | null }
type WorkoutTemplate = { id: number; title: string }
type TrainingProgram = { id: number; title: string | null }

type ClientGoal = { id: number; client_id: number; title: string; description: string | null; type: string; target_value: number | null; current_value: number | null; unit: string | null; status: string; target_date: string | null; created_at: string }
type ClientLimitation = { id: number; client_id: number; type: string; title: string; description: string | null; status: string; date_reported: string | null; date_resolved: string | null; created_at: string }
type ClientBodyMetric = { id: number; client_id: number; metric_type: string; value: number; unit: string | null; recorded_at: string; notes: string | null; created_at: string }
type BodyMetricChart = { unit: string | null; data: { value: number; date: string; notes: string | null }[] }
type TaskItem = { id: number; author_id: number; client_id: number | null; title: string; description: string | null; due_date: string | null; priority: string; status: string; created_at: string; author?: { id: number; first_name: string; last_name: string }; client?: { id: number; first_name: string; last_name: string } | null }
type ResourceItem = { id: number; coach_id: number; title: string; type: string; content: string | null; external_url: string | null; scope: string; created_at: string; coach?: { id: number; first_name: string; last_name: string }; assigned_clients?: { id: number; first_name?: string; last_name?: string; email?: string }[] }
type ParQAnswers = { parq_heart_condition: boolean | null; parq_chest_pain_activity: boolean | null; parq_chest_pain_rest_last_month: boolean | null; parq_dizziness_balance: boolean | null; parq_bone_joint_problem: boolean | null; parq_bp_or_heart_medication: boolean | null; parq_reason_not_to_exercise: boolean | null; parq_fitness_level: number | null; parq_medical_history: string | null; parq_goals: string | null }
type TrainingQuestionnaireAnswers = { goal_type: string | null; activity_level: string | null; lifestyle_type: string | null; training_experience_months: number | null; training_days_per_week: number | null; session_duration_preference: string | null; training_mindset: string | null; previous_coaching: string | null; current_routine_style: string | null; weekly_split_preference: string | null; technique_level: number | null; realistic_goal: string | null }
type NutritionQuestionnaireAnswers = { allergies_intolerances: string | null; disliked_foods: string | null; liked_foods: string | null; current_meals_per_day: number | null; desired_meals_per_day: number | null; typical_day_meals: string | null; favorite_meats: string | null; favorite_fish: string | null; favorite_fruits_vegetables: string | null; favorite_combined_dishes: string | null }
type OnboardingDetail = { flagged_for_review: boolean; flagged_for_review_at: string | null; onboarding_completed: boolean; onboarding_completed_at: string | null; par_q: ParQAnswers | null; training_questionnaire: TrainingQuestionnaireAnswers | null; nutrition_questionnaire: NutritionQuestionnaireAnswers | null }

// Feed de logros (achievement_events) -- historial de hitos detectados por el
// motor de progresión que hoy no se ve en ningún sitio del panel.
type AchievementEventType =
  | 'pr_carga' | 'pr_reps' | 'racha_sesiones' | 'mesociclo_cerrado' | 'mejora_e1rm'
  | 'hito_compliance' | 'progreso_sesion' | 'mejor_marca_reciente' | 'mantiene_fuerza_en_deficit'
type AchievementEvent = {
  id: number; client_id: number; type: AchievementEventType; exercise_id: number | null
  value: number | null; previous_best: number | null; significancia_verificada: boolean
  shown_to_client: boolean; created_at: string; exercise: { id: number; title: string } | null
}
const ACHIEVEMENT_TYPE_LABELS: Record<AchievementEventType, string> = {
  pr_carga: 'Récord de carga',
  pr_reps: 'Récord de repeticiones',
  racha_sesiones: 'Racha de sesiones',
  mesociclo_cerrado: 'Mesociclo cerrado',
  mejora_e1rm: 'Mejora de e1RM',
  hito_compliance: 'Hito de cumplimiento',
  progreso_sesion: 'Progreso vs. sesión anterior',
  mejor_marca_reciente: 'Mejor marca reciente',
  mantiene_fuerza_en_deficit: 'Mantiene fuerza en déficit',
}

const CAL_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const GOAL_TYPES = [{ value: 'weight_loss', label: 'Pérdida de peso' }, { value: 'strength', label: 'Fuerza' }, { value: 'endurance', label: 'Resistencia' }, { value: 'flexibility', label: 'Flexibilidad' }, { value: 'body_comp', label: 'Composición corporal' }, { value: 'custom', label: 'Personalizado' }]
const LIMITATION_TYPES = [{ value: 'injury', label: 'Lesión' }, { value: 'limitation', label: 'Limitación' }, { value: 'medical_condition', label: 'Condición médica' }, { value: 'allergy', label: 'Alergia' }]
const DEFAULT_BODY_METRIC_TYPES = [{ value: 'weight', label: 'Peso', unit: 'kg' }, { value: 'body_fat', label: '% Grasa corporal', unit: '%' }, { value: 'muscle_mass', label: 'Masa muscular', unit: 'kg' }, { value: 'chest', label: 'Pecho', unit: 'cm' }, { value: 'waist', label: 'Cintura', unit: 'cm' }, { value: 'hips', label: 'Cadera', unit: 'cm' }]
const TASK_PRIORITIES = [{ value: 'low', label: 'Baja' }, { value: 'medium', label: 'Media' }, { value: 'high', label: 'Alta' }]
const RESOURCE_TYPES = [{ value: 'article', label: 'Artículo' }, { value: 'video', label: 'Vídeo' }, { value: 'link', label: 'Enlace' }, { value: 'doc', label: 'Documento' }]

function parseAnswerValue(raw: string): string | string[] | null {
  if (raw === null || raw === undefined || raw === '') return null
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.map(String) : String(parsed) } catch { return String(raw) }
}
function formatCheckInDate(dateStr: string | null): string {
  if (!dateStr) return '—'; return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function computeNextDue(assignment: FormAssignmentItem): string {
  const base = assignment.submitted_at || assignment.created_at; if (!base || !assignment.form.recurrence) return '—'
  const d = new Date(base); switch (assignment.form.recurrence) { case 'daily': d.setDate(d.getDate() + 1); break; case 'weekly': d.setDate(d.getDate() + 7); break; case 'monthly': d.setMonth(d.getMonth() + 1); break; default: return '—' }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function recurrenceLabel(recurrence: string | null): string { if (!recurrence) return 'Una vez'; return recurrence.charAt(0).toUpperCase() + recurrence.slice(1) }
function prettify(v: string | null | undefined): string { if (v === null || v === undefined || v === '') return '—'; return v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }
function yesNoBadge(v: boolean | null, warnOnYes = false) { if (v === null || v === undefined) return <span className='text-sm text-muted-foreground'>—</span>; return <Badge variant={v && warnOnYes ? 'destructive' : v ? 'default' : 'secondary'}>{v ? 'Sí' : 'No'}</Badge> }
function renderAnswer(question: FormQuestion, value: string | string[] | null) {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0) || value === '') return <p className='text-sm text-muted-foreground italic'>Sin respuesta</p>
  const type = question.type
  if (type === 'star_rating') { return <Rating value={Number(Array.isArray(value) ? value[0] : value) || 0} max={question.star_max || 5} readOnly size={20} variant='yellow' /> }
  if (type === 'scale') { const num = Number(Array.isArray(value) ? value[0] : value) || 0; const max = question.scale_max || 10; return (<div className='space-y-1'><div className='flex items-center gap-2 text-xs text-muted-foreground'><span>1</span><div className='flex-1 h-2 rounded-full bg-muted overflow-hidden'><div className='h-full bg-primary rounded-full' style={{ width: `${Math.min(100, Math.max(0, (num / max) * 100))}%` }} /></div><span>{max}</span></div><p className='text-sm font-medium'>{num}</p></div>) }
  if (type === 'yes_no') { const v = Array.isArray(value) ? value[0] : value; const yes = v === '1' || v === 'true' || v === 'yes' || v === 'Yes'; return <Badge variant={yes ? 'default' : 'secondary'}>{yes ? 'Sí' : 'No'}</Badge> }
  if (type === 'multiple_choice') { return <div className='flex flex-wrap gap-1.5'>{(Array.isArray(value) ? value : [value]).map((opt, i) => <Badge key={i} variant='outline'>{String(opt)}</Badge>)}</div> }
  if (type === 'metric') { const v = Array.isArray(value) ? value[0] : value; return <p className='text-sm font-medium'>{v}{question.metric?.unit ? ` ${question.metric.unit}` : ''}</p> }
  if (type === 'media' || type === 'progress_photos' || type === 'signature') { const urls = Array.isArray(value) ? value : [value]; return (<div className='flex flex-wrap gap-2'>{urls.map((url, i) => <a key={i} href={String(url)} target='_blank' rel='noopener noreferrer' className='size-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden hover:opacity-80'><img src={String(url)} alt='' className='w-full h-full object-cover' /></a>)}</div>) }
  if (type === 'date') { return <p className='text-sm'>{new Date(Array.isArray(value) ? value[0] : value).toLocaleDateString()}</p> }
  if (type === 'textarea') { return <p className='text-sm whitespace-pre-wrap'>{Array.isArray(value) ? value.join(', ') : value}</p> }
  return <p className='text-sm'>{Array.isArray(value) ? value.join(', ') : value}</p>
}
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'; const diff = Date.now() - new Date(dateStr).getTime(); const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora mismo'; if (mins < 60) return `Hace ${mins} min`; const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours} h`; return `Hace ${Math.floor(hours / 24)} d`
}
function daysUntil(dateStr: string | null): string {
  if (!dateStr) return 'Sin objetivo'; const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)} d de retraso`; if (diff === 0) return 'Hoy'; return `${diff} d restantes`
}

const TABS = [
  { value: 'overview', label: 'Resumen', icon: ActivityIcon },
  { value: 'onboarding', label: 'Onboarding', icon: ClipboardListIcon },
  { value: 'training', label: 'Entrenamiento', icon: DumbbellIcon },
  { value: 'checkins', label: 'Check-ins', icon: ClipboardCheckIcon },
  { value: 'nutrition', label: 'Nutrición', icon: UtensilsIcon },
  { value: 'tasks', label: 'Tareas', icon: CheckSquareIcon },
  { value: 'habits', label: 'Hábitos', icon: HeartIcon },
  { value: 'photos', label: 'Fotos', icon: CameraIcon },
  { value: 'metrics', label: 'Métricas', icon: BarChart3Icon },
  { value: 'resources', label: 'Recursos', icon: FileTextIcon },
  { value: 'wearable', label: 'Wearable', icon: WatchIcon },
  { value: 'vault', label: 'Vault', icon: VaultIcon },
  { value: 'settings', label: 'Ajustes', icon: SettingsIcon },
]

const TAB_SLUGS: Record<string, string> = {
  overview: 'resumen',
  onboarding: 'onboarding',
  training: 'entrenamiento',
  checkins: 'check-ins',
  nutrition: 'nutricion',
  tasks: 'tareas',
  habits: 'habitos',
  photos: 'fotos',
  metrics: 'metricas',
  resources: 'recursos',
  wearable: 'wearable',
  vault: 'vault',
  settings: 'ajustes',
}
const SLUG_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_SLUGS).map(([value, slug]) => [slug, value]),
)

function getMonthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1); const last = new Date(year, month, 0); const startDay = (first.getDay() + 6) % 7; const totalDays = last.getDate(); const cells: (string | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null); return cells
}
function getCalendarWeeks(year: number, month: number): (string | null)[][] { const cells = getMonthGrid(year, month); const weeks: (string | null)[][] = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7)); return weeks }

export default function UserDetailView({ userId, tab }: { userId: string; tab?: string }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [diets, setDiets] = useState<TemplateAssignment[]>([])
  const [workouts, setWorkouts] = useState<WorkoutAssignment[]>([])
  const [records, setRecords] = useState<PersonalRecord[]>([])
  const [selectedHistoryExerciseId, setSelectedHistoryExerciseId] = useState<number | null>(null)
  const [historySearch, setHistorySearch] = useState('')
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null)
  const [muscleSearch, setMuscleSearch] = useState('')
  const [hiddenMuscles, setHiddenMuscles] = useState<Record<string, boolean>>({})
  const [featureSettings, setFeatureSettings] = useState<ClientFeatureSettings>({})
  const [savingFeature, setSavingFeature] = useState<string | null>(null)
  const [personalClient, setPersonalClient] = useState(false)
  const [savingPersonalClient, setSavingPersonalClient] = useState(false)
  const [loading, setLoading] = useState(true)
  const mappedTab = tab ? SLUG_TO_TAB[tab] : undefined
  const activeTab = mappedTab && TABS.some(t => t.value === mappedTab) ? mappedTab : 'overview'
  const goToTab = (value: string) => navigate(`/users/${userId}/${TAB_SLUGS[value]}`)

  const [notes, setNotes] = useState<ClientNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoName, setPhotoName] = useState('')
  const [previewPhoto, setPreviewPhoto] = useState<ProgressPhoto | null>(null)
  const [checkinsTab, setCheckinsTab] = useState<'submissions' | 'assigned'>('submissions')
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null)
  const [submissionFormFilter, setSubmissionFormFilter] = useState<string>('all')
  const [feedbackText, setFeedbackText] = useState('')
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [assignedForms, setAssignedForms] = useState<FormAssignmentItem[]>([])
  const [assignedFormsLoading, setAssignedFormsLoading] = useState(false)
  const [availableForms, setAvailableForms] = useState<CheckInForm[]>([])
  const [assignFormDialogOpen, setAssignFormDialogOpen] = useState(false)
  const [assignFormId, setAssignFormId] = useState('')
  const [assigningForm, setAssigningForm] = useState(false)
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [calDays, setCalDays] = useState<CalendarDay[]>([])
  const [calLoading, setCalLoading] = useState(false)
  const [calViewMode, setCalViewMode] = useState<'month' | 'week'>('month')
  const [calWeekIndex, setCalWeekIndex] = useState(0)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignDate, setAssignDate] = useState('')
  const [assignTemplateId, setAssignTemplateId] = useState('')
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importProgramId, setImportProgramId] = useState('')
  const [importStartDate, setImportStartDate] = useState('')
  const [workoutTemplates, setWorkoutTemplates] = useState<WorkoutTemplate[]>([])
  const [trainingPrograms, setTrainingPrograms] = useState<TrainingProgram[]>([])
  const [calClipboard, setCalClipboard] = useState<{ assignment_id: number; workout_title: string } | null>(null)
  const [calDraggedId, setCalDraggedId] = useState<number | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTemplateId, setPreviewTemplateId] = useState<number>(0)
  const [trainingSubTab, setTrainingSubTab] = useState<'calendar' | 'history' | 'completed' | 'feedback' | 'volume' | 'adherence'>('calendar')
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([])
  const [completedSessionsLoading, setCompletedSessionsLoading] = useState(false)
  const [selectedCompletedSession, setSelectedCompletedSession] = useState<CompletedSession | null>(null)
  const [sessionReviews, setSessionReviews] = useState<SessionReview[]>([])
  const [exerciseNotes, setExerciseNotes] = useState<ExerciseNote[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [readinessChecks, setReadinessChecks] = useState<ReadinessCheck[]>([])
  const [readinessLoading, setReadinessLoading] = useState(false)
  type AdherenceProgram = { mode: 'program'; scheduledCount: number; completedCount: number; ratio: number | null; currentStreak: number; periodDays: number; days: { date: string; completed: boolean }[] }
  type AdherenceFreeform = { mode: 'freeform'; sessionsCount: number; daysActive: number; currentStreak: number; periodDays: number }
  const [adherence, setAdherence] = useState<AdherenceProgram | AdherenceFreeform | null>(null)
  const [adherenceLoading, setAdherenceLoading] = useState(false)
  const [bodyparts, setBodyparts] = useState<Map<number, string[]>>(new Map())
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([])
  const [volumeLoading, setVolumeLoading] = useState(false)
  const [muscleStats, setMuscleStats] = useState<MuscleCatalogStats | null>(null)
  const [multiplierEnabled, setMultiplierEnabled] = useState(true)
  const [showCatalogDiagnostic, setShowCatalogDiagnostic] = useState(false)
  const [volumeWindow, setVolumeWindow] = useState<'all' | 'week' | 'month' | 'quarter' | 'semester' | 'custom'>('all')
  const [customMonths, setCustomMonths] = useState(6)
  const [compareMuscles, setCompareMuscles] = useState<string[]>([])
  const compareInitialized = useRef(false)
  const [nutritionSubTab, setNutritionSubTab] = useState<'calendar' | 'diets' | 'info'>('calendar')
  const [assignDietDialogOpen, setAssignDietDialogOpen] = useState(false)
  const [assignDietId, setAssignDietId] = useState('')
  const [assignDietStartDate, setAssignDietStartDate] = useState('')
  const [assignDietWeeks, setAssignDietWeeks] = useState('1')
  const [dietOptions, setDietOptions] = useState<{ id: number; title: string; type: 'sequential' | 'weekday' }[]>([])
  const [assigningDiet, setAssigningDiet] = useState(false)

  const [goals, setGoals] = useState<ClientGoal[]>([])
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [goalForm, setGoalForm] = useState({ title: '', description: '', type: 'custom', target_value: '', current_value: '', unit: '', target_date: '' })
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null)
  const [limitations, setLimitations] = useState<ClientLimitation[]>([])
  const [limitationsLoading, setLimitationsLoading] = useState(false)
  const [limitationDialogOpen, setLimitationDialogOpen] = useState(false)
  const [limitationForm, setLimitationForm] = useState({ type: 'limitation', title: '', description: '', status: 'active', date_reported: '' })
  const [editingLimitationId, setEditingLimitationId] = useState<number | null>(null)
  const [readinessScores, setReadinessScores] = useState<ReadinessScoreRow[]>([])
  const [readinessScoresLoading, setReadinessScoresLoading] = useState(false)
  const [achievementEvents, setAchievementEvents] = useState<AchievementEvent[]>([])
  const [achievementEventsLoading, setAchievementEventsLoading] = useState(false)
  const [bodyMetrics, setBodyMetrics] = useState<ClientBodyMetric[]>([])
  const [bodyMetricsChart, setBodyMetricsChart] = useState<Record<string, BodyMetricChart>>({})
  const [bodyMetricsLoading, setBodyMetricsLoading] = useState(false)
  const [metricDialogOpen, setMetricDialogOpen] = useState(false)
  const [metricForm, setMetricForm] = useState({ metric_type: 'weight', value: '', unit: 'kg', recorded_at: new Date().toISOString().split('T')[0], notes: '' })
  const [selectedMetricType, setSelectedMetricType] = useState('weight')
  type BodyMetricTypeDef = { value: string; label: string; unit: string; scope?: 'global' | 'client'; client_id?: number | null }
  const [bodyMetricTypes, setBodyMetricTypes] = useState<BodyMetricTypeDef[]>(DEFAULT_BODY_METRIC_TYPES)
  const [typeDialogOpen, setTypeDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<BodyMetricTypeDef | null>(null)
  const [typeForm, setTypeForm] = useState({ value: '', label: '', unit: '', scope: 'global' as 'global' | 'client' })
  const [savingType, setSavingType] = useState(false)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', due_date: '' })
  const [taskStatusFilter, setTaskStatusFilter] = useState('all')
  const [taskSearch, setTaskSearch] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false)
  const [resourceForm, setResourceForm] = useState({ title: '', type: 'article', scope: 'shared', content: '', external_url: '' })
  const [resourceTypeFilter, setResourceTypeFilter] = useState('all')
  const [editingResourceId, setEditingResourceId] = useState<number | null>(null)
  const [assignableResources, setAssignableResources] = useState<ResourceItem[]>([])
  const [assignResourceId, setAssignResourceId] = useState('')
  const [assigningResource, setAssigningResource] = useState(false)
  const [onboarding, setOnboarding] = useState<OnboardingDetail | null>(null)
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [trainingExpDialogOpen, setTrainingExpDialogOpen] = useState(false)
  const [trainingExpForm, setTrainingExpForm] = useState({ training_experience_months: '', technique_level: '' })
  const [savingTrainingExp, setSavingTrainingExp] = useState(false)
  const [habitProgress, setHabitProgress] = useState<HabitProgressItem[]>([])
  const [habitProgressLoading, setHabitProgressLoading] = useState(false)
  const [habitDialogOpen, setHabitDialogOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<HabitProgressItem | null>(null)
  const [deleteHabitDialogOpen, setDeleteHabitDialogOpen] = useState(false)
  const [deletingHabit, setDeletingHabit] = useState<HabitProgressItem | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [userRes, tagsRes, dietsRes, workoutsRes] = await Promise.all([
        api.get(`/admin/users/${userId}`), api.get(`/admin/client-tags-of-client?client_id=${userId}`).catch(() => ({ data: [] })),
        api.get(`/admin/users/${userId}/meal-plan-template-assignments`).catch(() => ({ data: { data: [] } })), api.get('/admin/assign-workout?per_page=500').catch(() => ({ data: { data: [] } })),
      ])
      const userData = userRes.data?.data || userRes.data || userRes
      setUser(userData); setPersonalClient(!!userData?.is_personal_client); setTags(tagsRes.data || [])
      setDiets(dietsRes.data?.data || dietsRes.data || [])
      setWorkouts((workoutsRes.data?.data || workoutsRes.data || []).filter((w: any) => String(w.user_id) === userId))
    } catch { toast.error('No se pudo cargar el perfil del usuario') } finally { setLoading(false) }
  }, [userId])

  const fetchCalendar = useCallback(async () => { setCalLoading(true); try { const res = await api.get(`/admin/client-calendar-data?client_id=${userId}&year=${calYear}&month=${calMonth}`); const days = (res.data?.days || []) as CalendarDay[]; setCalDays(days) } catch { setCalDays([]) } finally { setCalLoading(false) } }, [userId, calYear, calMonth])
  const fetchNotes = useCallback(async () => { setNotesLoading(true); try { const res = await api.get(`/admin/client-note-list?client_id=${userId}`); setNotes(res.data || []) } catch { setNotes([]) } finally { setNotesLoading(false) } }, [userId])
  const fetchPhotos = useCallback(async () => { setPhotosLoading(true); try { const res = await api.get(`/admin/progress-photo-list?client_id=${userId}`); setPhotos(res.data || []) } catch { setPhotos([]) } finally { setPhotosLoading(false) } }, [userId])
  const fetchGoals = useCallback(async () => { setGoalsLoading(true); try { const res = await api.get(`/admin/client-goal-list?client_id=${userId}`); setGoals(res.data?.data || res.data || []) } catch { setGoals([]) } finally { setGoalsLoading(false) } }, [userId])
  const fetchLimitations = useCallback(async () => { setLimitationsLoading(true); try { const res = await api.get(`/admin/client-limitation-list?client_id=${userId}`); setLimitations(res.data?.data || res.data || []) } catch { setLimitations([]) } finally { setLimitationsLoading(false) } }, [userId])
  // Motor de Auto-Regulacion de Carga (Fase 4) -- item 10 de docs/PENDIENTE_BACKEND_ADMIN.md.
  // Distinto del "Chequeo diario de preparacion" (fetchReadinessChecks, subjetivo) -- esto es
  // el combined_score/band/ACWR real calculado por ReadinessCalculationService.
  const fetchReadinessScores = useCallback(async () => { setReadinessScoresLoading(true); try { const res = await api.get(`/admin/users/${userId}/readiness?days=14`); setReadinessScores(res.data?.data?.history || []) } catch { setReadinessScores([]) } finally { setReadinessScoresLoading(false) } }, [userId])
  // Feed de logros del motor de progresión (achievement_events) -- no existía en ningún sitio del panel.
  const fetchAchievementEvents = useCallback(async () => { setAchievementEventsLoading(true); try { const res = await api.get(`/admin/achievement-events?client_id=${userId}`); setAchievementEvents(res.data?.data || res.data || []) } catch { setAchievementEvents([]) } finally { setAchievementEventsLoading(false) } }, [userId])
  const fetchBodyMetrics = useCallback(async () => { setBodyMetricsLoading(true); try { const listRes = await api.get(`/admin/client-body-metric-list?client_id=${userId}&per_page=100`); const list = listRes.data?.data?.data || listRes.data?.data || []; setBodyMetrics(list); const chart: Record<string, BodyMetricChart> = {}; for (const m of list as ClientBodyMetric[]) { if (!chart[m.metric_type]) chart[m.metric_type] = { unit: m.unit, data: [] }; chart[m.metric_type].data.push({ value: m.value, date: m.recorded_at, notes: m.notes }) }; for (const k of Object.keys(chart)) chart[k].data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); setBodyMetricsChart(chart) } catch { setBodyMetrics([]); setBodyMetricsChart({}) } finally { setBodyMetricsLoading(false) } }, [userId])
  const fetchBodyMetricTypes = useCallback(async () => { try { const res = await api.get(`/admin/body-metric-type-list?client_id=${userId}`); setBodyMetricTypes(res.data || DEFAULT_BODY_METRIC_TYPES); if (res.data?.length > 0) setMetricForm(f => ({ ...f, metric_type: res.data[0].value, unit: res.data[0].unit })) } catch { setBodyMetricTypes(DEFAULT_BODY_METRIC_TYPES) } }, [userId])
  const handleSaveType = async () => { if (!typeForm.value.trim() || !typeForm.label.trim()) { toast.error('El valor y la etiqueta son obligatorios'); return }; setSavingType(true); try { if (editingType) { await api.post('/admin/body-metric-type-update', { value: editingType.value, label: typeForm.label.trim(), unit: typeForm.unit.trim(), client_id: editingType.scope === 'client' ? editingType.client_id : null }); toast.success('Tipo actualizado') } else { await api.post('/admin/body-metric-type-store', { value: typeForm.value.trim(), label: typeForm.label.trim(), unit: typeForm.unit.trim(), scope: typeForm.scope, client_id: typeForm.scope === 'client' ? Number(userId) : null }); toast.success('Tipo creado') }; setTypeDialogOpen(false); setEditingType(null); setTypeForm({ value: '', label: '', unit: '', scope: 'global' }); fetchBodyMetricTypes() } catch (err: any) { toast.error(err?.message || 'No se pudo guardar el tipo') } finally { setSavingType(false) } }
  const handleDeleteType = async (type: BodyMetricTypeDef) => { try { await api.post('/admin/body-metric-type-delete', { value: type.value, client_id: type.scope === 'client' ? Number(userId) : null }); toast.success('Tipo eliminado'); fetchBodyMetricTypes() } catch { toast.error('No se pudo eliminar el tipo') } }
  const fetchTasks = useCallback(async () => { setTasksLoading(true); try { const res = await api.get(`/admin/task-list?client_id=${userId}&per_page=200`); setTasks(res.data?.data || res.data || []) } catch { setTasks([]) } finally { setTasksLoading(false) } }, [userId])
  const fetchResources = useCallback(async () => { setResourcesLoading(true); try { const res = await api.get(`/admin/admin-resource-list?per_page=200&client_id=${userId}`); setResources(res.data?.data?.data || res.data?.data || res.data || []) } catch { setResources([]) } finally { setResourcesLoading(false) } }, [userId])
  const fetchOnboarding = useCallback(async () => { setOnboardingLoading(true); try { const res = await api.get(`/admin/admin-onboarding-detail?user_id=${userId}`); setOnboarding(res.data?.data || res.data || null) } catch { setOnboarding(null) } finally { setOnboardingLoading(false) } }, [userId])
  const handleSaveTrainingExperience = async () => {
    const months = trainingExpForm.training_experience_months.trim()
    const level = trainingExpForm.technique_level.trim()
    if (months === '' && level === '') { toast.error('Rellena al menos un campo'); return }
    setSavingTrainingExp(true)
    try {
      const payload: any = { user_id: Number(userId) }
      if (months !== '') payload.training_experience_months = Number(months)
      if (level !== '') payload.technique_level = Number(level)
      await api.post('/admin/admin-onboarding-training-experience-update', payload)
      toast.success('Experiencia de entrenamiento actualizada')
      setTrainingExpDialogOpen(false)
      fetchOnboarding()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo actualizar la experiencia de entrenamiento')
    } finally {
      setSavingTrainingExp(false)
    }
  }
  const fetchAssignableResources = useCallback(async () => { try { const res = await api.get('/admin/admin-resource-list?scope=assigned&per_page=500'); setAssignableResources(res.data?.data?.data || res.data?.data || []) } catch { setAssignableResources([]) } }, [])
  const fetchHabitProgress = useCallback(async () => { setHabitProgressLoading(true); try { const res = await api.get(`/admin/client-habit-progress?client_id=${userId}&days=371`); setHabitProgress(res.data?.data || res.data || []) } catch { setHabitProgress([]) } finally { setHabitProgressLoading(false) } }, [userId])
  const fetchSubmissions = useCallback(async () => { setSubmissionsLoading(true); try { const params = new URLSearchParams({ client_id: userId, per_page: '100' }); if (submissionFormFilter && submissionFormFilter !== 'all') params.set('form_id', submissionFormFilter); const res = await api.get(`/admin/admin-form-submission-list?${params}`); const items = (res.data?.data || []) as FormSubmission[]; setSubmissions(items); setSelectedSubmission(prev => items.length > 0 ? (prev && items.find(s => s.id === prev.id) || items[0]) : null) } catch { setSubmissions([]); setSelectedSubmission(null) } finally { setSubmissionsLoading(false) } }, [userId, submissionFormFilter])
  const fetchAssignedForms = useCallback(async () => { setAssignedFormsLoading(true); try { const res = await api.get(`/admin/admin-form-assigned-list?client_id=${userId}`); setAssignedForms(res.data || []) } catch { setAssignedForms([]) } finally { setAssignedFormsLoading(false) } }, [userId])
  const fetchAvailableForms = useCallback(async () => { try { const res = await api.get('/admin/admin-form-list?per_page=500'); setAvailableForms(res.data?.data || []) } catch { setAvailableForms([]) } }, [])

  const handleAssignForm = async () => { if (!assignFormId) return; setAssigningForm(true); try { await api.post('/admin/admin-form-assign', { form_id: Number(assignFormId), client_id: Number(userId) }); toast.success('Formulario asignado'); setAssignFormDialogOpen(false); setAssignFormId(''); fetchAssignedForms(); if (checkinsTab === 'submissions') fetchSubmissions() } catch (err: any) { toast.error(err?.message || 'No se pudo asignar el formulario') } finally { setAssigningForm(false) } }
  const handleFeedbackSubmit = async () => { if (!selectedSubmission || !feedbackText.trim()) return; setSavingFeedback(true); try { await api.post('/admin/admin-form-feedback', { submission_id: selectedSubmission.id, coach_feedback: feedbackText.trim() }); toast.success('Comentario guardado'); setSelectedSubmission(prev => prev ? { ...prev, coach_feedback: feedbackText.trim() } : null) } catch (err: any) { toast.error(err?.message || 'Error') } finally { setSavingFeedback(false) } }

  const fetchSessionFeedback = useCallback(async () => { setFeedbackLoading(true); try { const res = await api.get(`/admin/client-session-feedback?client_id=${userId}`); setSessionReviews(res.data?.data?.reviews || res.data?.reviews || []); setExerciseNotes(res.data?.data?.exercise_notes || res.data?.exercise_notes || []) } catch { setSessionReviews([]); setExerciseNotes([]) } finally { setFeedbackLoading(false) } }, [userId])
  const fetchReadinessChecks = useCallback(async () => { setReadinessLoading(true); try { const res = await api.get(`/admin/client-readiness-checks?client_id=${userId}`); setReadinessChecks(res.data?.data || res.data || []) } catch { setReadinessChecks([]) } finally { setReadinessLoading(false) } }, [userId])
  const fetchAdherence = useCallback(async () => { setAdherenceLoading(true); try { const res = await api.get(`/admin/client-workout-adherence?client_id=${userId}&days=30`); setAdherence(res.data?.data || res.data || null) } catch { setAdherence(null) } finally { setAdherenceLoading(false) } }, [userId])
  const fetchCompletedSessions = useCallback(async () => { setCompletedSessionsLoading(true); try { const res = await api.get(`/admin/client-completed-sessions?client_id=${userId}`); setCompletedSessions(res.data?.data || res.data || []) } catch { setCompletedSessions([]) } finally { setCompletedSessionsLoading(false) } }, [userId])
  const fetchFeatureSettings = useCallback(async () => { try { const res = await api.get(`/admin/client-feature-settings?client_id=${userId}`); setFeatureSettings(res.data?.data || res.data || {}) } catch { setFeatureSettings({}) } }, [userId])

  const fetchTabData = useCallback(async (tab: string) => {
    try {
      if (tab === 'training') { const [r, t, p] = await Promise.all([api.get(`/admin/client-exercise-history?client_id=${userId}`).catch(() => ({ data: [] })), api.get('/admin/workout-template-list?per_page=500').catch(() => ({ data: [] })), api.get('/admin/training-program-list?per_page=500').catch(() => ({ data: [] }))]); setRecords(r.data?.data || r.data || []); setWorkoutTemplates(t.data || []); setTrainingPrograms(p.data || []); fetchCalendar(); fetchSessionFeedback(); fetchReadinessChecks(); fetchCompletedSessions() }
      else if (tab === 'metrics') { const r = await api.get(`/admin/client-exercise-history?client_id=${userId}`).catch(() => ({ data: [] })); setRecords(r.data?.data || r.data || []); fetchBodyMetrics(); fetchBodyMetricTypes() }
      else if (tab === 'settings') { fetchFeatureSettings() }
      else if (tab === 'overview') { await Promise.all([fetchNotes(), fetchAssignedForms(), fetchGoals(), fetchLimitations(), fetchBodyMetrics(), fetchPhotos(), fetchBodyMetricTypes(), fetchCompletedSessions(), fetchReadinessScores(), fetchAchievementEvents()]) }
      else if (tab === 'photos') { fetchPhotos() }
      else if (tab === 'tasks') { fetchTasks() }
      else if (tab === 'habits') { fetchHabitProgress() }
      else if (tab === 'resources') { fetchResources(); fetchAssignableResources() }
      else if (tab === 'onboarding') { fetchOnboarding() }
    } catch { /* tab not found */ }
  }, [userId, fetchCalendar, fetchSessionFeedback, fetchReadinessChecks, fetchReadinessScores, fetchAchievementEvents, fetchCompletedSessions, fetchFeatureSettings, fetchNotes, fetchAssignedForms, fetchPhotos, fetchGoals, fetchLimitations, fetchBodyMetrics, fetchBodyMetricTypes, fetchTasks, fetchHabitProgress, fetchResources, fetchAssignableResources, fetchOnboarding])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (activeTab !== 'overview') fetchTabData(activeTab) }, [activeTab, fetchTabData])
  useEffect(() => { if (activeTab === 'overview') Promise.all([fetchNotes(), fetchAssignedForms(), fetchGoals(), fetchLimitations(), fetchBodyMetrics(), fetchPhotos(), fetchBodyMetricTypes(), fetchReadinessScores(), fetchAchievementEvents()]) }, [activeTab, fetchNotes, fetchAssignedForms, fetchGoals, fetchLimitations, fetchBodyMetrics, fetchPhotos, fetchBodyMetricTypes, fetchReadinessScores, fetchAchievementEvents])
  useEffect(() => { if (activeTab === 'training') fetchCalendar() }, [calYear, calMonth, fetchCalendar, activeTab])
  useEffect(() => { if (trainingSubTab === 'adherence') fetchAdherence() }, [trainingSubTab, fetchAdherence])
  useEffect(() => {
    if (trainingSubTab !== 'volume') return
    let active = true
    setVolumeLoading(true)
    fetchExerciseBodyparts()
      .then(async map => {
        if (!active) return
        setBodyparts(map)
        setMuscleStats(getMuscleCatalogStats())
        setCatalogEntries(await fetchExerciseCatalogEntries())
      })
      .catch(() => {})
      .finally(() => { if (active) setVolumeLoading(false) })
    return () => { active = false }
  }, [trainingSubTab])
  useEffect(() => { if (activeTab === 'checkins') Promise.all([fetchAvailableForms(), fetchSubmissions(), fetchAssignedForms(), fetchReadinessChecks(), fetchFeatureSettings()]) }, [activeTab, submissionFormFilter, fetchAvailableForms, fetchSubmissions, fetchAssignedForms, fetchReadinessChecks, fetchFeatureSettings])

  const goToToday = () => { const n = new Date(); setCalYear(n.getFullYear()); setCalMonth(n.getMonth() + 1); const first = new Date(n.getFullYear(), n.getMonth(), 1); setCalWeekIndex(Math.floor(((first.getDay() + 6) % 7 + n.getDate() - 1) / 7)) }
  const prevCal = () => { if (calViewMode === 'week') { if (calWeekIndex > 0) setCalWeekIndex(i => i - 1); else { const nm = calMonth === 1 ? 12 : calMonth - 1; const ny = calMonth === 1 ? calYear - 1 : calYear; const tc = ((new Date(ny, nm - 1, 1).getDay() + 6) % 7) + new Date(ny, nm, 0).getDate(); setCalMonth(nm); setCalYear(ny); setCalWeekIndex(Math.floor((tc - 1) / 7)) } } else { if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) } }
  const nextCal = () => { if (calViewMode === 'week') { const tc = ((new Date(calYear, calMonth - 1, 1).getDay() + 6) % 7) + new Date(calYear, calMonth, 0).getDate(); if (calWeekIndex < Math.floor((tc - 1) / 7)) setCalWeekIndex(i => i + 1); else { setCalMonth(calMonth === 12 ? 1 : calMonth + 1); setCalYear(calMonth === 12 ? calYear + 1 : calYear); setCalWeekIndex(0) } } else { if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) } }

  const handleCreateNote = async () => { if (!noteDraft.trim()) return; try { const res = await api.post('/admin/client-note-store', { client_id: Number(userId), content: noteDraft.trim() }); setNotes(prev => [res.data?.data || res.data, ...prev]); setNoteDraft(''); toast.success('Nota añadida') } catch { toast.error('No se pudo añadir la nota') } }
  const handleUpdateNote = async (noteId: number) => { if (!editingNoteContent.trim()) return; try { const res = await api.post('/admin/client-note-update', { id: noteId, content: editingNoteContent.trim() }); setNotes(prev => prev.map(n => n.id === noteId ? (res.data?.data || res.data) : n)); setEditingNoteId(null); setEditingNoteContent(''); toast.success('Nota actualizada') } catch { toast.error('Error') } }
  const handleDeleteNote = async (noteId: number) => { if (!confirm('¿Borrar esta nota?')) return; try { await api.post('/admin/client-note-delete', { id: noteId }); setNotes(prev => prev.filter(n => n.id !== noteId)); toast.success('Nota eliminada') } catch { toast.error('Error') } }
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setPhotoUploading(true); try { const fd = new FormData(); fd.append('client_id', userId); fd.append('photo', file); if (photoName.trim()) fd.append('name', photoName.trim()); const res = await api.upload('/admin/progress-photo-store', fd); setPhotos(prev => [res.data?.data || res.data, ...prev]); setPhotoName(''); toast.success('Foto subida') } catch { toast.error('No se pudo subir') } finally { setPhotoUploading(false); e.target.value = '' } }
  const handleDeletePhoto = async (photoId: number) => { if (!confirm('¿Eliminar esta foto de progreso?')) return; try { await api.post('/admin/progress-photo-delete', { client_id: Number(userId), photo_id: photoId }); setPhotos(prev => prev.filter(p => p.id !== photoId)); toast.success('Eliminado') } catch { toast.error('Error') } }

  const handleAssignDirect = async () => { if (!assignDate || !assignTemplateId) return; try { await api.post('/admin/client-calendar-assign-direct', { client_id: Number(userId), date: assignDate, workout_template_id: Number(assignTemplateId) }); toast.success('Entrenamiento importado'); setAssignDialogOpen(false); fetchCalendar() } catch (err: any) { toast.error(err?.message || 'Error') } }
  const handleImportProgram = async () => { if (!importProgramId || !importStartDate) return; try { await api.post('/admin/client-calendar-import-program', { client_id: Number(userId), training_program_id: Number(importProgramId), start_date: importStartDate }); toast.success('Programa asignado'); setImportDialogOpen(false); fetchCalendar() } catch (err: any) { toast.error(err?.message || 'Error') } }
  const handleAssignDiet = async () => { if (!assignDietId || !assignDietStartDate) return; setAssigningDiet(true); try { const selected = dietOptions.find(d => String(d.id) === assignDietId); await api.post(`/admin/meal-plan-templates/${assignDietId}/import-to-calendar`, { client_id: Number(userId), start_date: assignDietStartDate, ...(selected?.type === 'weekday' ? { weeks: Number(assignDietWeeks) || 1 } : {}) }); toast.success('Dieta asignada'); setAssignDietDialogOpen(false); setAssignDietId(''); setAssignDietStartDate(''); setAssignDietWeeks('1'); const res = await api.get(`/admin/users/${userId}/meal-plan-template-assignments`).catch(() => ({ data: { data: [] } })); setDiets(res.data?.data || res.data || []) } catch (err: any) { toast.error(err?.response?.data?.message || err?.message || 'Error') } finally { setAssigningDiet(false) } }
  const handleRemoveAssignment = async (id: number) => { if (!confirm('¿Quitar este entrenamiento del calendario del cliente?')) return; try { await api.post('/admin/client-calendar-remove', { assignment_id: id }); toast.success('Eliminado'); fetchCalendar() } catch { toast.error('Error') } }
  const handleCalCopy = (id: number, title: string) => { setCalClipboard({ assignment_id: id, workout_title: title }); toast.info('Copiado — haz clic en un día para pegar') }
  const handleCalPaste = async (dateStr: string) => { if (!calClipboard) return; try { await api.post('/admin/session-detail-duplicate', { assignment_id: calClipboard.assignment_id, new_date: dateStr, client_id: Number(userId) }); toast.success('Pegado'); setCalClipboard(null); fetchCalendar() } catch (err: any) { toast.error(err?.response?.data?.message || 'Error') } }
  const handleCalDragStart = (e: React.DragEvent, id: number) => { setCalDraggedId(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(id)) }
  const handleCalDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const handleCalDrop = async (e: React.DragEvent, dateStr: string) => { e.preventDefault(); if (!calDraggedId) return; try { await api.post('/admin/session-detail-duplicate', { assignment_id: calDraggedId, new_date: dateStr, client_id: Number(userId) }); await api.post('/admin/client-calendar-remove', { assignment_id: calDraggedId }); toast.success('Movido'); setCalDraggedId(null); fetchCalendar() } catch { toast.error('Error'); setCalDraggedId(null) } }
  // Edita la PLANTILLA compartida (workout_template) -- afecta a todas las
  // semanas/clientes que la reutilicen. Se conserva como acción secundaria
  // explícita (menú "..."), ya no es la acción por defecto al abrir un día
  // futuro del calendario -- ver handleCalOpenUpcoming().
  const handleCalOpenPreview = (id: number) => { setPreviewTemplateId(id); setPreviewOpen(true) }
  // Abre la sesión de ESTE día/cliente concreto (program_day_assignment_id),
  // no la plantilla: /admin/session-detail ya fusiona el prescrito base con
  // cualquier ClientExerciseOverride que el Motor de Auto-Regulación de
  // Carga haya escrito para esta sesión (applyToNextScheduledSession(), ya
  // sea por una regla automática o por una sugerencia aprobada) -- por eso
  // un día TODAVÍA no completado también debe abrir SessionDetailModal, no
  // WorkoutPreviewModal, para que el coach vea la carga/reps ya ajustadas
  // por el motor (editable) en vez del valor estático de la plantilla.
  const handleCalOpenUpcoming = (workout: CalendarWorkout, dateStr: string | null) => {
    setSelectedCompletedSession({
      id: workout.assignment_id, program_day_assignment_id: workout.assignment_id, workout_template_id: workout.id,
      title: workout.title, thumbnail: workout.thumbnail ?? null, date: dateStr || null,
      duration_seconds: null, volume_kg: null, calories_burned: null, difficulty_rating: null, difficulty_label: null,
    })
  }
  const handleCalOpenSession = (workout: CalendarWorkout, dateStr: string | null) => {
    const dayKey = dateStr || ''
    const matched = completedSessions.find(s =>
      (s.program_day_assignment_id != null && s.program_day_assignment_id === workout.assignment_id) ||
      (s.workout_template_id != null && s.workout_template_id === workout.id && s.date && String(s.date).slice(0, 10) === dayKey)
    ) || (dayKey ? completedSessions.find(s => s.date && String(s.date).slice(0, 10) === dayKey) : undefined)
    if (matched) { setSelectedCompletedSession(matched); return }
    setSelectedCompletedSession({ id: workout.id, program_day_assignment_id: null, workout_template_id: workout.id, title: workout.title, thumbnail: workout.thumbnail ?? null, date: dayKey || null, duration_seconds: null, volume_kg: null, calories_burned: null, difficulty_rating: null, difficulty_label: null })
  }
  const handleOpenSessionForNote = (note: ExerciseNote) => {
    const dayKey = note.date ? String(note.date).slice(0, 10) : ''
    if (note.program_day_assignment_id) {
      setSelectedCompletedSession({ id: note.program_day_assignment_id, program_day_assignment_id: note.program_day_assignment_id, workout_template_id: null, title: note.exercise_title, thumbnail: null, date: note.date, duration_seconds: null, volume_kg: null, calories_burned: null, difficulty_rating: null, difficulty_label: null })
      return
    }
    if (note.workout_template_id) {
      setSelectedCompletedSession({ id: note.workout_template_id, program_day_assignment_id: null, workout_template_id: note.workout_template_id, title: note.exercise_title, thumbnail: null, date: note.date, duration_seconds: null, volume_kg: null, calories_burned: null, difficulty_rating: null, difficulty_label: null })
      return
    }
    const matched = dayKey ? completedSessions.find(s => s.date && String(s.date).slice(0, 10) === dayKey) : undefined
    if (matched) { setSelectedCompletedSession(matched); return }
    toast.info('No se encontró la sesión de esta nota')
  }

  const handleSaveGoal = async () => { if (!goalForm.title.trim()) return; try { const p: any = { client_id: Number(userId), title: goalForm.title.trim(), description: goalForm.description.trim() || null, type: goalForm.type, target_value: goalForm.target_value ? Number(goalForm.target_value) : null, current_value: goalForm.current_value ? Number(goalForm.current_value) : null, unit: goalForm.unit.trim() || null, target_date: goalForm.target_date || null }; if (editingGoalId) { const res = await api.post('/admin/client-goal-update', { id: editingGoalId, ...p }); setGoals(prev => prev.map(g => g.id === editingGoalId ? (res.data?.data || res.data) : g)); toast.success('Actualizado') } else { const res = await api.post('/admin/client-goal-store', p); setGoals(prev => [res.data?.data || res.data, ...prev]); toast.success('Creado') } setGoalDialogOpen(false); setGoalForm({ title: '', description: '', type: 'custom', target_value: '', current_value: '', unit: '', target_date: '' }); setEditingGoalId(null) } catch { toast.error('No se pudo guardar el objetivo') } }
  const handleDeleteGoal = async (id: number) => { if (!confirm('¿Eliminar este objetivo?')) return; try { await api.post('/admin/client-goal-delete', { id }); setGoals(prev => prev.filter(g => g.id !== id)); toast.success('Eliminado') } catch { toast.error('Error') } }
  const handleSaveLimitation = async () => { if (!limitationForm.title.trim()) return; try { const p: any = { client_id: Number(userId), type: limitationForm.type, title: limitationForm.title.trim(), description: limitationForm.description.trim() || null, status: limitationForm.status, date_reported: limitationForm.date_reported || null }; if (editingLimitationId) { const res = await api.post('/admin/client-limitation-update', { id: editingLimitationId, ...p }); setLimitations(prev => prev.map(l => l.id === editingLimitationId ? (res.data?.data || res.data) : l)); toast.success('Actualizado') } else { const res = await api.post('/admin/client-limitation-store', p); setLimitations(prev => [res.data?.data || res.data, ...prev]); toast.success('Creado') } setLimitationDialogOpen(false); setLimitationForm({ type: 'limitation', title: '', description: '', status: 'active', date_reported: '' }); setEditingLimitationId(null) } catch { toast.error('Error') } }
  const handleDeleteLimitation = async (id: number) => { if (!confirm('¿Eliminar esta limitación?')) return; try { await api.post('/admin/client-limitation-delete', { id }); setLimitations(prev => prev.filter(l => l.id !== id)); toast.success('Eliminado') } catch { toast.error('Error') } }
  const handleSaveMetric = async () => { if (!metricForm.value) return; try { const p = { client_id: Number(userId), metric_type: metricForm.metric_type, value: Number(metricForm.value), unit: metricForm.unit.trim() || null, recorded_at: metricForm.recorded_at, notes: metricForm.notes.trim() || null }; const res = await api.post('/admin/client-body-metric-store', p); setBodyMetrics(prev => [res.data?.data || res.data, ...prev]); toast.success('Registrado'); setMetricDialogOpen(false); setMetricForm({ metric_type: 'weight', value: '', unit: 'kg', recorded_at: new Date().toISOString().split('T')[0], notes: '' }); fetchBodyMetrics() } catch { toast.error('Error') } }
  const handleDeleteMetric = async (id: number) => { if (!confirm('¿Eliminar esta entrada de métrica corporal?')) return; try { await api.post('/admin/client-body-metric-delete', { id }); setBodyMetrics(prev => prev.filter(m => m.id !== id)); toast.success('Eliminado'); fetchBodyMetrics() } catch { toast.error('Error') } }
  const handleSaveTask = async () => { if (!taskForm.title.trim()) return; try { const p: any = { client_id: Number(userId), title: taskForm.title.trim(), description: taskForm.description.trim() || null, priority: taskForm.priority, due_date: taskForm.due_date || null }; if (editingTaskId) { const res = await api.post('/admin/task-update', { id: editingTaskId, ...p }); setTasks(prev => prev.map(t => t.id === editingTaskId ? (res.data?.data || res.data) : t)); toast.success('Actualizado') } else { const res = await api.post('/admin/task-store', p); setTasks(prev => [res.data?.data || res.data, ...prev]); toast.success('Creado') } setTaskDialogOpen(false); setTaskForm({ title: '', description: '', priority: 'medium', due_date: '' }); setEditingTaskId(null) } catch { toast.error('Error') } }
  const handleToggleTaskStatus = async (task: TaskItem) => { const next = task.status === 'completed' ? 'pending' : task.status === 'pending' ? 'in_progress' : 'completed'; try { const res = await api.post('/admin/task-update', { id: task.id, status: next }); setTasks(prev => prev.map(t => t.id === task.id ? (res.data?.data || res.data) : t)) } catch { toast.error('Error') } }
  const handleDeleteTask = async (id: number) => { if (!confirm('¿Eliminar esta tarea?')) return; try { await api.post('/admin/task-delete', { id }); setTasks(prev => prev.filter(t => t.id !== id)); toast.success('Eliminado') } catch { toast.error('Error') } }
  const handleSaveResource = async () => { if (!resourceForm.title.trim()) return; try { const p: any = { title: resourceForm.title.trim(), type: resourceForm.type, scope: resourceForm.scope, content: resourceForm.content.trim() || null, external_url: resourceForm.external_url.trim() || null }; if (editingResourceId) { const res = await api.post('/admin/admin-resource-update', { id: editingResourceId, ...p }); setResources(prev => prev.map(r => r.id === editingResourceId ? (res.data?.data || res.data) : r)); toast.success('Actualizado') } else { if (p.scope === 'assigned') p.client_ids = [Number(userId)]; const res = await api.post('/admin/admin-resource-store', p); setResources(prev => [res.data?.data || res.data, ...prev]); toast.success('Creado y asignado a este cliente') } setResourceDialogOpen(false); setResourceForm({ title: '', type: 'article', scope: 'shared', content: '', external_url: '' }); setEditingResourceId(null); fetchAssignableResources() } catch { toast.error('Error') } }
  const handleDeleteResource = async (id: number) => { if (!confirm('¿Eliminar este recurso? Se borrará para TODOS los clientes que lo tengan asignado, no solo para este. Esta acción no se puede deshacer.')) return; try { await api.post('/admin/admin-resource-delete', { id }); setResources(prev => prev.filter(r => r.id !== id)); toast.success('Eliminado') } catch { toast.error('Error') } }
  const handleAssignExistingResource = async () => { if (!assignResourceId) return; setAssigningResource(true); try { await api.post('/admin/resource-assign', { resource_id: Number(assignResourceId), client_id: Number(userId) }); toast.success('Recurso asignado'); setAssignResourceId(''); fetchResources() } catch { toast.error('Error al asignar') } finally { setAssigningResource(false) } }
  const handleUnassignResource = async (resourceId: number) => { if (!confirm('¿Quitar la asignación de este recurso solo para este cliente?')) return; try { await api.post('/admin/resource-unassign', { resource_id: resourceId, client_id: Number(userId) }); toast.success('Asignación retirada'); fetchResources() } catch { toast.error('Error') } }
  const handleDeleteHabit = async () => {
    if (!deletingHabit) return
    try {
      await api.post('/admin/habit-delete', { id: deletingHabit.id })
      toast.success('Hábito eliminado')
      setDeleteHabitDialogOpen(false)
      fetchHabitProgress()
    } catch {
      toast.error('No se pudo eliminar')
    }
  }
  const handleToggleFeature = async (key: string, enabled: boolean) => { setFeatureSettings(prev => ({ ...prev, [key]: enabled })); setSavingFeature(key); try { await api.post('/admin/client-feature-settings-update', { client_id: Number(userId), feature_key: key, is_enabled: enabled }); toast.success(`${FEATURE_LABELS[key] || key} ${enabled ? 'activado' : 'desactivado'}`) } catch { setFeatureSettings(prev => ({ ...prev, [key]: !enabled })); toast.error('No se pudo actualizar la función') } finally { setSavingFeature(null) } }

  const handleTogglePersonalClient = async (checked: boolean) => { const previous = personalClient; setPersonalClient(checked); setSavingPersonalClient(true); try { await api.put(`/admin/users/${userId}`, { is_personal_client: checked }); toast.success(checked ? 'Cliente marcado como Full Access (entrenamiento personal)' : 'Cliente marcado como Free') } catch { setPersonalClient(previous); toast.error('No se pudo actualizar el nivel de acceso') } finally { setSavingPersonalClient(false) } }
  const sortedSubmissionAnswers = useMemo(() => [...(selectedSubmission?.answers ?? [])].sort((a, b) => (a.question?.order ?? 0) - (b.question?.order ?? 0)), [selectedSubmission])
  const calCells = useMemo(() => getMonthGrid(calYear, calMonth), [calYear, calMonth])
  const calWeeks = useMemo(() => getCalendarWeeks(calYear, calMonth), [calYear, calMonth])
  const calDayMap = useMemo(() => new Map(calDays.map(d => [d.date, d])), [calDays])
  const completedAssignments = useMemo(() => new Set(completedSessions.filter(s => s.program_day_assignment_id != null).map(s => s.program_day_assignment_id as number)), [completedSessions])
  const completedByTemplate = useMemo(() => new Set(completedSessions.filter(s => s.workout_template_id != null && s.date).map(s => `${String(s.date).slice(0, 10)}|${s.workout_template_id}`)), [completedSessions])
  const completedByDate = useMemo(() => new Set(completedSessions.filter(s => s.date).map(s => String(s.date).slice(0, 10))), [completedSessions])
  const todayStr = new Date().toISOString().split('T')[0]
  const filteredTasks = useMemo(() => { let list = tasks; if (taskStatusFilter !== 'all') list = list.filter(t => t.status === taskStatusFilter); if (taskSearch.trim()) { const q = taskSearch.toLowerCase(); list = list.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) }; return list }, [tasks, taskStatusFilter, taskSearch])
  const filteredResources = useMemo(() => resourceTypeFilter === 'all' ? resources : resources.filter(r => r.type === resourceTypeFilter), [resources, resourceTypeFilter])

  // Historial de ejercicios agrupado por ejercicio (antes era un log plano,
  // fila por serie, sin agrupar ni graficar) - un registro por ejercicio con
  // sus series (mas recientes primero) y datos ya listos para la grafica de
  // progresion (un punto por fecha, con el peso maximo levantado ese dia).
  const exerciseHistoryGroups = useMemo(() => {
    const map = new Map<number, { exercise_id: number; title: string; entries: PersonalRecord[] }>()
    for (const r of records) {
      const key = r.exercise_id
      if (!map.has(key)) map.set(key, { exercise_id: key, title: r.exercise?.title || `Ejercicio #${key}`, entries: [] })
      map.get(key)!.entries.push(r)
    }
    return Array.from(map.values())
      .map(g => ({ ...g, entries: [...g.entries].sort((a, b) => b.date.localeCompare(a.date)) }))
      .sort((a, b) => (b.entries[0]?.date ?? '').localeCompare(a.entries[0]?.date ?? ''))
  }, [records])

  const filteredHistoryGroups = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    if (!q) return exerciseHistoryGroups
    return exerciseHistoryGroups.filter(g => g.title.toLowerCase().includes(q))
  }, [exerciseHistoryGroups, historySearch])

  const selectedHistoryGroup = useMemo(
    () => exerciseHistoryGroups.find(g => g.exercise_id === selectedHistoryExerciseId) ?? exerciseHistoryGroups[0] ?? null,
    [exerciseHistoryGroups, selectedHistoryExerciseId]
  )

  // Progresion serie a serie (no solo dia a dia) - con datos de una sola
  // sesion, agrupar por fecha dejaba un unico punto y ninguna grafica se
  // podia dibujar. El orden real (log_id, indice de serie) va codificado en
  // el id compuesto "logId-setIndex" que arma el backend - se usa para
  // ordenar cronologicamente incluso dentro del mismo dia (ej. calentamiento
  // subiendo de peso serie a serie).
  const historyChartData = useMemo(() => {
    if (!selectedHistoryGroup) return []
    return [...selectedHistoryGroup.entries]
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        const [aLog, aSet] = String(a.id).split('-').map(Number)
        const [bLog, bSet] = String(b.id).split('-').map(Number)
        return (aLog - bLog) || (aSet - bSet)
      })
      .map((r, i) => ({
        index: i + 1,
        date: r.date,
        weight: r.weight ?? 0,
        one_rm: r.one_rm ?? 0,
      }))
  }, [selectedHistoryGroup])

  const volumeWindowDays = useMemo(() => {
    switch (volumeWindow) {
      case 'week': return 7
      case 'month': return 30
      case 'quarter': return 90
      case 'semester': return 180
      case 'custom': return Math.max(1, customMonths) * 30
      default: return 0
    }
  }, [volumeWindow, customMonths])

  // Series dentro de la ventana temporal seleccionada (0 = todo el historial).
  const windowedRecords = useMemo(() => {
    if (volumeWindowDays <= 0) return records
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - volumeWindowDays)
    const cutoffKey = cutoff.toISOString().slice(0, 10)
    return records.filter(r => String(r.date).slice(0, 10) >= cutoffKey)
  }, [records, volumeWindowDays])

  // Volumen por musculo/fecha — antes se calculaba entero en el navegador
  // (windowedRecords + getMuscleVolumeSplit), ahora lo sirve MuscleVolumeService
  // en el backend (mismo reparto EMG) para que admin, app movil y el heatmap
  // post-entrenamiento usen siempre el mismo numero. Las 4 variables de abajo
  // quedan como simples alias de `volumeData` para no tocar el resto del
  // componente (selectedMuscle, compareData, etc. siguen igual).
  const [volumeData, setVolumeData] = useState<{
    volumeByMuscle: { group: string; volume: number }[]
    volumeByDate: { date: string; volume: number }[]
    volumeByDateAndMuscle: Record<string, any>[]
    totalVolume: number
  }>({ volumeByMuscle: [], volumeByDate: [], volumeByDateAndMuscle: [], totalVolume: 0 })

  useEffect(() => {
    if (trainingSubTab !== 'volume') return
    let active = true
    setVolumeLoading(true)
    api
      .get(`/admin/client-muscle-volume?client_id=${userId}&days=${volumeWindowDays}&multiplier_enabled=${multiplierEnabled ? 1 : 0}`)
      .then(res => { if (active) setVolumeData(res.data?.data || res.data || { volumeByMuscle: [], volumeByDate: [], volumeByDateAndMuscle: [], totalVolume: 0 }) })
      .catch(() => { if (active) setVolumeData({ volumeByMuscle: [], volumeByDate: [], volumeByDateAndMuscle: [], totalVolume: 0 }) })
      .finally(() => { if (active) setVolumeLoading(false) })
    return () => { active = false }
  }, [trainingSubTab, userId, volumeWindowDays, multiplierEnabled])

  const volumeByDate = volumeData.volumeByDate
  const volumeByMuscle = volumeData.volumeByMuscle
  const volumeByDateAndMuscle = volumeData.volumeByDateAndMuscle
  const totalTrainingVolume = volumeData.totalVolume

  const catalogGroupCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of catalogEntries) {
      for (const g of Array.from(new Set(e.groups))) m.set(g, (m.get(g) ?? 0) + 1)
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [catalogEntries])
  const catalogWithoutGroup = useMemo(() => catalogEntries.filter(e => e.groups.length === 0), [catalogEntries])

  const unclassifiedRecords = useMemo(() => {
    let count = 0
    for (const r of windowedRecords) {
      if (!primaryBodypart(bodyparts.get(r.exercise_id) ?? [])) count += 1
    }
    return count
  }, [windowedRecords, bodyparts])

  const filteredMuscleGroups = useMemo(() => {
    const q = muscleSearch.trim().toLowerCase()
    if (!q) return volumeByMuscle
    return volumeByMuscle.filter(g => g.group.toLowerCase().includes(q))
  }, [volumeByMuscle, muscleSearch])

  const selectedMuscle = useMemo(
    () => volumeByMuscle.find(v => v.group === selectedMuscleGroup) ?? volumeByMuscle[0] ?? null,
    [volumeByMuscle, selectedMuscleGroup]
  )

  const selectedMuscleOverTime = useMemo(() => {
    if (!selectedMuscle) return []
    return volumeByDateAndMuscle
      .map(row => ({ date: String(row.date), volume: Number(row[selectedMuscle.group] ?? 0) }))
      .filter(p => p.volume > 0)
  }, [selectedMuscle, volumeByDateAndMuscle])

  const toggleMuscle = useCallback((group: string) => {
    setHiddenMuscles(prev => ({ ...prev, [group]: !prev[group] }))
  }, [])

  const toggleCompare = useCallback((group: string) => {
    setCompareMuscles(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group])
  }, [])

  const compareData = useMemo(() => {
    if (compareMuscles.length === 0) return []
    const sel = new Set(compareMuscles)
    return volumeByDateAndMuscle.map(row => {
      const next: Record<string, any> = { date: row.date }
      for (const g of sel) next[g] = row[g] ?? 0
      return next
    })
  }, [volumeByDateAndMuscle, compareMuscles])
  const compareHasData = useMemo(
    () => compareData.some(row => compareMuscles.some(g => Number(row[g]) > 0)),
    [compareData, compareMuscles]
  )
  const compareTotals = useMemo(
    () => compareMuscles
      .map(g => ({ group: g, volume: volumeByMuscle.find(v => v.group === g)?.volume ?? 0 }))
      .sort((a, b) => b.volume - a.volume),
    [compareMuscles, volumeByMuscle]
  )

  useEffect(() => {
    if (compareInitialized.current || volumeByMuscle.length === 0) return
    compareInitialized.current = true
    setCompareMuscles(volumeByMuscle.filter(v => v.volume > 0).slice(0, 3).map(v => v.group))
  }, [volumeByMuscle])

  const visibleMuscleGroups = useMemo(
    () => volumeByMuscle.filter(g => !hiddenMuscles[g.group]),
    [volumeByMuscle, hiddenMuscles]
  )
  const visibleMuscleGroupNames = useMemo(() => visibleMuscleGroups.map(g => g.group), [visibleMuscleGroups])
  const visibleVolumeByDateAndMuscle = useMemo(() => {
    const visible = new Set(visibleMuscleGroupNames)
    return volumeByDateAndMuscle.map(row => {
      const next: Record<string, any> = { date: row.date }
      for (const g of visible) if (row[g] != null) next[g] = row[g]
      return next
    })
  }, [volumeByDateAndMuscle, visibleMuscleGroupNames])

  if (loading) return <DetailSkeleton />
  if (!user) return <div className='text-center py-20 text-muted-foreground'>Usuario no encontrado</div>

  const bmi = user.weight && user.height ? (user.weight / ((user.height / 100) ** 2)).toFixed(1) : null
  const bmr = user.weight && user.height && user.age ? (10 * user.weight + 6.25 * user.height - 5 * user.age + 5).toFixed(0) : null
  const memberSince = new Date(user.created_at)
  const activeGoals = goals.filter(g => g.status === 'active')
  const activeLimitations = limitations.filter(l => l.status === 'active')
  const latestPhotos = photos.slice(0, 4)

  function formatWeekRange(week: (string | null)[]): string { const dates = week.filter(Boolean) as string[]; if (!dates.length) return ''; const s = new Date(dates[0]); const e = new Date(dates[dates.length - 1]); const f = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); return s.getMonth() === e.getMonth() ? `${f(s)} - ${f(e)} ${e.getFullYear()}` : `${f(s)} - ${f(e)} ${e.getFullYear()}` }

  const renderCalendarDay = (dateStr: string | null, key: string) => {
    const dayData = dateStr ? calDayMap.get(dateStr) : null; const workout = dayData?.workouts?.[0]; const isCurrentMonth = dayData?.in_month ?? true; const dayNum = dateStr ? parseInt(dateStr.split('-')[2], 10) : 0; const isToday = dateStr === todayStr
    const isCompleted = workout ? (completedAssignments.has(workout.assignment_id) || (!!dateStr && !!workout.id && completedByTemplate.has(`${dateStr}|${workout.id}`)) || (!!dateStr && completedByDate.has(dateStr))) : false
    return (
      <div key={key} className={cn('p-2 min-h-[150px] flex flex-col', !isCurrentMonth && 'bg-muted/30', calClipboard && dateStr && 'hover:bg-primary/5 cursor-pointer')} onDragOver={handleCalDragOver} onDrop={(e) => dateStr && handleCalDrop(e, dateStr)} onClick={() => { if (calClipboard && dateStr) handleCalPaste(dateStr) }}>
        <div className='flex items-center justify-between mb-2'>
          <p className={cn('text-[11px] font-medium', isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50')}>{dayNum || '—'}</p>
          {isToday && <span className='text-[9px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center'>T</span>}
        </div>
        {workout ? (
          <div className={cn('group rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow flex-1', isCompleted ? 'border-green-500/50 bg-green-500/10 cursor-pointer' : 'bg-card cursor-grab active:cursor-grabbing')} draggable onDragStart={(e) => handleCalDragStart(e, workout.assignment_id)} onClick={() => { if (isCompleted) handleCalOpenSession(workout, dateStr); else handleCalOpenUpcoming(workout, dateStr) }}>
            {workout.thumbnail ? <div className={cn('h-16 w-full overflow-hidden', isCompleted ? 'bg-green-500/20' : 'bg-muted')}><img src={workout.thumbnail} alt='' loading='lazy' decoding='async' className='w-full h-full object-cover' /></div> : <div className={cn('h-16 w-full flex items-center justify-center', isCompleted ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground/30')}><DumbbellIcon className='size-5' /></div>}
            <div className='px-2 py-1.5'>
              <div className='flex items-start justify-between gap-1'>
                <span className='text-[11px] font-semibold leading-tight cursor-pointer hover:underline line-clamp-2' title={workout.title} onClick={(e) => { e.stopPropagation(); if (isCompleted) handleCalOpenSession(workout, dateStr); else handleCalOpenUpcoming(workout, dateStr) }}>{workout.title}</span>
                <DropdownMenu><DropdownMenuTrigger><button type='button' className='opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-foreground shrink-0' onClick={(e) => e.stopPropagation()}><MoreVerticalIcon className='size-3' /></button></DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='text-xs'>
                    <DropdownMenuItem onClick={() => { if (isCompleted) handleCalOpenSession(workout, dateStr); else handleCalOpenUpcoming(workout, dateStr) }}><SearchIcon className='size-3 mr-1.5' /> {isCompleted ? 'Ver sesión' : 'Abrir'}</DropdownMenuItem>
                    {!isCompleted && <DropdownMenuItem onClick={() => handleCalOpenPreview(workout.id)}><PencilIcon className='size-3 mr-1.5' /> Editar plantilla base (afecta a todos)</DropdownMenuItem>}
                    <DropdownMenuItem onClick={() => handleCalCopy(workout.assignment_id, workout.title)}><CopyIcon className='size-3 mr-1.5' /> Copiar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRemoveAssignment(workout.assignment_id)} className='text-destructive focus:text-destructive'><XIcon className='size-3 mr-1.5' /> Quitar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {isCompleted && <p className='text-[10px] font-medium text-green-600 mt-1 flex items-center gap-1'><CheckCircleIcon className='size-3' /> Completado</p>}
              {!isCompleted && workout.exercise_count !== undefined && workout.exercise_count > 0 && <p className='text-[10px] text-muted-foreground mt-1'>{workout.exercise_count} {workout.exercise_count !== 1 ? 'ejercicios' : 'ejercicio'}</p>}
            </div>
          </div>
        ) : dateStr ? <button className='flex-1 rounded-lg border border-dashed hover:border-primary/50 hover:bg-muted/50 transition-colors flex items-center justify-center text-muted-foreground hover:text-primary' onClick={() => { setAssignDate(dateStr); setAssignTemplateId(''); setAssignDialogOpen(true) }}><PlusIcon className='size-4' /></button> : null}
      </div>
    )
  }

  return (
    <div className='min-h-screen'>
      {/* ═══ STICKY HEADER ═══ */}
      <div className='sticky top-0 z-40 bg-background border-b'>
        <div className='flex items-center gap-2 sm:gap-4 px-3 sm:px-6 h-16'>
          <Button variant='ghost' size='icon' className='size-8 shrink-0' onClick={() => navigate('/users')}><ArrowLeftIcon className='size-4' /></Button>
          <div className='h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden'>
            {user.profile_image ? <img src={user.profile_image} alt='' className='w-full h-full object-cover' /> : `${user.first_name?.[0]}${user.last_name?.[0]}`}
          </div>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <h1 className='text-base font-semibold truncate'>{user.first_name} {user.last_name}</h1>
              <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className='text-[10px] shrink-0'>{user.status}</Badge>
              {tags.slice(0, 2).map(t => <Badge key={t.id} variant='outline' className='text-[10px] shrink-0' style={{ borderColor: t.color, color: t.color }}>{t.title}</Badge>)}
            </div>
            <p className='text-xs text-muted-foreground'>Última actividad: {timeAgo(user.last_active_at)}</p>
          </div>
          <div className='flex-1' />
          <div className='overflow-x-auto'>
            <div className='flex items-center gap-1 min-w-max'>
              {TABS.map(tab => (<button key={tab.value} type='button' onClick={() => goToTab(tab.value)} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap', activeTab === tab.value ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><tab.icon className='size-3.5' />{tab.label}</button>))}
            </div>
          </div>
        </div>
      </div>

      <div className='p-3 sm:p-6 space-y-6'>
        {/* ═══ OVERVIEW ═══ */}
        {activeTab === 'overview' && (
          <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
            <div className='lg:col-span-8 space-y-6'>
              <Card>
                <CardHeader className='pb-3'><CardTitle className='text-sm flex items-center gap-2'><DumbbellIcon className='size-4' /> Resumen de entrenamiento</CardTitle></CardHeader>
                <CardContent>
                  <div className='grid grid-cols-3 gap-4'>
                    {[{ label: 'Últimos 7 días', count: completedSessions.filter(w => { const diff = (Date.now() - new Date(w.date || '').getTime()) / 86400000; return diff >= 0 && diff <= 7 }).length },
                      { label: 'Últimos 30 días', count: completedSessions.filter(w => { const diff = (Date.now() - new Date(w.date || '').getTime()) / 86400000; return diff >= 0 && diff <= 30 }).length },
                      { label: 'Total asignados', count: workouts.length }].map(s => (
                      <div key={s.label} className='text-center p-3 rounded-lg bg-muted/50'><p className='text-2xl font-bold'>{s.count}</p><p className='text-xs text-muted-foreground mt-1'>{s.label}</p></div>
                    ))}
                  </div>
                  {completedSessions.length > 0 && <div className='mt-4 p-3 rounded-lg bg-muted/30 flex items-center justify-between'><div><p className='text-sm font-medium'>{completedSessions[0]?.title}</p><p className='text-xs text-muted-foreground'>Último completado: {completedSessions[0]?.date ? new Date(completedSessions[0].date!).toLocaleDateString() : '—'}</p></div><Button variant='ghost' size='sm' onClick={() => goToTab('training')} className='text-xs'>Ver todo</Button></div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-3 flex flex-row items-center justify-between'>
                  <CardTitle className='text-sm flex items-center gap-2'><BarChart3Icon className='size-4' /> Métricas corporales</CardTitle>
                  <div className='flex items-center gap-2'>
                    <Button variant='ghost' size='sm' className='text-xs' onClick={() => { setEditingType(null); setTypeForm({ value: '', label: '', unit: '', scope: 'global' }); setTypeDialogOpen(true) }}><SettingsIcon className='size-3 mr-1' /> Tipos</Button>
                    <Button variant='ghost' size='sm' className='text-xs' onClick={() => { setMetricForm(f => ({ ...f, metric_type: selectedMetricType })); setMetricDialogOpen(true) }}><PlusIcon className='size-3 mr-1' /> Registrar</Button>
                    <Button variant='ghost' size='sm' className='text-xs' onClick={() => goToTab('metrics')}>Ver todo</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {bodyMetricsLoading ? <div className='flex justify-center py-8'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                  : Object.keys(bodyMetricsChart).length > 0 ? (
                    <div className='space-y-4'>
                      <div className='flex gap-2 flex-wrap'>
                        {bodyMetricTypes.map(bt => { const hasData = bodyMetricsChart[bt.value]?.data?.length > 0; return <button key={bt.value} type='button' onClick={() => setSelectedMetricType(bt.value)} className={cn('px-3 py-1 text-xs rounded-full border transition-colors', selectedMetricType === bt.value ? 'bg-primary text-primary-foreground border-primary' : hasData ? 'border-border hover:bg-muted' : 'border-border opacity-50')}>{bt.label}</button> })}
                      </div>
                      {bodyMetricsChart[selectedMetricType]?.data?.length > 0 ? (
                        <Suspense fallback={<ChartFallback height={200} />}>
                          <BodyMetricChart data={bodyMetricsChart[selectedMetricType].data} />
                        </Suspense>
                      ) : <p className='text-center text-muted-foreground text-sm py-4'>Sin datos para {bodyMetricTypes.find(bt => bt.value === selectedMetricType)?.label}</p>}
                    </div>
                  ) : <div className='text-center py-8'><BarChart3Icon className='size-8 mx-auto text-muted-foreground/40 mb-2' /><p className='text-sm text-muted-foreground'>Aún no se han registrado métricas corporales</p><Button size='sm' variant='outline' className='mt-2' onClick={() => setMetricDialogOpen(true)}><PlusIcon className='size-3 mr-1' /> Registrar primera métrica</Button></div>}
                </CardContent>
              </Card>
              <div className='grid grid-cols-2 gap-4'>
                <Card><CardContent className='pt-6 flex flex-col items-center'><ScaleIcon className='size-5 text-muted-foreground mb-1' /><p className='text-2xl font-bold'>{bmi ?? '—'}</p><p className='text-xs text-muted-foreground'>BMI</p></CardContent></Card>
                <Card><CardContent className='pt-6 flex flex-col items-center'><ActivityIcon className='size-5 text-muted-foreground mb-1' /><p className='text-2xl font-bold'>{bmr ?? '—'}</p><p className='text-xs text-muted-foreground'>BMR (kcal)</p></CardContent></Card>
              </div>
            </div>
            <div className='lg:col-span-4 space-y-6'>
              <Card>
                <CardContent className='pt-6 space-y-3'>
                  <div className='flex items-center gap-3'>
                    <div className='h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden'>{user.profile_image ? <img src={user.profile_image} alt='' className='w-full h-full object-cover' /> : `${user.first_name?.[0]}${user.last_name?.[0]}`}</div>
                    <div><p className='font-semibold'>{user.first_name} {user.last_name}</p><p className='text-xs text-muted-foreground'>@{user.username}</p></div>
                  </div>
                  <Separator />
                  <div className='grid grid-cols-2 gap-2 text-xs'>
                    <div><p className='text-muted-foreground'>Correo electrónico</p><p className='font-medium truncate'>{user.email}</p></div>
                    <div><p className='text-muted-foreground'>Teléfono</p><p className='font-medium'>{user.phone_number || '—'}</p></div>
                    <div><p className='text-muted-foreground'>Género</p><p className='font-medium capitalize'>{user.gender || '—'}</p></div>
                    <div><p className='text-muted-foreground'>Registrado</p><p className='font-medium'>{memberSince.toLocaleDateString()}</p></div>
                    <div><p className='text-muted-foreground'>Peso</p><p className='font-medium'>{user.weight ?? '—'} kg</p></div>
                    <div><p className='text-muted-foreground'>Altura</p><p className='font-medium'>{user.height ?? '—'} cm</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2 flex flex-row items-center justify-between space-y-0'><CardTitle className='text-sm flex items-center gap-2'><TargetIcon className='size-4' /> Objetivos</CardTitle><Button variant='ghost' size='sm' className='h-6 text-xs' onClick={() => { setEditingGoalId(null); setGoalForm({ title: '', description: '', type: 'custom', target_value: '', current_value: '', unit: '', target_date: '' }); setGoalDialogOpen(true) }}><PlusIcon className='size-3' /></Button></CardHeader>
                <CardContent>
                  {goalsLoading ? <div className='flex justify-center py-4'><div className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                  : activeGoals.length > 0 ? <div className='space-y-3'>{activeGoals.slice(0, 4).map(g => { const pct = g.target_value && g.current_value ? Math.min(100, (g.current_value / g.target_value) * 100) : null; return (<div key={g.id} className='space-y-1.5'><div className='flex items-center justify-between'><p className='text-sm font-medium truncate'>{g.title}</p><DropdownMenu><DropdownMenuTrigger><button type='button' className='p-0.5 text-muted-foreground hover:text-foreground'><MoreVerticalIcon className='size-3' /></button></DropdownMenuTrigger><DropdownMenuContent align='end' className='text-xs'><DropdownMenuItem onClick={() => { setEditingGoalId(g.id); setGoalForm({ title: g.title, description: g.description || '', type: g.type, target_value: g.target_value?.toString() || '', current_value: g.current_value?.toString() || '', unit: g.unit || '',                           target_date: g.target_date || '' }); setGoalDialogOpen(true) }}>Editar</DropdownMenuItem><DropdownMenuItem onClick={() => handleDeleteGoal(g.id)} className='text-destructive focus:text-destructive'>Eliminar</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>{pct !== null && <div className='space-y-0.5'><div className='h-1.5 rounded-full bg-muted overflow-hidden'><div className='h-full bg-primary rounded-full transition-all' style={{ width: `${pct}%` }} /></div><p className='text-[10px] text-muted-foreground text-right'>{Math.round(pct)}%</p></div>}{g.target_date && <p className='text-[10px] text-muted-foreground'>{daysUntil(g.target_date)}{g.unit ? ` · ${g.current_value ?? 0}/${g.target_value} ${g.unit}` : ''}</p>}</div>) })}</div>
                  : <p className='text-center text-muted-foreground text-xs py-3'>No hay objetivos activos</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2 flex flex-row items-center justify-between space-y-0'><CardTitle className='text-sm flex items-center gap-2'><FileTextIcon className='size-4' /> Notas</CardTitle><Badge variant='secondary' className='text-[10px]'>{notes.length}</Badge></CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <div className='flex gap-1.5'><Input placeholder='Añadir una nota...' value={noteDraft} onChange={e => setNoteDraft(e.target.value)} className='h-8 text-xs' onKeyDown={e => e.key === 'Enter' && handleCreateNote()} /><Button size='sm' className='h-8 px-2' onClick={handleCreateNote} disabled={!noteDraft.trim()}><PlusIcon className='size-3' /></Button></div>
                    {notesLoading ? <div className='flex justify-center py-4'><div className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                    : notes.length > 0 ? <ScrollArea className='max-h-[250px]'><div className='space-y-2'>{notes.slice(0, 5).map(note => (<div key={note.id} className='rounded-md bg-muted/50 p-2.5 space-y-1'>{editingNoteId === note.id ? <div className='space-y-1.5'><Textarea value={editingNoteContent} onChange={e => setEditingNoteContent(e.target.value)} rows={2} className='resize-none text-xs' /><div className='flex gap-1'><Button size='sm' variant='default' className='h-6 text-[10px]' onClick={() => handleUpdateNote(note.id)}>Guardar</Button><Button size='sm' variant='ghost' className='h-6 text-[10px]' onClick={() => { setEditingNoteId(null); setEditingNoteContent('') }}>Cancelar</Button></div></div> : <><p className='text-xs whitespace-pre-wrap'>{note.content}</p><div className='flex items-center justify-between'><span className='text-[10px] text-muted-foreground'>{note.author ? `${note.author.first_name} ${note.author.last_name}` : 'Coach'} · {new Date(note.created_at).toLocaleDateString()}</span><div className='flex gap-1'><button className='text-[10px] text-muted-foreground hover:text-foreground' onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content) }}>Editar</button><button className='text-[10px] text-destructive hover:text-destructive/80' onClick={() => handleDeleteNote(note.id)}>Borrar</button></div></div></>}</div>))}</div></ScrollArea> : <p className='text-center text-muted-foreground text-xs py-3'>Aún no hay notas</p>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2 flex flex-row items-center justify-between space-y-0'><CardTitle className='text-sm flex items-center gap-2'><AlertTriangleIcon className='size-4' /> Limitaciones</CardTitle><Button variant='ghost' size='sm' className='h-6 text-xs' onClick={() => { setEditingLimitationId(null); setLimitationForm({ type: 'limitation', title: '', description: '', status: 'active', date_reported: '' }); setLimitationDialogOpen(true) }}><PlusIcon className='size-3' /></Button></CardHeader>
                <CardContent>
                  {limitationsLoading ? <div className='flex justify-center py-4'><div className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                  : activeLimitations.length > 0 ? <div className='space-y-2'>{activeLimitations.slice(0, 4).map(l => (<div key={l.id} className='rounded-md bg-muted/50 p-2.5 space-y-1'><div className='flex items-center justify-between'><div className='flex items-center gap-1.5'><Badge variant='outline' className='text-[9px] capitalize'>{l.type.replace('_', ' ')}</Badge><p className='text-xs font-medium'>{l.title}</p></div><DropdownMenu><DropdownMenuTrigger><button type='button' className='p-0.5 text-muted-foreground hover:text-foreground'><MoreVerticalIcon className='size-3' /></button></DropdownMenuTrigger><DropdownMenuContent align='end' className='text-xs'><DropdownMenuItem onClick={() => { setEditingLimitationId(l.id); setLimitationForm({ type: l.type, title: l.title, description: l.description || '', status: l.status, date_reported: l.date_reported || '' });                             setLimitationDialogOpen(true) }}>Editar</DropdownMenuItem><DropdownMenuItem onClick={() => handleDeleteLimitation(l.id)} className='text-destructive focus:text-destructive'>Eliminar</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>{l.description && <p className='text-[10px] text-muted-foreground line-clamp-2'>{l.description}</p>}</div>))}</div>
                  : <p className='text-center text-muted-foreground text-xs py-3'>No hay limitaciones</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'><CardTitle className='text-sm flex items-center gap-2'><ActivityIcon className='size-4' /> Readiness / Carga (ACWR)</CardTitle></CardHeader>
                <CardContent>
                  {readinessScoresLoading ? <div className='flex justify-center py-4'><div className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                  : readinessScores.length > 0 ? (() => { const latest = readinessScores[0]; const band = latest.band || 'dato_insuficiente'; return (
                    <div className='space-y-3'>
                      <div className='flex items-center justify-between'>
                        <div>
                          <p className='text-2xl font-bold'>{latest.combined_score != null ? Math.round(latest.combined_score) : '—'}</p>
                          <p className='text-[10px] text-muted-foreground'>{new Date(latest.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                        </div>
                        <div className='text-right'>
                          <Badge variant={READINESS_BAND_VARIANT[band] || 'outline'} className='text-[10px]'>{READINESS_BAND_LABEL[band] || band}</Badge>
                          <p className='text-[10px] text-muted-foreground mt-1'>ACWR {latest.acwr != null ? latest.acwr.toFixed(2) : '—'}</p>
                        </div>
                      </div>
                      <Separator />
                      <div className='space-y-1'>
                        {readinessScores.slice(1, 6).map(r => (
                          <div key={r.date} className='flex items-center justify-between text-[10px] text-muted-foreground'>
                            <span>{new Date(r.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                            <span>{r.combined_score != null ? Math.round(r.combined_score) : '—'}</span>
                            <Badge variant={READINESS_BAND_VARIANT[r.band || 'dato_insuficiente'] || 'outline'} className='text-[9px] px-1.5 py-0'>{READINESS_BAND_LABEL[r.band || 'dato_insuficiente'] || r.band}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) })()
                  : <p className='text-center text-muted-foreground text-xs py-3'>Sin datos de readiness todavía</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'><CardTitle className='text-sm flex items-center gap-2'><TrophyIcon className='size-4' /> Feed de logros</CardTitle></CardHeader>
                <CardContent>
                  {achievementEventsLoading ? <div className='flex justify-center py-4'><div className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                  : achievementEvents.length > 0 ? (
                    <div className='max-h-[320px] overflow-y-auto overflow-x-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className='text-[10px]'>Fecha</TableHead>
                            <TableHead className='text-[10px]'>Tipo</TableHead>
                            <TableHead className='text-[10px]'>Ejercicio</TableHead>
                            <TableHead className='text-[10px]'>Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {achievementEvents.map(ev => (
                            <TableRow key={ev.id}>
                              <TableCell className='text-[10px] whitespace-nowrap'>{new Date(ev.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                              <TableCell className='text-[10px]'>{ACHIEVEMENT_TYPE_LABELS[ev.type] || ev.type}</TableCell>
                              <TableCell className='text-[10px]'>{ev.exercise?.title || '—'}</TableCell>
                              <TableCell className='text-[10px] whitespace-nowrap'>
                                {ev.value ?? '—'}{ev.previous_best != null && <span className='text-muted-foreground'> (antes {ev.previous_best})</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : <p className='text-center text-muted-foreground text-xs py-3'>Aún no hay logros registrados</p>}
                </CardContent>
              </Card>
              {/* Sugerencias de progresión pendientes del Motor de Auto-Regulación
                  (sugerencia_carga/estancamiento) para este cliente -- reutiliza el
                  mismo componente ya conectado del Dashboard general (variant="compact"
                  + clientId, ver docs/Plan_Cierre_Motor_UI.md §2.2, nunca se había
                  enlazado aquí). Aprobar/editar/rechazar ya funciona de verdad. */}
              <CoachExceptionsCard clientId={userId} variant='compact' />
              <Card>
                <CardHeader className='pb-2 flex flex-row items-center justify-between space-y-0'><CardTitle className='text-sm flex items-center gap-2'><CameraIcon className='size-4' /> Fotos de progreso</CardTitle><Button variant='ghost' size='sm' className='h-6 text-xs' onClick={() => goToTab('photos')}>Ver todo</Button></CardHeader>
                <CardContent>
                  {latestPhotos.length > 0 ? <div className='grid grid-cols-2 gap-2'>{latestPhotos.map(p => <div key={p.id} className='rounded-md overflow-hidden border aspect-square cursor-pointer' onClick={() => setPreviewPhoto(p)}><img src={p.url} alt={p.name} loading='lazy' decoding='async' className='w-full h-full object-cover' /></div>)}</div> : <p className='text-center text-muted-foreground text-xs py-3'>Aún no hay fotos</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ TRAINING ═══ */}
        {activeTab === 'training' && (<div className='grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4'>
          <Card className='h-fit'><CardContent className='p-2 space-y-1'>{([['calendar', 'Calendario', CalendarIcon], ['history', 'Historial de ejercicios', HistoryIcon], ['completed', 'Entrenamientos completados', TrophyIcon], ['adherence', 'Adherencia', FlameIcon], ['feedback', 'Feedback de sesión', MessageSquareIcon], ['volume', 'Volumen del entrenamiento', BarChart3Icon]] as const).map(([val, label, Icon]) => (<button key={val} type='button' onClick={() => setTrainingSubTab(val)} className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors text-left', trainingSubTab === val ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')}><Icon className='size-4' /> {label}</button>))}</CardContent></Card>
          <div className='space-y-4'>
            {trainingSubTab === 'calendar' && (<Card>
              <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-3'><div className='flex items-center gap-3 flex-wrap'><CalendarIcon className='size-5 text-muted-foreground' /><CardTitle className='text-base'>Calendario de entrenamiento</CardTitle>{calClipboard && <span className='text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1'><CopyIcon className='size-3' /> Copiado</span>}</div>
                <div className='flex items-center gap-2 flex-wrap'><Button variant='outline' size='sm' className='flex-1 sm:flex-initial' onClick={() => { setAssignDate(''); setAssignTemplateId(''); setAssignDialogOpen(true) }}><PlusIcon className='size-3.5 mr-1' /> Importar workout</Button><Button size='sm' className='flex-1 sm:flex-initial' onClick={() => { setImportStartDate(''); setImportProgramId(''); setImportDialogOpen(true) }}><DownloadIcon className='size-3.5 mr-1' /> Asignar programa</Button></div></CardHeader>
              <CardContent>
                <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4'>
                  <div className='flex items-center gap-2'><Button variant='outline' size='sm' onClick={goToToday}>Hoy</Button><div className='flex items-center'><Button variant='outline' size='icon' className='rounded-r-none h-8 w-8' onClick={prevCal}><ChevronLeftIcon className='size-4' /></Button><div className='h-8 px-3 border-y flex items-center text-sm font-medium min-w-[100px] justify-center bg-background'>{calViewMode === 'week' ? formatWeekRange(calWeeks[calWeekIndex] || []) : `${MONTH_NAMES[calMonth - 1]} ${calYear}`}</div><Button variant='outline' size='icon' className='rounded-l-none h-8 w-8' onClick={nextCal}><ChevronRightIcon className='size-4' /></Button></div></div>
                  <div className='flex items-center bg-muted rounded-lg p-1'>{(['week', 'month'] as const).map(m => <button key={m} type='button' onClick={() => setCalViewMode(m)} className={cn('px-3 py-1 text-xs rounded-md transition-colors', calViewMode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>)}</div>
                  <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                    <span className='flex items-center gap-1'><span className='inline-block size-2.5 rounded-sm border border-green-500 bg-green-500/20' /> Realizado</span>
                    <span className='flex items-center gap-1'><span className='inline-block size-2.5 rounded-sm border bg-card' /> Pendiente</span>
                  </div>
                </div>
                {calLoading ? <div className='flex items-center justify-center py-20'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                : calDays.length === 0 ? <div className='rounded-lg border border-dashed p-12 text-center'><DumbbellIcon className='size-10 mx-auto text-muted-foreground/40 mb-3' /><p className='text-sm text-muted-foreground'>No hay entrenamientos programados este mes.</p><Button size='sm' className='mt-3' onClick={() => { setAssignDate(calCells.find(Boolean) || ''); setAssignTemplateId(''); setAssignDialogOpen(true) }}><PlusIcon className='size-3 mr-1' /> Importar workout</Button></div>
                : <div className='overflow-x-auto'><div className='space-y-4 min-w-[700px]'><div className='grid grid-cols-7 border-b'>{CAL_DAYS.map(d => <div key={d} className='py-2 text-center text-xs font-medium text-muted-foreground'>{d}</div>)}</div>{calViewMode === 'month' ? calWeeks.map((week, wi) => <div key={wi} className='rounded-lg border bg-card overflow-hidden'><div className='grid grid-cols-7 divide-x'>{week.map((ds, di) => renderCalendarDay(ds, `${wi}-${di}`))}</div></div>) : <div className='rounded-lg border bg-card overflow-hidden'><div className='grid grid-cols-7 divide-x'>{(calWeeks[calWeekIndex] || []).map((ds, di) => renderCalendarDay(ds, `week-${di}`))}</div></div>}</div></div>}
              </CardContent>
            </Card>)}
            {trainingSubTab === 'history' && (
              records.length === 0 ? (
                <Card><CardContent className='py-12'><div className='flex flex-col items-center text-muted-foreground'><HistoryIcon className='size-12 mb-4 opacity-50' /><p>Aún no hay historial de entrenamiento</p></div></CardContent></Card>
              ) : (
                <div className='grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4'>
                  <Card className='h-fit'>
                    <CardHeader className='pb-2'>
                      <CardTitle className='text-sm flex items-center gap-2'><HistoryIcon className='size-4' /> Ejercicios</CardTitle>
                      <Input placeholder='Buscar ejercicio...' value={historySearch} onChange={e => setHistorySearch(e.target.value)} className='h-8 text-xs mt-1' />
                    </CardHeader>
                    <CardContent className='p-2 space-y-1 max-h-[520px] overflow-y-auto'>
                      {filteredHistoryGroups.map(g => (
                        <button
                          key={g.exercise_id}
                          type='button'
                          onClick={() => setSelectedHistoryExerciseId(g.exercise_id)}
                          className={cn(
                            'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
                            (selectedHistoryGroup?.exercise_id === g.exercise_id) ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          )}
                        >
                          <span className='truncate'>{g.title}</span>
                          <Badge variant='outline' className='text-[10px] shrink-0'>{g.entries.length}</Badge>
                        </button>
                      ))}
                      {filteredHistoryGroups.length === 0 && (
                        <p className='text-center text-xs text-muted-foreground py-6'>Sin resultados</p>
                      )}
                    </CardContent>
                  </Card>

                  {selectedHistoryGroup && (
                    <div className='space-y-4'>
                      <Card>
                        <CardHeader className='pb-2'>
                          <CardTitle className='text-base'>{selectedHistoryGroup.title}</CardTitle>
                          <p className='text-xs text-muted-foreground'>{selectedHistoryGroup.entries.length} series registradas</p>
                        </CardHeader>
                        <CardContent>
                          {historyChartData.length > 1 ? (
                            <Suspense fallback={<ChartFallback height={220} />}>
                              <ExerciseHistoryChart data={historyChartData} />
                            </Suspense>
                          ) : (
                            <p className='text-center text-sm text-muted-foreground py-8'>Aún no hay suficientes series registradas para ver una progresión.</p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className='pb-2'><CardTitle className='text-sm'>Series registradas</CardTitle></CardHeader>
                        <CardContent className='p-0'>
                          <Table>
                            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Peso</TableHead><TableHead>Repeticiones</TableHead><TableHead>1RM</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {selectedHistoryGroup.entries.map(r => (
                                <TableRow key={r.id}>
                                  <TableCell>{r.date}</TableCell>
                                  <TableCell>{r.weight ?? '—'} kg</TableCell>
                                  <TableCell>{r.reps ?? '—'}</TableCell>
                                  <TableCell>{r.one_rm ?? '—'} kg</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )
            )}
            {trainingSubTab === 'completed' && (<Card><CardHeader><CardTitle className='text-base flex items-center gap-2'><TrophyIcon className='size-4' /> Entrenamientos completados</CardTitle></CardHeader><CardContent>
              {completedSessionsLoading ? <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
              : completedSessions.length > 0 ? <div className='space-y-3'>{completedSessions.map(s => (
                <div key={s.id} className='flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer' onClick={() => setSelectedCompletedSession(s)}>
                  <div className='size-12 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden'>{s.thumbnail ? <img src={s.thumbnail} alt='' className='w-full h-full object-cover' /> : <DumbbellIcon className='size-5 text-muted-foreground/50' />}</div>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium truncate'>{s.title}</p>
                    <div className='flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap'>
                      <span>{s.date ? new Date(s.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                      {s.duration_seconds != null && <span>· {Math.round(s.duration_seconds / 60)} min</span>}
                      {s.volume_kg != null && <span>· {s.volume_kg} kg</span>}
                      {s.difficulty_label && <Badge variant='secondary' className='text-[10px] h-4'>{s.difficulty_label}</Badge>}
                    </div>
                  </div>
                  <CheckCircleIcon className='size-5 text-green-500 shrink-0' />
                </div>
              ))}</div>
              : <div className='flex flex-col items-center py-12 text-muted-foreground'><TrophyIcon className='size-12 mb-4 opacity-50' /><p>Aún no hay entrenamientos completados</p></div>}
            </CardContent></Card>)}
            {trainingSubTab === 'adherence' && (<Card><CardHeader><CardTitle className='text-base flex items-center gap-2'><FlameIcon className='size-4' /> Adherencia (últimos 30 días)</CardTitle></CardHeader><CardContent>
              {adherenceLoading ? <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
              : !adherence ? <div className='flex flex-col items-center py-12 text-muted-foreground'><FlameIcon className='size-12 mb-4 opacity-50' /><p>Sin datos de adherencia todavía</p></div>
              : adherence.mode === 'program' ? (
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='text-3xl font-bold'>{adherence.ratio !== null ? Math.round(adherence.ratio * 100) : '—'}%</p>
                      <p className='text-sm text-muted-foreground mt-1'>{adherence.completedCount}/{adherence.scheduledCount} entrenamientos programados completados</p>
                    </div>
                    <Badge variant='secondary' className='flex items-center gap-1.5 text-sm px-3 py-1.5'><FlameIcon className='size-4 text-orange-500' /> {adherence.currentStreak}</Badge>
                  </div>
                  {adherence.days.length > 0 && (
                    <div className='flex flex-wrap gap-1'>
                      {adherence.days.map(d => (
                        <div key={d.date} title={`${d.date}: ${d.completed ? 'completado' : 'no completado'}`} className={cn('size-3 rounded-sm', d.completed ? 'bg-green-500' : 'bg-muted border')} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-3xl font-bold'>{adherence.sessionsCount}</p>
                    <p className='text-sm text-muted-foreground mt-1'>entrenamientos en {adherence.periodDays} días · {adherence.daysActive} días activos</p>
                    <p className='text-xs text-muted-foreground mt-1'>Sin programa asignado — no hay días programados con qué comparar.</p>
                  </div>
                  <Badge variant='secondary' className='flex items-center gap-1.5 text-sm px-3 py-1.5'><FlameIcon className='size-4 text-orange-500' /> {adherence.currentStreak}</Badge>
                </div>
              )}
            </CardContent></Card>)}
            {trainingSubTab === 'feedback' && (<div className='space-y-4'>
              <Card><CardHeader><CardTitle className='text-base flex items-center gap-2'><ClipboardCheckIcon className='size-4' /> Chequeo diario de preparación (antes de entrenar)</CardTitle></CardHeader><CardContent>{readinessLoading ? <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div> : readinessChecks.length > 0 ? <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Sueño</TableHead><TableHead>Agujetas</TableHead><TableHead>Energía</TableHead><TableHead>Estrés</TableHead></TableRow></TableHeader><TableBody>{readinessChecks.map(c => <TableRow key={c.id}><TableCell className='text-sm'>{c.date ? new Date(c.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</TableCell><TableCell>{c.sleep_quality != null ? `${c.sleep_quality}/5` : '—'}</TableCell><TableCell>{c.soreness_level != null ? `${c.soreness_level}/10` : '—'}</TableCell><TableCell>{c.energy_level != null ? `${c.energy_level}/5` : '—'}</TableCell><TableCell>{c.stress_level != null ? `${c.stress_level}/5` : '—'}</TableCell></TableRow>)}</TableBody></Table> : <div className='flex flex-col items-center py-12 text-muted-foreground'><ClipboardCheckIcon className='size-12 mb-4 opacity-50' /><p>Sin chequeos de preparación registrados todavía</p></div>}</CardContent></Card>
              <Card><CardHeader><CardTitle className='text-base flex items-center gap-2'><MessageSquareIcon className='size-4' /> Feedback post-entrenamiento</CardTitle></CardHeader><CardContent>{feedbackLoading ? <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div> : sessionReviews.length > 0 ? <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Workout</TableHead><TableHead>Duración</TableHead><TableHead>Volumen</TableHead><TableHead>Calorías</TableHead><TableHead>Dificultad</TableHead><TableHead>Comentario</TableHead></TableRow></TableHeader><TableBody>{sessionReviews.map(r => <TableRow key={r.id}><TableCell className='text-sm'>{r.date ? new Date(r.date).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell><TableCell className='font-medium text-sm'>{r.workout_title || '—'}</TableCell><TableCell>{r.duration_seconds != null ? `${Math.round(r.duration_seconds / 60)} min` : '—'}</TableCell><TableCell>{r.volume_kg != null ? `${r.volume_kg} kg` : '—'}</TableCell><TableCell>{r.calories_burned != null ? `${r.calories_burned} kcal` : '—'}</TableCell><TableCell>{r.difficulty_rating ? `${r.difficulty_rating}/5` : '—'}</TableCell><TableCell className='text-sm text-muted-foreground max-w-[240px] truncate'>{r.comment || '—'}</TableCell></TableRow>)}</TableBody></Table> : <div className='flex flex-col items-center py-12 text-muted-foreground'><MessageSquareIcon className='size-12 mb-4 opacity-50' /><p>Sin feedback de sesiones todavía</p></div>}</CardContent></Card>
              <Card><CardHeader><CardTitle className='text-base flex items-center gap-2'><FileTextIcon className='size-4' /> Notas por ejercicio</CardTitle></CardHeader><CardContent>{exerciseNotes.length > 0 ? <div className='space-y-2'>{exerciseNotes.map(n => <button key={n.id} type='button' onClick={() => handleOpenSessionForNote(n)} className='w-full text-left rounded-lg border p-3 hover:bg-muted/30 hover:border-primary/30 transition-colors'><div className='flex items-center justify-between mb-1'><p className='text-sm font-medium'>{n.exercise_title}</p><p className='text-xs text-muted-foreground'>{n.date ? new Date(n.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}</p></div><p className='text-sm text-muted-foreground'>{n.notes}</p></button>)}</div> : <p className='text-center text-muted-foreground py-8'>Sin notas de ejercicios todavía</p>}</CardContent></Card>
            </div>)}
            {trainingSubTab === 'volume' && (
              records.length === 0 ? (
                <Card><CardContent className='py-12'><div className='flex flex-col items-center text-muted-foreground'><BarChart3Icon className='size-12 mb-4 opacity-50' /><p>Aún no hay series registradas para calcular volumen</p></div></CardContent></Card>
              ) : (
                <div className='space-y-4'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Select value={volumeWindow} onValueChange={v => setVolumeWindow(v as typeof volumeWindow)}>
                      <SelectTrigger className='h-8 w-[190px]'><SelectValue placeholder='Ventana de tiempo' /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value='all'>Todo el tiempo</SelectItem>
                        <SelectItem value='week'>Semanal (7 días)</SelectItem>
                        <SelectItem value='month'>Mensual (30 días)</SelectItem>
                        <SelectItem value='quarter'>Trimestral (90 días)</SelectItem>
                        <SelectItem value='semester'>Semestral (180 días)</SelectItem>
                        <SelectItem value='custom'>Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                    {volumeWindow === 'custom' && (
                      <div className='flex items-center gap-1.5'>
                        <Input type='number' min={1} max={60} value={customMonths} onChange={e => setCustomMonths(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} className='h-8 w-16 text-xs' />
                        <span className='text-xs text-muted-foreground'>meses</span>
                      </div>
                    )}
                    <span className='text-xs text-muted-foreground'>{volumeByDate.length} días con datos en la ventana</span>
                    <div className='flex items-center gap-2 ml-auto'>
                      <Switch id='multiplier-switch' checked={multiplierEnabled} onCheckedChange={setMultiplierEnabled} />
                      <label htmlFor='multiplier-switch' className='text-xs text-muted-foreground cursor-pointer'>Reparto EMG por músculos secundarios</label>
                    </div>
                  </div>

                  <div className='grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4'>
                  <Card className='h-fit'>
                    <CardHeader className='pb-2'>
                      <CardTitle className='text-sm flex items-center gap-2'><BarChart3Icon className='size-4' /> Grupos musculares</CardTitle>
                      <Input placeholder='Buscar grupo...' value={muscleSearch} onChange={e => setMuscleSearch(e.target.value)} className='h-8 text-xs mt-1' />
                    </CardHeader>
                    <CardContent className='p-2 space-y-1 max-h-[520px] overflow-y-auto'>
                      {filteredMuscleGroups.map(g => (
                        <button
                          key={g.group}
                          type='button'
                          onClick={() => setSelectedMuscleGroup(g.group)}
                          className={cn(
                            'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
                            g.volume === 0 && 'opacity-55',
                            selectedMuscle?.group === g.group ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          )}
                        >
                          <span className='truncate capitalize'>{g.group}</span>
                          <Badge variant='outline' className='text-[10px] shrink-0'>{g.volume.toLocaleString('es-ES')} kg</Badge>
                        </button>
                      ))}
                      {filteredMuscleGroups.length === 0 && (
                        <p className='text-center text-xs text-muted-foreground py-6'>Sin resultados</p>
                      )}
                    </CardContent>
                  </Card>

                  <div className='space-y-4'>
                    {unclassifiedRecords > 0 && !volumeLoading && (
                      <div className='flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200'>
                        <AlertTriangleIcon className='size-4 shrink-0 mt-0.5' />
                        <p>
                          {unclassifiedRecords} series no se han podido asignar a un grupo muscular.
                          {muscleStats && <> Catálogo: {muscleStats.catalogSize} ejercicios cargados, {muscleStats.exercisesWithBodyparts} con grupo asignado.</>}
                        </p>
                      </div>
                    )}

                    <div className='grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4'>
                      <Card>
                        <CardHeader className='pb-2'>
                          <CardTitle className='text-sm flex items-center gap-2'><DumbbellIcon className='size-4' /> Mapa muscular</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {volumeLoading ? <ChartFallback height={280} /> : (
                            <Suspense fallback={<ChartFallback height={280} />}><MuscleBodyHeatmap data={volumeByMuscle} /></Suspense>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className='pb-2'>
                          <CardTitle className='text-base flex items-center gap-2'><BarChart3Icon className='size-4' /> Volumen total por entrenamiento</CardTitle>
                          <p className='text-xs text-muted-foreground'>{totalTrainingVolume.toLocaleString('es-ES')} kg acumulados · {volumeByDate.length} días</p>
                        </CardHeader>
                        <CardContent>
                          {volumeLoading ? <ChartFallback height={220} /> : volumeByDate.length > 0 ? (
                            <Suspense fallback={<ChartFallback height={220} />}><TotalVolumeChart data={volumeByDate} /></Suspense>
                          ) : <p className='text-center text-sm text-muted-foreground py-8'>Sin datos de volumen</p>}
                        </CardContent>
                      </Card>
                    </div>

                    {selectedMuscle ? (
                      <Card>
                        <CardHeader className='pb-2'>
                          <CardTitle className='text-base capitalize'>{selectedMuscle.group}</CardTitle>
                          <p className='text-xs text-muted-foreground'>{selectedMuscle.volume.toLocaleString('es-ES')} kg de volumen acumulado</p>
                        </CardHeader>
                        <CardContent>
                          {selectedMuscleOverTime.length > 1 ? (
                            <Suspense fallback={<ChartFallback height={220} />}><MuscleVolumeOverTimeChart data={selectedMuscleOverTime} /></Suspense>
                          ) : (
                            <p className='text-center text-sm text-muted-foreground py-8'>Aún no hay suficiente volumen registrado para este grupo.</p>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardHeader className='pb-2'><CardTitle className='text-base flex items-center gap-2'><DumbbellIcon className='size-4' /> Volumen por grupo muscular</CardTitle></CardHeader>
                        <CardContent>
                          {volumeLoading ? <ChartFallback height={220} /> : volumeByMuscle.length > 0 ? (
                            <div className='space-y-4'>
                              <div className='flex flex-wrap gap-1.5'>
                                {volumeByMuscle.map(g => (
                                  <button
                                    key={g.group}
                                    type='button'
                                    onClick={() => toggleMuscle(g.group)}
                                    className={cn('px-2.5 py-1 text-xs rounded-full border transition-colors capitalize', hiddenMuscles[g.group] ? 'border-border text-muted-foreground/50 bg-muted/40 line-through' : g.volume === 0 ? 'border-dashed border-border text-muted-foreground/70 hover:bg-muted' : 'border-border bg-muted/60 text-foreground hover:bg-muted')}
                                  >
                                    {g.group}
                                  </button>
                                ))}
                              </div>
                              {visibleMuscleGroups.length === 0 ? (
                                <p className='text-center text-sm text-muted-foreground py-8'>Todos los grupos ocultados. Pulsa un grupo para volver a mostrarlo.</p>
                              ) : (
                                <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                                  <Suspense fallback={<ChartFallback height={220} />}><MuscleVolumeChart data={visibleMuscleGroups} /></Suspense>
                                  <Table>
                                    <TableHeader><TableRow><TableHead>Grupo muscular</TableHead><TableHead className='text-right'>Volumen</TableHead></TableRow></TableHeader>
                                    <TableBody>{visibleMuscleGroups.map(v => (
                                      <TableRow key={v.group}><TableCell className='font-medium capitalize'>{v.group}</TableCell><TableCell className='text-right'>{v.volume.toLocaleString('es-ES')} kg</TableCell></TableRow>
                                    ))}</TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          ) : <p className='text-center text-sm text-muted-foreground py-8'>No se pudo clasificar los ejercicios por grupo muscular</p>}
                        </CardContent>
                      </Card>
                    )}

                    {visibleMuscleGroupNames.length > 0 && visibleVolumeByDateAndMuscle.length > 1 && (
                      <Card>
                        <CardHeader className='pb-2'><CardTitle className='text-base flex items-center gap-2'><ActivityIcon className='size-4' /> Volumen por grupo muscular a lo largo del tiempo</CardTitle></CardHeader>
                        <CardContent>
                          <Suspense fallback={<ChartFallback height={300} />}><MuscleVolumeStackedChart data={visibleVolumeByDateAndMuscle} groups={visibleMuscleGroupNames} /></Suspense>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader className='pb-2'>
                        <CardTitle className='text-base flex items-center gap-2'><BarChart3Icon className='size-4' /> Comparar grupos musculares</CardTitle>
                        <p className='text-xs text-muted-foreground'>Selecciona los músculos que quieras comparar en la gráfica de líneas</p>
                      </CardHeader>
                      <CardContent>
                        <div className='flex flex-wrap gap-1.5 mb-4'>
                          {volumeByMuscle.map(g => {
                            const active = compareMuscles.includes(g.group)
                            return (
                              <button
                                key={g.group}
                                type='button'
                                onClick={() => toggleCompare(g.group)}
                                className={cn('px-2.5 py-1 text-xs rounded-full border transition-colors capitalize', active ? 'border-primary/40 bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground/60 hover:bg-muted hover:text-foreground')}
                              >
                                {g.group}
                              </button>
                            )
                          })}
                        </div>
                        {compareMuscles.length === 0 ? (
                          <p className='text-center text-sm text-muted-foreground py-8'>Selecciona al menos un grupo muscular para comparar</p>
                        ) : compareHasData ? (
                          <Suspense fallback={<ChartFallback height={300} />}><MuscleVolumeCompareChart data={compareData} groups={compareMuscles} /></Suspense>
                        ) : (
                          <p className='text-center text-sm text-muted-foreground py-8'>Sin volumen registrado en la ventana para los grupos seleccionados</p>
                        )}
                        {compareMuscles.length > 0 && (
                          <div className='mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2'>
                            {compareTotals.map(t => (
                              <div key={t.group} className='rounded-lg border bg-muted/30 px-3 py-2'>
                                <p className='text-[10px] text-muted-foreground capitalize truncate'>{t.group}</p>
                                <p className='text-sm font-semibold'>{t.volume.toLocaleString('es-ES')} kg</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className='pb-2'>
                        <div className='flex items-center justify-between gap-2'>
                          <CardTitle className='text-base flex items-center gap-2'><AlertTriangleIcon className='size-4' /> Inventario del catálogo de ejercicios</CardTitle>
                          <Button variant='outline' size='sm' className='h-7 text-xs' onClick={() => setShowCatalogDiagnostic(s => !s)}>
                            {showCatalogDiagnostic ? 'Ocultar' : 'Ver detalles'}
                          </Button>
                        </div>
                        <p className='text-xs text-muted-foreground'>{catalogEntries.length} ejercicios · {catalogEntries.length - catalogWithoutGroup.length} con grupo asignado · {catalogWithoutGroup.length} sin asignar</p>
                      </CardHeader>
                      {showCatalogDiagnostic && (
                        <CardContent className='space-y-4'>
                          <div>
                            <p className='text-xs font-medium mb-2'>Ejercicios por grupo muscular</p>
                            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5'>
                              {catalogGroupCounts.map(([g, n]) => (
                                <div key={g} className='flex items-center justify-between rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs'>
                                  <span className='truncate capitalize'>{g}</span>
                                  <Badge variant='outline' className='text-[10px] shrink-0 ml-1'>{n}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className='text-xs font-medium mb-2'>Ejercicios sin grupo asignado ({catalogWithoutGroup.length})</p>
                            {catalogWithoutGroup.length > 0 ? (
                              <div className='max-h-56 overflow-y-auto rounded-md border divide-y divide-border'>
                                {catalogWithoutGroup.map(e => (
                                  <div key={e.id} className='flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs'>
                                    <span className='truncate'>{e.title}</span>
                                    <span className='text-muted-foreground shrink-0'>#{e.id}</span>
                                  </div>
                                ))}
                              </div>
                            ) : <p className='text-xs text-muted-foreground'>Todos los ejercicios tienen grupo asignado.</p>}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  </div>
                </div>
                </div>
              )
            )}
          </div>
        </div>)}

        {/* ═══ ONBOARDING ═══ */}
        {activeTab === 'onboarding' && (<div className='space-y-4'>
          {onboardingLoading ? <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div> : onboarding ? (<>
            <Card><CardContent className='pt-4 flex flex-wrap items-center gap-4'>
              <div className='flex items-center gap-2'><span className='text-sm text-muted-foreground'>Estado:</span><Badge variant={onboarding.onboarding_completed ? 'default' : 'secondary'}>{onboarding.onboarding_completed ? 'Completado' : 'Pendiente'}</Badge>{onboarding.onboarding_completed_at && <span className='text-xs text-muted-foreground'>{new Date(onboarding.onboarding_completed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}</div>
              {onboarding.flagged_for_review && <div className='flex items-center gap-2'><Badge variant='destructive' className='gap-1'><AlertTriangleIcon className='size-3' /> Marcado para revisión (riesgo cardíaco PAR-Q)</Badge>{onboarding.flagged_for_review_at && <span className='text-xs text-muted-foreground'>{new Date(onboarding.flagged_for_review_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}</div>}
            </CardContent></Card>

            <Card><CardHeader><CardTitle className='text-base flex items-center gap-2'><HeartIcon className='size-4' /> PAR-Q (cuestionario de salud)</CardTitle></CardHeader><CardContent>
              {onboarding.par_q ? (<div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm'>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>¿Condición cardíaca conocida?</span>{yesNoBadge(onboarding.par_q.parq_heart_condition, true)}</div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>¿Dolor en el pecho con actividad?</span>{yesNoBadge(onboarding.par_q.parq_chest_pain_activity, true)}</div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>¿Dolor en el pecho en reposo (último mes)?</span>{yesNoBadge(onboarding.par_q.parq_chest_pain_rest_last_month, true)}</div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>¿Mareos o pérdida de equilibrio?</span>{yesNoBadge(onboarding.par_q.parq_dizziness_balance, true)}</div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>¿Problema óseo o articular?</span>{yesNoBadge(onboarding.par_q.parq_bone_joint_problem)}</div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>¿Medicación para tensión/corazón?</span>{yesNoBadge(onboarding.par_q.parq_bp_or_heart_medication)}</div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>¿Otra razón para no hacer ejercicio?</span>{yesNoBadge(onboarding.par_q.parq_reason_not_to_exercise)}</div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Nivel de forma física autopercibido</span><span className='font-medium'>{onboarding.par_q.parq_fitness_level ?? '—'}/10</span></div>
                {onboarding.par_q.parq_medical_history && <div className='sm:col-span-2 pt-2 border-t'><p className='text-muted-foreground mb-1'>Historial médico</p><p className='whitespace-pre-wrap'>{onboarding.par_q.parq_medical_history}</p></div>}
                {onboarding.par_q.parq_goals && <div className='sm:col-span-2 pt-2 border-t'><p className='text-muted-foreground mb-1'>Objetivos</p><p className='whitespace-pre-wrap'>{onboarding.par_q.parq_goals}</p></div>}
              </div>) : <p className='text-center text-muted-foreground text-sm py-6'>Sin respuestas de PAR-Q todavía</p>}
            </CardContent></Card>

            <Card><CardHeader><CardTitle className='text-base flex items-center gap-2'><DumbbellIcon className='size-4' /> Cuestionario de entrenamiento</CardTitle></CardHeader><CardContent>
              {onboarding.training_questionnaire ? (<div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm'>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Objetivo</span><span className='font-medium'>{prettify(onboarding.training_questionnaire.goal_type)}</span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Nivel de actividad</span><span className='font-medium'>{prettify(onboarding.training_questionnaire.activity_level)}</span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Estilo de vida</span><span className='font-medium'>{prettify(onboarding.training_questionnaire.lifestyle_type)}</span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Experiencia entrenando</span><span className='font-medium flex items-center gap-1.5'>{onboarding.training_questionnaire.training_experience_months ?? '—'} meses<Button variant='ghost' size='sm' className='h-5 w-5 p-0' title='Corregir experiencia' onClick={() => { setTrainingExpForm({ training_experience_months: onboarding.training_questionnaire?.training_experience_months != null ? String(onboarding.training_questionnaire.training_experience_months) : '', technique_level: onboarding.training_questionnaire?.technique_level != null ? String(onboarding.training_questionnaire.technique_level) : '' }); setTrainingExpDialogOpen(true) }}><PencilIcon className='size-3' /></Button></span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Días de entrenamiento/semana</span><span className='font-medium'>{onboarding.training_questionnaire.training_days_per_week ?? '—'}</span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Duración de sesión preferida</span><span className='font-medium'>{prettify(onboarding.training_questionnaire.session_duration_preference)}</span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Mentalidad de entrenamiento</span><span className='font-medium'>{prettify(onboarding.training_questionnaire.training_mindset)}</span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Coaching previo</span><span className='font-medium'>{prettify(onboarding.training_questionnaire.previous_coaching)}</span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Rutina actual</span><span className='font-medium'>{prettify(onboarding.training_questionnaire.current_routine_style)}</span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Split semanal preferido</span><span className='font-medium'>{prettify(onboarding.training_questionnaire.weekly_split_preference)}</span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Nivel de técnica</span><span className='font-medium'>{onboarding.training_questionnaire.technique_level ?? '—'}/10</span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Objetivo realista</span><span className='font-medium'>{prettify(onboarding.training_questionnaire.realistic_goal)}</span></div>
              </div>) : <p className='text-center text-muted-foreground text-sm py-6'>Sin respuestas del cuestionario de entrenamiento todavía</p>}
            </CardContent></Card>

            <Card><CardHeader><CardTitle className='text-base flex items-center gap-2'><UtensilsIcon className='size-4' /> Cuestionario de nutrición</CardTitle></CardHeader><CardContent>
              {onboarding.nutrition_questionnaire ? (<div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm'>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Comidas actuales/día</span><span className='font-medium'>{onboarding.nutrition_questionnaire.current_meals_per_day ?? '—'}</span></div>
                <div className='flex items-center justify-between'><span className='text-muted-foreground'>Comidas deseadas/día</span><span className='font-medium'>{onboarding.nutrition_questionnaire.desired_meals_per_day ?? '—'}</span></div>
                {onboarding.nutrition_questionnaire.typical_day_meals && <div className='sm:col-span-2 pt-2 border-t'><p className='text-muted-foreground mb-1'>Día típico de comidas</p><p className='whitespace-pre-wrap'>{onboarding.nutrition_questionnaire.typical_day_meals}</p></div>}
                {onboarding.nutrition_questionnaire.allergies_intolerances && <div className='sm:col-span-2'><p className='text-muted-foreground mb-1'>Alergias/intolerancias</p><p className='whitespace-pre-wrap'>{onboarding.nutrition_questionnaire.allergies_intolerances}</p></div>}
                {onboarding.nutrition_questionnaire.disliked_foods && <div><p className='text-muted-foreground mb-1'>Alimentos que no le gustan</p><p className='whitespace-pre-wrap'>{onboarding.nutrition_questionnaire.disliked_foods}</p></div>}
                {onboarding.nutrition_questionnaire.liked_foods && <div><p className='text-muted-foreground mb-1'>Alimentos favoritos</p><p className='whitespace-pre-wrap'>{onboarding.nutrition_questionnaire.liked_foods}</p></div>}
                {onboarding.nutrition_questionnaire.favorite_meats && <div><p className='text-muted-foreground mb-1'>Carnes favoritas</p><p className='whitespace-pre-wrap'>{onboarding.nutrition_questionnaire.favorite_meats}</p></div>}
                {onboarding.nutrition_questionnaire.favorite_fish && <div><p className='text-muted-foreground mb-1'>Pescados favoritos</p><p className='whitespace-pre-wrap'>{onboarding.nutrition_questionnaire.favorite_fish}</p></div>}
                {onboarding.nutrition_questionnaire.favorite_fruits_vegetables && <div><p className='text-muted-foreground mb-1'>Frutas/verduras favoritas</p><p className='whitespace-pre-wrap'>{onboarding.nutrition_questionnaire.favorite_fruits_vegetables}</p></div>}
                {onboarding.nutrition_questionnaire.favorite_combined_dishes && <div><p className='text-muted-foreground mb-1'>Platos combinados favoritos</p><p className='whitespace-pre-wrap'>{onboarding.nutrition_questionnaire.favorite_combined_dishes}</p></div>}
              </div>) : <p className='text-center text-muted-foreground text-sm py-6'>Sin respuestas del cuestionario de nutrición todavía</p>}
            </CardContent></Card>
          </>) : <p className='text-center text-muted-foreground text-sm py-12'>No se pudo cargar el onboarding</p>}
        </div>)}

        {/* ═══ CHECK INS ═══ */}
        {activeTab === 'checkins' && (<div className='space-y-4'>
          <div className='flex items-center justify-between border-b pb-2'>
            <div className='flex items-center gap-1 bg-muted/50 rounded-lg p-1'>{([['submissions', 'Entregas', ClipboardListIcon], ['assigned', 'Asignados', CheckSquareIcon]] as const).map(([val, label, Icon]) => <button key={val} type='button' onClick={() => setCheckinsTab(val as any)} className={cn('flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors', checkinsTab === val ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}><Icon className='size-4' /> {label} {val === 'submissions' && <Badge variant='secondary' className='ml-1 text-xs'>{submissions.length}</Badge>}</button>)}</div>
            <Button size='sm' onClick={() => { fetchAvailableForms(); setAssignFormId(''); setAssignFormDialogOpen(true) }}><PlusIcon className='size-3.5 mr-1' /> Añadir check-in</Button>
          </div>
          {checkinsTab === 'submissions' ? (<div className='space-y-4'>
            <div className='grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-[560px]'>
            <Card className='flex flex-col h-full'><CardHeader className='pb-3 space-y-3'><CardTitle className='text-sm text-muted-foreground font-normal'>Check-ins</CardTitle><Select value={submissionFormFilter} onValueChange={v => setSubmissionFormFilter(v ?? 'all')}><SelectTrigger className='w-full'><SelectValue placeholder='Filtrar por formulario' /></SelectTrigger><SelectContent><SelectItem value='all'>Todos los formularios</SelectItem>{availableForms.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.title}</SelectItem>)}</SelectContent></Select></CardHeader>
              <CardContent className='flex-1 p-0'><ScrollArea className='h-[460px] px-5 pb-4'>{submissionsLoading ? <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div> : submissions.length > 0 ? <div className='space-y-1'>{submissions.map(sub => <button key={sub.id} onClick={() => { setSelectedSubmission(sub); setFeedbackText(sub.coach_feedback || '') }} className={cn('w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors', selectedSubmission?.id === sub.id ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' : 'hover:bg-muted/50 border-transparent')}><div className='shrink-0 size-10 rounded-md bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground'>{sub.form_assignment?.form?.title?.charAt(0).toUpperCase() || 'F'}</div><div className='min-w-0 flex-1'><p className='text-sm font-medium truncate'>{sub.form_assignment?.form?.title || `Form #${sub.form_assignment?.form_id}`}</p><p className='text-xs text-muted-foreground'>{formatCheckInDate(sub.submitted_at)}</p></div></button>)}</div> : <div className='flex flex-col items-center justify-center py-12 text-muted-foreground text-sm'><ClipboardListIcon className='size-10 mb-3 opacity-40' /><p>Aún no hay entregas</p></div>}</ScrollArea></CardContent></Card>
            <Card className='h-full flex flex-col'>{selectedSubmission ? (<><CardHeader className='pb-3 border-b'><div className='flex items-center justify-between'><div className='flex items-center gap-3'><div className='size-12 rounded-lg bg-muted flex items-center justify-center text-lg font-medium text-muted-foreground'>{selectedSubmission.form_assignment?.form?.title?.charAt(0).toUpperCase() || 'F'}</div><div><CardTitle className='text-base'>{selectedSubmission.form_assignment?.form?.title || `Form #${selectedSubmission.form_assignment?.form_id}`}</CardTitle><p className='text-xs text-muted-foreground'>{formatCheckInDate(selectedSubmission.submitted_at)}</p></div></div>                    {selectedSubmission.coach_feedback && <Badge variant='outline' className='gap-1'><CheckCircleIcon className='size-3' /> Revisado</Badge>}</div></CardHeader>
              <CardContent className='flex-1 overflow-hidden flex flex-col'><ScrollArea className='flex-1 pr-3 -mr-3'><div className='space-y-6 py-2'>{sortedSubmissionAnswers.map((answer, idx) => { const q = answer.question; if (!q) return null; const rawValue = parseAnswerValue(answer.answer_value); return (<div key={answer.id} className='space-y-2'><div className='flex items-start gap-2'><span className='text-xs font-medium text-muted-foreground bg-muted rounded-full size-5 flex items-center justify-center shrink-0 mt-0.5'>{idx + 1}</span><p className='text-sm font-medium'>{q.question_text}{q.is_required && <span className='text-destructive ml-1'>*</span>}</p></div><div className='pl-7'>{renderAnswer(q, rawValue)}</div></div>)})}</div></ScrollArea><Separator className='my-4' /><div className='space-y-3 shrink-0'><div className='flex items-center gap-2'><MessageSquareIcon className='size-4 text-primary' /><p className='text-sm font-medium'>Revisar check-in</p></div><Textarea placeholder='Comparte tus comentarios...' value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={3} className='resize-none text-sm' /><div className='flex justify-end'><Button size='sm' onClick={handleFeedbackSubmit} disabled={!feedbackText.trim() || savingFeedback}>{savingFeedback ? 'Guardando...' : 'Enviar revisión'}</Button></div></div></CardContent></>) : <div className='flex-1 flex flex-col items-center justify-center text-muted-foreground py-12'><ClipboardListIcon className='size-12 mb-4 opacity-40' /><p>Selecciona una entrega</p></div>}</Card>
            </div>
            <Card><CardHeader className='pb-2'><CardTitle className='text-base flex items-center gap-2'><ClipboardCheckIcon className='size-4' /> Chequeo diario de preparación</CardTitle><p className='text-xs text-muted-foreground'>Sistema aparte (sueño/agujetas/energía/estrés) que el cliente rellena antes de cada entrenamiento — no es un formulario editable, ver pestaña Asignados para su estado.</p></CardHeader><CardContent>{readinessLoading ? <div className='flex justify-center py-8'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div> : readinessChecks.length > 0 ? <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Sueño</TableHead><TableHead>Agujetas</TableHead><TableHead>Energía</TableHead><TableHead>Estrés</TableHead></TableRow></TableHeader><TableBody>{readinessChecks.slice(0, 10).map(c => <TableRow key={c.id}><TableCell className='text-sm'>{c.date ? new Date(c.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</TableCell><TableCell>{c.sleep_quality != null ? `${c.sleep_quality}/5` : '—'}</TableCell><TableCell>{c.soreness_level != null ? `${c.soreness_level}/10` : '—'}</TableCell><TableCell>{c.energy_level != null ? `${c.energy_level}/5` : '—'}</TableCell><TableCell>{c.stress_level != null ? `${c.stress_level}/5` : '—'}</TableCell></TableRow>)}</TableBody></Table> : <p className='text-center text-muted-foreground text-sm py-6'>Sin chequeos de preparación registrados todavía</p>}</CardContent></Card>
          </div>) : (<div className='space-y-4'>
            <Card><CardHeader className='pb-2'><CardTitle className='text-base flex items-center gap-2'><ClipboardCheckIcon className='size-4' /> Chequeo diario de preparación</CardTitle></CardHeader><CardContent>
              <div className='flex items-center justify-between rounded-lg border p-3'>
                <div><p className='text-sm font-medium'>Antes de cada entrenamiento</p><p className='text-xs text-muted-foreground'>Sistema fijo (no es un formulario editable) — sueño, agujetas, energía y estrés</p></div>
                <div className='flex items-center gap-3'>
                  <Badge variant={featureSettings.readiness_check !== false ? 'default' : 'secondary'}>{featureSettings.readiness_check !== false ? 'Obligatorio' : 'Desactivado'}</Badge>
                  <Button variant='outline' size='sm' onClick={() => goToTab('settings')}>Cambiar</Button>
                </div>
              </div>
            </CardContent></Card>
            <Card><CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'><CardTitle className='text-base'>Check-ins asignados</CardTitle><Button size='sm' onClick={() => { fetchAvailableForms(); setAssignFormId(''); setAssignFormDialogOpen(true) }}><PlusIcon className='size-3.5 mr-1' /> Añadir</Button></CardHeader><CardContent>{assignedFormsLoading ? <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div> : assignedForms.length > 0 ? <Table><TableHeader><TableRow><TableHead>Formulario</TableHead><TableHead>Frecuencia</TableHead><TableHead>Próxima fecha</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{assignedForms.map(a => <TableRow key={a.id}><TableCell className='font-medium text-sm'>{a.form?.title || `Formulario #${a.form_id}`}</TableCell><TableCell><Badge variant='outline' className='capitalize'>{recurrenceLabel(a.form?.recurrence)}</Badge></TableCell><TableCell>{computeNextDue(a)}</TableCell><TableCell><Badge variant={a.submitted ? 'default' : 'secondary'}>{a.submitted ? 'Completado' : 'Pendiente'}</Badge></TableCell></TableRow>)}</TableBody></Table> : <p className='text-center text-muted-foreground py-8'>No hay check-ins asignados</p>}</CardContent></Card>
          </div>)}
        </div>)}

        {/* ═══ NUTRITION ═══ */}
        {activeTab === 'nutrition' && (<div className='grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4'>
          <Card className='h-fit'><CardContent className='p-2 space-y-1'>{([['calendar', 'Calendario', CalendarIcon], ['diets', 'Dietas asignadas', UtensilsIcon], ['info', 'Información nutricional', FileTextIcon]] as const).map(([val, label, Icon]) => (<button key={val} type='button' onClick={() => setNutritionSubTab(val)} className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors text-left', nutritionSubTab === val ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')}><Icon className='size-4' /> {label}</button>))}</CardContent></Card>
          <div className='space-y-4'>
            {nutritionSubTab === 'calendar' && <ClientMealCalendarView clientId={String(user.id)} />}
            {nutritionSubTab === 'diets' && <Card><CardHeader className='flex flex-row items-center justify-between space-y-0'><CardTitle className='text-base'>Dietas asignadas ({diets.length})</CardTitle><Button size='sm' onClick={async () => { try { const res = await api.get('/admin/meal-plan-templates?per_page=500').catch(() => ({ data: { data: [] } })); setDietOptions(res.data?.data || res.data || []); setAssignDietId(''); setAssignDietStartDate(''); setAssignDietWeeks('1'); setAssignDietDialogOpen(true) } catch { toast.error('No se pudieron cargar las plantillas de dieta') } }}><PlusIcon className='size-3.5 mr-1' /> Asignar dieta</Button></CardHeader><CardContent>{diets.length > 0 ? <Table><TableHeader><TableRow><TableHead>Dieta</TableHead><TableHead>Tipo</TableHead><TableHead>Desde</TableHead><TableHead>Hasta</TableHead><TableHead>Días</TableHead></TableRow></TableHeader><TableBody>{diets.map(d => <TableRow key={d.template_id}><TableCell className='text-sm font-medium'>{d.title || `Plantilla #${d.template_id}`}</TableCell><TableCell><Badge variant='outline' className='capitalize'>{d.type === 'weekday' ? 'Semanal' : 'Secuencial'}</Badge></TableCell><TableCell className='text-xs'>{d.start_date}</TableCell><TableCell className='text-xs'>{d.end_date}</TableCell><TableCell className='text-xs'>{d.days_count}</TableCell></TableRow>)}</TableBody></Table> : <p className='text-center text-muted-foreground py-8'>No hay dietas asignadas</p>}</CardContent></Card>}
            {nutritionSubTab === 'info' && <Card><CardHeader><CardTitle className='text-base'>Información nutricional</CardTitle></CardHeader><CardContent><div className='space-y-3 text-sm'><div className='flex justify-between'><span className='text-muted-foreground'>Objetivo</span><span className='font-medium capitalize'>{user.user_profile?.goal || '—'}</span></div><div className='flex justify-between'><span className='text-muted-foreground'>Nivel de actividad</span><span className='font-medium capitalize'>{user.user_profile?.activity || '—'}</span></div><div className='flex justify-between'><span className='text-muted-foreground'>Tipo de macronutrientes</span><span className='font-medium capitalize'>{user.user_profile?.macro_type || '—'}</span></div></div></CardContent></Card>}
          </div>
        </div>)}

        {/* ═══ TASKS ═══ */}
        {activeTab === 'tasks' && (<div className='space-y-4'>
          <div className='flex items-center justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <Select value={taskStatusFilter} onValueChange={v => setTaskStatusFilter(v ?? 'all')}><SelectTrigger className='w-36 h-8 text-xs'><SelectValue placeholder='Estado' /></SelectTrigger><SelectContent><SelectItem value='all'>Todos los estados</SelectItem><SelectItem value='pending'>Pendiente</SelectItem><SelectItem value='in_progress'>En progreso</SelectItem><SelectItem value='completed'>Completado</SelectItem></SelectContent></Select>
              <Input placeholder='Buscar tareas...' value={taskSearch} onChange={e => setTaskSearch(e.target.value)} className='h-8 text-xs w-48' />
            </div>
            <Button size='sm' onClick={() => { setEditingTaskId(null); setTaskForm({ title: '', description: '', priority: 'medium', due_date: '' }); setTaskDialogOpen(true) }}><PlusIcon className='size-3.5 mr-1' /> Nueva tarea</Button>
          </div>
          <Card><CardContent className='pt-4'>
            {tasksLoading ? <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
            : filteredTasks.length > 0 ? <div className='space-y-2'>{filteredTasks.map(task => (
              <div key={task.id} className={cn('flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30', task.status === 'completed' && 'opacity-60')}>
                <button type='button' onClick={() => handleToggleTaskStatus(task)} className={cn('size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors', task.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : task.status === 'in_progress' ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 hover:border-primary')}>{task.status === 'completed' && <CheckCircleIcon className='size-3' />}{task.status === 'in_progress' && <ClockIcon className='size-3' />}</button>
                <div className='flex-1 min-w-0'><p className={cn('text-sm font-medium', task.status === 'completed' && 'line-through')}>{task.title}</p>{task.description && <p className='text-xs text-muted-foreground truncate'>{task.description}</p>}</div>
                <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'} className='text-[10px] shrink-0'>{task.priority}</Badge>
                {task.due_date && <span className='text-[10px] text-muted-foreground shrink-0'>{new Date(task.due_date).toLocaleDateString()}</span>}
                <DropdownMenu><DropdownMenuTrigger><button type='button' className='p-1 text-muted-foreground hover:text-foreground'><MoreVerticalIcon className='size-3.5' /></button></DropdownMenuTrigger><DropdownMenuContent align='end' className='text-xs'><DropdownMenuItem onClick={() => { setEditingTaskId(task.id); setTaskForm({ title: task.title, description: task.description || '', priority: task.priority, due_date: task.due_date || '' }); setTaskDialogOpen(true) }}>Editar</DropdownMenuItem><DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className='text-destructive focus:text-destructive'>Eliminar</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
              </div>
            ))}</div> : <div className='flex flex-col items-center py-12 text-muted-foreground'><CheckSquareIcon className='size-12 mb-4 opacity-50' /><p>No se encontraron tareas</p></div>}
          </CardContent></Card>
        </div>)}

        {/* ═══ HABITS ═══ */}
        {activeTab === 'habits' && (<div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-base flex items-center gap-2'><HeartIcon className='size-4' /> Hábitos</CardTitle>
            <Button size='sm' onClick={() => { setEditingHabit(null); setHabitDialogOpen(true) }}><PlusIcon className='size-3.5 mr-1' /> Añadir hábito</Button>
          </div>

          <HabitProgressPanel
            items={habitProgress}
            loading={habitProgressLoading}
            emptyLabel='Este cliente todavía no tiene ningún hábito en marcha.'
            onEdit={(item) => { setEditingHabit(item); setHabitDialogOpen(true) }}
            onDelete={(item) => { setDeletingHabit(item); setDeleteHabitDialogOpen(true) }}
          />

          <HabitDialog
            open={habitDialogOpen}
            onOpenChange={setHabitDialogOpen}
            clientId={Number(userId)}
            editingHabit={editingHabit}
            onSaved={() => { setHabitDialogOpen(false); fetchHabitProgress() }}
          />

          <Dialog open={deleteHabitDialogOpen} onOpenChange={setDeleteHabitDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Eliminar hábito</DialogTitle></DialogHeader>
              <p className='text-sm text-muted-foreground'>¿Estás seguro de que quieres eliminar este hábito? Esta acción no se puede deshacer.</p>
              <DialogFooter>
                <Button variant='outline' onClick={() => setDeleteHabitDialogOpen(false)}>Cancelar</Button>
                <Button variant='destructive' onClick={handleDeleteHabit}>Eliminar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>)}

        {/* ═══ PHOTOS ═══ */}
        {activeTab === 'photos' && (<Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-4'><CardTitle className='text-base flex items-center gap-2'><CameraIcon className='size-4' /> Fotos de progreso</CardTitle><div className='flex items-center gap-2'><Input placeholder='Etiqueta de foto (opcional)' value={photoName} onChange={e => setPhotoName(e.target.value)} className='w-48 h-8 text-xs' /><label className='inline-flex items-center'><input type='file' accept='image/*' className='hidden' onChange={handleUploadPhoto} /><span className='inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 cursor-pointer disabled:opacity-50'>{photoUploading ? <><div className='h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent mr-1' /> Subiendo...</> : <><UploadIcon className='size-3.5 mr-1' /> Subir</>}</span></label></div></CardHeader>
          <CardContent>{photosLoading ? <div className='flex justify-center py-12'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div> : photos.length > 0 ? <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>{photos.map(photo => (<div key={photo.id} className='group relative rounded-lg overflow-hidden border bg-muted aspect-square'><img src={photo.url} alt={photo.name} loading='lazy' decoding='async' className='w-full h-full object-cover' /><div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2'><button className='text-white text-xs underline' onClick={() => setPreviewPhoto(photo)}>Vista previa</button><button className='text-red-400 text-xs underline' onClick={() => handleDeletePhoto(photo.id)}>Eliminar</button></div><div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2'><p className='text-white text-[10px] truncate'>{photo.name}</p><p className='text-white/60 text-[9px]'>{new Date(photo.created_at).toLocaleDateString()}</p></div></div>))}</div> : <div className='flex flex-col items-center py-12 text-muted-foreground'><CameraIcon className='size-12 mb-4 opacity-50' /><p>Aún no hay fotos de progreso</p></div>}</CardContent>
        </Card>)}

        {/* ═══ METRICS ═══ */}
        {activeTab === 'metrics' && (<div className='space-y-4'>
          <Card><CardHeader className='flex flex-row items-center justify-between space-y-0'><CardTitle className='text-base'>Métricas corporales</CardTitle><div className='flex items-center gap-2'><Button variant='outline' size='sm' onClick={() => { setEditingType(null); setTypeForm({ value: '', label: '', unit: '', scope: 'global' }); setTypeDialogOpen(true) }}><SettingsIcon className='size-3.5 mr-1' /> Gestionar tipos</Button><Button size='sm' onClick={() => setMetricDialogOpen(true)}><PlusIcon className='size-3.5 mr-1' /> Registrar métrica</Button></div></CardHeader><CardContent>
            {bodyMetricsLoading ? <div className='flex justify-center py-8'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
            : Object.keys(bodyMetricsChart).length > 0 ? (<div className='space-y-4'>
              <div className='flex gap-2 flex-wrap'>{bodyMetricTypes.map(bt => { const hasData = bodyMetricsChart[bt.value]?.data?.length > 0; return <button key={bt.value} type='button' onClick={() => setSelectedMetricType(bt.value)} className={cn('px-3 py-1 text-xs rounded-full border transition-colors', selectedMetricType === bt.value ? 'bg-primary text-primary-foreground border-primary' : hasData ? 'border-border hover:bg-muted' : 'border-border opacity-50')}>{bt.label}</button> })}</div>
              {bodyMetricsChart[selectedMetricType]?.data?.length > 0 ? <Suspense fallback={<ChartFallback height={280} />}><BodyMetricChart data={bodyMetricsChart[selectedMetricType].data} height={280} yAxisWidth={45} /></Suspense> : <p className='text-center text-muted-foreground text-sm py-4'>Sin datos para {bodyMetricTypes.find(bt => bt.value === selectedMetricType)?.label}</p>}
            </div>) : <div className='text-center py-8 text-muted-foreground'><BarChart3Icon className='size-8 mx-auto mb-2 opacity-40' /><p>Aún no se han registrado métricas corporales</p></div>}
            {bodyMetrics.length > 0 && (<div className='mt-6'><h4 className='text-sm font-medium mb-3'>Entradas recientes</h4><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead><TableHead>Notas</TableHead><TableHead className='w-12'></TableHead></TableRow></TableHeader><TableBody>{bodyMetrics.slice(0, 20).map(m => <TableRow key={m.id}><TableCell className='text-xs'>{new Date(m.recorded_at).toLocaleDateString()}</TableCell><TableCell><Badge variant='outline' className='text-[10px] capitalize'>{m.metric_type.replace('_', ' ')}</Badge></TableCell><TableCell className='font-medium text-sm'>{m.value} {m.unit || ''}</TableCell><TableCell className='text-xs text-muted-foreground max-w-[200px] truncate'>{m.notes || '—'}</TableCell><TableCell><button className='text-destructive hover:text-destructive/80' onClick={() => handleDeleteMetric(m.id)}><TrashIcon className='size-3.5' /></button></TableCell></TableRow>)}</TableBody></Table></div>)}
          </CardContent></Card>
          {records.length > 0 && <Card><CardHeader><CardTitle className='text-base flex items-center gap-2'><HistoryIcon className='size-4' /> Historial de ejercicios</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Ejercicio</TableHead><TableHead>Peso</TableHead><TableHead>Repeticiones</TableHead><TableHead>1RM</TableHead></TableRow></TableHeader><TableBody>{records.map(r => <TableRow key={r.id}><TableCell>{r.date}</TableCell><TableCell className='font-medium'>{r.exercise?.title || `Ejercicio #${r.exercise_id}`}</TableCell><TableCell>{r.weight ?? '—'} kg</TableCell><TableCell>{r.reps ?? '—'}</TableCell><TableCell>{r.one_rm ?? '—'} kg</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}
        </div>)}

        {/* ═══ RESOURCES ═══ */}
        {activeTab === 'resources' && (<div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex gap-1 bg-muted/50 rounded-lg p-1'>{([['all', 'Todos'], ...RESOURCE_TYPES.map(r => [r.value, r.label] as const)]).map(([val, label]) => <button key={val} type='button' onClick={() => setResourceTypeFilter(val)} className={cn('px-3 py-1 text-xs rounded-md transition-colors', resourceTypeFilter === val ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>{label}</button>)}</div>
            <Button size='sm' onClick={() => { setEditingResourceId(null); setResourceForm({ title: '', type: 'article', scope: 'shared', content: '', external_url: '' }); setResourceDialogOpen(true) }}><PlusIcon className='size-3.5 mr-1' /> Nuevo recurso</Button>
          </div>
          <Card><CardHeader className='pb-2'><CardTitle className='text-sm'>Asignar recurso existente</CardTitle></CardHeader><CardContent className='flex gap-2'>
            <Select value={assignResourceId} onValueChange={v => setAssignResourceId(v ?? '')}>
              <SelectTrigger className='flex-1'><SelectValue placeholder='Elegir recurso de la biblioteca...' /></SelectTrigger>
              <SelectContent>
                {assignableResources.filter(r => !resources.some(existing => existing.id === r.id)).map(r => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size='sm' onClick={handleAssignExistingResource} disabled={!assignResourceId || assigningResource}>{assigningResource ? 'Asignando...' : 'Asignar'}</Button>
          </CardContent></Card>
          <Card><CardContent className='pt-4'>
            {resourcesLoading ? <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
            : filteredResources.length > 0 ? <div className='space-y-2'>{filteredResources.map(r => (<div key={r.id} className='flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors'>
              <div className='size-10 rounded-md bg-muted flex items-center justify-center shrink-0'>{r.type === 'video' ? <FileTextIcon className='size-4 text-muted-foreground' /> : r.type === 'link' ? <ExternalLinkIcon className='size-4 text-muted-foreground' /> : <FileTextIcon className='size-4 text-muted-foreground' />}</div>
              <div className='flex-1 min-w-0'><div className='flex items-center gap-2'><p className='text-sm font-medium truncate'>{r.title}</p><Badge variant='outline' className='text-[9px] capitalize shrink-0'>{r.type}</Badge><Badge variant={r.scope === 'shared' ? 'secondary' : 'default'} className='text-[9px] shrink-0'>{r.scope === 'shared' ? 'compartido' : 'asignado'}</Badge></div>{r.external_url && <p className='text-xs text-muted-foreground truncate'>{r.external_url}</p>}{r.content && <p className='text-xs text-muted-foreground truncate'>{r.content}</p>}</div>
              <span className='text-[10px] text-muted-foreground shrink-0'>{new Date(r.created_at).toLocaleDateString()}</span>
              <DropdownMenu><DropdownMenuTrigger><button type='button' className='p-1 text-muted-foreground hover:text-foreground'><MoreVerticalIcon className='size-3.5' /></button></DropdownMenuTrigger><DropdownMenuContent align='end' className='text-xs'><DropdownMenuItem onClick={() => { setEditingResourceId(r.id); setResourceForm({ title: r.title, type: r.type, scope: r.scope, content: r.content || '', external_url: r.external_url || '' }); setResourceDialogOpen(true) }}>Editar</DropdownMenuItem>{r.scope === 'assigned' && <DropdownMenuItem onClick={() => handleUnassignResource(r.id)}>Quitar asignación (solo este cliente)</DropdownMenuItem>}<DropdownMenuItem onClick={() => handleDeleteResource(r.id)} className='text-destructive focus:text-destructive'>Eliminar recurso entero</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
            </div>))}</div> : <div className='flex flex-col items-center py-12 text-muted-foreground'><FileTextIcon className='size-12 mb-4 opacity-50' /><p>Aún no hay recursos</p></div>}
          </CardContent></Card>
        </div>)}

        {/* ═══ WEARABLE ═══ */}
        {activeTab === 'wearable' && <Card><CardHeader><CardTitle className='text-base'>Dispositivo wearable</CardTitle></CardHeader><CardContent><div className='flex flex-col items-center py-12 text-muted-foreground'><WatchIcon className='size-12 mb-4 opacity-50' /><p>No hay ningún dispositivo wearable conectado</p></div></CardContent></Card>}
        {/* ═══ VAULT ═══ */}
        {activeTab === 'vault' && <Card><CardHeader><CardTitle className='text-base'>Vault</CardTitle></CardHeader><CardContent><div className='flex flex-col items-center py-12 text-muted-foreground'><FileTextIcon className='size-12 mb-4 opacity-50' /><p>No hay archivos en la bóveda</p></div></CardContent></Card>}

        {/* ═══ SETTINGS ═══ */}
        {activeTab === 'settings' && (<Card className='mb-6'><CardHeader><CardTitle className='text-base'>Nivel de acceso</CardTitle></CardHeader><CardContent>
          <div className='flex items-center justify-between py-3'>
            <div>
              <p className='text-sm font-medium'>Acceso completo (cliente de entrenamiento personal)</p>
              <p className='text-xs text-muted-foreground'>Acceso completo a todo el contenido de Nutrición y Entrenamiento, sin necesidad de comprar ningún paquete. Actívalo para clientes de entrenamiento personal 1:1.</p>
            </div>
            <Switch checked={personalClient} disabled={savingPersonalClient} onCheckedChange={handleTogglePersonalClient} />
          </div>
        </CardContent></Card>)}
        {activeTab === 'settings' && (<Card><CardHeader><CardTitle className='text-base'>Ajustes de funciones del cliente</CardTitle></CardHeader><CardContent>
          <div className='space-y-1'>
            {Object.entries(FEATURE_LABELS).map(([key, label]) => (<div key={key} className='flex items-center justify-between py-3 border-b last:border-0'>
              <div><p className='text-sm font-medium'>{label}</p><p className='text-xs text-muted-foreground'>Habilitar funciones de {label.toLowerCase()} para este cliente</p></div>
              <Switch checked={!!featureSettings[key]} disabled={savingFeature === key} onCheckedChange={(checked) => handleToggleFeature(key, checked)} />
            </div>))}
          </div>
        </CardContent></Card>)}
      </div>

      {/* ═══ DIALOGS ═══ */}
<Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}><DialogContent><DialogHeader><DialogTitle>Importar workout</DialogTitle></DialogHeader><FieldGroup className='gap-4'><Field className='gap-2'><FieldLabel>Fecha</FieldLabel><Input type='date' value={assignDate} onChange={e => setAssignDate(e.target.value)} /></Field><Field className='gap-2'><FieldLabel>Plantilla de entrenamiento</FieldLabel><Select value={assignTemplateId} onValueChange={v => setAssignTemplateId(v ?? '')}><SelectTrigger><SelectValue placeholder='Seleccionar plantilla' /></SelectTrigger><SelectContent>{workoutTemplates.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>)}</SelectContent></Select></Field></FieldGroup><DialogFooter><Button variant='outline' onClick={() => setAssignDialogOpen(false)}>Cancelar</Button><Button onClick={handleAssignDirect} disabled={!assignDate || !assignTemplateId}>Importar workout</Button></DialogFooter></DialogContent></Dialog>
<Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}><DialogContent><DialogHeader><DialogTitle>Asignar programa</DialogTitle></DialogHeader><FieldGroup className='gap-4'><Field className='gap-2'><FieldLabel>Programa</FieldLabel><Select value={importProgramId} onValueChange={v => setImportProgramId(v ?? '')}><SelectTrigger><SelectValue placeholder='Seleccionar programa' /></SelectTrigger><SelectContent>{trainingPrograms.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.title || `Programa #${p.id}`}</SelectItem>)}</SelectContent></Select></Field><Field className='gap-2'><FieldLabel>Fecha de inicio</FieldLabel><Input type='date' value={importStartDate} onChange={e => setImportStartDate(e.target.value)} /></Field></FieldGroup><DialogFooter><Button variant='outline' onClick={() => setImportDialogOpen(false)}>Cancelar</Button><Button onClick={handleImportProgram} disabled={!importProgramId || !importStartDate}>Asignar programa</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={assignDietDialogOpen} onOpenChange={setAssignDietDialogOpen}><DialogContent><DialogHeader><DialogTitle>Asignar dieta</DialogTitle></DialogHeader><FieldGroup className='gap-4'><Field className='gap-2'><FieldLabel>Dieta</FieldLabel><Select value={assignDietId} onValueChange={v => setAssignDietId(v ?? '')}><SelectTrigger><SelectValue placeholder='Seleccionar dieta' /></SelectTrigger><SelectContent>{dietOptions.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.title || `Dieta #${d.id}`}</SelectItem>)}</SelectContent></Select></Field><Field className='gap-2'><FieldLabel>Fecha de inicio</FieldLabel><Input type='date' value={assignDietStartDate} onChange={e => setAssignDietStartDate(e.target.value)} /></Field>{dietOptions.find(d => String(d.id) === assignDietId)?.type === 'weekday' && <Field className='gap-2'><FieldLabel>Semanas a repetir</FieldLabel><Input type='number' min={1} max={12} value={assignDietWeeks} onChange={e => setAssignDietWeeks(e.target.value)} /></Field>}</FieldGroup><DialogFooter><Button variant='outline' onClick={() => setAssignDietDialogOpen(false)}>Cancelar</Button><Button onClick={handleAssignDiet} disabled={!assignDietId || !assignDietStartDate || assigningDiet}>{assigningDiet ? 'Asignando...' : 'Asignar'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={assignFormDialogOpen} onOpenChange={setAssignFormDialogOpen}><DialogContent><DialogHeader><DialogTitle>Añadir check-in</DialogTitle></DialogHeader><FieldGroup className='gap-4'><Field className='gap-2'><FieldLabel>Formulario</FieldLabel><Select value={assignFormId} onValueChange={v => setAssignFormId(v ?? '')}><SelectTrigger><SelectValue placeholder='Seleccionar un formulario' /></SelectTrigger><SelectContent>{availableForms.map((f: any) => <SelectItem key={f.id} value={String(f.id)}>{f.title} {f.recurrence ? `(${f.recurrence})` : ''}</SelectItem>)}</SelectContent></Select></Field></FieldGroup><DialogFooter><Button variant='outline' onClick={() => setAssignFormDialogOpen(false)}>Cancelar</Button><Button onClick={handleAssignForm} disabled={!assignFormId || assigningForm}>{assigningForm ? 'Asignando...' : 'Asignar'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}><DialogContent className='max-w-2xl'><DialogHeader><DialogTitle>{previewPhoto?.name || 'Foto de progreso'}</DialogTitle></DialogHeader>{previewPhoto && <div className='space-y-2'><img src={previewPhoto.url} alt={previewPhoto.name} loading='lazy' decoding='async' className='w-full rounded-lg' /><p className='text-sm text-muted-foreground text-center'>{new Date(previewPhoto.created_at).toLocaleDateString()}</p></div>}</DialogContent></Dialog>
      <WorkoutPreviewModal open={previewOpen} onOpenChange={setPreviewOpen} workoutTemplateId={previewTemplateId || 0} clientId={Number(userId)} />

      <SessionDetailModal
        open={!!selectedCompletedSession}
        onOpenChange={open => { if (!open) setSelectedCompletedSession(null) }}
        programDayAssignmentId={selectedCompletedSession?.program_day_assignment_id}
        workoutTemplateId={selectedCompletedSession?.workout_template_id}
        date={selectedCompletedSession?.date ? selectedCompletedSession.date.split(' ')[0].split('T')[0] : null}
        clientId={Number(userId)}
        exerciseNotes={exerciseNotes}
      />

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editingGoalId ? 'Editar objetivo' : 'Nuevo objetivo'}</DialogTitle></DialogHeader><FieldGroup className='gap-4'>
        <Field className='gap-2'><FieldLabel>Título</FieldLabel><Input value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} placeholder='p. ej. Perder 5 kg' /></Field>
        <Field className='gap-2'><FieldLabel>Descripción</FieldLabel><Textarea value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} rows={2} className='resize-none' /></Field>
        <div className='grid grid-cols-2 gap-3'><Field className='gap-2'><FieldLabel>Tipo</FieldLabel><Select value={goalForm.type} onValueChange={v => setGoalForm(f => ({ ...f, type: v ?? 'custom' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GOAL_TYPES.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent></Select></Field><Field className='gap-2'><FieldLabel>Unidad</FieldLabel><Input value={goalForm.unit} onChange={e => setGoalForm(f => ({ ...f, unit: e.target.value }))} placeholder='kg, reps...' /></Field></div>
        <div className='grid grid-cols-2 gap-3'><Field className='gap-2'><FieldLabel>Valor actual</FieldLabel><Input type='number' value={goalForm.current_value} onChange={e => setGoalForm(f => ({ ...f, current_value: e.target.value }))} /></Field><Field className='gap-2'><FieldLabel>Valor objetivo</FieldLabel><Input type='number' value={goalForm.target_value} onChange={e => setGoalForm(f => ({ ...f, target_value: e.target.value }))} /></Field></div>
        <Field className='gap-2'><FieldLabel>Fecha objetivo</FieldLabel><Input type='date' value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))} /></Field>
      </FieldGroup><DialogFooter><Button variant='outline' onClick={() => setGoalDialogOpen(false)}>Cancelar</Button><Button onClick={handleSaveGoal} disabled={!goalForm.title.trim()}>{editingGoalId ? 'Actualizar' : 'Crear'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={limitationDialogOpen} onOpenChange={setLimitationDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editingLimitationId ? 'Editar limitación' : 'Nueva limitación'}</DialogTitle></DialogHeader><FieldGroup className='gap-4'>
        <div className='grid grid-cols-2 gap-3'><Field className='gap-2'><FieldLabel>Tipo</FieldLabel><Select value={limitationForm.type} onValueChange={v => setLimitationForm(f => ({ ...f, type: v ?? 'limitation' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LIMITATION_TYPES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent></Select></Field><Field className='gap-2'><FieldLabel>Estado</FieldLabel><Select value={limitationForm.status} onValueChange={v => setLimitationForm(f => ({ ...f, status: v ?? 'active' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='active'>Activo</SelectItem><SelectItem value='resolved'>Resuelto</SelectItem></SelectContent></Select></Field></div>
        <Field className='gap-2'><FieldLabel>Título</FieldLabel><Input value={limitationForm.title} onChange={e => setLimitationForm(f => ({ ...f, title: e.target.value }))} placeholder='p. ej. Lesión de rodilla izquierda' /></Field>
        <Field className='gap-2'><FieldLabel>Descripción</FieldLabel><Textarea value={limitationForm.description} onChange={e => setLimitationForm(f => ({ ...f, description: e.target.value }))} rows={2} className='resize-none' /></Field>
        <Field className='gap-2'><FieldLabel>Fecha de notificación</FieldLabel><Input type='date' value={limitationForm.date_reported} onChange={e => setLimitationForm(f => ({ ...f, date_reported: e.target.value }))} /></Field>
      </FieldGroup><DialogFooter><Button variant='outline' onClick={() => setLimitationDialogOpen(false)}>Cancelar</Button><Button onClick={handleSaveLimitation} disabled={!limitationForm.title.trim()}>{editingLimitationId ? 'Actualizar' : 'Crear'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={metricDialogOpen} onOpenChange={setMetricDialogOpen}><DialogContent><DialogHeader><DialogTitle>Registrar métrica corporal</DialogTitle></DialogHeader><FieldGroup className='gap-4'>
        <Field className='gap-2'><FieldLabel>Tipo de métrica</FieldLabel><Select value={metricForm.metric_type} onValueChange={v => { const t = v ?? 'weight'; const found = bodyMetricTypes.find(bt => bt.value === t); setMetricForm(f => ({ ...f, metric_type: t, unit: found?.unit || '' })) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{bodyMetricTypes.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent></Select></Field>
        <div className='grid grid-cols-2 gap-3'><Field className='gap-2'><FieldLabel>Valor</FieldLabel><Input type='number' step='0.1' value={metricForm.value} onChange={e => setMetricForm(f => ({ ...f, value: e.target.value }))} /></Field><Field className='gap-2'><FieldLabel>Unidad</FieldLabel><Input value={metricForm.unit} onChange={e => setMetricForm(f => ({ ...f, unit: e.target.value }))} /></Field></div>
        <Field className='gap-2'><FieldLabel>Fecha</FieldLabel><Input type='date' value={metricForm.recorded_at} onChange={e => setMetricForm(f => ({ ...f, recorded_at: e.target.value }))} /></Field>
        <Field className='gap-2'><FieldLabel>Notas</FieldLabel><Input value={metricForm.notes} onChange={e => setMetricForm(f => ({ ...f, notes: e.target.value }))} placeholder='Notas opcionales' /></Field>
      </FieldGroup><DialogFooter><Button variant='outline' onClick={() => setMetricDialogOpen(false)}>Cancelar</Button><Button onClick={handleSaveMetric} disabled={!metricForm.value}>Registrar</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}><DialogContent className='max-w-xl'><DialogHeader><DialogTitle>{editingType ? 'Editar tipo de métrica corporal' : 'Nuevo tipo de métrica corporal'}</DialogTitle></DialogHeader>
        {!editingType && bodyMetricTypes.length > 0 && <div className='space-y-2 mb-4 max-h-48 overflow-y-auto'>{bodyMetricTypes.map(t => <div key={t.value} className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'><div className='flex items-center gap-2'><span className='font-medium'>{t.label}</span><span className='text-muted-foreground text-xs'>({t.value})</span><Badge variant={t.scope === 'client' ? 'default' : 'secondary'} className='text-[9px]'>{t.scope === 'client' ? 'Este cliente' : 'Global'}</Badge></div><div className='flex items-center gap-2 text-xs text-muted-foreground'><span>{t.unit || '—'}</span><Button variant='ghost' size='sm' className='h-6 w-6 p-0' onClick={() => { setEditingType(t); setTypeForm({ value: t.value, label: t.label, unit: t.unit || '', scope: t.scope || 'global' }); setTypeDialogOpen(true) }}><PencilIcon className='size-3' /></Button></div></div>)}</div>}
        <FieldGroup className='gap-4'>
          {!editingType && <Field className='gap-2'><FieldLabel>Valor (clave)</FieldLabel><Input value={typeForm.value} onChange={e => setTypeForm(f => ({ ...f, value: e.target.value }))} placeholder='p. ej. visceral_fat' /></Field>}
          <Field className='gap-2'><FieldLabel>Etiqueta</FieldLabel><Input value={typeForm.label} onChange={e => setTypeForm(f => ({ ...f, label: e.target.value }))} placeholder='p. ej. Grasa visceral' /></Field>
          <Field className='gap-2'><FieldLabel>Unidad</FieldLabel><Input value={typeForm.unit} onChange={e => setTypeForm(f => ({ ...f, unit: e.target.value }))} placeholder='p. ej. cm, %, kg' /></Field>
          {!editingType && <Field className='gap-2'><FieldLabel>Ámbito</FieldLabel><div className='flex gap-2'><button type='button' onClick={() => setTypeForm(f => ({ ...f, scope: 'global' }))} className={cn('flex-1 px-3 py-2 text-sm rounded-md border transition-colors', typeForm.scope === 'global' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>Global (todos los clientes)</button><button type='button' onClick={() => setTypeForm(f => ({ ...f, scope: 'client' }))} className={cn('flex-1 px-3 py-2 text-sm rounded-md border transition-colors', typeForm.scope === 'client' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>Solo este cliente</button></div></Field>}
          {editingType && <div className='flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs'><AlertTriangleIcon className='size-3.5 shrink-0' /> No se permite cambiar la clave. Elimínala y vuelve a crearla en su lugar.<Badge variant={editingType.scope === 'client' ? 'default' : 'secondary'} className='text-[9px] ml-auto'>{editingType.scope === 'client' ? 'Este cliente' : 'Global'}</Badge></div>}
        </FieldGroup><DialogFooter className='flex items-center justify-between'>
          <div>{editingType && <Button variant='destructive' size='sm' onClick={async () => { await handleDeleteType(editingType); setTypeDialogOpen(false); setEditingType(null); setTypeForm({ value: '', label: '', unit: '', scope: 'global' }) }}>Eliminar</Button>}</div>
          <div className='flex gap-2'><Button variant='outline' onClick={() => setTypeDialogOpen(false)}>Cancelar</Button><Button onClick={handleSaveType} disabled={!typeForm.value.trim() || !typeForm.label.trim() || savingType}>{savingType ? 'Guardando...' : editingType ? 'Actualizar' : 'Crear'}</Button></div>
        </DialogFooter></DialogContent></Dialog>
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editingTaskId ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle></DialogHeader><FieldGroup className='gap-4'>
        <Field className='gap-2'><FieldLabel>Título</FieldLabel><Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder='Título de la tarea' /></Field>
        <Field className='gap-2'><FieldLabel>Descripción</FieldLabel><Textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} rows={2} className='resize-none' /></Field>
        <div className='grid grid-cols-2 gap-3'><Field className='gap-2'><FieldLabel>Prioridad</FieldLabel><Select value={taskForm.priority} onValueChange={v => setTaskForm(f => ({ ...f, priority: v ?? 'medium' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TASK_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></Field><Field className='gap-2'><FieldLabel>Fecha de vencimiento</FieldLabel><Input type='date' value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} /></Field></div>
      </FieldGroup><DialogFooter><Button variant='outline' onClick={() => setTaskDialogOpen(false)}>Cancelar</Button><Button onClick={handleSaveTask} disabled={!taskForm.title.trim()}>{editingTaskId ? 'Actualizar' : 'Crear'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={resourceDialogOpen} onOpenChange={setResourceDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editingResourceId ? 'Editar recurso' : 'Nuevo recurso'}</DialogTitle></DialogHeader><FieldGroup className='gap-4'>
        <Field className='gap-2'><FieldLabel>Título</FieldLabel><Input value={resourceForm.title} onChange={e => setResourceForm(f => ({ ...f, title: e.target.value }))} placeholder='Título del recurso' /></Field>
        <div className='grid grid-cols-2 gap-3'><Field className='gap-2'><FieldLabel>Tipo</FieldLabel><Select value={resourceForm.type} onValueChange={v => setResourceForm(f => ({ ...f, type: v ?? 'article' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RESOURCE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select></Field><Field className='gap-2'><FieldLabel>Ámbito</FieldLabel><Select value={resourceForm.scope} onValueChange={v => setResourceForm(f => ({ ...f, scope: v ?? 'shared' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='shared'>Compartido (todos los clientes)</SelectItem><SelectItem value='assigned'>Asignado (se asigna a este cliente al crear)</SelectItem></SelectContent></Select></Field></div>
        <Field className='gap-2'><FieldLabel>URL externa</FieldLabel><Input value={resourceForm.external_url} onChange={e => setResourceForm(f => ({ ...f, external_url: e.target.value }))} placeholder='https://...' /></Field>
        <Field className='gap-2'><FieldLabel>Contenido</FieldLabel><Textarea value={resourceForm.content} onChange={e => setResourceForm(f => ({ ...f, content: e.target.value }))} rows={4} className='resize-none' placeholder='Contenido en Markdown...' /></Field>
      </FieldGroup><DialogFooter><Button variant='outline' onClick={() => setResourceDialogOpen(false)}>Cancelar</Button><Button onClick={handleSaveResource} disabled={!resourceForm.title.trim()}>{editingResourceId ? 'Actualizar' : 'Crear'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={trainingExpDialogOpen} onOpenChange={setTrainingExpDialogOpen}><DialogContent><DialogHeader><DialogTitle>Corregir experiencia de entrenamiento</DialogTitle></DialogHeader><FieldGroup className='gap-4'>
        <p className='text-xs text-muted-foreground'>Corrige lo que el cliente respondió en el onboarding. Deja un campo vacío para no modificarlo.</p>
        <Field className='gap-2'><FieldLabel>Meses de experiencia real</FieldLabel><Input type='number' min='0' step='1' value={trainingExpForm.training_experience_months} onChange={e => setTrainingExpForm(f => ({ ...f, training_experience_months: e.target.value }))} placeholder='p. ej. 18' /></Field>
        <Field className='gap-2'><FieldLabel>Nivel de técnica (1-10)</FieldLabel><Input type='number' min='1' max='10' step='1' value={trainingExpForm.technique_level} onChange={e => setTrainingExpForm(f => ({ ...f, technique_level: e.target.value }))} placeholder='p. ej. 6' /></Field>
      </FieldGroup><DialogFooter><Button variant='outline' onClick={() => setTrainingExpDialogOpen(false)} disabled={savingTrainingExp}>Cancelar</Button><Button onClick={handleSaveTrainingExperience} disabled={savingTrainingExp}>{savingTrainingExp ? 'Guardando...' : 'Guardar'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}
