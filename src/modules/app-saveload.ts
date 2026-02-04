/**
 * @module app-saveload
 * @description Save/Load/Share System - Build persistence with aggressive compression for URL sharing
 *
 * **Features:**
 * - Local Save: Up to 20 builds in localStorage with LZ-String compression
 * - URL Sharing: Deflate + Base91 encoding (70-85% size reduction)
 * - Preset Loading: Load community builds from PresetBuilds.json
 * - Build Title & Memo: Metadata for build organization
 *
 * **Compression Strategy (v2):**
 * 1. Data Optimization:
 *    - ID mapping: Character/Potential/Disc IDs → sequential indices
 *    - Shortened keys: `i` (id), `p` (potentials), `pl` (potential levels), `sl` (skill levels), `pm` (marks)
 *    - Omit defaults: level 1 potentials, level 0 sub discs, empty fields
 *    - Delta encoding: Store differences for sorted keys (prevKey = 0, write key - prevKey)
 *
 * 2. Binary Packing:
 *    - Varint encoding for variable-length integers
 *    - Bit masks for slot presence (6 bits for disc slots, 3 bits for character slots)
 *    - Packed bytes: `((limitBreak & 0x07) << 3) | (subLevel & 0x07)` = 1 byte for both
 *
 * 3. String Compression:
 *    - Small payloads (<24 bytes): Base32768 encoding (raw mode) - 2 bytes per char
 *    - Large payloads: Deflate level 9 → Base91 encoding (deflate mode)
 *    - Choose best: Compare sizes, use smaller result
 *
 * **Results:** 200 bytes → 50 bytes (char-only), 800 → 200 (full build)
 *
 * **URL Format:**
 * - v2r-{base32768} = Raw binary (small builds)
 * - v2d-{base91} = Deflated binary (large builds)
 * - Legacy: LZ-String (backwards compatible)
 *
 * @see {@link https://github.com/JforPlay/sstoy} - Project Repository
 */

import { fetchJSON, log, onLanguageChange, showToast } from '../shared';
import { GameData } from '../shared/game-data';
import type { Position, MainTab, PotentialMark, Disc } from '../types';
import * as LZString from 'lz-string';
import * as fflate from 'fflate';

type CompressionLib = Pick<typeof fflate, 'deflateSync' | 'inflateSync' | 'strToU8' | 'strFromU8'>;

// =============================================================================
// TYPES
// =============================================================================

interface BuildState {
  buildTitle: string;
  buildMemo: string;
}

interface CharacterBuildData {
  i: string; // character ID
  p: number[]; // selected potentials
  pl: Record<number, number>; // potential levels (non-1 only)
  sl?: Record<number, number>; // skill levels (non-1 only)
  pm: Record<number, string>; // potential marks
}

interface DiscBuildData {
  s: Record<string, number>; // selected disc IDs
  l: Record<string, number>; // limit breaks (non-1 only)
  g: Record<string, number>; // sub disc levels/growth (non-0 only)
}

interface NotesBuildData {
  r: string[]; // required notes
  a: Record<string, number>; // acquired notes (non-0 only)
}

interface BuildData {
  v: string; // version
  t?: number; // timestamp
  n: string; // name/title
  m?: string; // memo
  c?: {
    m?: CharacterBuildData | null;
    a1?: CharacterBuildData | null;
    a2?: CharacterBuildData | null;
  };
  d?: DiscBuildData | null;
  nt?: NotesBuildData | null;
}

interface PresetData {
  presets: Array<{
    id: string;
    title: string;
    buildHash?: string;
    buildUrl?: string;
    [key: string]: unknown;
  }>;
  elements?: Record<string, unknown>;
}

interface IdMaps {
  charMap: { toIdx: Map<number, number>; fromIdx: Record<number, number> };
  potMap: { toIdx: Map<number, number>; fromIdx: Record<number, number> };
  discMap: { toIdx: Map<number, number>; fromIdx: Record<number, number> };
}

// Note: getIcon is available on window object

// =============================================================================
// CONSTANTS
// =============================================================================

const LOCALSTORAGE_KEY = 'sstoy_builds';
const MAX_SAVED_BUILDS = 20;
const COOLDOWN_MS = 3000;

const SHARE_VERSION = 3;
const SHARE_PREFIX_RAW = 'v3r-';
const SHARE_PREFIX_DEFLATE = 'v3d-';

// Legacy v2 prefixes for backward compatibility
const LEGACY_V2_PREFIX_RAW = 'v2r-';
const LEGACY_V2_PREFIX_DEFLATE = 'v2d-';

// Frozen character ID list as of BEFORE commit edc23466 (data update 2/3)
// This is used to decode legacy v2 URLs correctly
const LEGACY_V2_CHAR_IDS = [
  103, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
  123, 125, 126, 127, 129, 130, 132, 133, 134, 135, 136, 141, 142, 143, 144, 145,
  147, 149, 150, 155, 156, 158, 159
];

