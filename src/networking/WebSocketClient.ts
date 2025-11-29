import { io, Socket } from "socket.io-client";

/**
 * WebSocketClient: Manages real-time multiplayer connections
 *
 * Features:
 * - Room-based sessions (max 4 users)
 * - Transform sync (head, hands) at 20Hz
 * - Gesture broadcasts
 * - Task board synchronization
 * - Auto-reconnect logic
 */
export class WebSocketClient {
  private socket: Socket | null = null;
  private roomId: string = "";
  private userId: string = "";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Callbacks for events
  public onUserJoined?: (data: { userId: string; color: number[] }) => void;
  public onUserLeft?: (data: { userId: string }) => void;
  public onRemoteTransform?: (data: any) => void;
  public onRemoteGesture?: (data: any) => void;
  public onTaskChanged?: (data: any) => void;
  public onNewComment?: (data: any) => void;

  constructor(private serverUrl: string) {}

  /**
   * Connect to WebSocket server and join room
   */
  async connect(
    roomId: string,
    userId: string,
    color: number[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.roomId = roomId;
      this.userId = userId;

      // Initialize socket connection
      this.socket = io(this.serverUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      // Connection events
      this.socket.on("connect", () => {
        console.log("✅ Connected to server");
        this.reconnectAttempts = 0;

        // Join room
        this.socket!.emit("join-room", { roomId, userId, color });
      });

      this.socket.on("room-joined", (data) => {
        console.log(`✅ Joined room ${roomId}`, data.users);
        resolve();
      });

      this.socket.on("room-full", () => {
        console.error("❌ Room is full (max 4 users)");
        reject(new Error("Room full"));
      });

      // User events
      this.socket.on("user-joined", (data) => {
        console.log(`👤 User joined: ${data.userId}`);
        this.onUserJoined?.(data);
      });

      this.socket.on("user-left", (data) => {
        console.log(`👤 User left: ${data.userId}`);
        this.onUserLeft?.(data);
      });

      // Transform updates
      this.socket.on("remote-transform", (data) => {
        this.onRemoteTransform?.(data);
      });

      // Gesture updates
      this.socket.on("remote-gesture", (data) => {
        this.onRemoteGesture?.(data);
      });

      // Task board events
      this.socket.on("task-changed", (data) => {
        this.onTaskChanged?.(data);
      });

      this.socket.on("new-comment", (data) => {
        this.onNewComment?.(data);
      });

      // Error handling
      this.socket.on("connect_error", (error) => {
        console.error("❌ Connection error:", error);
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error("Max reconnection attempts reached"));
        }
      });

      this.socket.on("disconnect", (reason) => {
        console.warn("⚠️ Disconnected:", reason);
      });
    });
  }

  /**
   * Send avatar transform update (throttled to 20Hz)
   */
  sendTransformUpdate(data: {
    headPosition: number[];
    headRotation: number[];
    leftHandPosition: number[];
    leftHandRotation: number[];
    rightHandPosition: number[];
    rightHandRotation: number[];
  }): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit("update-transform", data);
  }

  /**
   * Send gesture update
   */
  sendGestureUpdate(data: {
    leftHandGesture: string;
    rightHandGesture: string;
    swipeDirection: string;
  }): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit("update-gesture", data);
  }

  /**
   * Send task board update
   */
  sendTaskUpdate(data: {
    taskId: string;
    column: string;
    position: number;
    text?: string;
    priority?: string;
  }): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit("task-update", data);
  }

  /**
   * Send voice comment
   */
  sendVoiceComment(data: {
    taskId: string;
    text: string;
    timestamp: number;
  }): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit("voice-comment", data);
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
