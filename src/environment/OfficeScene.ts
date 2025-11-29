import {
  World,
  AssetManager,
  Mesh,
  PlaneGeometry,
  BoxGeometry,
  MeshStandardMaterial,
  Vector3,
  DirectionalLight,
  AmbientLight,
  IBLTexture,
  DomeGradient,
} from "@iwsdk/core";

/**
 * OfficeScene: Creates a calming 20x15ft virtual office environment
 * Features:
 * - Professional lighting setup with IBL
 * - Furniture placement (desks, chairs)
 * - Animated windows showing exterior views
 * - Soft ambient lighting for reduced eye strain
 */
export class OfficeScene {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Initialize the complete office environment
   * Dimensions: 20ft wide x 15ft deep x 10ft high (6.1m x 4.6m x 3m)
   */
  async createEnvironment(): Promise<void> {
    // Set up environment lighting for realistic appearance
    this.setupLighting();

    // Create office structure (floor, walls, ceiling)
    this.createOfficeStructure();

    // Add furniture (desks, chairs, shelves)
    await this.addFurniture();

    // Create animated windows with exterior views
    this.createWindows();

    // Add ambient details (plants, decorations)
    this.addAmbientDetails();
  }

  /**
   * Configure Image-Based Lighting for realistic material rendering
   */
  private setupLighting(): void {
    const levelRoot = this.world.activeLevel.value;

    // Use built-in room environment for professional office lighting
    levelRoot.addComponent(IBLTexture, {
      src: "room", // Built-in IWSDK environment
      intensity: 1.3, // Slightly brighter for workspace
      rotation: [0, Math.PI / 6, 0], // Rotate light direction
    });

    // Soft gradient background for calming atmosphere
    levelRoot.addComponent(DomeGradient, {
      sky: [0.85, 0.9, 0.95, 1.0], // Light blue-gray sky
      equator: [0.7, 0.75, 0.8, 1.0], // Soft horizon
      ground: [0.5, 0.55, 0.6, 1.0], // Darker ground
      intensity: 0.8,
    });

    // Add directional light for natural window-like lighting
    const sunlight = new DirectionalLight(0xfff4e6, 0.6);
    sunlight.position.set(5, 8, 3);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.width = 2048;
    sunlight.shadow.mapSize.height = 2048;
    this.world.scene.add(sunlight);

    // Ambient light for soft fill
    const ambient = new AmbientLight(0xffffff, 0.3);
    this.world.scene.add(ambient);
  }

