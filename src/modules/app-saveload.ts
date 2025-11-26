/**
 * Save/Load System Module
 * Handles saving, loading, and sharing build data
 */

import { fetchJSON, log, onLanguageChange, showToast } from '@/shared';
import type { Position, MainTab, PotentialMark, Disc } from '@/types';
import * as LZString from 'lz-string';
import * as fflate from 'fflate';

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

// fflate library type
declare global {
  interface Window {
    fflate?: {
      deflateSync: (data: Uint8Array, opts?: { level?: number; mem?: number }) => Uint8Array;
      inflateSync: (data: Uint8Array) => Uint8Array;
      strToU8: (str: string) => Uint8Array;
      strFromU8: (data: Uint8Array) => string;
    };
  }
}

// Note: getIcon is available on window object

// =============================================================================
// CONSTANTS
// =============================================================================

const LOCALSTORAGE_KEY = 'sstoy_builds';
const MAX_SAVED_BUILDS = 20;
const COOLDOWN_MS = 3000;

const SHARE_VERSION = 2;
const SHARE_PREFIX_RAW = 'v2r-';
const SHARE_PREFIX_DEFLATE = 'v2d-';
const SHARE_POSITIONS = ['m', 'a1', 'a2'] as const;
const DISC_SLOTS = ['main1', 'main2', 'main3', 'sub1', 'sub2', 'sub3'] as const;
const BASE91_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';
const BASE32768_CHARS = [...'𠀀𠂊𠄓𠆢𠈕𠊧𠌫𠎭𠐻𠒄𠔓𠖻𠘨𠚺𠜎𠞩𠠻𠢹𠤼𠦿𠩂𠫅𠭇𠯉𠱋𠳍𠵏𠷑𠹓𠻕𠽗𠿙𡁛𡃝𡅟𡇡𡉣𡋥𡍧𡏩𡑫𡓭𡕯𡗱𡙳𡛵𡝷𡟹𡡻𡣽𡥿𡨁𡪃𡬅𡮇𡰉𡲋𡴍𡶏𡸑𡺓𡼕𡾗𢀙𢂛𢄝𢆟𢈡𢊣𢋥𢎧𢐩𢒫𢔭𢖯𢘱𢚳𢜵𢞷𢠹𢢻𢤽𢦿𢨁𢪃𢬅𢮇𢰉𢲋𢴍𢶏𢸑𢺓𢼕𢾗𣀙𣂛𣄝𣆟𣈡𣊣𣌥𣎧𣐩𣒫𣔭𣖯𣘱𣚳𣜵𣞷𣠹𣢻𣤽𣦿𣨁𣪃𣬅𣮇𣰉𣲋𣴍𣶏𣸑𣺓𣼕𣾗𤀙𤂛𤄝𤆟𤈡𤊣𤌥𤎧𤐩𤒫𤔭𤖯𤘱𤚳𤜵𤞷𤠹𤢻𤤽𤦿𤨁𤪃𤬅𤮇𤰉𤲋𤴍𤶏𤸑𤺓𤼕𤾗𥀙𥂛𥄝𥆟𥈡𥊣𥌥𥎧𥐩𥒫𥔭𥖯𥘱𥚳𥜵𥞷𥠹𥢻𥤽𥦿𥨁𥪃𥬅𥮇𥰉𥲋𥴍𥶏𥸑𥺓𥼕𥾗𦀙𦂛𦄝𦆟𦈡𦊣𦌥𦎧𦐩𦒫𦔭𦖯𦘱𦚳𦜵𦞷𦠹𦢻𦤽𦦿𦨁𦪃𦬅𦮇𦰉𦲋𦴍𦶏𦸑𦺓𦼕𦾗𧀙𧂛𧄝𧆟𧈡𧊣𧌥𧎧𧐩𧒫𧔭𧖯𧘱𧚳𧜵𧞷𧠹𧢻𧤽𧦿𧨁𧪃𧬅𧮇𧰉𧲋𧴍𧶏𧸑𧺓𧼕𧾗𨀙𨂛𨄝𨆟𨈡𨊣𨌥𨎧𨐩𨒫𨔭𨖯𨘱𨚳𨜵𨞷𨠹𨢻𨤽𨦿𨨁𨪃𨬅𨮇𨰉𨲋𨴍𨶏𨸑𨺓𨼕𨾗𩀙𩂛𩄝𩆟𩈡𩊣𩌥𩎧𩐩𩒫𩔭𩖯𩘱𩚳𩜵𩞷𩠹𩢻𩤽𩦿𩨁𩪃𩬅𩮇𩰉𩲋𩴍𩶏𩸑𩺓𩼕𩾗𪀙𪂛𪄝𪆟𪈡𪊣𪌥𪎧𪐩𪒫𪔭𪖯𪘱𪚳𪜵𪞷𪠹𪢻𪤽𪦿𪨁𪪃𪬅𪮇𪰉𪲋𪴍𪶏𪸑𪺓𪼕𪾗𫀙𫂛𫄝𫆟𫈡𫊣𫌥𫎧𫐩𫒫𫔭𫖯𫘱𫚳𫜵𫞷𫠹𫢻𫤽𫦿𫨁𫪃𫬅𫮇𫰉𫲋𫴍𫶏𫸑𫺓𫼕𫾗𬀙𬂛𬄝𬆟𬈡𬊣𬌥𬎧𬐩𬒫𬔭𬖯𬘱𬚳𬜵𬞷𬠹𬢻𬤽𬦿𬨁𬪃𬬅𬮇𬰉𬲋𬴍𬶏𬸑𬺓𬼕𬾗𭀙𭂛𭄝𭆟𭈡𭊣𭌥𭎧𭐩𭒫𭔭𭕯𭘱𭚳𭜵𭞷𭠹𭢻𭤽𭦿𭨁𭪃𭬅𭮇𭰉𭲋𭴍𭶏𭸑𭺓𭼕𭾗𮀙𮂛𮄝𮆟𮈡𮊣𮌥𮎧𮐩𮒫𮤭𮖯𮘱𮚳𮜵𮞷𮠹𮢻𮤽𮦿𮨁𮪃𮬅𮮇𮰉𮲋𮴍𮶏𮸑𮺓𮼕𮾗𯀙𯂛𯄝𯆟𯈡𯊣𯌥𯎧𯐩𯒫𯔭𯖯𯘱𯚳𯜵𯞷叫捨𥁄䗗𩖶𯪃𯬅𯮇𯰉𯲋𯴍𯶏𯸑𯺓𯼕𯾗'];

