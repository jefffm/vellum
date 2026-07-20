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
      mkMusic21 = pkgs: pkgs.python3Packages.buildPythonPackage rec {
        pname = "music21";
        version = "9.7.1";
        pyproject = true;
        src = pkgs.python3Packages.fetchPypi {
          inherit pname version;
          hash = "sha256-sFbMQfuYn0kuKRiCwTwC68E+j1c0xqq5rrn+bP0sJVA=";
        };
        build-system = [ pkgs.python3Packages.hatchling ];
        dependencies = with pkgs.python3Packages; [
          chardet
          joblib
          jsonpickle
          matplotlib
          more-itertools
          numpy
          requests
          webcolors
        ];
        doCheck = false;
      };
    in
    {
      # ── Development shell (unchanged) ────────────────────────────────
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          music21 = mkMusic21 pkgs;
          python = pkgs.python3.withPackages (ps: [ music21 ps.pillow ]);
        in
        {
          default = pkgs.mkShell {
            FONTCONFIG_FILE = "${pkgs.fontconfig.out}/etc/fonts/fonts.conf";
            packages =
              [
                pkgs.git
                pkgs.nodejs_20
                pkgs.lilypond
                pkgs.musescore
                pkgs.podman
                pkgs.poppler-utils
                python
              ]
              # The sealed Linux evaluation path needs an explicit nested sandbox binary.
              ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.bubblewrap ];

            shellHook = ''
              echo "Vellum dev shell: Node $(node --version), npm $(npm --version), Python $(python --version)"
            '';
          };
        });

      # ── Deployable package ───────────────────────────────────────────
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };

          music21 = mkMusic21 pkgs;
          vellumPython = pkgs.python3.withPackages (ps: [ music21 ps.pillow ]);

          # -- Node.js server build --
          vellum-server = pkgs.stdenv.mkDerivation rec {
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

            npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
            nativeBuildInputs = [
              pkgs.nodejs_20
              pkgs.importNpmLock.npmConfigHook
              pkgs.makeWrapper
            ];

            # TypeScript server compilation
            buildPhase = ''
              runHook preBuild
              npm run build
              npm run server:build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall

              # Server code
              mkdir -p "$out/lib/vellum"
              cp -r dist-server "$out/lib/vellum/"
              cp -r dist "$out/lib/vellum/"
              cp -r node_modules "$out/lib/vellum/"
              cp package.json "$out/lib/vellum/"

              # Runtime data (instruments, templates, theory.py)
              cp -r instruments "$out/lib/vellum/"
              cp -r templates "$out/lib/vellum/"
              cp -r knowledge-packs "$out/lib/vellum/"

              # theory.py is resolved as cwd + "src/server/theory.py"
              # so we replicate that path inside the lib directory
              mkdir -p "$out/lib/vellum/src/server"
              cp src/server/*.py "$out/lib/vellum/src/server/"

              # Wrapper script
              mkdir -p "$out/bin"
              makeWrapper ${pkgs.nodejs_20}/bin/node "$out/bin/vellum-server" \
                --add-flags "$out/lib/vellum/dist-server/server/index.js" \
                --set NODE_PATH "$out/lib/vellum/node_modules" \
                --prefix PATH : ${pkgs.lib.makeBinPath (
                  [
                    pkgs.nodejs_20
                    pkgs.lilypond
                    pkgs.musescore
                    pkgs.poppler-utils
                    vellumPython
                  ]
                  ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.bubblewrap ]
                )} \
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
