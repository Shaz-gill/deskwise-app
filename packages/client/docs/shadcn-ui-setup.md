# shadcn/ui Setup Guide — Existing Vite + React Project (bun)

Source: [ui.shadcn.com/docs/installation/vite](https://ui.shadcn.com/docs/installation/vite) — Tailwind v4.

> If your project is still on Tailwind v3, use `shadcn@2.3.0` instead of `shadcn@latest` in the commands below.
> shadcn's CLI expects a TypeScript project (`tsconfig.json` / `tsconfig.app.json`).

---

## Step 1 — Add Tailwind CSS

Skip if Tailwind is already fully configured.

```bash
bun add tailwindcss @tailwindcss/vite
```

Replace the **entire contents** of `src/index.css` with:

```css
@import 'tailwindcss';
```

---

## Step 2 — Edit `tsconfig.json`

Skip if the `@/*` alias is already configured. Add `baseUrl` and `paths` inside `compilerOptions`:

```json
{
   "files": [],
   "references": [
      { "path": "./tsconfig.app.json" },
      { "path": "./tsconfig.node.json" }
   ],
   "compilerOptions": {
      "baseUrl": ".",
      "paths": {
         "@/*": ["./src/*"]
      }
   }
}
```

---

## Step 3 — Edit `tsconfig.app.json`

Add the same alias so your editor resolves imports correctly:

```json
{
   "compilerOptions": {
      // ...keep your existing options
      "baseUrl": ".",
      "paths": {
         "@/*": ["./src/*"]
      }
   }
}
```

---

## Step 4 — Install `@types/node` and update `vite.config.ts`

```bash
bun add -D @types/node
```

`vite.config.ts`:

```ts
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
   plugins: [react(), tailwindcss()],
   resolve: {
      alias: {
         '@': path.resolve(__dirname, './src'),
      },
   },
});
```

---

## Step 5 — Run the shadcn init command

```bash
bunx --bun shadcn@latest init
```

Prompts you for base color, CSS variables, etc. Generates `components.json` at the project root — tells the CLI where your `@/*` paths, Tailwind config, and components folder live.

---

## Step 6 — Add components

```bash
bunx --bun shadcn@latest add button
```

Adds the component source directly into `src/components/ui/button.tsx`. shadcn is not an npm package you import — the CLI copies component code straight into your repo.

---

## Step 7 — Use the component

```tsx
import { Button } from '@/components/ui/button';

function App() {
   return (
      <div className="flex min-h-svh flex-col items-center justify-center">
         <Button>Click me</Button>
      </div>
   );
}

export default App;
```

---

## Common pitfalls

- **TypeScript required** — JS-only projects need extra manual workarounds not covered by the official flow.
- **Tailwind v4 only** — this guide targets v4. Pin `shadcn@2.3.0` for v3 projects.
- **Run `init` from the project root**, not a subfolder — unless using a monorepo, in which case use `-c apps/web` on the `add` command.
- After `init`, confirm `components.json` was created and `bunx --bun shadcn@latest add button` resolves paths without error — that's the clearest sign the alias steps (2–4) were applied correctly.
