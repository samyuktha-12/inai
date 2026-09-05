Get a SpacetimeDB React app running in under 5 minutes.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ installed
- [SpacetimeDB CLI](https://spacetimedb.com/install) installed

Install the [SpacetimeDB CLI](https://spacetimedb.com/install) before continuing.

---

## Create your project

Run the `spacetime dev` command to create a new project with a SpacetimeDB module and React client.

This will start the local SpacetimeDB server, publish your module, generate TypeScript bindings, and start the React development server.

```bash
spacetime dev --template react-ts
```



## Open your app

Navigate to [http://localhost:5173](http://localhost:5173) to see your app running.

The template includes a basic React app connected to SpacetimeDB.



## Explore the project structure

Your project contains both server and client code.

Edit `spacetimedb/src/index.ts` to add tables and reducers. Edit `client/src/App.tsx` to build your UI.

```
my-spacetime-app/
├── spacetimedb/          # Your SpacetimeDB module
│   └── src/
│       └── index.ts      # Server-side logic
├── client/               # React frontend
│   └── src/
│       ├── App.tsx
│       └── module_bindings/  # Auto-generated types
└── package.json
```



## Understand tables and reducers

Open `spacetimedb/src/index.ts` to see the module code. The template includes a `person` table and two reducers: `add` to insert a person, and `sayHello` to greet everyone.

Tables store your data. Reducers are functions that modify data — they're the only way to write to the database.

```typescript
import { schema, table, t } from 'spacetimedb/server';

const spacetimedb = schema({
  person: table(
    { public: true },
    {
      name: t.string(),
    }
  ),
});
export default spacetimedb;

export const add = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    ctx.db.person.insert({ name });
  }
);

export const sayHello = spacetimedb.reducer(ctx => {
  for (const person of ctx.db.person.iter()) {
    console.info(`Hello, ${person.name}!`);
  }
  console.info('Hello, World!');
});
```



## Test with the CLI

Open a new terminal and navigate to your project directory. Then use the SpacetimeDB CLI to call reducers and query your data directly.

```bash
cd my-spacetime-app

# Call the add reducer to insert a person
spacetime call add Alice

# Query the person table
spacetime sql "SELECT * FROM person"
 name
---------
 "Alice"

# Call sayHello to greet everyone
spacetime call say_hello

# View the module logs
spacetime logs
2025-01-13T12:00:00.000000Z  INFO: Hello, Alice!
2025-01-13T12:00:00.000000Z  INFO: Hello, World!
```

## Next steps

## Deploy the in-app Coordinator on Vercel

The Vercel function at `POST /api/coordinator/draft` generates an in-app draft
only. It never sends a message or changes confirmed wedding state.

1. In Vercel, open the project’s **Settings → Environment Variables**.
2. Add `OPENAI_API_KEY` for **Production** (and Preview if you use previews).
3. Optionally add `OPENAI_MODEL` (defaults to `gpt-4.1-mini`).
4. Deploy the project.

Do not use a `VITE_` prefix: those values are bundled into the browser.

- See the [Chat App Tutorial](https://spacetimedb.com/docs/intro/tutorials/chat-app) for a complete example
- Read the [TypeScript SDK Reference](https://spacetimedb.com/docs/intro/core-concepts/clients/typescript-reference) for detailed API docs
- Configure the production voice agents using [Sarvam Voice Agents](docs/sarvam-voice-agents.md).
