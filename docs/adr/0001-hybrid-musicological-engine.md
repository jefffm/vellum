# Use a hybrid Musicological Engine

Vellum will combine deterministic symbolic analysis, curated historical knowledge, model judgment, and constraint verification rather than assigning all musical intelligence to the language model or attempting to encode all interpretation as fixed rules. The hybrid preserves inspectable musical facts and historically scoped practices while retaining model-assisted interpretation and creativity where evidence is ambiguous.

Every production analysis emits a concise Analysis Summary and a versioned Analysis Record. The record divides the score into contiguous passages with independent Texture and Contrapuntal Technique classifications. Each Analysis Claim records score-object and measure scope, evidence kind and source identities, observation-versus-inference basis, confidence, viable alternatives, and the consequence an alternative would have for arrangement. Applicable profiles declare period, region, genre, instruments, ensemble role, confidence, and arrangement consequence; competing profiles remain distinct rather than being averaged into a generic style label.

Material ambiguity is explicit. A low-confidence Principal Voice inference is critical because it changes Faithful Reduction invariants; competing historical-profile interpretations can remain non-critical when they do not yet change the result. Owner corrections create a new immutable Analysis Record version, retain the superseded claim, add an authoritative user-correction claim with its evidence, resolve the linked ambiguity, and update affected Preservation Targets. Arrangement Search always selects the newest Analysis Record version for the exact Normalized Score.

## Considered options

- LLM-owned musical intelligence with code limited to mechanical checks
- A fully deterministic expert system
- The selected hybrid Musicological Engine

## Consequences

Musicological Analysis, Analysis Claims, Realization Profiles, Preservation Targets, and verification results must be structured data that survives individual model responses. Curated historical knowledge must be represented as cited, explicitly scoped Historical Practice Claims delivered through reviewed Knowledge Packs or promoted from the Owner Reference Library; conflicting authorities remain visible alternatives rather than being collapsed into universal rules. The model may propose interpretations and arrangements, but it does not become the sole source of musical truth.
