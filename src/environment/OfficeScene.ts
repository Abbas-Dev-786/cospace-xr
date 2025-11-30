import {
  World,
  AssetManager,
  DirectionalLight,
  AmbientLight,
  IBLTexture,
  DomeGradient,
  PhysicsBody,
  PhysicsShape,
} from "@iwsdk/core"; //

export class OfficeScene {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  async createEnvironment(): Promise<void> {
    this.setupLighting();

    // Load and place the single office interior model
    await this.loadOfficeModel();
  }

  private setupLighting(): void {
    const levelRoot = this.world.activeLevel.value;

    // Professional office IBL
    levelRoot.addComponent(IBLTexture, {
      src: "room",
      intensity: 1.3,
      rotation: [0, Math.PI / 6, 0],
    });

    // Calming background gradient
    levelRoot.addComponent(DomeGradient, {
      sky: [0.85, 0.9, 0.95, 1.0],
      equator: [0.7, 0.75, 0.8, 1.0],
      ground: [0.5, 0.55, 0.6, 1.0],
      intensity: 0.8,
    });

    // Directional light
    const sunlight = new DirectionalLight(0xfff4e6, 0.6);
    sunlight.position.set(5, 8, 3);
    sunlight.castShadow = true;
    this.world.scene.add(sunlight);

    const ambient = new AmbientLight(0xffffff, 0.3);
    this.world.scene.add(ambient);
  }

  private async loadOfficeModel(): Promise<void> {
    // 1. Get the GLTF model defined in src/index.ts
    const officeGLTF = AssetManager.getGLTF("office-interior");

    if (!officeGLTF) {
      console.error("❌ Critical: 'office-interior' asset missing!");
      return;
    }

    // 2. Clone the scene
    const officeMesh = officeGLTF.scene.clone();

    // 3. Create the Entity
    const officeEntity = this.world.createTransformEntity(officeMesh, {
      persistent: true,
    });

    // FIX: Check if entity exists before accessing object3D or adding components
    if (officeEntity) {
      // 4. Position it correctly
      if (officeEntity.object3D) {
        officeEntity.object3D.position.set(0, 0, 0);
      }

      // 5. Add Physics Collision (Mesh Collider)
      // FIX: Used 'state' instead of 'type'
      officeEntity.addComponent(PhysicsBody, {
        state: "static",
      });

      // FIX: Used string "mesh" instead of ShapeType.Mesh
      officeEntity.addComponent(PhysicsShape, {});

      console.log("🏢 Office Interior Model Loaded & Physics Enabled");
    } else {
      console.error("❌ Failed to create office entity");
    }
  }
}
