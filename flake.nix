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
