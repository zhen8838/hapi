# Session State Model

## Principle

Notifications are only for main-agent interaction points. Background work is visibility, not interruption.

All foreground status, row indicators, stop-button enablement, and notification triggers must be derived from one state center. The state center owns the state machine, compares previous and next state, and emits transition events. Consumers register handlers for those events instead of re-deriving transitions locally.

## State Axes

The session state is modeled as two primary axes:

- Connection: `offline` | `running`
- Main agent: `idle` | `processing` | `waitingPermission`

Background activity is tracked separately as a list of per-task states and must not change the meaning of main-agent interaction states.

`processing` replaces the legacy `thinking` field name. It means the main agent has a turn in flight; it does not mean the model is emitting reasoning/thinking content.

## Claude SDK Data Flow

Claude SDK does not provide a single session status callback. HAPI derives session state from SDK callbacks and stream events.

```mermaid
sequenceDiagram
    participant User
    participant CLI as HAPI CLI
    participant SDK as Claude SDK
    participant Hub
    participant Web

    User->>CLI: send message
    CLI->>Hub: session-alive processing=true
    CLI->>SDK: push user prompt
    SDK-->>CLI: stream assistant/tool/system messages
    CLI-->>Hub: message-received
    Hub-->>Web: SSE message/session updates

    SDK->>CLI: canCallTool(toolName, input)
    CLI->>Hub: update agentState.requests[id]
    Hub-->>Web: session-updated
    Note over SDK,CLI: SDK waits for canCallTool Promise
    User->>Web: approve or deny
    Web->>Hub: permission response
    Hub->>CLI: permission response
    CLI-->>SDK: resolve canCallTool Promise

    SDK-->>CLI: result event
    CLI->>Hub: session-alive processing=false
    CLI->>Hub: message-received ready
    Hub-->>Web: Ready for input notification
```

Main-agent state is derived in priority order:

```ts
if (!session.active) return 'offline'
if (hasPendingPermissionRequests(session)) return 'waitingPermission'
if (session.processing) return 'processing'
return 'idle'
```

Today, `session.processing` is represented by the legacy `session.thinking` field sent through `session-alive`.

## State Transitions

```mermaid
stateDiagram-v2
    [*] --> offline
    offline --> running: session alive
    running --> offline: session end or timeout

    state running {
        [*] --> idle
        idle --> processing: user prompt accepted
        processing --> waitingPermission: canCallTool creates pending request
        waitingPermission --> processing: permission resolved and turn continues
        waitingPermission --> idle: permission resolved and ready
        processing --> idle: result/ready
    }
```

The state center emits events from these transitions:

| Transition | Event | Consumer examples |
| --- | --- | --- |
| `processing` or `waitingPermission` -> `idle` | `readyForInput` | browser notification, voice ready event, in-app ready toast |
| any non-`waitingPermission` state -> `waitingPermission` | `permissionRequired` | permission attention UI, optional notification |

SSE, cache updates, and component props are transport. They may carry raw fields such as the legacy `thinking` flag, but they must not own status semantics or notification rules.

Background activity is a task list:

```mermaid
classDiagram
    class BackgroundTask {
        id
        type
        status
        startedAt
        completedAt
    }

    class BackgroundTaskStatus {
        <<enumeration>>
        queued
        running
        completed
        failed
        canceled
    }

    BackgroundTask --> BackgroundTaskStatus
```

## Notification Rules

- Notify when the main agent becomes ready for input.
- Notify when the main agent needs user permission.
- Do not notify for background task start or completion by default.

## Foreground Display Rules

The composer status represents the main agent only:

- `offline`: session is not connected.
- `idle`: main agent can accept input.
- `processing`: main agent has a turn in flight.
- `waitingPermission`: main agent is blocked on user approval.

Background tasks must not replace the composer status text. They are visible in background task details and indicators.

The session list activity indicator follows the same main-agent state:

- Show a spinner for `processing`.
- Show an attention indicator for `waitingPermission`.
- Show no main activity indicator for `idle`.
- Dim the row for `offline`.

The stop control is enabled when there is anything interruptible:

- main agent is `processing`
- main agent is `waitingPermission`
- any background task is running
