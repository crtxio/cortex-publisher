import type { Env, CFNamespace, NoteData, DomainData, AccountData, MetadataAttribute, Metadata, ZoneStatus } from './types'

const DefaultImage = 'ipfs://bafybeihe67oiezjclcok2toyvbypldy4rhe4jybc6kydf75cnvvu2424zu/nft.png'
const ReservedTraits = ['id', 'domain', 'parent domain']

const AttributeFilter = (reserve: MetadataAttribute[] = []) => {
  const reserved = [...(reserve.map(t => t.trait_type.toLowerCase())), ...ReservedTraits]
  return (attr: MetadataAttribute) => {
    return !reserved.includes(attr.trait_type.toLowerCase())
  }
}

export async function withPress(_: Request | undefined, env: Env) {
  const cache = {
    'NOTE': new Map<string, DurableObjectStub>,
    'ZONE': new Map<string, DurableObjectStub>,
    'DOMAIN': new Map<string, DurableObjectStub>
  } as Record<string, Map<string, DurableObjectStub>>

  const fetcher = async (ns: CFNamespace, name: string, path: string, data?: Record<string, any>): Promise<any> => {
    name = name.toLowerCase()
    path = path.toLowerCase()
    let stub = cache[ns].get(name)
    if (!stub) {
      const id = env[ns].idFromName(name)
      stub = env[ns].get(id)
      cache[ns].set(name, stub)
    }

    const options: RequestInit = {
      headers: { 'content-type': 'application/json;charset=UTF-8' }
    }
    if (data) {
      options.method = 'POST'
      options.body = JSON.stringify(data)
    }

    const response = await stub.fetch(`http://${name}.id${path}`, options)
    return response.status === 404 ? undefined : response.json()
  }

  env.fetchNote = async (name: string, path: string, data?: Record<string, any>): Promise<any> => {
    return fetcher('NOTE', name, path, data)
  }

  env.fetchZone = async (name: string, path: string, data?: Record<string, any>): Promise<any> => {
    return fetcher('ZONE', name, path, data)
  }

  env.fetchDomain = async (name: string, path: string, data?: Record<string, any>): Promise<any> => {
    return fetcher('DOMAIN', name, path, data)
  }

  env.getNote = async (address: string, channel?: string): Promise<NoteData | null> => {
    if (channel) {
      const { metadata } = await env.RESOLVER.getWithMetadata(`channels:${address}:${channel}`)
      if (metadata) {
        const { addr } = metadata as { addr: string }
        address = addr
      } else { return null }
    }
    const [ptr, rev, chan] = (await env.RESOLVER.get(`note:${address}`, 'json') as Array<any>) || []
    return { channel: chan, address, rev, ptr }
  }

  env.getNotes = async (scope: string, key: string): Promise<NoteData[]> => {
    const prefix = `${scope}:${key}:`
    const { keys } = await env.RESOLVER.list({ prefix })
    const notes = []
    for (const key of keys) {
      const { addr } = key.metadata as { addr: string }
      const note = await env.getNote(addr)
      if (note) notes.push(note)
    }
    return notes
  }

  env.getDomain = async (namehash: string): Promise<DomainData | null> => {
    const domain = await env.RESOLVER.get(`domain:${namehash}`, 'json')
    return domain ? { namehash, ...domain } as DomainData : null
  }

  env.getDomains = async (scope: string): Promise<DomainData[]> => {
    const prefix = `domains:${scope}:`
    const { keys } = await env.RESOLVER.list({ prefix })
    return keys.map(({ name, metadata = {} }) => {
      const [_, __, namehash] = name.split(':')
      return { ...(metadata || {}), namehash } as DomainData
    })
  }

  env.getAccount = async (address: string): Promise<AccountData> => {
    const publickey = await env.RESOLVER.get(`account:${address}`)
    return publickey ? { address, publickey } : { address }
  }

  env.getMetadata = async (namehash: string): Promise<Record<string, any> | null> => {
    const domain = await env.getDomain(namehash)
    if (!domain || !domain.owner) return null
    const parent = await env.getDomain(domain.parent)
    if (!parent || !parent.owner) return null

    const base = await env.getMetadataLayer(parent.owner, parent.namehash)
    const custom = await env.getMetadataLayer(domain.owner, domain.namehash)
    const overrides = await env.getMetadataLayer(parent.owner, domain.namehash)

    overrides.attributes = (overrides.attributes || []).filter(AttributeFilter())
    custom.attributes = (custom.attributes || []).filter(AttributeFilter(overrides.attributes))
    base.attributes = (base.attributes || []).filter(AttributeFilter([...custom.attributes, ...overrides.attributes]))

    const attributes = [
      { "trait_type": "ID", "value": domain.namehash },
      { "trait_type": "Domain", "value": domain.fqn },
      { "trait_type": "Parent Domain", "value": parent.fqn },
      ...base.attributes,
      ...custom.attributes,
      ...overrides.attributes
    ]
    console.log('attrs', attributes)

    return {
      name: domain.fqn, image: DefaultImage,
      description: `Butterfly Protocol Domain: ${domain.fqn}`,
      ...base, ...custom, ...overrides, attributes
    }
  }

  env.getMetadataLayer = async (address: string, channel: string): Promise<Metadata> => {
    return await env.RESOLVER.get(`metadata:${address}:${channel}`, 'json') || {}
  }

  env.syncZones = async (): Promise<ZoneStatus[]> => {
    const statuses = []
    const { keys } = await env.ZONES.list()
    for (const key of keys) {
      const { name } = key
      const status = await env.fetchZone(name, '/sync', { origin: name })
      console.log('synced', name, status)
      statuses.push(status)
    }
    return statuses
  }
}
