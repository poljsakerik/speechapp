import { buildApp } from "./app.ts"

const port = Number(process.env.PORT ?? 8000)
await buildApp().listen({ port, host: "127.0.0.1" })
