import { createSystem, Types, Vector3, Quaternion, Entity } from "@iwsdk/core";
import { GestureState } from "../components/GestureState";

/**
 * GestureSystem: Detects hand gestures from XR hand tracking
 *
 * Detection algorithms:
 * - Pinch: Distance between thumb and index < 3cm
 * - Palm open: All fingers extended (>80% curl)
 * - Thumbs up: Thumb extended, others curled
 * - Point: Index extended, others curled
 * - Swipe: Hand velocity > threshold in direction
 * - Two-hand resize: Both hands pinching, moving apart/together
 *
 * Target: 95% accuracy, <100ms latency
 */
export class GestureSystem extends createSystem(
  {
    gestureEntities: { required: [GestureState] },
  },
  {
    pinchThreshold: { type: Types.Float32, default: 0.03 }, // 3cm
    swipeVelocityThreshold: { type: Types.Float32, default: 1.0 }, // 1 m/s
    confidenceThreshold: { type: Types.Float32, default: 0.8 },
  }
) {
  // Previous hand positions for velocity calculation
  private prevLeftHandPos = new Vector3();
  private prevRightHandPos = new Vector3();
  private lastUpdateTime = 0;

  init() {
    console.log("GestureSystem initialized");
  }

  update(delta: number, time: number) {
    this.queries.gestureEntities.entities.forEach((entity) => {
      this.detectGestures(entity, delta, time);
    });

    this.lastUpdateTime = time;
  }

  /**
   * Main gesture detection loop
   */
  private detectGestures(entity: Entity, delta: number, time: number): void {
    const xrSession = this.world.renderer.xr.getSession();
    if (!xrSession) return;

    const leftHand = this.world.input.hands.left;
    const rightHand = this.world.input.hands.right;

    if (!leftHand || !rightHand) return;

    // Detect left hand gesture
    const leftGesture = this.detectHandGesture(leftHand, "left", delta);
    entity.setValue(GestureState, "leftHandGesture", leftGesture.type);

    // Detect right hand gesture
    const rightGesture = this.detectHandGesture(rightHand, "right", delta);
    entity.setValue(GestureState, "rightHandGesture", rightGesture.type);

    // Detect swipe gestures (using velocity)
    const swipeDirection = this.detectSwipe(leftHand, rightHand, delta);
    entity.setValue(GestureState, "swipeDirection", swipeDirection);

    // Detect two-hand gestures
    const twoHandState = this.detectTwoHandGesture(leftHand, rightHand);
    entity.setValue(GestureState, "twoHandActive", twoHandState.active);
    entity.setValue(GestureState, "twoHandDistance", twoHandState.distance);

    // Update confidence score (average of both hands)
    const confidence = (leftGesture.confidence + rightGesture.confidence) / 2;
    entity.setValue(GestureState, "gestureConfidence", confidence);
  }

  /**
   * Detect gesture for a single hand
   */
  private detectHandGesture(
    hand: XRHand,
    handedness: "left" | "right",
    delta: number
  ): { type: string; confidence: number } {
    // Get joint positions using XR
    // Hand tracking API
    const thumbTip = hand.get("thumb-tip");
    const indexTip = hand.get("index-finger-tip");
    const middleTip = hand.get("middle-finger-tip");
    const ringTip = hand.get("ring-finger-tip");
    const pinkyTip = hand.get("pinky-finger-tip");
    const thumbBase = hand.get("thumb-metacarpal");
    const indexBase = hand.get("index-finger-metacarpal");
    const wrist = hand.get("wrist");

    if (!thumbTip || !indexTip || !middleTip || !wrist) {
      return { type: "none", confidence: 0 };
    }

    // Get world positions
    const thumbPos = new Vector3();
    const indexPos = new Vector3();
    const middlePos = new Vector3();
    const ringPos = new Vector3();
    const pinkyPos = new Vector3();
    const wristPos = new Vector3();

    thumbTip.getWorldPosition(thumbPos);
    indexTip.getWorldPosition(indexPos);
    middleTip.getWorldPosition(middlePos);
    ringTip?.getWorldPosition(ringPos);
    pinkyTip?.getWorldPosition(pinkyPos);
    wrist.getWorldPosition(wristPos);

    // Calculate finger curl values (0 = extended, 1 = curled)
    const thumbCurl = this.calculateFingerCurl(thumbTip, thumbBase, wristPos);
    const indexCurl = this.calculateFingerCurl(indexTip, indexBase, wristPos);
    const middleCurl = this.calculateFingerCurl(
      middleTip,
      hand.get("middle-finger-metacarpal"),
      wristPos
    );

    // PINCH DETECTION: Thumb and index distance < threshold
    const pinchDistance = thumbPos.distanceTo(indexPos);
    if (pinchDistance < this.config.pinchThreshold.value) {
      return { type: "pinch-grab", confidence: 0.95 };
    }

    // PALM OPEN: All fingers extended
    if (thumbCurl < 0.3 && indexCurl < 0.3 && middleCurl < 0.3) {
      return { type: "palm-open", confidence: 0.9 };
    }

    // THUMBS UP: Thumb extended, others curled
    if (thumbCurl < 0.3 && indexCurl > 0.7 && middleCurl > 0.7) {
      return { type: "thumbs-up", confidence: 0.85 };
    }

    // POINT: Index extended, others curled
    if (indexCurl < 0.3 && middleCurl > 0.6 && thumbCurl > 0.5) {
      return { type: "point-direct", confidence: 0.88 };
    }

    return { type: "none", confidence: 0 };
  }
  /**

Calculate finger curl based on joint positions
Returns 0 (fully extended) to 1 (fully curled)
*/
  private calculateFingerCurl(
    tip: XRJoint,
    base: XRJoint,
    wristPos: Vector3
  ): number {
    const tipPos = new Vector3();
    const basePos = new Vector3();

    tip.getWorldPosition(tipPos);
    base.getWorldPosition(basePos);

    // Calculate angle between finger vector and hand normal
    const fingerVector = new Vector3().subVectors(tipPos, basePos).normalize();
    const wristToBase = new Vector3().subVectors(basePos, wristPos).normalize();

    const dot = fingerVector.dot(wristToBase);

    // Convert to curl value (0-1)
    return (1 - dot) / 2;
  }
  /**

Detect swipe gestures from hand velocity
*/
  private detectSwipe(
    leftHand: XRHand,
    rightHand: XRHand,
    delta: number
  ): string {
    // Use right hand for swipe detection (dominant hand)
    const wrist = rightHand.get("wrist");
    if (!wrist) return "none";

    const currentPos = new Vector3();
    wrist.getWorldPosition(currentPos);

    // Calculate velocity
    const velocity = new Vector3()
      .subVectors(currentPos, this.prevRightHandPos)
      .divideScalar(delta);

    const speed = velocity.length();

    // Check if velocity exceeds threshold
    if (speed > this.config.swipeVelocityThreshold.value) {
      // Determine direction
      if (
        Math.abs(velocity.x) > Math.abs(velocity.y) &&
        Math.abs(velocity.x) > Math.abs(velocity.z)
      ) {
        return velocity.x > 0 ? "right" : "left";
      } else if (
        Math.abs(velocity.y) > Math.abs(velocity.x) &&
        Math.abs(velocity.y) > Math.abs(velocity.z)
      ) {
        return velocity.y > 0 ? "up" : "down";
      }
    }

    // Update previous position
    this.prevRightHandPos.copy(currentPos);

    return "none";
  }
  /**

Detect two-hand gestures for resizing
*/
  private detectTwoHandGesture(
    leftHand: XRHand,
    rightHand: XRHand
  ): { active: boolean; distance: number } {
    const leftThumb = leftHand.get("thumb-tip");
    const leftIndex = leftHand.get("index-finger-tip");
    const rightThumb = rightHand.get("thumb-tip");
    const rightIndex = rightHand.get("index-finger-tip");

    if (!leftThumb || !leftIndex || !rightThumb || !rightIndex) {
      return { active: false, distance: 0 };
    }

    const leftThumbPos = new Vector3();
    const leftIndexPos = new Vector3();
    const rightThumbPos = new Vector3();
    const rightIndexPos = new Vector3();

    leftThumb.getWorldPosition(leftThumbPos);
    leftIndex.getWorldPosition(leftIndexPos);
    rightThumb.getWorldPosition(rightThumbPos);
    rightIndex.getWorldPosition(rightIndexPos);

    // Check if both hands are pinching
    const leftPinch =
      leftThumbPos.distanceTo(leftIndexPos) < this.config.pinchThreshold.value;
    const rightPinch =
      rightThumbPos.distanceTo(rightIndexPos) <
      this.config.pinchThreshold.value;

    if (leftPinch && rightPinch) {
      // Calculate distance between pinch points
      const leftPinchCenter = new Vector3()
        .addVectors(leftThumbPos, leftIndexPos)
        .multiplyScalar(0.5);
      const rightPinchCenter = new Vector3()
        .addVectors(rightThumbPos, rightIndexPos)
        .multiplyScalar(0.5);
      const distance = leftPinchCenter.distanceTo(rightPinchCenter);

      return { active: true, distance };
    }

    return { active: false, distance: 0 };
  }
}
