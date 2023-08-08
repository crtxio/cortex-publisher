import * as cbor from 'cborg'
import { CID } from 'multiformats/cid'

import {
  toBytes,
  toHex, fromHex,
} from './utils'

import {
  nh, sighash,
  isAddr, toAddr,
  derivePublicKeys,
  recoverPublicKey,
  normalizePublicKey
} from './ecc'

export class Commit {
  _bytes: any
  _iss: any
  _ptr: any
  _rev: any
  _sig: any
  _sub: any

  constructor(bytes: any) {
    bytes = toBytes(bytes)
    const [iss, ptr, rev, sig, sub] = cbor.decode(bytes)

    this._bytes = bytes

    this._iss = iss
    this._ptr = ptr
    this._rev = rev
    this._sig = sig
    this._sub = sub
  }

  get addr() { return toAddr(this._iss) }
  get iss() { return this._iss }
  get ptr() { return CID.decode(this._ptr) }
  get rev() { return this._rev }
  get sig() { return this._sig }
  get sub() { return this._sub }
  get act() { return toAddr(this.signer) }
  get signer() { return recoverPublicKey(this.sig, this.sighash) }

  get id() {
    return `${this.addr}:${this.rev.toString().padStart(20, '0')}`
  }

  get bytes() {
    const commit = [this._iss, this._ptr, this._rev]
    if (this._sig) commit.push(this._sig)
    if (this._sub) commit.push(this._sub)
    return cbor.encode(commit)
  }

  get encoded() { return toHex(this.bytes) }

  get json() {
    return {
      id: this.id,
      addr: this.addr,
      iss: toHex(this.iss),
      ptr: this.ptr.toString(),
      rev: this.rev,
      sig: toHex(this.sig),
      sub: this.sub,
      act: this.act,
      signer: toHex(this.signer),
    }
  }

  get sigmsg() {
    return [
      'COMMIT crtx',
      `Issuer: ${this.addr}`,
      `Pointer: ${this.ptr}`,
      `Revision: ${this.rev}`,
    ].join("\n")
  }

  get sighash() { return sighash(this.sigmsg) }

  get valid() {
    let signer = this.signer

    if (this.sub) {
      const pathway = derivePublicKeys(signer, this.sub)
      signer = pathway[0].publicKey
    }

    const addr = toAddr(signer)
    return addr === this.addr
  }

  sign(sig: any, sub: any) {
    this._sig = toBytes(sig)
    this._sub = sub
  }

  static from(bytes: any) {
    return new Commit(bytes)
  }

  static create({iss, ptr , rev=Date.now()}: {iss: any, ptr:any, rev:any}, topic: any) {
    if (topic) iss = derivePublicKeys(iss, topic)[0].publicKey
    iss = normalizePublicKey(iss, false)
    ptr = CID.parse(ptr).bytes
    const bytes = cbor.encode([iss, ptr, rev])
    return new Commit(bytes)
  }
}

export function useHDData() {
  return {
    Commit,
    normalizePublicKey, recoverPublicKey,
    isAddr, toAddr,
    fromHex, toHex,
    nh, sighash,
    derivePublicKeys
  }
}
