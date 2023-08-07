import type { ZoneEvent, ZoneEventHandler, DecodedZoneEvent, RegisterEvent, TransferEvent } from './types'
// Hex stuff
export function isHex(str: string): boolean {
  return (typeof str === 'string') && /^(0x)?[a-f0-9]*$/i.test(str)
}

export function toHex(bytes: Uint8Array, prefix = true): string {
  const hex = bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
  return prefix ? '0x' + hex : hex
}

export function fromHex(str: string) {
  if (!isHex(str)) throw Error('invalid encoding')
  const HexRegex = /(?<=^(0x)?)[a-f0-9]{1}(?=([a-f0-9]{2})*$)|(?<=^(0x)?[a-f0-9]*)([a-f0-9]{2})/gi
  const bytes = (str.match(HexRegex) ?? []).map(byte => parseInt(byte, 16))
  return Uint8Array.from(bytes)
}

export function toBytes(bytelike: any) {
  if (bytelike instanceof Uint8Array) { return bytelike }
  if (isHex(bytelike)) { return fromHex(bytelike) }
  throw Error('invalid bytes')
}

export function toUTF8(byteslike: any) {
  const bytes = toBytes(byteslike)
  const decoder = new TextDecoder()
  return decoder.decode(bytes)
}

export function withJSON(data: any): Response {
  if (!data) return new Response('{"msg": "not found"}', { status: 404 })

  const json = JSON.stringify(data, null, 2)
  return new Response(json, {
    headers: { 'content-type': 'application/json;charset=UTF-8' }
  })
}

// ethereum json rpc helpers
const EVENT_HANDLERS: Record<string, ZoneEventHandler> = {
  '0xfa0de44d6b928def17acff11cc1684fd8bcdfc30b81206468debd6fd42e5cd9f': decodeRegister,
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': decodeTransfer
}

export function generateEventId(scope: string, { blockNumber, blockHash, logIndex }: ZoneEvent): string {
  blockNumber = BigInt(blockNumber).toString().padStart(20, '0')
  logIndex = BigInt(logIndex).toString().padStart(10, '0')
  return [scope, blockNumber, logIndex, blockHash].join(':')
}

export async function providerFetch(
  url: string,
  method: string,
  params?: Array<any>
): Promise<any> {
  return fetch(url, {
    method: 'POST',
    headers: {accept: 'application/json', 'content-type': 'application/json'},
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params })
  }).then(response => response.json())
}

export async function currentBlock(api: string): Promise<bigint> {
  const response = await providerFetch(api, 'eth_blockNumber')
  return BigInt(response.result)
}

export async function getEvents(api: string, contract: string, start: bigint, end: bigint) {
  const response = await providerFetch(api, 'eth_getLogs', [{
    address: [contract],
    fromBlock: `0x${start.toString(16)}`,
    toBlock: `0x${end.toString(16)}`,
    topics: [Object.keys(EVENT_HANDLERS)]
  }])
  return response.result
}

export async function decodeEvent(event: ZoneEvent): Promise<DecodedZoneEvent> {
  const handler = EVENT_HANDLERS[event.topics[0]]
  if (!handler) throw Error('invalid event')
  return handler(event)
}

export async function decodeRegister(event: ZoneEvent): Promise<RegisterEvent> {
  const {
    logIndex: index,
    blockHash: block,
    blockNumber: height,
    transactionHash: txid,
    data, topics, removed,
  } = event
  const len = parseInt(BigInt('0x' + data.slice(66, 130)).toString())
  const label = toUTF8(data.slice(130, 130 + len * 2))
  const [_, parent] = topics
  const id = generateEventId('register', event)
  return { id, name: 'Register', parent, label, removed, index, block, height, txid }
}

export async function decodeTransfer(event: ZoneEvent): Promise<TransferEvent> {
  const {
    topics, removed,
    logIndex: index,
    blockHash: block,
    blockNumber: height,
    transactionHash: txid
  } = event
  const [ _, _from, _to, namehash ] = topics
  const id = generateEventId('transfer', event)
  return {
    id, namehash, name: 'Transfer',
    from: `0x${_from.slice(26)}`,
    to: `0x${_to.slice(26)}`,
    removed, index, block, height, txid
  }
}
