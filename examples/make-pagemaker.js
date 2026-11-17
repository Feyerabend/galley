/* The example of what PageMaker was, examples/pagemaker.json, written
   out from here so that its numbers can be read:
   node make-pagemaker.js > pagemaker.json
   Its facts were checked against the Computer History Museum's oral
   history of Paul Brainerd and other accounts; where they disagree, as
   on the year of the first version for the PC, the page says nothing. */
var mm = 72 / 25.4, W = 595, H = 842, M = 20 * mm, G = 5 * mm;
var colW = (W - 2 * M - G) / 2, c1 = M, c2 = M + colW + G, bottom = H - M;
var body = [
  "In July 1985 a small company in Seattle, Aldus, founded the year before by Paul Brainerd, shipped a program for the Apple Macintosh called PageMaker. It put a page on the screen as a sheet on a pasteboard, with guides for its margins and columns, and let text be poured into a column and carried on to the next, and rules and boxes be drawn around it.",
  "It needed a printer to match, and there was one. Apple's LaserWriter had come out that January, and inside it ran Adobe's PostScript, a language for describing pages, with its fonts as outlines. PageMaker did not print dots: it wrote PostScript, and the printer drew the page from it, at its own resolution. Brainerd called the three together, the Macintosh, the LaserWriter with PostScript, and PageMaker, a three-legged stool.",
  "He wanted a name for it, too, short and plain, to set it apart from the costly typesetting systems newspapers used. He chose “desktop publishing”, and the name stayed with the trade it began.",
  "A newsletter, a menu, a club's magazine: work that had gone to a typesetter and a paste-up artist with a knife and wax could now be done at a desk, by one person, and look printed.",
  "Adobe bought Aldus in 1994. It brought out InDesign in 1999, and PageMaker 7.0, in 2001, was the last of it; Adobe stopped its work on it in 2004.",
  "This page was made with Galley, a small program of the same kind, in a browser: its columns, its rules and its boxes, and the text carried from block to block, as PageMaker showed them."
].join("\n");
var timeline = [
  "1984  Aldus is founded in Seattle",
  "1985  January: the LaserWriter, with PostScript",
  "1985  July: PageMaker, for the Macintosh",
  "1994  Adobe buys Aldus",
  "1999  Adobe's InDesign",
  "2001  PageMaker 7.0, the last version",
  "2004  Its development stops"
].join("\n");
var doc = {
  version: 1, title: "PageMaker, 1985",
  page: { width: W, height: H },
  margins: { top: M, bottom: M, left: M, right: M },
  columns: { count: 2, gutter: G },
  guides: { x: [], y: [] },
  stories: [
    { id: "s1", text: "PageMaker, 1985", font: "PTSerif-Bold", size: 38, leading: 42, align: "left", indent: 0, spaceAfter: 0, frames: ["i1"] },
    { id: "s2", text: "How a page came to be made at a desk", font: "PTSans-Italic", size: 14, leading: 17, align: "left", indent: 0, spaceAfter: 0, frames: ["i2"] },
    { id: "s3", text: body, font: "PTSerif-Regular", size: 10.5, leading: 14, align: "justify", indent: 12, spaceAfter: 0, frames: ["i4", "i5"] },
    { id: "s4", text: "“Desktop publishing”", font: "PTSerif-Italic", size: 20, leading: 24, align: "center", indent: 0, spaceAfter: 0, frames: ["i7"] },
    { id: "s5", text: "the name Paul Brainerd gave it", font: "PTSans-Regular", size: 9.5, leading: 12, align: "center", indent: 0, spaceAfter: 0, frames: ["i8"] },
    { id: "s6", text: timeline, font: "CourierPrime-Regular", size: 9.5, leading: 15, align: "left", indent: 0, spaceAfter: 0, frames: ["i10"] },
    { id: "s7", text: "Set with Galley; the fonts PT Serif, PT Sans and Courier Prime.", font: "PTSans-Regular", size: 8, leading: 10, align: "right", indent: 0, spaceAfter: 0, frames: ["i12"] }
  ],
  pages: [
    { items: [
      { id: "i1", type: "text", x: M, y: M, w: W - 2 * M, h: 46, story: "s1" },
      { id: "i2", type: "text", x: M, y: M + 48, w: W - 2 * M, h: 20, story: "s2" },
      { id: "i3", type: "line", x1: M, y1: M + 76, x2: W - M, y2: M + 76, stroke: { width: 2, grey: 0, dash: false } },
      { id: "i4", type: "text", x: c1, y: M + 90, w: colW, h: 245, story: "s3" },
      { id: "i5", type: "text", x: c2, y: M + 90, w: colW, h: 245, story: "s3" },
      { id: "i6", type: "rect", x: M, y: 410, w: W - 2 * M, h: 80, radius: 0, stroke: null, fill: 0.92 },
      { id: "i7", type: "text", x: M, y: 426, w: W - 2 * M, h: 28, story: "s4" },
      { id: "i8", type: "text", x: M, y: 458, w: W - 2 * M, h: 16, story: "s5" },
      { id: "i9", type: "line", x1: M, y1: 520, x2: W - M, y2: 520, stroke: { width: 0.5, grey: 0, dash: false } },
      { id: "i10", type: "text", x: M + 10, y: 532, w: W - 2 * M - 20, h: 110, story: "s6" },
      { id: "i11", type: "line", x1: M, y1: 652, x2: W - M, y2: 652, stroke: { width: 0.5, grey: 0, dash: false } },
      { id: "i12", type: "text", x: M, y: bottom - 12, w: W - 2 * M, h: 12, story: "s7" }
    ] }
  ],
  nextId: 20
};
process.stdout.write(JSON.stringify(doc, null, 1) + "\n");
