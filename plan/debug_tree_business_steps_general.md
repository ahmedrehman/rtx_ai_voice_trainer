# Debug Page And Test Quality Standard - General

## Purpose

- Let a human understand exactly what one public method, endpoint, or workflow did.
- Show real inputs and real outputs.
- Show all business instructions, rules, policies, templates, prompts, or configuration that affect the result.
- Show business-relevant steps with clear status.
- Show errors and technical logs without hiding them.
- Never fake JSON, fake business objects, fake success, or fake readiness.
- This standard is for any application, not for one domain.

## General Rule

- A debug page is a business-method proof page.
- It must answer:
  - What business task was attempted?
  - What exact method, endpoint, job, or workflow was called?
  - What exact inputs were used?
  - What decisions were made?
  - Who or what made each decision?
  - What was skipped and why?
  - What exact output came back?
  - What error happened, if any?
- Method output and UI explanation are separate.
- Business decisions must be readable without opening raw JSON.
- Raw JSON must still be available for verification.
- The page must make false readiness impossible.

## Required Test Module Structure

- Tests are their own visible modules.
- Do not hide tests inside the production module folder.
- Test module folder name must be the production module name plus the test boundary:
  - `_test_client`
  - `_test_server`
  - `_test_web`
  - or a clearly equivalent suffix used consistently by the project.
- Separate frontend/client, backend/server, and web UI tests when responsibilities differ.
- The app debug menu must show the test module names.
- The debug page `module` label must be the test module name.
- Frontend/client debug components live in the frontend/client test module.
- Backend/server programmatic tests live in the backend/server test module.
- A mixed catch-all test bucket is not allowed when frontend and backend responsibilities can be separated.
- A backend test module may have no debug pages if its proof is programmatic test files only.

## Required Files

- One debug page equals one file.
- One programmatic test case equals one file.
- Debug page file name:
  - `<method_or_workflow>.debug.ts`
- Test file name:
  - `<method_or_case>.unit_test.ts`
  - or the project test runner equivalent, if already standardized.
- Shared test helpers must have clearly named helper files.
- Index files only aggregate exports.
- Index files must not contain page definitions.
- Index files must not contain test cases.

## Visual Debug Page Requirements

- Show the business target in plain language.
- Show the exact execution path:
  - UI action, if any
  - client method, if any
  - server endpoint, if any
  - server method, if any
  - database/provider/job call, if any
- Show what is real and what is mocked.
- State duplicate execution paths if they exist.
- Duplicate execution paths should not exist.
- Provide editable inputs for the method being tested.
- Provide prepared test cases with short explanations.
- Show real request/input.
- Show real response/output.
- Show status object.
- Show error object.
- Show technical logs.
- Show expandable raw details.
- Reset page state per method.
- Never display stale results from another method page.

## Required Method Contract

Each tested method must have a visible contract:

- method name
- business role
- owner module/library
- implementation/provider, if relevant
- required inputs
- optional inputs
- business rules/configuration
- prompts/instructions/templates, if relevant
- expected output shape
- status object shape
- error behavior
- side effects
- persistence writes, if any
- external calls, if any

If any contract part is unknown, show:

```text
UNKNOWN - NOT VERIFIED
```

If a part does not exist or is intentionally absent, show the truth:

```text
DOES NOT APPLY
NOT IMPLEMENTED
MISSING
SKIPPED
```

## Business Step Tree

- Every business-relevant decision must be visible as a step.
- Every step must show:
  - action
  - decision/result
  - reason
  - actor
- Actor examples:
  - user interface
  - client library
  - server library
  - provider API
  - database
  - background job
  - rules engine
  - UI interpretation
- If a step is skipped, show `SKIPPED` and the reason.
- If a feature is missing, show `NOT IMPLEMENTED - SKIP`.
- Do not hide business logic inside technical logs.

Example:

```text
BUSINESS TARGET: CREATE CUSTOMER INVOICE
  VALIDATE INPUT
    RESULT: YES
    ACTOR: server method
    REASON: required fields are present
  CHECK CUSTOMER ELIGIBILITY
    RESULT: NO
    ACTOR: rules engine
    REASON: account is suspended
  CREATE INVOICE
    RESULT: SKIPPED
    ACTOR: server method
    REASON: customer eligibility failed
  WRITE DATABASE RECORD
    RESULT: SKIPPED
    ACTOR: server method
    REASON: invoice was not created
  RETURN RESPONSE
    RESULT: DONE
    ACTOR: endpoint
    DETAILS: expandable raw output
```

