import { createComponent, Types } from "@iwsdk/core";

/**
 * GestureState Component: Tracks current hand gestures
 *
 * Supported gestures:
 * - pinch-grab: Thumb and index finger pinched
 * - swipe-left/right/up/down: Hand movement in direction
 * - palm-open: Hand fully open (menu trigger)
 * - thumbs-up: Recognition gesture
 * - two-hand-resize: Both hands pinching for scaling
 * - point-direct: Index finger extended, others curled
 */
export const GestureState = createComponent("GestureState", {
  leftHandGesture: {
    type: Types.Enum,
    enum: {
      None: "none",
      PinchGrab: "pinch-grab",
      PalmOpen: "palm-open",
      ThumbsUp: "thumbs-up",
      PointDirect: "point-direct",
    },
    default: "none",
  },

  rightHandGesture: {
    type: Types.Enum,
    enum: {
      None: "none",
      PinchGrab: "pinch-grab",
      PalmOpen: "palm-open",
      ThumbsUp: "thumbs-up",
      PointDirect: "point-direct",
    },
    default: "none",
  },

  // Swipe detection
  swipeDirection: {
    type: Types.Enum,
    enum: {
      None: "none",
      Left: "left",
      Right: "right",
      Up: "up",
      Down: "down",
    },
    default: "none",
  },

  // Two-hand gestures
  twoHandActive: { type: Types.Boolean, default: false },
  twoHandDistance: { type: Types.Float32, default: 0 },

  // Gesture confidence (0-1)
  gestureConfidence: { type: Types.Float32, default: 0 },
});
