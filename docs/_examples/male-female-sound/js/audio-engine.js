const FORMANT_BANDWIDTHS = [110, 160, 240];
const FORMANT_GAINS = [1.1, 0.66, 0.34];
const LETTER_PATTERN = /[a-z]/;
const VOWEL_PATTERN = /[aeiouy]/;

const WORD_OVERRIDES = {
  a: "a",
  about: "ebaut",
  ack: "ak",
  again: "egen",
  attack: "atak",
  amigo: "amiigo",
  argh: "aarg",
  arrgh: "aaarg",
  are: "ar",
  auf: "auf",
  ausgabe: "ausgaabe",
  bella: "bela",
  blargh: "blaarg",
  blegh: "bleg",
  bitte: "bite",
  bonjour: "bonzhur",
  ciao: "chao",
  danke: "danke",
  der: "deer",
  die: "dai",
  dschungel: "dschungel",
  eek: "iik",
  easy: "iizi",
  eight: "eit",
  five: "faiv",
  four: "for",
  gehts: "geets",
  go: "goo",
  graah: "graa",
  graaagh: "graaag",
  grr: "grr",
  grrrr: "grrrr",
  guten: "guuten",
  help: "help",
  hisss: "hisss",
  hngh: "hng",
  hallo: "halo",
  hello: "helo",
  hola: "ola",
  khh: "khh",
  hraa: "hraa",
  hrrngh: "hrrng",
  huff: "huff",
  ich: "ikh",
  is: "iz",
  ja: "ya",
  language: "lenggwidzh",
  love: "lav",
  merci: "mersi",
  mmph: "mmf",
  morgen: "morgen",
  nation: "nashun",
  nein: "nain",
  nice: "nais",
  nine: "nain",
  ngh: "ng",
  no: "noo",
  nooo: "nooo",
  one: "wan",
  oui: "wi",
  oof: "uuf",
  ouch: "autsch",
  pant: "pant",
  please: "pliiz",
  raaagh: "raaag",
  rrragh: "rrrag",
  rgh: "rg",
  rghh: "rgh",
  run: "ran",
  sieben: "ziiben",
  six: "siks",
  shhh: "shhh",
  sound: "saund",
  speech: "spiitsch",
  sprache: "spraache",
  sprach: "spraach",
  thanks: "thengks",
  the: "the",
  three: "thrii",
  tschao: "tschao",
  tschuss: "tschuss",
  tschuess: "tschuss",
  two: "tu",
  und: "unt",
  vision: "vizhun",
  wie: "wii",
  woohoo: "wuhuu",
  world: "werld",
  yes: "yes",
  you: "yu"
};

const LETTER_REPLACEMENTS = {
  "ä": "ae",
  "ö": "oe",
  "ü": "ue",
  "ß": "ss",
  "æ": "ae",
  "œ": "oe",
  "ø": "oe",
  "å": "o",
  "ñ": "ny",
  "ç": "s",
  "č": "ch",
  "ć": "ch",
  "š": "sh",
  "ś": "sh",
  "ž": "zh",
  "ź": "zh",
  "ż": "zh",
  "ğ": "g",
  "ł": "w",
  "ð": "th",
  "þ": "th",
  "ə": "e",
  "ɐ": "a",
  "ɑ": "a",
  "ɒ": "o",
  "ɔ": "o",
  "ɘ": "e",
  "ɛ": "e",
  "ɜ": "e",
  "ɪ": "i",
  "ɯ": "u",
  "ʊ": "u",
  "ʃ": "sh",
  "ʒ": "zh",
  "ŋ": "ng",
  "ɲ": "ny",
  "ɕ": "sh",
  "ʁ": "r",
  "ɹ": "r",
  "ɾ": "r",
  "ʧ": "tsch",
  "ʤ": "dzh",
  "α": "a",
  "β": "v",
  "γ": "g",
  "δ": "d",
  "ε": "e",
  "ζ": "z",
  "η": "i",
  "θ": "th",
  "ι": "i",
  "κ": "k",
  "λ": "l",
  "μ": "m",
  "ν": "n",
  "ξ": "ks",
  "ο": "o",
  "π": "p",
  "ρ": "r",
  "σ": "s",
  "ς": "s",
  "τ": "t",
  "υ": "u",
  "φ": "f",
  "χ": "kh",
  "ψ": "ps",
  "ω": "o",
  "а": "a",
  "б": "b",
  "в": "v",
  "г": "g",
  "д": "d",
  "е": "ye",
  "ё": "yo",
  "ж": "zh",
  "з": "z",
  "и": "i",
  "й": "y",
  "к": "k",
  "л": "l",
  "м": "m",
  "н": "n",
  "о": "o",
  "п": "p",
  "р": "r",
  "с": "s",
  "т": "t",
  "у": "u",
  "ф": "f",
  "х": "kh",
  "ц": "ts",
  "ч": "ch",
  "ш": "sh",
  "щ": "shch",
  "ы": "y",
  "э": "e",
  "ю": "yu",
  "я": "ya"
};