// Frozen potential ID list as of BEFORE commit edc23466 (data update 2/3)
// Generated from: git show edc23466^:public/data/Potential.json | grep -oE '"[0-9]+":\s*\{' | grep -oE '[0-9]+' | sort -n
const LEGACY_V2_POT_IDS = [
  510301,510302,510303,510304,510305,510306,510307,510308,510309,510310,510311,510312,510313,510321,510322,510323,510324,510325,510326,510327,510328,510329,510330,510331,510332,510333,510341,510342,510343,
  510701,510702,510703,510704,510705,510706,510707,510708,510709,510710,510711,510712,510713,510721,510722,510723,510724,510725,510726,510727,510728,510729,510730,510731,510732,510733,510741,510742,510743,
  510801,510802,510803,510804,510805,510806,510807,510808,510809,510810,510811,510812,510813,510821,510822,510823,510824,510825,510826,510827,510828,510829,510830,510831,510832,510833,510841,510842,510843,
  511001,511002,511003,511004,511005,511006,511007,511008,511009,511010,511011,511012,511013,511021,511022,511023,511024,511025,511026,511027,511028,511029,511030,511031,511032,511033,511041,511042,511043,
  511101,511102,511103,511104,511105,511106,511107,511108,511109,511110,511111,511112,511113,511121,511122,511123,511124,511125,511126,511127,511128,511129,511130,511131,511132,511133,511141,511142,511143,
  511201,511202,511203,511204,511205,511206,511207,511208,511209,511210,511211,511212,511213,511221,511222,511223,511224,511225,511226,511227,511228,511229,511230,511231,511232,511233,511241,511242,511243,
  511301,511302,511303,511304,511305,511306,511307,511308,511309,511310,511311,511312,511313,511321,511322,511323,511324,511325,511326,511327,511328,511329,511330,511331,511332,511333,511341,511342,511343,
  511401,511402,511403,511404,511405,511406,511407,511408,511409,511410,511411,511412,511413,511421,511422,511423,511424,511425,511426,511427,511428,511429,511430,511431,511432,511433,511441,511442,511443,
  511501,511502,511503,511504,511505,511506,511507,511508,511509,511510,511511,511512,511513,511521,511522,511523,511524,511525,511526,511527,511528,511529,511530,511531,511532,511533,511541,511542,511543,
  511601,511602,511603,511604,511605,511606,511607,511608,511609,511610,511611,511612,511613,511621,511622,511623,511624,511625,511626,511627,511628,511629,511630,511631,511632,511633,511641,511642,511643,
  511701,511702,511703,511704,511705,511706,511707,511708,511709,511710,511711,511712,511713,511721,511722,511723,511724,511725,511726,511727,511728,511729,511730,511731,511732,511733,511741,511742,511743,
  511801,511802,511803,511804,511805,511806,511807,511808,511809,511810,511811,511812,511813,511821,511822,511823,511824,511825,511826,511827,511828,511829,511830,511831,511832,511833,511841,511842,511843,
  511901,511902,511903,511904,511905,511906,511907,511908,511909,511910,511911,511912,511913,511921,511922,511923,511924,511925,511926,511927,511928,511929,511930,511931,511932,511933,511941,511942,511943,
  512001,512002,512003,512004,512005,512006,512007,512008,512009,512010,512011,512012,512013,512021,512022,512023,512024,512025,512026,512027,512028,512029,512030,512031,512032,512033,512041,512042,512043,
  512301,512302,512303,512304,512305,512306,512307,512308,512309,512310,512311,512312,512313,512321,512322,512323,512324,512325,512326,512327,512328,512329,512330,512331,512332,512333,512341,512342,512343,
  512501,512502,512503,512504,512505,512506,512507,512508,512509,512510,512511,512512,512513,512521,512522,512523,512524,512525,512526,512527,512528,512529,512530,512531,512532,512533,512541,512542,512543,
  512601,512602,512603,512604,512605,512606,512607,512608,512609,512610,512611,512612,512613,512621,512622,512623,512624,512625,512626,512627,512628,512629,512630,512631,512632,512633,512641,512642,512643,
  512701,512702,512703,512704,512705,512706,512707,512708,512709,512710,512711,512712,512713,512721,512722,512723,512724,512725,512726,512727,512728,512729,512730,512731,512732,512733,512741,512742,512743,
  513001,513002,513003,513004,513005,513006,513007,513008,513009,513010,513011,513012,513013,513021,513022,513023,513024,513025,513026,513027,513028,513029,513030,513031,513032,513033,513041,513042,513043,
  513201,513202,513203,513204,513205,513206,513207,513208,513209,513210,513211,513212,513213,513221,513222,513223,513224,513225,513226,513227,513228,513229,513230,513231,513232,513233,513241,513242,513243,
  513301,513302,513303,513304,513305,513306,513307,513308,513309,513310,513311,513312,513313,513321,513322,513323,513324,513325,513326,513327,513328,513329,513330,513331,513332,513333,513341,513342,513343,
  513401,513402,513403,513404,513405,513406,513407,513408,513409,513410,513411,513412,513413,513421,513422,513423,513424,513425,513426,513427,513428,513429,513430,513431,513432,513433,513441,513442,513443,
  513501,513502,513503,513504,513505,513506,513507,513508,513509,513510,513511,513512,513513,513521,513522,513523,513524,513525,513526,513527,513528,513529,513530,513531,513532,513533,513541,513542,513543,
  513601,513602,513603,513604,513605,513606,513607,513608,513609,513610,513611,513612,513613,513621,513622,513623,513624,513625,513626,513627,513628,513629,513630,513631,513632,513633,513641,513642,513643,
  514101,514102,514103,514104,514105,514106,514107,514108,514109,514110,514111,514112,514113,514121,514122,514123,514124,514125,514126,514127,514128,514129,514130,514131,514132,514133,514141,514142,514143,
  514201,514202,514203,514204,514205,514206,514207,514208,514209,514210,514211,514212,514213,514221,514222,514223,514224,514225,514226,514227,514228,514229,514230,514231,514232,514233,514241,514242,514243,
  514301,514302,514303,514304,514305,514306,514307,514308,514309,514310,514311,514312,514313,514321,514322,514323,514324,514325,514326,514327,514328,514329,514330,514331,514332,514333,514341,514342,514343,
  514401,514402,514403,514404,514405,514406,514407,514408,514409,514410,514411,514412,514413,514421,514422,514423,514424,514425,514426,514427,514428,514429,514430,514431,514432,514433,514441,514442,514443,
  514501,514502,514503,514504,514505,514506,514507,514508,514509,514510,514511,514512,514513,514521,514522,514523,514524,514525,514526,514527,514528,514529,514530,514531,514532,514533,514541,514542,514543,
  514701,514702,514703,514704,514705,514706,514707,514708,514709,514710,514711,514712,514713,514721,514722,514723,514724,514725,514726,514727,514728,514729,514730,514731,514732,514733,514741,514742,514743,
  514901,514902,514903,514904,514905,514906,514907,514908,514909,514910,514911,514912,514913,514921,514922,514923,514924,514925,514926,514927,514928,514929,514930,514931,514932,514933,514941,514942,514943,
  515001,515002,515003,515004,515005,515006,515007,515008,515009,515010,515011,515012,515013,515021,515022,515023,515024,515025,515026,515027,515028,515029,515030,515031,515032,515033,515041,515042,515043,
  515501,515502,515503,515504,515505,515506,515507,515508,515509,515510,515511,515512,515513,515521,515522,515523,515524,515525,515526,515527,515528,515529,515530,515531,515532,515533,515541,515542,515543,
  515601,515602,515603,515604,515605,515606,515607,515608,515609,515610,515611,515612,515613,515621,515622,515623,515624,515625,515626,515627,515628,515629,515630,515631,515632,515633,515641,515642,515643,
  515801,515802,515803,515804,515805,515806,515807,515808,515809,515810,515811,515812,515813,515821,515822,515823,515824,515825,515826,515827,515828,515829,515830,515831,515832,515833,515841,515842,515843,
  515901,515902,515903,515904,515905,515906,515907,515908,515909,515910,515911,515912,515913,515921,515922,515923,515924,515925,515926,515927,515928,515929,515930,515931,515932,515933,515941,515942,515943
];
const SHARE_POSITIONS = ['m', 'a1', 'a2'] as const;
const DISC_SLOTS = ['main1', 'main2', 'main3', 'sub1', 'sub2', 'sub3'] as const;
const BASE91_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';
const BASE32768_CHARS = [...'𠀀𠂊𠄓𠆢𠈕𠊧𠌫𠎭𠐻𠒄𠔓𠖻𠘨𠚺𠜎𠞩𠠻𠢹𠤼𠦿𠩂𠫅𠭇𠯉𠱋𠳍𠵏𠷑𠹓𠻕𠽗𠿙𡁛𡃝𡅟𡇡𡉣𡋥𡍧𡏩𡑫𡓭𡕯𡗱𡙳𡛵𡝷𡟹𡡻𡣽𡥿𡨁𡪃𡬅𡮇𡰉𡲋𡴍𡶏𡸑𡺓𡼕𡾗𢀙𢂛𢄝𢆟𢈡𢊣𢋥𢎧𢐩𢒫𢔭𢖯𢘱𢚳𢜵𢞷𢠹𢢻𢤽𢦿𢨁𢪃𢬅𢮇𢰉𢲋𢴍𢶏𢸑𢺓𢼕𢾗𣀙𣂛𣄝𣆟𣈡𣊣𣌥𣎧𣐩𣒫𣔭𣖯𣘱𣚳𣜵𣞷𣠹𣢻𣤽𣦿𣨁𣪃𣬅𣮇𣰉𣲋𣴍𣶏𣸑𣺓𣼕𣾗𤀙𤂛𤄝𤆟𤈡𤊣𤌥𤎧𤐩𤒫𤔭𤖯𤘱𤚳𤜵𤞷𤠹𤢻𤤽𤦿𤨁𤪃𤬅𤮇𤰉𤲋𤴍𤶏𤸑𤺓𤼕𤾗𥀙𥂛𥄝𥆟𥈡𥊣𥌥𥎧𥐩𥒫𥔭𥖯𥘱𥚳𥜵𥞷𥠹𥢻𥤽𥦿𥨁𥪃𥬅𥮇𥰉𥲋𥴍𥶏𥸑𥺓𥼕𥾗𦀙𦂛𦄝𦆟𦈡𦊣𦌥𦎧𦐩𦒫𦔭𦖯𦘱𦚳𦜵𦞷𦠹𦢻𦤽𦦿𦨁𦪃𦬅𦮇𦰉𦲋𦴍𦶏𦸑𦺓𦼕𦾗𧀙𧂛𧄝𧆟𧈡𧊣𧌥𧎧𧐩𧒫𧔭𧖯𧘱𧚳𧜵𧞷𧠹𧢻𧤽𧦿𧨁𧪃𧬅𧮇𧰉𧲋𧴍𧶏𧸑𧺓𧼕𧾗𨀙𨂛𨄝𨆟𨈡𨊣𨌥𨎧𨐩𨒫𨔭𨖯𨘱𨚳𨜵𨞷𨠹𨢻𨤽𨦿𨨁𨪃𨬅𨮇𨰉𨲋𨴍𨶏𨸑𨺓𨼕𨾗𩀙𩂛𩄝𩆟𩈡𩊣𩌥𩎧𩐩𩒫𩔭𩖯𩘱𩚳𩜵𩞷𩠹𩢻𩤽𩦿𩨁𩪃𩬅𩮇𩰉𩲋𩴍𩶏𩸑𩺓𩼕𩾗𪀙𪂛𪄝𪆟𪈡𪊣𪌥𪎧𪐩𪒫𪔭𪖯𪘱𪚳𪜵𪞷𪠹𪢻𪤽𪦿𪨁𪪃𪬅𪮇𪰉𪲋𪴍𪶏𪸑𪺓𪼕𪾗𫀙𫂛𫄝𫆟𫈡𫊣𫌥𫎧𫐩𫒫𫔭𫖯𫘱𫚳𫜵𫞷𫠹𫢻𫤽𫦿𫨁𫪃𫬅𫮇𫰉𫲋𫴍𫶏𫸑𫺓𫼕𫾗𬀙𬂛𬄝𬆟𬈡𬊣𬌥𬎧𬐩𬒫𬔭𬖯𬘱𬚳𬜵𬞷𬠹𬢻𬤽𬦿𬨁𬪃𬬅𬮇𬰉𬲋𬴍𬶏𬸑𬺓𬼕𬾗𭀙𭂛𭄝𭆟𭈡𭊣𭌥𭎧𭐩𭒫𭔭𭕯𭘱𭚳𭜵𭞷𭠹𭢻𭤽𭦿𭨁𭪃𭬅𭮇𭰉𭲋𭴍𭶏𭸑𭺓𭼕𭾗𮀙𮂛𮄝𮆟𮈡𮊣𮌥𮎧𮐩𮒫𮤭𮖯𮘱𮚳𮜵𮞷𮠹𮢻𮤽𮦿𮨁𮪃𮬅𮮇𮰉𮲋𮴍𮶏𮸑𮺓𮼕𮾗𯀙𯂛𯄝𯆟𯈡𯊣𯌥𯎧𯐩𯒫𯔭𯖯𯘱𯚳𯜵𯞷叫捨𥁄䗗𩖶𯪃𯬅𯮇𯰉𯲋𯴍𯶏𯸑𯺓𯼕𯾗'];

