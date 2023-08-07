export type CFNamespace = 'NOTE' | 'ZONE' | 'DOMAIN'

export interface Env {
  SCOPE: string
  DELAY: number
  POLYGON_API: string
  ETHEREUM_API: string

  ZONES: KVNamespace
  RESOLVER: KVNamespace

  NOTE: DurableObjectNamespace
  ZONE: DurableObjectNamespace
  DOMAIN: DurableObjectNamespace

  fetchNote: (name: string, path: string, data?: Record<string, any>) => Promise<any>
  fetchZone: (name: string, path: string, data?: Record<string, any>) => Promise<any>
  fetchDomain: (name: string, path: string, data?: Record<string, any>) => Promise<any>

  getNote: (address: string, namehash?: string) => Promise<NoteData | null>
  getNotes: (scope: string, key: string) => Promise<NoteData[]>

  getDomain: (namehash: string) => Promise<DomainData | null>
  getDomains: (scope: string) => Promise<DomainData[]>

  getAccount: (address: string) => Promise<AccountData | null>

  getMetadata: (namehash: string) => Promise<Record<string, any> | null>
  getMetadataLayer: (address: string, channel: string) => Promise<Metadata>

  syncZones: () => Promise<ZoneStatus[]>
}

export type RouterParams = {
  fqn?: string
  zone?: string
  origin?: string
  address?: string
  revision?: string
}

export interface RouterRequest extends Request {
  params: RouterParams
  body: any
}

// Zone
export type ZoneConfig = {
  api: string
  chain: string
  contract: string
  parent: string
  origin: string
  label: string
  fqn: string
  start: number
  batch: number
  delay: number
  lag: number
}

export type ZoneStatus = {
  state: 'idle' | 'syncing' | 'synced' | 'error'
  timestamp: number
  current?: string
  head?: string
  safe?: string
  target?: string
  remaining?: string
}

export type ZoneBlocks = {
  current: bigint
  target: bigint
  head: bigint
  safe: bigint
}

export type ZoneEvent = {
  transactionHash: string
  blockNumber: string
  blockHash: string
  logIndex: string
  removed: boolean
  topics: string[]
  data: string
}

export type ZoneEventHandler = (event: ZoneEvent) => Promise<DecodedZoneEvent>

export type DecodedZoneEvent = RegisterEvent | TransferEvent

export type RegisterEvent = {
  id: string
  name: string
  label: string
  parent: string
  removed: boolean
  index: string
  block: string
  height: string
  txid: string
}

export type TransferEvent = {
  id: string
  name: string
  from: string
  to: string
  namehash: string
  removed: boolean
  index: string
  block: string
  height: string
  txid: string
}

export type NoteData = {
  channel?: string
  address: string
  rev?: number
  ptr?: string
}

export type DomainData = {
  namehash: string
  parent: string
  label: string
  fqn: string
  owner?: string
}

export type AccountData = {
  address: string
  publickey?: string
}

export type Metadata = {
  name?: string
  image?: string
  image_data?: string
  description?: string
  external_url?: string
  animation_url?: string
  background_color?: string
  attributes?: MetadataAttribute[]
}

export type MetadataAttribute = {
  display_type?: 'date' | 'number' | 'boost_number' | 'boost_percentage'
  trait_type: string
  value: string | number
}