const WORD_REWRITES = [
  [/eau/g, "oo"],
  [/eaux\b/g, "oo"],
  [/^wh/, "w"],
  [/^wr/, "r"],
  [/^kn/, "n"],
  [/^gn/, "n"],
  [/^ps/, "s"],
  [/^pt/, "t"],
  [/^j([aeiouy])/, "y$1"],
  [/dge/g, "dzh"],
  [/dg([ei])/, "dzh$1"],
  [/tch/g, "tsch"],
  [/([aeiouy])sion\b/g, "$1zhun"],
  [/sion\b/g, "shun"],
  [/tion\b/g, "shun"],
  [/sure\b/g, "zhur"],
  [/ture\b/g, "tschur"],
  [/cial\b/g, "shal"],
  [/tial\b/g, "shal"],
  [/ough\b/g, "of"],
  [/augh\b/g, "af"],
  [/ight\b/g, "ait"],
  [/eigh/g, "ei"],
  [/ow\b/g, "ou"],
  [/que\b/g, "k"],
  [/qu/g, "kw"],
  [/ck/g, "k"],
  [/ph/g, "f"],
  [/jour/g, "zhur"],
  [/([aeiou])h([bcdfgjklmnpqrstvwxyz]|$)/g, "$1$1$2"],
  [/([aeiou])gh\b/g, "$1gh"],
  [/([aeiou])mb\b/g, "$1m"],
  [/([aeiou])ng\b/g, "$1ng"],
  [/([aeiou])n([bp])/g, "$1m$2"],
  [/ll([aeiou])\b/g, "y$1"],
  [/z([aeiou])\b/g, "s$1"],
  [/([aeiou])c([eiy])/g, "$1s$2"],
  [/c([aou])/g, "k$1"],
  [/([^aeiouy])le\b/g, "$1el"],
  [/er\b/g, "er"],
  [/ly\b/g, "li"]
];

const VOWEL_LIBRARY = {
  a: { formants: [800, 1200, 2500], duration: 0.2, pitchDrop: 0.12, brightness: 0.52 },
  e: { formants: [530, 1850, 2600], duration: 0.18, pitchDrop: 0.1, brightness: 0.62 },
  i: { formants: [300, 2200, 3100], duration: 0.17, pitchDrop: 0.08, brightness: 0.84 },
  o: { formants: [450, 900, 2300], duration: 0.21, pitchDrop: 0.1, brightness: 0.44 },
  u: { formants: [380, 900, 1800], duration: 0.21, pitchDrop: 0.13, brightness: 0.34 },
  y: { formants: [320, 1900, 2900], duration: 0.17, pitchDrop: 0.06, brightness: 0.78 }
};

const DIPHTHONG_LIBRARY = {
  ae: { from: "a", to: "e", duration: 0.35, intensity: 1 },
  ai: { from: "a", to: "i", duration: 0.34, intensity: 1.02 },
  au: { from: "a", to: "u", duration: 0.37, intensity: 1.05 },
  ea: { from: "e", to: "a", duration: 0.34, intensity: 0.98 },
  ee: { from: "e", to: "e", duration: 0.36, intensity: 1.04, hold: true },
  ei: { from: "a", to: "i", duration: 0.35, intensity: 1.06 },
  eu: { from: "e", to: "u", duration: 0.35, intensity: 1.02 },
  ia: { from: "i", to: "a", duration: 0.32, intensity: 0.98 },
  ie: { from: "i", to: "e", duration: 0.31, intensity: 1 },
  io: { from: "i", to: "o", duration: 0.33, intensity: 0.98 },
  iu: { from: "i", to: "u", duration: 0.32, intensity: 0.96 },
  oa: { from: "o", to: "a", duration: 0.36, intensity: 1 },
  oe: { from: "o", to: "e", duration: 0.34, intensity: 0.98 },
  oi: { from: "o", to: "i", duration: 0.34, intensity: 1.02 },
  oo: { from: "o", to: "o", duration: 0.4, intensity: 1.08, hold: true },
  ou: { from: "o", to: "u", duration: 0.35, intensity: 1.02 },
  ue: { from: "u", to: "e", duration: 0.35, intensity: 0.98 },
  ui: { from: "u", to: "i", duration: 0.32, intensity: 0.96 },
  uu: { from: "u", to: "u", duration: 0.4, intensity: 1.06, hold: true }
};

