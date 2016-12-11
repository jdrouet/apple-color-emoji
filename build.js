var fontkit = require('fontkit');
var fs = require('fs');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var punycode = require('punycode');
var regenerate = require('regenerate');

// delete the images directory and re-create it
rimraf.sync(__dirname + '/images');
mkdirp.sync(__dirname + '/images');

var set = regenerate();
var extraParts = [];
var collectionPath = '/System/Library/Fonts/Apple Color Emoji.ttc'; // >= OS X 10.12
var fontPath = '/System/Library/Fonts/Apple Color Emoji.ttf' // <= OS X 10.11

function getFont() {
  if (fs.existsSync(collectionPath)) return fontkit.openSync(collectionPath).fonts[0]; // both fonts in the collection seem to be identical
  if (fs.existsSync(fontPath)) return fontkit.openSync(fontPath);
  console.log('Could not find the emoji font');
  return null;
}

// Optionally specify characters in case identical glyphs can be produced with two distinct sets of characters
// e.g. 🇨🇵 and 🇫🇷
function writeImage(glyph, unicode_characters) {
  // extract an image for this glyph
  var image = glyph.getImageForSize(64);

  if (image) {
    // compute the filename
    var name = (unicode_characters || punycode.ucs2.encode(glyph.codePoints.slice()))
      .split('')
      .map(function(c) { return ('0000' + c.charCodeAt(0).toString(16)).slice(-4) });

    // add codepoint to regex
    // if only one codepoint, we can add via regenerate (which compresses the regex)
    // otherwise, track the codepoints separately to be added later
    if (glyph.codePoints.length == 1) {
      set.add(glyph.codePoints[0]);
    } else {
      extraParts.push('\\u' + name.join('\\ufe0f?\\u'));
    }

    fs.writeFileSync(__dirname + '/images/' + name.join('-') + '.png', image.data);
  }
}

var font = getFont();
if (font) {
  var REGIONAL_INDICATORS = '🇦🇧🇨🇩🇪🇫🇬🇭🇮🇯🇰🇱🇲🇳🇴🇵🇶🇷🇸🇹🇺🇻🇼🇽🇾🇿'.match(/../g);
  var FEMALE = '\u200D\u2640'
  var MODIFIERS = ['⃠', '⃣', '🏻', '🏼', '🏽', '🏾', '🏿'];

  // write longest characters first so regex works correctly
  // first, the flag glyphs

  REGIONAL_INDICATORS.forEach(function(first) {
    REGIONAL_INDICATORS.forEach(function(second) {
      var glyphs = font.layout(first + second).glyphs;
      if (glyphs.length === 1) {
        writeImage(glyphs[0], first + second)
      }
    });
  });

  font.characterSet.forEach(function(codePoint) {
    MODIFIERS.forEach(function(modifier) {
      writeImageIfNecessary(codePoint, modifier + FEMALE);
      writeImageIfNecessary(codePoint, modifier);
    });
    writeImageIfNecessary(codePoint, FEMALE);
    writeImage(font.glyphForCodePoint(codePoint));
  });

  function writeImageIfNecessary(codePoint, modifier) {
    var glyphs = font.layout(punycode.ucs2.encode([codePoint]) + modifier).glyphs;

    if (glyphs.length === 1) {
      writeImage(glyphs[0]);
    }
  }

  // write the generated regex to a file to be included by the runtime module
  fs.writeFileSync(__dirname + '/regex.js',
    '/* AUTOGENERATED. DO NOT EDIT. */\n' +
    'module.exports = ' + new RegExp('(?:' + extraParts.sort().reverse().join('|') + '|' + set + ')[\\uFE00-\\uFE0D\\uFE0F]?(?!\\uFE0E)', 'g') + ';\n');
}
