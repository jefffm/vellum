{
  description = "Vellum development environment";

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
              echo "Vellum dev shell: Node $(node --version), npm $(npm --version)"
            '';
          };
        });

      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.stdenvNoCC.mkDerivation {
            pname = "vellum";
            version = "0.1.0";
            src = self;
            dontBuild = true;
            installPhase = ''
              mkdir -p $out/share/vellum
              cp -R . $out/share/vellum
            '';
          };
        });
    };
}
