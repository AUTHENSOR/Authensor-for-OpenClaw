#!/usr/bin/env bash
# authensor-gate.sh — Code-level policy gate for OpenClaw
#
# Runs as a PreToolUse hook. Calls the Authensor control plane before every
# tool call. The LLM cannot bypass this — it runs outside the agent process.
#
# Setup: see README.md in the repo root for installation instructions.
#
# Environment variables (required):
#   CONTROL_PLANE_URL   — e.g. https://authensor-control-plane.onrender.com
#   AUTHENSOR_API_KEY   — e.g. authensor_demo_...
#
# Exit behavior:
#   exit 0 with JSON  → structured allow/deny/ask decision
#   exit 2            → block (fail-closed)

set -euo pipefail

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
for cmd in jq curl; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "authensor-gate: required command '$cmd' not found" >&2
    exit 2
  fi
done

# ---------------------------------------------------------------------------
# Read hook input from stdin
# ---------------------------------------------------------------------------
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

if [ -z "$TOOL_NAME" ]; then
  echo "authensor-gate: no tool_name in hook input" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
: "${CONTROL_PLANE_URL:=}"
: "${AUTHENSOR_API_KEY:=}"

if [ -z "$CONTROL_PLANE_URL" ] || [ -z "$AUTHENSOR_API_KEY" ]; then
  echo "authensor-gate: CONTROL_PLANE_URL or AUTHENSOR_API_KEY not set — action denied (fail-closed)" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Extract the resource string from tool_input based on tool type
# ---------------------------------------------------------------------------
extract_resource() {
  local tool="$1"
  case "$tool" in
    Bash)
      echo "$INPUT" | jq -r '.tool_input.command // empty'
      ;;
    Read|Write|Edit)
      echo "$INPUT" | jq -r '.tool_input.file_path // empty'
      ;;
    Glob)
      local pattern path
      pattern=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty')
      path=$(echo "$INPUT" | jq -r '.tool_input.path // empty')
      if [ -n "$path" ]; then echo "$path/$pattern"; else echo "$pattern"; fi
      ;;
    Grep)
      local pattern path
      pattern=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty')
      path=$(echo "$INPUT" | jq -r '.tool_input.path // "."')
      echo "${path}:${pattern}"
      ;;
    WebFetch)
      echo "$INPUT" | jq -r '.tool_input.url // empty'
      ;;
    WebSearch)
      echo "$INPUT" | jq -r '.tool_input.query // empty'
      ;;
    NotebookEdit)
      echo "$INPUT" | jq -r '.tool_input.notebook_path // empty'
      ;;
    Task)
      echo "$INPUT" | jq -r '.tool_input.description // .tool_input.subagent_type // empty'
      ;;
    *)
      # MCP tools or unknown — grab first meaningful field
      echo "$INPUT" | jq -r '(.tool_input | to_entries | .[0].value // empty) // empty' 2>/dev/null || echo "$tool"
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Deterministic action classification
# ---------------------------------------------------------------------------
classify() {
  local tool="$1"
  local resource="$2"

  # Patterns (POSIX ERE)
  local SENSITIVE_PATHS='(\.ssh|\.aws|\.gnupg|\.env$|\.env\.|/id_rsa|/id_ed25519|secret|credential|token|password|private_key|openclaw\.json)'
  local DESTRUCTIVE_CMDS='\b(rm|rmdir|del|unlink|truncate)\b'
  local SECRETS_CMDS='\b(ssh)\b|id_rsa|id_ed25519|\.env\b|secret|token|password|credential|\.aws|\.gnupg'

  case "$tool" in
    Read|Glob|Grep)
      if echo "$resource" | grep -qiE "$SENSITIVE_PATHS"; then
        echo "secrets.access"
      else
        echo "safe.read"
      fi
      ;;
    Write|Edit|NotebookEdit)
      if echo "$resource" | grep -qiE "$SENSITIVE_PATHS"; then
        echo "secrets.access"
      else
        echo "filesystem.write"
      fi
      ;;
    Bash)
      # Most restrictive first
      if echo "$resource" | grep -qiE "$SECRETS_CMDS"; then
        echo "secrets.access"
      elif echo "$resource" | grep -qE "$DESTRUCTIVE_CMDS"; then
        echo "dangerous.delete"
      elif echo "$resource" | grep -qE '^\s*(ls|pwd|whoami)\s*$'; then
        echo "safe.read"
      else
        echo "code.exec"
      fi
      ;;
    WebFetch|WebSearch)
      echo "network.http"
      ;;
    Task)
      # Subagent spawning — not directly dangerous
      echo "safe.read"
      ;;
    *)
      if echo "$tool" | grep -q '^mcp__'; then
        echo "mcp.tool"
      else
        echo "unknown"
      fi
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Deterministic redaction — strip secrets from the resource string
# ---------------------------------------------------------------------------
redact() {
  local r="$1"

  # URL query parameters and fragments
  r=$(echo "$r" | sed -E 's/\?[^ "]*//g; s/#[^ "]*//g')

  # Inline env var assignments: VAR=value command → command
  r=$(echo "$r" | sed -E 's/[A-Z_]+=\S+ //g')

  # Credentials in URLs: https://user:pass@host → https://host
  r=$(echo "$r" | sed -E 's|://[^@/ ]+@|://|g')

  # curl/wget auth flags
  r=$(echo "$r" | sed -E 's/-u [^ ]+//g')
  r=$(echo "$r" | sed -E 's/-H "Authorization: [^"]*"//g')
  r=$(echo "$r" | sed -E 's/--header "Authorization: [^"]*"//g')

  # Password/token flags
  r=$(echo "$r" | sed -E 's/--password[= ][^ ]+//g')
  r=$(echo "$r" | sed -E 's/--token[= ][^ ]+//g')
  r=$(echo "$r" | sed -E 's/-p[^ ]*( |$)/\1/g')

  # Collapse multiple spaces
  r=$(echo "$r" | tr -s ' ')

  echo "$r"
}

