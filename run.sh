#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# If run.sh is inside another folder such as scripts/,
# use this instead:
# PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PACKAGE_JSON="$PROJECT_ROOT/package.json"
NETWORK_NAME="deligate-local"

PNPM_CMD=()

step() {
    printf '\n==> %s\n' "$1"
}

die() {
    echo "ERROR: $*" >&2
    exit 1
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

get_pinned_pnpm_version() {
    node -e "
const p = require('$PACKAGE_JSON');
const value = p.packageManager || '';

const match = value.match(/^pnpm@(\\d+\\.\\d+\\.\\d+)$/);

if (!match) {
    console.error(
        'Unsupported packageManager value: ' +
        value +
        '. Expected exact pnpm version.'
    );
    process.exit(1);
}

console.log(match[1]);
"
}

get_required_node_major() {
    node -e "
const p = require('$PACKAGE_JSON');
const value = p.engines && p.engines.node;

const match = String(value || '').match(/^\\s*>=\\s*(\\d+)(?:\\.\\d+){0,2}\\s*$/);

if (!match) {
    console.error(
        'Unsupported Node engine constraint: ' +
        value +
        '. Expected something like >=22.'
    );
    process.exit(1);
}

console.log(match[1]);
"
}

resolve_pnpm() {
    local expected
    local actual

    expected="$(get_pinned_pnpm_version)"

    if command_exists corepack; then
        actual="$(corepack pnpm --version 2>/dev/null || true)"

        if [[ "$actual" == "$expected" ]]; then
            PNPM_CMD=(corepack pnpm)
            return
        fi
    fi

    if command_exists pnpm; then
        actual="$(pnpm --version 2>/dev/null || true)"

        if [[ "$actual" == "$expected" ]]; then
            PNPM_CMD=(pnpm)
            return
        fi
    fi

    command_exists npm || die \
        "pnpm $expected is required, and npm is unavailable."

    step "Bootstrapping pnpm $expected with npm"

    npm install --global "pnpm@$expected"

    actual="$(pnpm --version)"

    [[ "$actual" == "$expected" ]] || die \
        "npm bootstrap did not provide pnpm $expected. Found: $actual"

    PNPM_CMD=(pnpm)
}

pnpm_run() {
    "${PNPM_CMD[@]}" "$@"
}

assert_prerequisites() {
    command_exists node || die \
        "Node.js is not installed."

    local required_major
    local current_major

    required_major="$(get_required_node_major)"

    current_major="$(
        node --version |
        sed 's/^v//' |
        cut -d. -f1
    )"

    if (( current_major < required_major )); then
        die \
            "Node.js $required_major or newer is required; found $(node --version)."
    fi

    resolve_pnpm

    command_exists docker || die \
        "Docker is not installed."

    if ! docker info >/dev/null 2>&1; then
        die \
            "Docker is installed, but the Docker daemon is unavailable.

Start Docker first, for example:

    sudo systemctl start docker

Then rerun ./run.sh"
    fi
}

ensure_env_file() {
    local target="$1"
    local template="$2"

    if [[ ! -f "$target" ]]; then
        cp "$template" "$target"
        echo "Created $(basename "$target") from its example."
    fi
}

remove_utf8_bom() {
    local file="$1"

    python3 - "$file" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
data = path.read_bytes()

if data.startswith(b"\xef\xbb\xbf"):
    path.write_bytes(data[3:])
PY
}

ensure_local_environment_files() {
    local root_env="$PROJECT_ROOT/.env"
    local mobile_env="$PROJECT_ROOT/apps/mobile/.env"

    ensure_env_file \
        "$root_env" \
        "$PROJECT_ROOT/.env.example"

    ensure_env_file \
        "$mobile_env" \
        "$PROJECT_ROOT/apps/mobile/.env.example"

    remove_utf8_bom "$root_env"
    remove_utf8_bom "$mobile_env"
}

set_env_value() {
    local file="$1"
    local key="$2"
    local value="$3"
    local force="${4:-false}"

    python3 - "$file" "$key" "$value" "$force" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
force = sys.argv[4].lower() == "true"

lines = path.read_text().splitlines()

found = False
result = []

for line in lines:
    stripped = line.strip()

    if stripped.startswith(f"{key}="):
        found = True

        current = stripped.split("=", 1)[1].strip()

        replaceable = {
            "http://127.0.0.1:54321",
            "",
        }

        if force or current in replaceable:
            result.append(f"{key}={value}")
        else:
            result.append(line)
    else:
        result.append(line)

if not found:
    result.append(f"{key}={value}")

path.write_text("\n".join(result) + "\n")
PY
}

get_supabase_status() {
    local output

    if ! output="$(
        pnpm_run exec supabase status --output json 2>/dev/null
    )"; then
        return 1
    fi

    printf '%s\n' "$output" |
        sed -n '/{/,$p'
}

ensure_supabase() {
    if ! docker network inspect \
        "$NETWORK_NAME" >/dev/null 2>&1; then

        docker network create "$NETWORK_NAME" >/dev/null
    fi

    local status

    status="$(get_supabase_status || true)"

    if [[ -z "$status" ]]; then
        echo "[Deligate] Starting local Supabase..." >&2

        pnpm_run exec supabase start \
            --network-id "$NETWORK_NAME" >&2 ||
            die \
                "Local Supabase failed to start. Check Docker and Supabase CLI."
    fi

    status="$(get_supabase_status || true)"

    [[ -n "$status" ]] ||
        die \
            "Supabase did not report healthy local status after startup."

    pnpm_run exec supabase migration up --local >&2

    printf '%s\n' "$status"
}

