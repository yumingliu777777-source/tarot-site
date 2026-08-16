# -*- coding: utf-8 -*-
"""生成收款码占位图 qr-wechat.png / qr-alipay.png（500x500）"""
from PIL import Image, ImageDraw, ImageFont

W = 500
FONTS = [
    "C:/Windows/Fonts/msyh.ttc",   # 微软雅黑
    "C:/Windows/Fonts/simhei.ttf", # 黑体
]
def font(size):
    for p in FONTS:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()

def placeholder(path, label, color):
    img = Image.new("RGB", (W, W), (17, 17, 26))
    d = ImageDraw.Draw(img)
    # 仿二维码的随机小块，一眼看出是占位
    import random
    random.seed(abs(hash(label)) % (2**32))
    for y in range(60, 400, 24):
        for x in range(60, 400, 24):
            if random.random() < 0.45:
                d.rectangle([x, y, x + 18, y + 18], fill=(38, 38, 56))
    # 三个定位角
    for cx, cy in [(60, 60), (400, 60), (60, 400)]:
        d.rectangle([cx - 20, cy - 20, cx + 20, cy + 20], outline=color, width=5)
    # 文字
    t1 = font(34)
    t2 = font(20)
    d.text((W // 2, 430), label, font=t1, fill=color, anchor="mm")
    d.text((W // 2, 468), "占位图 · 请替换为你的收款码", font=t2, fill=(150, 150, 170), anchor="mm")
    img.save(path, "PNG")
    print("saved", path)

placeholder("E:/tarot-site/qr-wechat.png", "微信收款码", (201, 169, 87))
placeholder("E:/tarot-site/qr-alipay.png", "支付宝收款码", (123, 108, 214))
