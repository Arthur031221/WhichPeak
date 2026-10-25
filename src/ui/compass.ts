import { headingFromOrientation, smoothHeading } from "../core/compass";

type Outcome = "on" | "denied" | "none";

interface OrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

/** Turns the phone's compass into a stream of headings, smoothed so the view does not shake. */
export class CompassFollower {
  private heading: number | null = null;
  private listening: string | null = null;

  constructor(private readonly onHeading: (deg: number) => void) {}

  /** Worth offering only where a compass can exist, which means a touch device with the sensor API. */
  static available(): boolean {
    return "DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches;
  }

  get active(): boolean {
    return this.listening !== null;
  }

  async start(waitMs = 2000): Promise<Outcome> {
    const api = DeviceOrientationEvent as unknown as PermissionApi;
    if (typeof api.requestPermission === "function") {
      try {
        if ((await api.requestPermission()) !== "granted") return "denied";
      } catch {
        return "denied";
      }
    }
    this.heading = null;
    const type =
      "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
    const first = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), waitMs);
      this.handler = (e: Event) => {
        const deg = this.read(e as OrientationEvent);
        if (deg === null) return;
        clearTimeout(timer);
        resolve(true);
        this.heading = smoothHeading(this.heading, deg);
        this.onHeading(this.heading);
      };
    });
    window.addEventListener(type, this.handler);
    this.listening = type;
    if (await first) return "on";
    this.stop();
    return "none";
  }

  stop(): void {
    if (this.listening) window.removeEventListener(this.listening, this.handler);
    this.listening = null;
  }

  private handler: (e: Event) => void = () => {};

  /** A heading from either flavour of event, or null when the event carries no absolute direction. */
  private read(e: OrientationEvent): number | null {
    if (typeof e.webkitCompassHeading === "number") return e.webkitCompassHeading;
    if (e.alpha === null || e.beta === null || e.gamma === null || !e.absolute) return null;
    return headingFromOrientation(e.alpha, e.beta, e.gamma, screen.orientation?.angle ?? 0);
  }
}
