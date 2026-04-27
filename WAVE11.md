# Wave 11 — NixOS Deployment Package + Module

## Scope

3 beads that make Vellum deployable on a NixOS server (servoid).

| # | Bead | Title | Pri |
|---|------|-------|-----|
| 1 | 1e9.1 | flake.nix package definition (buildNpmPackage) | P1 |
| 2 | 1e9.2 | NixOS module (nixosModules.default) | P1 |
| 3 | 1e9.3 | Deployment smoke test script | P1 |

---

## Environment Setup

Bootstrap Nix (required every session):

```bash
mkdir -p /nix 2>/dev/null
curl -L https://nixos.org/nix/install 2>/dev/null | bash -s -- --no-daemon 2>&1
groupadd nixbld 2>/dev/null
mkdir -p /etc/nix
cat > /etc/nix/nix.conf << 'EOF'
build-users-group =
experimental-features = nix-command flakes
sandbox = false
EOF
NIX=$(find /nix/store -maxdepth 1 -name "*-nix-*" -type d | head -1)
mkdir -p ~/bin && ln -sf $NIX/bin/nix ~/bin/nix
export PATH="$HOME/bin:$PATH"
```

Run all commands via the dev shell:

```bash
cd ~/workspace/vellum && nix develop --command bash -c 'npm install && npm run typecheck && npm test'
```

**Gate:** All existing tests (270 across 30 files) must pass before AND after changes.

---

## Bead 1: 1e9.1 — flake.nix Package Definition

Read the full bead: `grep '"id":"vellum-1e9.1"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

Replace the placeholder `packages.default` in `flake.nix` with a proper Nix package that builds the production Vellum server.

### Current state

The flake.nix has a placeholder package that just copies source:
```nix
packages.default = pkgs.stdenvNoCC.mkDerivation {
  pname = "vellum";
  version = "0.1.0";
  src = self;
  dontBuild = true;
  installPhase = ''
    mkdir -p $out/share/vellum
    cp -R . $out/share/vellum
  '';
};
```

### Target state

A `buildNpmPackage` (from `pkgs.buildNpmPackage`) that:

1. **Builds** the Vite browser bundle (`npx vite build` → `dist/`)
2. **Builds** the server TypeScript (`tsc -p tsconfig.server.json` → `dist-server/`)
3. **Installs** the production tree:
   ```
   $out/lib/vellum/
   ├── dist/              # Vite browser bundle
   ├── dist-server/       # Compiled server JS
   ├── instruments/       # YAML profiles + .ily includes
   ├── templates/         # .ly template files
   ├── tools/             # theory.py
   ├── node_modules/      # Runtime deps (handled by buildNpmPackage)
   └── package.json       # For version info
   ```
4. **Creates** a wrapper at `$out/bin/vellum-server` that runs the server with the correct working directory

### Build details

The production server needs two build steps:

```bash
# Step 1: Browser bundle (Vite)
npx vite build
# Output: dist/index.html, dist/assets/*.js, dist/assets/*.css

# Step 2: Server TypeScript → JavaScript
tsc -p tsconfig.server.json
# Output: dist-server/server/index.js, dist-server/server/**/*.js, dist-server/lib/**/*.js, dist-server/types.js
```

Start command: `node dist-server/server/index.js`

The server resolves paths relative to `process.cwd()`:
- `./dist/` — static files (Vite bundle)
- `./instruments/` — YAML profiles + .ily LilyPond includes (overridable via `VELLUM_INSTRUMENTS_DIR`)
- `./templates/` — .ly template files (overridable via `VELLUM_TEMPLATES_DIR`)

So the wrapper must `cd` into the package's lib directory before starting node:

```nix
makeWrapper ${pkgs.nodejs_20}/bin/node $out/bin/vellum-server \
  --chdir $out/lib/vellum \
  --add-flags "dist-server/server/index.js"
