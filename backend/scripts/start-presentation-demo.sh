#!/usr/bin/env bash
set -Eeuo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND_DIR"

if [[ ! -f .env.demo ]]; then
    printf '%s\n' 'Demo environment is not set up. Run scripts/setup-presentation-demo.sh first.' >&2
    exit 1
fi

for setting in 'APP_ENV=demo' 'DB_CONNECTION=pgsql' 'DB_URL=' 'DB_HOST=127.0.0.1' 'DB_DATABASE=euevent_demo' 'DB_USERNAME=euevent_demo'; do
    key="${setting%%=*}"
    if [[ "$(grep -c "^$key=" .env.demo || true)" -ne 1 ]] || ! grep -qxF "$setting" .env.demo; then
        printf 'Refusing to run: backend/.env.demo must contain %s.\n' "$setting" >&2
        printf '%s\n' 'The presentation profile must point only to the isolated local Lerd database.' >&2
        exit 1
    fi
done

if [[ "$(grep -c '^DB_PORT=' .env.demo || true)" -ne 1 ]]; then
    printf '%s\n' 'Refusing to run: backend/.env.demo must contain exactly one DB_PORT setting.' >&2
    exit 1
fi

DEMO_DB_PORT="$(sed -n 's/^DB_PORT=//p' .env.demo)"
if [[ ! "$DEMO_DB_PORT" =~ ^[0-9]{1,5}$ ]] || (( DEMO_DB_PORT < 1 || DEMO_DB_PORT > 65535 )); then
    printf '%s\n' 'Refusing to run: backend/.env.demo has an invalid local PostgreSQL port.' >&2
    exit 1
fi

if ! podman container exists lerd-postgres \
    || [[ "$(podman inspect --format '{{.State.Running}}' lerd-postgres)" != 'true' ]]; then
    printf '%s\n' 'Start Lerd PostgreSQL before starting the demo API.' >&2
    printf '%s\n' 'Use: lerd service start postgres' >&2
    exit 1
fi

php artisan config:clear --env=demo >/dev/null
php artisan migrate --env=demo
php artisan db:seed --env=demo --class='Database\Seeders\PresentationSeeder'
php artisan serve --env=demo --host=0.0.0.0 --port=8002
