#!/usr/bin/env python3
"""Local image edits for Frog Ninja art: Qwen-Image-Edit-2511 (Apache 2.0) in ComfyUI on this PC's GPU.

    python qwen_edit.py <out.png> "<instruction>" <image1> [image2] [image3] [--seed N --n 1] [--final]

Tries run fast (8 steps, about 11 s each); --final is the slow full-quality pass (40 steps), for the picked image only.

image1 is the picture to edit; image2/3 are references ("the frog in picture 2"). A sprite with transparency is
put on flat magenta first (the model works in RGB); art_slide.py keys the result back. ComfyUI must be running
(~/ComfyUI, port 8188, models from extra_model_paths.yaml); the graph is the official 2511 template, and --fast adds
the 8-step Lightning LoRA (lightx2v, Apache 2.0).
"""
import argparse, json, os, random, time, urllib.request, uuid
from PIL import Image

URL = 'http://127.0.0.1:8188'
COMFY_IN = os.path.expanduser('~/ComfyUI/input')


def flat(src):
    im = Image.open(src)
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA'); bg = Image.new('RGBA', im.size, (255, 0, 255, 255)); bg.alpha_composite(im); im = bg
    name = f'fn_{uuid.uuid4().hex[:8]}.png'; im.convert('RGB').save(os.path.join(COMFY_IN, name)); return name


def graph(prompt, imgs, steps, cfg, seed, fast=False):
    g = {'unet': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'qwen_image_edit_2511_fp8mixed.safetensors', 'weight_dtype': 'default'}},
         'clip': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_2.5_vl_7b_fp8_scaled.safetensors', 'type': 'qwen_image', 'device': 'default'}},
         'vae': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'qwen_image_vae.safetensors'}},
         'shift': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['unet', 0], 'shift': 3.1}},
         'norm': {'class_type': 'CFGNorm', 'inputs': {'model': ['shift', 0], 'strength': 1.0}}}
    if fast:   # lightx2v 8-step Lightning LoRA (Apache 2.0): 8 steps, cfg 1
        g['lora'] = {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': ['norm', 0], 'lora_name': 'Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors', 'strength_model': 1.0}}
    enc = {}
    for i, n in enumerate(imgs, 1):
        g[f'load{i}'] = {'class_type': 'LoadImage', 'inputs': {'image': n}}
        enc[f'image{i}'] = [f'load{i}', 0]
    g['scale'] = {'class_type': 'FluxKontextImageScale', 'inputs': {'image': ['load1', 0]}}
    enc['image1'] = ['scale', 0]
    for k, p in (('pos', prompt), ('neg', '')):
        g[k] = {'class_type': 'TextEncodeQwenImageEditPlus', 'inputs': {'clip': ['clip', 0], 'vae': ['vae', 0], 'prompt': p, **enc}}
        g[k + 'm'] = {'class_type': 'FluxKontextMultiReferenceLatentMethod', 'inputs': {'conditioning': [k, 0], 'reference_latents_method': 'index_timestep_zero'}}
    g['lat'] = {'class_type': 'VAEEncode', 'inputs': {'pixels': ['scale', 0], 'vae': ['vae', 0]}}
    g['ks'] = {'class_type': 'KSampler', 'inputs': {'model': ['lora' if fast else 'norm', 0], 'positive': ['posm', 0], 'negative': ['negm', 0], 'latent_image': ['lat', 0],
               'seed': seed, 'steps': steps, 'cfg': cfg, 'sampler_name': 'euler', 'scheduler': 'simple', 'denoise': 1.0}}
    g['dec'] = {'class_type': 'VAEDecode', 'inputs': {'samples': ['ks', 0], 'vae': ['vae', 0]}}
    g['save'] = {'class_type': 'SaveImage', 'inputs': {'images': ['dec', 0], 'filename_prefix': 'frogninja'}}
    return g


def run(g):
    body = json.dumps({'prompt': g, 'client_id': 'frogninja'}).encode()
    pid = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})))['prompt_id']
    while True:
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            st = h[pid].get('status', {})
            if st.get('status_str') == 'error': raise SystemExit(json.dumps(st)[:2000])
            o = h[pid]['outputs']['save']['images'][0]
            return urllib.request.urlopen(f"{URL}/view?filename={o['filename']}&subfolder={o['subfolder']}&type={o['type']}").read()
        time.sleep(1)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('prompt'); ap.add_argument('images', nargs='+')
    ap.add_argument('--steps', type=int, default=40); ap.add_argument('--cfg', type=float, default=4.0)
    ap.add_argument('--seed', type=int, default=None); ap.add_argument('--n', type=int, default=1)
    ap.add_argument('--fast', action='store_true', help='(the default now) 8-step Lightning LoRA, about 11 s a try')
    ap.add_argument('--final', action='store_true', help='full quality (40 steps, about 100 s): only for the picked image')
    a = ap.parse_args(); names = [flat(p) for p in a.images]
    a.fast = not a.final      # tries are fast; the slow full-quality pass is asked for by name (Marek, 2026-11-22: snappy)
    if a.fast: a.steps, a.cfg = 8, 1.0
    base, ext = os.path.splitext(a.out)
    for k in range(a.n):
        seed = a.seed + k if a.seed is not None else random.randrange(2**31)
        t = time.time(); data = run(graph(a.prompt, names, a.steps, a.cfg, seed, a.fast))
        out = a.out if a.n == 1 else f'{base}-{k + 1}{ext}'
        open(out, 'wb').write(data); print(f'{out}  seed {seed}  {time.time() - t:.0f} s', flush=True)


if __name__ == '__main__':
    main()
