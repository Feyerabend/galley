"""Compare two pictures, pixel by pixel, allowing edges to move by one.

    python3 compare.py [-t levels] expected.png actual.png [allowed]

Both are PNG files, 8 bits a sample, gray or RGB, as Ghostscript writes
them. Two colours are the same if no channel of one differs from the
other's by more than one level in 255: two renderers may turn a colour
into a byte with a different rounding. A pixel that differs is forgiven
if the other picture has its colour within one pixel of it, and it has
the other's: that is an edge that two renderers put one pixel apart,
which they may, since they round differently. Any other differing pixel
counts, and the pictures match if no more than `allowed` count, 0
unless given.

With -t, two colours are the same if no channel differs by more than
that many levels, in the comparison and in the search for an edge. That
is for antialiased pictures (chapter 28), whose pixels at an edge are
mixtures, by how much of each pixel a shape covers: two renderers that
measure it differently, by a subpixel, or put the edge a pixel over,
give mixtures a little apart. With four bits of alpha, a pixel cut
into four by four subpixels, one column of them is four levels of
alpha in fifteen, 68 in 255, and with a level for the rounding, as
above, 69. Without -t it is 1, and nothing changes.

The exit status is 0 if they match, 1 if not, and the counts are
printed. No libraries: the PNG is read here, with zlib from Python's
own library.
"""

import struct
import sys
import zlib


def read_png(path):
    """The width, the height, and the rows, each a list of pixels, each a tuple."""
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("%s is not a PNG" % path)
    pos, idat = 8, b""
    width = height = depth = colour = None
    while pos < len(data):
        length, kind = struct.unpack(">I4s", data[pos:pos + 8])
        chunk = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            width, height, depth, colour, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            if depth != 8 or colour not in (0, 2) or interlace:
                raise ValueError("%s: only 8-bit gray or RGB, not interlaced" % path)
        elif kind == b"IDAT":
            idat += chunk
        elif kind == b"IEND":
            break
        pos += 12 + length
    channels = 1 if colour == 0 else 3
    raw = zlib.decompress(idat)
    stride = width * channels
    rows, prev = [], bytearray(stride)
    for y in range(height):
        start = y * (stride + 1)
        kind, line = raw[start], bytearray(raw[start + 1:start + 1 + stride])
        for i in range(stride):             # undo the row's filter
            a = line[i - channels] if i >= channels else 0
            b = prev[i]
            c = prev[i - channels] if i >= channels else 0
            if kind == 1:
                line[i] = (line[i] + a) & 255
            elif kind == 2:
                line[i] = (line[i] + b) & 255
            elif kind == 3:
                line[i] = (line[i] + (a + b) // 2) & 255
            elif kind == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append([tuple(line[x * channels:(x + 1) * channels]) for x in range(width)])
        prev = line
    return width, height, rows


TOLERANCE = 1


def same(a, b):
    """Are two colours the same, to the tolerance in each channel: one level, unless -t?"""
    return all(abs(p - q) <= TOLERANCE for p, q in zip(a, b))


def near(rows, width, height, x, y, colour):
    """Is the colour at (x, y) or at one of its eight neighbours?"""
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            u, v = x + dx, y + dy
            if 0 <= u < width and 0 <= v < height and same(rows[v][u], colour):
                return True
    return False


def compare(expected, actual):
    """The number of differing pixels, and how many of them are not forgiven."""
    w, h, a = expected
    w2, h2, b = actual
    if (w, h) != (w2, h2):
        raise ValueError("the pictures are %dx%d and %dx%d" % (w, h, w2, h2))
    differ = counted = 0
    for y in range(h):
        ra, rb = a[y], b[y]
        if ra == rb:
            continue
        for x in range(w):
            if not same(ra[x], rb[x]):
                differ += 1
                if not (near(b, w, h, x, y, ra[x]) and near(a, w, h, x, y, rb[x])):
                    counted += 1
    return differ, counted


def main():
    global TOLERANCE
    args = sys.argv[1:]
    if len(args) >= 2 and args[0] == "-t":
        TOLERANCE = int(args[1])
        args = args[2:]
    if len(args) not in (2, 3):
        sys.exit("usage: compare.py [-t levels] expected.png actual.png [allowed]")
    allowed = int(args[2]) if len(args) == 3 else 0
    differ, counted = compare(read_png(args[0]), read_png(args[1]))
    if counted > allowed:
        within = " by more than %d levels" % TOLERANCE if TOLERANCE != 1 else ""
        print("%s: %d pixels differ%s, %d not at an edge (%d allowed)"
              % (args[0], differ, within, counted, allowed))
        sys.exit(1)


if __name__ == "__main__":
    main()
