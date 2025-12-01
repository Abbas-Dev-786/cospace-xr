import { createSystem, Types, Vector3, Quaternion, Entity } from "@iwsdk/core";
// Assuming GestureState is defined in your project
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
    console.log("✅ GestureSystem initialized");
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

    // Access input sources from XR session
    const inputSources = Array.from(xrSession.inputSources);

    // Find left and right hand input sources
    const leftHandSource = inputSources.find(
      (source) => source.handedness === "left" && source.hand
    );
    const rightHandSource = inputSources.find(
      (source) => source.handedness === "right" && source.hand
    );

    if (!leftHandSource?.hand || !rightHandSource?.hand) {
      // Hand tracking not available - reset gesture state
      entity.setValue(GestureState, "leftHandGesture", "none");
      entity.setValue(GestureState, "rightHandGesture", "none");
      entity.setValue(GestureState, "swipeDirection", "none");
      entity.setValue(GestureState, "gestureConfidence", 0);
      return;
    }

    // Get XR frame for joint poses
    const xrFrame = this.world.renderer.xr.getFrame();
    if (!xrFrame) return;

    // FIX 1: Ensure getJointPose exists on the frame (it is optional in types)
    if (!xrFrame.getJointPose) return;

    const referenceSpace = this.world.renderer.xr.getReferenceSpace();
    if (!referenceSpace) return;

    // Detect left hand gesture
    const leftGesture = this.detectHandGesture(
      leftHandSource.hand,
      xrFrame,
      referenceSpace,
      "left",
      delta
    );
    entity.setValue(GestureState, "leftHandGesture", leftGesture.type);

    // Detect right hand gesture
    const rightGesture = this.detectHandGesture(
      rightHandSource.hand,
      xrFrame,
      referenceSpace,
      "right",
      delta
    );
    entity.setValue(GestureState, "rightHandGesture", rightGesture.type);

    // Detect swipe gestures (using velocity)
    const swipeDirection = this.detectSwipe(
      rightHandSource.hand,
      xrFrame,
      referenceSpace,
      delta
    );
    entity.setValue(GestureState, "swipeDirection", swipeDirection);

    // Detect two-hand gestures
    const twoHandState = this.detectTwoHandGesture(
      leftHandSource.hand,
      rightHandSource.hand,
      xrFrame,
      referenceSpace
    );
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
    frame: XRFrame,
    referenceSpace: XRReferenceSpace,
    handedness: "left" | "right",
    delta: number
  ): { type: string; confidence: number } {
    // FIX 2: Guard clause for TypeScript safety
    if (!frame.getJointPose) {
      return { type: "none", confidence: 0 };
    }

    // Get joint spaces
    const thumbTip = hand.get("thumb-tip");
    const indexTip = hand.get("index-finger-tip");
    const middleTip = hand.get("middle-finger-tip");
    const ringTip = hand.get("ring-finger-tip");
    const pinkyTip = hand.get("pinky-finger-tip");
    const wrist = hand.get("wrist");

    if (!thumbTip || !indexTip || !middleTip || !wrist) {
      return { type: "none", confidence: 0 };
    }

    // Get joint poses from XRFrame
    // TS logic: We checked frame.getJointPose above, so this call is now safe.
    const thumbPose = frame.getJointPose(thumbTip, referenceSpace);
    const indexPose = frame.getJointPose(indexTip, referenceSpace);
    const middlePose = frame.getJointPose(middleTip, referenceSpace);
    const wristPose = frame.getJointPose(wrist, referenceSpace);

    if (!thumbPose || !indexPose || !middlePose || !wristPose) {
      return { type: "none", confidence: 0 };
    }

    // Convert XR poses to Three.js Vector3
    const thumbPos = new Vector3(
      thumbPose.transform.position.x,
      thumbPose.transform.position.y,
      thumbPose.transform.position.z
    );
    const indexPos = new Vector3(
      indexPose.transform.position.x,
      indexPose.transform.position.y,
      indexPose.transform.position.z
    );
    const middlePos = new Vector3(
      middlePose.transform.position.x,
      middlePose.transform.position.y,
      middlePose.transform.position.z
    );
    const wristPos = new Vector3(
      wristPose.transform.position.x,
      wristPose.transform.position.y,
      wristPose.transform.position.z
    );

    // PINCH DETECTION: Thumb and index distance < threshold
    const pinchDistance = thumbPos.distanceTo(indexPos);
    if (pinchDistance < this.config.pinchThreshold.value) {
      return { type: "pinch-grab", confidence: 0.95 };
    }

    // Calculate finger curl values (0 = extended, 1 = curled)
    const indexCurl = this.calculateFingerCurl(indexPos, wristPos);
    const middleCurl = this.calculateFingerCurl(middlePos, wristPos);
    const thumbCurl = this.calculateFingerCurl(thumbPos, wristPos);

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
   * Calculate finger curl based on joint positions
   * Returns 0 (fully extended) to 1 (fully curled)
   */
  private calculateFingerCurl(tipPos: Vector3, wristPos: Vector3): number {
    // Simple distance-based curl calculation
    const distance = tipPos.distanceTo(wristPos);

    // Normalize: typical extended finger ~0.15m, curled ~0.08m
    const normalizedDistance = (distance - 0.08) / (0.15 - 0.08);

    // Invert and clamp: 0 = extended, 1 = curled
    return Math.max(0, Math.min(1, 1 - normalizedDistance));
  }

  /**
   * Detect swipe gestures from hand velocity
   */
  private detectSwipe(
    hand: XRHand,
    frame: XRFrame,
    referenceSpace: XRReferenceSpace,
    delta: number
  ): string {
    // FIX 3: Guard clause for detectSwipe
    if (!frame.getJointPose) return "none";

    // Use wrist for swipe detection
    const wrist = hand.get("wrist");
    if (!wrist) return "none";

    const wristPose = frame.getJointPose(wrist, referenceSpace);
    if (!wristPose) return "none";

    const currentPos = new Vector3(
      wristPose.transform.position.x,
      wristPose.transform.position.y,
      wristPose.transform.position.z
    );

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
        this.prevRightHandPos.copy(currentPos);
        return velocity.x > 0 ? "right" : "left";
      } else if (
        Math.abs(velocity.y) > Math.abs(velocity.x) &&
        Math.abs(velocity.y) > Math.abs(velocity.z)
      ) {
        this.prevRightHandPos.copy(currentPos);
        return velocity.y > 0 ? "up" : "down";
      }
    }

    // Update previous position
    this.prevRightHandPos.copy(currentPos);

    return "none";
  }

  /**
   * Detect two-hand gestures for resizing
   */
  private detectTwoHandGesture(
    leftHand: XRHand,
    rightHand: XRHand,
    frame: XRFrame,
    referenceSpace: XRReferenceSpace
  ): { active: boolean; distance: number } {
    // FIX 4: Guard clause for detectTwoHandGesture
    if (!frame.getJointPose) {
      return { active: false, distance: 0 };
    }

    const leftThumb = leftHand.get("thumb-tip");
    const leftIndex = leftHand.get("index-finger-tip");
    const rightThumb = rightHand.get("thumb-tip");
    const rightIndex = rightHand.get("index-finger-tip");

    if (!leftThumb || !leftIndex || !rightThumb || !rightIndex) {
      return { active: false, distance: 0 };
    }

    // Get poses
    const leftThumbPose = frame.getJointPose(leftThumb, referenceSpace);
    const leftIndexPose = frame.getJointPose(leftIndex, referenceSpace);
    const rightThumbPose = frame.getJointPose(rightThumb, referenceSpace);
    const rightIndexPose = frame.getJointPose(rightIndex, referenceSpace);

    if (
      !leftThumbPose ||
      !leftIndexPose ||
      !rightThumbPose ||
      !rightIndexPose
    ) {
      return { active: false, distance: 0 };
    }

    // Convert to Vector3
    const leftThumbPos = new Vector3(
      leftThumbPose.transform.position.x,
      leftThumbPose.transform.position.y,
      leftThumbPose.transform.position.z
    );
    const leftIndexPos = new Vector3(
      leftIndexPose.transform.position.x,
      leftIndexPose.transform.position.y,
      leftIndexPose.transform.position.z
    );
    const rightThumbPos = new Vector3(
      rightThumbPose.transform.position.x,
      rightThumbPose.transform.position.y,
      rightThumbPose.transform.position.z
    );
    const rightIndexPos = new Vector3(
      rightIndexPose.transform.position.x,
      rightIndexPose.transform.position.y,
      rightIndexPose.transform.position.z
    );

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
