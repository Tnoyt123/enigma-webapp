import type { KeySheet } from '../settings.ts'

/** A real wartime message, with the key it was sent on and its published decryption. */
export interface HistoricalMessage {
  readonly id: string
  /** Full name, with date and machine. */
  readonly name: string
  /** Short name for a button. */
  readonly title: string
  readonly date: string
  /** What the message is, in a sentence or two. */
  readonly context: string
  readonly source: string
  readonly key: KeySheet
  /** Rotor positions the message body was enciphered at (the decrypted message key). */
  readonly start: string
  readonly ciphertext: string
  readonly plaintext: string
  /** Optional indicator: enciphered at `grundstellung`, it decrypts to `start`. */
  readonly indicator?: { readonly grundstellung: string; readonly encrypted: string }
  /** The radio header, when it survives. */
  readonly header?: string
}

/**
 * Real messages the machines here decrypt, each checked by the unit tests. Visitors can load
 * any of them, with its key, and decipher it themselves.
 */
export const HISTORICAL_MESSAGES: readonly HistoricalMessage[] = [
  {
    id: 'barbarossa',
    name: 'Operation Barbarossa, 7 July 1941 (Enigma I, part 1)',
    title: 'Operation Barbarossa',
    date: '7 July 1941',
    context:
      'A German Army report from the Eastern Front, two weeks into the invasion of the Soviet Union. This is the first part of a two-part message.',
    source:
      'German Army message, 1840 hrs; published by Frode Weierud (CryptoCellar) and reproduced on Wikipedia.',
    header: '1840 – 2TLE – 1TL – 179 – WXC KCH –',
    key: {
      model: 'I',
      reflector: 'B',
      rotors: 'II IV V',
      rings: '02 21 12',
      plugboard: 'AV BS CG DL FU HZ IN KM OW RX',
    },
    indicator: { grundstellung: 'WXC', encrypted: 'KCH' },
    start: 'BLA',
    ciphertext:
      'EDPUD NRGYS ZRCXN UYTPO MRMBO FKTBZ REZKM LXLVE FGUEY SIOZV EQMIK UBPMM YLKLT TDEIS ' +
      'MDICA GYKUA CTCDO MOHWX MUUIA UBSTS LRNBZ SZWNR FXWFY SSXJZ VIJHI DISHP RKLKA YUPAD ' +
      'TXQSP INQMA TLPIF SVKDA SCTAC DPBOP VHJK',
    plaintext:
      'AUFKLXABTEILUNGXVONXKURTINOWAXKURTINOWAXNORDWESTLXSEBEZXSEBEZXUAFFLIEGERSTRASZERIQTUNG' +
      'XDUBROWKIXDUBROWKIXOPOTSCHKAXOPOTSCHKAXUMXEINSAQTDREINULLXUHRANGETRETENXANGRIFFXINFXRGTX',
  },
  {
    id: 'scharnhorst',
    name: 'Scharnhorst, 1943 (Enigma M3)',
    title: 'Battleship Scharnhorst',
    date: '1943',
    context:
      'A Kriegsmarine signal signed by the battleship Scharnhorst, ordering a course for the Tanafjord in Norway. Its rotors VI and VIII were issued only to the navy.',
    source: 'Kriegsmarine message; widely used as a test message for M3 simulators.',
    key: {
      model: 'M3',
      reflector: 'B',
      rotors: 'III VI VIII',
      rings: '01 08 13',
      plugboard: 'AN EZ HK IJ LR MQ OT PV SW UX',
    },
    start: 'UZV',
    ciphertext:
      'YKAE NZAP MSCH ZBFO CUVM RMDP YCOF HADZ IZME FXTH FLOL PZLF GGBO TGOX GRET DWTJ IQHL MXVJ WKZU ASTR',
    plaintext: 'STEUEREJTANAFJORDJANSTANDORTQUAAACCCVIERNEUNNEUNZWOFAHRTZWONULSMXXSCHARNHORSTHCO',
  },
  {
    id: 'u264',
    name: 'U-264, 25 November 1942 (Enigma M4)',
    title: 'U-boat U-264',
    date: '25 November 1942',
    context:
      'A report from Kapitänleutnant Hartwig Looks of U-264 in the North Atlantic: forced to dive during an attack and depth-charged. Enciphered on the four-rotor M4, it stayed unbroken until 2006.',
    source:
      'One of three intercepted M4 signals solved by the M4 Message Breaking Project in 2006.',
    key: {
      model: 'M4',
      reflector: 'B-thin',
      rotors: 'Beta II IV I',
      rings: 'AAAV',
      plugboard: 'AT BL DF GJ HM NW OP QY RZ VX',
    },
    start: 'VJNA',
    ciphertext:
      'NCZW VUSX PNYM INHZ XMQX SFWX WLKJ AHSH NMCO CCAK UQPM KCSM HKSE INJU SBLK IOSX CKUB HMLL ' +
      'XCSJ USRR DVKO HULX WCCB GVLI YXEO AHXR HKKF VDRE WEZL XOBA FGYU JQUK GRTV UKAM EURB VEKS ' +
      'UHHV OYHA BCJW MAKL FKLM YFVN RIZR VVRT KOFD ANJM OLBG FFLE OPRG TFLV RHOW OPBE KVWM UQFM ' +
      'PWPA RMFH AGKX IIBG',
    plaintext:
      'VONVONJLOOKSJHFFTTTEINSEINSDREIZWOYYQNNSNEUNINHALTXXBEIANGRIFFUNTERWASSERGEDRUECKTYWABOS' +
      'XLETZTERGEGNERSTANDNULACHTDREINULUHRMARQUANTONJOTANEUNACHTSEYHSDREIYZWOZWONULGRADYACHTSMYS' +
      'TOSSENACHXEKNSVIERMBFAELLTYNNNNNNOOOVIERYSICHTEINSNULL',
  },
]
