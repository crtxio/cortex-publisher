import { Router } from 'itty-router'
import { withJSON } from './utils'

import type { RouterRequest, DomainData, TransferEvent, Env } from './types'

const DefaultData = {
  namehash: '',
  parent: '',
  label: '',
  fqn: ''
}

const router = Router()

router.get('/', async (_, domain) => {
  if (!domain.data.namehash) return new Response('domain not found', { status: 404 })
  return withJSON(domain.data)
})

router.post('/', async (request: RouterRequest, domain) => {
  const data = await request.json() as DomainData
  return withJSON(await domain.init(data))
})

router.get('/transfers', async (_, domain) => {
  return withJSON(await domain.transfers())
})

router.post('/transfers', async (request: RouterRequest, domain) => {
  const event = await request.json() as TransferEvent
  return withJSON(await domain.transfer(event))
})

export class Domain {
  readonly resolver: KVNamespace
  readonly storage: DurableObjectStorage
  data: DomainData = DefaultData

  constructor(readonly state: DurableObjectState, readonly env: Env) {
    this.resolver = env.RESOLVER
    this.storage = state.storage
    this.state.blockConcurrencyWhile(async () => {
      const data = await this.storage.get('data')
      if (data) this.data = data as DomainData
    })
  }

  // Handle HTTP requests from clients.
  async fetch(request: Request) {
    const url = new URL(request.url)
    const [namehash] = url.host.split('.')
    return router.handle(request, this, namehash)
  }

  async alarm() {
    if (!this.data.namehash) return
    const { namehash, parent, label, fqn } = this.data
    const owner = await this.owner()
    const indexed = await this.indexed()
    const metadata = { parent, label, fqn, owner }

    if (owner && owner !== indexed.owner) {
      await this.resolver.delete(`domains:${indexed.owner}:${namehash}`)
    }

    await this.resolver.put(`domains:${parent}:${namehash}`, '', { metadata })
    await this.resolver.put(`domains:${owner}:${namehash}`, '', { metadata })
    await this.resolver.put(`domain:${namehash}`, JSON.stringify(metadata))
  }

  async init(data: DomainData): Promise<DomainData> {
    this.data = data
    await this.storage.put('data', this.data)
    this.schedule()
    return this.data
  }

  async owner(): Promise<string | undefined> {
    const [event] = await this.transfers(1)
    return event.to
  }

  async indexed(): Promise<DomainData> {
    const { namehash } = this.data
    return await this.resolver.get(`domain:${namehash}`, 'json') || DefaultData
  }

  async transfer(event: TransferEvent): Promise<TransferEvent> {
    const { id, removed } = event
    if (removed) await this.storage.delete(id)
    else await this.storage.put(id, event)
    await this.schedule()
    return event
  }

  async transfers(limit: number): Promise<TransferEvent[]> {
    const transfers = await this.storage.list({ prefix: 'transfer:', limit, reverse: true }) as Map<string, TransferEvent>
    return Array.from(transfers.values())
  }

  // helpers
  async schedule(delay: number = 0) {
    return this.storage.setAlarm(Date.now() + delay)
  }
}