## Instruction And Configuration Rule

- Business instructions are business inputs.
- Show and edit them when the method accepts them.
- Defaults must come from the owning module/library when they are core business behavior.
- The debug page may display and edit instructions, but it must not secretly invent core defaults.
- Examples:
  - validation rules
  - pricing rules
  - routing rules
  - policy text
  - templates
  - prompts
  - response format instructions
  - provider-specific instruction fields
- If no instructions are used, show:

```text
instructions: none
```

## Decision Vs Error

- `error` means the method failed or could not run.
- A valid `NO` is not an error.
- Missing required input is an error.
- Missing config/API key/permission is an error.
- `NO MATCH`, `NO CHANGE`, `NOT ELIGIBLE`, `NOT USEFUL`, or `NOT FOUND` can be valid done results.
- The label must make the business result obvious:
  - `Business decision: eligible? YES`
  - `Business decision: eligible? NO`
  - `Business decision: record created? YES`
  - `Business decision: record created? NO`

## Evidence Rule

- Every visible claim must have evidence.
- Evidence can be:
  - real request/input object
  - real response/output object
  - status object
  - provider response
  - capability/permission result
  - database result
  - job result
  - technical log item
- Do not show explanatory JSON as if it is method output.
- If UI creates an interpretation, label it `UI interpretation`.

## Programmatic Test Rule

- Every debug page should have a matching programmatic test when possible.
- The programmatic test must do the same business test as the UI debug page.
- It may skip the UI button/click.
- It may call the method/function/endpoint directly.
- It may use fixed sample input instead of live user input.
- It may use a local test database only when testing that specific implementation.
- It must not mock away the actual target being proven.

## What Must Not Be Mocked

- Do not mock the provider API when the test claims provider success.
- Do not mock the database when the test claims database persistence works.
- Do not mock browser/device APIs when the test claims browser/device behavior works.
- Do not mock the function under test.
- Do not mock the request body builder if the test claims request-body correctness.
- Do not mock the decision engine if the test claims business decision correctness.

## Allowed Test Substitutions

- UI click can be replaced by direct method/function/endpoint call.
- Live user input can be replaced by fixed real sample input.
- Large binary or private values can be summarized in logs/assertions.
- Missing config can be tested without calling the provider.
- Missing required input can be tested without calling the provider.
- Local-memory store can be tested directly as its own implementation.
- Provider-contract tests may inspect the real request body before sending, but must not claim provider success.

## Test Levels

- Unit/business-method test:
  - calls the public method directly
  - uses real method code
  - uses real input objects
  - checks status, output, errors, and business decisions
  - does not mock the method under test

- Request-contract test:
  - builds the exact provider/database/browser request
  - checks required formats and fields
  - does not claim the external target accepted it unless the external target is actually called

- Integration test:
  - calls the actual external target
  - uses real provider/API/browser/database when available
  - requires real config such as API key, permission, or database binding
  - can be skipped only with explicit `NOT RUN - MISSING CONFIG`

## Programmatic Test Output

- Test output must say what was really tested.
- Test name must include the method or workflow name.
- Test failure must show the real error.
- Success tests must assert:
  - method/endpoint called
  - real input used
  - real request shape when an external target exists
  - real output shape
  - status object
  - business decision fields
  - failure behavior for relevant failure cases
- If a test uses a fake target, it must be named as fake and must not count as proving the real target.

## Core Rule

- One debug page tests one public method, endpoint, or workflow.
- The page calls the real method or real endpoint.
- If it cannot call it, the page must say `NOT CALLABLE` and explain the missing endpoint/config.
- UI does not invent hidden business output.
- UI may show a colored sequence, but real `input`, `output`, `status`, and `error` must stay inspectable.
- Shared debug UI must reset state per method.
- One method page must not display inputs, outputs, or logs from another method page.
- A page is not ready until the run button calls the real method and the result is inspectable.
