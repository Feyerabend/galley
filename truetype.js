/*
 * A TrueType font made a Type 42 font: a PostScript font whose glyphs
 * are TrueType's, kept in its tables, which PostScript carries in the
 * strings of an array, sfnts. A PostScript printer that takes TrueType
 * takes it as Type 42, as Ghostscript does.
 *
 *   var t = TrueType.read(bytes);   t.name, t.family, t.style, ...
 *   var ps = TrueType.type42(bytes, encoding, unicode);   the program,
 *        a string of bytes, one character each
 *
 * encoding is the glyph name of each code, 0 to 255, and unicode the
 * character of each (layout.js's ENCODING and UNICODE): the font's
 * CharStrings map each name to the glyph its cmap gives the character.
 *
 * Only what a printer needs is kept: the tables head, hhea, maxp,
 * hmtx, loca and glyf, and cvt, fpgm and prep, the hinting's; not the
 * cmap, the names, the kerning and the rest. And only the glyphs the
 * encoding reaches, with the parts of any composite among them: the
 * others are left empty, with their numbers kept, so that nothing else
 * changes. PT Sans, made for Cyrillic too, has 720 glyphs; the 218 the
 * encoding reaches are kept, with their parts, and its 442,960 bytes
 * become 87,304.
 *
 * The strings of sfnts are 65,534 bytes at most, and end where a table
 * or a glyph ends, as the Type 42 specification asks; each is even in
 * length, since every table and glyph is padded to four bytes.
 */
