/* The example of the bundled fonts, examples/fonts.json, written out
   from here so that its numbers can be read:
   node make-fonts.js > fonts.json
   A page in PT Serif, PT Sans and Courier Prime, which come with
   Galley and go with every page it writes. */
var mm = 72 / 25.4, W = 595, H = 842, M = 20 * mm, G = 5 * mm;
var colW = (W - 2 * M - G) / 2, c1 = M, c2 = M + colW + G, bottom = H - M;
var body = [
  "A printer of 1985 had its fonts inside it, thirty-five of them in the end, and a page that asked for Times or Helvetica by name was printed in them. A font it had not got had to be sent with the page: a Type 1 font, as an outline program, before the page that used it.",
  "TrueType came later, and printers learned to take it too, wrapped as PostScript: Type 42, whose glyphs are TrueType's own tables, carried in strings. This page is set in three families made for the screen and for print, PT Serif and PT Sans, drawn by ParaType, and Courier Prime, a better Courier. They are free, under the SIL Open Font License, so they may go with the program, and with every page it writes.",
  "Galley sends with the page each font it uses: into PostScript as a Type 42 font, keeping only the glyphs its encoding reaches; into PDF as the TrueType file itself. Nothing is asked of the printer but the language.",
  "Åsa, Örjan and Märta are here too, with “quotes”, dashes — and the ellipsis…"
].join("\n");
var list = ["Regular", "Italic", "Bold", "BoldItalic"];
var specimens = [];
["PTSerif", "PTSans", "CourierPrime"].forEach(function (fam) {
  list.forEach(function (style) { specimens.push(fam + "-" + style); });
});
var stories = [
  { id: "s1", text: "Fonts that come along", font: "PTSerif-Bold", size: 34, leading: 38, align: "left", indent: 0, spaceAfter: 0, frames: ["i1"] },
  { id: "s2", text: "Type 42: TrueType, carried in PostScript", font: "PTSans-Italic", size: 13, leading: 16, align: "left", indent: 0, spaceAfter: 0, frames: ["i2"] },
  { id: "s3", text: body, font: "PTSerif-Regular", size: 10.5, leading: 13.5, align: "justify", indent: 12, spaceAfter: 0, frames: ["i4", "i5"] }
];
var items = [
  { id: "i1", type: "text", x: M, y: M, w: W - 2 * M, h: 44, story: "s1" },
  { id: "i2", type: "text", x: M, y: M + 46, w: W - 2 * M, h: 20, story: "s2" },
  { id: "i3", type: "line", x1: M, y1: M + 72, x2: W - M, y2: M + 72, stroke: { width: 1, grey: 0, dash: false } },
  { id: "i4", type: "text", x: c1, y: M + 84, w: colW, h: 190, story: "s3" },
  { id: "i5", type: "text", x: c2, y: M + 84, w: colW, h: 190, story: "s3" },
  { id: "i6", type: "rect", x: M, y: 360, w: W - 2 * M, h: 12 * 26 + 24, radius: 6, stroke: { width: 0.5, grey: 0, dash: false }, fill: 0.95 }
];
specimens.forEach(function (name, k) {
  var id = "s" + (10 + k);
  stories.push({ id: id, text: name + ": Hamburgefonstiv 0123 äöå “Æ” — …", font: name, size: 13, leading: 17, align: "left", indent: 0, spaceAfter: 0, frames: ["t" + k] });
  items.push({ id: "t" + k, type: "text", x: M + 14, y: 372 + 26 * k, w: W - 2 * M - 28, h: 22, story: id });
});
var doc = {
  version: 1, title: "Fonts that come along",
  page: { width: W, height: H },
  margins: { top: M, bottom: M, left: M, right: M },
  columns: { count: 2, gutter: G },
  guides: { x: [], y: [] },
  stories: stories,
  pages: [{ items: items }],
  nextId: 100
};
process.stdout.write(JSON.stringify(doc, null, 1) + "\n");
