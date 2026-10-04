import { ALPHABET } from './alphabet.ts'
import { EnigmaMachine, type MachineConfig } from './machine.ts'

/** Splits letters into the fixed-width groups operators transmitted, e.g. "ABCDE FGHIJ KL". */
export function toGroups(letters: string, size = 5): string {
  return (
    letters
      .replace(/[^A-Z]/gi, '')
      .toUpperCase()
      .match(new RegExp(`.{1,${size}}`, 'g'))
      ?.join(' ') ?? ''
  )
}

const lettersOnly = (text: string) => text.toUpperCase().replace(/[^A-Z]/g, '')

/**
 * How an operator told the receiver which rotor start positions (the message key) a message used.
 *
 * - `doubled-1938`: Army and Luftwaffe, 15 September 1938 to May 1940. The operator chose a start
 *   position (Grundstellung) and sent it in clear, then enciphered the message key twice at it.
 *   The repeated key was the weakness the Polish Cipher Bureau exploited.
 * - `army-1940`: Army and Luftwaffe from May 1940. As above, but the key was enciphered once and
 *   both went in the header; the first group was an unenciphered key-identification group.
 * - `naval`: Kriegsmarine (M3 and M4). The Grundstellung came from the key sheet; the operator took
 *   a key-net trigram and a message trigram from the Kenngruppenbuch and disguised them with secret
 *   bigram tables instead of the Enigma.
 */
export type ProcedureId = 'doubled-1938' | 'army-1940' | 'naval'

export interface ProcedureInfo {
  readonly id: ProcedureId
  readonly name: string
  readonly period: string
  /** Models the procedure was used with. */
  readonly models: readonly MachineConfig['model'][]
  readonly groupSize: 4 | 5
}

export const PROCEDURES: Readonly<Record<ProcedureId, ProcedureInfo>> = {
  'doubled-1938': {
    id: 'doubled-1938',
    name: 'Army & Luftwaffe: doubled indicator',
    period: 'Sept 1938 – May 1940',
    models: ['I'],
    groupSize: 5,
  },
  'army-1940': {
    id: 'army-1940',
    name: 'Army & Luftwaffe: single indicator',
    period: 'May 1940 – 1945',
    models: ['I'],
    groupSize: 5,
  },
  naval: {
    id: 'naval',
    name: 'Kriegsmarine: Kenngruppenbuch and bigram tables',
    period: '1937 – 1945',
    models: ['M3', 'M4'],
    groupSize: 4,
  },
}

/** One step of the operator's procedure, with the machine positions to try it yourself. */
export interface ProcedureStep {
  readonly title: string
  readonly detail: string
  /** Window letters to set the machine to for this step, if it involves typing. */
  readonly setPositions?: string
  /** What to type at those positions, and what lights up. */
  readonly type?: { readonly input: string; readonly output: string }
}

export interface RadioMessage {
  readonly procedure: ProcedureId
  /** Header line as transmitted, e.g. "1840 – 179 – WXC KCH –". */
  readonly header: string
  /** Message text as transmitted, in groups. */
  readonly body: string
  /** The rotor start positions (stepping rotors) the text was enciphered at. */
  readonly messageKey: string
  readonly steps: readonly ProcedureStep[]
}

export interface SendOptions {
  readonly procedure: ProcedureId
  readonly config: MachineConfig
  readonly plaintext: string
  /** Start position for enciphering the key: chosen by the operator, or (naval) from the key sheet. */
  readonly grundstellung: string
  /** Army: the message key the operator chose. Naval: the trigram from the Kenngruppenbuch. */
  readonly messageKey: string
  /** Army 1940: three-letter key-identification group from the key sheet. Naval: key-net trigram. */
  readonly kenngruppe?: string
  /** Four-figure time of origin, e.g. "1840". */
  readonly time?: string
  readonly random?: () => number
}

const randomLetters = (n: number, random: () => number) =>
  Array.from({ length: n }, () => ALPHABET[Math.floor(random() * 26)]).join('')

/** Enciphers `text` starting at window letters `positions`. */
function encipherAt(config: MachineConfig, positions: string, text: string): string {
  return new EnigmaMachine(config, positions).encipher(text)
}

