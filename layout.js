/*
 * Galley: the document, its text set into lines, and the page written
 * as PostScript; pdf.js writes it as PDF from the same lines.
 *
 * This file is shared by the page in the browser, which draws what it
 * sets here on the screen, and by export.js, which writes the same
 * PostScript and PDF from the shell. All set the text by the same
 * widths, the fonts' own, so the screen and the printed page break
 * every line in the same place.
 *
 * Units are points, 1/72 inch. The document's y runs down the page from
 * its top edge, as on a screen; PostScript's runs up from the bottom,
 * and is turned only when the page is written.
 *
 * A document is plain data, kept as JSON:
 *
 *   { version: 1,
 *     page:    { width, height },
 *     margins: { top, bottom, left, right },
 *     columns: { count, gutter },
 *     guides:  { x: [...], y: [...] },          ruler guides, every page
 *     stories: [ { id, text, font, size, leading, align,
 *                  indent, spaceAfter, frames: [item ids] } ],
 *     pages:   [ { items: [ ... ] } ] }
 *
 * and an item is one of
 *
 *   { id, type: "line", x1, y1, x2, y2, stroke }
 *   { id, type: "rect", x, y, w, h, radius, stroke, fill }
 *   { id, type: "oval", x, y, w, h, stroke, fill }
 *   { id, type: "text", x, y, w, h, story }
 *
 * A stroke is null or { width, grey, dash }; a fill is null or a grey,
 * 0 black to 1 white, as setgray takes it. A story's text runs through
 * its frames in order, which may be on different pages.
 */
