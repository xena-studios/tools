// DNS over HTTPS through Cloudflare's resolver (JSON API). The Worker looks
// names up itself, rather than letting connect() do it, so every address can be
// checked before anything connects to it.

const DOH = "https://cloudflare-dns.com/dns-query";

const TYPES = { A: 1, AAAA: 28, CNAME: 5, SRV: 33 } as const;
type RecordType = keyof typeof TYPES;

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export class DnsError extends Error {}

async function query(name: string, type: RecordType): Promise<string[]> {
  const url = `${DOH}?name=${encodeURIComponent(name)}&type=${type}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    throw new DnsError("The DNS lookup didn't answer");
  }
  if (!res.ok) throw new DnsError(`The DNS lookup failed (${res.status})`);
  const body = (await res.json()) as { Status?: number; Answer?: DohAnswer[] };
  // 0 is NOERROR, 3 is NXDOMAIN; anything else is a failure upstream.
  if (body.Status === 3) return [];
  if (body.Status !== 0) throw new DnsError(`The DNS lookup failed (rcode ${body.Status})`);
  return (body.Answer ?? []).filter((a) => a.type === TYPES[type]).map((a) => a.data);
}

export interface Srv {
  target: string;
  port: number;
}

/** The _minecraft._tcp SRV record a Java client follows, if there is one. */
export async function lookupSrv(host: string): Promise<Srv | null> {
  const records = (await query(`_minecraft._tcp.${host}`, "SRV")).flatMap((data) => {
    // "priority weight port target."
    const [priority, weight, port, target] = data.trim().split(/\s+/);
    const p = Number(port);
    const t = (target ?? "").replace(/\.$/, "").toLowerCase();
    if (!t || !Number.isInteger(p) || p < 1 || p > 65535) return [];
    return [{ priority: Number(priority), weight: Number(weight), target: t, port: p }];
  });
  // Lowest priority first, then the heaviest weight: the record a client would try first.
  records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
  const best = records[0];
  return best ? { target: best.target, port: best.port } : null;
}

/** Every A record, or every AAAA record if there are no A records. */
export async function resolveIps(host: string): Promise<string[]> {
  const v4 = await query(host, "A");
  if (v4.length > 0) return v4;
  return query(host, "AAAA");
}
