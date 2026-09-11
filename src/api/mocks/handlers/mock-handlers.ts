

import { Bloghandlers } from 'src/api/blog/blogdata';
import { NotesHandlers } from 'src/api/notes/notedata';
import { TicketHandlers } from 'src/api/ticket/ticket-data';
import { BodyMetricHandlers } from 'src/api/body-metric/body-metric-data';
import { FormHandlers } from 'src/api/forms/forms-data';
import { TaskClientHandlers } from 'src/api/tasks/tasks-data';
import { HabitHandlers } from 'src/api/habits/habits-data';
import { ReportsHandlers } from 'src/api/reports/reports-data';
import { CommerceHandlers } from 'src/api/commerce/commerce-data';
import { ExerciseHandlers } from 'src/api/exercises/exercise-data';


export const mockHandlers = [
  ...Bloghandlers,
  ...NotesHandlers,
  ...TicketHandlers,
  ...BodyMetricHandlers,
  ...FormHandlers,
  ...TaskClientHandlers,
  ...HabitHandlers,
  ...ReportsHandlers,
  ...CommerceHandlers,
  ...ExerciseHandlers,
];
