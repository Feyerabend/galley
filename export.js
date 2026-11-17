/*
 * A Galley document written from the shell, as PostScript or as PDF:
 *
 *   node export.js document.json > document.ps
 *   node export.js --pdf document.json > document.pdf
 *
 * by the same code the page uses, with the fonts that come with Galley,
 * fonts/index.js and the files beside it. A font the document asks for
 * that is not among them is an error: there is no printer's font to
 * fall back on, and no widths for it.
 */
"use strict";
var fs = require("fs"), path = require("path"), zlib = require("zlib");
var L = require("./layout.js"), T = require("./truetype.js"), P = require("./pdf.js");

var args = process.argv.slice(2), pdf = args[0] === "--pdf";
if (pdf) args.shift();
if (args.length !== 1) {
    process.stderr.write("usage: node export.js [--pdf] document.json > out\n");
    process.exit(2);
}

var files = {};
require("./fonts/index.js").forEach(function (f) {
    files[f.name] = f;
    L.registerFont({ name: f.name, family: "serif", style: f.style, weight: f.weight, widths: f.widths,
        ascent: f.ascent, descent: f.descent, bbox: f.bbox, italicAngle: f.italicAngle, capHeight: f.capHeight });
});
function ttf(name) {
    if (!files[name]) { process.stderr.write("export.js: no font " + name + "\n"); process.exit(1); }
    return new Uint8Array(fs.readFileSync(path.join(__dirname, files[name].file)));
}

var doc = JSON.parse(fs.readFileSync(args[0], "utf8")), title = doc.title || path.basename(args[0], ".json");
L.fontsUsed(doc).forEach(ttf);
if (pdf) {
    process.stdout.write(Buffer.from(P.toPDF(doc, title, function (name) {
        var b = ttf(name);
        return { ttf: b, deflated: new Uint8Array(zlib.deflateSync(b)) };
    })));
} else {
    process.stdout.write(Buffer.from(L.toPostScript(doc, title, function (name) {
        return T.type42(ttf(name), L.ENCODING, L.UNICODE);
    }), "latin1"));
}
