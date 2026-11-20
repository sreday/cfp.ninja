#!/usr/bin/env python3
"""The stunned face (art 1.3, Marek's pick 2026-11-20): the picked frog's own head, faithful to the logo, with
- the pupils taken out of the eyes (the eye whites kept, the bandana's lower outline redrawn over them),
- a tongue hanging from the grin (drawn here in the logo's style: flat pink, thick black outline, a groove),
and an eye mask, so the game draws the pupils itself and rolls them around in the eyes while stunned.

    python3 design/frog/tools/art_build_stun.py

Reads the head part (candidates/1.1-rig/parts/head.png on the art desk); writes hashed files to static/img/game/frog/
and prints the ART line and the pupil geometry (head px) for frog-game.js.
"""
import hashlib, json, os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
DESK = os.path.expanduser('~/Desktop/Frog Ninja art desk')
HEAD = os.path.join(DESK, 'candidates/1.1-rig/parts/head.png')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), 'static/img/game/frog')
import numpy as np, sys
from PIL import Image, ImageFilter
im=Image.open(HEAD).convert('RGBA'); A=np.asarray(im).astype(np.float32); H,W=A.shape[:2]
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
red=(A[...,0]>120)&(A[...,1]<80)&(A[...,2]<80)
dark=(A[...,:3].max(2)<70)
white=A[...,:3].min(2)>200
EYES=[dict(c=(189,234),rx=78,ry=67,p=(204.5,235)),dict(c=(460,234),rx=78,ry=67,p=(445,234))]
RED=(A[...,0]>100)&(A[...,0]>A[...,1]+40)&(A[...,0]>A[...,2]+40)
def redbottom(e):
    x0,x1=int(e['c'][0]-e['rx']-12),int(e['c'][0]+e['rx']+12)
    xs=np.arange(x0,x1+1); rb=[]
    for x in xs:
        r=np.nonzero(RED[:300,x])[0]; rb.append(r.max() if len(r) else np.nan)
    rb=np.array(rb,float); ok=~np.isnan(rb); P=np.polyfit(xs[ok],rb[ok],4)
    out=np.full(W,np.nan); out[x0:x1+1]=np.polyval(P,xs); return out
def eye_region(e):
    inside=((xx-e['c'][0])/e['rx'])**2+((yy-e['c'][1])/e['ry'])**2<=1.05
    m=inside&(white|dark|(A[...,:3].min(2)>120))
    mi=Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    rb=redbottom(e); below=np.clip(yy-np.nan_to_num(rb,nan=1e9)[None,:],0,1)
    return np.asarray(mi)/255.0*below*inside, rb
def disc(cx,cy,r): d=np.sqrt((xx-cx)**2+(yy-cy)**2); return np.clip(r-d+0.5,0,1)
def make(pos):
    B=A.copy()
    for e,(nx,ny) in zip(EYES,pos):
        m,rb=eye_region(e)
        for ch in range(3): B[...,ch]=B[...,ch]*(1-m)+255*m
        pa=disc(nx,ny,50)*m; ha=disc(nx+15,ny-22,22)*m
        for ch in range(3): B[...,ch]=B[...,ch]*(1-pa)
        for ch in range(3): B[...,ch]=B[...,ch]*(1-ha)+255*ha
        # the lid: the bandana's outline redrawn as one clean band under its red edge, over the eye
        g=np.gradient(np.nan_to_num(rb)); t=18.5*np.sqrt(1+g**2)
        top=np.nan_to_num(rb,nan=-1e9)[None,:]; bot=top+t[None,:]
        band=np.clip(yy-top+0.5,0,1)*np.clip(bot-yy+0.5,0,1)
        near=np.asarray(Image.fromarray(((m>0.01)*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15)))>0
        band=band*near
        for ch in range(3): B[...,ch]=B[...,ch]*(1-band)
    return Image.fromarray(B.clip(0,255).astype(np.uint8),'RGBA')

