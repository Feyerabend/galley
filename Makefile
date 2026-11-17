# Galley, a page-layout program in one page of the browser.
#
#   open index.html            the program: no server, no build
#   make fonts                 fonts/*.js and fonts/index.js, again, from
#                              the TrueType files in fonts/'s folders
#   make examples              examples/*.json from make-*.js, and each as
#                              a script, examples/*.js and index.js
#   make test                  each example written as PostScript and as
#                              PDF; Ghostscript's pictures of the
#                              PostScript compared with those kept, and
#                              its pictures of the PDF with those of the
#                              PostScript
#   make expect                the pictures kept, made again
#
# Ghostscript is used only here, to test: it is not part of Galley.

GS ?= $(firstword $(wildcard /opt/homebrew/bin/gs /usr/local/bin/gs) gs)
GSPNG := -q -dNOPAUSE -dBATCH -dSAFER -r72 -dGraphicsAlphaBits=1 -dTextAlphaBits=1 -sDEVICE=png16m
EXAMPLES := $(wildcard examples/*.json)

fonts:
	node tools/pack-fonts.js

# examples/name.json from make-name.js; then each as a script too.
examples:
	cd examples && for m in make-*.js; do n=$${m#make-}; node $$m > $${n%.js}.json || exit 1; done
	node tools/pack-examples.js

# A picture of the PDF may differ from the PostScript's where a curve
# is made otherwise: PostScript's arc, PDF's four Bezier curves. An
# example's "pdfPixels" is how many such pixels it allows.
test:
	@tmp=$$(mktemp -d); \
	for j in $(EXAMPLES); do \
	    n=$${j%.json}; b=$$(basename $$n); \
	    node export.js $$j > $$tmp/$$b.ps || exit 1; \
	    node export.js --pdf $$j > $$tmp/$$b.pdf || exit 1; \
	    $(GS) $(GSPNG) -sOutputFile=$$tmp/$$b-ps-%d.png $$tmp/$$b.ps > /dev/null || exit 1; \
	    $(GS) $(GSPNG) -dPDFSTOPONERROR -sOutputFile=$$tmp/$$b-pdf-%d.png $$tmp/$$b.pdf > $$tmp/$$b.log 2>&1 || { cat $$tmp/$$b.log; exit 1; }; \
	    [ ! -s $$tmp/$$b.log ] || { echo "$$j: Ghostscript said of the PDF:"; cat $$tmp/$$b.log; exit 1; }; \
	    want=$$(ls $$n-*.png 2>/dev/null | wc -l); got=$$(ls $$tmp/$$b-ps-*.png | wc -l); \
	    [ $$want -gt 0 ] || { echo "$$j: no pictures kept; make expect"; exit 1; }; \
	    [ $$want -eq $$got ] || { echo "$$j: $$want pages kept, $$got made"; exit 1; }; \
	    allowed=$$(node -p 'require("./'$$j'").pdfPixels || 0'); \
	    for i in $$(seq 1 $$want); do \
	        python3 -I tools/compare.py $$n-$$i.png $$tmp/$$b-ps-$$i.png || exit 1; \
	        python3 -I tools/compare.py $$tmp/$$b-ps-$$i.png $$tmp/$$b-pdf-$$i.png $$allowed || exit 1; \
	    done; \
	    echo "$$j: $$want pages, the PostScript as kept, the PDF as the PostScript"; \
	done; \
	rm -rf $$tmp
	@echo "galley: ok"

expect:
	@tmp=$$(mktemp -d); \
	for j in $(EXAMPLES); do \
	    n=$${j%.json}; b=$$(basename $$n); rm -f $$n-*.png; \
	    node export.js $$j > $$tmp/$$b.ps && \
	    $(GS) $(GSPNG) -sOutputFile=$$n-%d.png $$tmp/$$b.ps > /dev/null || exit 1; \
	done; \
	rm -rf $$tmp

.PHONY: fonts examples test expect
