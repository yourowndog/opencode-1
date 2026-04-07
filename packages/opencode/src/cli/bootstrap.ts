import { InstanceBootstrap } from "../project/bootstrap"
import { Instance } from "../project/instance"
import { SyncRemote } from "../sync/remote"
import { Config } from "../config/config"

export async function bootstrap<T>(directory: string, cb: () => Promise<T>) {
  return Instance.provide({
    directory,
    init: InstanceBootstrap,
    fn: async () => {
      try {
        // Auto-enable workspaces flag when sync is configured
        const cfg = await Config.get()
        if (cfg.sync?.enabled) {
          process.env.OPENCODE_EXPERIMENTAL_WORKSPACES = "1"
        }

        // Pull from remote before starting (sync enabled via config)
        const pull = await SyncRemote.pull()
        if (pull.pulled > 0) console.log(`[sync] pulled ${pull.pulled} events`)

        const result = await cb()
        return result
      } finally {
        // Push to remote before disposing
        const push = await SyncRemote.push()
        if (push.pushed > 0) console.log(`[sync] pushed ${push.pushed} events`)

        await Instance.dispose()
      }
    },
  })
}
