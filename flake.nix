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
          # bark-web flake input. Keep npmDepsHash in sync with
          # package-lock.json: `prefetch-npm-deps package-lock.json`.
          dist = pkgs.buildNpmPackage {
            pname = "bark-web-dist";
            version = (builtins.fromJSON (builtins.readFile ./package.json)).version;
            src = ./.;
            npmDepsHash = "sha256-DiS8CctxZKmVL9Tso7ZuKC9qcnuO6p6mUBTW3nsSmvQ=";
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