  /**
   * Create floor, walls, and ceiling with appropriate materials
   */
  private createOfficeStructure(): void {
    // Floor: 20ft x 15ft (6.1m x 4.6m)
    const floorGeometry = new PlaneGeometry(6.1, 4.6);
    const floorMaterial = new MeshStandardMaterial({
      color: 0xd4cfc9, // Warm light gray
      roughness: 0.8,
      metalness: 0.0,
    });
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Horizontal
    floor.receiveShadow = true;

    const floorEntity = this.world.createTransformEntity(floor, {
      persistent: true,
    });

    // Walls: 10ft high (3m)
    this.createWall(new Vector3(0, 1.5, -2.3), 6.1, 3, 0); // Back wall
    this.createWall(new Vector3(-3.05, 1.5, 0), 4.6, 3, Math.PI / 2); // Left wall
    this.createWall(new Vector3(3.05, 1.5, 0), 4.6, 3, Math.PI / 2); // Right wall

    // Ceiling
    const ceilingGeometry = new PlaneGeometry(6.1, 4.6);
    const ceilingMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
    });
    const ceiling = new Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.position.set(0, 3, 0);
    ceiling.rotation.x = Math.PI / 2;

    this.world.createTransformEntity(ceiling, { persistent: true });
  }

  /**
   * Create a single wall segment
   */
  private createWall(
    position: Vector3,
    width: number,
    height: number,
    rotationY: number
  ): void {
    const wallGeometry = new BoxGeometry(width, height, 0.2);
    const wallMaterial = new MeshStandardMaterial({
      color: 0xf5f5f0, // Off-white
      roughness: 0.9,
    });
    const wall = new Mesh(wallGeometry, wallMaterial);
    wall.position.copy(position);
    wall.rotation.y = rotationY;
    wall.castShadow = true;
    wall.receiveShadow = true;

    this.world.createTransformEntity(wall, { persistent: true });
  }

  /**
   * Load and position furniture models
   */
  private async addFurniture(): Promise<void> {
    // Load desk models (assumed pre-loaded in asset manifest)
    const deskModel = AssetManager.getGLTF("office-desk");

    if (deskModel) {
      // Position 4 desks in the room
      const deskPositions = [
        new Vector3(-2, 0.75, -1.5), // Back-left
        new Vector3(2, 0.75, -1.5), // Back-right
        new Vector3(-2, 0.75, 1), // Front-left
        new Vector3(2, 0.75, 1), // Front-right
      ];

      deskPositions.forEach((pos, index) => {
        const desk = deskModel.scene.clone();
        desk.position.copy(pos);
        desk.scale.setScalar(0.8);
        desk.rotation.y = index < 2 ? 0 : Math.PI; // Face desks appropriately

        const deskEntity = this.world.createTransformEntity(desk, {
          persistent: true,
        });
      });
    }

    // Add chairs at each desk
    const chairModel = AssetManager.getGLTF("office-chair");

    if (chairModel) {
      const chairPositions = [
        new Vector3(-2, 0.5, -0.8),
        new Vector3(2, 0.5, -0.8),
        new Vector3(-2, 0.5, 1.7),
        new Vector3(2, 0.5, 1.7),
      ];

      chairPositions.forEach((pos, index) => {
        const chair = chairModel.scene.clone();
        chair.position.copy(pos);
        chair.scale.setScalar(0.7);
        chair.rotation.y = index < 2 ? Math.PI : 0;

        this.world.createTransformEntity(chair, { persistent: true });
      });
    }
  }

  /**
   * Create animated windows with exterior views
   * Uses video textures for dynamic "outside world" effect
   */
  private createWindows(): void {
    // Window 1: Left wall
    this.createWindow(new Vector3(-2.9, 1.8, 0), 1.2, 1.5, Math.PI / 2);

    // Window 2: Back wall
    this.createWindow(new Vector3(0, 1.8, -2.15), 2, 1.5, 0);
  }

  private createWindow(
    position: Vector3,
    width: number,
    height: number,
    rotationY: number
  ): void {
    const windowGeometry = new PlaneGeometry(width, height);

    // Use a light-emitting material to simulate window glow
    const windowMaterial = new MeshStandardMaterial({
      color: 0xadd8e6, // Light blue sky color
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.8,
    });

    const window = new Mesh(windowGeometry, windowMaterial);
    window.position.copy(position);
    window.rotation.y = rotationY;

    this.world.createTransformEntity(window, { persistent: true });

    // TODO: Add animated texture (moving clouds/trees) for enhanced realism
    // Requires video texture or shader-based animation
  }

  /**
   * Add plants and decorative elements for a welcoming environment
   */
  private addAmbientDetails(): void {
    const plantModel = AssetManager.getGLTF("office-plant");

    if (plantModel) {
      // Place plants in corners
      const plantPositions = [
        new Vector3(-2.5, 0, -2),
        new Vector3(2.5, 0, -2),
        new Vector3(-2.5, 0, 2),
        new Vector3(2.5, 0, 2),
      ];

      plantPositions.forEach((pos) => {
        const plant = plantModel.scene.clone();
        plant.position.copy(pos);
        plant.scale.setScalar(0.6);

        this.world.createTransformEntity(plant, { persistent: true });
      });

      // Add soft accent lighting near plants for ambiance
      plantPositions.forEach((pos) => {
        const accentLight = new DirectionalLight(0xffe4b5, 0.2);
        accentLight.position.set(pos.x, pos.y + 1, pos.z);
        this.world.scene.add(accentLight);
      });
    }
  }
}