const MARK_CODES: Record<string, number> = {
  '필수': 1,
  'essential': 1,
  '후순위': 2,
  'low': 2,
  '다다익선': 3,
  'recommended': 3,
  '명함만': 4,
  'minimum': 4,
};

// =============================================================================
// STATE
// =============================================================================

let saveCooldownEnd = 0;
let shareCooldownEnd = 0;

export const buildState: BuildState = {
  buildTitle: '',
  buildMemo: '',
};

// Resolve compression library once to avoid optional globals
const compressionLib: CompressionLib = (() => {
  const lib = (typeof window !== 'undefined' ? window.fflate ?? fflate : fflate) as CompressionLib;
  if (typeof window !== 'undefined' && !window.fflate) {
    window.fflate = lib;
  }
  return lib;
})();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function canUseCompression(): boolean {
  return (
    typeof compressionLib.deflateSync === 'function' &&
    typeof compressionLib.inflateSync === 'function' &&
    typeof compressionLib.strToU8 === 'function' &&
    typeof compressionLib.strFromU8 === 'function'
  );
}

function toNum(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function stringToBytes(str: string): Uint8Array {
  if (!str) return new Uint8Array(0);
  if (canUseCompression()) {
    return compressionLib.strToU8(str);
  }
  return new TextEncoder().encode(str);
}

function bytesToString(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return '';
  if (canUseCompression()) {
    return compressionLib.strFromU8(bytes);
  }
  return new TextDecoder().decode(bytes);
}


// =============================================================================
// ENCODING UTILITIES
// =============================================================================

function base91Encode(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return '';
  let b = 0;
  let n = 0;
  let output = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    b |= byte << n;
    n += 8;
    if (n > 13) {
      let v = b & 8191;
      if (v > 88) {
        b >>= 13;
        n -= 13;
      } else {
        v = b & 16383;
        b >>= 14;
        n -= 14;
      }
      output += (BASE91_CHARS[v % 91] || '') + (BASE91_CHARS[Math.floor(v / 91)] || '');
    }
  }
  if (n) {
    const char1 = BASE91_CHARS[b % 91];
    const char2 = BASE91_CHARS[Math.floor(b / 91)];
    output += char1 || '';
    if ((n > 7 || b > 90) && char2) {
      output += char2;
    }
  }
  return output;
}

function base91Decode(str: string): Uint8Array {
  if (!str) return new Uint8Array(0);
  let b = 0;
  let n = 0;
  let v = -1;
  const output: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (!char) continue;
    const p = BASE91_CHARS.indexOf(char);
    if (p === -1) continue;
    if (v < 0) {
      v = p;
    } else {
      v += p * 91;
      b |= v << n;
      n += (v & 8191) > 88 ? 13 : 14;
      while (n > 7) {
        output.push(b & 255);
        b >>= 8;
        n -= 8;
      }
      v = -1;
    }
  }
  if (v >= 0) {
    output.push((b | (v << n)) & 255);
  }
  return new Uint8Array(output);
}

function base32768Encode(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return '';
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    const hi = bytes[i];
    const lo = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    if (hi === undefined) continue;
    const code = (hi << 8) | lo;
    out += BASE32768_CHARS[code];
  }
  return out;
}

function base32768Decode(str: string): Uint8Array {
  if (!str) return new Uint8Array(0);
  const map = new Map<string, number>();
  BASE32768_CHARS.forEach((ch, idx) => map.set(ch, idx));
  const bytes: number[] = [];
  for (const ch of str) {
    const code = map.get(ch);
    if (code === undefined) continue;
    bytes.push((code >> 8) & 0xff, code & 0xff);
  }
  return new Uint8Array(bytes);
}

function writeVarint(target: number[], value: number): void {
  let val = value >>> 0;
  while (val >= 0x80) {
    target.push((val & 0x7f) | 0x80);
    val >>>= 7;
  }
  target.push(val);
}

function readVarint(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < bytes.length) {
    const byte = bytes[pos++];
    if (byte === undefined) break;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value: result >>> 0, next: pos };
    }
    shift += 7;
  }
  throw new Error('Invalid varint');
}

// =============================================================================
// DATA COLLECTION
// =============================================================================

function collectCharacterData(position: Position): CharacterBuildData | null {
  const character = window.state?.party?.[position];
  if (!character) return null;

  const skillLevels: Record<number, number> = {};
  const rawSkillLevels = window.state.skillLevels[position] || {};
  Object.keys(rawSkillLevels).forEach((skillId) => {
    const level = rawSkillLevels[Number(skillId)];
    if (level && level !== 1) {
      skillLevels[Number(skillId)] = level;
    }
  });

  const potentialLevels: Record<number, number> = {};
  const rawPotentialLevels = window.state.potentialLevels[position] || {};
  Object.keys(rawPotentialLevels).forEach((potId) => {
    const level = rawPotentialLevels[Number(potId)];
    if (level && level !== 1) {
      potentialLevels[Number(potId)] = level;
    }
  });

  const potentialMarks: Record<number, string> = {};
  const rawPotentialMarks = window.state.potentialMarks?.[position] || {};
  Object.keys(rawPotentialMarks).forEach((potId) => {
    const mark = rawPotentialMarks[Number(potId)];
    if (mark && mark !== null) {
      potentialMarks[Number(potId)] = mark as string;
    }
  });



  return {
    i: character.id,
    p: window.state.selectedPotentials[position] || [],
    pl: potentialLevels,
    sl: Object.keys(skillLevels).length > 0 ? skillLevels : undefined,
    pm: potentialMarks,
  };
}

