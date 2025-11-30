import {
  AssetManifest,
  AssetType,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SessionMode,
  SRGBColorSpace,
  AssetManager,
  World,
} from "@iwsdk/core";

import { PanelSystem } from "./panel.js";

import { RobotSystem } from "./robot.js";
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
  chimeSound: {
    url: "/audio/chime.mp3",
    type: AssetType.Audio,
    priority: "background",
  },
  webxr: {
    url: "/textures/webxr.png",
    type: AssetType.Texture,
    priority: "critical",
  },
  "office-interior": {
    url: "/assets/office.glb", // Make sure this file exists in public/assets/
    type: AssetType.GLTF,
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
  level: "/glxf/Composition.glxf",
}).then(async (world) => {
  console.log("🌍 CoSpace World Created");

  // Register components
  world
    .registerComponent(Avatar)
    .registerComponent(GestureState)
    .registerComponent(TaskCard);

  // Register systems with priorities
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

  // Create office environment
  const officeScene = new OfficeScene(world);
  await officeScene.createEnvironment();
  console.log("🏢 Office environment created");

  // Create local avatar
  const localAvatar = world.createTransformEntity();
  localAvatar.addComponent(Avatar, {
    userId: `user_${Date.now()}`,
    color: [Math.random(), Math.random(), Math.random()],
    isLocal: true,
  });
  localAvatar.addComponent(GestureState);

  world.globals.localAvatar = localAvatar;
  console.log("👤 Local avatar created");

  // Store network system reference for cross-system communication
  world.globals.networkSystem = world.getSystem(NetworkSystem);

  // Display "Enter VR" button
  const enterVRButton = document.getElementById("enter-vr-btn");
  if (enterVRButton) {
    enterVRButton.style.display = "block";
    enterVRButton.addEventListener("click", () => {
      world.launchXR();
    });
  }

  console.log("✅ CoSpace initialized successfully");
});
