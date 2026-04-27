{
  description = "Vellum – historical plucked-instrument notation server";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      # ── Development shell (unchanged) ────────────────────────────────
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          python = pkgs.python3.withPackages (ps: [
            ps.pip
          ]);
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_20
              pkgs.lilypond
              python
            ];

            shellHook = ''
              if [ ! -d .venv ]; then
                python -m venv .venv
                .venv/bin/pip install -r requirements-python.txt
              fi
              source .venv/bin/activate
              python - <<'PY'
try:
    import music21  # noqa: F401
except Exception:
    raise SystemExit(1)
PY
              if [ $? -ne 0 ]; then
                pip install -r requirements-python.txt
              fi
              echo "Vellum dev shell: Node $(node --version), npm $(npm --version), Python $(python --version)"
            '';
          };
        });

      # ── Deployable package ───────────────────────────────────────────
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };

          # -- Python environment with music21 --
          # music21 is not in nixpkgs; build from PyPI.
          # Most of its transitive deps ARE in nixpkgs already.
          music21 = pkgs.python3Packages.buildPythonPackage rec {
            pname = "music21";
            version = "9.7.1";
            format = "setuptools";

            src = pkgs.python3Packages.fetchPypi {
              inherit pname version;
              # TODO: first `nix build` will fail and report the correct hash.
              # Replace this with the SRI hash from the error message.
              hash = "";
            };

            doCheck = false;

            propagatedBuildInputs = with pkgs.python3Packages; [
              chardet
              joblib
              jsonpickle
              matplotlib
              more-itertools
              numpy
              webcolors
            ];

            meta = {
              description = "A toolkit for computer-aided musicology";
              homepage = "https://web.mit.edu/music21/";
            };
          };

          vellumPython = pkgs.python3.withPackages (_ps: [ music21 ]);

          # -- Node.js server build --
          vellum-server = pkgs.buildNpmPackage rec {
            pname = "vellum";
            version = "0.1.0";

            src = pkgs.lib.cleanSourceWith {
              src = self;
              filter = path: _type:
                let
                  baseName = builtins.baseNameOf path;
                  relPath = pkgs.lib.removePrefix (toString self + "/") (toString path);
                in
                # Exclude build artifacts, dev files, and nix-irrelevant dirs
                !(builtins.elem baseName [
                  ".git" ".beads" ".bv" ".venv" "node_modules"
                  "dist" "dist-server" ".env"
                ])
                && !(pkgs.lib.hasPrefix ".beads/" relPath);
            };

            # TODO: first `nix build` will fail and report the correct hash.
            # Replace this with the SRI hash from the error message.
            npmDepsHash = "";

            nativeBuildInputs = [ pkgs.makeWrapper ];

            # TypeScript server compilation
            buildPhase = ''
              runHook preBuild
              npm run server:build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall

              # Server code
              mkdir -p "$out/lib/vellum"
              cp -r dist-server "$out/lib/vellum/"
              cp -r node_modules "$out/lib/vellum/"
              cp package.json "$out/lib/vellum/"

              # Runtime data (instruments, templates, theory.py)
              cp -r instruments "$out/lib/vellum/"
              cp -r templates "$out/lib/vellum/"

              # theory.py is resolved as cwd + "src/server/theory.py"
              # so we replicate that path inside the lib directory
              mkdir -p "$out/lib/vellum/src/server"
              cp src/server/theory.py "$out/lib/vellum/src/server/theory.py"

              # Wrapper script
              mkdir -p "$out/bin"
              makeWrapper ${pkgs.nodejs_20}/bin/node "$out/bin/vellum-server" \
                --add-flags "$out/lib/vellum/dist-server/server/index.js" \
                --set NODE_PATH "$out/lib/vellum/node_modules" \
                --prefix PATH : ${pkgs.lib.makeBinPath [
                  pkgs.nodejs_20
                  pkgs.lilypond
                  vellumPython
                ]} \
                --set VELLUM_INSTRUMENTS_DIR "$out/lib/vellum/instruments" \
                --set VELLUM_TEMPLATES_DIR "$out/lib/vellum/templates" \
                --chdir "$out/lib/vellum"

              runHook postInstall
            '';

            meta = with pkgs.lib; {
              description = "Historical plucked-instrument notation server (baroque lute, theorbo, etc.)";
              homepage = "https://github.com/jefffm/vellum";
              mainProgram = "vellum-server";
              platforms = platforms.linux ++ platforms.darwin;
            };
          };
        in
        {
          default = vellum-server;
        });
    };
}