/** For the M4, the thin rotor isn't part of the message key: it stays where the key sheet put it. */
function fullPositions(config: MachineConfig, grundstellung: string, key: string): string {
  return config.rotors.length === 4 ? grundstellung[0] + key : key
}

function requireLetters(label: string, value: string, length: number): string {
  const letters = lettersOnly(value)
  if (letters.length !== length) {
    throw new RangeError(`${label} must be ${length} letters, got "${value}".`)
  }
  return letters
}

/** Builds a radio message following a historical procedure: indicator, header and groups. */
export function sendMessage(options: SendOptions): RadioMessage {
  const { procedure, config } = options
  const random = options.random ?? Math.random
  const info = PROCEDURES[procedure]
  const slots = config.rotors.length
  const grund = requireLetters(
    'The Grundstellung',
    options.grundstellung,
    procedure === 'naval' ? slots : 3,
  )
  const chosenKey = requireLetters('The message key', options.messageKey, 3)
  const time = options.time ?? '1200'
  const plaintext = lettersOnly(options.plaintext)
  const steps: ProcedureStep[] = [
    {
      title: 'Set up the day’s key',
      detail:
        'Rotor order, ring settings and plugboard come from the key sheet for the day, as in the key sheet panel.',
    },
  ]

  if (procedure === 'doubled-1938' || procedure === 'army-1940') {
    const doubled = procedure === 'doubled-1938'
    const typed = doubled ? chosenKey + chosenKey : chosenKey
    const indicator = encipherAt(config, grund, typed)
    const ciphertext = encipherAt(config, chosenKey, plaintext)
    steps.push(
      {
        title: `Choose a start position: ${grund}`,
        detail: `The operator picks three letters at random. They are sent in clear in the header.`,
      },
      {
        title: `Choose a message key: ${chosenKey}`,
        detail: 'Three more random letters: the rotor positions the message itself will start at.',
      },
      {
        title: doubled
          ? `Encipher the message key twice: ${typed} → ${indicator}`
          : `Encipher the message key once: ${chosenKey} → ${indicator}`,
        detail: doubled
          ? `Set the rotors to ${grund} and type ${typed}. Sending the key twice guarded against garbled reception, but it gave every message a known pattern: letters 1 and 4, 2 and 5, 3 and 6 encipher the same letter. The Polish Cipher Bureau used exactly that to break Enigma.`
          : `Set the rotors to ${grund} and type ${chosenKey}. From May 1940 the key was no longer doubled, closing the weakness the Poles had exploited.`,
        setPositions: grund,
        type: { input: typed, output: indicator },
      },
      {
        title: `Encipher the message at ${chosenKey}`,
        detail: `Set the rotors to the message key ${chosenKey} and type the message.`,
        setPositions: chosenKey,
        type: { input: plaintext, output: ciphertext },
      },
    )
    if (doubled) {
      const body = indicator + ciphertext
      steps.push({
        title: 'Transmit',
        detail: `The header gives the time, the letter count and the start position ${grund}. The six-letter enciphered key opens the message text.`,
      })
      return {
        procedure,
        header: `${time} – ${body.length} – ${grund} –`,
        body: toGroups(body, info.groupSize),
        messageKey: chosenKey,
        steps,
      }
    }
    const kenngruppe =
      randomLetters(2, random) +
      requireLetters('The Kenngruppe', options.kenngruppe ?? randomLetters(3, random), 3)
    const body = kenngruppe + ciphertext
    steps.push({
      title: `Transmit, opening with the identification group ${kenngruppe}`,
      detail: `The header gives the time, the letter count, the start position ${grund} and the enciphered key ${indicator}. The first group (two random letters plus a key-identification trigram from the key sheet) is not enciphered: it tells the receiver which key to use.`,
    })
    return {
      procedure,
      header: `${time} – ${body.length} – ${grund} ${indicator} –`,
      body: toGroups(body, info.groupSize),
      messageKey: chosenKey,
      steps,
    }
  }

  // Kriegsmarine.
  const kenngruppe = requireLetters(
    'The key-net trigram',
    options.kenngruppe ?? randomLetters(3, random),
    3,
  )
  const enciphered = encipherAt(config, grund, chosenKey)
  const start = fullPositions(config, grund, enciphered)
  const ciphertext = encipherAt(config, start, plaintext)
  const fillers = randomLetters(2, random)
  const indicatorGroups = disguiseIndicator(kenngruppe, chosenKey, fillers)
  const body = `${indicatorGroups.join(' ')} ${toGroups(ciphertext, 4)} ${indicatorGroups.join(' ')}`
  steps.push(
    {
      title: `Take two trigrams from the Kenngruppenbuch: ${kenngruppe} and ${chosenKey}`,
      detail: `${kenngruppe} identifies the key net. ${chosenKey} is the message trigram (Spruchschlüssel), chosen from the book's lists rather than invented by the operator.`,
    },
    {
      title: `Encipher the message trigram at the day’s Grundstellung: ${chosenKey} → ${enciphered}`,
      detail: `Set the rotors to ${grund} (from the key sheet) and type ${chosenKey}. The result, ${enciphered}, is the message key${slots === 4 ? `; the thin rotor stays at ${grund[0]}` : ''}.`,
      setPositions: grund,
      type: { input: chosenKey, output: enciphered },
    },
    {
      title: `Encipher the message at ${start}`,
      detail: `Set the rotors to ${start} and type the message. Naval messages were sent in groups of four.`,
      setPositions: start,
      type: { input: plaintext, output: ciphertext },
    },
    {
      title: `Disguise the trigrams with the bigram table: ${indicatorGroups.join(' ')}`,
      detail: `Write ${fillers[0]}${kenngruppe} above ${chosenKey}${fillers[1]} (with two random fillers), take the letters in vertical pairs and replace each pair from the bigram table. The two four-letter groups open the message and are repeated at its end. The real tables were secret and changed regularly; this simulator uses an illustrative one.`,
    },
  )
  return {
    procedure,
    header: `${time} – ${ciphertext.length} –`,
    body,
    messageKey: enciphered,
    steps,
  }
}

