# Galley

A page-layout program in one page of the browser, after the first
PageMaker: a page on a pasteboard, guides for margins and columns, text
poured into a column and carried on to the next, rules and boxes in a
few weights and greys, and the pages written as PostScript or as PDF.
A galley was the long tray the typesetter's columns waited in before
they were made up into pages.

It needs no server and no build: open `index.html` in a browser, as a
file. It comes with three families of fonts, free ones, and takes
others from the person using it.

## The idea

A page-layout program and a printer split the work in one place: the
program decides where every word goes, and the printer draws the
letters there. To decide, the program needs the width of every
character, the same widths the printer will use. Galley's fonts are
TrueType fonts, and it reads the widths from the fonts' own tables:
the advance of each glyph, in `hmtx`, which is what a printer uses.
For the fonts that come with it, all 2,616 widths were checked against
a PostScript interpreter's `stringwidth`: the same.

With the widths, the text is set once, in [`layout.js`](layout.js),
and that one setting is used three times: the screen draws each word
where it says, and the PostScript and the PDF put each line where it
says. The screen draws the fonts themselves, given to the browser as
font faces, so what it shows is what prints.

## The code

| File | What it is |
|------|------------|
| [`index.html`](index.html) | the program: menus, toolbox, rulers, the pasteboard and page drawn on a canvas, the panel at the right, page setup, undo, the fonts |
| [`layout.js`](layout.js) | the document, the encoding, the fonts registered, the text set into lines, the guides, and the PostScript written |
| [`pdf.js`](pdf.js) | the same lines written as PDF |
| [`truetype.js`](truetype.js) | a TrueType font read: its metrics, and the font made a Type 42 font for PostScript |
| [`fonts/`](fonts) | the fonts that come with Galley, each family in a folder with its licence; and each font as a script, with `index.js`, the list and the metrics |
| [`export.js`](export.js) | a document written as PostScript or PDF from the shell |
| [`tools/pack-fonts.js`](tools/pack-fonts.js) | makes the scripts in `fonts/` from the fonts in its folders |
| [`tools/compare.py`](tools/compare.py) | compares two pictures, pixel by pixel, for the tests |
| [`examples/`](examples) | `pagemaker.json`, a page on what PageMaker was; `gazette.json`, a newsletter of two pages; and `fonts.json`, a page in all twelve fonts; each made by its `make-*.js`; each as a script too, with `index.js`, made by `tools/pack-examples.js`; and pictures of them |

### Setting text

A story is its text and its type specs, and the list of its frames,
the text blocks it runs through, which may be on different pages.

- A frame's first baseline is the font's ascent below its top, so that
  the tallest letters touch the top; each line after is the leading
  below the one before. A line goes in the frame only if its descent
  is inside it too; if not, it and the rest go on in the next frame.
  The ascent and descent are the top and bottom of the font's
  unaccented letters and figures, from the bounds in `glyf`.
- A line holds as many words as fit, a space's width between each; a
  word wider than the whole line is cut where it must be.
- Left, centre and right move the line. Justified lines, but the last
  of a paragraph, are spread to the frame's width by their spaces.
- A paragraph's first line may be indented, by no more than half the
  frame, and a paragraph may have space after it, dropped where it
  ends a frame.
- What does not fit in the last frame is kept, and the frame's bottom
  tab shows a red triangle: click it, then click in a column or drag
  a frame, and the text runs on into it.

### The encoding

Text typed today is Unicode; the fonts are given one encoding of
ours, Latin-1 with Windows's quotes, dashes, bullet, ellipsis and euro
in the places 0x80 to 0x9F. A character outside it is set as a
question mark.

### The PostScript

Plain and readable: a prologue, the page's size, each font, then each
page's items, every line of text at its own place, a justified line
one `widthshow`. Each font goes with the page as a Type 42 font, a
PostScript font whose glyphs are TrueType's, in the strings of
`sfnts`, made by `truetype.js`: nine of the font's tables, and only
the glyphs the encoding reaches, about 220, with the parts of any
glyph made of others. PT Sans's 442,960 bytes become 87,304.

### The PDF

