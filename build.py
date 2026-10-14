"""Yayın derlemesi: motor.html içindeki <script src="js/x.js"> etiketlerini dosya içeriğiyle değiştirir.
Çıktı: <hedef>/motor.html (tek dosya). Kullanım: python build.py [hedef_klasör]  (varsayılan: dist/)"""
import re, sys, os

here = os.path.dirname(os.path.abspath(__file__))
out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, 'dist')
html = open(os.path.join(here, 'motor.html'), encoding='utf-8').read()

def inline(m):
    src = open(os.path.join(here, m.group(1)), encoding='utf-8').read()
    src = src.replace('</script', r'<\/script')
    return '<script>\n/* ' + m.group(1) + ' */\n' + src + '\n</script>'

html, n = re.subn(r'<script src="(js/[a-z0-9_-]+\.js)"></script>', inline, html)
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, 'motor.html')
open(out, 'w', encoding='utf-8').write(html)
print(n, 'betik gomuldu ->', out, len(html) // 1024, 'KB')

# Bağımsız sürüm: doctype + head ile sarılmış, çift tıklayınca tarayıcıda açılır (depo kökünde tutulur)
standalone = ('<!doctype html>\n<html lang="tr"><head><meta charset="utf-8">'
              '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n'
              + html + '\n</body></html>\n')
open(os.path.join(here, 'motor-tek-dosya.html'), 'w', encoding='utf-8').write(standalone)
print('bagimsiz surum -> motor-tek-dosya.html')
