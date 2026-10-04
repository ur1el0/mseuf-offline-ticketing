#!/usr/bin/env bash
set -Eeuo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND_DIR"

verify_demo_environment() {
    local required setting
    local -a required_settings=(
        'APP_ENV=demo'
        'DB_CONNECTION=pgsql'
        'DB_URL='
        'DB_HOST=127.0.0.1'
        'DB_DATABASE=euevent_demo'
        'DB_USERNAME=euevent_demo'
    )

    for setting in "${required_settings[@]}"; do
        local key="${setting%%=*}"
        if [[ "$(grep -c "^$key=" .env.demo || true)" -ne 1 ]] || ! grep -qxF "$setting" .env.demo; then
            printf 'Refusing to run: backend/.env.demo must contain %s.\n' "$setting" >&2
            printf '%s\n' 'The presentation profile must point only to the isolated local Lerd database.' >&2
            exit 1
        fi
    done

    local port
    if [[ "$(grep -c '^DB_PORT=' .env.demo || true)" -ne 1 ]]; then
        printf '%s\n' 'Refusing to run: backend/.env.demo must contain exactly one DB_PORT setting.' >&2
        exit 1
    fi
    port="$(sed -n 's/^DB_PORT=//p' .env.demo)"
    if [[ ! "$port" =~ ^[0-9]{1,5}$ ]] || (( port < 1 || port > 65535 )); then
        printf '%s\n' 'Refusing to run: backend/.env.demo has an invalid local PostgreSQL port.' >&2
        exit 1
    fi
}

if [[ -f .env.demo ]]; then
    printf '%s\n' 'backend/.env.demo already exists; keeping its credentials and local database.'
    printf '%s\n' 'Running the demo migrations and idempotent presentation seeder.'
    verify_demo_environment
else
    for command in podman openssl python3 php; do
        if ! command -v "$command" >/dev/null 2>&1; then
            printf 'Required command is missing: %s\n' "$command" >&2
            exit 1
        fi
    done

    if ! podman container exists lerd-postgres; then
        printf '%s\n' 'Lerd PostgreSQL is not installed. Install its PostgreSQL preset, then rerun this script.' >&2
        exit 1
    fi

    if [[ "$(podman inspect --format '{{.State.Running}}' lerd-postgres)" != 'true' ]]; then
        printf '%s\n' 'Starting Lerd PostgreSQL.'
        lerd service start postgres || true
    fi

    if [[ "$(podman inspect --format '{{.State.Running}}' lerd-postgres)" != 'true' ]]; then
        printf '%s\n' 'Lerd PostgreSQL did not start. Check its status in Lerd, then rerun this script.' >&2
        exit 1
    fi

    DB_PORT="$(podman port lerd-postgres 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
    if [[ -z "$DB_PORT" ]]; then
        printf '%s\n' 'Could not determine the Lerd PostgreSQL host port.' >&2
        exit 1
    fi

    ROLE_EXISTS="$(podman exec lerd-postgres psql -U postgres -d postgres -tAc "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'euevent_demo')")"
    DATABASE_EXISTS="$(podman exec lerd-postgres psql -U postgres -d postgres -tAc "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'euevent_demo')")"
    if [[ "$ROLE_EXISTS" == 't' || "$DATABASE_EXISTS" == 't' ]]; then
        printf '%s\n' 'A role or database named euevent_demo already exists but backend/.env.demo does not.' >&2
        printf '%s\n' 'Stopping to avoid replacing existing local data. Inspect that local setup before continuing.' >&2
        exit 1
    fi

    DB_PASSWORD="$(openssl rand -hex 32)"
    ADMIN_PASSWORD="$(openssl rand -hex 20)"
    APP_KEY="base64:$(openssl rand -base64 32 | tr -d '\n')"

    printf "CREATE ROLE euevent_demo LOGIN PASSWORD '%s';\n" "$DB_PASSWORD" \
        | podman exec -i lerd-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 >/dev/null

    if ! podman exec lerd-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
        -c 'CREATE DATABASE euevent_demo OWNER euevent_demo' >/dev/null; then
        podman exec lerd-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
            -c 'DROP ROLE IF EXISTS euevent_demo' >/dev/null || true
        exit 1
    fi

    APP_KEY="$APP_KEY" \
    DB_PASSWORD="$DB_PASSWORD" \
    DB_PORT="$DB_PORT" \
    ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    python3 - <<'PY'
from pathlib import Path
import os

backend = Path.cwd()
template = (backend / ".env.demo.example").read_text()
replacements = {
    "APP_KEY=": "APP_KEY=" + os.environ["APP_KEY"],
    "DB_PORT=5434": "DB_PORT=" + os.environ["DB_PORT"],
    "DB_PASSWORD=": "DB_PASSWORD=" + os.environ["DB_PASSWORD"],
    "EUEVENT_DEMO_ADMIN_PASSWORD=": "EUEVENT_DEMO_ADMIN_PASSWORD=" + os.environ["ADMIN_PASSWORD"],
}

for source, target in replacements.items():
    template = template.replace(source, target, 1)

demo_env = backend / ".env.demo"
demo_env.write_text(template)
demo_env.chmod(0o600)
PY

    printf '%s\n' 'Created an isolated Lerd PostgreSQL database and ignored backend/.env.demo.'
fi

verify_demo_environment
php artisan config:clear --env=demo >/dev/null
php artisan migrate --env=demo
php artisan db:seed --env=demo --class='Database\Seeders\PresentationSeeder'

printf '\n%s\n' 'Presentation database is ready.'
printf '%s\n' 'Demo administrator email: demo-admin@euevent.test'
printf '%s\n' 'The generated password is stored only in backend/.env.demo.'
printf '%s\n' 'Start the LAN API with: php artisan serve --env=demo --host=0.0.0.0 --port=8002'
