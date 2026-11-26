"""Final TempoBuilder brand kit: planet with a rising ridge.
Run: uv run --no-project --with fonttools --with brotli --with uharfbuzz --with shapely python brand/kit/build.py
Needs rsvg-convert and magick. Also refreshes the app and desktop icons."""
import io, subprocess
from pathlib import Path
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from shapely.geometry import LineString, Point, Polygon
OUT = Path(__file__).resolve().parent; REPO = OUT.parents[1]
FONT = REPO / 'app/fonts/InstrumentSans-latin-variable.woff2'
RIDGE = [(-6, 26), (6.5, 39), (10.5, 33.5), (18, 48.5), (23.5, 38.5), (26.5, 42), (33.5, 25), (44, 43), (51.5, 26), (55, 30), (70, 6)]
SMALL = [(-6, 26), (18, 48.5), (33.5, 25), (44, 43), (70, 6)]  # 16 px: main slopes only
# (tile, sky, ground, text)
SCHEME = {'dark': ('#0B0F15', '#1C7BA2', '#5EB6D8', '#EEF2F6'), 'light': ('#F5F6F5', '#0F4A64', '#1C7BA2', '#111412'), 'black': ('#FFFFFF', '#000000', '#000000', '#000000'), 'white': ('#000000', '#FFFFFF', '#FFFFFF', '#FFFFFF')}
def shapes(line=RIDGE, gap=3.2):
    """(sky, ground) paths with a real gap, so the mark needs no mask and works on any background."""
    disc = Point(32, 32).buffer(30, quad_segs=24); cut = LineString(line).buffer(gap / 2, join_style='mitre', mitre_limit=6)
    below = Polygon(line + [(70, 90), (-6, 90)])
    def path(g):
        ps = [p for p in getattr(g, 'geoms', [g]) if p.area > .4]
        return ''.join('M' + 'L'.join(f'{x:.2f} {y:.2f}' for x, y in p.exterior.coords[:-1]) + 'Z' for p in ps)
    return path(disc.difference(below).difference(cut)), path(disc.intersection(below).difference(cut))
def mark(m, line=RIDGE, gap=3.2):
    s, g = shapes(line, gap); _, sky, ground, _ = SCHEME[m]
    return f'<path d="{s}" fill="{sky}"/><path d="{g}" fill="{ground}"/>'
fonts = {}
def text(s, size, w, track, x, y, fill):
    if w not in fonts:
        f = TTFont(FONT); f = instancer.instantiateVariableFont(f, {a.axisTag: (w if a.axisTag == 'wght' else a.defaultValue) for a in f['fvar'].axes}); f.flavor = None
        b = io.BytesIO(); f.save(b); fonts[w] = f, hb.Font(hb.Face(b.getvalue()))
    f, h = fonts[w]; k = size / f['head'].unitsPerEm; gs = f.getGlyphSet(); b = hb.Buffer(); b.add_str(s); b.guess_segment_properties(); hb.shape(h, b, {'liga': False}); o = ''; cx = x
    for i, p in zip(b.glyph_infos, b.glyph_positions):
        pen = SVGPathPen(gs, ntos=lambda v: f'{v:.2f}'.rstrip('0').rstrip('.')); gs[f.getGlyphName(i.codepoint)].draw(TransformPen(pen, (k, 0, 0, -k, cx, y)))
        if pen.getCommands(): o += f'<path d="{pen.getCommands()}" fill="{fill}"/>'
        cx += p.x_advance * k + track * size
    return o, cx - x - track * size
def word(m, x, y, size):
    c = SCHEME[m][3]; a, aw = text('tempo', size, 600, -.03, x, y, c); b, bw = text('builder', size, 500, -.025, x + aw - .012 * size, y, c)
    return a + b, aw + bw - .012 * size
svg = lambda w, h, body, t='TempoBuilder': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" role="img" aria-label="{t}"><title>{t}</title>{body}</svg>\n'
at = lambda b, x, y, k: f'<g transform="translate({x:g} {y:g}) scale({k:g})">{b}</g>'
def put(p, s): p.parent.mkdir(parents=True, exist_ok=True); p.write_text(s)
def png(src, dst, w): dst.parent.mkdir(parents=True, exist_ok=True); subprocess.run(['rsvg-convert', '-w', str(w), str(src), '-o', str(dst)], check=True)
def icon(n, rx, inset, line=RIDGE, gap=3.2, m='dark'):
    return f'<rect width="{n}" height="{n}" rx="{rx}" fill="{SCHEME[m][0]}"/>' + at(mark(m, line, gap), n * inset, n * inset, n * (1 - 2 * inset) / 64)