```

### npmDepsHash

`buildNpmPackage` needs `npmDepsHash`. Compute it:

```bash
nix develop --command bash -c 'prefetch-npm-deps package-lock.json 2>/dev/null'
```

If `prefetch-npm-deps` isn't in the dev shell, use:
```bash
nix-build '<nixpkgs>' -A prefetch-npm-deps --no-out-link
# Then run the resulting binary on package-lock.json
```

Or use `npmDepsHash = pkgs.lib.fakeHash;` first, run `nix build`, and grab the correct hash from the error message.

### Known gotcha: CDN fetches

The `xlsx` package (a transitive dep of pi-web-ui) fetches from a CDN URL during npm install. If this breaks `buildNpmPackage`'s fixed-output derivation, try:
- `npmFlags = [ "--ignore-scripts" ];` to skip postinstall scripts
- Or `forceGitDeps = true;` if there are git deps
- Or override the specific fetch in `npmOverrides`

### Server tsconfig include

The `tsconfig.server.json` includes:
```json
{
  "include": [
    "src/server/**/*.ts",
    "src/lib/**/*.ts",
    "src/types.ts"
  ]
}
```

This compiles the server + shared library code (but NOT browser-only code like `src/main.ts`, `src/renderers.ts`). It outputs to `dist-server/`.

### Nix package skeleton

```nix
packages.default = pkgs.buildNpmPackage {
  pname = "vellum";
  version = "0.1.0";
  src = self;
  npmDepsHash = "sha256-XXXX"; # compute this

  nativeBuildInputs = [ pkgs.makeWrapper ];

  # Node 20 for building
  nodejs = pkgs.nodejs_20;

  # Build both browser and server
  buildPhase = ''
    runHook preBuild
    npx vite build
    npx tsc -p tsconfig.server.json
    runHook postBuild
  '';

  # Install the production tree
  installPhase = ''
    runHook preInstall

    mkdir -p $out/lib/vellum $out/bin
    cp -r dist dist-server instruments templates tools package.json $out/lib/vellum/
    cp -r node_modules $out/lib/vellum/

    makeWrapper ${pkgs.nodejs_20}/bin/node $out/bin/vellum-server \
      --chdir $out/lib/vellum \
      --add-flags "dist-server/server/index.js"

    runHook postInstall
  '';

  # Skip the default npm build script (we have our own buildPhase)
  dontNpmBuild = true;
};
```

**Note:** `dontNpmBuild = true` tells `buildNpmPackage` to skip the default `npm run build`. We do our own build steps. But we still want the `npmConfigHook` to run (which sets up node_modules from the lock file).

### Verification

After the package builds:

```bash
export PATH="$HOME/bin:$PATH"
cd ~/workspace/vellum

# Build it
nix build .#default 2>&1

# Check contents
ls result/lib/vellum/dist/index.html
ls result/lib/vellum/dist-server/server/index.js
ls result/lib/vellum/instruments/
ls result/lib/vellum/templates/
ls result/lib/vellum/tools/theory.py

# Verify it starts (will fail on missing LilyPond/Python in PATH, but should at least start the HTTP server)
PORT=9999 timeout 5 result/bin/vellum-server 2>&1 || true
# Look for "Vellum server listening on http://localhost:9999"

# Test health endpoint
PORT=9999 result/bin/vellum-server &
sleep 2
curl -s http://localhost:9999/health | python3 -m json.tool
kill %1
```

**Note:** `nix build` runs in a sandbox and may take a while downloading Node packages. On this machine, sandbox is disabled (`sandbox = false` in nix.conf) so it should work. If `nix build` fails with network errors, it's likely the Fastly proxy blocking npm registry fetches — in that case, document the failure and what the hash should be so Jeff can build on his machine.

### Acceptance criteria

- [ ] `nix build` exits 0
- [ ] `result/lib/vellum/dist/index.html` exists (browser bundle)
- [ ] `result/lib/vellum/dist-server/server/index.js` exists (server)
- [ ] `result/lib/vellum/instruments/` has YAML and .ily files
- [ ] `result/lib/vellum/templates/` has .ly files
- [ ] `result/bin/vellum-server` starts and responds to `/health`

---

## Bead 2: 1e9.2 — NixOS Module

Read the full bead: `grep '"id":"vellum-1e9.2"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

Create `nix/module.nix` and export it from `flake.nix` as `nixosModules.default`.

### Module options

```nix
# nix/module.nix
{ config, lib, pkgs, ... }:
let
  cfg = config.services.vellum;
  vellumPkg = pkgs.vellum or config.services.vellum.package;
in
{
  options.services.vellum = {
    enable = lib.mkEnableOption "Vellum music arrangement server";

    package = lib.mkOption {
      type = lib.types.package;
      description = "The Vellum package to use";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "Port for the Vellum HTTP server";
    };

    domain = lib.mkOption {
      type = lib.types.str;
      default = "vellum.aoeu.pw";
      description = "Domain for Traefik routing";
    };

    apiKeyFile = lib.mkOption {
      type = lib.types.path;
      description = "Path to file containing the LLM API key (e.g., Anthropic)";
    };

    apiKeyEnvVar = lib.mkOption {
      type = lib.types.str;
      default = "ANTHROPIC_API_KEY";
      description = "Environment variable name for the API key";
    };

    dataDir = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/vellum";
      description = "Persistent data directory (arrangements, etc.)";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.vellum = {
      description = "Vellum music arrangement server";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      environment = {
        PORT = toString cfg.port;
        NODE_ENV = "production";
      };

      path = [
        pkgs.lilypond
        (pkgs.python3.withPackages (ps: [ ps.music21 ]))
      ];

      serviceConfig = {
        Type = "simple";
        ExecStart = "${cfg.package}/bin/vellum-server";
        Restart = "on-failure";
        RestartSec = 5;
        DynamicUser = true;
        StateDirectory = "vellum";
        WorkingDirectory = cfg.dataDir;

        # Load API key from file
        LoadCredential = "api-key:${cfg.apiKeyFile}";

        # Security hardening
        NoNewPrivileges = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        ReadWritePaths = [ cfg.dataDir ];
      };

      # Set API key from credential file
      script = ''
        export ${cfg.apiKeyEnvVar}="$(< $CREDENTIALS_DIRECTORY/api-key)"
        exec ${cfg.package}/bin/vellum-server
      '';
    };
  };
}
```

