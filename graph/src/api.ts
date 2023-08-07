import { Router } from 'itty-router'
import { toHex, withJSON } from './utils'
import { Commit } from './hddata'
import { nh } from './ecc'

import type { Env, RouterRequest } from './types'

const api = Router({ base: '/api' })

api.get('/metadata/:fqn', async ({ params }: RouterRequest, { getMetadata }) => {
  const { fqn } = params
  const metadata = await getMetadata(toHex(nh(fqn)))
  return withJSON(metadata)
})

api.get('/namehash/:fqn', async ({ params }: RouterRequest) => {
  const { fqn } = params
  return withJSON({ fqn, namehash: toHex(nh(fqn)) })
})

api.get('/zones/:zone', async ({ params }: RouterRequest, { fetchZone, ZONES }: Env) => {
  const { zone } = params
  const origin = toHex(nh(zone))
  return withJSON(await fetchZone(origin, '/'))
})

api.get('/zones/:zone/load', async ({ params }: RouterRequest, { fetchZone, ZONES }: Env) => {
  const { zone } = params
  const origin = toHex(nh(zone))
  return withJSON(await fetchZone(origin, '/', { origin }))
})

api.get('/zones/:zone/sync', async ({ params }: RouterRequest, { fetchZone, ZONES }: Env) => {
  const { zone } = params
  const origin = toHex(nh(zone))
  return withJSON(await fetchZone(origin, '/sync', { origin }))
})

api.get('/zones/:zone/reset', async ({ params }: RouterRequest, { fetchZone, ZONES }: Env) => {
  const { zone } = params
  const origin = toHex(nh(zone))
  return withJSON(await fetchZone(origin, '/reset', { origin }))
})

api.post('/commits', async (request: any, { fetchNote }: Env) => {
  const commit = Commit.from(await request.text())
  if (!commit.valid) return new Response('Invalid commit', { status: 400 })
  await fetchNote(commit.addr, '/', { commit: commit.encoded })
  return withJSON(commit.json)
  // return withJSON(await fetchNote('/commits', { note }))
})

// api.get('/logs', async () => {
//   const url = 'https://eth-mainnet.g.alchemy.com/v2/EXe8owoirLbzod6whfEpUynHY9V-GzHy'
//   // Make a fetch request including `Upgrade: websocket` header.
//   // The Workers Runtime will automatically handle other requirements
//   // of the WebSocket protocol, like the Sec-WebSocket-Key header.
//   let resp = await fetch(url, {
//     headers: {
//       Upgrade: 'websocket',
//     },
//   })

//   // If the WebSocket handshake completed successfully, then the
//   // response has a `webSocket` property.
//   let ws = resp.webSocket
//   if (!ws) {
//     throw new Error("server didn't accept WebSocket");
//   }

//   // Call accept() to indicate that you'll be handling the socket here
//   // in JavaScript, as opposed to returning it on to a client.
//   ws.accept();

//   // Now you can send and receive messages like before.
//   ws.addEventListener('message', (msg: any) => {
//     console.log(msg.data)
//   });

//   ws.send('{"jsonrpc":"2.0","id": 1, "method": "eth_subscribe", "params": ["logs", {"address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]}]}')
// })

export default api
