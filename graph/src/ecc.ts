import * as secp256k1 from "@noble/secp256k1"
import { keccak_256 } from '@noble/hashes/sha3'
import { isHex, toHex, toBytes } from './utils'

const { concatBytes } = secp256k1.utils

export const ROOT = new Uint8Array(32)

// Curve
export const Curves = {
  0xe7: {
    code: 0xe7,
    name: 'secp256k1',
    Point: secp256k1.Point,
    toPoint(bytes: string | Uint8Array | secp256k1.Point) {
      if (bytes instanceof secp256k1.Point) { return bytes }
      bytes = toBytes(bytes)
      return secp256k1.Point.fromHex(bytes)
    },
    fromPoint(point: secp256k1.Point, compressed=true) {
      return point.toRawBytes(compressed)
    }
  }
}

export function detectCurve(_pk: any) {
  return Curves[0xe7]
}

// Point
export function toPoint(pointy: any) {
  return detectCurve(pointy).toPoint(pointy)
}

export function fromPoint(point: any) {
  return detectCurve(point).fromPoint(point)
}

// PublicKey
export function normalizePublicKey(bytes: any, compressed: boolean) {
  const curve = detectCurve(bytes)
  return curve.fromPoint(curve.toPoint(bytes), compressed)
}

export function derivePublicKey(publicKey: any, label: string, channel: any = new Uint8Array(32)) {
  channel = toHex(keccak_256(concatBytes(toBytes(channel), keccak_256(label))))
  publicKey = toHex(fromPoint(toPoint(publicKey).multiply(BigInt(channel))))

  return {
    address: toAddr(publicKey),
    publicKey, channel, label
  }
}

export function derivePublicKeys(publicKey: any, topic: any, channel = new Uint8Array(32)): any {
  if (typeof topic === 'string') topic = topic.split('.').reverse()
  if (!Array.isArray(topic)) throw Error('invalid topic')
  if (!topic.length) return []

  const [label, ...labels] = topic
  const PublicKey = derivePublicKey(publicKey, label, channel)
  return [...derivePublicKeys(PublicKey.publicKey, labels, PublicKey.channel), PublicKey]
}

export function recoverPublicKey(sig: any, msg: any) {
  sig = toBytes(sig)
  msg = toBytes(msg)

  let v = sig[64]
  v = 1 - ((v < 27 ? v + 27 : v) % 2)

  sig = sig.slice(0,64)
  return secp256k1.recoverPublicKey(msg, sig, v)
}

// Address
export function isAddr(str: string) {
  return (str.length == 42 && isHex(str))
}

export function toAddr(pk: any) {
  pk = normalizePublicKey(pk, false)
  return toHex(keccak_256(pk.slice(1)).slice(12))
}

export function sighash(msg: any) {
  return keccak_256(`\x19Ethereum Signed Message:\n${msg.length}${msg}`)
}

// Namehash
export function nh(fqn: string | undefined, root=ROOT) {
  if (!fqn) return root
  return fqn.split('.').reverse().reduce((parent: Uint8Array, label: string) => {
    return keccak_256(concatBytes(parent, keccak_256(label)))
  }, root)
}
