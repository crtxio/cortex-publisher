import { Router } from 'itty-router'
import { withJSON, toHex } from './utils'
import { Commit } from './hddata'
import { nh } from './ecc'

import type { RouterRequest, Env, NoteData } from './types'


const DefaultData = {
  topic: '',
  author: '',
  address: '',
  publickey: '',
}

const router = Router()

router.get('/', async (_, { storage }, address) => {
  const id = `account:${address}`
  const meta = await storage.get(['publickey'])
  return withJSON({ id, address, ...meta })
})

router.post('/', async (request: RouterRequest, account) => {
  const { commit } = await request.json() as { commit: string }
  return withJSON((await account.publish(commit)).json)
})

router.get('/commit', async (_, account) => {
  return withJSON(await account.commit())
})

router.get('/commit/:revision', async ({ params }: RouterRequest, account) => {
  return withJSON(await account.commit(params.revision))
})

router.get('/commits', async (_, account) => {
  return withJSON(await account.commits())
})

router.get('/commits/:revision', async ({ params }: RouterRequest, account) => {
  return withJSON(await account.commits(params.revision))
})

export class Note {
  readonly resolver: KVNamespace
  readonly storage: DurableObjectStorage

  constructor(readonly state: DurableObjectState, readonly env: Env) {
    this.resolver = env.RESOLVER
    this.storage = state.storage
  }

  // Handle HTTP requests from clients.
  async fetch(request: Request) {
    const url = new URL(request.url)
    const [addr] = url.host.split('.')
    return router.handle(request, this, addr)
  }

  async alarm() {
    const { addr, iss, rev, ptr, act, signer, sub } = await this.commit()
    const channel = sub ? toHex(nh(sub)) : null

    await this.resolver.put(`note:${addr}`, JSON.stringify([ptr, rev, channel]))
    await this.resolver.put(`account:${addr}`, iss)

    if (channel) {
      await this.resolver.put(`accounts:${channel}:${act}`, addr, { metadata: { addr } })
      await this.resolver.put(`account:${act}`, signer)

      await this.resolver.put(`channels:${act}:${channel}`, addr, { metadata: { addr } })
      await this.resolver.put(`channel:${channel}`, sub)
      const response = await fetch(`https://${ptr}.ipfs.w3s.link/metadata.json`)

      if (response.ok) {
        await this.resolver.put(`metadata:${act}:${channel}`, await response.arrayBuffer())
      }
    }
  }

  async publish(encoded: string) {
    const commit = Commit.from(encoded)
    const rev = (commit.rev).toString().padStart(20, '0')
    await this.storage.put(`commit:${rev}`, commit.bytes)
    this.schedule()
    return commit
  }

  async commit(revision: number | string = Date.now()) {
    return (await this.commits(revision, 1))[0]
  }

  async commits(revision: number | string = Date.now(), limit: number) {
    if (typeof(revision) === 'string') revision = parseInt(revision)
    const end = `commit:${(revision + 1).toString().padStart(20, '0')}`
    const commits = await this.storage.list({ prefix: 'commit:', end, limit, reverse: true }) as Map<string, Uint8Array>
    const results = []
    for (const [key, encoded] of commits.entries()) {
      console.log('key', key)
      const commit = Commit.from(encoded)
      results.push(commit.json)
    }
    return results
  }

  // helpers
  async schedule(delay: number = 0) {
    return this.storage.setAlarm(Date.now() + delay)
  }
}
