const bidKeyAlgorithm = {
  hash: 'SHA-256',
  modulusLength: 2048,
  name: 'RSA-OAEP',
  publicExponent: new Uint8Array([1, 0, 1]),
}

export async function generateBidKeyPair() {
  if (!globalThis.crypto?.subtle) return { privateKey: null, publicKey: null }

  const pair = await globalThis.crypto.subtle.generateKey(
    bidKeyAlgorithm,
    true,
    ['encrypt', 'decrypt'],
  )

  const [publicKey, privateKey] = await Promise.all([
    globalThis.crypto.subtle.exportKey('jwk', pair.publicKey),
    globalThis.crypto.subtle.exportKey('jwk', pair.privateKey),
  ])

  return { privateKey, publicKey }
}

export async function encryptBidPayload(publicKeyJwk, payload) {
  if (!globalThis.crypto?.subtle || !publicKeyJwk) return null

  const publicKey = await globalThis.crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    bidKeyAlgorithm,
    false,
    ['encrypt'],
  )
  const dataKey = await globalThis.crypto.subtle.generateKey(
    { length: 256, name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt'],
  )
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(payload))
  const [ciphertext, rawDataKey] = await Promise.all([
    globalThis.crypto.subtle.encrypt({ iv, name: 'AES-GCM' }, dataKey, encoded),
    globalThis.crypto.subtle.exportKey('raw', dataKey),
  ])
  const wrappedKey = await globalThis.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawDataKey,
  )

  return {
    alg: 'RSA-OAEP-256+A256GCM',
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)),
  }
}

export async function decryptBidPayload(privateKeyJwk, encryptedPayload) {
  if (!globalThis.crypto?.subtle || !privateKeyJwk || !encryptedPayload?.ciphertext) return null

  const privateKey = await globalThis.crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    bidKeyAlgorithm,
    false,
    ['decrypt'],
  )
  const wrappedKey = base64ToBytes(encryptedPayload.wrappedKey)
  const rawDataKey = await globalThis.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    wrappedKey,
  )
  const dataKey = await globalThis.crypto.subtle.importKey(
    'raw',
    rawDataKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  )
  const ciphertext = base64ToBytes(encryptedPayload.ciphertext)
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { iv: base64ToBytes(encryptedPayload.iv), name: 'AES-GCM' },
    dataKey,
    ciphertext,
  )

  return JSON.parse(new TextDecoder().decode(decrypted))
}

function bytesToBase64(bytes) {
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return globalThis.btoa(binary)
}

function base64ToBytes(value) {
  const binary = globalThis.atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}