export interface ReceivedMessage {
  readonly messageKey: string
  readonly plaintext: string
  readonly steps: readonly ProcedureStep[]
}

export interface ReceiveOptions {
  readonly procedure: ProcedureId
  readonly config: MachineConfig
  /** The header line (army procedures read the start position and indicator from it). */
  readonly header: string
  /** The message text as received, in groups. */
  readonly body: string
  /** Naval only: the day's Grundstellung from the key sheet. */
  readonly grundstellung?: string
  /** Army 1940: whether the text opens with an (unenciphered) identification group. */
  readonly kenngruppe?: boolean
}

/** Reads a radio message: recovers the message key from the indicator, then deciphers the text. */
export function receiveMessage(options: ReceiveOptions): ReceivedMessage {
  const { procedure, config } = options
  const body = lettersOnly(options.body)
  // Header trigrams: three-letter words in the header (time, parts and counts are digits or "TLE"/"TL").
  const trigrams = options.header
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((w) => /^[A-Z]{3}$/.test(w) && w !== 'TLE')
  const steps: ProcedureStep[] = []

  if (procedure === 'doubled-1938') {
    const grund = trigrams[0]
    if (!grund) throw new RangeError('The header should contain the start position, e.g. "WZA".')
    const indicator = body.slice(0, 6)
    const doubled = encipherAt(config, grund, indicator)
    if (doubled.slice(0, 3) !== doubled.slice(3)) {
      throw new RangeError(
        `The indicator ${indicator} deciphers to ${doubled} at ${grund}, which isn't a key typed twice. Check the day's key.`,
      )
    }
    const key = doubled.slice(0, 3)
    const plaintext = encipherAt(config, key, body.slice(6))
    steps.push(
      {
        title: `Decipher the indicator at ${grund}: ${indicator} → ${doubled}`,
        detail: `Set the rotors to the start position from the header and type the first six letters. They come out as the message key twice: ${key}.`,
        setPositions: grund,
        type: { input: indicator, output: doubled },
      },
      {
        title: `Decipher the message at ${key}`,
        detail: `Set the rotors to ${key} and type the rest of the text.`,
        setPositions: key,
        type: { input: body.slice(6), output: plaintext },
      },
    )
    return { messageKey: key, plaintext, steps }
  }

  if (procedure === 'army-1940') {
    const [grund, indicator] = trigrams
    if (!grund || !indicator) {
      throw new RangeError(
        'The header should contain the start position and the enciphered key, e.g. "WXC KCH".',
      )
    }
    const key = encipherAt(config, grund, indicator)
    const text = options.kenngruppe === false ? body : body.slice(5)
    const plaintext = encipherAt(config, key, text)
    steps.push(
      {
        title: `Decipher the message key at ${grund}: ${indicator} → ${key}`,
        detail: `Set the rotors to the start position from the header and type the enciphered key.`,
        setPositions: grund,
        type: { input: indicator, output: key },
      },
      {
        title: `Decipher the message at ${key}`,
        detail:
          options.kenngruppe === false
            ? `Set the rotors to ${key} and type the text.`
            : `Skip the first group (the identification group, never enciphered), set the rotors to ${key} and type the rest.`,
        setPositions: key,
        type: { input: text, output: plaintext },
      },
    )
    return { messageKey: key, plaintext, steps }
  }

  const grund = lettersOnly(options.grundstellung ?? '')
  if (grund.length !== config.rotors.length) {
    throw new RangeError(
      `Enter the day's Grundstellung (${config.rotors.length} letters) from the key sheet.`,
    )
  }
  const { kenngruppe, trigram } = revealIndicator(body.slice(0, 4), body.slice(4, 8))
  const enciphered = encipherAt(config, grund, trigram)
  const start = fullPositions(config, grund, enciphered)
  // The indicator groups open the message and are repeated at its end.
  const text = body.slice(8, body.endsWith(body.slice(0, 8)) && body.length > 16 ? -8 : undefined)
  const plaintext = encipherAt(config, start, text)
  steps.push(
    {
      title: `Undo the bigram table: ${body.slice(0, 4)} ${body.slice(4, 8)} → ${kenngruppe}, ${trigram}`,
      detail: `Look up each vertical pair of the first two groups in the bigram table. The top row holds the key-net trigram ${kenngruppe}, the bottom row the message trigram ${trigram}.`,
    },
    {
      title: `Encipher the message trigram at the Grundstellung: ${trigram} → ${enciphered}`,
      detail: `Set the rotors to the day's Grundstellung ${grund} and type ${trigram}: the message key is ${enciphered}.`,
      setPositions: grund,
      type: { input: trigram, output: enciphered },
    },
    {
      title: `Decipher the message at ${start}`,
      detail: 'Set the rotors and type the text between the indicator groups.',
      setPositions: start,
      type: { input: text, output: plaintext },
    },
  )
  return { messageKey: enciphered, plaintext, steps }
}

