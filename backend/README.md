<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

In addition, [Laracasts](https://laracasts.com) contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

You can also watch bite-sized lessons with real-world projects on [Laravel Learn](https://laravel.com/learn), where you will be guided through building a Laravel application from scratch while learning PHP fundamentals.

## Agentic Development

Laravel's predictable structure and conventions make it ideal for AI coding agents like Claude Code, Cursor, and GitHub Copilot. Install [Laravel Boost](https://laravel.com/docs/ai) to supercharge your AI workflow:

```bash
composer require laravel/boost --dev

php artisan boost:install
```

Boost provides your agent 15+ tools and skills that help agents build Laravel applications while following best practices.

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).


## Local presentation mode

Use this mode when the venue internet is unreliable. Fedora runs Laravel and a dedicated PostgreSQL database locally; the admin browser and phones connect over the same Wi-Fi. This database is separate from Supabase and contains only local demo data.

### One-time setup

From the repository root:

```bash
cd backend
./scripts/setup-presentation-demo.sh
```

The script starts Lerd PostgreSQL if needed, creates a dedicated `euevent_demo` database and login, generates unique local credentials, runs Laravel migrations, and seeds one administrator, a venue, and Gate A. It writes secrets to the ignored, owner-readable-only `.env.demo` file. It does not change `.env` or contact Supabase.

The generated administrator is `demo-admin@euevent.test`. To read the generated password on Fedora:

```bash
grep '^EUEVENT_DEMO_ADMIN_PASSWORD=' .env.demo
```

Keep that password on the presentation computer. The demo seeder is explicitly restricted to Laravel's `demo` environment.

### Start the API and clients

1. Start the local Laravel API and database from `backend`:

   ```bash
   ./scripts/start-presentation-demo.sh
   ```

   Laravel listens on port `8002` on Fedora's LAN interfaces. Keep this terminal open.

2. In another terminal, run the administrator dashboard:

   ```bash
   cd admin-web
   npm run dev -- --host 0.0.0.0
   ```

   Its ignored `.env.local` points the Vite API proxy at the local Laravel API. Open the Vite URL printed in the terminal on Fedora.

3. Start Expo Go on the same Wi-Fi:

   ```bash
   cd security-scanner
   npm run start:lan
   ```

   The launcher detects Fedora's current LAN address and passes it to Expo as the API default. If a phone has an older server address saved in secure storage, open the app's server settings and save the address printed by the launcher. Keep the Metro/Expo terminal open while presenting with Expo Go.

The Fedora LAN address can change when the Wi-Fi router renews its DHCP lease. The launcher detects the current address each time; a DHCP reservation on the presentation router can make it stable if you control that router.

### What works without internet

Once the devices are on the same local Wi-Fi, the API, database, dashboard, and Expo Go bundle can communicate locally without WAN access. A working local Wi-Fi network is still required for phones to reach Fedora. If the venue Wi-Fi has poor WAN bandwidth but a healthy local network, the application traffic stays inside that network. If the local network also fails, security staff need the event manifest already downloaded on their scanner; queued scans can sync after connectivity returns.

Expo Go still loads the JavaScript bundle from the running Metro server. For a presentation that must survive losing the local Wi-Fi too, install a standalone app build and preload the scanner manifest before the network goes down.