function collectDiscData(): DiscBuildData | null {
  const discsState = window.discsState;
  if (!discsState) return null;

  const selectedDiscIds: Record<string, number> = {};
  const rawSelectedDiscs = discsState.selectedDiscs || {};
  Object.keys(rawSelectedDiscs).forEach((slotId) => {
    const disc = (rawSelectedDiscs as Record<string, any>)[slotId];
    if (disc && disc.Id) {
      selectedDiscIds[slotId] = disc.Id;
    }
  });

  const limitBreaks: Record<string, number> = {};
  const rawLimitBreaks = discsState.discLimitBreaks || {};
  Object.keys(rawLimitBreaks).forEach((slotId) => {
    const level = (rawLimitBreaks as Record<string, any>)[slotId];
    if (level && level !== 1) {
      limitBreaks[slotId] = level;
    }
  });

  const subDiscLevels: Record<string, number> = {};
  const rawSubLevels = discsState.subDiscLevels || {};
  Object.keys(rawSubLevels).forEach((slotId) => {
    const level = (rawSubLevels as Record<string, any>)[slotId];
    if (level && level !== 0) {
      subDiscLevels[slotId] = level;
    }
  });

  return {
    s: selectedDiscIds,
    l: limitBreaks,
    g: subDiscLevels,
  };
}

function collectNotesData(): NotesBuildData | null {
  const discsState = window.discsState;
  if (!discsState) return null;

  const requiredNotes = Array.from(discsState.requiredNotes || []);

  const acquiredNotes: Record<string, number> = {};
  const rawAcquiredNotes = discsState.acquiredNotes || {};
  Object.keys(rawAcquiredNotes).forEach((noteId) => {
    const count = rawAcquiredNotes[noteId];
    if (count && count > 0) {
      acquiredNotes[noteId] = count;
    }
  });

  return {
    r: requiredNotes,
    a: acquiredNotes,
  };
}

function collectBuildData(): BuildData {
  return {
    v: '1.0',
    t: Date.now(),
    n: buildState.buildTitle,
    m: buildState.buildMemo,
    c: {
      m: collectCharacterData('master'),
      a1: collectCharacterData('assist1'),
      a2: collectCharacterData('assist2'),
    },
    d: collectDiscData(),
    nt: collectNotesData(),
  };
}

// =============================================================================
// DATA RESTORATION
// =============================================================================

async function restoreCharactersData(
  charactersData: NonNullable<BuildData['c']>
): Promise<void> {
  const positions: Record<string, Position> = {
    m: 'master',
    a1: 'assist1',
    a2: 'assist2',
  };

  for (const [shortKey, position] of Object.entries(positions)) {
    const charData = charactersData[shortKey as keyof typeof charactersData];

    if (charData) {
      const charId = charData.i;

      if (charId) {
        const character = GameData.characters[charId];
        if (character) {
          const nameKey = character.Name || '';
          const name = GameData.charactersKR[nameKey] || nameKey;

          window.state.party[position] = {
            id: charId,
            name: name,
            data: character,
          };

          const selectedPotentials = charData.p || [];
          window.state.selectedPotentials[position] = selectedPotentials;

          const savedPotentialLevels = charData.pl || {};
          const potentialLevels: Record<number, number> = {};
          selectedPotentials.forEach((potId) => {
            potentialLevels[potId] = savedPotentialLevels[potId] || 1;
          });
          window.state.potentialLevels[position] = potentialLevels;

          const savedSkillLevels = charData.sl || {};
          const skillLevels: Record<number, number> = {};
          const isMaster = position === 'master';
          const skillKeys = isMaster
            ? ['NormalAtkId', 'SkillId', 'UltimateId', 'DodgeId', 'SpecialSkillId']
            : ['AssistSkillId'];

          skillKeys.forEach((key) => {
            const skillId = character[key as keyof typeof character] as number | undefined;
            if (skillId) {
              skillLevels[skillId] = savedSkillLevels[skillId] || 1;
            }
          });
          window.state.skillLevels[position] = skillLevels;

          if (!window.state.potentialMarks) {
            window.state.potentialMarks = {} as Record<Position, Record<number, PotentialMark>>;
          }
          window.state.potentialMarks[position] = (charData.pm || {}) as Record<number, PotentialMark>;
        }
      }
    } else {
      window.state.party[position] = null;
      window.state.selectedPotentials[position] = [];
      window.state.potentialLevels[position] = {};
      window.state.skillLevels[position] = {};
      if (!window.state.potentialMarks) {
        window.state.potentialMarks = {} as Record<Position, Record<number, PotentialMark>>;
      }
      window.state.potentialMarks[position] = {};
    }
  }
}

function restoreDiscsData(discsData: DiscBuildData | null | undefined): void {
  const discsState = window.discsState;
  if (!discsState) return;

  const selectedDiscs: Record<string, Disc | null> = {
    main1: null,
    main2: null,
    main3: null,
    sub1: null,
    sub2: null,
    sub3: null,
  };

  const savedData = discsData?.s || {};

  Object.keys(savedData).forEach((slotId) => {
    const data = savedData[slotId];
    if (!data) return;

    let discId: number;
    if (typeof data === 'number') {
      discId = data;
    } else if (typeof data === 'object' && (data as { Id?: number }).Id) {
      discId = (data as { Id: number }).Id;
    } else {
      return;
    }

    const fullDiscObject = discsState.allDiscs?.find((d) => d.Id === discId);
    if (fullDiscObject) {
      selectedDiscs[slotId] = fullDiscObject;
    }
  });

  discsState.selectedDiscs = selectedDiscs;

  const limitBreaks: Record<string, number> = {
    main1: 1,
    main2: 1,
    main3: 1,
    sub1: 1,
    sub2: 1,
    sub3: 1,
  };

  const savedLimitBreaks = discsData?.l || {};
  Object.keys(selectedDiscs).forEach((slotId) => {
    if (slotId.startsWith('main')) {
      limitBreaks[slotId] = savedLimitBreaks[slotId] || 1;
    }
  });
  discsState.discLimitBreaks = limitBreaks;

  const subLevels: Record<string, number> = {
    sub1: 0,
    sub2: 0,
    sub3: 0,
  };

  const savedSubLevels = discsData?.g || {};
  Object.keys(selectedDiscs).forEach((slotId) => {
    if (slotId.startsWith('sub')) {
      subLevels[slotId] = savedSubLevels[slotId] || 0;
    }
  });
  discsState.subDiscLevels = {
    sub1: subLevels['sub1'] || 0,
    sub2: subLevels['sub2'] || 0,
    sub3: subLevels['sub3'] || 0,
  };
}

function restoreNotesData(notesData: NotesBuildData | null | undefined): void {
  const discsState = window.discsState;
  if (!discsState) return;

  if (!notesData) {
    discsState.requiredNotes = new Set();
    discsState.acquiredNotes = {};
    return;
  }

  if (notesData.r) {
    discsState.requiredNotes = new Set(notesData.r);
  }

  if (notesData.a) {
    discsState.acquiredNotes = { ...notesData.a };
  }
}

function refreshAllDisplays(): void {
  const positions: Position[] = ['master', 'assist1', 'assist2'];
  positions.forEach((position) => {
    if (typeof window.updateCharacterCard === 'function') {
      window.updateCharacterCard(position);
    }
    if (typeof window.updatePotentialsDisplay === 'function') {
      window.updatePotentialsDisplay(position);
    }
  });

  if (typeof window.updateRequiredNotes === 'function') {
    window.updateRequiredNotes();
  }

  if (typeof window.renderDiscs === 'function') {
    window.renderDiscs();
  }

  if (typeof window.switchMainTab === 'function') {
    window.switchMainTab('summary');
  }

  if (typeof window.renderSummary === 'function') {
    setTimeout(() => {
      window.renderSummary?.();
    }, 100);
  }
}

