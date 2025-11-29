import { createComponent, Types } from "@iwsdk/core";

/**
 * Avatar Component: Stores avatar customization and tracking state
 * Properties:
 * - userId: Unique identifier for multiplayer sync
 * - color: RGB color array for avatar customization
 * - isLocal: Whether this is the local user's avatar
 * - headPosition: Tracked head position (synced)
 * - leftHandPosition: Tracked left hand position
 * - rightHandPosition: Tracked right hand position
 * - status: User activity status (active/idle/away)
 */
export const Avatar = createComponent("Avatar", {
  userId: { type: Types.String, default: "" },
  color: { type: Types.Vec3, default: [0.3, 0.5, 0.8] }, // Default blue
  isLocal: { type: Types.Boolean, default: false },

  // Tracking data (synced over network)
  headPosition: { type: Types.Vec3, default: [0, 1.6, 0] },
  headRotation: { type: Types.Vec4, default: [0, 0, 0, 1] }, // Quaternion

  leftHandPosition: { type: Types.Vec3, default: [0, 0, 0] },
  leftHandRotation: { type: Types.Vec4, default: [0, 0, 0, 1] },

  rightHandPosition: { type: Types.Vec3, default: [0, 0, 0] },
  rightHandRotation: { type: Types.Vec4, default: [0, 0, 0, 1] },

  // Activity state
  status: {
    type: Types.Enum,
    enum: { Active: "active", Idle: "idle", Away: "away" },
    default: "active",
  },

  lastActivityTime: { type: Types.Float32, default: 0 },
});
