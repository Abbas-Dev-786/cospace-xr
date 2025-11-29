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
    const color = entity.getValue(Avatar, "color");
    const material = new MeshStandardMaterial({
      color: new Color().fromArray(color!),
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
      // Get XR player head position
      const headPos = this.player.head.position;
      const headQuat = this.player.head.quaternion;

      entity.setValue(Avatar, "headPosition", headPos.toArray());
      entity.setValue(Avatar, "headRotation", headQuat.toArray());

      // Get hand tracking data if available
      const xrSession = this.world.renderer.xr.getSession();

      if (xrSession && this.world.input.hands.left) {
        const leftHandPos = this.world.input.hands.left.position;
        const leftHandQuat = this.world.input.hands.left.quaternion;

        entity.setValue(Avatar, "leftHandPosition", leftHandPos.toArray());
        entity.setValue(Avatar, "leftHandRotation", leftHandQuat.toArray());
      }

      if (xrSession && this.world.input.hands.right) {
        const rightHandPos = this.world.input.hands.right.position;
        const rightHandQuat = this.world.input.hands.right.quaternion;

        entity.setValue(Avatar, "rightHandPosition", rightHandPos.toArray());
        entity.setValue(Avatar, "rightHandRotation", rightHandQuat.toArray());
      }

      // Update last activity time
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

    // Update head position and rotation
    const headPos = entity.getValue(Avatar, "headPosition");
    const headRot = entity.getValue(Avatar, "headRotation");
    head.position.fromArray(headPos!);
    head.quaternion.fromArray(headRot!);

    // Update hand positions
    const leftHandPos = entity.getValue(Avatar, "leftHandPosition");
    const leftHandRot = entity.getValue(Avatar, "leftHandRotation");
    leftHand.position.fromArray(leftHandPos!);
    leftHand.quaternion.fromArray(leftHandRot!);

    const rightHandPos = entity.getValue(Avatar, "rightHandPosition");
    const rightHandRot = entity.getValue(Avatar, "rightHandRotation");
    rightHand.position.fromArray(rightHandPos!);
    rightHand.quaternion.fromArray(rightHandRot!);

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
