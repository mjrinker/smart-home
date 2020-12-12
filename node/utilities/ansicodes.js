// ColorCodes explained: http://www.termsys.demon.co.uk/vtansi.htm

const colorNums = {
  reverse: 7,
  reverseOff: 27,
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  fgDefault: 39,
  brightBlack: 90,
  brightRed: 91,
  brightGreen: 92,
  brightYellow: 93,
  brightBlue: 94,
  brightMagenta: 95,
  brightCyan: 96,
  brightWhite: 97,
};

const backgroundColorNums = {
  bgReverse: 7,
  bgReverseOff: 27,
  bgBlack: 40,
  bgRed: 41,
  bgGreen: 42,
  bgYellow: 43,
  bgBlue: 44,
  bgMagenta: 45,
  bgCyan: 46,
  bgWhite: 47,
  bgDefault: 49,
  bgBrightBlack: 100,
  bgBrightRed: 101,
  bgBrightGreen: 102,
  bgBrightYellow: 103,
  bgBrightBlue: 104,
  bgBrightMagenta: 105,
  bgBrightCyan: 106,
  bgBrightWhite: 107,
};

const xtermColorNums = {
  aqua: 14,
  aquamarine1: 122,
  aquamarine2: 86,
  aquamarine3: 79,
  black1: 0,
  blue1: 12,
  blue2: 21,
  blue3: 19,
  blue4: 20,
  blueViolet: 57,
  cadetBlue1: 72,
  cadetBlue2: 73,
  chartreuse1: 118,
  chartreuse2: 112,
  chartreuse3: 82,
  chartreuse4: 70,
  chartreuse5: 76,
  chartreuse6: 64,
  cornflowerBlue: 69,
  cornsilk1: 230,
  cyan1: 51,
  cyan2: 50,
  cyan3: 43,
  darkBlue: 18,
  darkCyan: 36,
  darkGoldenrod: 136,
  darkGreen: 22,
  darkKhaki: 143,
  darkMagenta1: 90,
  darkMagenta2: 91,
  darkOliveGreen1: 191,
  darkOliveGreen2: 192,
  darkOliveGreen3: 155,
  darkOliveGreen4: 107,
  darkOliveGreen5: 113,
  darkOliveGreen6: 149,
  darkOrange: 208,
  darkOrange1: 130,
  darkOrange2: 166,
  darkRed1: 52,
  darkRed2: 88,
  darkSeaGreen: 108,
  darkSeaGreen1: 158,
  darkSeaGreen2: 193,
  darkSeaGreen3: 151,
  darkSeaGreen4: 157,
  darkSeaGreen5: 115,
  darkSeaGreen6: 150,
  darkSeaGreen7: 65,
  darkSeaGreen8: 71,
  darkSlateGray1: 123,
  darkSlateGray2: 87,
  darkSlateGray3: 116,
  darkTurquoise: 44,
  darkViolet1: 128,
  darkViolet2: 92,
  deepPink1: 198,
  deepPink2: 199,
  deepPink3: 197,
  deepPink4: 161,
  deepPink5: 162,
  deepPink6: 125,
  deepPink7: 53,
  deepPink8: 89,
  deepSkyBlue1: 39,
  deepSkyBlue2: 38,
  deepSkyBlue3: 31,
  deepSkyBlue4: 32,
  deepSkyBlue5: 23,
  deepSkyBlue6: 24,
  deepSkyBlue7: 25,
  dodgerBlue1: 33,
  dodgerBlue2: 27,
  dodgerBlue3: 26,
  fuchsia: 13,
  gold1: 220,
  gold2: 142,
  gold3: 178,
  green1: 2,
  green2: 46,
  green3: 40,
  green4: 34,
  green5: 28,
  greenYellow: 154,
  grey: 8,
  grey1: 16,
  grey2: 232,
  grey3: 233,
  grey4: 234,
  grey5: 235,
  grey6: 236,
  grey7: 237,
  grey8: 238,
  grey9: 239,
  grey10: 240,
  grey11: 59,
  grey12: 241,
  grey13: 242,
  grey14: 243,
  grey15: 244,
  grey16: 102,
  grey17: 245,
  grey18: 246,
  grey19: 247,
  grey20: 139,
  grey21: 248,
  grey22: 145,
  grey23: 249,
  grey24: 250,
  grey25: 251,
  grey26: 252,
  grey27: 188,
  grey28: 253,
  grey29: 254,
  grey30: 255,
  grey31: 231,
  honeydew: 194,
  hotPink1: 205,
  hotPink2: 206,
  hotPink3: 169,
  hotPink4: 132,
  hotPink5: 168,
  indianRed1: 131,
  indianRed2: 167,
  indianRed3: 203,
  indianRed4: 204,
  khaki1: 228,
  khaki2: 185,
  lightCoral: 210,
  lightCyan1: 195,
  lightCyan2: 152,
  lightGoldenrod1: 227,
  lightGoldenrod2: 186,
  lightGoldenrod3: 221,
  lightGoldenrod4: 222,
  lightGoldenrod5: 179,
  lightGreen1: 119,
  lightGreen2: 120,
  lightPink1: 217,
  lightPink2: 174,
  lightPink3: 95,
  lightSalmon1: 216,
  lightSalmon2: 137,
  lightSalmon3: 173,
  lightSeaGreen: 37,
  lightSkyBlue1: 153,
  lightSkyBlue2: 109,
  lightSkyBlue3: 110,
  lightSlateBlue: 105,
  lightSlateGrey: 103,
  lightSteelBlue: 147,
  lightSteelBlue1: 189,
  lightSteelBlue2: 146,
  lightYellow1: 187,
  lime: 10,
  magenta1: 201,
  magenta2: 165,
  magenta3: 200,
  magenta4: 127,
  magenta5: 163,
  magenta6: 164,
  maroon: 1,
  mediumOrchid1: 134,
  mediumOrchid2: 171,
  mediumOrchid3: 207,
  mediumOrchid4: 133,
  mediumPurple1: 104,
  mediumPurple2: 141,
  mediumPurple3: 135,
  mediumPurple4: 140,
  mediumPurple5: 97,
  mediumPurple6: 98,
  mediumPurple7: 60,
  mediumSpringGreen: 49,
  mediumTurquoise: 80,
  mediumVioletRed: 126,
  mistyRose1: 224,
  mistyRose2: 181,
  navajoWhite1: 223,
  navajoWhite2: 144,
  navy: 4,
  navyBlue: 17,
  olive: 3,
  orange1: 214,
  orange2: 172,
  orange3: 58,
  orange4: 94,
  orangeRed: 202,
  orchid1: 170,
  orchid2: 213,
  orchid3: 212,
  paleGreen1: 121,
  paleGreen2: 156,
  paleGreen3: 114,
  paleGreen4: 77,
  paleTurquoise1: 159,
  paleTurquoise2: 66,
  paleVioletRed: 211,
  pink1: 218,
  pink2: 175,
  plum1: 219,
  plum2: 183,
  plum3: 176,
  plum4: 96,
  purple1: 129,
  purple2: 5,
  purple3: 93,
  purple4: 56,
  purple5: 54,
  purple6: 55,
  red1: 9,
  red2: 196,
  red3: 124,
  red4: 160,
  rosyBrown: 138,
  royalBlue: 63,
  salmon: 209,
  sandyBrown: 215,
  seaGreen1: 84,
  seaGreen2: 85,
  seaGreen3: 83,
  seaGreen4: 78,
  silver: 7,
  skyBlue1: 117,
  skyBlue2: 111,
  skyBlue3: 74,
  slateBlue1: 99,
  slateBlue2: 61,
  slateBlue3: 62,
  springGreen1: 48,
  springGreen2: 42,
  springGreen3: 47,
  springGreen4: 35,
  springGreen5: 41,
  springGreen6: 29,
  steelBlue1: 67,
  steelBlue2: 75,
  steelBlue3: 81,
  steelBlue4: 68,
  tan: 180,
  teal: 6,
  thistle1: 225,
  thistle2: 182,
  turquoise1: 45,
  turquoise2: 30,
  violet: 177,
  wheat1: 229,
  wheat2: 101,
  white1: 15,
  yellow1: 11,
  yellow2: 226,
  yellow3: 190,
  yellow4: 148,
  yellow5: 184,
  yellow6: 100,
  yellow7: 106,
};

