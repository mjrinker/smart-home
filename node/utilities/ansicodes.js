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
  aqua: { number: 14, hexadecimal: '#00ffff', rgb: { red: 0, green: 255, blue: 255 } },
  aquamarine1: { number: 122, hexadecimal: '#87ffd7', rgb: { red: 135, green: 255, blue: 215 } },
  aquamarine2: { number: 86, hexadecimal: '#5fffd7', rgb: { red: 95, green: 255, blue: 215 } },
  aquamarine3: { number: 79, hexadecimal: '#5fd7af', rgb: { red: 95, green: 215, blue: 175 } },
  black1: { number: 0, hexadecimal: '#000000', rgb: { red: 0, green: 0, blue: 0 } },
  blue1: { number: 12, hexadecimal: '#0000ff', rgb: { red: 0, green: 0, blue: 255 } },
  blue2: { number: 21, hexadecimal: '#0000ff', rgb: { red: 0, green: 0, blue: 255 } },
  blue3: { number: 19, hexadecimal: '#0000af', rgb: { red: 0, green: 0, blue: 175 } },
  blue4: { number: 20, hexadecimal: '#0000d7', rgb: { red: 0, green: 0, blue: 215 } },
  blueViolet: { number: 57, hexadecimal: '#5f00ff', rgb: { red: 95, green: 0, blue: 255 } },
  cadetBlue1: { number: 72, hexadecimal: '#5faf87', rgb: { red: 95, green: 175, blue: 135 } },
  cadetBlue2: { number: 73, hexadecimal: '#5fafaf', rgb: { red: 95, green: 175, blue: 175 } },
  chartreuse1: { number: 118, hexadecimal: '#87ff00', rgb: { red: 135, green: 255, blue: 0 } },
  chartreuse2: { number: 112, hexadecimal: '#87d700', rgb: { red: 135, green: 215, blue: 0 } },
  chartreuse3: { number: 82, hexadecimal: '#5fff00', rgb: { red: 95, green: 255, blue: 0 } },
  chartreuse4: { number: 70, hexadecimal: '#5faf00', rgb: { red: 95, green: 175, blue: 0 } },
  chartreuse5: { number: 76, hexadecimal: '#5fd700', rgb: { red: 95, green: 215, blue: 0 } },
  chartreuse6: { number: 64, hexadecimal: '#5f8700', rgb: { red: 95, green: 135, blue: 0 } },
  cornflowerBlue: { number: 69, hexadecimal: '#5f87ff', rgb: { red: 95, green: 135, blue: 255 } },
  cornsilk1: { number: 230, hexadecimal: '#ffffd7', rgb: { red: 255, green: 255, blue: 215 } },
  cyan1: { number: 51, hexadecimal: '#00ffff', rgb: { red: 0, green: 255, blue: 255 } },
  cyan2: { number: 50, hexadecimal: '#00ffd7', rgb: { red: 0, green: 255, blue: 215 } },
  cyan3: { number: 43, hexadecimal: '#00d7af', rgb: { red: 0, green: 215, blue: 175 } },
  darkBlue: { number: 18, hexadecimal: '#000087', rgb: { red: 0, green: 0, blue: 135 } },
  darkCyan: { number: 36, hexadecimal: '#00af87', rgb: { red: 0, green: 175, blue: 135 } },
  darkGoldenrod: { number: 136, hexadecimal: '#af8700', rgb: { red: 175, green: 135, blue: 0 } },
  darkGreen: { number: 22, hexadecimal: '#005f00', rgb: { red: 0, green: 95, blue: 0 } },
  darkKhaki: { number: 143, hexadecimal: '#afaf5f', rgb: { red: 175, green: 175, blue: 95 } },
  darkMagenta1: { number: 90, hexadecimal: '#870087', rgb: { red: 135, green: 0, blue: 135 } },
  darkMagenta2: { number: 91, hexadecimal: '#8700af', rgb: { red: 135, green: 0, blue: 175 } },
  darkOliveGreen1: { number: 191, hexadecimal: '#d7ff5f', rgb: { red: 215, green: 255, blue: 95 } },
  darkOliveGreen2: { number: 192, hexadecimal: '#d7ff87', rgb: { red: 215, green: 255, blue: 135 } },
  darkOliveGreen3: { number: 155, hexadecimal: '#afff5f', rgb: { red: 175, green: 255, blue: 95 } },
  darkOliveGreen4: { number: 107, hexadecimal: '#87af5f', rgb: { red: 135, green: 175, blue: 95 } },
  darkOliveGreen5: { number: 113, hexadecimal: '#87d75f', rgb: { red: 135, green: 215, blue: 95 } },
  darkOliveGreen6: { number: 149, hexadecimal: '#afd75f', rgb: { red: 175, green: 215, blue: 95 } },
  darkOrange: { number: 208, hexadecimal: '#ff8700', rgb: { red: 255, green: 135, blue: 0 } },
  darkOrange1: { number: 130, hexadecimal: '#af5f00', rgb: { red: 175, green: 95, blue: 0 } },
  darkOrange2: { number: 166, hexadecimal: '#d75f00', rgb: { red: 215, green: 95, blue: 0 } },
  darkRed1: { number: 52, hexadecimal: '#5f0000', rgb: { red: 95, green: 0, blue: 0 } },
  darkRed2: { number: 88, hexadecimal: '#870000', rgb: { red: 135, green: 0, blue: 0 } },
  darkSeaGreen: { number: 108, hexadecimal: '#87af87', rgb: { red: 135, green: 175, blue: 135 } },
  darkSeaGreen1: { number: 158, hexadecimal: '#afffd7', rgb: { red: 175, green: 255, blue: 215 } },
  darkSeaGreen2: { number: 193, hexadecimal: '#d7ffaf', rgb: { red: 215, green: 255, blue: 175 } },
  darkSeaGreen3: { number: 151, hexadecimal: '#afd7af', rgb: { red: 175, green: 215, blue: 175 } },
  darkSeaGreen4: { number: 157, hexadecimal: '#afffaf', rgb: { red: 175, green: 255, blue: 175 } },
  darkSeaGreen5: { number: 115, hexadecimal: '#87d7af', rgb: { red: 135, green: 215, blue: 175 } },
  darkSeaGreen6: { number: 150, hexadecimal: '#afd787', rgb: { red: 175, green: 215, blue: 135 } },
  darkSeaGreen7: { number: 65, hexadecimal: '#5f875f', rgb: { red: 95, green: 135, blue: 95 } },
  darkSeaGreen8: { number: 71, hexadecimal: '#5faf5f', rgb: { red: 95, green: 175, blue: 95 } },
  darkSlateGray1: { number: 123, hexadecimal: '#87ffff', rgb: { red: 135, green: 255, blue: 255 } },
  darkSlateGray2: { number: 87, hexadecimal: '#5fffff', rgb: { red: 95, green: 255, blue: 255 } },
  darkSlateGray3: { number: 116, hexadecimal: '#87d7d7', rgb: { red: 135, green: 215, blue: 215 } },
  darkTurquoise: { number: 44, hexadecimal: '#00d7d7', rgb: { red: 0, green: 215, blue: 215 } },
  darkViolet1: { number: 128, hexadecimal: '#af00d7', rgb: { red: 175, green: 0, blue: 215 } },
  darkViolet2: { number: 92, hexadecimal: '#8700d7', rgb: { red: 135, green: 0, blue: 215 } },
  deepPink1: { number: 198, hexadecimal: '#ff0087', rgb: { red: 255, green: 0, blue: 135 } },
  deepPink2: { number: 199, hexadecimal: '#ff00af', rgb: { red: 255, green: 0, blue: 175 } },
  deepPink3: { number: 197, hexadecimal: '#ff005f', rgb: { red: 255, green: 0, blue: 95 } },
  deepPink4: { number: 161, hexadecimal: '#d7005f', rgb: { red: 215, green: 0, blue: 95 } },
  deepPink5: { number: 162, hexadecimal: '#d70087', rgb: { red: 215, green: 0, blue: 135 } },
  deepPink6: { number: 125, hexadecimal: '#af005f', rgb: { red: 175, green: 0, blue: 95 } },
  deepPink7: { number: 53, hexadecimal: '#5f005f', rgb: { red: 95, green: 0, blue: 95 } },
  deepPink8: { number: 89, hexadecimal: '#87005f', rgb: { red: 135, green: 0, blue: 95 } },
  deepSkyBlue1: { number: 39, hexadecimal: '#00afff', rgb: { red: 0, green: 175, blue: 255 } },
  deepSkyBlue2: { number: 38, hexadecimal: '#00afd7', rgb: { red: 0, green: 175, blue: 215 } },
  deepSkyBlue3: { number: 31, hexadecimal: '#0087af', rgb: { red: 0, green: 135, blue: 175 } },
  deepSkyBlue4: { number: 32, hexadecimal: '#0087d7', rgb: { red: 0, green: 135, blue: 215 } },
  deepSkyBlue5: { number: 23, hexadecimal: '#005f5f', rgb: { red: 0, green: 95, blue: 95 } },
  deepSkyBlue6: { number: 24, hexadecimal: '#005f87', rgb: { red: 0, green: 95, blue: 135 } },
  deepSkyBlue7: { number: 25, hexadecimal: '#005faf', rgb: { red: 0, green: 95, blue: 175 } },
  dodgerBlue1: { number: 33, hexadecimal: '#0087ff', rgb: { red: 0, green: 135, blue: 255 } },
  dodgerBlue2: { number: 27, hexadecimal: '#005fff', rgb: { red: 0, green: 95, blue: 255 } },
  dodgerBlue3: { number: 26, hexadecimal: '#005fd7', rgb: { red: 0, green: 95, blue: 215 } },
  fuchsia: { number: 13, hexadecimal: '#ff00ff', rgb: { red: 255, green: 0, blue: 255 } },
  gold1: { number: 220, hexadecimal: '#ffd700', rgb: { red: 255, green: 215, blue: 0 } },
  gold2: { number: 142, hexadecimal: '#afaf00', rgb: { red: 175, green: 175, blue: 0 } },
  gold3: { number: 178, hexadecimal: '#d7af00', rgb: { red: 215, green: 175, blue: 0 } },
  green1: { number: 2, hexadecimal: '#008000', rgb: { red: 0, green: 128, blue: 0 } },
  green2: { number: 46, hexadecimal: '#00ff00', rgb: { red: 0, green: 255, blue: 0 } },
  green3: { number: 40, hexadecimal: '#00d700', rgb: { red: 0, green: 215, blue: 0 } },
  green4: { number: 34, hexadecimal: '#00af00', rgb: { red: 0, green: 175, blue: 0 } },
  green5: { number: 28, hexadecimal: '#008700', rgb: { red: 0, green: 135, blue: 0 } },
  greenYellow: { number: 154, hexadecimal: '#afff00', rgb: { red: 175, green: 255, blue: 0 } },
  grey: { number: 8, hexadecimal: '#808080', rgb: { red: 128, green: 128, blue: 128 } },
  grey1: { number: 16, hexadecimal: '#000000', rgb: { red: 0, green: 0, blue: 0 } },
  grey2: { number: 232, hexadecimal: '#080808', rgb: { red: 8, green: 8, blue: 8 } },
  grey3: { number: 233, hexadecimal: '#121212', rgb: { red: 18, green: 18, blue: 18 } },
  grey4: { number: 234, hexadecimal: '#1c1c1c', rgb: { red: 28, green: 28, blue: 28 } },
  grey5: { number: 235, hexadecimal: '#262626', rgb: { red: 38, green: 38, blue: 38 } },
  grey6: { number: 236, hexadecimal: '#303030', rgb: { red: 48, green: 48, blue: 48 } },
  grey7: { number: 237, hexadecimal: '#3a3a3a', rgb: { red: 58, green: 58, blue: 58 } },
  grey8: { number: 238, hexadecimal: '#444444', rgb: { red: 68, green: 68, blue: 68 } },
  grey9: { number: 239, hexadecimal: '#4e4e4e', rgb: { red: 78, green: 78, blue: 78 } },
  grey10: { number: 240, hexadecimal: '#585858', rgb: { red: 88, green: 88, blue: 88 } },
  grey11: { number: 59, hexadecimal: '#5f5f5f', rgb: { red: 95, green: 95, blue: 95 } },
  grey12: { number: 241, hexadecimal: '#626262', rgb: { red: 98, green: 98, blue: 98 } },
  grey13: { number: 242, hexadecimal: '#6c6c6c', rgb: { red: 108, green: 108, blue: 108 } },
  grey14: { number: 243, hexadecimal: '#767676', rgb: { red: 118, green: 118, blue: 118 } },
  grey15: { number: 244, hexadecimal: '#808080', rgb: { red: 128, green: 128, blue: 128 } },
  grey16: { number: 102, hexadecimal: '#878787', rgb: { red: 135, green: 135, blue: 135 } },
  grey17: { number: 245, hexadecimal: '#8a8a8a', rgb: { red: 138, green: 138, blue: 138 } },
  grey18: { number: 246, hexadecimal: '#949494', rgb: { red: 148, green: 148, blue: 148 } },
  grey19: { number: 247, hexadecimal: '#9e9e9e', rgb: { red: 158, green: 158, blue: 158 } },
  grey20: { number: 139, hexadecimal: '#af87af', rgb: { red: 175, green: 135, blue: 175 } },
  grey21: { number: 248, hexadecimal: '#a8a8a8', rgb: { red: 168, green: 168, blue: 168 } },
  grey22: { number: 145, hexadecimal: '#afafaf', rgb: { red: 175, green: 175, blue: 175 } },
  grey23: { number: 249, hexadecimal: '#b2b2b2', rgb: { red: 178, green: 178, blue: 178 } },
  grey24: { number: 250, hexadecimal: '#bcbcbc', rgb: { red: 188, green: 188, blue: 188 } },
  grey25: { number: 251, hexadecimal: '#c6c6c6', rgb: { red: 198, green: 198, blue: 198 } },
  grey26: { number: 252, hexadecimal: '#d0d0d0', rgb: { red: 208, green: 208, blue: 208 } },
  grey27: { number: 188, hexadecimal: '#d7d7d7', rgb: { red: 215, green: 215, blue: 215 } },
  grey28: { number: 253, hexadecimal: '#dadada', rgb: { red: 218, green: 218, blue: 218 } },
  grey29: { number: 254, hexadecimal: '#e4e4e4', rgb: { red: 228, green: 228, blue: 228 } },
  grey30: { number: 255, hexadecimal: '#eeeeee', rgb: { red: 238, green: 238, blue: 238 } },
  grey31: { number: 231, hexadecimal: '#ffffff', rgb: { red: 255, green: 255, blue: 255 } },
  honeydew: { number: 194, hexadecimal: '#d7ffd7', rgb: { red: 215, green: 255, blue: 215 } },
  hotPink1: { number: 205, hexadecimal: '#ff5faf', rgb: { red: 255, green: 95, blue: 175 } },
  hotPink2: { number: 206, hexadecimal: '#ff5fd7', rgb: { red: 255, green: 95, blue: 215 } },
  hotPink3: { number: 169, hexadecimal: '#d75faf', rgb: { red: 215, green: 95, blue: 175 } },
  hotPink4: { number: 132, hexadecimal: '#af5f87', rgb: { red: 175, green: 95, blue: 135 } },
  hotPink5: { number: 168, hexadecimal: '#d75f87', rgb: { red: 215, green: 95, blue: 135 } },
  indianRed1: { number: 131, hexadecimal: '#af5f5f', rgb: { red: 175, green: 95, blue: 95 } },
  indianRed2: { number: 167, hexadecimal: '#d75f5f', rgb: { red: 215, green: 95, blue: 95 } },
  indianRed3: { number: 203, hexadecimal: '#ff5f5f', rgb: { red: 255, green: 95, blue: 95 } },
  indianRed4: { number: 204, hexadecimal: '#ff5f87', rgb: { red: 255, green: 95, blue: 135 } },
  khaki1: { number: 228, hexadecimal: '#ffff87', rgb: { red: 255, green: 255, blue: 135 } },
  khaki2: { number: 185, hexadecimal: '#d7d75f', rgb: { red: 215, green: 215, blue: 95 } },
  lightCoral: { number: 210, hexadecimal: '#ff8787', rgb: { red: 255, green: 135, blue: 135 } },
  lightCyan1: { number: 195, hexadecimal: '#d7ffff', rgb: { red: 215, green: 255, blue: 255 } },
  lightCyan2: { number: 152, hexadecimal: '#afd7d7', rgb: { red: 175, green: 215, blue: 215 } },
  lightGoldenrod1: { number: 227, hexadecimal: '#ffff5f', rgb: { red: 255, green: 255, blue: 95 } },
  lightGoldenrod2: { number: 186, hexadecimal: '#d7d787', rgb: { red: 215, green: 215, blue: 135 } },
  lightGoldenrod3: { number: 221, hexadecimal: '#ffd75f', rgb: { red: 255, green: 215, blue: 95 } },
  lightGoldenrod4: { number: 222, hexadecimal: '#ffd787', rgb: { red: 255, green: 215, blue: 135 } },
  lightGoldenrod5: { number: 179, hexadecimal: '#d7af5f', rgb: { red: 215, green: 175, blue: 95 } },
  lightGreen1: { number: 119, hexadecimal: '#87ff5f', rgb: { red: 135, green: 255, blue: 95 } },
  lightGreen2: { number: 120, hexadecimal: '#87ff87', rgb: { red: 135, green: 255, blue: 135 } },
  lightPink1: { number: 217, hexadecimal: '#ffafaf', rgb: { red: 255, green: 175, blue: 175 } },
  lightPink2: { number: 174, hexadecimal: '#d78787', rgb: { red: 215, green: 135, blue: 135 } },
  lightPink3: { number: 95, hexadecimal: '#875f5f', rgb: { red: 135, green: 95, blue: 95 } },
  lightSalmon1: { number: 216, hexadecimal: '#ffaf87', rgb: { red: 255, green: 175, blue: 135 } },
  lightSalmon2: { number: 137, hexadecimal: '#af875f', rgb: { red: 175, green: 135, blue: 95 } },
  lightSalmon3: { number: 173, hexadecimal: '#d7875f', rgb: { red: 215, green: 135, blue: 95 } },
  lightSeaGreen: { number: 37, hexadecimal: '#00afaf', rgb: { red: 0, green: 175, blue: 175 } },
  lightSkyBlue1: { number: 153, hexadecimal: '#afd7ff', rgb: { red: 175, green: 215, blue: 255 } },
  lightSkyBlue2: { number: 109, hexadecimal: '#87afaf', rgb: { red: 135, green: 175, blue: 175 } },
  lightSkyBlue3: { number: 110, hexadecimal: '#87afd7', rgb: { red: 135, green: 175, blue: 215 } },
  lightSlateBlue: { number: 105, hexadecimal: '#8787ff', rgb: { red: 135, green: 135, blue: 255 } },
  lightSlateGrey: { number: 103, hexadecimal: '#8787af', rgb: { red: 135, green: 135, blue: 175 } },
  lightSteelBlue: { number: 147, hexadecimal: '#afafff', rgb: { red: 175, green: 175, blue: 255 } },
  lightSteelBlue1: { number: 189, hexadecimal: '#d7d7ff', rgb: { red: 215, green: 215, blue: 255 } },
  lightSteelBlue2: { number: 146, hexadecimal: '#afafd7', rgb: { red: 175, green: 175, blue: 215 } },
  lightYellow1: { number: 187, hexadecimal: '#d7d7af', rgb: { red: 215, green: 215, blue: 175 } },
  lime: { number: 10, hexadecimal: '#00ff00', rgb: { red: 0, green: 255, blue: 0 } },
  magenta1: { number: 201, hexadecimal: '#ff00ff', rgb: { red: 255, green: 0, blue: 255 } },
  magenta2: { number: 165, hexadecimal: '#d700ff', rgb: { red: 215, green: 0, blue: 255 } },
  magenta3: { number: 200, hexadecimal: '#ff00d7', rgb: { red: 255, green: 0, blue: 215 } },
  magenta4: { number: 127, hexadecimal: '#af00af', rgb: { red: 175, green: 0, blue: 175 } },
  magenta5: { number: 163, hexadecimal: '#d700af', rgb: { red: 215, green: 0, blue: 175 } },
  magenta6: { number: 164, hexadecimal: '#d700d7', rgb: { red: 215, green: 0, blue: 215 } },
  maroon: { number: 1, hexadecimal: '#800000', rgb: { red: 128, green: 0, blue: 0 } },
  mediumOrchid1: { number: 134, hexadecimal: '#af5fd7', rgb: { red: 175, green: 95, blue: 215 } },
  mediumOrchid2: { number: 171, hexadecimal: '#d75fff', rgb: { red: 215, green: 95, blue: 255 } },
  mediumOrchid3: { number: 207, hexadecimal: '#ff5fff', rgb: { red: 255, green: 95, blue: 255 } },
  mediumOrchid4: { number: 133, hexadecimal: '#af5faf', rgb: { red: 175, green: 95, blue: 175 } },
  mediumPurple1: { number: 104, hexadecimal: '#8787d7', rgb: { red: 135, green: 135, blue: 215 } },
  mediumPurple2: { number: 141, hexadecimal: '#af87ff', rgb: { red: 175, green: 135, blue: 255 } },
  mediumPurple3: { number: 135, hexadecimal: '#af5fff', rgb: { red: 175, green: 95, blue: 255 } },
  mediumPurple4: { number: 140, hexadecimal: '#af87d7', rgb: { red: 175, green: 135, blue: 215 } },
  mediumPurple5: { number: 97, hexadecimal: '#875faf', rgb: { red: 135, green: 95, blue: 175 } },
  mediumPurple6: { number: 98, hexadecimal: '#875fd7', rgb: { red: 135, green: 95, blue: 215 } },
  mediumPurple7: { number: 60, hexadecimal: '#5f5f87', rgb: { red: 95, green: 95, blue: 135 } },
  mediumSpringGreen: { number: 49, hexadecimal: '#00ffaf', rgb: { red: 0, green: 255, blue: 175 } },
  mediumTurquoise: { number: 80, hexadecimal: '#5fd7d7', rgb: { red: 95, green: 215, blue: 215 } },
  mediumVioletRed: { number: 126, hexadecimal: '#af0087', rgb: { red: 175, green: 0, blue: 135 } },
  mistyRose1: { number: 224, hexadecimal: '#ffd7d7', rgb: { red: 255, green: 215, blue: 215 } },
  mistyRose2: { number: 181, hexadecimal: '#d7afaf', rgb: { red: 215, green: 175, blue: 175 } },
  navajoWhite1: { number: 223, hexadecimal: '#ffd7af', rgb: { red: 255, green: 215, blue: 175 } },
  navajoWhite2: { number: 144, hexadecimal: '#afaf87', rgb: { red: 175, green: 175, blue: 135 } },
  navy: { number: 4, hexadecimal: '#000080', rgb: { red: 0, green: 0, blue: 128 } },
  navyBlue: { number: 17, hexadecimal: '#00005f', rgb: { red: 0, green: 0, blue: 95 } },
  olive: { number: 3, hexadecimal: '#808000', rgb: { red: 128, green: 128, blue: 0 } },
  orange1: { number: 214, hexadecimal: '#ffaf00', rgb: { red: 255, green: 175, blue: 0 } },
  orange2: { number: 172, hexadecimal: '#d78700', rgb: { red: 215, green: 135, blue: 0 } },
  orange3: { number: 58, hexadecimal: '#5f5f00', rgb: { red: 95, green: 95, blue: 0 } },
  orange4: { number: 94, hexadecimal: '#875f00', rgb: { red: 135, green: 95, blue: 0 } },
  orangeRed: { number: 202, hexadecimal: '#ff5f00', rgb: { red: 255, green: 95, blue: 0 } },
  orchid1: { number: 170, hexadecimal: '#d75fd7', rgb: { red: 215, green: 95, blue: 215 } },
  orchid2: { number: 213, hexadecimal: '#ff87ff', rgb: { red: 255, green: 135, blue: 255 } },
  orchid3: { number: 212, hexadecimal: '#ff87d7', rgb: { red: 255, green: 135, blue: 215 } },
  paleGreen1: { number: 121, hexadecimal: '#87ffaf', rgb: { red: 135, green: 255, blue: 175 } },
  paleGreen2: { number: 156, hexadecimal: '#afff87', rgb: { red: 175, green: 255, blue: 135 } },
  paleGreen3: { number: 114, hexadecimal: '#87d787', rgb: { red: 135, green: 215, blue: 135 } },
  paleGreen4: { number: 77, hexadecimal: '#5fd75f', rgb: { red: 95, green: 215, blue: 95 } },
  paleTurquoise1: { number: 159, hexadecimal: '#afffff', rgb: { red: 175, green: 255, blue: 255 } },
  paleTurquoise2: { number: 66, hexadecimal: '#5f8787', rgb: { red: 95, green: 135, blue: 135 } },
  paleVioletRed: { number: 211, hexadecimal: '#ff87af', rgb: { red: 255, green: 135, blue: 175 } },
  pink1: { number: 218, hexadecimal: '#ffafd7', rgb: { red: 255, green: 175, blue: 215 } },
  pink2: { number: 175, hexadecimal: '#d787af', rgb: { red: 215, green: 135, blue: 175 } },
  plum1: { number: 219, hexadecimal: '#ffafff', rgb: { red: 255, green: 175, blue: 255 } },
  plum2: { number: 183, hexadecimal: '#d7afff', rgb: { red: 215, green: 175, blue: 255 } },
  plum3: { number: 176, hexadecimal: '#d787d7', rgb: { red: 215, green: 135, blue: 215 } },
  plum4: { number: 96, hexadecimal: '#875f87', rgb: { red: 135, green: 95, blue: 135 } },
  purple1: { number: 129, hexadecimal: '#af00ff', rgb: { red: 175, green: 0, blue: 255 } },
  purple2: { number: 5, hexadecimal: '#800080', rgb: { red: 128, green: 0, blue: 128 } },
  purple3: { number: 93, hexadecimal: '#8700ff', rgb: { red: 135, green: 0, blue: 255 } },
  purple4: { number: 56, hexadecimal: '#5f00d7', rgb: { red: 95, green: 0, blue: 215 } },
  purple5: { number: 54, hexadecimal: '#5f0087', rgb: { red: 95, green: 0, blue: 135 } },
  purple6: { number: 55, hexadecimal: '#5f00af', rgb: { red: 95, green: 0, blue: 175 } },
  red1: { number: 9, hexadecimal: '#ff0000', rgb: { red: 255, green: 0, blue: 0 } },
  red2: { number: 196, hexadecimal: '#ff0000', rgb: { red: 255, green: 0, blue: 0 } },
  red3: { number: 124, hexadecimal: '#af0000', rgb: { red: 175, green: 0, blue: 0 } },
  red4: { number: 160, hexadecimal: '#d70000', rgb: { red: 215, green: 0, blue: 0 } },
  rosyBrown: { number: 138, hexadecimal: '#af8787', rgb: { red: 175, green: 135, blue: 135 } },
  royalBlue: { number: 63, hexadecimal: '#5f5fff', rgb: { red: 95, green: 95, blue: 255 } },
  salmon: { number: 209, hexadecimal: '#ff875f', rgb: { red: 255, green: 135, blue: 95 } },
  sandyBrown: { number: 215, hexadecimal: '#ffaf5f', rgb: { red: 255, green: 175, blue: 95 } },
  seaGreen1: { number: 84, hexadecimal: '#5fff87', rgb: { red: 95, green: 255, blue: 135 } },
  seaGreen2: { number: 85, hexadecimal: '#5fffaf', rgb: { red: 95, green: 255, blue: 175 } },
  seaGreen3: { number: 83, hexadecimal: '#5fff5f', rgb: { red: 95, green: 255, blue: 95 } },
  seaGreen4: { number: 78, hexadecimal: '#5fd787', rgb: { red: 95, green: 215, blue: 135 } },
  silver: { number: 7, hexadecimal: '#c0c0c0', rgb: { red: 192, green: 192, blue: 192 } },
  skyBlue1: { number: 117, hexadecimal: '#87d7ff', rgb: { red: 135, green: 215, blue: 255 } },
  skyBlue2: { number: 111, hexadecimal: '#87afff', rgb: { red: 135, green: 175, blue: 255 } },
  skyBlue3: { number: 74, hexadecimal: '#5fafd7', rgb: { red: 95, green: 175, blue: 215 } },
  slateBlue1: { number: 99, hexadecimal: '#875fff', rgb: { red: 135, green: 95, blue: 255 } },
  slateBlue2: { number: 61, hexadecimal: '#5f5faf', rgb: { red: 95, green: 95, blue: 175 } },
  slateBlue3: { number: 62, hexadecimal: '#5f5fd7', rgb: { red: 95, green: 95, blue: 215 } },
  springGreen1: { number: 48, hexadecimal: '#00ff87', rgb: { red: 0, green: 255, blue: 135 } },
  springGreen2: { number: 42, hexadecimal: '#00d787', rgb: { red: 0, green: 215, blue: 135 } },
  springGreen3: { number: 47, hexadecimal: '#00ff5f', rgb: { red: 0, green: 255, blue: 95 } },
  springGreen4: { number: 35, hexadecimal: '#00af5f', rgb: { red: 0, green: 175, blue: 95 } },
  springGreen5: { number: 41, hexadecimal: '#00d75f', rgb: { red: 0, green: 215, blue: 95 } },
  springGreen6: { number: 29, hexadecimal: '#00875f', rgb: { red: 0, green: 135, blue: 95 } },
  steelBlue1: { number: 67, hexadecimal: '#5f87af', rgb: { red: 95, green: 135, blue: 175 } },
  steelBlue2: { number: 75, hexadecimal: '#5fafff', rgb: { red: 95, green: 175, blue: 255 } },
  steelBlue3: { number: 81, hexadecimal: '#5fd7ff', rgb: { red: 95, green: 215, blue: 255 } },
  steelBlue4: { number: 68, hexadecimal: '#5f87d7', rgb: { red: 95, green: 135, blue: 215 } },
  tan: { number: 180, hexadecimal: '#d7af87', rgb: { red: 215, green: 175, blue: 135 } },
  teal: { number: 6, hexadecimal: '#008080', rgb: { red: 0, green: 128, blue: 128 } },
  thistle1: { number: 225, hexadecimal: '#ffd7ff', rgb: { red: 255, green: 215, blue: 255 } },
  thistle2: { number: 182, hexadecimal: '#d7afd7', rgb: { red: 215, green: 175, blue: 215 } },
  turquoise1: { number: 45, hexadecimal: '#00d7ff', rgb: { red: 0, green: 215, blue: 255 } },
  turquoise2: { number: 30, hexadecimal: '#008787', rgb: { red: 0, green: 135, blue: 135 } },
  violet: { number: 177, hexadecimal: '#d787ff', rgb: { red: 215, green: 135, blue: 255 } },
  wheat1: { number: 229, hexadecimal: '#ffffaf', rgb: { red: 255, green: 255, blue: 175 } },
  wheat2: { number: 101, hexadecimal: '#87875f', rgb: { red: 135, green: 135, blue: 95 } },
  white1: { number: 15, hexadecimal: '#ffffff', rgb: { red: 255, green: 255, blue: 255 } },
  yellow1: { number: 11, hexadecimal: '#ffff00', rgb: { red: 255, green: 255, blue: 0 } },
  yellow2: { number: 226, hexadecimal: '#ffff00', rgb: { red: 255, green: 255, blue: 0 } },
  yellow3: { number: 190, hexadecimal: '#d7ff00', rgb: { red: 215, green: 255, blue: 0 } },
  yellow4: { number: 148, hexadecimal: '#afd700', rgb: { red: 175, green: 215, blue: 0 } },
  yellow5: { number: 184, hexadecimal: '#d7d700', rgb: { red: 215, green: 215, blue: 0 } },
  yellow6: { number: 100, hexadecimal: '#878700', rgb: { red: 135, green: 135, blue: 0 } },
  yellow7: { number: 106, hexadecimal: '#87af00', rgb: { red: 135, green: 175, blue: 0 } },
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
  open[key] = `\u001b[38;5;${value.number}m`;
  close[key] = '\u001b[39m';
  codes[key] = (...s) => `${open[key]}${s.join(' ')}${close[key]}`;

  const bgKey = `bg${key.substring(0, 1).toUpperCase()}${key.substring(1)}`;
  open[bgKey] = `\u001b[48;5;${value.number}m`;
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

codes.xtermColor = (c, ...s) => `\u001b[38;5;${c}m${s.join(' ')}'\u001b[39m'`;

codes.bgXtermColor = (c, ...s) => `\u001b[48;5;${c}m${s.join(' ')}'\u001b[49m'`;

module.exports = codes;
codes.open = open;
codes.close = close;