async function restoreBuildData(data: BuildData | undefined): Promise<void> {
  if (!data) {
    throw new Error('Invalid build data format');
  }

  const buildTitle = data.n || (window.i18n?.t('builder.newBuild') || 'New Build');
  const buildMemo = data.m || '';

  try {
    buildState.buildTitle = buildTitle;
    buildState.buildMemo = buildMemo;
    updateBuildTitleDisplay();

    if (data.c) {
      await restoreCharactersData(data.c);
    }

    restoreDiscsData(data.d);
    restoreNotesData(data.nt);
    refreshAllDisplays();

    showToast(window.i18n?.t('saveload.buildLoaded') || 'Build loaded successfully!', 'success');
  } catch (error) {
    console.error('Error restoring build data:', error);
    throw error;
  }
}

// =============================================================================
// LOCAL STORAGE OPERATIONS
// =============================================================================

/**
 * Retrieve saved builds from localStorage
 *
 * @returns {BuildData[]} Array of saved builds
 *
 * @description
 * Reads builds from localStorage with LZ-String decompression.
 * Handles both compressed (new) and plain JSON (legacy) formats.
 */
function getLocalStorageBuilds(): BuildData[] {
  try {
    const data = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!data) return [];

    try {
      const decompressed = LZString.decompress(data);
      if (decompressed) {
        return JSON.parse(decompressed);
      }
    } catch {
      // Not compressed, try as plain JSON
    }

    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return [];
  }
}

/**
 * Save current build to localStorage (max 20 builds)
 *
 * @returns {void}
 *
 * @description
 * Collects current build data and saves to localStorage:
 * 1. Check cooldown (3 seconds between saves)
 * 2. Collect build data (characters, discs, notes, title, memo)
 * 3. Add to beginning of builds array
 * 4. Trim to MAX_SAVED_BUILDS (20)
 * 5. Compress with LZ-String and save
 * 6. Start cooldown timer on Save button
 *
 * @example
 * ```typescript
 * saveToLocalStorage();
 * // Build saved, toast shown, cooldown started
 * ```
 */
export function saveToLocalStorage(): void {
  const now = Date.now();
  if (now < saveCooldownEnd) {
    const remaining = Math.ceil((saveCooldownEnd - now) / 1000);
    const msg = (
      window.i18n?.t('saveload.cooldownMessage') ||
      'Please try again in ${remaining} seconds.'
    ).replace('${remaining}', String(remaining));
    showToast(msg, 'info');
    return;
  }

  try {
    const buildData = collectBuildData();
    let builds = getLocalStorageBuilds();

    builds.unshift(buildData);

    if (builds.length > MAX_SAVED_BUILDS) {
      builds = builds.slice(0, MAX_SAVED_BUILDS);
    }

    const json = JSON.stringify(builds);
    const compressed = LZString.compress(json);
    localStorage.setItem(LOCALSTORAGE_KEY, compressed);

    const displayTitle = buildData.n || (window.i18n?.t('builder.newBuild') || 'New Build');
    const msg = (
      window.i18n?.t('saveload.buildSaved') || 'Build "${title}" saved!'
    ).replace('${title}', displayTitle);
    showToast(msg, 'success');

    saveCooldownEnd = now + COOLDOWN_MS;
    updateButtonCooldown('save-btn', saveCooldownEnd);

    const loadModal = document.getElementById('load-modal');
    if (loadModal?.classList.contains('active')) {
      renderLoadList();
    }
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    showToast(window.i18n?.t('saveload.saveFailed') || 'Failed to save build.', 'error');
  }
}

