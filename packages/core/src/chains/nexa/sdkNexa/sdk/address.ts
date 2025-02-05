/* eslint-disable no-bitwise */
import bigInt from 'big-integer';

export enum ENexaAddressType {
  PayToPublicKeyHash = 'P2PKH',
  PayToScriptHash = 'SCRIPT',
  PayToScriptTemplate = 'TEMPLATE',
  GroupedPayToPublicKeyTemplate = 'GROUP',
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const ab = new Uint8Array(a.length + b.length);
  ab.set(a);
  ab.set(b, a.length);
  return ab;
}

function prefixToUint5Array(prefix: string): Uint8Array {
  const result = new Uint8Array(prefix.length);
  for (let i = 0; i < prefix.length; i += 1) {
    result[i] = prefix[i].charCodeAt(0) & 31;
  }
  return result;
}

function getType(versionByte: number) {
  switch (versionByte & 248) {
    case 0:
      return 'P2PKH';
    case 1 << 3:
      return 'SCRIPT';
    case 19 << 3:
      return 'TEMPLATE';
    case 11 << 3:
      return 'GROUP';
    default:
      throw new Error(`Invalid address type in version byte: ${versionByte}.`);
  }
}

function getTypeBits(type: string) {
  switch (type) {
    case 'P2PKH':
      return 0;
    case 'SCRIPT':
      return 1 << 3;
    case 'TEMPLATE':
      return 19 << 3;
    case 'GROUP':
      return 11 << 3;
    default:
      throw new Error(`Invalid type: ${type}.`);
  }
}

function convertBits(
  data: Buffer,
  from: number,
  to: number,
  strictMode?: boolean,
) {
  const length = strictMode
    ? Math.floor((data.length * from) / to)
    : Math.ceil((data.length * from) / to);
  const mask = (1 << to) - 1;
  const result = new Uint8Array(length);
  let index = 0;
  let accumulator = 0;
  let bits = 0;
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    // validate(value >= 0 && value >> from === 0, `Invalid value: ${value}.`);
    accumulator = (accumulator << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      result[index] = (accumulator >> bits) & mask;
      index += 1;
    }
  }
  if (!strictMode) {
    if (bits > 0) {
      result[index] = (accumulator << (to - bits)) & mask;
      index += 1;
    }
  } else {
    // validate(
    //   bits < from && ((accumulator << (to - bits)) & mask) === 0,
    //   `Input cannot be converted to ${to} bits without padding, but strict mode was used.`,
    // );
  }
  return result;
}

function toUint5Array(data: Buffer) {
  return convertBits(data, 8, 5);
}

function fromUint5Array(data: Buffer) {
  return convertBits(data, 5, 8, true);
}

function polymod(data: Uint8Array): bigInt.BigInteger {
  const GENERATOR = [
    0x98_f2_bc_8e_61, 0x79_b7_6d_99_e2, 0xf3_3e_5f_b3_c4, 0xae_2e_ab_e2_a8,
    0x1e_4f_43_e4_70,
  ];
  let checksum = bigInt(1);
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    const topBits = checksum.shiftRight(35);
    checksum = checksum.and(0x07_ff_ff_ff_ff).shiftLeft(5).xor(value);
    for (let j = 0; j < GENERATOR.length; j += 1) {
      if (topBits.shiftRight(j).and(1).equals(1)) {
        checksum = checksum.xor(GENERATOR[j]);
      }
    }
  }
  return checksum.xor(1);
}

function checksumToUint5Array(checksum: bigInt.BigInteger) {
  const result = new Uint8Array(8);
  for (let i = 0; i < 8; i += 1) {
    result[7 - i] = checksum.and(31).toJSNumber();
    // eslint-disable-next-line no-param-reassign
    checksum = checksum.shiftRight(5);
  }
  return result;
}

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function base32Encode(data: Uint8Array) {
  let base32 = '';
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    base32 += CHARSET[value];
  }
  return base32;
}

function base32Decode(string: string) {
  const data = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i += 1) {
    const value = string[i];
    data[i] = String(CHARSET).indexOf(value);
  }
  return data;
}

function validChecksum(prefix: string, payload: Uint8Array): boolean {
  const prefixData = concat(prefixToUint5Array(prefix), new Uint8Array(1));
  const checksumData = concat(prefixData, payload);

  return polymod(checksumData).equals(0);
}

/**
 * Returns true if, and only if, the given string contains either uppercase
 * or lowercase letters, but not both.
 *
 * @private
 * @param {string} string Input string.
 * @returns {boolean}
 */
function hasSingleCase(str: string): boolean {
  return str === str.toLowerCase() || str === str.toUpperCase();
}

const VALID_PREFIXES: string[] = ['nexa', 'nexatest', 'nexareg'];

function isValidPrefix(prefix: string): boolean {
  return (
    hasSingleCase(prefix) && VALID_PREFIXES.indexOf(prefix.toLowerCase()) !== -1
  );
}

export function encode(
  prefix: string,
  type: ENexaAddressType,
  hashBuffer: Buffer,
) {
  const prefixData = concat(prefixToUint5Array(prefix), new Uint8Array(1));
  const versionByte = getTypeBits(type);
  const payloadData = toUint5Array(
    Buffer.from(concat(Buffer.from(new Uint8Array([versionByte])), hashBuffer)),
  );
  const checksumData = concat(
    concat(prefixData, payloadData),
    new Uint8Array(8),
  );
  const payload = concat(
    payloadData,
    checksumToUint5Array(polymod(checksumData)),
  );
  return `${prefix}:${base32Encode(payload)}`;
}

export function decodeAddress(address: string) {
  if (typeof address !== 'string' || !hasSingleCase(address)) {
    throw new Error(`Invalid address: ${address}`);
  }

  // let hash: Uint8Array;

  const pieces: string[] = address.toLowerCase().split(':');
  if (pieces.length !== 2) {
    throw new Error(`Miss prefix: ${address}`);
  }

  const prefix = pieces[0];
  if (!isValidPrefix(prefix)) {
    throw new Error(`Invalid prefix: ${address}`);
  }

  const payload = base32Decode(pieces[1]);

  if (!validChecksum(prefix, payload)) {
    throw new Error(`Invalid checksum: ${address}`);
  }

  const payloadData = fromUint5Array(Buffer.from(payload.subarray(0, -8)));
  const versionByte = payloadData[0];
  const hash = payloadData.subarray(1);
  const type = getType(versionByte);

  // switch (type) {
  //   case 'GROUP':
  //     hash = payloadData.subarray(1);
  //     break;
  //   case 'TEMPLATE':
  //     hash = payloadData.subarray(2);
  //     break;
  //   default:
  //     hash = payloadData.subarray(1);
  // }

  return { prefix, type, hash };
}
