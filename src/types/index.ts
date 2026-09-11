export type User = {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  phone_number: string | null
  gender: string | null
  status: string
  user_type: string
  display_name: string | null
  created_at: string
  updated_at: string
  profile_image?: string | null
}

export type Equipment = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type WorkoutType = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type Level = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type BodyPart = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type Category = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type Tags = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type CategoryDiet = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type Diet = {
  id: number
  title: string
  slug: string
  categorydiet_id: number
  calories: number
  carbs: number
  protein: number
  fat: number
  servings: number
  total_time: string | null
  is_featured: boolean
  is_premium: boolean
  visibility: string
  ingredients: string | null
  description: string | null
  status: string
  created_at: string
  updated_at: string
}

export type Exercise = {
  id: number
  title: string
  slug: string
  instruction: string | null
  tips: string | null
  video_type: string | null
  video_url: string | null
  bodypart_ids: string | null
  duration: string | null
  sets: string | null
  equipment_id: number | null
  level_id: number | null
  is_premium: boolean
  seconds_per_rep: number | null
  status: string
  created_at: string
  updated_at: string
}

export type Workout = {
  id: number
  title: string
  slug: string
  description: string | null
  workout_type_id: number
  level_id: number
  is_premium: boolean
  visibility: string
  status: string
  created_at: string
  updated_at: string
}

export type Recipe = {
  id: number
  title: string
  slug: string
  preparation_time: string | null
  type: string | null
  meal_type: string | null
  description: string | null
  calories: number | null
  protein: number | null
  fats: number | null
  carbs: number | null
  status: string
  created_at: string
  updated_at: string
}

export type RecipeCategory = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type RecipeTag = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type Ingredient = {
  id: number
  title: string
  slug: string
  ingredient_category_id: number
  calories_per_gram: number
  protein_per_gram: number
  fat_per_gram: number
  carbs_per_gram: number
  density: number | null
  status: string
  created_at: string
  updated_at: string
}