export function loadFromLocalStorage(index: number): void {
  try {
    const builds = getLocalStorageBuilds();
    if (index >= 0 && index < builds.length) {
      const buildData = builds[index];
      restoreBuildData(buildData);
      closeLoadModal();
    } else {
      throw new Error('Invalid build index');
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    showToast(window.i18n?.t('saveload.loadFailed') || 'Failed to load build.', 'error');
  }
}

export function deleteFromLocalStorage(index: number): void {
  try {
    const builds = getLocalStorageBuilds();
    if (index >= 0 && index < builds.length) {
      const deletedBuild = builds[index];
      const deletedTitle = deletedBuild?.n || (window.i18n?.t('saveload.noTitle') || 'Untitled');
      builds.splice(index, 1);

      const json = JSON.stringify(builds);
      const compressed = LZString.compress(json);
      localStorage.setItem(LOCALSTORAGE_KEY, compressed);

      const msg = (
        window.i18n?.t('saveload.buildDeleted') || 'Build "${title}" deleted.'
      ).replace('${title}', deletedTitle);
      showToast(msg, 'success');
      renderLoadList();
    }
  } catch (error) {
    console.error('Error deleting from localStorage:', error);
    showToast(window.i18n?.t('saveload.deleteFailed') || 'Failed to delete build.', 'error');
  }
}

// =============================================================================
// URL SHARING (SIMPLIFIED)
// =============================================================================

/**
 * Build ID maps for encoding/decoding
 * @param useLegacyV2 - If true, use frozen legacy maps for v2 URL decoding
 */
function buildIdMaps(useLegacyV2 = false): IdMaps {
  function makeMap(ids: number[]): { toIdx: Map<number, number>; fromIdx: Record<number, number> } {
    const sorted = Array.from(new Set(ids)).sort((a, b) => a - b);
    const toIdx = new Map<number, number>();
    const fromIdx: Record<number, number> = {};
    sorted.forEach((id, i) => {
      const idx = i + 1;
      toIdx.set(id, idx);
      fromIdx[idx] = id;
    });
    return { toIdx, fromIdx };
  }

  // For legacy v2 decoding, use frozen character and potential ID lists
  const charIds = useLegacyV2
    ? LEGACY_V2_CHAR_IDS
    : GameData.characters
      ? Object.keys(GameData.characters).map(toNum)
      : [];
  const potIds = useLegacyV2
    ? LEGACY_V2_POT_IDS
    : GameData.potentials
      ? Object.keys(GameData.potentials).map(toNum)
      : [];
  const discIds = window.discsState?.allDiscs
    ? window.discsState.allDiscs.map((d) => toNum(d.Id))
    : [];

  return {
    charMap: makeMap(charIds),
    potMap: makeMap(potIds),
    discMap: makeMap(discIds),
  };
}

function encodeMark(mark: string): number {
  return MARK_CODES[mark] || 0;
}

function decodeMark(code: number): string {
  const entry = Object.entries(MARK_CODES).find(([, v]) => v === code);
  return entry ? entry[0] : '';
}

/**
 * Pack build data into binary payload (v3 format - stores actual IDs)
 * V3 stores actual IDs directly instead of indices to prevent issues when new characters are added
 */
function packSharePayload(cleanedData: BuildData): Uint8Array {
  const writer: number[] = [];

  writeVarint(writer, SHARE_VERSION);

  const nameBytes = stringToBytes(cleanedData.n || '');
  writeVarint(writer, nameBytes.length);
  for (let i = 0; i < nameBytes.length; i++) {
    const byte = nameBytes[i];
    if (byte !== undefined) writer.push(byte);
  }

  const chars = cleanedData.c || {};
  let slotMask = 0;
  if (chars.m) slotMask |= 1;
  if (chars.a1) slotMask |= 2;
  if (chars.a2) slotMask |= 4;
  writer.push(slotMask & 0xff);

  function packCharacter(charData: CharacterBuildData): void {
    // V3: Store actual character ID directly (no mapping)
    writeVarint(writer, Number(charData.i));

    const potentials = Array.isArray(charData.p) ? [...charData.p] : [];
    // Note: Don't sort - preserve user's custom potential order
    writeVarint(writer, potentials.length);
    potentials.forEach((p) => {
      // V3: Store actual potential ID directly (no mapping)
      writeVarint(writer, Number(p));
    });

    // V3: Store actual potential IDs for levels (no mapping)
    const levelEntries = charData.pl
      ? Object.entries(charData.pl)
          .map(([k, v]) => [toNum(k), v] as [number, number])
          .sort((a, b) => a[0] - b[0])
      : [];
    writeVarint(writer, levelEntries.length);
    let prevKey = 0;
    for (const [key, value] of levelEntries) {
      writeVarint(writer, (key - prevKey) >>> 0);
      writeVarint(writer, Math.max(0, (value || 0) - 1));
      prevKey = key;
    }

    // V3: Store actual potential IDs for marks (no mapping)
    const markEntries: [number, number][] = [];
    if (charData.pm) {
      Object.entries(charData.pm).forEach(([k, v]) => {
        const code = encodeMark(v);
        if (code) {
          markEntries.push([toNum(k), code]);
        }
      });
    }
    markEntries.sort((a, b) => a[0] - b[0]);
    writeVarint(writer, markEntries.length);
    let prevMark = 0;
    markEntries.forEach(([potId, code]) => {
      writeVarint(writer, potId - prevMark);
      writer.push(code & 0xff);
      prevMark = potId;
    });
  }

  SHARE_POSITIONS.forEach((pos) => {
    const data = chars[pos];
    if (!data) return;
    packCharacter(data);
  });

  const discs = cleanedData.d;
  if (!discs) {
    writer.push(0);
  } else {
    writer.push(1);
    let discSlotMask = 0;
    const slotPayload: Array<{ discId: number; lb: number; sub: number } | null> = [];
    DISC_SLOTS.forEach((slotKey, idx) => {
      const discId = toNum(discs.s?.[slotKey]) || 0;
      if (discId > 0) {
        discSlotMask |= 1 << idx;
        const lb = Math.max(0, (toNum(discs.l?.[slotKey]) || 1) - 1);
        const sub = Math.max(0, toNum(discs.g?.[slotKey]) || 0);
        slotPayload.push({ discId, lb, sub });
      } else {
        slotPayload.push(null);
      }
    });
    writer.push(discSlotMask);
    slotPayload.forEach((payload, idx) => {
      if (!payload || (discSlotMask & (1 << idx)) === 0) return;
      writeVarint(writer, payload.discId);
      writer.push(((payload.lb & 0x07) << 3) | (payload.sub & 0x07));
    });
  }

  return new Uint8Array(writer);
}

/**
 * Unpack binary payload into build data
 * Supports both v2 (legacy index-based) and v3 (direct IDs) formats
 */
function unpackSharePayload(bytes: Uint8Array): BuildData {
  if (!bytes || bytes.length === 0) {
    throw new Error('Empty payload');
  }
  let offset = 0;

  const versionRead = readVarint(bytes, offset);
  offset = versionRead.next;
  const version = versionRead.value;

  // Validate version
  if (version !== 2 && version !== 3) {
    throw new Error(`Unsupported share version: ${version}`);
  }

  // For v2, use legacy frozen character ID map; for v3, no mapping needed
  const isLegacyV2 = version === 2;
  const { charMap, potMap } = isLegacyV2 ? buildIdMaps(true) : { charMap: { fromIdx: {} as Record<number, number> }, potMap: { fromIdx: {} as Record<number, number> } };

  const nameLenRead = readVarint(bytes, offset);
  offset = nameLenRead.next;
  const nameBytes = bytes.slice(offset, offset + nameLenRead.value);
  offset += nameLenRead.value;
  const name = bytesToString(nameBytes);

  const slotMask = bytes[offset++] || 0;

  const characters: BuildData['c'] = {};
  SHARE_POSITIONS.forEach((pos, idx) => {
    if ((slotMask & (1 << idx)) === 0) return;

    const idRead = readVarint(bytes, offset);
    offset = idRead.next;
    // V2: Map index back to ID using legacy map; V3: Use value directly
    const restoredId = isLegacyV2 ? (charMap.fromIdx[idRead.value] ?? idRead.value) : idRead.value;

    const potCountRead = readVarint(bytes, offset);
    offset = potCountRead.next;
    const potentials: number[] = [];
    for (let i = 0; i < potCountRead.value; i++) {
      const potRead = readVarint(bytes, offset);
      offset = potRead.next;
      // V2: Map index back to ID; V3: Use value directly
      const restoredPot = isLegacyV2 ? (potMap.fromIdx[potRead.value] ?? potRead.value) : potRead.value;
      potentials.push(restoredPot);
    }

    const levelCountRead = readVarint(bytes, offset);
    offset = levelCountRead.next;
    const pl: Record<number, number> = {};
    let prevKey = 0;
    for (let i = 0; i < levelCountRead.value; i++) {
      const keyRead = readVarint(bytes, offset);
      offset = keyRead.next;
      const key = prevKey + keyRead.value;
      const valRead = readVarint(bytes, offset);
      offset = valRead.next;
      // V2: Map index back to ID; V3: Use value directly
      const restoredPot = isLegacyV2 ? (potMap.fromIdx[key] ?? key) : key;
      pl[restoredPot] = valRead.value + 1;
      prevKey = key;
    }

    const markCountRead = readVarint(bytes, offset);
    offset = markCountRead.next;
    const pm: Record<number, string> = {};
    let prevMark = 0;
    for (let i = 0; i < markCountRead.value; i++) {
      const deltaRead = readVarint(bytes, offset);
      offset = deltaRead.next;
      const potIdx = prevMark + deltaRead.value;
      const code = bytes[offset++] || 0;
      // V2: Map index back to ID; V3: Use value directly
      const restoredPot = isLegacyV2 ? (potMap.fromIdx[potIdx] ?? potIdx) : potIdx;
      const mark = decodeMark(code);
      if (mark) {
        pm[restoredPot] = mark;
      }
      prevMark = potIdx;
    }

    characters[pos] = {
      i: String(restoredId),
      p: potentials,
      pl,
      pm,
    };
  });

  let discs: DiscBuildData | null = null;
  if (offset < bytes.length) {
    const hasDiscsVal = bytes[offset++];
    const hasDiscs = hasDiscsVal === 1;
    if (hasDiscs && offset < bytes.length) {
      const discSlotMaskVal = bytes[offset++];
      const discSlotMask = (discSlotMaskVal ?? 0) & 0x3f;
      const s: Record<string, number> = {};
      const l: Record<string, number> = {};
      const g: Record<string, number> = {};
      DISC_SLOTS.forEach((slotKey, idx) => {
        if ((discSlotMask & (1 << idx)) === 0) return;
        const discRead = readVarint(bytes, offset);
        offset = discRead.next;
        const discId = discRead.value;
        const packed = bytes[offset++] || 0;
        const lb = ((packed >> 3) & 0x07) + 1;
        const sub = packed & 0x07;
        s[slotKey] = discId;
        l[slotKey] = lb;
        if (sub) g[slotKey] = sub;
      });
      discs = { s, l, g };
    }
  }

  const rebuilt: BuildData = { v: '1.0', n: name };
  if (Object.keys(characters).length > 0) rebuilt.c = characters;
  if (discs) rebuilt.d = discs;
  return rebuilt;
}

function compressSharePayload(
  bytes: Uint8Array
): { mode: string; data: string; length: number } {
  if (!bytes || bytes.length === 0)
    return { mode: 'raw', data: '', length: 0 };

  const rawEncoded = base32768Encode(bytes);
  let best = { mode: 'raw', data: rawEncoded, length: rawEncoded.length };

  // Skip deflate for tiny payloads to avoid extra work for negligible gains
  if (bytes.length > 24 && canUseCompression()) {
    const compressed = compressionLib.deflateSync(bytes, { level: 9, mem: 8 });
    const deflated = base91Encode(compressed);
    if (deflated.length < best.length) {
      best = { mode: 'deflate', data: deflated, length: deflated.length };
    }
  }

  return best;
}

function decompressSharePayload(input: string, mode: string): Uint8Array {
  if (!input) throw new Error('Empty input');
  if (mode === 'raw') {
    return base32768Decode(input);
  }
  if (mode === 'deflate') {
    if (!canUseCompression()) {
      throw new Error('fflate not available for decompression');
    }
    const bytes = base91Decode(input);
    return compressionLib.inflateSync(bytes);
  }
  throw new Error('Unknown share payload mode');
}

function cleanObject<T>(obj: T): T | null {
  if (obj === null || obj === undefined) return null;

  if (Array.isArray(obj)) {
    const cleaned = obj.filter((v) => v !== null && v !== undefined);
    return cleaned.length > 0 ? (cleaned as unknown as T) : null;
  } else if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanObject(value);
      if (
        cleanedValue !== null &&
        cleanedValue !== undefined &&
        cleanedValue !== '' &&
        !(Array.isArray(cleanedValue) && cleanedValue.length === 0) &&
        !(typeof cleanedValue === 'object' && Object.keys(cleanedValue).length === 0)
      ) {
        cleaned[key] = cleanedValue;
      }
    }
    return Object.keys(cleaned).length > 0 ? (cleaned as unknown as T) : null;
  }
  return obj;
}