`pdf.js` writes the same lines with PDF's operators, which are
PostScript's without the language: `m`, `l`, `re`, `w`, `g`, `d`,
`f`, `S`, and for text `Tf`, `Td` and `Tj`, a justified line's spaces
widened by `Tw`, as `widthshow` widens them. PDF has no arcs, so an
oval is four Bézier curves, and a rounded corner one. Each font goes
in as its TrueType file, unchanged, with its widths and the encoding,
compressed where the browser can (`CompressionStream`).

## Run it

Open `index.html` in a browser. To try the examples, File, then one
of the examples at the foot of the menu; or open the page with the
example's name after it:

```
index.html?example=pagemaker     what PageMaker was, in 1985
index.html?example=gazette       a newsletter of two pages
index.html?example=fonts         the twelve fonts that come with Galley
```

which works where the page is served, as by GitHub Pages, so that a
link shows a page set before anything is downloaded, and where it is
opened as a file. Served, the page fetches the example's JSON; as a
file it may not, and loads the example's script instead, as it loads
the fonts. The document open before is replaced, as by File, Open.

From the shell:

```
node export.js examples/gazette.json > gazette.ps
node export.js --pdf examples/gazette.json > gazette.pdf
```

A browser will not let a page opened as a file read the files beside
it, but it will run the scripts the page names, when it names them.
So each font is also a script, in `fonts/`, and is loaded only when
the screen shows it or a page is written in it; the metrics, in
`fonts/index.js`, come first, so that text is set before any font is
loaded.

### The fonts

The fonts that come with Galley, in `fonts/`, from Google's fonts:

- PT Serif and PT Sans, by ParaType, under the SIL Open Font License
  1.1, `fonts/ptserif/OFL.txt` and `fonts/ptsans/OFL.txt`;
- Courier Prime, by the Courier Prime Project Authors, under the same
  licence, `fonts/courierprime/OFL.txt`;

each in roman, italic, bold and bold italic. The licence lets the
fonts go with a program, and into the documents it makes. The files
are as they came; the scripts carry the same files. The names "PT
Serif", "PT Sans" and "ParaType" are reserved by their licence for the
fonts as ParaType made them.

File, Add fonts, and Add a folder of fonts, take TrueType fonts from
the person using the page; of a folder, the other files are passed
over. They are read in the page, kept in the browser (IndexedDB), and
offered beside the others; File, Forget the added fonts removes them.
A font with the name of one already here is not taken, nor a font with
no letter, A to Z or a to z.

## What is missing, on purpose

- **Type 1 fonts**, and OpenType fonts with CFF outlines: reading their
  widths needs their programs run or their outlines decoded.
- **The standard 35** by name: a printer has them, but their widths
  are not here, and their files are not ours to send.
- **A proof drawn by a PostScript interpreter**: the screen draws the
  fonts themselves; the PostScript can be opened in Ghostscript or
  Preview.
- Master pages, pictures, type within a paragraph, kerning,
  hyphenation, tabs, text around a shape, rotation, colour.

## Tests

`make test` writes each example as PostScript and as PDF, and has
Ghostscript, used here only as a referee and not part of Galley, draw
both: its pictures of the PostScript must be those kept,
`examples/*-N.png`, and its pictures of the PDF those of the
PostScript, by `tools/compare.py`, which forgives an edge one pixel
over and a colour one level off. Ghostscript must say nothing of the
PDF. `make expect` makes the pictures kept again. `make fonts` makes
the scripts in `fonts/` again.

## How this was made

Galley is the narrow form of a larger program, which proofs its pages
on a PostScript interpreter of its own; this one keeps what does not
need that: the layout, the screen, the PostScript, and a PDF writer of
its own. Tried in a Chromium browser: the examples opened, set, drawn
in their fonts, written as PostScript and PDF; the PDF's compression
undone again to the font's file; a TrueType font added from a file,
kept across a load of the page, drawn on the screen and written into
both. The PDF of each example matches the PostScript to the pixel, but
for edges, in Ghostscript's pictures. Not tried: Safari, Firefox, and
the page opened as a file, which the browser used cannot open.

## Licence

Galley's own code: not yet given. The fonts: each under its own
licence, beside it in `fonts/`.