### Flake export

Add to `flake.nix`:

```nix
nixosModules.default = import ./nix/module.nix;
```

### Key considerations

1. **LilyPond in PATH:** The systemd service `path` must include `pkgs.lilypond` so the compile route's `execFileSync("lilypond", ...)` works.

2. **Python + music21 in PATH:** The theory.py subprocess needs `python3` with `music21` installed. Use `pkgs.python3.withPackages (ps: [ ps.music21 ])` — but music21 may not be in nixpkgs. If it's not:
   - Option A: Use a Python venv overlay that pip-installs music21 at build time
   - Option B: Include a `requirements-python.txt` install step in the service startup
   - Option C: Create a small `python3Packages.music21` override
   
   **Check first:** `nix-env -qaP 'python3.*music21'` or search https://search.nixos.org

3. **API key loading:** Use systemd's `LoadCredential` to securely load the API key from a file (compatible with sops-nix and agenix). The wrapper script reads it into an env var.

4. **WorkingDirectory:** The `vellum-server` wrapper already `--chdir`s into the package's lib dir. But the systemd service should also set `WorkingDirectory` to the data dir for arrangement persistence. Since the server uses `process.cwd()` to find instruments/templates, and the wrapper sets `--chdir` to the package dir, this should be fine — the wrapper handles path resolution.

   **Wait — potential conflict:** If `makeWrapper --chdir` changes cwd before node starts, the `dataDir` WorkingDirectory won't matter. The instruments/templates will be found in the package. But arrangement writes might go to the package dir (read-only in Nix). The arrangement storage should use `dataDir`. Check `src/server/lib/arrangement-route.ts` — if it uses an in-memory store (Map), this isn't an issue yet. If it writes to disk, it needs `VELLUM_DATA_DIR` or similar.

5. **Traefik routing:** The bead mentions `services.traefik.dynamicConfigOptions`. This depends on the servoid's Traefik setup. Write the routing config as a NixOS option but make it optional — Jeff may wire it manually in his `.nix` repo. A reasonable default:

```nix
# Optional Traefik config (only if services.traefik is defined)
services.traefik.dynamicConfigOptions.http = lib.mkIf (config.services.traefik.enable or false) {
  routers.vellum = {
    rule = "Host(`${cfg.domain}`)";
    service = "vellum";
    tls = {};
    entryPoints = [ "websecure" ];
  };
  services.vellum.loadBalancer.servers = [
    { url = "http://127.0.0.1:${toString cfg.port}"; }
  ];
};
```

But since this is highly specific to servoid's Traefik config, it's better to leave this out of the module and let Jeff configure it in his `.nix` repo. Just document how.

### Acceptance criteria

- [ ] `nix/module.nix` exists with the module definition
- [ ] `flake.nix` exports `nixosModules.default`
- [ ] Module provides `services.vellum.{enable, package, port, domain, apiKeyFile, dataDir}`
- [ ] systemd service starts the server with LilyPond and Python in PATH
- [ ] API key loaded securely from file (not in nix store)
- [ ] Nix `flake check` passes (if applicable)

---

## Bead 3: 1e9.3 — Deployment Smoke Test Script

Read the full bead: `grep '"id":"vellum-1e9.3"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

Create `scripts/smoke-test.sh` — a portable shell script that verifies a Vellum deployment.

### Script

```bash
#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/smoke-test.sh [base_url]
# Default: http://localhost:3000
BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0

check() {
  local name="$1" cmd="$2" expected="$3"
  if result=$(eval "$cmd" 2>&1) && echo "$result" | grep -q "$expected"; then
    echo "✓ $name"
    ((PASS++))
  else
    echo "✗ $name"
    echo "  Expected: $expected"
    echo "  Got: $result"
    ((FAIL++))
  fi
}

echo "Smoke testing Vellum at $BASE"
echo "---"

# 1. Health check
check "Health" \
  "curl -sf '$BASE/health'" \
  '"status":"ok"'

