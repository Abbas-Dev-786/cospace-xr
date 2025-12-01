// src/environment/OfficeScene.ts

import {
  World,
  DirectionalLight,
  AmbientLight,
  IBLTexture,
  DomeGradient,
  PhysicsBody,
  PhysicsShape,
  PhysicsState,
  PhysicsShapeType,
  AssetManager,
  Mesh,
  BufferAttribute,
  // ⚠️ CRITICAL IMPORT FOR LOCOMOTION
  LocomotionEnvironment,
  EnvironmentType,
} from "@iwsdk/core";

/**
 * OfficeScene: Creates the virtual office environment
 *
 * FIXES APPLIED:
 * 1. Added LocomotionEnvironment component (makes floor walkable)
 * 2. Changed PhysicsShape from TriMesh to ConvexHull (better for complex models)
 * 3. Ensured proper mesh normals and UVs
 */
export class OfficeScene {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Initialize the complete office environment
   * Called once during world setup
   */
  async createEnvironment(): Promise<void> {
    console.log("🏢 Creating office environment...");

    // Step 1: Setup lighting and background
    this.setupLighting();

    // Step 2: Load and configure the office interior model
    await this.loadOfficeModel();

    console.log("✅ Office environment ready");
  }

  /**
   * Configure professional office lighting
   * Uses IBL (Image-Based Lighting) for realistic material reflections
   */
  private setupLighting(): void {
    const levelRoot = this.world.activeLevel.value;

    // Image-Based Lighting for realistic reflections and ambient lighting
    levelRoot.addComponent(IBLTexture, {
      src: "room", // Built-in room environment from IWSDK
      intensity: 1.3, // Slightly brighter for professional atmosphere
      rotation: [0, Math.PI / 6, 0], // 30° rotation for better light distribution
    });

    // Calming background gradient (non-distracting)
    levelRoot.addComponent(DomeGradient, {
      sky: [0.85, 0.9, 0.95, 1.0], // Light blue sky
      equator: [0.7, 0.75, 0.8, 1.0], // Soft horizon
      ground: [0.5, 0.55, 0.6, 1.0], // Neutral ground
      intensity: 0.8,
    });

    // Directional sunlight for depth and shadows
    const sunlight = new DirectionalLight(0xfff4e6, 0.6); // Warm white
    sunlight.position.set(5, 8, 3); // Positioned upper-right
    sunlight.castShadow = true; // Enable shadows for realism

    // Shadow map configuration for better quality
    sunlight.shadow.mapSize.width = 2048;
    sunlight.shadow.mapSize.height = 2048;
    sunlight.shadow.camera.near = 0.5;
    sunlight.shadow.camera.far = 50;

    this.world.scene.add(sunlight);

    // Ambient light to fill in shadows (prevent pure black areas)
    const ambient = new AmbientLight(0xffffff, 0.3);
    this.world.scene.add(ambient);

    console.log("💡 Lighting configured");
  }

  /**
   * Load the unified office interior model
   * ✅ FIXED: Now properly sets up locomotion + physics
   */
  private async loadOfficeModel(): Promise<void> {
    // Get the GLTF asset defined in src/index.ts
    const officeGLTF = AssetManager.getGLTF("office-interior");

    if (!officeGLTF) {
      console.error("❌ CRITICAL: 'office-interior' asset not found!");
      console.error("   Make sure /public/assets/office.glb exists");
      console.error("   and is properly defined in assets manifest");
      return;
    }

    console.log("📦 Office model loaded from AssetManager");

    // Clone the scene to create an independent instance
    const officeMesh = officeGLTF.scene.clone();

    // ✅ FIX: Ensure all meshes have proper attributes
    officeMesh.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const geometry = mesh.geometry;

        // Ensure UV attribute exists (required for mergeGeometries)
        if (!geometry.attributes.uv) {
          const count = geometry.attributes.position.count;
          // Create dummy UVs filled with 0
          const uvs = new Float32Array(count * 2);
          geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
        }

        // ✅ CRITICAL: Compute normals for proper collision detection
        if (!geometry.attributes.normal) {
          geometry.computeVertexNormals();
        }
      }
    });

    // Create the Entity with persistent flag (survives level changes)
    const officeEntity = this.world.createTransformEntity(officeMesh, {
      persistent: true,
    });

    if (!officeEntity) {
      console.error("❌ Failed to create office entity");
      return;
    }

    // Position the office model at world origin
    if (officeEntity.object3D) {
      officeEntity.object3D.position.set(-10, 0, 30);
      officeEntity.object3D.rotation.set(0, 0, 0);
      officeEntity.object3D.scale.set(1, 1, 1);
    }

    // ============================================================
    // ✅ FIX #1: ADD LOCOMOTION ENVIRONMENT COMPONENT
    // ============================================================
    // This tells IWSDK's locomotion system that this object is WALKABLE
    officeEntity.addComponent(LocomotionEnvironment, {
      type: EnvironmentType.STATIC, // Office doesn't move
    });

    // ============================================================
    // ✅ FIX #2: CHANGE PHYSICS SHAPE TYPE
    // ============================================================
    // ConvexHull provides better collision for complex models
    // It's more stable than TriMesh for locomotion

    // PhysicsBody: Defines motion behavior (Static = immovable)
    officeEntity.addComponent(PhysicsBody, {
      state: PhysicsState.Static, // Office doesn't move
    });

    // ✅ CHANGED FROM TriMesh TO ConvexHull
    officeEntity.addComponent(PhysicsShape, {
      shape: PhysicsShapeType.ConvexHull, // ✅ Better for locomotion
      // Alternative: PhysicsShapeType.Auto (lets IWSDK decide)
    });

    console.log("🏢 Office Interior Model Loaded");
    console.log("   ✅ LocomotionEnvironment: STATIC (floor is walkable)");
    console.log("   ✅ PhysicsShape: ConvexHull (stable collision)");
    console.log("   ✅ PhysicsBody: Static (immovable)");
    console.log("   - Position: (-10, 0, 30)");
  }

  /**
   * Optional: Add animated elements to the office
   * Examples: rotating fan, swaying plant, flickering screen
   */
  public addAnimatedElements(): void {
    // Implementation for animated office elements
    // Can be called after createEnvironment() if needed
    console.log("🎬 Animated elements not yet implemented");
  }

  /**
   * Cleanup method for proper resource disposal
   */
  public dispose(): void {
    // Dispose of any dynamic resources created by this scene
    console.log("🧹 Office scene cleanup");
  }
}
