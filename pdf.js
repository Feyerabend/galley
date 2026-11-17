/*
 * The document written as PDF, without a PostScript interpreter: the
 * same lines, set once by layout.js, drawn with PDF's own operators,
 * which are PostScript's, renamed and without the language. Each font
 * goes in as it is, a TrueType file (FontFile2), with its widths and
 * the encoding the text is written in.
 *
 *   var bytes = GalleyPDF.toPDF(doc, title, fonts)
 *
 * fonts(name) gives { ttf, deflated } for a font the document uses: its
 * file, and, if it could be made, the file compressed with zlib's
 * deflate, which PDF reads as FlateDecode. The page and the content
 * streams are left as text, to be read.
 *
 * What PostScript says, PDF says thus:
 *
 *   x y moveto, lineto                x y m, l
 *   setlinewidth, setgray, setdash    w; g for fill, G for stroke; d
 *   fill, stroke; both                f, S; B
 *   x y w h box                       x y w h re
 *   arc, arct                         curves, c: PDF has no arcs, so a
 *                                     circle is four, each a quarter
 *   F, moveto, show                   BT /F1 size Tf x y Td (...) Tj ET
 *   a 0 32 (...) widthshow            a Tw (...) Tj: the word spacing,
 *                                     added to every byte 32, as there
 */