# 2. Instruments list
check "Instruments" \
  "curl -sf '$BASE/api/instruments'" \
  'baroque-lute-13'

# 3. Templates list
check "Templates" \
  "curl -sf '$BASE/api/templates'" \
  'french-tab'

# 4. Template source
check "Template source" \
  "curl -sf '$BASE/api/templates/french-tab'" \
  'luteTabFormat'

# 5. Compile (LilyPond)
check "Compile" \
  "curl -sf -X POST '$BASE/api/compile' -H 'Content-Type: application/json' -d '{\"source\": \"\\\\version \\\"2.24.0\\\"\\n{ c4 d e f }\"}'" \
  '"errors":[]'

# 6. Frontend
check "Frontend" \
  "curl -sf '$BASE/'" \
  'chat-panel'

# 7. Validate
check "Validate" \
  "curl -sf -X POST '$BASE/api/validate' -H 'Content-Type: application/json' -d '{\"source\": \"\\\\version \\\"2.24.0\\\"\\n{ c4 d e f }\"}'" \
  '"valid":true'

echo "---"
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
```

### Notes

- The script uses only `curl` and `bash` — no special deps
- The LLM stream test is intentionally omitted — it requires an API key and makes real LLM calls
- The music21/analyze test is omitted if music21 isn't guaranteed in the test environment — add it if available
- The script can be run locally (`./scripts/smoke-test.sh http://localhost:3000`) or against production (`./scripts/smoke-test.sh https://vellum.aoeu.pw --cert ...`)
- mTLS verification is left to the caller (pass `--cert`/`--key` via `CURL_OPTS` env var or similar)

### Acceptance criteria

- [ ] `scripts/smoke-test.sh` is executable
- [ ] Runs against a local server and passes all checks
- [ ] Returns exit code 0 on success, non-zero on failure
- [ ] Output is human-readable with ✓/✗ marks

---

## Execution Order

1. Bead 1 (package) — must be done first since the module references the package
2. Bead 2 (module) — references the package from bead 1
3. Bead 3 (smoke test) — independent, can be done anytime

---

## Key Gotchas

1. **`nix build` on this machine:** The Hatch VM can run `nix build` but egress goes through a Fastly proxy. npm registry fetches might work (they're HTTPS) but could also be blocked. If `nix build` fails with network issues, document what happened and provide the correct `npmDepsHash` so Jeff can build on his own machine.

2. **music21 in nixpkgs:** Check if `python3Packages.music21` exists:
   ```bash
   nix eval nixpkgs#python3Packages.music21.version 2>/dev/null || echo "NOT IN NIXPKGS"
   ```
   If it's not there, the module will need a Python environment that pip-installs music21. One approach: build a custom Python derivation. Another: use the venv approach from the dev shell. Document whichever approach you use.

3. **`makeWrapper --chdir`:** This sets `cd` before exec. The server uses `process.cwd()` to find instruments/templates/dist. The `--chdir` to `$out/lib/vellum` means the server will find all its resources there. But arrangement writes (if any go to disk) would also go there — and `$out` is read-only. For now this is fine because arrangements are in-memory (Map), but flag it as a future concern.

4. **The `dist/` path in the package:** The Vite build outputs to `dist/`. The server serves these via `express.static(path.resolve(process.cwd(), "dist"))`. Since `--chdir` points to the package's lib dir, `dist/` will be found correctly.

5. **tsconfig.server.json include paths:** The server build includes `src/server/**/*.ts`, `src/lib/**/*.ts`, and `src/types.ts`. It does NOT include `src/main.ts`, `src/renderers.ts`, `src/tools.ts`, `src/fretboard.ts`, `src/diapasons.ts`, `src/transpose.ts`, `src/theory.ts`, `src/prompts.ts`, `src/server-tools.ts`. However, the server code imports from `../types.js`, `./lib/...`, etc. Verify the server build works standalone:
   ```bash
   npx tsc -p tsconfig.server.json --noEmit 2>&1
   ```
   If there are missing imports, the server tsconfig might need additional includes.

6. **Default model in main.ts:** Currently defaults to `getModel("openai-codex", "gpt-5.3-codex")`. For deployment with `ANTHROPIC_API_KEY`, the user will need to select Anthropic in the ChatPanel UI. This is a UX concern, not a deployment blocker — but worth noting in the module documentation.

---

## Final Gate

```bash
cd ~/workspace/vellum && nix develop --command bash -c '
  npm install &&
  npm run typecheck &&
  npm test
'
# Then separately:
nix build .#default 2>&1
```

All tests must pass. No typecheck errors. `nix build` should succeed (or document the failure if blocked by network). Commit:

`wave 11: NixOS deployment — package, module, smoke test`

Do NOT push — leave the commit local.