export type IngredientCategory = {
  id: number
  title: string
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type MeasurementUnit = {
  id: number
  title: string
  symbol: string
  unit_type: string
  base_conversion_factor: number
  is_standard: boolean
  slug: string
  status: string
  created_at: string
  updated_at: string
}

export type IngredientUnitConversion = {
  id: number
  ingredient_id: number
  measurement_unit_id: number
  gram_equivalent: number
  created_at: string
  updated_at: string
}

export type Product = {
  id: number
  title: string
  slug: string
  description: string | null
  affiliate_link: string | null
  price: number | null
  productcategory_id: number | null
  featured: boolean
  status: string
  created_at: string
  updated_at: string
}

export type ProductCategory = {
  id: number
  title: string
  slug: string
  created_at: string
  updated_at: string
}

export type Post = {
  id: number
  title: string
  slug: string
  tags_id: string | null
  category_ids: string | null
  datetime: string | null
  is_featured: boolean
  description: string | null
  status: string
  created_at: string
  updated_at: string
}

export type Package = {
  id: number
  name: string
  duration_unit: string
  duration: number
  price: number
  description: string | null
  status: string
  created_at: string
  updated_at: string
}

export type Subscription = {
  id: number
  subscriber_type: string
  subscriber_id: number
  subscriber_name: string
  plan_id: number
  plan_name: string
  plan_price: number
  name: string
  slug: string
  trial_ends_at: string | null
  starts_at: string | null
  ends_at: string | null
  canceled_at: string | null
  total_amount: number
  payment_status: string
  created_at: string
  updated_at: string
}

export type Quotes = {
  id: number
  title: string
  slug: string
  message: string
  date: string | null
  created_at: string
  updated_at: string
}

export type BannerSlider = {
  id: number
  title: string
  slug: string
  workout_id: number | null
  type: string | null
  url: string | null
  status: string
  created_at: string
  updated_at: string
}

export type ClassSchedule = {
  id: number
  class_name: string
  workout_id: number | null
  workout_title: string | null
  workout_type: string | null
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  name: string | null
  link: string | null
  is_paid: boolean
  price: number | null
  created_at: string
  updated_at: string
}

export type PushNotification = {
  id: number
  title: string
  message: string
  created_at: string
  updated_at: string
}

export type Posting = {
  id: number
  description: string
  status: string
  user_id: number
  user?: User
  created_at: string
  updated_at: string
}

export type LanguageList = {
  id: number
  language_id: string
  language_name: string
  language_code: string
  country_code: string
  language_flag: string | null
  is_rtl: boolean
  status: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export type LanguageKeyword = {
  id: number
  language_id: string
  keyword_id: string
  screen_id: string
  keyword_value: string
  created_at: string
  updated_at: string
}

export type Screen = {
  id: number
  screenId: string
  screenName: string
  created_at: string
  updated_at: string
}

export type DefaultKeyword = {
  id: number
  screen_id: string
  keyword_id: string
  keyword_name: string
  keyword_value: string
  created_at: string
  updated_at: string
}

export type Role = {
  id: number
  name: string
  permissions: Permission[]
  created_at: string
  updated_at: string
}

export type Permission = {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export type AdminLoginHistory = {
  id: number
  user_id: number
  ip_address: string | null
  user_agent: string | null
  login_at: string
  user?: User
}

export type AdminLoginDevice = {
  id: number
  user_id: number
  device_name: string | null
  ip_address: string | null
  last_active: string
  user?: User
}

export type AssignDiet = {
  id: number
  user_id: number
  diet_id: number
  user?: User
  diet?: Diet
}

export type AssignWorkout = {
  id: number
  user_id: number
  workout_id: number
  user?: User
  workout?: Workout
}

export type AppSettings = {
  id?: number
  site_name?: string
  site_email?: string
  site_description?: string
  site_copyright?: string
  facebook_url?: string
  twitter_url?: string
  linkedin_url?: string
  instagram_url?: string
  language_option?: string | null
  contact_email?: string
  contact_number?: string
  help_support_url?: string
  color?: string
}

export type Setting = {
  id: number
  setting_group: string
  setting_key: string
  setting_value: string | null
  created_at?: string
  updated_at?: string
}

// ═══ V2: Coaching Features ════════════════════════════════════════════

export type SectionTemplate = {
  id: number
  title: string
  instructions: string | null
  created_at: string
  updated_at: string
  exercises?: SectionTemplateExercise[]
}

export type SectionTemplateExercise = {
  id: number
  section_template_id: number
  exercise_id: number
  exercise?: Exercise
  prescribed: Record<string, any> | null
  enabled_metrics: Record<string, boolean> | null
  order: number | null
  created_at: string
  updated_at: string
}

export type WorkoutTemplate = {
  id: number
  title: string
  instructions: string | null
  created_at: string
  updated_at: string
  blocks?: WorkoutTemplateBlock[]
  exercises?: WorkoutTemplateExercise[]
}

export type WorkoutTemplateBlock = {
  id: number
  workout_template_id: number
  title: string | null
  instructions: string | null
  order: number | null
  created_at: string
  updated_at: string
}

export type WorkoutTemplateExercise = {
  id: number
  workout_template_id: number
  workout_template_block_id: number | null
  exercise_id: number
  exercise?: Exercise
  prescribed: Record<string, any> | null
  enabled_metrics: Record<string, boolean> | null
  notes: string | null
  sequence: number | null
  order: number | null
  created_at: string
  updated_at: string
}

export type TrainingProgram = {
  id: number
  title: string | null
  client_id: number | null
  workout_id: number | null
  num_weeks: number
  weeks_per_page: number
  start_date: string | null
  personal_calendar: boolean
  status: string
  created_at: string
  updated_at: string
  client?: User
  workout?: Workout
  day_assignments?: ProgramDayAssignment[]
  client_assignments?: ProgramClientAssignment[]
}

export type ProgramDayAssignment = {
  id: number
  training_program_id: number
  workout_template_id: number | null
  workout_template?: WorkoutTemplate
  week: number
  day: number
  day_label: string | null
  created_at: string
  updated_at: string
}

export type ProgramClientAssignment = {
  id: number
  training_program_id: number
  client_id: number
  start_date: string | null
  status: string
  created_at: string
  updated_at: string
  client?: User
  training_program?: TrainingProgram
}

export type ClientTag = {
  id: number
  title: string
  color: string
  created_at: string
  updated_at: string
}

export type ClientTagAssignment = {
  id: number
  client_id: number
  client_tag_id: number
  client_tag?: ClientTag
  client?: User
  created_at: string
  updated_at: string
}

export type ClientExerciseOverride = {
  id: number
  client_id: number
  program_day_assignment_id: number
  workout_template_exercise_id: number
  field: string
  value: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ClientFeatureSetting = {
  id: number
  client_id: number
  feature_key: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export type PersonalRecord = {
  id: number
  client_id: number
  exercise_id: number
  exercise?: Exercise
  date: string
  weight: number | null
  reps: number | null
  volume: number | null
  one_rm: number | null
  created_at: string
  updated_at: string
}

export type WorkoutSessionReview = {
  id: number
  client_id: number
  program_day_assignment_id: number | null
  workout_template_id: number | null
  difficulty_rating: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Resource = {
  id: number
  title: string
  type: string
  url: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export type Metric = {
  id: number
  title: string
  key: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export type Habit = {
  id: number
  client_id: number
  title: string
  frequency: string | null
  created_at: string
  updated_at: string
  logs?: HabitLog[]
}

export type HabitLog = {
  id: number
  habit_id: number
  date: string
  completed: boolean
  created_at: string
  updated_at: string
}

export type ClientExerciseLog = {
  id: number
  client_id: number
  exercise_id: number
  workout_template_exercise_id: number | null
  program_day_assignment_id: number | null
  date: string
  sets_completed: number | null
  reps_completed: string | null
  weight_used: string | null
  one_rm: number | null
  volume: number | null
  is_pr: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type ClientProfileData = {
  user: User
  client_tags?: ClientTag[]
  assigned_diets?: Diet[]
  assigned_workouts?: AssignWorkout[]
  last_checkin?: string
  bmi?: number
  bmr?: number
  ideal_weight?: number
  weight?: number
  height?: number
  age?: number
}

export type WorkoutDay = {
  id: number
  workout_id: number
  day_number: number
  day_name: string | null
  created_at: string
  updated_at: string
}

export type WorkoutDayBlock = {
  id: number
  workout_day_id: number
  title: string | null
  order: number | null
  created_at: string
  updated_at: string
}

export type WorkoutDayExercise = {
  id: number
  workout_day_id: number
  workout_day_block_id: number | null
  exercise_id: number
  exercise?: Exercise
  prescribed: Record<string, any> | null
  enabled_metrics: Record<string, boolean> | null
  order: number | null
  created_at: string
  updated_at: string
}

// Calendar types

export type CalendarMonthData = {
  year: number
  month: number
  assignments: CalendarAssignment[]
}

export type CalendarAssignment = {
  id: number
  program_day_assignment_id: number
  workout_template_id: number | null
  workout_template?: WorkoutTemplate
  client_id: number | null
  date: string
  year: number
  month: number
  day: number
  week?: number
  day_in_week?: number
  is_direct?: boolean
  training_program_id?: number | null
  training_program?: TrainingProgram
  created_at: string
  updated_at: string
}

export type CalendarWeeksGrid = {
  training_program_id: number
  weeks: CalendarWeekData[]
  start_week: number
  weeks_per_page: number
  total_weeks: number
}

export type CalendarWeekData = {
  week: number
  days: CalendarWeekDay[]
}

export type CalendarWeekDay = {
  day: number
  day_label: string
  assignments: CalendarAssignment[]
}

// Session Detail

export type SessionDetailData = {
  program_day_assignment: ProgramDayAssignment
  client: User
  blocks: SessionBlock[]
  totals: SessionTotals
  review?: WorkoutSessionReview
}

export type SessionBlock = {
  id: number
  title: string | null
  exercises: SessionExercise[]
}

export type SessionExercise = {
  id: number
  workout_template_exercise_id: number
  exercise: Exercise
  prescribed: Record<string, any> | null
  override: ClientExerciseOverride | null
  logged: ClientExerciseLog | null
  enabled_metrics: Record<string, boolean> | null
}

export type SessionTotals = {
  sets: number
  volume: number
  reps: number
  prs: number
}

// Client Calendar (merged)

export type ClientCalendarMonthData = {
  year: number
  month: number
  direct_assignments: CalendarAssignment[]
  program_assignments: CalendarAssignment[]
}

export type PaginatedResponse<T> = {
  pagination: {
    total_items: number
    per_page: number
    currentPage: number
    totalPages: number
  }
  data: T[]
}

export type ApiResponse<T> = {
  data: T
  message?: string
  token?: string
}
