import dns from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import net from "node:net";

type PublicFetchOptions = {
  accept: string;
  maxBytes: number;
};

export type PublicResource = {
  body: Buffer;
  contentEncoding: string | null;
  contentType: string | null;
  finalUrl: string;
  status: number;
};

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 88) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase().split("%")[0];
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];

  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);

  const mappedHex = normalized.match(/^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/);
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return isPrivateIpv4(
      `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
    );
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("2002:")
  );
}

function isPrivateIp(ip: string) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

async function resolvePublicHttpUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid absolute URL, including https://");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http:// and https:// URLs are supported.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Local or private network addresses are not supported.");
  }

  const literalFamily = net.isIP(hostname);
  if (literalFamily && isPrivateIp(hostname)) {
    throw new Error("Private network addresses are not supported.");
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });

  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("This hostname resolves to a private or unsupported network.");
  }

  return { parsed, ...addresses[0] };
}

export async function assertPublicHttpUrl(rawUrl: string) {
  return (await resolvePublicHttpUrl(rawUrl)).parsed;
}

async function requestPublicResource(rawUrl: string, options: PublicFetchOptions) {
  const { parsed, address, family } = await resolvePublicHttpUrl(rawUrl);
  const request = parsed.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<{
    body: Buffer;
    contentEncoding: string | null;
    contentType: string | null;
    location: string | null;
    status: number;
  }>((resolve, reject) => {
    const clientRequest = request(
      parsed,
      {
        headers: {
          "user-agent":
            "SiteScope/0.2 (+https://github.com/ArViskas/sitescope-webmcp)",
          accept: options.accept,
          "accept-encoding": "identity"
        },
        lookup: (_hostname, lookupOptions, callback) => {
          if (lookupOptions.all) {
            callback(null, [{ address, family }]);
            return;
          }
          callback(null, address, family);
        },
        signal: AbortSignal.timeout(10_000)
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const contentType = response.headers["content-type"] ?? null;
        const contentEncoding = response.headers["content-encoding"] ?? null;
        const location = response.headers.location ?? null;
        const contentLength = Number(response.headers["content-length"]);

        if (Number.isFinite(contentLength) && contentLength > options.maxBytes) {
          response.resume();
          reject(new Error("The response is too large for SiteScope."));
          return;
        }

        if ([301, 302, 303, 307, 308].includes(status)) {
          response.resume();
          resolve({
            body: Buffer.alloc(0),
            contentEncoding,
            contentType,
            location,
            status
          });
          return;
        }

        const chunks: Buffer[] = [];
        let receivedBytes = 0;

        response.on("data", (chunk: Buffer) => {
          receivedBytes += chunk.length;
          if (receivedBytes > options.maxBytes) {
            response.destroy(new Error("The response is too large for SiteScope."));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            body: Buffer.concat(chunks),
            contentEncoding,
            contentType,
            location,
            status
          });
        });
        response.on("error", reject);
      }
    );

    clientRequest.on("error", reject);
    clientRequest.end();
  });
}

export async function fetchPublicResource(
  rawUrl: string,
  options: PublicFetchOptions
): Promise<PublicResource> {
  let currentUrl = (await assertPublicHttpUrl(rawUrl)).toString();

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const response = await requestPublicResource(currentUrl, options);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.location) {
        return { ...response, finalUrl: currentUrl };
      }

      currentUrl = new URL(response.location, currentUrl).toString();
      continue;
    }

    return { ...response, finalUrl: currentUrl };
  }

  throw new Error("Too many redirects.");
}