// --- Naval bigram tables -------------------------------------------------------------------

/** Small seeded PRNG (mulberry32), so the illustrative table is the same for everyone. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * An illustrative bigram table. Like the real ones it is reciprocal (if AB becomes XY, XY becomes
 * AB) and never maps a pair to itself. The real tables were secret, so this one is invented.
 */
export const BIGRAM_TABLE: ReadonlyMap<string, string> = (() => {
  const random = seeded(1937)
  const pairs = [...ALPHABET].flatMap((a) => [...ALPHABET].map((b) => a + b))
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }
  const table = new Map<string, string>()
  for (let i = 0; i < pairs.length; i += 2) {
    table.set(pairs[i], pairs[i + 1])
    table.set(pairs[i + 1], pairs[i])
  }
  return table
})()

/**
 * The naval indicator: a filler and the key-net trigram on top, the message trigram and a filler
 * below; each vertical pair is replaced from the bigram table; the rows become two 4-letter groups.
 */
export function disguiseIndicator(
  kenngruppe: string,
  trigram: string,
  fillers: string,
): [string, string] {
  const top = fillers[0] + kenngruppe
  const bottom = trigram + fillers[1]
  let row1 = ''
  let row2 = ''
  for (let i = 0; i < 4; i++) {
    const swapped = BIGRAM_TABLE.get(top[i] + bottom[i])!
    row1 += swapped[0]
    row2 += swapped[1]
  }
  return [row1, row2]
}

/** Reverses `disguiseIndicator` (the table is reciprocal). */
export function revealIndicator(
  group1: string,
  group2: string,
): { kenngruppe: string; trigram: string } {
  const [top, bottom] = disguiseIndicator(
    group1.slice(1),
    group2.slice(0, 3),
    group1[0] + group2[3],
  )
  return { kenngruppe: top.slice(1), trigram: bottom.slice(0, 3) }
}