(function (root) {
    "use strict";

    function u16(b, at) { return b[at] << 8 | b[at + 1]; }
    function s16(b, at) { var v = u16(b, at); return v & 0x8000 ? v - 0x10000 : v; }
    function u32(b, at) { return (b[at] << 24 >>> 0) + (b[at + 1] << 16 | b[at + 2] << 8 | b[at + 3]); }

    /* The tables, by tag: where each begins and how long it is. */
    function tables(b) {
        var v = u32(b, 0);
        if (v === 0x4F54544F) throw new Error("an OpenType font with CFF outlines, which Galley cannot read: only TrueType outlines");
        if (v !== 0x00010000 && v !== 0x74727565) throw new Error("not a TrueType font");
        var n = u16(b, 4), out = {};
        for (var i = 0; i < n; i++) {
            var at = 12 + 16 * i, tag = String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
            out[tag] = { offset: u32(b, at + 8), length: u32(b, at + 12) };
        }
        ["head", "hhea", "maxp", "hmtx", "loca", "glyf", "cmap"].forEach(function (t) {
            if (!out[t]) throw new Error("no " + t + " table");
        });
        return out;
    }

    /* A string of the name table: Windows's, in UTF-16, or the Mac's. */
    function nameOf(b, t, id) {
        if (!t.name) return "";
        var base = t.name.offset, n = u16(b, base + 2), strings = base + u16(b, base + 4), mac = "";
        for (var i = 0; i < n; i++) {
            var r = base + 6 + 12 * i, platform = u16(b, r), nameId = u16(b, r + 6);
            var len = u16(b, r + 8), at = strings + u16(b, r + 10), s = "";
            if (nameId !== id) continue;
            if (platform === 3) {
                for (var k = 0; k < len; k += 2) s += String.fromCharCode(u16(b, at + k));
                return s;
            }
            if (platform === 1 && !mac) for (k = 0; k < len; k++) mac += String.fromCharCode(b[at + k]);
        }
        return mac;
    }

    /* The glyph of a character, by the cmap: format 12, or 4. */
    function cmapper(b, t) {
        var base = t.cmap.offset, n = u16(b, base + 2), best = null, rank = 0;
        for (var i = 0; i < n; i++) {
            var r = base + 4 + 8 * i, p = u16(b, r), e = u16(b, r + 2), sub = base + u32(b, r + 4), f = u16(b, sub);
            var score = p === 3 && e === 10 && f === 12 ? 3 : p === 3 && e === 1 && f === 4 ? 2 : p === 0 && (f === 4 || f === 12) ? 1 : 0;
            if (score > rank) { rank = score; best = sub; }
        }
        if (!best) throw new Error("no Unicode cmap");
        if (u16(b, best) === 12) {
            var groups = u32(b, best + 12);
            return function (c) {
                for (var g = 0; g < groups; g++) {
                    var at = best + 16 + 12 * g, lo = u32(b, at), hi = u32(b, at + 4);
                    if (c >= lo && c <= hi) return u32(b, at + 8) + c - lo;
                }
                return 0;
            };
        }
        var segs = u16(b, best + 6) / 2, ends = best + 14, starts = ends + 2 * segs + 2;
        var deltas = starts + 2 * segs, offsets = deltas + 2 * segs;
        return function (c) {
            for (var s = 0; s < segs; s++) {
                if (c > u16(b, ends + 2 * s)) continue;
                var start = u16(b, starts + 2 * s);
                if (c < start) return 0;
                var ro = u16(b, offsets + 2 * s);
                if (!ro) return (c + u16(b, deltas + 2 * s)) & 0xFFFF;
                var g = u16(b, offsets + 2 * s + ro + 2 * (c - start));
                return g ? (g + u16(b, deltas + 2 * s)) & 0xFFFF : 0;
            }
            return 0;
        };
    }

    function read(b) {
        var t = tables(b), head = t.head.offset;
        var upem = u16(b, head + 18);
        return {
            tables: t, upem: upem,
            name: nameOf(b, t, 6).replace(/[^\x21-\x7E]|[\[\](){}<>\/%]/g, "") || "TrueType",
            family: nameOf(b, t, 1), style: nameOf(b, t, 2), notice: nameOf(b, t, 0),
            bbox: [s16(b, head + 36), s16(b, head + 38), s16(b, head + 40), s16(b, head + 42)],
            longLoca: s16(b, head + 50) === 1,
            glyphs: u16(b, t.maxp.offset + 4),
            glyph: cmapper(b, t)
        };
    }

    /* Where each glyph's data is, by the loca table. */
    function locations(b, f) {
        var at = f.tables.loca.offset, out = [];
        for (var i = 0; i <= f.glyphs; i++) out.push(f.longLoca ? u32(b, at + 4 * i) : 2 * u16(b, at + 2 * i));
        return out;
    }

    /* The glyphs a composite is made of. */
    function parts(b, at) {
        var out = [], flags;
        if (s16(b, at) >= 0) return out;
        at += 10;
        do {
            flags = u16(b, at);
            out.push(u16(b, at + 2));
            at += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
        } while (flags & 0x20);
        return out;
    }

    function type42(b, encoding, unicode) {
        var f = read(b), loca = locations(b, f), glyf = f.tables.glyf.offset;
        var keep = { 0: true }, names = { ".notdef": 0 };
        function need(g) {
            if (keep[g] || g >= f.glyphs) return;
            keep[g] = true;
            if (loca[g + 1] > loca[g]) parts(b, glyf + loca[g]).forEach(need);
        }
        for (var c = 0; c < 256; c++) {
            if (encoding[c] === ".notdef" || !unicode[c] || names[encoding[c]] !== undefined) continue;
            var g = f.glyph(unicode[c].codePointAt(0));
            if (g) { names[encoding[c]] = g; need(g); }
        }

        /* glyf and loca again: the glyphs kept, each padded to four */
        var glyphs = [], newLoca = [0], size = 0;
        for (var i = 0; i < f.glyphs; i++) {
            var len = keep[i] ? loca[i + 1] - loca[i] : 0, padded = (len + 3) & ~3;
            var data = new Uint8Array(padded);
            if (len) data.set(b.subarray(glyf + loca[i], glyf + loca[i] + len));
            glyphs.push(data);
            size += padded;
            newLoca.push(size);
        }
        var locaBytes = new Uint8Array(4 * newLoca.length);
        newLoca.forEach(function (v, k) { locaBytes[4 * k] = v >>> 24; locaBytes[4 * k + 1] = v >>> 16 & 255; locaBytes[4 * k + 2] = v >>> 8 & 255; locaBytes[4 * k + 3] = v & 255; });

        function copy(tag) {
            var t = f.tables[tag];
            return t ? b.slice(t.offset, t.offset + t.length) : null;
        }
        var head = copy("head");
        head[50] = 0; head[51] = 1;                      /* loca is long now */
        head[8] = head[9] = head[10] = head[11] = 0;     /* the checksum of the whole: not kept */
        var order = ["cvt ", "fpgm", "head", "hhea", "hmtx", "loca", "maxp", "prep", "glyf"];
        var data = { head: head, loca: locaBytes };
        order.forEach(function (tag) { if (!data[tag] && tag !== "glyf") data[tag] = copy(tag); });
        order = order.filter(function (tag) { return tag === "glyf" || data[tag]; });

        /* the directory, then each table, four-aligned, glyf last */
        var n = order.length, dir = new Uint8Array(12 + 16 * n), dv = new DataView(dir.buffer);
        var pow = 1, log = 0;
        while (pow * 2 <= n) { pow *= 2; log++; }
        dv.setUint32(0, 0x00010000); dv.setUint16(4, n); dv.setUint16(6, 16 * pow); dv.setUint16(8, log); dv.setUint16(10, 16 * n - 16 * pow);
        var offset = dir.length;
        order.forEach(function (tag, k) {
            var len = tag === "glyf" ? size : data[tag].length, sum = 0, bytes = data[tag];
            if (tag === "glyf") glyphs.forEach(function (g) { for (var j = 0; j < g.length; j += 4) sum = (sum + ((g[j] << 24 >>> 0) + (g[j + 1] << 16 | g[j + 2] << 8 | g[j + 3]))) >>> 0; });
            else for (var j = 0; j < len; j += 4) sum = (sum + ((bytes[j] << 24 >>> 0) + ((bytes[j + 1] || 0) << 16 | (bytes[j + 2] || 0) << 8 | (bytes[j + 3] || 0)))) >>> 0;
            for (var c = 0; c < 4; c++) dir[12 + 16 * k + c] = tag.charCodeAt(c);
            dv.setUint32(12 + 16 * k + 4, sum); dv.setUint32(12 + 16 * k + 8, offset); dv.setUint32(12 + 16 * k + 12, len);
            offset += (len + 3) & ~3;
        });

        /* the pieces, in order, each ending where a table or glyph ends */
        var pieces = [dir];
        order.forEach(function (tag) {
            if (tag === "glyf") { glyphs.forEach(function (g) { if (g.length) pieces.push(g); }); return; }
            var t = data[tag], padded = new Uint8Array((t.length + 3) & ~3);
            padded.set(t);
            pieces.push(padded);
        });
        var strings = [], current = [], length = 0;
        pieces.forEach(function (p) {
            if (p.length > 65534) throw new Error("a table too long for one string");
            if (length + p.length > 65534) { strings.push(current); current = []; length = 0; }
            current.push(p); length += p.length;
        });
        if (current.length) strings.push(current);

        var hex = "0123456789ABCDEF", out = [];
        function str(s) { return "(" + s.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "") + ")"; }
        out.push("%!PS-TrueTypeFont-1.0-1.0");
        out.push("%%Title: " + f.name);
        if (f.notice) out.push("% " + f.notice.replace(/[\r\n]+/g, " "));
        out.push("% Made a Type 42 font by Galley's truetype.js, from the TrueType font.");
        out.push("11 dict begin");
        out.push("/FontName /" + f.name + " def");
        out.push("/FontType 42 def");
        out.push("/PaintType 0 def");
        out.push("/FontMatrix [1 0 0 1 0 0] readonly def");
        out.push("/FontBBox [" + f.bbox.map(function (v) { return +(v / f.upem).toFixed(6); }).join(" ") + "] readonly def");
        out.push("/FontInfo 3 dict dup begin");
        out.push("/FamilyName " + str(f.family) + " readonly def");
        out.push("/Notice " + str(f.notice) + " readonly def");
        out.push("end readonly def");
        out.push("/Encoding StandardEncoding def");
        var keys = Object.keys(names);
        out.push("/CharStrings " + keys.length + " dict dup begin");
        keys.forEach(function (k) { out.push("/" + k + " " + names[k] + " def"); });
        out.push("end readonly def");
        out.push("/sfnts [");
        strings.forEach(function (group) {
            var line = "<";
            group.forEach(function (p) {
                for (var j = 0; j < p.length; j++) {
                    line += hex[p[j] >> 4] + hex[p[j] & 15];
                    if (line.length >= 72) { out.push(line); line = ""; }
                }
            });
            out.push(line + ">");
        });
        out.push("] readonly def");
        out.push("FontName currentdict end definefont pop");
        return out.join("\n") + "\n";
    }

    /*
     * What Galley sets text by, from the font's own tables, no
     * interpreter asked: for each code of the encoding, the width of its
     * glyph, from hmtx, in thousandths of the em, -1 if the font has none;
     * and the ascent and descent, the top and bottom of the unaccented
     * letters and figures, A to Z, a to z and 0 to 9, from the bounds
     * each glyph's header in glyf gives. Its style, bold or italic, from
     * head's macStyle; for a PDF's font descriptor, its box, from head,
     * its slant, from post, and its capitals' height, from OS/2. These
     * are the widths a printer uses: they are
     * what stringwidth gives for the Type 42 font, as was checked on
     * the fonts that come with Galley, all 2,616 widths, against a
     * PostScript interpreter's.
     */
    function metrics(b, encoding, unicode) {
        var f = read(b), t = f.tables;
        var metricsCount = u16(b, t.hhea.offset + 34), hmtx = t.hmtx.offset;
        function advance(g) { return u16(b, hmtx + 4 * Math.min(g, metricsCount - 1)); }
        var loca = locations(b, f), glyf = t.glyf.offset;
        var widths = [];
        for (var c = 0; c < 256; c++) {
            var g = encoding[c] !== ".notdef" && unicode[c] ? f.glyph(unicode[c].codePointAt(0)) : 0;
            widths.push(g ? advance(g) * 1000 / f.upem : -1);
        }
        var top = -1e9, bottom = 1e9;
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("").forEach(function (ch) {
            var g = f.glyph(ch.charCodeAt(0));
            if (!g || loca[g + 1] === loca[g]) return;
            top = Math.max(top, s16(b, glyf + loca[g] + 8));
            bottom = Math.min(bottom, s16(b, glyf + loca[g] + 4));
        });
        if (top < bottom) { top = 0.75 * f.upem; bottom = -0.25 * f.upem; }
        var mac = u16(b, t.head.offset + 44), unit = 1000 / f.upem;
        var italic = t.post ? s16(b, t.post.offset + 4) + u16(b, t.post.offset + 6) / 65536 : 0;
        var os2 = t["OS/2"], cap = os2 && u16(b, os2.offset) >= 2 ? s16(b, os2.offset + 88) : 0;
        return {
            name: f.name, familyName: f.family || f.name, styleName: f.style,
            weight: mac & 1 ? "bold" : "", style: mac & 2 ? "italic" : "",
            widths: widths, ascent: top * unit, descent: bottom * unit,
            bbox: f.bbox.map(function (v) { return v * unit; }), italicAngle: italic, capHeight: cap * unit
        };
    }

    var api = { read: read, type42: type42, metrics: metrics };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.TrueType = api;
})(this);
