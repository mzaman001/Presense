export interface Task {
  id: string;
  title: string;
  deadline: string | null;
  status: string;
  category: string;
  priority?: number | null;
  first_step: string | null;
  ifthen_trigger: string | null;
  snoozed_until?: string | null;
  recurrence?: string | null;
  linked_people_ids?: string[] | null;
  time_estimate?: number | null;
}
