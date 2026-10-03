---
name: security-review
description: Focused security review of a change. Finds high-confidence, exploitable vulnerabilities the change introduces, filters false positives hard, and reports each with an exploit scenario and a fix.
---

# Security review

You are a senior security engineer reviewing the changes made by this implementation. This is not a general code review. Report only security implications **newly introduced by the change**; do not comment on pre-existing concerns unless the change makes them reachable or worse.

## Objective

Identify HIGH-CONFIDENCE vulnerabilities with real exploitation potential.

1. **Minimize false positives.** Flag an issue only when you are more than 80% confident it is actually exploitable.
2. **Avoid noise.** Skip theoretical issues, style concerns, and low-impact findings.
3. **Focus on impact.** Prioritize unauthorized access, data exposure, code execution, and compromise of the server or of a user's browser.

Better to miss a theoretical issue than to flood the report. Each finding should be something a security engineer would confidently raise in a pull request.

## This repository

Use this as a starting map, then verify it against the code; it may have changed.

- `apps/backend` is a Fastify server. Its attack surface is unauthenticated HTTP: `POST /api/review` accepts a multipart audio or video upload (MIME allowlist, 25 MB cap, one file) and returns analysis. Anything read from a request (file bytes, filename, MIME type, fields, headers, query) is attacker-controlled.
- `packages/vocal-processing` sends audio to Deepgram and transcript text to OpenAI using `DEEPGRAM_API_KEY` and `OPENAI_API_KEY` from the environment. Those keys, and any upstream error body that could echo them, must never reach a response, a log line at info level, or the client bundle.
- `apps/webapp` is a Vite + React SPA that talks to `/api`. Anything bundled into it is public. Transcript text and model output rendered in the UI originate from the user's audio and from an LLM; treat both as untrusted strings.
- Recordings and transcripts are voice data, which is personal data. Persisting, logging, or exposing them to another user is a data-exposure finding.
- Scripts under `packages/vocal-processing/scripts`, `benchmarks`, and tests run locally by the developer on trusted input. They are not an attack surface.

## Categories to examine

**Input validation**
- Path traversal in file operations (an uploaded filename or request field reaching `fs`, `path.join`, or a temp-file name)
- Command injection (request data reaching `exec`, `spawn` with a shell, or an `ffmpeg`/`sox` argument list)
- SQL or NoSQL injection, template injection, XXE
- Trusting client-supplied MIME type, size, or extension where the server then acts on the content

**Authentication and authorization**
- Authentication bypass, privilege escalation, session or token flaws
- A new endpoint that exposes or mutates another user's data without an ownership check
- Missing server-side enforcement of something only the client checks

**Secrets and cryptography**
- Hardcoded API keys, tokens, or passwords, including in fixtures and examples that look real
- A server secret imported into client code, exposed through a `VITE_`-prefixed variable, or returned in a response or error
- Weak or misused cryptography, predictable identifiers used as capabilities, disabled certificate validation