const styleNums = {
  reset: { on: 0, off: 0 },
  bold: { on: 1, off: 22 },
  faint: { on: 2, off: 22 }, // not supported on: WebStorm
  italic: { on: 3, off: 23 }, // not supported on: WebStorm
  underline: { on: 4, off: 24 },
  blinkSlow: { on: 5, off: 25 }, // not supported on: WebStorm, Terminus
  blinkFast: { on: 6, off: 25 }, // not supported on: WebStorm, Terminus
  hide: { on: 8, off: 28 }, // not supported on: WebStorm
  strike: { on: 9, off: 29 }, // not supported on: WebStorm, Terminus
  font0: { on: 10, off: 10 }, // not supported on: WebStorm, Terminus
  font1: { on: 11, off: 10 }, // not supported on: WebStorm, Terminus
  font2: { on: 12, off: 10 }, // not supported on: WebStorm, Terminus
  font3: { on: 13, off: 10 }, // not supported on: WebStorm, Terminus
  font4: { on: 14, off: 10 }, // not supported on: WebStorm, Terminus
  font5: { on: 15, off: 10 }, // not supported on: WebStorm, Terminus
  font6: { on: 16, off: 10 }, // not supported on: WebStorm, Terminus
  font7: { on: 17, off: 10 }, // not supported on: WebStorm, Terminus
  font8: { on: 18, off: 10 }, // not supported on: WebStorm, Terminus
  font9: { on: 19, off: 10 }, // not supported on: WebStorm, Terminus
  fraktur: { on: 20, off: 23 }, // not supported on: WebStorm, Terminus
  doubleUnderline: { on: 21, off: 24 }, // not supported on: WebStorm; shows as underline on: Terminus
  frame: { on: 51, off: 55 }, // not supported on: WebStorm, Terminus
  encircle: { on: 52, off: 54 }, // not supported on: WebStorm, Terminus
  overline: { on: 53, off: 55 }, // not supported on: WebStorm, Terminus
  superscript: { on: 73, off: 0 }, // not supported on: WebStorm, Terminus
  subscript: { on: 74, off: 0 }, // not supported on: WebStorm, Terminus
};

