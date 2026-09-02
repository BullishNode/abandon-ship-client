{
  description = "ark-bitcoin dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        registriesConf = pkgs.writeText "registries.conf" ''
          unqualified-search-registries = ["docker.io"]
        '';
        # Accept any image without signature verification (TLS still enforced).
        # Matches Docker's default; fine for dev, revisit for production.
        policyJson = pkgs.writeText "policy.json" ''
          {
            "default": [{"type": "insecureAcceptAnything"}]
          }
        '';
      in
      {
        packages = rec {
          default = dist;
          # The built web distribution (`npm run build`), for consumers that
          # embed or serve the static app — e.g. barkd embeds this via its
          # bark-web flake input. Dependencies are fetched via importNpmLock,
          # which reads the integrity hashes from package-lock.json directly,
          # so there is no npmDepsHash to keep in sync.
          dist = pkgs.buildNpmPackage {
            pname = "bark-web-dist";
            version = (builtins.fromJSON (builtins.readFile ./package.json)).version;
            src = ./.;
            npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
            npmConfigHook = pkgs.importNpmLock.npmConfigHook;
            nodejs = pkgs.nodejs_22;
            installPhase = ''
              runHook preInstall
              cp -r dist $out
              runHook postInstall
            '';
          };
        };

        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.podman
            pkgs.podman-compose
            pkgs.nodejs_22
          ];
          CONTAINERS_REGISTRIES_CONF = registriesConf;
          # Buildah ignores containers.conf's signature_policy and only checks
          # the hardcoded paths, so symlink the policy file into place.
          shellHook = ''
            mkdir -p "$HOME/.config/containers"
            ln -sf ${policyJson} "$HOME/.config/containers/policy.json"
          '';
        };
      });
}
