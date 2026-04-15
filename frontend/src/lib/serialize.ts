export function dec(n: unknown): number {
  if (typeof n === "number") return n;
  if (n && typeof (n as { toNumber: () => number }).toNumber === "function") {
    return (n as { toNumber: () => number }).toNumber();
  }
  return Number(n);
}
