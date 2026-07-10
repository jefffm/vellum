# Own the model Provider Connection

Vellum will provide a first-run Connect ChatGPT flow and own the complete local Provider Connection lifecycle. It will call Pi's public OpenAI Codex OAuth interface behind a Vellum adapter, receive the localhost callback, store credentials in Vellum-controlled secure local storage, refresh them automatically, and expose explicit status, reconnect, and logout controls; API keys remain a fallback.

## Considered options

- Continue reading Pi's private `auth.json` file
- Require users to run a separate CLI login
- Let Vellum own OAuth through Pi's public provider interface

## Consequences

Provider Authorization remains separate from Owner identity and musical-data ownership. Credentials use an OS-native credential vault where available, with a permission-restricted local fallback. Refresh writes must be atomic and single-flight. The Pi/OpenAI integration stays behind a replaceable adapter because ChatGPT subscription OAuth is not a generic hosted-app contract.