function encodeBuildToURL(): string {
  try {
    const buildData = collectBuildData();

    delete buildData.m;
    delete buildData.t;

    if (buildData.c) {
      if (buildData.c.m) delete buildData.c.m.sl;
      if (buildData.c.a1) delete buildData.c.a1.sl;
      if (buildData.c.a2) delete buildData.c.a2.sl;
    }

    delete buildData.nt;

    const cleanedData = cleanObject(buildData) || ({} as BuildData);

    const payloadBytes = packSharePayload(cleanedData);
    const compressed = compressSharePayload(payloadBytes);

    let encoded = '';
    if (compressed.mode === 'deflate') {
      encoded = `${SHARE_PREFIX_DEFLATE}${compressed.data}`;
    } else {
      encoded = `${SHARE_PREFIX_RAW}${compressed.data}`;
    }

    log(`[Compression] Payload: ${payloadBytes.length} bytes -> Encoded: ${encoded.length} chars`);

    return encoded;
  } catch (error) {
    console.error('Error encoding build to URL:', error);
    throw error;
  }
}

function decodeBuildFromURL(encoded: string): BuildData {
  try {
    if (!encoded) {
      throw new Error('Empty build data');
    }

    // V3 format (new - direct IDs)
    if (encoded.startsWith(SHARE_PREFIX_RAW)) {
      const stripped = encoded.slice(SHARE_PREFIX_RAW.length);
      const bytes = decompressSharePayload(stripped, 'raw');
      return unpackSharePayload(bytes);
    }

    if (encoded.startsWith(SHARE_PREFIX_DEFLATE)) {
      const stripped = encoded.slice(SHARE_PREFIX_DEFLATE.length);
      const bytes = decompressSharePayload(stripped, 'deflate');
      return unpackSharePayload(bytes);
    }

    // V2 format (legacy - index-based, uses frozen ID map for decoding)
    if (encoded.startsWith(LEGACY_V2_PREFIX_RAW)) {
      const stripped = encoded.slice(LEGACY_V2_PREFIX_RAW.length);
      const bytes = decompressSharePayload(stripped, 'raw');
      return unpackSharePayload(bytes);
    }

    if (encoded.startsWith(LEGACY_V2_PREFIX_DEFLATE)) {
      const stripped = encoded.slice(LEGACY_V2_PREFIX_DEFLATE.length);
      const bytes = decompressSharePayload(stripped, 'deflate');
      return unpackSharePayload(bytes);
    }

    // Legacy: LZ-String URL encoding
    const json = LZString.decompressFromEncodedURIComponent(encoded) || '';
    return JSON.parse(json);
  } catch (error) {
    console.error('Error decoding build from URL:', error);
    throw error;
  }
}

/**
 * Generate shareable URL with compressed build data
 *
 * @returns {void}
 *
 * @description
 * Creates a shareable URL with aggressively compressed build data:
 * 1. Check cooldown (3 seconds)
 * 2. Collect and clean build data (remove memo, timestamps, notes, skills)
 * 3. Pack into binary format with varint encoding and bit masks
 * 4. Compress: Try deflate + Base91, fallback to raw Base32768, choose smaller
 * 5. Generate URL: `app.html#build=v2d-{encoded}` or `app.html#build=v2r-{encoded}`
 * 6. Copy to clipboard or show modal if clipboard API fails
 * 7. Warn if URL > 4000 chars (may not work in some browsers)
 *
 * **Note:** Skill levels are reset to 1 in shared builds (excluded from URL)
 *
 * @example
 * ```typescript
 * generateShareURL();
 * // URL copied to clipboard, e.g. https://example.com/app.html#build=v2d-AbC123...
 * ```
 */
export function generateShareURL(): void {
  const now = Date.now();
  if (now < shareCooldownEnd) {
    const remaining = Math.ceil((shareCooldownEnd - now) / 1000);
    const msg = (
      window.i18n?.t('saveload.cooldownMessage') ||
      'Please try again in ${remaining} seconds.'
    ).replace('${remaining}', String(remaining));
    showToast(msg, 'info');
    return;
  }

  try {
    const encodedRaw = encodeBuildToURL();
    const encoded = encodeURIComponent(encodedRaw);
    const url = `${window.location.origin}${window.location.pathname}#build=${encoded}`;

    log(`[Share] URL length: ${url.length} characters`);

    if (url.length > 4000) {
      const warnMsg = (
        window.i18n?.t('saveload.urlTooLong') ||
        'URL is too long (${length} chars). May not work in some browsers.'
      ).replace('${length}', String(url.length));
      showToast(warnMsg, 'warning');
    }

    navigator.clipboard
      .writeText(url)
      .then(() => {
        if (url.length <= 4000) {
          showToast(
            window.i18n?.t('saveload.shareLinkCopied') ||
              'Share link copied! (Skills set to Lv.1)',
            'success'
          );
        }

        shareCooldownEnd = now + COOLDOWN_MS;
        updateButtonCooldown('share-btn', shareCooldownEnd);
      })
      .catch(() => {
        showShareURLModal(url);
      });
  } catch (error) {
    console.error('Error generating share URL:', error);
    showToast(
      window.i18n?.t('saveload.shareCreateFailed') || 'Failed to create share link.',
      'error'
    );
  }
}

