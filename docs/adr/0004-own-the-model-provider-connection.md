# Own the model Provider Connection

Vellum will provide a first-run Connect ChatGPT flow and own the complete local Provider Connection lifecycle. It will call Pi's public OpenAI Codex OAuth interface behind a Vellum adapter, receive the localhost callback, store credentials in Vellum-controlled secure local storage, refresh them automatically, and expose explicit status, reconnect, and logout controls; API keys remain a fallback.

## Considered options

- Continue reading Pi's private `auth.json` file
- Require users to run a separate CLI login
- Let Vellum own OAuth through Pi's public provider interface

## Consequences

Provider Authorization remains separate from Owner identity and musical-data ownership. Credentials use an OS-native credential vault where available, with a permission-restricted local fallback. Refresh writes must be atomic and single-flight. Provider failure cannot lock local capabilities or commit partial model output; model actions record exact inputs and remain safely retryable from confirmed version boundaries. Reconnection never resumes a creative action automatically: the Owner must explicitly retry or cancel it, and partial output stays diagnostic until a complete validated result exists. If workspace inputs changed, retry defaults to a revalidated current-state attempt while offering reproduction of the original snapshot on a separate Arrangement Branch. A fake-provider contract suite tests the complete lifecycle and secret redaction in CI; an opt-in real ChatGPT subscription smoke test detects provider-contract drift without storing credentials or becoming a CI dependency. The Pi/OpenAI integration stays behind a replaceable adapter because ChatGPT subscription OAuth is not a generic hosted-app contract.
