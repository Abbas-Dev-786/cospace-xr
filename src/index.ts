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
    url: "/assets/office.glb", // Make sure this file exists in public/assets/
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
    // Optional structured features; layers/local-floor are offered by default
    features: { handTracking: true, layers: true },
  },
  features: {
    locomotion: { useWorker: true },
    grabbing: true,
    physics: true,
    sceneUnderstanding: false,
  },
  // level: "/glxf/Composition.glxf",
}).then(async (world) => {
  console.log("🌍 CoSpace World Created");
  console.log("   - Session Mode: Immersive VR");
  console.log("   - Hand Tracking: Enabled");
  console.log("   - Physics: Havok engine with Web Worker");

  // ============================================================
  // STEP 1: Register ECS Components
  // ============================================================
  console.log("📦 Registering components...");

  world
    .registerComponent(Avatar) // Avatar visual representation
    .registerComponent(GestureState) // Hand gesture tracking
    .registerComponent(TaskCard); // Kanban task data

  console.log("✅ Components registered");

  // ============================================================
  // STEP 2: Register ECS Systems (with execution priorities)
  // ============================================================
  console.log("⚙️ Registering systems...");

  // Negative priorities run BEFORE default systems (0)
  // Lower number = earlier execution

  world
    // Avatar tracking and rendering (-3: runs very early)
    .registerSystem(AvatarSystem, { priority: -3 })

    // Hand gesture detection (-2: after avatar updates)
    .registerSystem(GestureSystem, { priority: -2 })

    // Network synchronization (-1: after local state updates)
    .registerSystem(NetworkSystem, {
      priority: -1,
      configData: {
        // WebSocket server URL (from environment variable or default)
        serverUrl: import.meta.env.VITE_WS_SERVER_URL || "ws://localhost:3000",

        // Room ID from URL query param or default
        roomId:
          new URLSearchParams(window.location.search).get("room") ||
          "default-room",
      },
    })

    // Task board management (0: default priority)
    .registerSystem(TaskBoardSystem, { priority: 0 })

    // Passthrough toggle system (1: runs after gameplay logic)
    .registerSystem(PassthroughSystem, { priority: 1 });

  console.log("✅ Systems registered");

  // ============================================================
  // STEP 3: Create Office Environment
  // ============================================================
  console.log("🏗️ Building office environment...");

  const officeScene = new OfficeScene(world);
  await officeScene.createEnvironment();

  console.log("✅ Office environment ready");

  // ============================================================
  // STEP 4: Create Local Player Avatar
  // ============================================================
  console.log("👤 Creating local avatar...");

  const localAvatar = world.createTransformEntity();

  // Generate unique user ID with timestamp
  const userId = `user_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  // FIX: Explicitly type as tuple [number, number, number]
  const avatarColor: [number, number, number] = [
    Math.random() * 0.5 + 0.5, // R: 0.5-1.0
    Math.random() * 0.5 + 0.5, // G: 0.5-1.0
    Math.random() * 0.5 + 0.5, // B: 0.5-1.0
  ];

  localAvatar.addComponent(Avatar, {
    userId,
    color: avatarColor,
    isLocal: true, // Mark as local player
  });

  localAvatar.addComponent(GestureState); // Enable gesture detection

  // Store in world globals for cross-system access
  world.globals.localAvatar = localAvatar;
  world.globals.localUserId = userId;

  console.log(`✅ Local avatar created (ID: ${userId})`);

  // ============================================================
  // STEP 5: Store System References
  // ============================================================
  // Make NetworkSystem accessible to other systems
  world.globals.networkSystem = world.getSystem(NetworkSystem);

  // ============================================================
  // STEP 6: Setup UI Controls
  // ============================================================
  console.log("🎮 Setting up UI controls...");

  // "Enter VR" button (optional - offer="always" handles this)
  const enterVRButton = document.getElementById("enter-vr-btn");
  if (enterVRButton) {
    enterVRButton.style.display = "block";
    enterVRButton.addEventListener("click", () => {
      world.launchXR();
    });
  }

  // ============================================================
  // STEP 7: Development Helpers
  // ============================================================
  if (import.meta.env.DEV) {
    // Expose world to browser console for debugging
    (window as any).world = world;
    (window as any).officeScene = officeScene;

    console.log("🛠️ Development mode active");
    console.log("   - Access world via: window.world");
    console.log("   - Access scene via: window.officeScene");
  }

  // ============================================================
  // Initialization Complete
  // ============================================================
  console.log("✅ CoSpace initialized successfully");
  console.log("   - Office: 20x15ft professional space");
  console.log("   - Avatars: Simple voxel style with hand tracking");
  console.log(
    "   - Gestures: 6 types (pinch, swipe, palm, thumbs-up, resize, point)"
  );
  console.log("   - Multiplayer: 2-4 users, <200ms latency target");
  console.log("   - Task Board: 3-column Kanban with voice comments");
  console.log("");
  console.log("📱 Ready to enter VR!");
});
