// unending-signer: the catalog's admin key, kept in this Mac's Secure Enclave.
//
// The private key never leaves the Secure Enclave. The key file holds only an
// encrypted handle that this Mac's Secure Enclave can use, and every signature
// needs you there: Touch ID, or your login password when Touch ID isn't
// available. One `sign` run asks once, however many messages it signs.
//
//   unending-signer create <key-file>       make the key; prints its public key
//   unending-signer public-key <key-file>   prints the public key (no prompt)
//   unending-signer sign <key-file> <reason>
//       stdin:  a JSON array of base64 messages
//       stdout: a JSON array of base64url signatures (P-256 ECDSA over SHA-256,
//               raw r||s, the form WebCrypto verifies)
//
// Public keys are printed as base64url of the uncompressed point (65 bytes);
// the key id is the first 16 hex characters of its SHA-256.
//
// Build: swiftc -O signer/main.swift -o .generated/bin/unending-signer
import CryptoKit
import Foundation
import LocalAuthentication

struct Failure: Error { let message: String }

func base64url(_ data: Data) -> String {
  data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
    .replacingOccurrences(of: "=", with: "")
}

func emit(_ value: Any) throws {
  let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}

func describe(_ key: P256.Signing.PublicKey) -> [String: String] {
  let raw = key.x963Representation
  let id = SHA256.hash(data: raw).map { String(format: "%02x", $0) }.joined().prefix(16)
  return ["publicKey": base64url(raw), "keyId": String(id)]
}

func load(_ file: String, context: LAContext? = nil) throws -> SecureEnclave.P256.Signing.PrivateKey {
  guard let data = FileManager.default.contents(atPath: file) else { throw Failure(message: "No key at \(file).") }
  return try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: data, authenticationContext: context)
}

func run(_ args: [String]) throws {
  guard args.count >= 2 else { throw Failure(message: "usage: unending-signer create|public-key|sign <key-file> [reason]") }
  let command = args[0]
  let file = args[1]
  switch command {
  case "create":
    guard SecureEnclave.isAvailable else { throw Failure(message: "This Mac has no Secure Enclave.") }
    if FileManager.default.fileExists(atPath: file) { throw Failure(message: "A key already exists at \(file).") }
    // Tests make a key that signs without a prompt, so they can run unattended.
    // The registry only trusts keys you enrolled, and the catalog never passes this.
    let unattended = args.count > 2 && args[2] == "--test-without-presence"
    // Presence (Touch ID or your password) is what guards each use. The
    // when-unlocked classes fail for processes outside the login UI session,
    // such as a dev server started by an app, so this uses after-first-unlock.
    var flags: SecAccessControlCreateFlags = [.privateKeyUsage]
    if !unattended { flags.insert(.userPresence) }
    var error: Unmanaged<CFError>?
    guard
      let access = SecAccessControlCreateWithFlags(
        kCFAllocatorDefault, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly, flags, &error)
    else { throw Failure(message: "Couldn't set up the key's access control.") }
    let key = try SecureEnclave.P256.Signing.PrivateKey(accessControl: access)
    let directory = (file as NSString).deletingLastPathComponent
    try FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    guard FileManager.default.createFile(atPath: file, contents: key.dataRepresentation, attributes: [.posixPermissions: 0o600])
    else { throw Failure(message: "Couldn't write \(file).") }
    try emit(describe(key.publicKey))
  case "public-key":
    try emit(describe(try load(file).publicKey))
  case "sign":
    guard args.count >= 3 else { throw Failure(message: "sign needs a reason, shown in the Touch ID prompt.") }
    let input = FileHandle.standardInput.readDataToEndOfFile()
    guard let list = try JSONSerialization.jsonObject(with: input) as? [String], !list.isEmpty, list.count <= 16 else {
      throw Failure(message: "stdin must be a JSON array of 1 to 16 base64 messages.")
    }
    let messages = try list.map { item -> Data in
      guard let data = Data(base64Encoded: item) else { throw Failure(message: "A message isn't valid base64.") }
      return data
    }
    // One context for every message, so the prompt appears once per run.
    let context = LAContext()
    context.localizedReason = args[2]
    let key = try load(file, context: context)
    let signatures = try messages.map { base64url(try key.signature(for: $0).rawRepresentation) }
    try emit(signatures)
  default:
    throw Failure(message: "Unknown command \(command).")
  }
}

do {
  try run(Array(CommandLine.arguments.dropFirst()))
} catch let failure as Failure {
  FileHandle.standardError.write("\(failure.message)\n".data(using: .utf8)!)
  exit(1)
} catch {
  let text = (error as NSError).code == LAError.userCancel.rawValue ? "Cancelled." : error.localizedDescription
  FileHandle.standardError.write("\(text)\n".data(using: .utf8)!)
  exit(1)
}