function loadFromURL(): void {
  try {
    let buildParam: string | null = null;

    if (window.location.hash && window.location.hash.includes('build=')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      buildParam = hashParams.get('build');
      if (buildParam) {
        try {
          buildParam = decodeURIComponent(buildParam);
        } catch {
          log('[Decode] Failed to decode URI component for build param');
        }
      }
    }

    if (buildParam) {
      const buildData = decodeBuildFromURL(buildParam);
      restoreBuildData(buildData);

      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (error) {
    console.error('Error loading from URL:', error);
    showToast(
      window.i18n?.t('saveload.urlLoadFailed') ||
        'Failed to load build from URL. Link may be corrupted.',
      'error'
    );
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// =============================================================================
// UI FUNCTIONS
// =============================================================================

function updateBuildTitleDisplay(): void {
  const titleInput = document.getElementById('build-title-input') as HTMLInputElement | null;
  if (titleInput) {
    titleInput.value = buildState.buildTitle;
  }
}

export function handleBuildTitleChange(event: Event): void {
  buildState.buildTitle =
    (event.target as HTMLInputElement).value ||
    (window.i18n?.t('builder.newBuild') || 'New Build');
}

export function handleBuildMemoChange(event: Event): void {
  buildState.buildMemo = (event.target as HTMLTextAreaElement).value || '';
}

export function openLoadModal(): void {
  const modal = document.getElementById('load-modal');
  modal?.classList.add('active');
  renderLoadList();
}

export function closeLoadModal(): void {
  document.getElementById('load-modal')?.classList.remove('active');
}

function renderLoadList(): void {
  const listContainer = document.getElementById('load-list');
  if (!listContainer) return;

  const builds = getLocalStorageBuilds();

  if (builds.length === 0) {
    listContainer.innerHTML = `<p class="empty-state-text">${window.i18n?.t('saveload.noSavedBuilds') || 'No saved builds.'}</p>`;
    return;
  }

  listContainer.innerHTML = builds
    .map((build, index) => {
      const timestamp = build.t || Date.now();
      const buildTitle = build.n || (window.i18n?.t('saveload.noTitle') || 'Untitled');
      const buildMemo = build.m || '';

      const date = new Date(timestamp);
      const locale = window.i18n?.uiLang === 'ko' ? 'ko-KR' : 'en-US';
      const dateStr = date.toLocaleString(locale);

      return `
        <div class="load-item">
          <div class="load-item-info">
            <div class="load-item-title">${buildTitle}</div>
            <div class="load-item-meta">
              <span>${window.i18n?.t('saveload.savedTime') || 'Saved'}: ${dateStr}</span>
              ${buildMemo ? `<span class="has-memo">${window.getIcon?.('memo') || ''} ${window.i18n?.t('saveload.hasMemo') || 'Has memo'}</span>` : ''}
            </div>
          </div>
          <div class="load-item-actions">
            <button class="load-btn"
                    data-action="saveload-load-build"
                    data-index="${index}">${window.i18n?.t('saveload.load') || 'Load'}</button>
            <button class="delete-btn"
                    data-action="saveload-delete-build"
                    data-index="${index}">${window.i18n?.t('saveload.delete') || 'Delete'}</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function showShareURLModal(url: string): void {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${window.i18n?.t('saveload.shareLink') || 'Share Link'}</h2>
        <button class="close-button" data-action="saveload-close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <p>${window.i18n?.t('saveload.shareLinkDesc') || 'Copy and share the link below:'}</p>
        <textarea class="share-url-textarea" readonly>${url}</textarea>
        <button class="copy-url-btn"
                data-action="saveload-copy-url"
                data-url="${url}">${window.i18n?.t('saveload.copy') || 'Copy'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function updateButtonCooldown(buttonId: string, cooldownEnd: number): void {
  const button = document.getElementById(buttonId) as HTMLButtonElement | null;
  if (!button) return;

  const originalHTML = button.innerHTML;
  button.disabled = true;
  button.style.opacity = '0.5';
  button.style.cursor = 'not-allowed';

  const updateTimer = (): void => {
    const now = Date.now();
    const remaining = Math.ceil((cooldownEnd - now) / 1000);

    if (remaining <= 0) {
      button.disabled = false;
      button.style.opacity = '';
      button.style.cursor = '';
      button.innerHTML = originalHTML;
    } else {
      const icon = buttonId === 'save-btn' ? '💾' : '🔗';
      const text =
        buttonId === 'save-btn'
          ? window.i18n?.t('common.save') || 'Save'
          : window.i18n?.t('builder.urlShare') || 'URL Share';
      const secText = window.i18n?.t('saveload.seconds') || 's';
      button.innerHTML = `
        <span class="btn-icon">${icon}</span>
        <span class="btn-text">${text} (${remaining}${secText})</span>
      `;
      setTimeout(updateTimer, 100);
    }
  };

  updateTimer();
}

// =============================================================================
// PRESET BUILDS
// =============================================================================

export async function loadPresetBuilds(filePath?: string): Promise<PresetData> {
  try {
    const path = filePath || 'PresetBuilds.json';
    const presetData = await fetchJSON<PresetData>(path);
    return presetData;
  } catch (error) {
    console.error(`Error loading preset builds from ${filePath || 'PresetBuilds.json'}:`, error);
    return { presets: [], elements: {} };
  }
}

/**
 * Load a preset build from hash string
 *
 * @param {string} buildHash - Encoded build hash (v2r/v2d or legacy LZ-String)
 * @param {string} presetTitle - Display name for toast message
 * @returns {void}
 *
 * @description
 * Loads a preset build from PresetBuilds.json:
 * 1. Decode URI component if needed (handles % encoding from JSON)
 * 2. Decode build from hash (v2r/v2d/legacy formats)
 * 3. Restore build data to current state
 * 4. Show success toast with preset title
 *
 * @example
 * ```typescript
 * loadPresetBuild('v2d-AbC123...', 'Zhu Yuan DPS Build');
 * // Build loaded, toast: "Preset 'Zhu Yuan DPS Build' loaded!"
 * ```
 */
export function loadPresetBuild(buildHash: string, presetTitle: string): void {
  try {
    if (!buildHash) {
      showToast(window.i18n?.t('saveload.loadFailed') || 'Preset load failed.', 'error');
      return;
    }

    // Decode URI component if it's URL-encoded (from PresetBuilds.json)
    let decodedHash = buildHash;
    try {
      // Only decode if it contains URL encoding characters
      if (buildHash.includes('%')) {
        decodedHash = decodeURIComponent(buildHash);
      }
    } catch (decodeError) {
      log('[loadPresetBuild] Failed to decode URI component, using as-is');
    }

    const buildData = decodeBuildFromURL(decodedHash);
    restoreBuildData(buildData);

    const title = presetTitle || (window.i18n?.t('builder.presets') || 'Preset');
    const successMsg = (
      window.i18n?.t('saveload.presetLoaded') || 'Preset "${title}" loaded!'
    ).replace('${title}', title);
    showToast(successMsg, 'success');
  } catch (error) {
    console.error('Error loading preset build:', error);
    showToast(
      window.i18n?.t('saveload.loadFailed') || 'Failed to load preset build.',
      'error'
    );
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

export function init(): void {
  const hasBuildParam = window.location.hash && window.location.hash.includes('build=');

  if (hasBuildParam) {
    // Data is guaranteed to be loaded by app-main.ts before this init is called
    if (window.isDataLoaded && window.isDataLoaded()) {
      loadFromURL();
    } else {
      console.warn('[App-SaveLoad] Data should be loaded but check failed. Attempting load anyway.');
      loadFromURL();
    }
  }

  updateBuildTitleDisplay();
}

// =============================================================================
// EVENT DELEGATION
// =============================================================================

function setupSaveLoadEventDelegation(): void {
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action]') as HTMLElement | null;

    if (!button) return;

    const action = button.dataset.action;
    if (action && action.startsWith('saveload-')) {
      handleSaveLoadAction(button, action);
    }
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const loadModal = document.getElementById('load-modal');
      if (loadModal && loadModal.classList.contains('active')) {
        closeLoadModal();
      }
    }
  });
}

function handleSaveLoadAction(element: HTMLElement, action: string): void {
  switch (action) {
    case 'saveload-save':
      saveToLocalStorage();
      break;

    case 'saveload-load':
      openLoadModal();
      break;

    case 'saveload-share':
      generateShareURL();
      break;

    case 'saveload-load-build': {
      const index = parseInt(element.dataset.index!, 10);
      loadFromLocalStorage(index);
      break;
    }

    case 'saveload-delete-build': {
      const index = parseInt(element.dataset.index!, 10);
      deleteFromLocalStorage(index);
      break;
    }

    case 'saveload-close-modal': {
      const loadModal = document.getElementById('load-modal');
      if (loadModal && loadModal.contains(element)) {
        closeLoadModal();
        break;
      }

      const modal = element.closest('.modal');
      if (modal) {
        modal.remove();
      }
      break;
    }

    case 'saveload-copy-url': {
      const url = element.dataset.url;
      if (url) {
        navigator.clipboard.writeText(url).then(() => {
          showToast(
            window.i18n?.t('saveload.shareLinkCopied') || 'Share link copied!',
            'success'
          );
        });
      }
      break;
    }

    default:
      break;
  }
}

// Setup event delegation
setupSaveLoadEventDelegation();

// Make functions globally available
if (typeof window !== 'undefined') {
  window.saveToLocalStorage = saveToLocalStorage;
  window.loadBuildFromStorage = loadFromLocalStorage;
  window.deleteBuildFromStorage = deleteFromLocalStorage;
  window.generateShareURL = generateShareURL;
  window.openLoadModal = openLoadModal;
  window.closeLoadModal = closeLoadModal;
  window.handleBuildTitleChange = handleBuildTitleChange;
  window.handleBuildMemoChange = handleBuildMemoChange;
  window.loadPresetBuilds = loadPresetBuilds;
  window.loadPresetBuild = loadPresetBuild;
  window.buildState = buildState;
}

export default {
  buildState,
  saveToLocalStorage,
  loadFromLocalStorage,
  deleteFromLocalStorage,
  generateShareURL,
  openLoadModal,
  closeLoadModal,
  handleBuildTitleChange,
  handleBuildMemoChange,
  loadPresetBuilds,
  loadPresetBuild,
};
