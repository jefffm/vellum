# Use a local-first single-owner runtime

Vellum will run primarily on its Owner's machine, serving its browser UI and local services from localhost. This makes the local filesystem, musical toolchain, durable workspaces, reviewed knowledge, and provider callback part of one trust boundary; private remote access may be added without turning a hosted server into the owner of those resources.

## Considered options

- A remotely hosted, multi-user web service
- A servoid-hosted single-user service that imports another CLI's credentials
- A local-first single-owner runtime with optional private remote access

## Consequences

Vellum owns its Provider Authorization lifecycle and must not read Pi or Codex credential files as an integration contract. Local callback-based sign-in, automatic refresh, reconnect, logout, and secure local credential storage become first-class requirements. Nix packaging remains useful for reproducible dependencies and optional remote deployment, but servoid is no longer the primary product runtime.
