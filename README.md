![bark-web banner](assets/banner.png)

<div align="center">
<h1>bark-web</h1>
<p>A web-based graphical user interface for managing bark wallets</p>
</div>

## Getting started

### Requirements

- [node v22+](https://nodejs.org/)
- [docker](https://www.docker.com/products/docker-desktop/)

### Setup

1. Install the dependencies with `npm`:

```bash
npm install
```

2. Create `.env.local` at the root of the repository and add the required environment variables.

Take a look at the `.env.example` file.

### Run

Make sure you have `Docker Desktop` running and execute the following command:

```bash
npm run dev
```

The application will be running on `http://localhost:5173`.

To stop, run `docker-compose down`.

### Lint and Format

We use [ultracite](https://docs.ultracite.ai/) with [biome](https://biomejs.dev/) for the linting and formatting.

Run linter checks without modifying files:

```bash
npx ultracite check
```

Run the linter and auto-fix issues:

```bash
npx ultracite fix
```

## License

Released under the **MIT** license — see the [LICENSE](LICENSE) file for details.
