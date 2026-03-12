import type { GatewayEventFrame } from "./types";

type EventHandler = (payload: unknown) => void;

/** Simple typed event bus for gateway events. */
export class GatewayEventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(frame: GatewayEventFrame): void {
    const handlers = this.listeners.get(frame.event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(frame.payload);
        } catch (err) {
          console.error("[event-bus] handler error:", err);
        }
      }
    }
    // Also emit to wildcard listeners
    const wildcards = this.listeners.get("*");
    if (wildcards) {
      for (const h of wildcards) {
        try {
          h(frame);
        } catch (err) {
          console.error("[event-bus] wildcard handler error:", err);
        }
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const gatewayEventBus = new GatewayEventBus();