const CONSONANT_LIBRARY = {
  b: { kind: "stop", voiced: true, duration: 0.07, formants: [420, 1100, 2300], noise: 0.055, brightness: 0.4 },
  c: { kind: "stop", voiced: false, duration: 0.06, formants: [360, 1350, 2200], noise: 0.095, brightness: 0.54 },
  d: { kind: "stop", voiced: true, duration: 0.07, formants: [450, 1500, 2400], noise: 0.05, brightness: 0.5 },
  f: { kind: "fricative-soft", voiced: false, duration: 0.09, formants: [650, 1350, 2400], noise: 0.07, brightness: 0.38 },
  g: { kind: "stop", voiced: true, duration: 0.07, formants: [360, 1200, 2100], noise: 0.05, brightness: 0.46 },
  h: { kind: "aspirate", voiced: false, duration: 0.08, formants: [500, 1100, 2200], noise: 0.035, brightness: 0.18 },
  j: { kind: "glide", voiced: true, duration: 0.1, formants: [300, 1850, 2600], noise: 0.001, brightness: 0.52 },
  k: { kind: "stop", voiced: false, duration: 0.06, formants: [300, 1200, 2200], noise: 0.1, brightness: 0.62 },
  l: { kind: "liquid", voiced: true, duration: 0.1, formants: [360, 1450, 2500], noise: 0.02, brightness: 0.44 },
  m: { kind: "nasal", voiced: true, duration: 0.11, formants: [260, 1200, 2100], noise: 0.02, brightness: 0.22 },
  n: { kind: "nasal", voiced: true, duration: 0.1, formants: [320, 1450, 2400], noise: 0.02, brightness: 0.32 },
  p: { kind: "stop", voiced: false, duration: 0.06, formants: [420, 1000, 2200], noise: 0.1, brightness: 0.48 },
  q: { kind: "stop", voiced: false, duration: 0.06, formants: [360, 1050, 2000], noise: 0.09, brightness: 0.4 },
  r: { kind: "liquid", voiced: true, duration: 0.1, formants: [340, 1300, 2350], noise: 0.03, brightness: 0.5 },
  s: { kind: "fricative", voiced: false, duration: 0.09, formants: [1100, 2600, 3600], noise: 0.13, brightness: 0.82 },
  t: { kind: "stop", voiced: false, duration: 0.05, formants: [500, 1600, 2800], noise: 0.09, brightness: 0.68 },
  v: { kind: "fricative", voiced: true, duration: 0.09, formants: [700, 1600, 2800], noise: 0.055, brightness: 0.56 },
  w: { kind: "glide", voiced: true, duration: 0.13, formants: [360, 760, 1700], noise: 0.001, brightness: 0.24 },
  x: { kind: "fricative", voiced: false, duration: 0.08, formants: [950, 2300, 3300], noise: 0.12, brightness: 0.78 },
  z: { kind: "fricative", voiced: true, duration: 0.09, formants: [900, 2200, 3400], noise: 0.065, brightness: 0.76 }
};