S=4
def tongue(cx, top, w=74, L=78, tilt=8, line=15):
    W2,H2=int((w+2*line+40)*S),int((L+2*line+40)*S); im=Image.new('RGBA',(W2,H2),(0,0,0,0)); d=ImageDraw.Draw(im)
    ox,oy=W2/2,line*S
    def u(inset, col):
        x0=ox-(w/2-inset)*S; x1=ox+(w/2-inset)*S; y0=oy-10*S; y1=oy+(L-inset)*S
        r=(w/2-inset)*S
        d.rectangle([x0,y0,x1,y1-r],fill=col); d.ellipse([x0,y1-2*r,x1,y1],fill=col)
    u(-line,(0,0,0,255))                 # the outline
    u(0,(232,128,138,255))               # the tongue
    # cel shading: a lighter left side
    hl=Image.new('RGBA',im.size,(0,0,0,0)); hd=ImageDraw.Draw(hl)
    hd.ellipse([ox-(w/2-6)*S,oy+4*S,ox-(w/2-26)*S,oy+(L-14)*S],fill=(246,160,166,255))
    m=Image.new('L',im.size,0); ImageDraw.Draw(m).rectangle([0,0,W2,H2],fill=0)
    im.alpha_composite(hl)
    # the groove down the middle
    d.line([ox,oy-6*S,ox,oy+L*0.45*S],fill=(0,0,0,255),width=int(7*S))
    d.ellipse([ox-3.5*S,oy+L*0.45*S-3.5*S,ox+3.5*S,oy+L*0.45*S+3.5*S],fill=(0,0,0,255))
    im=im.rotate(tilt,resample=Image.BICUBIC,center=(ox,oy))
    im=im.resize((W2//S,H2//S),Image.LANCZOS)
    return im,(int(cx-W2/S/2),int(top-line))
def with_tongue(base,cx=495,top=338,**kw):
    kw.setdefault('w',88); kw.setdefault('L',94); kw.setdefault('tilt',-12)
    t,(tx,ty)=tongue(cx,top,**kw)
    # clip it under the grin's line: per column, nothing of the tongue above the line's lower edge
    H0=np.asarray(base).astype(int); dk0=(H0[...,:3].max(2)<80)&(H0[...,3]>200); T=np.asarray(t).copy()
    for i in range(T.shape[1]):
        x=tx+i
        if x<0 or x>=dk0.shape[1]: continue
        col=np.nonzero(dk0[290:400,x])[0]
        if not len(col): continue
        y=290+col[0]
        while y<dk0.shape[0] and dk0[y,x]: y+=1
        cut=y-ty-2
        if cut>0: T[:max(0,cut),i,3]=0
    t=Image.fromarray(T,'RGBA')
    out=base.copy(); out.alpha_composite(t,(tx,ty))
    H=np.asarray(base).astype(int); O=np.asarray(out).copy()
    dk=(H[...,:3].max(2)<80)&(H[...,3]>200)
    band=np.zeros(dk.shape,bool); band[top-26:top+6, tx:tx+t.width]=True
    sel=dk&band; O[sel]=np.asarray(base)[sel]      # the grin line stays over the tongue's root
    return Image.fromarray(O,'RGBA')

# Marek's pick: one eye up and out, one down and in (the pupils' resting places; the game rolls them around these)
PUPILS = [(174, 228), (438, 254)]
PUPIL_R, SHINE, SHINE_R = 50, (15, -22), 22

def save(name, img, ext='webp'):
    import io
    b = io.BytesIO(); img.save(b, 'WEBP', quality=92, method=6) if ext == 'webp' else img.save(b, 'PNG', optimize=True)
    h = hashlib.sha256(b.getvalue()).hexdigest()[:10]; fn = f'{name}.{h}.{ext}'
    open(os.path.join(OUT, fn), 'wb').write(b.getvalue()); return '/img/game/frog/' + fn

def main():
    B = A.copy(); mask = np.zeros(A.shape[:2])
    for e in EYES:
        m, rb = eye_region(e)
        for ch in range(3): B[..., ch] = B[..., ch] * (1 - m) + 255 * m
        g = np.gradient(np.nan_to_num(rb)); t = 18.5 * np.sqrt(1 + g ** 2)
        top = np.nan_to_num(rb, nan=-1e9)[None, :]; bot = top + t[None, :]
        band = np.clip(yy - top + 0.5, 0, 1) * np.clip(bot - yy + 0.5, 0, 1)
        near = np.asarray(Image.fromarray(((m > 0.01) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15))) > 0
        band = band * near
        for ch in range(3): B[..., ch] = B[..., ch] * (1 - band)
        mask = np.maximum(mask, m * (1 - band))
    face = Image.fromarray(B.clip(0, 255).astype(np.uint8), 'RGBA')
    face = with_tongue(face)
    mk = Image.fromarray((mask * 255).astype(np.uint8), 'L')
    fu = save('stun-face', face); mu = save('stun-eyes', mk.convert('RGB'), 'png')
    print(json.dumps({'face': fu, 'eyes': mu, 'size': [A.shape[1], A.shape[0]], 'pupils': PUPILS, 'r': PUPIL_R, 'shine': SHINE, 'shineR': SHINE_R}))

if __name__ == '__main__':
    main()
