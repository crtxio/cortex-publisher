import { createSchema } from 'graphql-yoga'
import { GraphQLError } from 'graphql'
import { Commit } from './hddata'
import { nh } from './ecc'
import { toHex, toBytes } from './utils'

import type { Env, DomainData } from './types'
import { BigIntResolver, JSONResolver } from 'graphql-scalars'

const RootNamehash = '0x0000000000000000000000000000000000000000000000000000000000000000'

const RootDomain = {
  namehash: RootNamehash,
  parent: RootNamehash,
  label: '',
  fqn: '.'
}

export const schema = createSchema<Env>({
  typeDefs: /* GraphQL */ `
    scalar BigInt
    scalar JSON

    type Query {
      resolve(fqn: String): String
      zone(namehash: ID, fqn: String): Zone
      domain(namehash: ID, fqn: String): Domain

      note(address: ID!): Note
      account(address: ID): Account
      channel(id: ID, topic: String): Channel
    }

    type Mutation {
      publish(commit: String): Commit
    }

    # actors
    type Zone {
      chain: String!
      contract: ID!
      origin: Domain!
      start: Int!
      batch: Int!
      delay: Int!
      lag: Int!
      state: String!
      timestamp: BigInt!
      current: Int!
      head: Int!
      safe: Int!
      target: Int!
      remaining: Int!
      registers: [Register!]!
    }

    type Domain {
      namehash: ID!
      parent: Domain
      label: String!
      fqn: String!
      note: Note
      owner: Account!
      metadata: JSON!
      domains: [Domain!]!
      transfers: [Transfer!]!
    }

    type Note {
      channel: Channel
      issuer: Account!
      rev: BigInt
      ptr: ID
      commits(first: Int, before: BigInt): [Commit!]!
    }

    type Account {
      address: String!
      publickey: String
      notes: [Note!]!
      domains: [Domain!]!
      channels: [Channel!]!
    }

    type Channel {
      id: ID!
      topic: String
      notes: [Note!]!
      accounts: [Account!]!
    }

    # events
    type Register {
      id: ID!
      txid: ID!
      block: String!
      height: Int!
      index: Int!

      domain: Domain!
    }

    type Transfer {
      id: ID!
      txid: ID!
      block: String!
      height: Int!
      index: Int!

      to: Account!
      from: Account!
      domain: Domain!
    }

    type Commit {
      iss: Account
      ptr: ID
      rev: BigInt
      sig: String
      sub: String
      valid: Boolean
    }
  `,
  resolvers: {
    BigInt: BigIntResolver,
    JSON: JSONResolver,
    Query: {
      resolve: async (_, { fqn }, { getDomain, getNote }) => {
        const domain = await getDomain(toHex(nh(fqn)))
        if (!domain) return null
        const { owner, namehash } = domain as DomainData
        if (!owner) return null
        const note = await getNote(owner, namehash)
        return note ? note.ptr : null
      },
      note: async (_, { address }, { getNote }) => {
        return getNote(address)
      },
      zone: async (_, { namehash, fqn }, { fetchZone }) => {
        namehash ||= toHex(nh(fqn))
        const zone = await fetchZone(namehash, '/')
        console.log('zone', zone)
        return zone
        // return fetchZone(namehash, '/')
      },
      domain: async (_, { namehash, fqn }, { getDomain }) => {
        namehash ||= toHex(nh(fqn))
        return getDomain(namehash)
      },
      account: async (_, { address }, { getAccount }) => {
        return getAccount(address)
      },
    },
    Mutation: {
      publish: async (_, args, { fetchNote }) => {
        const commit = Commit.from(args.commit)
        if (!commit.valid) throw new GraphQLError(`invalid commit ${commit.id}`)
        await fetchNote(commit.addr, '/', { commit: commit.encoded })
        return commit
      }
    },
    Zone: {
      origin: async ({ config }, __, { getDomain }) => {
        return getDomain(config.origin)
      },
      registers: async ({ config }, __, { fetchZone }) => {
        return fetchZone(config.origin, '/registers?limit=2')
      },
      // config
      contract: ({ config }) => config.contract,
      chain: ({ config }) => config.chain,
      start: ({ config }) => config.start,
      batch: ({ config }) => config.batch,
      delay: ({ config }) => config.delay,
      lag: ({ config }) => config.lag,
      // status
      state: ({ status }) => status.state,
      timestamp: ({ status }) => status.timestamp,
      current: ({ status }) => status.current,
      head: ({ status }) => status.head,
      safe: ({ status }) => status.safe,
      target: ({ status }) => status.target,
      remaining: ({ status }) => status.remaining,
    },
    Domain: {
      note: async ({ owner, namehash }, __, { getNote }) => {
        return getNote(owner, namehash)
      },
      parent: async ({ parent }, __, { getDomain }) => {
        if (parent === RootNamehash) return RootDomain
        return getDomain(parent)
      },
      owner: async ({ owner }, __, { getAccount }) => {
        return getAccount(owner)
      },
      metadata: async ({ namehash }, __, { getMetadata }) => {
        return getMetadata(namehash)
      },
      domains: async ({ namehash }, __, { getDomains }) => {
        return getDomains(namehash)
      },
      transfers: async ({ namehash }, __, { fetchDomain }) => {
        return fetchDomain(namehash, '/transfers')
      },
    },
    Note: {
      issuer: async ({ address }, __, { getAccount }) => {
        return getAccount(address)
      },
      commits: async ({ address }, { first, before }, { fetchNote }) => {
        const path = before ? `/commits/${before}` : `/commits`
        return fetchNote(address, path)
      },
    },
    Account: {
      notes: async ({ address }, __, { getNotes }) => {
        return getNotes('channels', address)
      },
      domains: async ({ address }, __, { getDomains }) => {
        return getDomains(address)
      }
    },
    Channel: {
      notes: async ({ id }, __, { getNotes }) => {
        return getNotes('accounts', id)
      },
    },
    // Events
    Register: {
      domain: async ({ label, parent }, __, { getDomain }) => {
        const namehash = toHex(nh(label, toBytes(parent)))
        return getDomain(namehash)
      }
    },
    Transfer: {
      domain: async ({ namehash }, __, { getDomain }) => {
        return getDomain(namehash)
      },
      to: async ({ to }, __, { getAccount }) => {
        return getAccount(to)
      },
      from: async ({ from }, __, { getAccount }) => {
        return getAccount(from)
      },
    },
    Commit: {
      iss: async ({ addr }, __, { getAccount }) => {
        return await getAccount(addr)
      },
    }
  },
})
