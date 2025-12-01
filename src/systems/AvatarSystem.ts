import {
  createSystem,
  Types,
  Mesh,
  BoxGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  eq,
  Entity,
  Color,
} from "@iwsdk/core";
import { Avatar } from "../components/Avatar";

/**
 * AvatarSystem: Manages avatar creation, hand tracking updates, and status
 *
 * Features:
 * - Creates voxel-style avatars (head + hands)
 * - Updates positions from XR hand tracking
 * - Idle animation when stationary
 * - Activity status detection (idle after 30s, away after 2min)
 * - Color customization
 */
export class AvatarSystem extends createSystem(
  {
    avatars: { required: [Avatar] },
    localAvatars: {
      required: [Avatar],
      where: [eq(Avatar, "isLocal", true)],
    },
  },
  {
    idleTimeout: { type: Types.Float32, default: 30.0 }, // 30 seconds
    awayTimeout: { type: Types.Float32, default: 120.0 }, // 2 minutes
  }
) {
  private idleAnimationTime = 0;

  init() {
    // Subscribe to new avatars being created
    this.queries.avatars.subscribe("qualify", (entity) => {
      this.createAvatarVisuals(entity);
    });

    // Subscribe to avatar removal for cleanup
    this.queries.avatars.subscribe("disqualify", (entity) => {
      this.cleanupAvatarVisuals(entity);
    });

    console.log("✅ AvatarSystem initialized");
  }

  update(delta: number, time: number) {
    this.idleAnimationTime += delta;

    // Update local avatar from XR tracking
    this.updateLocalAvatar(delta, time);

    // Update all avatars' visuals and status
    this.queries.avatars.entities.forEach((entity) => {
      this.updateAvatarVisuals(entity, time);
      this.updateActivityStatus(entity, time);
    });
  }

  /**
   * Create visual representation for an avatar
   */
  private createAvatarVisuals(entity: Entity): void {
    // FIX: Use getVectorView to read the color array
    const colorView = entity.getVectorView(Avatar, "color");

    const material = new MeshStandardMaterial({
      // @ts-ignore - Color.fromArray accepts ArrayLike
      color: new Color().fromArray(colorView),
      roughness: 0.7,
      metalness: 0.1,
    });

    // Head: 20cm cube
    const headGeometry = new BoxGeometry(0.2, 0.2, 0.2);
    const head = new Mesh(headGeometry, material.clone());
    head.castShadow = true;
    entity?.object3D?.add(head);
    (entity as any)._avatarHead = head;

    // Left hand: 10cm sphere
    const handGeometry = new SphereGeometry(0.05, 16, 16);
    const leftHand = new Mesh(handGeometry, material.clone());
    leftHand.castShadow = true;
    entity?.object3D?.add(leftHand);
    (entity as any)._avatarLeftHand = leftHand;

    // Right hand: 10cm sphere
    const rightHand = new Mesh(handGeometry, material.clone());
    rightHand.castShadow = true;
    entity?.object3D?.add(rightHand);
    (entity as any)._avatarRightHand = rightHand;
  }

  /**
   * Update local avatar from XR hand tracking data
   */
  private updateLocalAvatar(delta: number, time: number): void {
    this.queries.localAvatars.entities.forEach((entity) => {
      // Get XR player head position (always available in VR)
      const headPos = this.player.head.position;
      const headQuat = this.player.head.quaternion;

      // FIX: Write to vector views directly instead of using setValue
      // This prevents the error and optimizes performance (0 allocations)
      const headPosView = entity.getVectorView(Avatar, "headPosition");
      const headRotView = entity.getVectorView(Avatar, "headRotation");

      headPos.toArray(headPosView);
      headQuat.toArray(headRotView);

      // Get XR session to check hand tracking availability
      const xrSession = this.world.renderer.xr.getSession();

      // Only update hands if session exists and hand tracking is active
      if (xrSession) {
        const xrFrame = this.world.renderer.xr.getFrame();
        const referenceSpace = this.world.renderer.xr.getReferenceSpace();

        if (xrFrame && referenceSpace) {
          // Guard clause for missing hand tracking support
          if (!xrFrame.getJointPose) return;

          // Access input sources from XR session
          const inputSources = Array.from(xrSession.inputSources);

          // --- LEFT HAND ---
          const leftHandSource = inputSources.find(
            (source) => source.handedness === "left" && source.hand
          );

          if (leftHandSource && leftHandSource.hand) {
            try {
              const wristJoint = leftHandSource.hand.get("wrist");
              if (wristJoint) {
                const wristPose = xrFrame.getJointPose(
                  wristJoint,
                  referenceSpace
                );

                if (wristPose) {
                  const leftHandPos = new Vector3(
                    wristPose.transform.position.x,
                    wristPose.transform.position.y,
                    wristPose.transform.position.z
                  );
                  const leftHandQuat = new Quaternion(
                    wristPose.transform.orientation.x,
                    wristPose.transform.orientation.y,
                    wristPose.transform.orientation.z,
                    wristPose.transform.orientation.w
                  );

                  // FIX: Use views for left hand
                  const leftPosView = entity.getVectorView(
                    Avatar,
                    "leftHandPosition"
                  );
                  const leftRotView = entity.getVectorView(
                    Avatar,
                    "leftHandRotation"
                  );

                  leftHandPos.toArray(leftPosView);
                  leftHandQuat.toArray(leftRotView);
                }
              }
            } catch (error) {
              // Ignore tracking errors
            }
          }

          // --- RIGHT HAND ---
          const rightHandSource = inputSources.find(
            (source) => source.handedness === "right" && source.hand
          );

          if (rightHandSource && rightHandSource.hand) {
            try {
              const wristJoint = rightHandSource.hand.get("wrist");
              if (wristJoint) {
                const wristPose = xrFrame.getJointPose(
                  wristJoint,
                  referenceSpace
                );

                if (wristPose) {
                  const rightHandPos = new Vector3(
                    wristPose.transform.position.x,
                    wristPose.transform.position.y,
                    wristPose.transform.position.z
                  );
                  const rightHandQuat = new Quaternion(
                    wristPose.transform.orientation.x,
                    wristPose.transform.orientation.y,
                    wristPose.transform.orientation.z,
                    wristPose.transform.orientation.w
                  );

                  // FIX: Use views for right hand
                  const rightPosView = entity.getVectorView(
                    Avatar,
                    "rightHandPosition"
                  );
                  const rightRotView = entity.getVectorView(
                    Avatar,
                    "rightHandRotation"
                  );

                  rightHandPos.toArray(rightPosView);
                  rightHandQuat.toArray(rightRotView);
                }
              }
            } catch (error) {
              // Ignore tracking errors
            }
          }
        }
      }

      // Update last activity time (Scalars use setValue)
      entity.setValue(Avatar, "lastActivityTime", time);
    });
  }

  /**
   * Update avatar visual meshes from component data
   */
  private updateAvatarVisuals(entity: Entity, time: number): void {
    const head = (entity as any)._avatarHead as Mesh;
    const leftHand = (entity as any)._avatarLeftHand as Mesh;
    const rightHand = (entity as any)._avatarRightHand as Mesh;

    if (!head || !leftHand || !rightHand) return;

    // FIX: Read from views for performance
    const headPos = entity.getVectorView(Avatar, "headPosition");
    const headRot = entity.getVectorView(Avatar, "headRotation");
    head.position.fromArray(headPos);
    head.quaternion.fromArray(headRot);

    const leftHandPos = entity.getVectorView(Avatar, "leftHandPosition");
    const leftHandRot = entity.getVectorView(Avatar, "leftHandRotation");
    leftHand.position.fromArray(leftHandPos);
    leftHand.quaternion.fromArray(leftHandRot);

    const rightHandPos = entity.getVectorView(Avatar, "rightHandPosition");
    const rightHandRot = entity.getVectorView(Avatar, "rightHandRotation");
    rightHand.position.fromArray(rightHandPos);
    rightHand.quaternion.fromArray(rightHandRot);

    // Apply idle animation (gentle floating)
    const status = entity.getValue(Avatar, "status");
    if (status === "idle") {
      const floatOffset = Math.sin(this.idleAnimationTime * 2) * 0.02;
      head.position.y += floatOffset;
      leftHand.position.y += floatOffset;
      rightHand.position.y += floatOffset;
    }
  }

  /**
   * Update activity status based on time since last activity
   */
  private updateActivityStatus(entity: Entity, time: number): void {
    const lastActivity = entity.getValue(Avatar, "lastActivityTime");
    const timeSinceActivity = time - lastActivity!;

    const currentStatus = entity.getValue(Avatar, "status");
    let newStatus = currentStatus;

    if (timeSinceActivity > this.config.awayTimeout.value) {
      newStatus = "away";
    } else if (timeSinceActivity > this.config.idleTimeout.value) {
      newStatus = "idle";
    } else {
      newStatus = "active";
    }

    if (newStatus !== currentStatus) {
      entity.setValue(Avatar, "status", newStatus);
      console.log(
        `Avatar ${entity.getValue(Avatar, "userId")} is now ${newStatus}`
      );
    }
  }

  /**
   * Clean up avatar meshes when entity is removed
   */
  private cleanupAvatarVisuals(entity: Entity): void {
    const head = (entity as any)._avatarHead;
    const leftHand = (entity as any)._avatarLeftHand;
    const rightHand = (entity as any)._avatarRightHand;

    if (head) {
      head.geometry.dispose();
      head.material.dispose();
    }
    if (leftHand) {
      leftHand.geometry.dispose();
      leftHand.material.dispose();
    }
    if (rightHand) {
      rightHand.geometry.dispose();
      rightHand.material.dispose();
    }
  }
}