const open = {};

const close = {};

const codes = {};

Object.entries(colorNums).forEach(([key, value]) => {
  open[key] = `\u001b[${value}m`;
  close[key] = '\u001b[39m';
  codes[key] = (...s) => `${open[key]}${s.join(' ')}${close[key]}`;
});

Object.entries(backgroundColorNums).forEach(([key, value]) => {
  open[key] = `\u001b[${value}m`;
  close[key] = '\u001b[49m';
  codes[key] = (...s) => `${open[key]}${s.join(' ')}${close[key]}`;
});

Object.entries(xtermColorNums).forEach(([key, value]) => {
  open[key] = `\u001b[38;5;${value}m`;
  close[key] = '\u001b[39m';
  codes[key] = (...s) => `${open[key]}${s.join(' ')}${close[key]}`;

  const bgKey = `bg${key.substring(0, 1).toUpperCase()}${key.substring(1)}`;
  open[bgKey] = `\u001b[48;5;${value}m`;
  close[bgKey] = '\u001b[49m';
  codes[bgKey] = (...s) => `${open[bgKey]}${s.join(' ')}${close[bgKey]}`;
});

Object.entries(styleNums).forEach(([key, value]) => {
  open[key] = `\u001b[${value.on}m`;
  close[key] = `\u001b[${value.off}m`;
  codes[key] = (...s) => `${open[key]}${s.join(' ')}${close[key]}`;
});

codes.rgb = (r, g, b, ...s) => `\u001b[38;2;${r};${g};${b}m${s.join(' ')}'\u001b[39m'`;

codes.bgRGB = (r, g, b, ...s) => `\u001b[48;2;${r};${g};${b}m${s.join(' ')}'\u001b[49m'`;

module.exports = codes;
codes.open = open;
codes.close = close;