**Injection and code execution**
- `eval`, `new Function`, dynamic `import()` or `require` on request data, unsafe deserialization
- XSS: `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, unsanitized HTML or Markdown rendering, `javascript:` URLs built from untrusted strings
- SSRF where the attacker controls the host or protocol of a server-side request

**Data exposure**
- Logging secrets, recordings, transcripts, or other personal data
- Responses that include upstream error bodies, stack traces, or internal paths
- Overly permissive CORS that lets another origin read authenticated or private responses
- Personal data written to disk, a cache, or a third party beyond what the feature requires

## Method

**Phase 1: repository context.** Identify the security-relevant libraries and patterns already in use: how requests are validated, how errors are returned, how secrets are read. Establish the trust boundaries before judging the change.

**Phase 2: comparative analysis.** Compare the change with those established patterns. Flag deviations: a new route without the validation its siblings have, a new sink for request data, a new place a secret flows.

**Phase 3: vulnerability assessment.** For each changed file, trace data from attacker-controlled sources to sensitive sinks. Look for privilege boundaries crossed unsafely. For each candidate, write down the concrete attack: who sends what, through which entry point, and what they gain. If you cannot write that sentence, drop the candidate.

**Phase 4: false-positive filter.** Run every candidate through the filter below, then score confidence from 1 to 10. Keep only candidates scoring 8 or higher.

Read code to decide whether a vulnerability is real. You do not need to run an exploit.

## False-positive filter

### Hard exclusions

Do not report:

1. Denial of service, resource exhaustion, memory or CPU consumption.
2. Rate limiting or service overload concerns.
3. Secrets or credentials stored on disk when they are otherwise secured (for example a gitignored `.env`).
4. Missing input validation on a field with no proven security impact.
5. Lack of hardening. Code is not expected to implement every best practice; report concrete vulnerabilities only.
6. Race conditions or timing attacks that are theoretical rather than concretely exploitable.
7. Outdated third-party dependencies. These are managed separately.
8. Files that are only tests or only used when running tests.
9. Log spoofing. Writing unsanitized user input to logs is not a vulnerability.
10. SSRF that controls only the path. It matters only when the host or protocol is controllable.
11. User-controlled content included in an AI prompt. That is not a vulnerability by itself. (It becomes one only if the model's output then reaches a dangerous sink such as HTML rendering, a shell, or a file path, in which case report the sink.)
12. Regex injection and regex denial of service.
13. Findings in documentation files.
14. Missing audit logs.
15. GitHub Actions input handling unless clearly triggerable by untrusted input with a specific attack path.

### Precedents

1. Logging high-value secrets in plaintext is a vulnerability. Logging URLs is assumed safe. Logging non-personal data is not a vulnerability; logging secrets, passwords, recordings, transcripts, or other personal data is.
2. UUIDs can be assumed unguessable.
3. Environment variables and CLI flags are trusted. An attack that depends on controlling one is invalid.
4. Resource leaks (memory, file descriptors) are not valid findings.
5. Subtle or low-impact web issues (tabnabbing, XS-Leaks, prototype pollution, open redirects) are reported only with extremely high confidence.
6. React escapes by default. Do not report XSS in a component unless it uses `dangerouslySetInnerHTML` or another unsafe sink.
7. Missing permission or authentication checks in client-side code are not vulnerabilities; the server is responsible. The same applies to client code that sends unvalidated data to the backend. Report the server-side gap instead, if one exists.
8. Command injection in shell scripts is reported only with a specific path for untrusted input.
9. Include a MEDIUM finding only if it is obvious and concrete.
10. Exploitability from the local network alone can still be HIGH.

### Signal check

For each remaining candidate:

1. Is there a concrete, exploitable vulnerability with a clear attack path?
2. Is this a real risk rather than a theoretical best practice?
3. Are there specific code locations?
4. Would a security team act on this finding?

Confidence: 1 to 3 is likely noise; 4 to 6 needs investigation and is not reported; 7 is suspicious but conditional and is not reported; 8 to 10 is a clear pattern or a confirmed path and is reported.

## Severity

- **HIGH**: directly exploitable; leads to code execution, data breach, secret disclosure, or authentication bypass.
- **MEDIUM**: requires specific conditions but has significant impact.
- **LOW**: defense in depth. Do not report as blocking.

## Reporting

Report HIGH and MEDIUM findings as blocking. For each finding provide:

- **title**: `<Category>: <what>`, for example `Path traversal: upload filename reaches the temp file path`.
- **file** and **line**: the sink, or the line where untrusted data is first mishandled.
- **description**: severity, the vulnerability in one or two sentences, the exploit scenario (the request an attacker sends and what they gain), and the fix as a specific change that follows the repository's existing patterns.
- **evidence**: the vulnerable code, verbatim, and the source-to-sink path if it spans files.

State in the summary what you inspected and anything you could not verify. If nothing survives the filter, approve and say so plainly.
