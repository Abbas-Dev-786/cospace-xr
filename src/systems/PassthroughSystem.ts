import { createSystem, Types } from "@iwsdk/core";

export class PassthroughSystem extends createSystem(
  {},
  {
    enabled: { type: Types.Boolean, default: false },
    opacity: { type: Types.Float32, default: 0.5 },
  }
) {
  init() {
    // Enable passthrough layer
    const session = this.world.renderer.xr.getSession();
    if (session && session.environmentBlendMode === "additive") {
      this.enablePassthrough();
    }
  }

  private async enablePassthrough() {
    const session = this.world.renderer.xr.getSession();
    if (!session) return;

    try {
      const baseLayer = new XRWebGLLayer(
        session,
        this.world.renderer.getContext()
      );
      await session.updateRenderState({ baseLayer });
      console.log("✅ Passthrough enabled");
    } catch (error) {
      console.error("❌ Passthrough not supported:", error);
    }
  }

  //   update(delta, time) {
  //     // Toggle passthrough with palm-open gesture
  //     // Adjust opacity based on hand distance
  //   }
}