(function (root) {
    "use strict";
    var L = typeof module !== "undefined" && module.exports ? require("./layout.js") : root.Galley;
    var num = L.num, KAPPA = 0.5522847498;

    function pdfString(codes) {
        var s = "(";
        for (var i = 0; i < codes.length; i++) {
            var c = codes[i];
            if (c === 0x28 || c === 0x29 || c === 0x5C) s += "\\" + String.fromCharCode(c);
            else if (c >= 0x20 && c < 0x7F) s += String.fromCharCode(c);
            else s += "\\" + ("00" + c.toString(8)).slice(-3);
        }
        return s + ")";
    }

    function textString(s) {
        var out = "(";
        for (var i = 0; i < s.length; i++) {
            var c = L.code(s[i]);
            out += c === 0x28 || c === 0x29 || c === 0x5C ? "\\" + s[i] : c >= 0x20 && c < 0x7F ? s[i] : "\\" + ("00" + c.toString(8)).slice(-3);
        }
        return out + ")";
    }

    /* A path for a box, rounded or not, or an oval; y up, as PDF's. */
    function pathFor(item, H) {
        var x = item.x, y = H - item.y - item.h, w = item.w, h = item.h;
        if (item.type === "oval") {
            var rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry, kx = KAPPA * rx, ky = KAPPA * ry;
            return [num(cx + rx) + " " + num(cy) + " m",
                num(cx + rx) + " " + num(cy + ky) + " " + num(cx + kx) + " " + num(cy + ry) + " " + num(cx) + " " + num(cy + ry) + " c",
                num(cx - kx) + " " + num(cy + ry) + " " + num(cx - rx) + " " + num(cy + ky) + " " + num(cx - rx) + " " + num(cy) + " c",
                num(cx - rx) + " " + num(cy - ky) + " " + num(cx - kx) + " " + num(cy - ry) + " " + num(cx) + " " + num(cy - ry) + " c",
                num(cx + kx) + " " + num(cy - ry) + " " + num(cx + rx) + " " + num(cy - ky) + " " + num(cx + rx) + " " + num(cy) + " c h"];
        }
        var r = Math.min(item.radius || 0, Math.abs(w) / 2, Math.abs(h) / 2);
        if (!(r > 0)) return [num(x) + " " + num(y) + " " + num(w) + " " + num(h) + " re"];
        var k = KAPPA * r, x1 = x + w, y1 = y + h;
        return [num(x + r) + " " + num(y) + " m",
            num(x1 - r) + " " + num(y) + " l",
            num(x1 - r + k) + " " + num(y) + " " + num(x1) + " " + num(y + r - k) + " " + num(x1) + " " + num(y + r) + " c",
            num(x1) + " " + num(y1 - r) + " l",
            num(x1) + " " + num(y1 - r + k) + " " + num(x1 - r + k) + " " + num(y1) + " " + num(x1 - r) + " " + num(y1) + " c",
            num(x + r) + " " + num(y1) + " l",
            num(x + r - k) + " " + num(y1) + " " + num(x) + " " + num(y1 - r + k) + " " + num(x) + " " + num(y1 - r) + " c",
            num(x) + " " + num(y + r) + " l",
            num(x) + " " + num(y + r - k) + " " + num(x + r - k) + " " + num(y) + " " + num(x + r) + " " + num(y) + " c h"];
    }

    function strokeOps(stroke) {
        var dash = stroke.dash ? "[" + num(stroke.width * 3) + " " + num(stroke.width * 2) + "] 0 d" : "[] 0 d";
        return num(stroke.width) + " w " + num(stroke.grey) + " G " + dash;
    }

    function toPDF(doc, title, fonts) {
        var set = L.setDocument(doc), H = doc.page.height, W = doc.page.width;
        var objects = [];           /* each an array of parts: strings, one byte a character, and Uint8Arrays */
        function add(parts) { objects.push(parts); return objects.length; }
        function stream(dict, data) {
            var bytes = typeof data === "string" ? data : data;
            return ["<< " + dict + " /Length " + bytes.length + " >>\nstream\n", bytes, "\nendstream"];
        }

        /* the fonts: each its file, its descriptor, and the font */
        var used = L.fontsUsed(doc), fontRef = {}, fontKey = {};
        used.forEach(function (name, i) {
            var f = fonts(name), m = L.fontInfo(name);
            if (!f) throw new Error("the font " + name + " is not loaded");
            var file = f.deflated
                ? add(stream("/Filter /FlateDecode /Length1 " + f.ttf.length, f.deflated))
                : add(stream("/Length1 " + f.ttf.length, f.ttf));
            var bbox = m.bbox || [-200, m.descent, 1200, m.ascent];
            var flags = 32 | (m.style === "italic" ? 64 : 0);
            var descriptor = add(["<< /Type /FontDescriptor /FontName /" + name + " /Flags " + flags +
                " /FontBBox [" + bbox.map(num).join(" ") + "] /ItalicAngle " + num(m.italicAngle || 0) +
                " /Ascent " + num(m.ascent) + " /Descent " + num(m.descent) + " /CapHeight " + num(m.capHeight || m.ascent) +
                " /StemV 80 /FontFile2 " + file + " 0 R >>"]);
            var widths = [], diffs = [];
            for (var c = 32; c < 256; c++) {
                widths.push(num(m.widths[c] > 0 ? m.widths[c] : 0));
                diffs.push("/" + L.ENCODING[c]);
            }
            var lines = [];
            for (var k = 0; k < widths.length; k += 16) lines.push(widths.slice(k, k + 16).join(" "));
            fontKey[name] = "F" + (i + 1);
            fontRef[name] = add(["<< /Type /Font /Subtype /TrueType /BaseFont /" + name +
                " /FirstChar 32 /LastChar 255 /Widths [\n" + lines.join("\n") + "]\n/FontDescriptor " + descriptor + " 0 R" +
                " /Encoding << /Type /Encoding /Differences [32 " + diffs.join(" ") + "] >> >>"]);
        });
        var fontDict = "<< " + used.map(function (n) { return "/" + fontKey[n] + " " + fontRef[n] + " 0 R"; }).join(" ") + " >>";

        /* the pages: each its content, drawn as toPostScript draws it */
        var pagesRef = objects.length + doc.pages.length * 2 + 1;  /* the Pages object comes after them */
        var kids = [];
        doc.pages.forEach(function (page) {
            var out = [];
            page.items.forEach(function (item) {
                if (item.type === "line") {
                    if (!item.stroke) return;
                    out.push(strokeOps(item.stroke));
                    out.push(num(item.x1) + " " + num(H - item.y1) + " m " + num(item.x2) + " " + num(H - item.y2) + " l S");
                } else if (item.type === "rect" || item.type === "oval") {
                    if (!item.stroke && item.fill == null) return;
                    if (item.fill != null) out.push(num(item.fill) + " g");
                    if (item.stroke) out.push(strokeOps(item.stroke));
                    out = out.concat(pathFor(item, H));
                    out.push(item.fill != null && item.stroke ? "B" : item.fill != null ? "f" : "S");
                } else if (item.type === "text") {
                    var lines = set.lines[item.id], story = L.storyById(doc, item.story);
                    if (!lines || !lines.length || !story) return;
                    out.push("0 g BT /" + fontKey[story.font] + " " + num(story.size) + " Tf");
                    var x0 = 0, y0 = 0;
                    lines.forEach(function (l) {
                        var x = l.x, y = H - l.baseline;
                        out.push(num(x - x0) + " " + num(y - y0) + " Td " + num(l.extra || 0) + " Tw " + pdfString(l.codes) + " Tj");
                        x0 = x; y0 = y;
                    });
                    out.push("ET");
                }
            });
            var content = add(stream("", out.join("\n") + "\n"));
            kids.push(add(["<< /Type /Page /Parent " + pagesRef + " 0 R /MediaBox [0 0 " + num(W) + " " + num(H) + "]" +
                " /Resources << /Font " + fontDict + " >> /Contents " + content + " 0 R >>"]));
        });
        var pages = add(["<< /Type /Pages /Kids [" + kids.map(function (k) { return k + " 0 R"; }).join(" ") + "] /Count " + kids.length + " >>"]);
        if (pages !== pagesRef) throw new Error("pdf.js: the pages' object is not where it was said to be");
        var catalog = add(["<< /Type /Catalog /Pages " + pages + " 0 R >>"]);
        var info = add(["<< /Title " + textString(title || "Untitled") + " /Producer (Galley) >>"]);

        /* the file: header, objects, the table of where each begins, trailer */
        var parts = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"], offsets = [], length = parts[0].length;
        objects.forEach(function (o, i) {
            offsets.push(length);
            var all = [(i + 1) + " 0 obj\n"].concat(o, ["\nendobj\n"]);
            all.forEach(function (p) { parts.push(p); length += p.length; });
        });
        var xref = "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n" +
            offsets.map(function (o) { return ("000000000" + o).slice(-10) + " 00000 n \n"; }).join("") +
            "trailer\n<< /Size " + (objects.length + 1) + " /Root " + catalog + " 0 R /Info " + info + " 0 R >>\n" +
            "startxref\n" + length + "\n%%EOF\n";
        parts.push(xref); length += xref.length;

        var bytes = new Uint8Array(length), at = 0;
        parts.forEach(function (p) {
            if (typeof p === "string") { for (var i = 0; i < p.length; i++) bytes[at++] = p.charCodeAt(i) & 0xFF; }
            else { bytes.set(p, at); at += p.length; }
        });
        return bytes;
    }

    var api = { toPDF: toPDF };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.GalleyPDF = api;
})(this);
