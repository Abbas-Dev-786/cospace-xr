import { createComponent, Types } from "@iwsdk/core";

/**
 * TaskCard Component: Individual task on the Kanban board
 *
 * Properties:
 * - taskId: Unique identifier
 * - column: Which column (todo/in-progress/done)
 * - text: Task description
 * - priority: Visual indicator (red/yellow/green)
 * - position: Order within column
 * - comments: Array of voice-to-text comments
 * - assignedTo: User ID who owns the task
 * - createdAt: Timestamp
 */
export const TaskCard = createComponent("TaskCard", {
  taskId: { type: Types.String, default: "" },

  column: {
    type: Types.Enum,
    enum: { Todo: "todo", InProgress: "in-progress", Done: "done" },
    default: "todo",
  },

  text: { type: Types.String, default: "New Task" },

  priority: {
    type: Types.Enum,
    enum: { High: "high", Medium: "medium", Low: "low" },
    default: "medium",
  },

  position: { type: Types.Int16, default: 0 },

  // Comments stored as JSON string
  comments: { type: Types.String, default: "[]" },

  assignedTo: { type: Types.String, default: "" },
  createdAt: { type: Types.Float32, default: 0 },

  // Visual state
  isGrabbed: { type: Types.Boolean, default: false },
  targetPosition: { type: Types.Vec3, default: [0, 0, 0] },
});