const CLUSTER_LIBRARY = {
  ch: { kind: "fricative", voiced: false, duration: 0.1, formants: [840, 1900, 2900], noise: 0.11, brightness: 0.52 },
  ck: { kind: "stop", voiced: false, duration: 0.07, formants: [320, 1200, 2100], noise: 0.1, brightness: 0.6 },
  dj: { kind: "fricative", voiced: true, duration: 0.11, formants: [560, 1850, 2900], noise: 0.07, brightness: 0.62 },
  dsch: { kind: "fricative", voiced: true, duration: 0.13, formants: [620, 1850, 2900], noise: 0.075, brightness: 0.62 },
  dz: { kind: "fricative", voiced: true, duration: 0.1, formants: [820, 2100, 3300], noise: 0.075, brightness: 0.72 },
  dzh: { kind: "fricative", voiced: true, duration: 0.13, formants: [620, 1850, 2900], noise: 0.075, brightness: 0.62 },
  gh: { kind: "fricative", voiced: true, duration: 0.11, formants: [520, 1250, 2200], noise: 0.06, brightness: 0.34 },
  kh: { kind: "fricative", voiced: false, duration: 0.11, formants: [620, 1320, 2300], noise: 0.13, brightness: 0.36 },
  ks: { kind: "fricative", voiced: false, duration: 0.1, formants: [1000, 2300, 3400], noise: 0.13, brightness: 0.78 },
  lj: { kind: "liquid", voiced: true, duration: 0.12, formants: [330, 1750, 2700], noise: 0.018, brightness: 0.56 },
  ng: { kind: "nasal", voiced: true, duration: 0.12, formants: [280, 1500, 2300], noise: 0.02, brightness: 0.28 },
  nj: { kind: "nasal", voiced: true, duration: 0.12, formants: [300, 1750, 2600], noise: 0.02, brightness: 0.42 },
  ny: { kind: "nasal", voiced: true, duration: 0.12, formants: [300, 1750, 2600], noise: 0.02, brightness: 0.42 },
  pf: { kind: "fricative", voiced: false, duration: 0.11, formants: [760, 1600, 2750], noise: 0.12, brightness: 0.62 },
  ph: { kind: "fricative", voiced: false, duration: 0.09, formants: [760, 1600, 2750], noise: 0.095, brightness: 0.62 },
  rr: { kind: "liquid", voiced: true, duration: 0.14, formants: [360, 1450, 2450], noise: 0.04, brightness: 0.54 },
  sch: { kind: "fricative", voiced: false, duration: 0.14, formants: [760, 1600, 2600], noise: 0.14, brightness: 0.46 },
  shch: { kind: "fricative", voiced: false, duration: 0.16, formants: [760, 1750, 2850], noise: 0.15, brightness: 0.52 },
  sh: { kind: "fricative", voiced: false, duration: 0.13, formants: [760, 1700, 2700], noise: 0.14, brightness: 0.48 },
  sp: { kind: "fricative", voiced: false, duration: 0.1, formants: [950, 2000, 3200], noise: 0.12, brightness: 0.66 },
  st: { kind: "fricative", voiced: false, duration: 0.1, formants: [1000, 2200, 3300], noise: 0.12, brightness: 0.68 },
  th: { kind: "fricative", voiced: false, duration: 0.09, formants: [840, 1850, 2800], noise: 0.1, brightness: 0.62 },
  ts: { kind: "fricative", voiced: false, duration: 0.09, formants: [1100, 2400, 3500], noise: 0.13, brightness: 0.76 },
  tsch: { kind: "fricative", voiced: false, duration: 0.13, formants: [840, 1850, 2850], noise: 0.14, brightness: 0.54 },
  tz: { kind: "fricative", voiced: false, duration: 0.09, formants: [1000, 2300, 3400], noise: 0.13, brightness: 0.72 },
  zh: { kind: "fricative", voiced: true, duration: 0.12, formants: [760, 1750, 2800], noise: 0.075, brightness: 0.56 }
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function isVowel(letter) {
  return Object.prototype.hasOwnProperty.call(VOWEL_LIBRARY, letter);
}

function hasVowel(text) {
  return VOWEL_PATTERN.test(text);
}

function isConsonant(letter) {
  return LETTER_PATTERN.test(letter) && !isVowel(letter);
}

function clusterCoversBoundary(word, index) {
  return Object.keys(CLUSTER_LIBRARY).some((cluster) => {
    const start = word.lastIndexOf(cluster, index);
    return start !== -1 && start <= index && start + cluster.length > index + 1;
  });
}

function shouldLoosenCluster(word, index) {
  const previous = word[index - 1] || "";
  const current = word[index];
  const next = word[index + 1] || "";
  const afterNext = word[index + 2] || "";

  if (!isConsonant(current) || !isConsonant(next)) {
    return false;
  }

  if (clusterCoversBoundary(word, index)) {
    return false;
  }

  const pair = current + next;
  if (CLUSTER_LIBRARY[pair] || ["bl", "br", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "pl", "pr", "sk", "sl", "sm", "sn", "sw", "tr"].includes(pair)) {
    return false;
  }

  if (previous && isConsonant(previous) && afterNext && isConsonant(afterNext)) {
    return true;
  }

  return previous && isConsonant(previous) && !CLUSTER_LIBRARY[previous + current];
}

function makeSpeakableWord(word) {
  if (!word || word.length < 2) {
    return word;
  }

  if (!hasVowel(word)) {
    if (/^([bcdfgjklmnpqrstvwxyz])\1+$/.test(word) || /^(sh|sch|tsch|zh|ff|ss|th|ch)[bcdfgjklmnpqrstvwxyz]*$/.test(word)) {
      return word;
    }

    return word.replace(/([bcdfgjklmnpqrstvwxyz])/g, "$1e").replace(/e$/, "");
  }

  let output = "";
  for (let index = 0; index < word.length; index += 1) {
    output += word[index];

    if (shouldLoosenCluster(word, index)) {
      output += "e";
    }
  }

  return output;
}

function transliterateText(text) {
  const lowerText = String(text || "").toLowerCase();
  let output = "";

  for (const char of lowerText) {
    output += LETTER_REPLACEMENTS[char] ?? char;
  }

  let decomposed = "";

  for (const char of output.normalize("NFD")) {
    if (/[\u0300-\u036f]/.test(char)) {
      continue;
    }

    decomposed += char;
  }

  return decomposed;
}

function createNoiseBuffer(audioContext, duration = 1.8) {
  const frameCount = Math.ceil(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * 0.9;
  }

  return buffer;
}

function createPhone(symbol, config) {
  return {
    symbol,
    kind: config.kind ?? "pause",
    duration: config.duration ?? 0.08,
    intensity: config.intensity ?? 1,
    pitchOffset: config.pitchOffset ?? 0,
    pitchDrop: config.pitchDrop ?? 0.08,
    formants: config.formants ?? [600, 1200, 2400],
    targetFormants: config.targetFormants ?? null,
    noise: config.noise ?? 0.04,
    voiced: config.voiced ?? false,
    brightness: config.brightness ?? 0.5,
    targetBrightness: config.targetBrightness ?? null
  };
}

function createPause(duration) {
  return createPhone("pause", { duration, kind: "pause", noise: 0, voiced: false, intensity: 0 });
}

class GruntSynth {
  constructor() {
    this.audioContext = null;
    this.noiseBuffer = null;
  }

  async ensureReady() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.noiseBuffer = createNoiseBuffer(this.audioContext);
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  normalizeText(text) {
    return transliterateText(text)
      .replace(/[^a-z!?.,'\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  rewritePhoneticWord(word) {
    if (WORD_OVERRIDES[word]) {
      return WORD_OVERRIDES[word];
    }

    let output = word;

    WORD_REWRITES.forEach(([pattern, replacement]) => {
      output = output.replace(pattern, replacement);
    });

    return makeSpeakableWord(output);
  }

  normalizePhoneticText(text) {
    return this.normalizeText(text).replace(/[a-z]+/g, (word) => this.rewritePhoneticWord(word));
  }

  clonePhone(symbol, config) {
    return createPhone(symbol, config);
  }

  createVowelPhone(letter) {
    return this.clonePhone(letter, {
      ...VOWEL_LIBRARY[letter],
      kind: "vowel",
      voiced: true,
      noise: 0.002
    });
  }

  createConsonantPhone(symbol, config) {
    return this.clonePhone(symbol, config);
  }

  createGlidePhone(symbol, fromLetter, toLetter, duration, intensity = 1) {
    const from = VOWEL_LIBRARY[fromLetter];
    const to = VOWEL_LIBRARY[toLetter];
    const brightness = (from.brightness + to.brightness) * 0.5;

    return this.clonePhone(symbol, {
      kind: "vowel",
      voiced: true,
      duration,
      intensity,
      noise: 0.003,
      brightness,
      formants: from.formants,
      targetFormants: to.formants,
      targetBrightness: to.brightness,
      pitchDrop: Math.max(from.pitchDrop, to.pitchDrop) + 0.02
    });
  }

  createVowelRunPhone(letter, count) {
    const base = this.createVowelPhone(letter);
    base.duration *= 1 + (count - 1) * 0.8;
    base.intensity *= 1 + (count - 1) * 0.04;
    base.pitchDrop += (count - 1) * 0.012;
    return base;
  }

  createWordPause(symbol) {
    if (symbol === "!") {
      return createPause(0.14);
    }

    if (symbol === "?") {
      return createPause(0.16);
    }

    if (symbol === "," || symbol === "-") {
      return createPause(0.09);
    }

    if (symbol === "'") {
      return createPause(0.025);
    }

    return createPause(0.07);
  }

  consumeCluster(text, index) {
    const fourLetter = text.slice(index, index + 4);
    if (CLUSTER_LIBRARY[fourLetter]) {
      return { size: 4, phones: [this.createConsonantPhone(fourLetter, CLUSTER_LIBRARY[fourLetter])] };
    }

    const threeLetter = text.slice(index, index + 3);
    if (CLUSTER_LIBRARY[threeLetter]) {
      return { size: 3, phones: [this.createConsonantPhone(threeLetter, CLUSTER_LIBRARY[threeLetter])] };
    }

    const twoLetter = text.slice(index, index + 2);
    if (twoLetter === "qu") {
      return {
        size: 2,
        phones: [
          this.createConsonantPhone("q", CONSONANT_LIBRARY.q),
          this.createConsonantPhone("w", { ...CONSONANT_LIBRARY.w, duration: 0.08 })
        ]
      };
    }

    if (CLUSTER_LIBRARY[twoLetter]) {
      return { size: 2, phones: [this.createConsonantPhone(twoLetter, CLUSTER_LIBRARY[twoLetter])] };
    }

    return null;
  }

  consumeRepeatedVowel(text, index) {
    const letter = text[index];
    if (!isVowel(letter)) {
      return null;
    }

    let end = index + 1;
    while (text[end] === letter) {
      end += 1;
    }

    const count = end - index;
    if (count < 2) {
      return null;
    }

    return {
      size: count,
      phones: [this.createVowelRunPhone(letter, count)]
    };
  }

  consumeVowelCombo(text, index) {
    const twoLetter = text.slice(index, index + 2);
    if (twoLetter[0] === "y" && isVowel(twoLetter[1])) {
      return null;
    }

    const combo = DIPHTHONG_LIBRARY[twoLetter];

    if (combo) {
      if (combo.hold) {
        return {
          size: 2,
          phones: [this.createVowelRunPhone(combo.from, 2)]
        };
      }

      return {
        size: 2,
        phones: [this.createGlidePhone(twoLetter, combo.from, combo.to, combo.duration, combo.intensity)]
      };
    }

    const first = text[index];
    const second = text[index + 1];
    if (!isVowel(first) || !isVowel(second) || first === second) {
      return null;
    }

    const from = VOWEL_LIBRARY[first];
    const to = VOWEL_LIBRARY[second];
    const duration = ((from.duration + to.duration) * 0.5) * 1.8;
    const intensity = 1 + Math.abs(from.brightness - to.brightness) * 0.08;

    return {
      size: 2,
      phones: [this.createGlidePhone(twoLetter, first, second, duration, intensity)]
    };
  }

  createLetterPhones(letter, nextLetter = "", previousPhone = null) {
    if (letter === "y" && nextLetter && isVowel(nextLetter)) {
      return [this.createConsonantPhone("y", { ...CONSONANT_LIBRARY.j, duration: 0.08 })];
    }

    if (isVowel(letter)) {
      return [this.createVowelPhone(letter)];
    }

    if (letter === "x") {
      return [
        this.createConsonantPhone("k", { ...CONSONANT_LIBRARY.k, duration: 0.05 }),
        this.createConsonantPhone("s", { ...CONSONANT_LIBRARY.s, duration: 0.07, noise: 0.1 })
      ];
    }

    if (letter === "c") {
      if ("eiy".includes(nextLetter)) {
        return [this.createConsonantPhone("s", { ...CONSONANT_LIBRARY.s, duration: 0.08, noise: 0.1 })];
      }

      return [this.createConsonantPhone("k", { ...CONSONANT_LIBRARY.k, duration: 0.06, noise: 0.095 })];
    }

    if (letter === "h" && previousPhone && previousPhone.kind === "vowel") {
      return [
        this.createConsonantPhone("h", {
          ...CONSONANT_LIBRARY.h,
          duration: 0.06,
          noise: 0.028,
          brightness: 0.18
        })
      ];
    }

    const config = CONSONANT_LIBRARY[letter];
    if (config) {
      return [this.createConsonantPhone(letter, config)];
    }

    return [createPause(0.04)];
  }

  stretchPhone(previousPhone, currentLetter) {
    if (!previousPhone) {
      return false;
    }

    const extendableKinds = new Set(["vowel", "fricative", "fricative-soft", "nasal", "liquid", "aspirate"]);
    if (previousPhone.symbol === currentLetter && extendableKinds.has(previousPhone.kind)) {
      previousPhone.duration += previousPhone.kind === "vowel" ? 0.09 : 0.05;
      previousPhone.intensity += previousPhone.kind === "vowel" ? 0.05 : 0.02;
      previousPhone.noise += ["fricative", "fricative-soft"].includes(previousPhone.kind) ? 0.006 : 0;
      previousPhone.pitchDrop += previousPhone.kind === "vowel" ? 0.015 : 0;
      return true;
    }

    return false;
  }

  applyProsody(phones) {
    let accentNextVoiced = true;

    phones.forEach((phone, index) => {
      const nextPhone = phones[index + 1] || null;

      if (phone.kind === "pause") {
        accentNextVoiced = true;
        return;
      }

      if (phone.voiced && accentNextVoiced) {
        phone.intensity *= 1.12;
        phone.duration *= 1.08;
        accentNextVoiced = false;
      }

      if (phone.kind === "vowel" && nextPhone && nextPhone.kind === "pause") {
        phone.duration *= 1.08;
      }

      if (phone.kind === "glide" || phone.symbol === "w") {
        phone.duration *= 1.05;
      }
    });

    return phones;
  }

  textToPhones(text) {
    const normalized = this.normalizePhoneticText(text);
    const phones = [];

    for (let index = 0; index < normalized.length; index += 1) {
      const current = normalized[index];

      if (current === " ") {
        phones.push(createPause(0.06));
        continue;
      }

      if (".,!?-'".includes(current)) {
        phones.push(this.createWordPause(current));
        continue;
      }

      if (!LETTER_PATTERN.test(current)) {
        continue;
      }

      const repeatedVowel = this.consumeRepeatedVowel(normalized, index);
      if (repeatedVowel) {
        phones.push(...repeatedVowel.phones);
        index += repeatedVowel.size - 1;
        continue;
      }

      const vowelCombo = this.consumeVowelCombo(normalized, index);
      if (vowelCombo) {
        phones.push(...vowelCombo.phones);
        index += vowelCombo.size - 1;
        continue;
      }

      const cluster = this.consumeCluster(normalized, index);
      if (cluster) {
        phones.push(...cluster.phones);
        index += cluster.size - 1;
        continue;
      }

      if (this.stretchPhone(phones[phones.length - 1], current)) {
        continue;
      }

      const nextLetter = normalized[index + 1] || "";
      phones.push(...this.createLetterPhones(current, nextLetter, phones[phones.length - 1] || null));
    }

    return this.applyProsody(phones);
  }

  createOutput(ctx) {
    const output = ctx.createGain();
    output.connect(ctx.destination);
    output.gain.setValueAtTime(0.0001, ctx.currentTime);
    output.gain.linearRampToValueAtTime(0.95, ctx.currentTime + 0.015);
    return output;
  }

  scheduleVoicedPhone(ctx, destination, voiceSettings, phone, startTime) {
    const duration = finite(phone.duration, 0.08);
    const endTime = startTime + duration;
    const peakTime = startTime + Math.min(0.04, duration * 0.28);
    const tailTime = endTime - Math.min(0.025, duration * 0.22);
    const basePitch = clamp(finite(voiceSettings.pitch * (1 + phone.pitchOffset), voiceSettings.pitch), 60, 520);
    const endPitch = clamp(basePitch * (1 - finite(phone.pitchDrop, 0.08)), 50, 500);

    const voiceGain = ctx.createGain();
    voiceGain.connect(destination);
    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(clamp(voiceSettings.intensity * phone.intensity, 0.03, 1.35), peakTime);
    voiceGain.gain.linearRampToValueAtTime(clamp(voiceSettings.intensity * phone.intensity * 0.78, 0.02, 1.1), tailTime);
    voiceGain.gain.linearRampToValueAtTime(0.0001, endTime);

    const mainOsc = ctx.createOscillator();
    mainOsc.type = phone.kind === "glide" ? "triangle" : "sawtooth";
    mainOsc.frequency.setValueAtTime(basePitch, startTime);
    mainOsc.frequency.linearRampToValueAtTime(endPitch, endTime);

    const supportOsc = ctx.createOscillator();
    supportOsc.type = phone.kind === "nasal" || phone.kind === "glide" ? "sine" : "triangle";
    supportOsc.frequency.setValueAtTime(basePitch * 2, startTime);
    supportOsc.frequency.linearRampToValueAtTime(clamp(endPitch * 2.02, 100, 1100), endTime);

    const mainGain = ctx.createGain();
    mainGain.gain.value = phone.kind === "nasal" ? 0.38 : phone.kind === "glide" ? 0.44 : 0.52;
    const supportGain = ctx.createGain();
    supportGain.gain.value = phone.kind === "glide"
      ? 0.12 + voiceSettings.brightness * 0.05 + phone.brightness * 0.03
      : 0.2 + voiceSettings.brightness * 0.12 + phone.brightness * 0.06;

    const mixer = ctx.createGain();
    mixer.gain.value = 1;
    mainOsc.connect(mainGain).connect(mixer);
    supportOsc.connect(supportGain).connect(mixer);

    phone.formants.forEach((rawFrequency, index) => {
      const frequency = clamp(rawFrequency * (0.9 + voiceSettings.brightness * 0.24 + phone.brightness * 0.08), 120, 4200);
      const targetRawFrequency = (phone.targetFormants || phone.formants)[index];
      const targetBrightness = phone.targetBrightness ?? phone.brightness;
      const targetFrequency = clamp(
        targetRawFrequency * (0.9 + voiceSettings.brightness * 0.24 + targetBrightness * 0.08),
        120,
        4200
      );

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(frequency, startTime);
      filter.frequency.linearRampToValueAtTime(targetFrequency, endTime);
      filter.Q.value = Math.max(1.2, frequency / FORMANT_BANDWIDTHS[index]);

      const formantGain = ctx.createGain();
      formantGain.gain.value = FORMANT_GAINS[index] * (0.9 + phone.intensity * 0.1);

      mixer.connect(filter);
      filter.connect(formantGain).connect(voiceGain);
    });

    if (phone.noise > 0.004) {
      this.scheduleNoisePhone(ctx, voiceGain, voiceSettings, phone, startTime, duration, true);
    }

    mainOsc.start(startTime);
    supportOsc.start(startTime);
    mainOsc.stop(endTime + 0.03);
    supportOsc.stop(endTime + 0.03);
  }

  getNoiseProfile(phone, voiceSettings, blend) {
    const symbol = phone.symbol;
    const breath = voiceSettings.breath;

    if (phone.kind === "stop") {
      return {
        type: "highpass",
        frequency: 900 + phone.brightness * 1200,
        q: 0.28,
        durationScale: 0.42,
        peakScale: blend ? 0.22 : 0.55,
        breathWeight: 0.18,
        attackRatio: 0.08,
        holdRatio: 0.16,
        tailRatio: 0.42
      };
    }

    if (phone.kind === "aspirate" || symbol === "h") {
      return {
        type: "lowpass",
        frequency: 420 + phone.brightness * 420 + voiceSettings.brightness * 120,
        q: 0.22,
        durationScale: 1,
        peakScale: blend ? 0.18 : 0.34,
        breathWeight: 0.42,
        attackRatio: 0.24,
        holdRatio: 0.62,
        tailRatio: 0.9
      };
    }

    if (["kh", "gh", "ch"].includes(symbol)) {
      return {
        type: "bandpass",
        frequency: 520 + phone.brightness * 820 + voiceSettings.brightness * 160,
        q: 0.48,
        durationScale: 1,
        peakScale: blend ? 0.2 : 0.62,
        breathWeight: 0.56,
        attackRatio: 0.2,
        holdRatio: 0.68,
        tailRatio: 0.92
      };
    }

    if (["s", "z", "ts", "tz", "ks"].includes(symbol)) {
      return {
        type: "bandpass",
        frequency: 1800 + phone.brightness * 2500 + voiceSettings.brightness * 420,
        q: 1.15,
        durationScale: 1,
        peakScale: blend ? 0.32 : 0.76,
        breathWeight: 0.5,
        attackRatio: 0.18,
        holdRatio: 0.72,
        tailRatio: 0.94
      };
    }

    if (["sh", "sch", "tsch", "shch"].includes(symbol)) {
      return {
        type: "bandpass",
        frequency: 1050 + phone.brightness * 1600 + voiceSettings.brightness * 300,
        q: 0.72,
        durationScale: 1,
        peakScale: blend ? 0.3 : 0.72,
        breathWeight: 0.56,
        attackRatio: 0.2,
        holdRatio: 0.74,
        tailRatio: 0.95
      };
    }

    if (["f", "v", "pf", "ph", "th"].includes(symbol) || phone.kind === "fricative-soft") {
      return {
        type: "bandpass",
        frequency: 720 + phone.brightness * 980 + voiceSettings.brightness * 180,
        q: 0.44,
        durationScale: 1,
        peakScale: blend ? 0.24 : 0.52,
        breathWeight: 0.46,
        attackRatio: 0.22,
        holdRatio: 0.68,
        tailRatio: 0.92
      };
    }

    const defaultCenter = 900 + phone.brightness * 1400 + voiceSettings.brightness * 280;
    return {
      type: "bandpass",
      frequency: defaultCenter + breath * 120,
      q: 0.5,
      durationScale: 1,
      peakScale: blend ? 0.26 : 0.58,
      breathWeight: 0.46,
      attackRatio: 0.2,
      holdRatio: 0.7,
      tailRatio: 0.92
    };
  }

  scheduleNoisePhone(ctx, destination, voiceSettings, phone, startTime, duration = phone.duration, blend = false) {
    const baseDuration = finite(duration, 0.08);
    const profile = this.getNoiseProfile(phone, voiceSettings, blend);
    const safeDuration = Math.max(0.018, baseDuration * profile.durationScale);
    const endTime = startTime + safeDuration;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = profile.type;
    filter.frequency.value = clamp(profile.frequency, 160, 7000);
    filter.Q.value = profile.q;

    const gain = ctx.createGain();
    const peak = clamp(profile.peakScale * (phone.noise + voiceSettings.breath * profile.breathWeight), 0.0001, 0.8);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + Math.min(0.018, safeDuration * profile.attackRatio));
    gain.gain.linearRampToValueAtTime(Math.max(peak * 0.46, 0.0001), startTime + safeDuration * profile.holdRatio);
    gain.gain.linearRampToValueAtTime(0.0001, endTime);

    source.connect(filter).connect(gain).connect(destination);
    source.start(startTime);
    source.stop(endTime + 0.02);
  }

  getAdvanceDuration(phone, nextPhone) {
    if (!nextPhone || phone.kind === "pause") {
      return phone.duration;
    }

    let overlap = 0;

    if (phone.voiced && nextPhone.voiced) {
      overlap = Math.min(0.035, phone.duration * 0.18, nextPhone.duration * 0.18);
    } else if (phone.voiced && nextPhone.kind === "aspirate") {
      overlap = Math.min(0.015, phone.duration * 0.08);
    } else if (phone.kind === "aspirate" && nextPhone.voiced) {
      overlap = Math.min(0.012, nextPhone.duration * 0.08);
    }

    return Math.max(0.02, phone.duration - overlap);
  }

  async playText(voiceSettings, text) {
    await this.ensureReady();

    const phones = this.textToPhones(text);
    if (!phones.length) {
      return;
    }

    const ctx = this.audioContext;
    const output = this.createOutput(ctx);
    let cursor = ctx.currentTime + 0.015;

    phones.forEach((phone, index) => {
      if (phone.kind !== "pause") {
        if (phone.voiced) {
          this.scheduleVoicedPhone(ctx, output, voiceSettings, phone, cursor);
        } else {
          this.scheduleNoisePhone(ctx, output, voiceSettings, phone, cursor);
        }
      }

      cursor += this.getAdvanceDuration(phone, phones[index + 1] || null);
    });

    output.gain.linearRampToValueAtTime(0.0001, cursor + 0.06);
  }
}

window.GruntSynth = GruntSynth;
