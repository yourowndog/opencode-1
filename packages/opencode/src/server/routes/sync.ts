import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import z from "zod"
import { lazy } from "../../util/lazy"
import { SyncRemote } from "../../sync/remote"

export const SyncRoutes = lazy(() =>
  new Hono()
    .get(
      "/status",
      describeRoute({
        summary: "Get sync status",
        description: "Retrieve the current sync status including pending events.",
        operationId: "sync.status",
        responses: {
          200: {
            description: "Sync status",
            content: {
              "application/json": {
schema: resolver(
              z.object({
                enabled: z.boolean(),
                pending: z.number(),
                lastPull: z.number(),
                lastPush: z.number(),
                lastError: z.string().optional(),
                lastErrorTime: z.number().optional(),
              }),
            ),
              },
            },
          },
        },
      }),
      async (c) => {
        const status = await SyncRemote.status()
        return c.json(status)
      },
    )
    .post(
      "/push",
      describeRoute({
        summary: "Push sync events",
        description: "Push pending events to the remote sync server.",
        operationId: "sync.push",
        responses: {
          200: {
            description: "Push result",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    pushed: z.number(),
                    error: z.string().optional(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const result = await SyncRemote.push()
        return c.json(result)
      },
    )
    .post(
      "/pull",
      describeRoute({
        summary: "Pull sync events",
        description: "Pull new events from the remote sync server.",
        operationId: "sync.pull",
        responses: {
          200: {
            description: "Pull result",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    pulled: z.number(),
                    error: z.string().optional(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const result = await SyncRemote.pull()
        return c.json(result)
      },
    ),
)