import { Router } from 'itty-router'
import { nh } from './ecc'
import { withJSON, currentBlock, getEvents, decodeEvent, toHex, toBytes } from './utils'

import type { Env, ZoneConfig, ZoneStatus, ZoneBlocks, DomainData, RegisterEvent, TransferEvent } from './types'

const DefaultConfig = {
  api: '', chain: '', contract: '',
  parent: '', origin: '', label: '', fqn: '',
  start: 0, batch: 1000, delay: 10000, lag: 128
}

const DefaultStatus: ZoneStatus = { state: 'idle', timestamp: 0 }

const router = Router()

router.get('/', async (_, { config, status }) => {
  if (!config.api) return new Response('zone not found', { status: 404 })
  return withJSON({ status, config: { ...config, api: 'hidden' } })
})

router.post('/', async (_, zone, origin) => {
  return withJSON(await zone.load(origin))
})

router.get('/registers', async (r, zone) => {
  return withJSON(await zone.registers(10))
})

router.post('/sync', async (_, zone) => {
  return withJSON(await zone.sync())
})

router.post('/reset', async (_, zone) => {
  return withJSON(await zone.reset())
})

export class Zone {
  readonly domains = new Map<string, DurableObjectStub>()
  readonly storage: DurableObjectStorage
  config: ZoneConfig = DefaultConfig
  status: ZoneStatus = DefaultStatus

  constructor(readonly state: DurableObjectState, readonly env: Env) {
    this.storage = state.storage
    this.state.blockConcurrencyWhile(async () => {
      const config = await this.storage.get('config')
      this.config = { ...DefaultConfig, ...(config || {}) }
      const status = (await this.storage.get('status') || DefaultStatus) as ZoneStatus
      this.status = { ...DefaultStatus, ...(status || {}), timestamp: Date.now() }
    });
  }

  // Handle HTTP requests from clients.
  async fetch(request: Request) {
    const url = new URL(request.url)
    const [origin] = url.host.split('.')
    return router.handle(request, this, origin)
  }

  async load(origin: string): Promise<ZoneConfig> {
    this.config = { ...DefaultConfig, ...JSON.parse(await this.env.ZONES.get(origin) || '{}'), origin }
    const { parent, label, fqn } = this.config
    await this.storage.put('config', this.config)
    await this.fetchDomain(origin, '/', { namehash: origin, parent, label, fqn })
    return { ...this.config, api: 'hidden' }
  }

  async sync(): Promise<Record<string, any>> {
    const { api, contract } = this.config
    if (!api) throw Error(`api not configured: ${contract}`)
    if (!contract) throw Error('contract not configured')
    // if (this.status.state === 'syncing') return this.status

    return this.state.blockConcurrencyWhile(async () => {
      const { current, head, safe, target } = await this.blocks()
      await this.updateStatus({ state: 'syncing', current, head, safe, target })

      const events = await getEvents(api, contract, head, target)

      for (const ev of events) {
        const event = await decodeEvent(ev)
        if (event.name === 'Register') await this.register(event as RegisterEvent)
        if (event.name === 'Transfer') await this.transfer(event as TransferEvent)
        console.log('event', event)
      }

      await this.storage.put('head', `0x${target.toString(16)}`)
      return await this.updateStatus({ state: 'synced', current, head, safe, target, remaining: (safe - target).toString() })
    }).then(() => this.status)
  }

  async reset() {
    await this.state.blockConcurrencyWhile(async () => {
      await this.storage.delete('head')
      await this.updateStatus({ state: 'idle', head: 0 })
    })
    return this.status
  }

  // events
  async transfer(event: TransferEvent) {
    const { namehash } = event
    await this.fetchDomain(namehash, '/transfers', event)
  }

  async register(event: RegisterEvent): Promise<DomainData> {
    const { id, parent, label, removed } = event
    const namehash = toHex(nh(label, toBytes(parent)))
    const parentData = await this.fetchDomain(parent, '/') as DomainData
    const fqn = `${label}.${parentData.fqn}`
    const data = { namehash, parent, label, fqn }

    console.log('register id', id)

    await this.fetchDomain(namehash, '/', data)
    if (removed) await this.storage.delete(id)
    else await this.storage.put(id, event)

    return data
  }

  async registers(limit: number): Promise<RegisterEvent[]> {
    const transfers = await this.storage.list({ prefix: 'register:', limit, reverse: true }) as Map<string, RegisterEvent>
    return Array.from(transfers.values())
  }

  // helpers
  async updateStatus(status: Record<string, any>) {
    status.timestamp = Date.now()
    status.current = (status.current || 0).toString()
    status.head = (status.head || 0).toString()
    status.safe = (status.safe || 0).toString()
    status.target = (status.target || 0).toString()
    this.status = { ...this.status, ...status }
    await this.storage.put('status', this.status)
  }

  async blocks(): Promise<ZoneBlocks> {
    const { api, start, batch, lag } = this.config
    const head = BigInt((await this.storage.get('head')) || start || 0)
    const current = await currentBlock(api)
    const safe = current - BigInt(lag)
    const target = head + BigInt(batch) > safe ? safe : head + BigInt(batch)
    return { current, target, head, safe }
  }

  async fetchDomain(namehash: string, path: string, data?: Record<string, any>): Promise<unknown> {
    const { DOMAIN } = this.env
    let stub = this.domains.get(namehash)
    if (!stub) {
      const id = DOMAIN.idFromName(namehash)
      stub = DOMAIN.get(id)
      this.domains.set(namehash, stub)
    }

    const options: RequestInit = {
      headers: { 'content-type': 'application/json;charset=UTF-8' }
    }
    if (data) {
      options.method = 'POST'
      options.body = JSON.stringify(data)
    }

    const response = await stub.fetch(`http://${namehash}.id${path}`, options)
    return response.status === 404 ? undefined : response.json()
  }
}