const MARK_CODES: Record<string, number> = {
  '필수': 1,
  '후순위': 2,
  '다다익선': 3,
  '명함만': 4,
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
const compressionLib = (() => {
  const lib = typeof window !== 'undefined' ? window.fflate ?? fflate : fflate;
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
        const character = window.state.characters[charId];
        if (character) {
          const nameKey = character.Name || '';
          const name = window.state.characterNames[nameKey] || nameKey;

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

function buildIdMaps(): IdMaps {
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

  const charIds = window.state?.characters
    ? Object.keys(window.state.characters).map(toNum)
    : [];
  const potIds = window.state?.potentials
    ? Object.keys(window.state.potentials).map(toNum)
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

function packSharePayload(cleanedData: BuildData): Uint8Array {
  const { charMap, potMap } = buildIdMaps();
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
    const mappedId = charMap.toIdx.get(Number(charData.i)) || 0;
    writeVarint(writer, mappedId);

    const potentials = Array.isArray(charData.p) ? [...charData.p] : [];
    potentials.sort((a, b) => a - b);
    writeVarint(writer, potentials.length);
    potentials.forEach((p) => {
      const mapped = potMap.toIdx.get(Number(p)) || 0;
      writeVarint(writer, mapped);
    });

    const mappedLevels: Record<number, number> = {};
    if (charData.pl) {
      Object.entries(charData.pl).forEach(([k, v]) => {
        const mapped = potMap.toIdx.get(Number(k)) || 0;
        if (mapped) mappedLevels[mapped] = v;
      });
    }
    const levelEntries = Object.entries(mappedLevels)
      .map(([k, v]) => [toNum(k), v] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    writeVarint(writer, levelEntries.length);
    let prevKey = 0;
    for (const [key, value] of levelEntries) {
      writeVarint(writer, (key - prevKey) >>> 0);
      writeVarint(writer, Math.max(0, (value || 0) - 1));
      prevKey = key;
    }

    const markEntries: [number, number][] = [];
    if (charData.pm) {
      Object.entries(charData.pm).forEach(([k, v]) => {
        const mapped = potMap.toIdx.get(Number(k)) || 0;
        const code = encodeMark(v);
        if (mapped && code) {
          markEntries.push([mapped, code]);
        }
      });
    }
    markEntries.sort((a, b) => a[0] - b[0]);
    writeVarint(writer, markEntries.length);
    let prevMark = 0;
    markEntries.forEach(([idx, code]) => {
      writeVarint(writer, idx - prevMark);
      writer.push(code & 0xff);
      prevMark = idx;
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

function unpackSharePayload(bytes: Uint8Array): BuildData {
  if (!bytes || bytes.length === 0) {
    throw new Error('Empty payload');
  }
  const { charMap, potMap } = buildIdMaps();
  let offset = 0;

  const versionRead = readVarint(bytes, offset);
  offset = versionRead.next;
  if (versionRead.value !== SHARE_VERSION) {
    throw new Error(`Unsupported share version: ${versionRead.value}`);
  }

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
    const restoredId = charMap.fromIdx[idRead.value] ?? idRead.value;

    const potCountRead = readVarint(bytes, offset);
    offset = potCountRead.next;
    const potentials: number[] = [];
    for (let i = 0; i < potCountRead.value; i++) {
      const potRead = readVarint(bytes, offset);
      offset = potRead.next;
      const restoredPot = potMap.fromIdx[potRead.value] ?? potRead.value;
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
      const restoredPot = potMap.fromIdx[key] ?? key;
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
      const restoredPot = potMap.fromIdx[potIdx] ?? potIdx;
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

  if (canUseCompression()) {
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

    // Legacy: LZ-String URL encoding
    const json = LZString.decompressFromEncodedURIComponent(encoded) || '';
    return JSON.parse(json);
  } catch (error) {
    console.error('Error decoding build from URL:', error);
    throw error;
  }
}

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

export async function loadPresetBuilds(): Promise<PresetData> {
  try {
    const presetData = await fetchJSON<PresetData>('PresetBuilds.json');
    return presetData;
  } catch (error) {
    console.error('Error loading preset builds:', error);
    return { presets: [], elements: {} };
  }
}

export function loadPresetBuild(buildHash: string, presetTitle: string): void {
  try {
    if (!buildHash) {
      showToast(window.i18n?.t('saveload.loadFailed') || 'Preset load failed.', 'error');
      return;
    }

    const buildData = decodeBuildFromURL(buildHash);
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

function initSaveLoadSystem(): void {
  const hasBuildParam = window.location.hash && window.location.hash.includes('build=');

  if (hasBuildParam) {
    if (window.isDataLoaded && window.isDataLoaded()) {
      loadFromURL();
    } else {
      const handleDataLoaded = (): void => {
        window.removeEventListener('appDataLoaded', handleDataLoaded);
        requestAnimationFrame(() => {
          loadFromURL();
        });
      };
      window.addEventListener('appDataLoaded', handleDataLoaded);

      setTimeout(() => {
        window.removeEventListener('appDataLoaded', handleDataLoaded);
        if (window.state?.characters && Object.keys(window.state.characters).length > 0) {
          loadFromURL();
        }
      }, 15000);
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSaveLoadSystem);
} else {
  initSaveLoadSystem();
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
