import { createSystem, Types, eq, Entity } from "@iwsdk/core";
import { Avatar } from "../components/Avatar";
import { GestureState } from "../components/GestureState";
import { WebSocketClient } from "../networking/WebSocketClient";

/**
 * NetworkSystem: Manages multiplayer state synchronization
 *
 * Responsibilities:
 * - Connect to WebSocket server
 * - Sync local avatar transforms at 20Hz
 * - Create remote avatars from network events
 * - Forward gestures to remote users
 * - Handle task board synchronization
 * - Maintain <200ms latency
 */
export class NetworkSystem extends createSystem(
  {
    localAvatar: {
      required: [Avatar, GestureState],
      where: [eq(Avatar, "isLocal", true)],
    },
    remoteAvatars: {
      required: [Avatar],
      where: [eq(Avatar, "isLocal", false)],
    },
  },
  {
    serverUrl: { type: Types.String, default: "ws://localhost:3000" },
    syncRate: { type: Types.Float32, default: 0.05 }, // 20Hz = 50ms
    roomId: { type: Types.String, default: "default-room" },
  }
) {
  private wsClient: WebSocketClient;
  private lastSyncTime = 0;
  private localUserId = "";
  private remoteUsers = new Map<string, Entity>();

  init() {
    // Generate unique user ID
    this.localUserId = `user_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Initialize WebSocket client
    this.wsClient = new WebSocketClient(this.config.serverUrl.value);

    // Set up event handlers
    this.setupEventHandlers();

    // Connect to server
    this.connectToServer();
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    // User joined
    this.wsClient.onUserJoined = (data) => {
      this.createRemoteAvatar(data.userId, data.color);
    };

    // User left
    this.wsClient.onUserLeft = (data) => {
      this.removeRemoteAvatar(data.userId);
    };

    // Remote transform update
    this.wsClient.onRemoteTransform = (data) => {
      this.updateRemoteAvatar(data);
    };

    // Remote gesture update
    this.wsClient.onRemoteGesture = (data) => {
      this.updateRemoteGesture(data);
    };

    // Task board changes
    this.wsClient.onTaskChanged = (data) => {
      // Forward to TaskBoardSystem via world globals
      this.world.globals.taskBoardUpdates =
        this.world.globals.taskBoardUpdates || [];
      this.world.globals.taskBoardUpdates.push(data);
    };

    // Voice comments
    this.wsClient.onNewComment = (data) => {
      console.log(`New comment from ${data.userId}: ${data.text}`);
      // Forward to TaskBoardSystem
      this.world.globals.taskComments = this.world.globals.taskComments || [];
      this.world.globals.taskComments.push(data);
    };
  }

  /**
   * Connect to WebSocket server
   */
  private async connectToServer(): Promise<void> {
    try {
      // Get local avatar color
      const localEntity = Array.from(this.queries.localAvatar.entities)[0];
      const color = localEntity?.getValue(Avatar, "color") || [0.3, 0.5, 0.8];

      await this.wsClient.connect(
        this.config.roomId.value,
        this.localUserId,
        color
      );

      console.log(`✅ Connected to room: ${this.config.roomId.value}`);
    } catch (error) {
      console.error("❌ Failed to connect:", error);

      // Retry after 5 seconds
      setTimeout(() => this.connectToServer(), 5000);
    }
  }

  update(delta: number, time: number) {
    if (!this.wsClient.isConnected()) return;

    // Sync local avatar at configured rate (default 20Hz)
    if (time - this.lastSyncTime >= this.config.syncRate.value) {
      this.syncLocalAvatar();
      this.lastSyncTime = time;
    }

    // Sync gestures immediately when they change
    this.syncLocalGestures();
  }

  /**
   * Send local avatar transform to server
   */
  private syncLocalAvatar(): void {
    const localEntity = Array.from(this.queries.localAvatar.entities)[0];
    if (!localEntity) return;

    const data = {
      headPosition: localEntity.getValue(Avatar, "headPosition"),
      headRotation: localEntity.getValue(Avatar, "headRotation"),
      leftHandPosition: localEntity.getValue(Avatar, "leftHandPosition"),
      leftHandRotation: localEntity.getValue(Avatar, "leftHandRotation"),
      rightHandPosition: localEntity.getValue(Avatar, "rightHandPosition"),
      rightHandRotation: localEntity.getValue(Avatar, "rightHandRotation"),
    };

    this.wsClient.sendTransformUpdate(data);
  }

  /**
   * Send local gestures to server
   */
  private syncLocalGestures(): void {
    const localEntity = Array.from(this.queries.localAvatar.entities)[0];
    if (!localEntity) return;

    const data = {
      leftHandGesture: localEntity.getValue(GestureState, "leftHandGesture"),
      rightHandGesture: localEntity.getValue(GestureState, "rightHandGesture"),
      swipeDirection: localEntity.getValue(GestureState, "swipeDirection"),
    };

    this.wsClient.sendGestureUpdate(data);
  }

  /**
   * Create a remote avatar for a new user
   */
  private createRemoteAvatar(userId: string, color: number[]): void {
    const remoteEntity = this.world.createTransformEntity();

    remoteEntity.addComponent(Avatar, {
      userId,
      color,
      isLocal: false,
    });

    remoteEntity.addComponent(GestureState);

    this.remoteUsers.set(userId, remoteEntity);
    console.log(`Created remote avatar for ${userId}`);
  }

  /**
   * Remove a remote avatar when user leaves
   */
  private removeRemoteAvatar(userId: string): void {
    const entity = this.remoteUsers.get(userId);

    if (entity) {
      entity.destroy();
      this.remoteUsers.delete(userId);
      console.log(`Removed remote avatar for ${userId}`);
    }
  }

  /**
   * Update remote avatar from network data
   */
  private updateRemoteAvatar(data: any): void {
    const entity = this.remoteUsers.get(data.userId);
    if (!entity) return;

    entity.setValue(Avatar, "headPosition", data.headPosition);
    entity.setValue(Avatar, "headRotation", data.headRotation);
    entity.setValue(Avatar, "leftHandPosition", data.leftHandPosition);
    entity.setValue(Avatar, "leftHandRotation", data.leftHandRotation);
    entity.setValue(Avatar, "rightHandPosition", data.rightHandPosition);
    entity.setValue(Avatar, "rightHandRotation", data.rightHandRotation);
  }

  /**
   * Update remote gesture from network data
   */
  private updateRemoteGesture(data: any): void {
    const entity = this.remoteUsers.get(data.userId);
    if (!entity) return;

    entity.setValue(GestureState, "leftHandGesture", data.leftHandGesture);
    entity.setValue(GestureState, "rightHandGesture", data.rightHandGesture);
    entity.setValue(GestureState, "swipeDirection", data.swipeDirection);
  }

  destroy() {
    this.wsClient.disconnect();
  }
}
