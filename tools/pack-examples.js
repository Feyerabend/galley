/*
 * The examples, made scripts the page can load, as the fonts are:
 *
 *   node tools/pack-examples.js
 *
 * writes, for each examples/name.json, examples/name.js, the document,
 * and examples/index.js, the list of them, by name and title. Served,
 * as by GitHub Pages, the page fetches the JSON; opened as a file, it
 * may not, but it may run a script: so index.html?example=gazette opens
 * the gazette either way, and so does File, Examples.
 */
"use strict";
var fs = require("fs"), path = require("path");
var dir = path.join(__dirname, "..", "examples"), list = [];

function script(call, value) {
    return "/* Made by tools/pack-examples.js: do not edit. */\n" +
        "(function (root) {\n" +
        "    var value = " + value + ";\n" +
        "    if (typeof module !== \"undefined\" && module.exports) module.exports = value;\n" +
        "    else root." + call + ";\n" +
        "})(this);\n";
}

fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }).sort().forEach(function (f) {
    var name = f.replace(/\.json$/, ""), doc = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    fs.writeFileSync(path.join(dir, name + ".js"), script("GALLEY_EXAMPLE_LOADED(value)", JSON.stringify({ name: name, doc: doc })));
    list.push({ name: name, title: doc.title || name });
});
fs.writeFileSync(path.join(dir, "index.js"), script("GALLEY_EXAMPLES = value", JSON.stringify(list, null, 1)));
console.log("examples/index.js: " + list.map(function (e) { return e.name; }).join(", "));
