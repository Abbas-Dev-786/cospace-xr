import {
  createSystem,
  Types,
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
  BoxGeometry,
  Vector3,
  Interactable,
  OneHandGrabbable,
  eq,
  Entity,
} from "@iwsdk/core";
import { TaskCard } from "../components/TaskCard";
import { GestureState } from "../components/GestureState";

/**
 * TaskBoardSystem: Manages Kanban board with 3 columns
 *
 * Features:
 * - Drag-drop tasks between columns
 * - Voice-to-text comments
 * - Priority color coding (red/yellow/green)
 * - Automatic column positioning
 * - Network synchronization
 * - Voice command: "Add comment: [text]"
 */
export class TaskBoardSystem extends createSystem(
  {
    taskCards: { required: [TaskCard] },
    grabbedTasks: {
      required: [TaskCard, Interactable],
      where: [eq(TaskCard, "isGrabbed", true)],
    },
  },
  {
    boardPosition: { type: Types.Vec3, default: [0, 1.5, -2.0] },
    columnSpacing: { type: Types.Float32, default: 1.2 }, // meters
    cardSpacing: { type: Types.Float32, default: 0.25 }, // meters
    voiceCommandEnabled: { type: Types.Boolean, default: true },
  }
) {
  private boardRoot: Entity | null = null;
  private columnEntities: Map<string, Entity> = new Map();

  // Voice recognition (Web Speech API)
  private recognition: any = null;
  private isListening = false;

  init() {
    // Create task board structure
    this.createTaskBoard();

    // Initialize voice recognition
    if (this.config.voiceCommandEnabled.value) {
      this.initializeVoiceRecognition();
    }

    // Subscribe to new tasks
    this.queries.taskCards.subscribe("qualify", (entity) => {
      this.createTaskCardVisual(entity);
    });

    // Subscribe to task removal
    this.queries.taskCards.subscribe("disqualify", (entity) => {
      this.cleanupTaskCard(entity);
    });

    // Listen for network updates
    this.world.globals.taskBoardUpdates = [];
    this.world.globals.taskComments = [];
  }

  update(delta: number, time: number) {
    // Process network updates
    this.processNetworkUpdates();

    // Update card positions based on column/position
    this.updateCardPositions();

    // Handle grabbed tasks
    this.handleGrabbedTasks();

    // Check for voice commands
    if (this.isListening) {
      this.processVoiceCommands();
    }
  }

  /**
   * Create the main task board structure
   */
  private createTaskBoard(): void {
    const boardPos = this.config.boardPosition.value;

    // Create board root entity
    this.boardRoot = this.world.createTransformEntity();
    this.boardRoot.object3D.position.fromArray(boardPos);

    // Create 3 columns: Todo, In Progress, Done
    const columns = ["todo", "in-progress", "done"];
    const columnLabels = ["TO DO", "IN PROGRESS", "DONE"];

    columns.forEach((column, index) => {
      const columnX = (index - 1) * this.config.columnSpacing.value;

      // Column background panel
      const columnGeometry = new PlaneGeometry(1.0, 2.0);
      const columnMaterial = new MeshStandardMaterial({
        color: 0x2c3e50,
        roughness: 0.8,
        transparent: true,
        opacity: 0.9,
      });
      const columnMesh = new Mesh(columnGeometry, columnMaterial);
      columnMesh.position.set(columnX, 0, 0);

      const columnEntity = this.world.createTransformEntity(columnMesh, {
        parent: this.boardRoot,
      });

      this.columnEntities.set(column, columnEntity);

      // Column header (using UIKitML would be better, simplified here)
      const headerGeometry = new BoxGeometry(0.9, 0.15, 0.02);
      const headerMaterial = new MeshStandardMaterial({
        color: 0x34495e,
      });
      const headerMesh = new Mesh(headerGeometry, headerMaterial);
      headerMesh.position.set(columnX, 1.0, 0.02);

      this.world.createTransformEntity(headerMesh, { parent: this.boardRoot });

      console.log(`Created column: ${columnLabels[index]}`);
    });

    // Create initial demo tasks
    this.createDemoTasks();
  }

  /**
   * Create demo tasks for testing
   */
  private createDemoTasks(): void {
    const demoTasks = [
      {
        taskId: "task_1",
        column: "todo",
        text: "Setup project structure",
        priority: "high",
        position: 0,
      },
      {
        taskId: "task_2",
        column: "todo",
        text: "Design avatar system",
        priority: "medium",
        position: 1,
      },
      {
        taskId: "task_3",
        column: "in-progress",
        text: "Implement hand tracking",
        priority: "high",
        position: 0,
      },
      {
        taskId: "task_4",
        column: "done",
        text: "Create office environment",
        priority: "low",
        position: 0,
      },
    ];

    demoTasks.forEach((taskData) => {
      const taskEntity = this.world.createTransformEntity();

      taskEntity.addComponent(TaskCard, {
        ...taskData,
        createdAt: Date.now(),
      });

      taskEntity.addComponent(Interactable);
      taskEntity.addComponent(OneHandGrabbable, {
        translate: true,
        rotate: false,
      });
    });
  }

  /**
   * Create visual representation for a task card
   */
  private createTaskCardVisual(entity: Entity): void {
    const priority = entity.getValue(TaskCard, "priority");

    // Priority color mapping
    const priorityColors = {
      high: 0xff6b6b, // Red
      medium: 0xffd93d, // Yellow
      low: 0x6bcf7f, // Green
    };

    const color = priorityColors[priority as keyof typeof priorityColors];

    // Card geometry (10cm x 8cm)
    const cardGeometry = new PlaneGeometry(0.1, 0.08);
    const cardMaterial = new MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.1,
    });

    const cardMesh = new Mesh(cardGeometry, cardMaterial);
    entity.object3D.add(cardMesh);

    // Store reference for updates
    (entity as any)._taskCardMesh = cardMesh;

    console.log(
      `Created task card visual: ${entity.getValue(TaskCard, "taskId")}`
    );
  }

  /**
   * Update card positions based on column and position
   */
  private updateCardPositions(): void {
    const cardsByColumn = new Map<string, Entity[]>();

    // Group cards by column
    this.queries.taskCards.entities.forEach((entity) => {
      const column = entity.getValue(TaskCard, "column");
      if (!cardsByColumn.has(column!)) {
        cardsByColumn.set(column!, []);
      }
      cardsByColumn.get(column!)!.push(entity);
    });

    // Position cards within each column
    cardsByColumn.forEach((cards, column) => {
      // Sort by position
      cards.sort((a, b) => {
        const posA = a.getValue(TaskCard, "position") || 0;
        const posB = b.getValue(TaskCard, "position") || 0;
        return posA - posB;
      });

      // Calculate positions
      const columnIndex = ["todo", "in-progress", "done"].indexOf(column);
      const columnX = (columnIndex - 1) * this.config.columnSpacing.value;

      cards.forEach((entity, index) => {
        const isGrabbed = entity.getValue(TaskCard, "isGrabbed");
        if (isGrabbed) return; // Skip grabbed cards

        const cardY = 0.8 - index * this.config.cardSpacing.value;
        const targetPosition = new Vector3(columnX, cardY, 0.05);

        // Smooth interpolation to target position
        const currentPos = entity.object3D.position;
        currentPos.lerp(targetPosition, 0.1);
      });
    });
  }

  /**
   * Handle drag-drop logic for grabbed tasks
   */
  private handleGrabbedTasks(): void {
    this.queries.grabbedTasks.entities.forEach((entity) => {
      // Detect which column the card is over
      const worldPos = new Vector3();
      entity.object3D.getWorldPosition(worldPos);

      // Convert to board-local coordinates
      if (!this.boardRoot) return;
      const localPos = worldPos.clone();
      this.boardRoot.object3D.worldToLocal(localPos);

      // Determine column based on X position
      const columnIndex =
        Math.round(localPos.x / this.config.columnSpacing.value) + 1;
      const columns = ["todo", "in-progress", "done"];
      const newColumn = columns[Math.max(0, Math.min(2, columnIndex))];

      // Update column if changed
      const currentColumn = entity.getValue(TaskCard, "column");
      if (newColumn !== currentColumn) {
        entity.setValue(TaskCard, "column", newColumn);

        // Sync to network
        this.syncTaskToNetwork(entity);

        console.log(`Task moved to ${newColumn}`);
      }
    });
  }

  /**
   * Initialize Web Speech API for voice commands
   */
  private initializeVoiceRecognition(): void {
    if (!("webkitSpeechRecognition" in window)) {
      console.warn("Voice recognition not supported");
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.toLowerCase();

      if (transcript.includes("add comment")) {
        const commentText = transcript.replace("add comment", "").trim();
        if (commentText) {
          this.addVoiceComment(commentText);
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
    };

    // Start listening
    this.startListening();
  }

  /**
   * Start voice recognition
   */
  private startListening(): void {
    if (this.recognition && !this.isListening) {
      this.recognition.start();
      this.isListening = true;
      console.log("Voice recognition started");
    }
  }

  /**
   * Stop voice recognition
   */
  private stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      console.log("Voice recognition stopped");
    }
  }

  /**
   * Add voice comment to currently focused task
   */
  private addVoiceComment(text: string): void {
    // Find task being pointed at or recently interacted with
    // For simplicity, add to first task
    const taskEntity = Array.from(this.queries.taskCards.entities)[0];
    if (!taskEntity) return;

    const taskId = taskEntity.getValue(TaskCard, "taskId");
    const commentsJson = taskEntity.getValue(TaskCard, "comments") || "[]";
    const comments = JSON.parse(commentsJson);

    const newComment = {
      text,
      timestamp: Date.now(),
      userId: this.world.globals.localUserId || "anonymous",
    };

    comments.push(newComment);
    taskEntity.setValue(TaskCard, "comments", JSON.stringify(comments));

    console.log(`Added voice comment to ${taskId}: "${text}"`);

    // Sync to network
    if (this.world.globals.networkSystem) {
      this.world.globals.networkSystem.wsClient.sendVoiceComment({
        taskId: taskId!,
        text,
        timestamp: newComment.timestamp,
      });
    }
  }

  /**
   * Process voice commands
   */
  private processVoiceCommands(): void {
    // Voice commands are handled via recognition.onresult
    // Additional command parsing can go here
  }

  /**
   * Sync task changes to network
   */
  private syncTaskToNetwork(entity: Entity): void {
    const data = {
      taskId: entity.getValue(TaskCard, "taskId"),
      column: entity.getValue(TaskCard, "column"),
      position: entity.getValue(TaskCard, "position"),
      text: entity.getValue(TaskCard, "text"),
      priority: entity.getValue(TaskCard, "priority"),
    };

    if (this.world.globals.networkSystem) {
      this.world.globals.networkSystem.wsClient.sendTaskUpdate(data);
    }
  }

  /**
   * Process incoming network updates
   */
  private processNetworkUpdates(): void {
    const updates = this.world.globals.taskBoardUpdates as any[];
    if (!updates || updates.length === 0) return;

    updates.forEach((update) => {
      // Find task by ID
      const taskEntity = Array.from(this.queries.taskCards.entities).find(
        (e) => e.getValue(TaskCard, "taskId") === update.taskId
      );

      if (taskEntity) {
        // Update task properties
        if (update.column)
          taskEntity.setValue(TaskCard, "column", update.column);
        if (update.position !== undefined)
          taskEntity.setValue(TaskCard, "position", update.position);
        if (update.text) taskEntity.setValue(TaskCard, "text", update.text);
        if (update.priority)
          taskEntity.setValue(TaskCard, "priority", update.priority);
      }
    });

    // Clear processed updates
    this.world.globals.taskBoardUpdates = [];
  }

  /**
   * Cleanup task card visuals
   */
  private cleanupTaskCard(entity: Entity): void {
    const mesh = (entity as any)._taskCardMesh;
    if (mesh) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }

  destroy() {
    this.stopListening();
  }
}