get_lan_ip() {
    local ip

    ip="$(
        ip route get 1.1.1.1 2>/dev/null |
        awk '
        {
            for (i = 1; i <= NF; i++) {
                if ($i == "src") {
                    print $(i+1);
                    exit
                }
            }
        }
        '
    )"

    if [[ -z "$ip" ]]; then
        ip="$(
            hostname -I 2>/dev/null |
            awk '{print $1}'
        )"
    fi

    printf '%s' "${ip:-127.0.0.1}"
}

set_development_environment() {
    local status="$1"

    local api_url
    local publishable_key
    local secret_key
    local client_host

    api_url="$(
        printf '%s' "$status" |
        node -e "
let data='';

process.stdin.on('data', d => data += d);

process.stdin.on('end', () => {
    const x = JSON.parse(data);

    console.log(x.API_URL || '');
});
"
    )"

    publishable_key="$(
        printf '%s' "$status" |
        node -e "
let data='';

process.stdin.on('data', d => data += d);

process.stdin.on('end', () => {
    const x = JSON.parse(data);

    console.log(
        x.PUBLISHABLE_KEY ||
        x.ANON_KEY ||
        ''
    );
});
"
    )"

    secret_key="$(
        printf '%s' "$status" |
        node -e "
let data='';

process.stdin.on('data', d => data += d);

process.stdin.on('end', () => {
    const x = JSON.parse(data);

    console.log(
        x.SECRET_KEY ||
        x.SERVICE_ROLE_KEY ||
        ''
    );
});
"
    )"

    [[ -n "$api_url" ]] ||
        die \
            "Supabase status did not provide API_URL."

    [[ -n "$publishable_key" ]] ||
        die \
            "Supabase status did not provide publishable key."

    [[ -n "$secret_key" ]] ||
        die \
            "Supabase status did not provide secret key."

    client_host="$(get_lan_ip)"

    if [[ "$client_host" == "127.0.0.1" ]]; then
        echo \
            "WARNING: No LAN IPv4 address found. Physical-device access may not work."
    fi

    local root_env="$PROJECT_ROOT/.env"
    local mobile_env="$PROJECT_ROOT/apps/mobile/.env"

    set_env_value \
        "$root_env" \
        "SUPABASE_URL" \
        "$api_url"

    set_env_value \
        "$root_env" \
        "SUPABASE_PUBLISHABLE_KEY" \
        "$publishable_key"

    set_env_value \
        "$root_env" \
        "SUPABASE_SECRET_KEY" \
        "$secret_key"

    set_env_value \
        "$root_env" \
        "CORS_ORIGINS" \
        "http://localhost:8081,http://127.0.0.1:8081,http://${client_host}:8081" \
        true

    set_env_value \
        "$mobile_env" \
        "EXPO_PUBLIC_API_URL" \
        "http://${client_host}:3000" \
        true

    local mobile_supabase_url

    mobile_supabase_url="$(
        printf '%s' "$api_url" |
        sed "s/127\.0\.0\.1/$client_host/g"
    )"

    set_env_value \
        "$mobile_env" \
        "EXPO_PUBLIC_SUPABASE_URL" \
        "$mobile_supabase_url" \
        true

    set_env_value \
        "$mobile_env" \
        "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
        "$publishable_key"
}

invoke_checks() {
    git diff --check

    pnpm_run lint
    pnpm_run typecheck
    pnpm_run build

    pnpm_run exec supabase db lint
}

start_development() {
    pnpm_run \
        --filter @deligate/eidstack \
        build

    pnpm_run \
        --filter @deligate/validation \
        build

    step "Starting API and Expo development servers"
    echo "Ctrl+C stops both."

    pnpm_run \
        --filter @deligate/api \
        dev &

    API_PID=$!

    pnpm_run \
        --filter @deligate/mobile \
        dev -- --lan &

    MOBILE_PID=$!

    cleanup() {
        echo
        echo "Stopping development servers..."

        kill "$API_PID" \
            "$MOBILE_PID" \
            2>/dev/null || true

        wait "$API_PID" \
            "$MOBILE_PID" \
            2>/dev/null || true
    }

    trap cleanup EXIT INT TERM

    wait -n "$API_PID" "$MOBILE_PID"
}

main() {
    cd "$PROJECT_ROOT"

    if (( $# > 1 )); then
        echo "Usage: ./run.sh [--check]"
        exit 2
    fi

    if (( $# == 1 )) && [[ "$1" != "--check" ]]; then
        echo "Usage: ./run.sh [--check]"
        exit 2
    fi

    assert_prerequisites

    step "Installing workspace dependencies"

    pnpm_run install \
        --config.confirmModulesPurge=false

    if [[ "${1:-}" == "--check" ]]; then
        invoke_checks
        exit 0
    fi

    ensure_local_environment_files

    local status
    status="$(ensure_supabase)"

    step "Preparing local environment configuration"

    set_development_environment "$status"

    start_development
}

main "$@"