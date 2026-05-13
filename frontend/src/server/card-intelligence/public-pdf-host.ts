import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set(
  [
    "localhost",
    "metadata.google.internal",
    "metadata.goog",
    "169.254.169.254",
  ].map((h) => h.toLowerCase()),
);

function isPublicIpv4(ip: string): boolean {
  if (!net.isIPv4(ip)) return false;
  const [a, b] = ip.split(".").map(Number);
  if (a === 10) return false;
  if (a === 127) return false;
  if (a === 0) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 255) return false;
  return true;
}

function isPublicIpv6(ip: string): boolean {
  if (!net.isIPv6(ip)) return false;
  const x = ip.toLowerCase();
  if (x === "::1") return false;
  if (x.startsWith("fe80:")) return false;
  if (x.startsWith("fc") || x.startsWith("fd")) return false;
  if (x.startsWith("::ffff:")) {
    const v4 = x.slice("::ffff:".length);
    return isPublicIpv4(v4);
  }
  return true;
}

function isPublicAddress(addr: string, family: number): boolean {
  if (family === 4) return isPublicIpv4(addr);
  if (family === 6) return isPublicIpv6(addr);
  return false;
}

/**
 * True when the hostname is not a literal IP, not on a blocklist, and every
 * resolved address is a routable public IP (mitigates SSRF via DNS to RFC1918).
 */
export async function hostnameResolvesOnlyToPublicAddresses(
  hostname: string,
): Promise<boolean> {
  const host = hostname.toLowerCase();
  if (!host || net.isIP(host)) return false;
  if (BLOCKED_HOSTNAMES.has(host)) return false;
  if (host.endsWith(".local") || host.endsWith(".localhost")) return false;

  let boxed: unknown;
  try {
    boxed = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    return false;
  }
  const results = Array.isArray(boxed)
    ? (boxed as { address: string; family: number }[])
    : [boxed as { address: string; family: number }];
  if (!results.length) return false;
  for (const r of results) {
    if (!isPublicAddress(r.address, r.family)) return false;
  }
  return true;
}