(function (root) {
    "use strict";

    /*
     * The encoding: what each byte of a string shown means. Latin-1,
     * as ISOLatin1Encoding, for the letters of western Europe; but the
     * straight quote and the grave at 0x27 and 0x60, as ASCII has them,
     * and the free places 0x80 to 0x9F filled as Windows fills them, with
     * dashes, curly quotes, the bullet and the ellipsis, which text
     * typed today is full of. Every font is given this encoding.
     */
    var ascii = ("space exclam quotedbl numbersign dollar percent ampersand quotesingle " +
        "parenleft parenright asterisk plus comma hyphen period slash " +
        "zero one two three four five six seven eight nine colon semicolon less equal greater question " +
        "at A B C D E F G H I J K L M N O P Q R S T U V W X Y Z " +
        "bracketleft backslash bracketright asciicircum underscore grave " +
        "a b c d e f g h i j k l m n o p q r s t u v w x y z braceleft bar braceright asciitilde").split(" ");
    var windows = [   /* 0x80 to 0x9F: the glyph, and the character it is */
        ["Euro", 0x20AC], null, ["quotesinglbase", 0x201A], ["florin", 0x0192],
        ["quotedblbase", 0x201E], ["ellipsis", 0x2026], ["dagger", 0x2020], ["daggerdbl", 0x2021],
        ["circumflex", 0x02C6], ["perthousand", 0x2030], ["Scaron", 0x0160], ["guilsinglleft", 0x2039],
        ["OE", 0x0152], null, ["Zcaron", 0x017D], null,
        null, ["quoteleft", 0x2018], ["quoteright", 0x2019], ["quotedblleft", 0x201C],
        ["quotedblright", 0x201D], ["bullet", 0x2022], ["endash", 0x2013], ["emdash", 0x2014],
        ["tilde", 0x02DC], ["trademark", 0x2122], ["scaron", 0x0161], ["guilsinglright", 0x203A],
        ["oe", 0x0153], null, ["zcaron", 0x017E], ["Ydieresis", 0x0178]];
    var latin1 = ("space exclamdown cent sterling currency yen brokenbar section " +
        "dieresis copyright ordfeminine guillemotleft logicalnot hyphen registered macron " +
        "degree plusminus twosuperior threesuperior acute mu paragraph periodcentered " +
        "cedilla onesuperior ordmasculine guillemotright onequarter onehalf threequarters questiondown " +
        "Agrave Aacute Acircumflex Atilde Adieresis Aring AE Ccedilla " +
        "Egrave Eacute Ecircumflex Edieresis Igrave Iacute Icircumflex Idieresis " +
        "Eth Ntilde Ograve Oacute Ocircumflex Otilde Odieresis multiply " +
        "Oslash Ugrave Uacute Ucircumflex Udieresis Yacute Thorn germandbls " +
        "agrave aacute acircumflex atilde adieresis aring ae ccedilla " +
        "egrave eacute ecircumflex edieresis igrave iacute icircumflex idieresis " +
        "eth ntilde ograve oacute ocircumflex otilde odieresis divide " +
        "oslash ugrave uacute ucircumflex udieresis yacute thorn ydieresis").split(" ");

    /* code to glyph name; character to code; code to character */
    var ENCODING = [], CODE = {}, UNICODE = [];
    (function () {
        var i;
        for (i = 0; i < 256; i++) { ENCODING.push(".notdef"); UNICODE.push(""); }
        for (i = 0; i < ascii.length; i++) { ENCODING[0x20 + i] = ascii[i]; CODE[0x20 + i] = 0x20 + i; }
        for (i = 0; i < windows.length; i++)
            if (windows[i]) { ENCODING[0x80 + i] = windows[i][0]; CODE[windows[i][1]] = 0x80 + i; }
        for (i = 0; i < latin1.length; i++) { ENCODING[0xA0 + i] = latin1[i]; CODE[0xA0 + i] = 0xA0 + i; }
        for (var c in CODE) UNICODE[CODE[c]] = String.fromCodePoint(+c);
        if (ascii.length !== 95 || latin1.length !== 96) throw new Error("encoding: wrong length");
    })();

    /* A character's code in the encoding; a character not in it is a
       question mark. The soft hyphen is dropped: we do not hyphenate. */
    function code(ch) {
        var c = CODE[ch.codePointAt(0)];
        return c === undefined ? 0x3F : c;
    }

    /*
     * The fonts: each a TrueType font, those that come with Galley, in
     * fonts/, and those the person using it adds. Each is registered with
     * what is needed to set text in it, read from the font's own tables
     * by truetype.js (metrics):
     *
     *   { name, family, style, weight, widths, ascent, descent }
     *
     * the name its PostScript name; family, style and weight the screen's,
     * for CSS; widths, by code, in thousandths of the em, -1 where the
     * font has no glyph; ascent and descent, the top and bottom of its
     * unaccented letters and figures, A to Z, a to z and 0 to 9, in the
     * same units. The screen draws the font itself, and the PostScript
     * and the PDF carry it: no printer is asked for a font by name.
     */
    var FONTS = [];

    function registerFont(f) {
        FONTS = FONTS.filter(function (g) { return g.name !== f.name; });
        FONTS.push(f);
    }

    function fontsAvailable() { return FONTS.slice(); }

    var NOFONT = { name: "", family: "serif", style: "", weight: "", widths: [], ascent: 750, descent: -250 };

    function fontInfo(name) {
        for (var i = 0; i < FONTS.length; i++) if (FONTS[i].name === name) return FONTS[i];
        return NOFONT;
    }

    /* The fonts a document's stories use. */
    function fontsUsed(doc) {
        var used = {};
        doc.stories.forEach(function (s) { used[s.font] = true; });
        return Object.keys(used);
    }

    /* The width of a code in a font at a size, in points: half an em for
       a font not registered, to go on with. */
    function charWidth(font, c, size) {
        var f = fontInfo(font);
        if (f === NOFONT) return 0.5 * size;
        return f.widths[c] > 0 ? f.widths[c] * size / 1000 : 0;
    }

    /* How far the font's letters rise above the baseline, and how far
       they fall below it, in points at a size; both positive. */
    function ascent(font, size) { return fontInfo(font).ascent * size / 1000; }

    function descent(font, size) { return -fontInfo(font).descent * size / 1000; }

    function textWidth(font, codes, size) {
        var s = 0;
        for (var i = 0; i < codes.length; i++) s += charWidth(font, codes[i], size);
        return s;
    }

    /* A piece of text as codes. */
    function codesOf(text) {
        var out = [];
        for (var i = 0; i < text.length; i++) {
            var cp = text.codePointAt(i);
            if (cp > 0xFFFF) i++;
            if (cp === 0xAD) continue;
            out.push(code(String.fromCodePoint(cp)));
        }
        return out;
    }

    /* Every item by its id, with the page it is on. */
    function indexItems(doc) {
        var index = {};
        doc.pages.forEach(function (page, p) {
            page.items.forEach(function (item) { index[item.id] = { page: p, item: item }; });
        });
        return index;
    }

    /*
     * Setting a story: its paragraphs into lines, the lines into its
     * frames, in order.
     *
     * In each frame, the first baseline is the font's ascent below the
     * frame's top, so that the tallest letters touch it; each line after
     * is the leading below the one before, and the space after a
     * paragraph is added to that. A line goes in a frame only if its
     * descent, too, is inside: if not, it begins the next frame, and so
     * does the rest. So every line lies inside its frame, top and
     * bottom, and a frame h points high holds 1 + (h - ascent - descent)
     * / leading lines, rounded down. Space after a paragraph that ends a
     * frame is not carried to the next frame's top.
     *
     * The words of a line are as many as fit, a space between each, by
     * the widths; a word wider than a whole line is cut where it must
     * be. A justified line, but the last of its paragraph, is stretched
     * to the frame's width by its spaces, as widthshow stretches them.
     *
     * The result: for each frame's id, its lines; and whether the text
     * ran out of frames before it ended.
     */
    function setStory(doc, story, index) {
        var result = { lines: {}, overflow: false };
        var frames = story.frames.map(function (id) { return index[id]; }).filter(Boolean);
        frames.forEach(function (f) { result.lines[f.item.id] = []; });
        if (!frames.length) { result.overflow = story.text.length > 0; return result; }

        var font = story.font, size = story.size, leading = story.leading || size * 1.2;
        var space = charWidth(font, 0x20, size);
        var up = ascent(font, size), down = descent(font, size);
        /* the frame we are in; the baseline of its last line, from its
           top, or null if it has none yet; and space after waiting */
        var fi = 0, last = null, pending = 0;

        /* Where the next line's baseline goes: in this frame, or the next
           that has room for one. Null when no frame has room. */
        function room() {
            while (fi < frames.length) {
                var b = last === null ? up : last + pending + leading;
                if (b + down <= frames[fi].item.h + 0.001) return b;
                fi++; last = null; pending = 0;
            }
            return null;
        }

        var paragraphs = story.text.replace(/\r\n?/g, "\n").split("\n");
        for (var p = 0; p < paragraphs.length; p++) {
            var words = paragraphs[p].split(/[ \t]+/).filter(function (w) { return w.length; })
                .map(function (w) { var c = codesOf(w); return { codes: c, width: textWidth(font, c, size) }; });
            var first = true, k = 0;
            var b;
            if (!words.length) {                       /* an empty paragraph: a blank line */
                if ((b = room()) === null) { result.overflow = true; return result; }
                last = b; pending = 0;
            }
            while (k < words.length) {
                if ((b = room()) === null) { result.overflow = true; return result; }
                var frame = frames[fi].item;
                /* the indent, but never more than half the frame */
                var indent = first ? Math.min(story.indent || 0, frame.w / 2) : 0;
                if (charWidth(font, words[k].codes[0], size) > frame.w - indent + 0.001) indent = 0;
                var avail = frame.w - indent;
                var line = [], width = 0;
                while (k < words.length) {
                    var w = words[k], next = width + (line.length ? space : 0) + w.width;
                    if (line.length && next > avail + 0.001) break;
                    if (!line.length && w.width > avail + 0.001) {
                        /* a word longer than the line: as much of it as fits */
                        var cut = 1, cw = charWidth(font, w.codes[0], size);
                        while (cut < w.codes.length && cw + charWidth(font, w.codes[cut], size) <= avail + 0.001)
                            cw += charWidth(font, w.codes[cut++], size);
                        line.push({ codes: w.codes.slice(0, cut), width: cw });
                        width = cw;
                        if (cut < w.codes.length) words[k] = { codes: w.codes.slice(cut), width: w.width - cw };
                        else k++;
                        break;
                    }
                    line.push(w); width = next; k++;
                }
                var last = k >= words.length, gaps = line.length - 1;
                var extra = 0, x = indent;
                if (story.align === "justify" && !last && gaps > 0) extra = (avail - width) / gaps;
                else if (story.align === "center") x += Math.max(0, avail - width) / 2;
                else if (story.align === "right") x += Math.max(0, avail - width);

                /* the words where they go, for the screen; the codes, for show */
                var placed = [], codes = [], at = x;
                line.forEach(function (w, i) {
                    if (i) { codes.push(0x20); at += space + extra; }
                    placed.push({ codes: w.codes, x: at, width: w.width });
                    codes = codes.concat(w.codes);
                    at += w.width;
                });
                result.lines[frame.id].push({
                    x: frame.x + x, baseline: frame.y + b,
                    codes: codes, extra: extra, words: placed, width: width
                });
                last = b; pending = 0;
                first = false;
            }
            if (last !== null) pending = story.spaceAfter || 0;
        }
        return result;
    }

    /* Every story set: lines by frame id, and the stories that ran over. */
    function setDocument(doc) {
        var index = indexItems(doc), lines = {}, overflow = {};
        doc.stories.forEach(function (story) {
            var r = setStory(doc, story, index);
            for (var id in r.lines) lines[id] = r.lines[id];
            overflow[story.id] = r.overflow;
        });
        return { lines: lines, overflow: overflow, index: index };
    }

    function storyById(doc, id) {
        for (var i = 0; i < doc.stories.length; i++) if (doc.stories[i].id === id) return doc.stories[i];
        return null;
    }

    /* The guides of a page: its edges, its margins, its columns' edges,
       and the ruler guides; x down the page, y across it. */
    function guides(doc) {
        var m = doc.margins, c = doc.columns, W = doc.page.width, H = doc.page.height;
        var xs = [0, W, m.left, W - m.right], ys = [0, H, m.top, H - m.bottom];
        var cols = columns(doc);
        cols.forEach(function (col) { xs.push(col.x, col.x + col.w); });
        return { x: xs.concat(doc.guides.x), y: ys.concat(doc.guides.y), columns: cols };
    }

    function columns(doc) {
        var m = doc.margins, n = Math.max(1, doc.columns.count | 0), g = doc.columns.gutter;
        var inner = doc.page.width - m.left - m.right, w = (inner - (n - 1) * g) / n, out = [];
        for (var i = 0; i < n; i++) out.push({ x: m.left + i * (w + g), w: w });
        return out;
    }

    /*
     * The PostScript. Plain and readable, Level 2 only where it must be
     * (setpagedevice, for the page's size): each font given the encoding
     * above under a short name, each page's items in the order they lie,
     * the bottom first, and each line of text at its own place, by
     * moveto, then show, or widthshow for a justified line.
     */
    function num(v) {
        var s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
        return s === "-0" ? "0" : s;
    }

    function psString(codes) {
        var s = "(";
        for (var i = 0; i < codes.length; i++) {
            var c = codes[i];
            if (c === 0x28 || c === 0x29 || c === 0x5C) s += "\\" + String.fromCharCode(c);
            else if (c >= 0x20 && c < 0x7F) s += String.fromCharCode(c);
            else s += "\\" + ("00" + c.toString(8)).slice(-3);
        }
        return s + ")";
    }

    function encodingPS() {
        var lines = [], line = "/PUencoding [";
        ENCODING.forEach(function (name) {
            var w = "/" + name;
            if (line.length + w.length + 1 > 76) { lines.push(line); line = " "; }
            line += (line === " " || line.endsWith("[") ? "" : " ") + w;
        });
        lines.push(line + "] def");
        return lines.join("\n");
    }

    function pathFor(item, H) {
        var x = item.x, y = H - item.y - item.h, w = item.w, h = item.h, out = [];
        if (item.type === "oval") {
            out.push("matrix currentmatrix " + num(x + w / 2) + " " + num(y + h / 2) + " translate " +
                num(Math.max(w / 2, 0.01)) + " " + num(Math.max(h / 2, 0.01)) + " scale");
            out.push("0 0 1 0 360 arc closepath setmatrix");
            return out;
        }
        var r = Math.min(item.radius || 0, Math.abs(w) / 2, Math.abs(h) / 2);
        if (r > 0) {
            out.push(num(x + r) + " " + num(y) + " moveto");
            out.push(num(x + w) + " " + num(y) + " " + num(x + w) + " " + num(y + h) + " " + num(r) + " arct");
            out.push(num(x + w) + " " + num(y + h) + " " + num(x) + " " + num(y + h) + " " + num(r) + " arct");
            out.push(num(x) + " " + num(y + h) + " " + num(x) + " " + num(y) + " " + num(r) + " arct");
            out.push(num(x) + " " + num(y) + " " + num(x + w) + " " + num(y) + " " + num(r) + " arct closepath");
        } else {
            out.push(num(x) + " " + num(y) + " " + num(w) + " " + num(h) + " box");
        }
        return out;
    }

    function strokePS(stroke) {
        var dash = stroke.dash ? "[" + num(stroke.width * 3) + " " + num(stroke.width * 2) + "] 0" : "[] 0";
        return num(stroke.width) + " setlinewidth " + num(stroke.grey) + " setgray " + dash + " setdash stroke";
    }

    /*
     * Every font goes with the PostScript, its own program, a Type 42
     * font, in the setup, as a resource: programs(name) gives it, a
     * string of bytes, or null if it is not to be had, and then the
     * PostScript asks for the font by name only.
     */
    function toPostScript(doc, title, programs) {
        var set = setDocument(doc), H = doc.page.height, W = doc.page.width;
        var used = {}, keys = {}, n = 0, supplied = {};
        doc.stories.forEach(function (s) { if (!used[s.font]) { used[s.font] = true; keys[s.font] = "F" + (++n); } });
        Object.keys(used).forEach(function (f) {
            var prog = programs && programs(f);
            if (prog) supplied[f] = prog;
        });
        var needed = Object.keys(used).filter(function (f) { return !supplied[f]; });

        var out = [];
        out.push("%!PS-Adobe-3.0");
        out.push("%%Title: " + (title || "Untitled").replace(/[\r\n]/g, " "));
        out.push("%%Creator: Galley");
        out.push("%%Pages: " + doc.pages.length);
        out.push("%%BoundingBox: 0 0 " + Math.ceil(W) + " " + Math.ceil(H));
        if (needed.length) out.push("%%DocumentNeededResources: font " + needed.join(" "));
        if (Object.keys(supplied).length) out.push("%%DocumentSuppliedResources: font " + Object.keys(supplied).join(" "));
        out.push("%%EndComments");
        out.push("%%BeginProlog");
        out.push("% Every font is given this encoding: Latin-1, with Windows's quotes and dashes.");
        out.push(encodingPS());
        out.push("% name font  reencode  -   the font, given PUencoding, defined under name");
        out.push("/reencode { findfont dup length dict begin");
        out.push("  { 1 index /FID ne { def } { pop pop } ifelse } forall");
        out.push("  /Encoding PUencoding def currentdict end definefont pop } bind def");
        out.push("% x y w h  box  -   a rectangle, as a path");
        out.push("/box { 4 2 roll moveto 1 index 0 rlineto 0 exch rlineto neg 0 rlineto closepath } bind def");
        out.push("% name size  F  -   set the font");
        out.push("/F { exch findfont exch scalefont setfont } bind def");
        out.push("%%EndProlog");
        out.push("%%BeginSetup");
        out.push("<< /PageSize [" + num(W) + " " + num(H) + "] >> setpagedevice");
        Object.keys(supplied).forEach(function (f) {
            out.push("%%BeginResource: font " + f);
            out.push(supplied[f].replace(/\n$/, ""));
            out.push("%%EndResource");
        });
        Object.keys(used).forEach(function (f) { out.push("/" + keys[f] + " /" + f + " reencode"); });
        out.push("%%EndSetup");

        doc.pages.forEach(function (page, p) {
            out.push("%%Page: " + (p + 1) + " " + (p + 1));
            page.items.forEach(function (item) {
                if (item.type === "line") {
                    if (!item.stroke) return;
                    out.push("newpath " + num(item.x1) + " " + num(H - item.y1) + " moveto " +
                        num(item.x2) + " " + num(H - item.y2) + " lineto");
                    out.push(strokePS(item.stroke));
                } else if (item.type === "rect" || item.type === "oval") {
                    if (!item.stroke && item.fill == null) return;
                    out.push("newpath");
                    out = out.concat(pathFor(item, H));
                    if (item.fill != null) out.push((item.stroke ? "gsave " : "") + num(item.fill) + " setgray fill" +
                        (item.stroke ? " grestore" : ""));
                    if (item.stroke) out.push(strokePS(item.stroke));
                } else if (item.type === "text") {
                    var lines = set.lines[item.id], story = storyById(doc, item.story);
                    if (!lines || !lines.length || !story) return;
                    out.push("0 setgray /" + keys[story.font] + " " + num(story.size) + " F");
                    lines.forEach(function (l) {
                        var at = num(l.x) + " " + num(H - l.baseline) + " moveto ";
                        if (l.extra) out.push(at + num(l.extra) + " 0 32 " + psString(l.codes) + " widthshow");
                        else out.push(at + psString(l.codes) + " show");
                    });
                }
            });
            out.push("showpage");
        });
        out.push("%%Trailer");
        out.push("%%EOF");
        return out.join("\n") + "\n";
    }

    /* A new document: A4, margins of 20 mm, two columns. A4 is 595 by 842
       points, as printers have it, whole points. */
    function newDocument() {
        var mm = 72 / 25.4;
        return {
            version: 1,
            page: { width: 595, height: 842 },
            margins: { top: 20 * mm, bottom: 20 * mm, left: 20 * mm, right: 20 * mm },
            columns: { count: 2, gutter: 5 * mm },
            guides: { x: [], y: [] },
            stories: [],
            pages: [{ items: [] }],
            nextId: 1
        };
    }

    var api = {
        ENCODING: ENCODING, UNICODE: UNICODE, code: code, codesOf: codesOf,
        registerFont: registerFont, fontsAvailable: fontsAvailable, fontInfo: fontInfo, fontsUsed: fontsUsed,
        charWidth: charWidth, textWidth: textWidth, ascent: ascent, descent: descent,
        setDocument: setDocument, storyById: storyById, indexItems: indexItems,
        guides: guides, columns: columns, toPostScript: toPostScript, newDocument: newDocument,
        encodingPS: encodingPS, num: num
    };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.Galley = api;
})(this);
