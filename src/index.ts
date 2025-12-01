import { AssetManifest, AssetType, SessionMode, World } from "@iwsdk/core";

import { OfficeScene } from "./environment/OfficeScene.js";
import { Avatar } from "./components/Avatar.js";
import { GestureState } from "./components/GestureState.js";
import { TaskCard } from "./components/TaskCard.js";
import { AvatarSystem } from "./systems/AvatarSystem.js";
import { GestureSystem } from "./systems/GestureSystem.js";
import { NetworkSystem } from "./systems/NetworkSystem.js";
import { TaskBoardSystem } from "./systems/TaskBoardSystem.js";
import { PassthroughSystem } from "./systems/PassthroughSystem.js";

const assets: AssetManifest = {
  "office-interior": {
    url: "/assets/office.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
  webxr: {
    url: "/textures/webxr.png",
    type: AssetType.Texture,
    priority: "critical",
  },
};

World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets,
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: "always",
    features: { handTracking: true, layers: true },
  },
  features: {
    locomotion: { useWorker: true }, // Enables gravity/physics on player
    grabbing: true,
    physics: true,
    sceneUnderstanding: false,
  },
}).then(async (world) => {
  console.log("🌍 CoSpace World Created");

  // ============================================================
  // STEP 1: Register ECS Components
  // ============================================================
  world
    .registerComponent(Avatar)
    .registerComponent(GestureState)
    .registerComponent(TaskCard);

  // ============================================================
  // STEP 2: Register ECS Systems
  // ============================================================
  world
    .registerSystem(AvatarSystem, { priority: -3 })
    .registerSystem(GestureSystem, { priority: -2 })
    .registerSystem(NetworkSystem, {
      priority: -1,
      configData: {
        serverUrl: import.meta.env.VITE_WS_SERVER_URL || "ws://localhost:3000",
        roomId:
          new URLSearchParams(window.location.search).get("room") ||
          "default-room",
      },
    })
    .registerSystem(TaskBoardSystem, { priority: 0 })
    .registerSystem(PassthroughSystem, { priority: 1 });

  // ============================================================
  // STEP 3: Create Office Environment
  // ============================================================
  console.log("🏗️ Building office environment...");

  const officeScene = new OfficeScene(world);
  await officeScene.createEnvironment();

  console.log("✅ Office environment ready");

  // ============================================================
  // FIX: INITIAL PLAYER POSITIONING
  // ============================================================
  console.log("📍 Setting initial player position...");

  // 1. Move Player to Center: Ensure we are inside the office geometry.
  //    (Adjust X/Z if your office model isn't centered at 0,0)
  // 2. Lift Player (Y=0.5): Spawning slightly above floor prevents falling through
  //    before physics collision is calculated.
  world.player.position.set(0, 1, 0);

  // Optional: Rotate player to face a specific direction (e.g., face the whiteboard)
  // world.player.rotation.set(0, 0, 0, 1);

  // ============================================================
  // STEP 4: Create Local Player Avatar
  // ============================================================
  const localAvatar = world.createTransformEntity();

  const userId = `user_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const avatarColor: [number, number, number] = [
    Math.random() * 0.5 + 0.5,
    Math.random() * 0.5 + 0.5,
    Math.random() * 0.5 + 0.5,
  ];

  localAvatar.addComponent(Avatar, {
    userId,
    color: avatarColor,
    isLocal: true,
  });

  localAvatar.addComponent(GestureState);

  world.globals.localAvatar = localAvatar;
  world.globals.localUserId = userId;

  // ============================================================
  // STEP 5: Final Setup
  // ============================================================
  world.globals.networkSystem = world.getSystem(NetworkSystem);

  const enterVRButton = document.getElementById("enter-vr-btn");
  if (enterVRButton) {
    enterVRButton.style.display = "block";
    enterVRButton.addEventListener("click", () => {
      world.launchXR();
    });
  }

  if (import.meta.env.DEV) {
    (window as any).world = world;
    (window as any).officeScene = officeScene;
  }

  console.log("✅ CoSpace initialized successfully");
});
