/* The example newsletter, examples/gazette.json, written out from here
   so that its numbers can be read: node make-gazette.js > gazette.json */
var mm = 72 / 25.4, W = 595, H = 842, M = 20 * mm, G = 5 * mm;
var colW = (W - 2 * M - G) / 2, c1 = M, c2 = M + colW + G, bottom = H - M;
var body = [
  "Before there were programs for it, a page was made on a board. Type came from the typesetter in long strips of paper, a column wide; the strips were cut with a knife, waxed on the back, and laid down on a sheet ruled in pale blue, which the camera did not see. Headlines, rules and boxes went down the same way. The board was photographed, and the photograph became the plate.",
  "The first programs for the desk did the same thing, and called it by the same name. A page sat on a pasteboard, with guides for the margins and the columns. Text was poured into a column, and where it ran over, the rest was carried to the next, by hand, as a strip of paper had been. Nothing was hidden: what the screen showed was what the printer would print, near enough.",
  "“Near enough” is the interesting part. The screen had its own fonts, drawn for its pixels, and the printer had others, described as outlines in PostScript. The program set the text by the printer’s widths, and drew it with the screen’s letters, stretched or squeezed to fit. So the lines broke in the same places on both, though the letters differed.",
  "This page was made the same way. Its lines were broken by the widths its fonts carry in their own tables; on the screen and on paper they are drawn from the same fonts, which go with the page. Åsa, Örjan and Märta would find their names spelt right — and the dashes, the quotes and the ellipsis… are all there.",
  "A column on a board could be any width, and a story could jump from page one to page four, with a line at the bottom to say so. The knife made that easy and the program had to make it easy too: each block of text knows the block it came from and the block it goes to, and the words run through them in order, whatever page each is on.",
  "Justified text was the typesetter's pride. Every line but a paragraph's last is spread to the full width by widening its spaces, never its letters; a line with few spaces and long words shows wide gaps, which hyphenation would close. In PostScript the spreading is one operator, widthshow, which adds the same amount to every space as it shows the line.",
  "Rules and boxes were tape, in a dozen weights from a hairline to a heavy bar, and tints were sheets of dots, ten per cent to eighty, cut to shape and burnished down. Here they are a weight and a shade of grey; the dots are made later, by whatever prints the page.",
  "What it leaves out is most of what came later: styles, kerning, hyphenation, pictures, colour. Those are the next rounds. A page with columns, rules, boxes and text that runs from one column to the next is already most of what a newsletter needs."
].join("\n");
var doc = {
  version: 1, title: "The Galley Gazette",
  page: { width: W, height: H },
  margins: { top: M, bottom: M, left: M, right: M },
  columns: { count: 2, gutter: G },
  guides: { x: [], y: [140] },
  stories: [
    { id: "s1", text: "The Galley Gazette", font: "PTSerif-Bold", size: 40, leading: 44, align: "center", indent: 0, spaceAfter: 0, frames: ["i1"] },
    { id: "s2", text: "On boards, knives and wax — and the programs that took their place", font: "PTSans-Italic", size: 11, leading: null, align: "center", indent: 0, spaceAfter: 0, frames: ["i3"] },
    { id: "s3", text: body, font: "PTSerif-Regular", size: 11, leading: 14, align: "justify", indent: 14, spaceAfter: 0, frames: ["i4", "i5", "i20"] },
    { id: "s4", text: "A board, a knife and a pot of wax: the tools a program on the desk replaced.", font: "PTSans-Regular", size: 9, leading: 11, align: "center", indent: 0, spaceAfter: 0, frames: ["i7"] },
    { id: "s5", text: "Set by Galley.", font: "CourierPrime-Regular", size: 9, leading: null, align: "right", indent: 0, spaceAfter: 0, frames: ["i22"] }
  ],
  pages: [
    { items: [
      { id: "i1", type: "text", x: M, y: M, w: W - 2 * M, h: 48, story: "s1" },
      { id: "i2", type: "line", x1: M, y1: M + 54, x2: W - M, y2: M + 54, stroke: { width: 2, grey: 0, dash: false } },
      { id: "i8", type: "line", x1: M, y1: M + 57, x2: W - M, y2: M + 57, stroke: { width: 0.5, grey: 0, dash: false } },
      { id: "i3", type: "text", x: M, y: M + 64, w: W - 2 * M, h: 16, story: "s2" },
      { id: "i4", type: "text", x: c1, y: 140, w: colW, h: bottom - 140, story: "s3" },
      { id: "i5", type: "text", x: c2, y: 140, w: colW, h: 70, story: "s3" },
      { id: "i6", type: "rect", x: c2, y: 490, w: colW, h: bottom - 490, radius: 10, stroke: { width: 0.5, grey: 0, dash: false }, fill: 0.9 },
      { id: "i9", type: "oval", x: c2 + colW / 2 - 70, y: 520, w: 140, h: 140, stroke: { width: 1, grey: 0.4, dash: false }, fill: 1 },
      { id: "i10", type: "rect", x: c2 + colW / 2 - 30, y: 560, w: 60, h: 60, radius: 0, stroke: { width: 4, grey: 0, dash: false }, fill: 0.6 },
      { id: "i7", type: "text", x: c2 + 16, y: 700, w: colW - 32, h: 40, story: "s4" }
    ] },
    { items: [
      { id: "i20", type: "text", x: c1, y: M, w: W - 2 * M, h: 200, story: "s3" },
      { id: "i21", type: "rect", x: M, y: 300, w: W - 2 * M, h: 200, radius: 0, stroke: { width: 1, grey: 0, dash: true }, fill: null },
      { id: "i23", type: "line", x1: M, y1: 520, x2: W - M, y2: 720, stroke: { width: 0.25, grey: 0, dash: false } },
      { id: "i22", type: "text", x: M, y: bottom - 14, w: W - 2 * M, h: 14, story: "s5" }
    ] }
  ],
  nextId: 30
  };
process.stdout.write(JSON.stringify(doc, null, 1) + "\n");
