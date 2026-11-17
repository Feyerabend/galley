/*
 * The fonts that come with Galley, made scripts the page can load:
 *
 *   node tools/pack-fonts.js
 *
 * reads every TrueType font in the folders of fonts/ and writes, in
 * fonts/, one script a font, its file as it is, in base 64, and
 * index.js, the list: each font's name, its screen family and style,
 * its licence, its script, and its metrics (truetype.js), by which the
 * page sets text before it has loaded a single font. A page opened as a
 * file may not fetch the files beside it, but it may run the scripts it
 * names, when it names them; so a font is loaded only when it is shown
 * or printed. The fonts are not changed: the scripts carry the files
 * as they came, each under its own licence, beside it.
 */
"use strict";
var fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
var L = require(path.join(root, "layout.js")), T = require(path.join(root, "truetype.js"));

function script(call, value) {
    return "/* Made by tools/pack-fonts.js: do not edit. */\n" +
        "(function (root) {\n" +
        "    var value = " + value + ";\n" +
        "    if (typeof module !== \"undefined\" && module.exports) module.exports = value;\n" +
        "    else root." + call + ";\n" +
        "})(this);\n";
}

var dir = path.join(root, "fonts"), list = [];
fs.readdirSync(dir).filter(function (d) { return fs.statSync(path.join(dir, d)).isDirectory(); }).sort().forEach(function (d) {
    var licence = fs.readdirSync(path.join(dir, d)).filter(function (f) { return /^(OFL|LICEN[CS]E)/i.test(f); })[0];
    fs.readdirSync(path.join(dir, d)).filter(function (f) { return /\.ttf$/i.test(f); }).sort().forEach(function (f) {
        var bytes = fs.readFileSync(path.join(dir, d, f)), m = T.metrics(new Uint8Array(bytes), L.ENCODING, L.UNICODE);
        var file = m.name + ".js";
        fs.writeFileSync(path.join(dir, file), script("GALLEY_FONT_LOADED(value)",
            JSON.stringify({ name: m.name, ttf: bytes.toString("base64") })));
        list.push({
            name: m.name, familyName: m.familyName, styleName: m.styleName, style: m.style, weight: m.weight,
            script: "fonts/" + file, file: "fonts/" + d + "/" + f, licence: licence ? "fonts/" + d + "/" + licence : null,
            ascent: +m.ascent.toFixed(3), descent: +m.descent.toFixed(3),
            bbox: m.bbox.map(function (v) { return +v.toFixed(3); }), italicAngle: m.italicAngle, capHeight: +m.capHeight.toFixed(3),
            widths: m.widths.map(function (w) { return +w.toFixed(3); })
        });
    });
});
fs.writeFileSync(path.join(dir, "index.js"), script("GALLEY_FONTS = value",
    "[\n" + list.map(function (f) { return "        " + JSON.stringify(f); }).join(",\n") + "]"));
console.log("fonts/index.js: " + list.length + " fonts");