# ---------------------------------------------------------------------------
# Emit a structured hook decision
# ---------------------------------------------------------------------------
emit_decision() {
  local decision="$1"
  local reason="${2:-}"
  jq -n --arg d "$decision" --arg r "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: $d,
      permissionDecisionReason: $r
    }
  }'
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
RESOURCE=$(extract_resource "$TOOL_NAME")
ACTION_TYPE=$(classify "$TOOL_NAME" "$RESOURCE")
REDACTED=$(redact "$RESOURCE")

# Truncate to 500 chars
REDACTED="${REDACTED:0:500}"

# Build request payload
PAYLOAD=$(jq -n \
  --arg type "$ACTION_TYPE" \
  --arg resource "$REDACTED" \
  --arg tool "$TOOL_NAME" \
  '{action: {type: $type, resource: $resource}, tool: $tool}')

# Call control plane (10s timeout)
HTTP_RESPONSE=$(curl -s -m 10 -w '\n%{http_code}' \
  -X POST "${CONTROL_PLANE_URL}/decide" \
  -H "Authorization: Bearer ${AUTHENSOR_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" 2>/dev/null) || {
  # Network failure — fail closed
  emit_decision "deny" "Authensor control plane unreachable — action denied (fail-closed)"
  exit 0
}

HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -1)
BODY=$(echo "$HTTP_RESPONSE" | sed '$d')

# Handle HTTP errors
case "$HTTP_CODE" in
  200) ;;
  401|403)
    emit_decision "deny" "Authensor API key invalid or expired"
    exit 0 ;;
  429)
    emit_decision "deny" "Authensor rate limit reached — wait and retry"
    exit 0 ;;
  *)
    emit_decision "deny" "Authensor control plane returned HTTP ${HTTP_CODE} — action denied (fail-closed)"
    exit 0 ;;
esac

# Parse decision
DECISION=$(echo "$BODY" | jq -r '.decision // empty' 2>/dev/null)
RECEIPT_ID=$(echo "$BODY" | jq -r '.receiptId // "unknown"' 2>/dev/null)

case "$DECISION" in
  allow)
    exit 0
    ;;
  deny)
    emit_decision "deny" \
      "Blocked by Authensor: ${ACTION_TYPE} on ${REDACTED} (receipt: ${RECEIPT_ID})"
    exit 0
    ;;
  require_approval)
    emit_decision "ask" \
      "Authensor requires approval: ${ACTION_TYPE} on ${REDACTED} (receipt: ${RECEIPT_ID})"
    exit 0
    ;;
  *)
    emit_decision "deny" "Authensor returned malformed response — action denied (fail-closed)"
    exit 0
    ;;
esac