for m in SCHEME:
    put(OUT / f'logo/mark-{m}.svg', svg(64, 64, mark(m))); put(OUT / f'logo/mark-small-{m}.svg', svg(64, 64, mark(m, SMALL, 6)))
    w, ww = word(m, 82, 47, 54); put(OUT / f'logo/logo-{m}.svg', svg(round(85 + ww, 1), 64, mark(m) + w))
    w, ww = word(m, 2, 52, 64); put(OUT / f'logo/wordmark-{m}.svg', svg(round(ww + 5, 1), 68, w))
    w, ww = word(m, 2, 130, 44); put(OUT / f'logo/stacked-{m}.svg', svg(round(ww + 5, 1), 146, at(mark(m), (ww + 5) / 2 - 40, 0, 1.25) + w))
    mono, mw = text('TB', 52, 600, -.04, 0, 48, SCHEME[m][3]); put(OUT / f'logo/monogram-{m}.svg', svg(96, 64, at(mono, 48 - mw / 2, 0, 1), 'TB'))
    for n, wd in (('mark', 512), ('logo', 1200), ('wordmark', 1200), ('stacked', 800), ('monogram', 600)): png(OUT / f'logo/{n}-{m}.svg', OUT / f'png/{n}-{m}.png', wd)
W = OUT / 'web'
put(W / 'icon.svg', svg(64, 64, icon(64, 14, .08, RIDGE, 4))); put(W / 'icon-app.svg', svg(512, 512, icon(512, 112, .14))); put(W / 'icon-square.svg', svg(512, 512, icon(512, 0, .14))); put(W / 'icon-maskable.svg', svg(512, 512, icon(512, 0, .22))); put(W / 'favicon-16.svg', svg(64, 64, icon(64, 12, .03, SMALL, 6)))
tmp = []
for n, s in ((16, 'favicon-16'), (32, 'icon'), (48, 'icon')):
    tmp.append(OUT / f'_{n}.png'); png(W / f'{s}.svg', tmp[-1], n)
subprocess.run(['magick', *map(str, tmp), str(W / 'favicon.ico')], check=True)
for p in tmp: p.unlink()
for s, d, n in (('icon-square', 'apple-icon', 180), ('icon-app', 'icon-192', 192), ('icon-app', 'icon-512', 512), ('icon-maskable', 'icon-maskable-512', 512)): png(W / f'{s}.svg', W / f'{d}.png', n)
w, _ = word('dark', 82, 47, 54)
scene = at(mark('dark'), 690, 110, 11)  # large planet, cropped by the right edge
put(W / 'opengraph-image.svg', svg(1200, 630, f'<rect width="1200" height="630" fill="#0B0F15"/>{scene}' + at(mark('dark') + w, 72, 170, 1.45) + text('Plan your training.', 46, 500, -.02, 74, 372, '#EEF2F6')[0] + text('Ride it. See it rise.', 46, 500, -.02, 74, 428, '#A9B4C1')[0]))
png(W / 'opengraph-image.svg', W / 'opengraph-image.png', 1200)
put(OUT / 'social/avatar.svg', svg(1024, 1024, icon(1024, 0, .2))); png(OUT / 'social/avatar.svg', OUT / 'social/avatar-1024.png', 1024)
put(OUT / 'social/banner.svg', svg(1500, 500, '<rect width="1500" height="500" fill="#0B0F15"/>' + at(mark('dark'), 980, 20, 9) + at(mark('dark') + w, 100, 190, 1.7))); png(OUT / 'social/banner.svg', OUT / 'social/banner-1500x500.png', 1500)
# app
import shutil
for s, d in (('icon.svg', 'app/icon.svg'), ('favicon.ico', 'app/favicon.ico'), ('apple-icon.png', 'app/apple-icon.png'), ('opengraph-image.png', 'app/opengraph-image.png'), ('icon-192.png', 'public/icon-192.png'), ('icon-512.png', 'public/icon-512.png'), ('icon-maskable-512.png', 'public/icon-maskable-512.png')): shutil.copyfile(W / s, REPO / d)
# desktop
D = REPO / 'desktop/build'; shutil.copyfile(W / 'icon-app.svg', D / 'icon.svg')
for n in (16, 32, 48, 64, 128, 256, 512): png(W / ('favicon-16.svg' if n == 16 else 'icon.svg' if n < 64 else 'icon-app.svg'), D / f'icons/{n}x{n}.png', n)
desktop_size = int(subprocess.check_output(['magick', 'identify', '-format', '%w', str(D / 'icon.png')]))
png(W / 'icon-app.svg', D / 'icon.png', desktop_size)
s, g = shapes(gap=4)
(REPO / 'components/BrandMark.tsx').write_text(f"""/** The TempoBuilder mark: a planet with a ridge that rises to the right. Paths come from `brand/kit/build.py`. */
export function BrandMark({{ className = '' }}: {{ className?: string }}) {{
  return (
    <span className={{`brand-mark ${{className}}`}} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="28" height="28">
        <path className="brand-mark-sky" d="{s}" />
        <path className="brand-mark-ground" d="{g}" />
      </svg>
    </span>
  );
}}

/** The name as set in the logo: lowercase, with "tempo" slightly bolder. Use "TempoBuilder" in running text. */
export function BrandName() {{
  return (
    <span className="text-[16px] tracking-[-0.025em] text-[var(--text)]">
      <span className="font-semibold">tempo</span><span className="font-medium">builder</span>
    </span>
  );
}}
""")
