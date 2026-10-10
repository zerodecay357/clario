import { readFileSync } from "node:fs";
import path from "node:path";
import tls from "node:tls";
import { Agent } from "undici";

// IITD's Moodle servers omit the GlobalSign intermediate from their TLS chain. Browsers
// recover via AIA fetching; Node doesn't, so we bundle it. `ca` replaces Node's
// defaults, hence the root certificates are included too. Never disable verification.
const intermediate = readFileSync(
  path.join(process.cwd(), "certs/globalsign-gcc-r46-ov-tls-ca-2025.pem"),
  "utf8",
);

export const moodleAgent = new Agent({ connect: { ca: [...tls.rootCertificates, intermediate] } });
