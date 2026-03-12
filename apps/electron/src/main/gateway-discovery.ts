const DEFAULT_PORT = 18789;

export interface DiscoveryResult {
  found: boolean;
  url: string;
  version?: string;
}

/**
 * Attempt to connect to a running gateway via HTTP.
 * Returns found=true if a gateway responds on the given port.
 */
export async function discoverGateway(port: number = DEFAULT_PORT): Promise<DiscoveryResult> {
  const url = `http://localhost:${port}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${url}/api/version`, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      let version: string | undefined;
      try {
        const body = (await res.json()) as { version?: string };
        version = body.version;
      } catch {
        // version is optional
      }
      return { found: true, url, version };
    }
    // Gateway responded but not with a recognisable version endpoint —
    // still consider it found if we got any HTTP response.
    return { found: true, url };
  } catch {
    return { found: false, url };
  }
}
