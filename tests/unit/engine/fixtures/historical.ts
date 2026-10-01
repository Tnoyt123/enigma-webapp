import type { KeySheet } from '../../../../src/engine/index.ts'

export interface HistoricalMessage {
  readonly name: string
  readonly source: string
  readonly key: KeySheet
  /** Rotor positions the message body was enciphered at (the decrypted message key). */
  readonly start: string
  readonly ciphertext: string
  readonly plaintext: string
  /** Optional indicator: enciphered at `grundstellung`, it decrypts to `start`. */
  readonly indicator?: { readonly grundstellung: string; readonly encrypted: string }
}

export const HISTORICAL_MESSAGES: readonly HistoricalMessage[] = [
  {
    name: 'Operation Barbarossa, 7 July 1941 (Enigma I, part 1)',
    source:
      'German Army message, 1840 hrs; published by Frode Weierud (CryptoCellar) and reproduced on Wikipedia.',
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
    name: 'Scharnhorst, 26 December 1943 (Enigma M3)',
    source:
      'Kriegsmarine message from the battleship Scharnhorst; widely used as an M3 test vector.',
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
    name: 'U-534, May 1945 (Enigma M4)',
    source: 'Message recovered from U-534; decrypted in 2006 by the M4 Message Breaking Project.',
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
