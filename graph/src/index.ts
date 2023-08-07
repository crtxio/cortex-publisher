export { Note } from './note'
export { Zone } from './zone'
export { Domain } from './domain'

import { Router } from 'itty-router'
import { createYoga } from 'graphql-yoga'

import { withPress } from './press'
import { schema } from './schema'
import api from './api'
import { Env } from './types'

const yoga = createYoga({
  graphqlEndpoint: '/graphql',
  landingPage: false,
  schema,
})

const router = Router()

router.all('*', withPress)
router.all('/api/*', api.handle)
router.all('/graphql/*', yoga.fetch)
router.all('*', () => new Response('Not Found.', { status: 404 }))

export default {
  fetch: router.handle,
  async scheduled(_: unknown, env: Env, __: unknown) {
    await withPress(undefined, env)
    await env.syncZones()
  }
}
