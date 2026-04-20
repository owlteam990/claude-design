import { create } from 'zustand'
import { cliTasksApi } from '../api/cliTasks'
import type { CLITask, TaskStatus } from '../types/cliTask'

type TodoItem = {
  content: string
  status: string
  activeForm?: string
}

type CLITaskStore = {
  /** Current session ID being tracked */
  sessionId: string | null
  /** Tasks for the current session */
  tasks: CLITask[]
  /** Whether the task bar is expanded */
  expanded: boolean
  /** True when all tasks completed and the user already continued chatting.
   *  Set during history load so the sticky bar is suppressed on page refresh. */
  completedAndDismissed: boolean
  /** Snapshot of the completed task set that was dismissed */
  dismissedCompletionKey: string | null

  /** Fetch tasks for a given session (uses sessionId as taskListId) */
  fetchSessionTasks: (sessionId: string) => Promise<void>
  /** Refresh tasks for the currently tracked session */
  refreshTasks: () => Promise<void>
  /** Update tasks from TodoWrite V1 tool input (in-memory, no disk read needed) */
  setTasksFromTodos: (todos: TodoItem[]) => void
  /** Mark that completed tasks were already dismissed (conversation continued) */
  markCompletedAndDismissed: () => void
  /** Clear task tracking state */
  clearTasks: () => void
  /** Toggle expanded state */
  toggleExpanded: () => void
}

function buildCompletedTaskKey(tasks: CLITask[]): string | null {
  if (tasks.length === 0 || tasks.some((task) => task.status !== 'completed')) return null

  return tasks
    .map((task) => [
      task.taskListId,
      task.id,
      task.subject,
      task.status,
      task.activeForm ?? '',
      task.owner ?? '',
    ].join('::'))
    .join('|')
}

function resolveDismissState(tasks: CLITask[], dismissedCompletionKey: string | null) {
  const completionKey = buildCompletedTaskKey(tasks)
  const keepDismissed = completionKey !== null && completionKey === dismissedCompletionKey

  return {
    completedAndDismissed: keepDismissed,
    dismissedCompletionKey: keepDismissed ? completionKey : null,
  }
}

function mapTodosToTasks(todos: TodoItem[], sessionId: string | null): CLITask[] {
  return todos.map((todo, index) => ({
    id: String(index + 1),
    subject: todo.content,
    description: '',
    activeForm: todo.activeForm,
    status: (['pending', 'in_progress', 'completed'].includes(todo.status)
      ? todo.status
      : 'pending') as TaskStatus,
    blocks: [],
    blockedBy: [],
    taskListId: sessionId || '',
  }))
}

export const useCLITaskStore = create<CLITaskStore>((set, get) => ({
  sessionId: null,
  tasks: [],
  expanded: false,
  completedAndDismissed: false,
  dismissedCompletionKey: null,

  fetchSessionTasks: async (sessionId) => {
    set({ sessionId })
    try {
      const { tasks } = await cliTasksApi.getTasksForList(sessionId)
      // Only update if still tracking the same session
      if (get().sessionId === sessionId) {
        set((state) => ({
          tasks,
          ...resolveDismissState(tasks, state.dismissedCompletionKey),
        }))
      }
    } catch {
      // No tasks for this session — that's fine
      if (get().sessionId === sessionId) {
        set({ tasks: [], completedAndDismissed: false, dismissedCompletionKey: null })
      }
    }
  },

  refreshTasks: async () => {
    const { sessionId } = get()
    if (!sessionId) return
    try {
      const { tasks } = await cliTasksApi.getTasksForList(sessionId)
      if (get().sessionId === sessionId) {
        set((state) => ({
          tasks,
          ...resolveDismissState(tasks, state.dismissedCompletionKey),
        }))
      }
    } catch {
      // ignore
    }
  },

  setTasksFromTodos: (todos) => {
    const tasks = mapTodosToTasks(todos, get().sessionId)
    set((state) => ({
      tasks,
      ...resolveDismissState(tasks, state.dismissedCompletionKey),
    }))
  },

  markCompletedAndDismissed: () => {
    const completionKey = buildCompletedTaskKey(get().tasks)
    if (!completionKey) return

    set({
      completedAndDismissed: true,
      dismissedCompletionKey: completionKey,
      expanded: false,
    })
  },

  clearTasks: () => {
    set({
      sessionId: null,
      tasks: [],
      completedAndDismissed: false,
      dismissedCompletionKey: null,
      expanded: false,
    })
  },

  toggleExpanded: () => {
    set((s) => ({ expanded: !s.expanded }))
  },
}))
