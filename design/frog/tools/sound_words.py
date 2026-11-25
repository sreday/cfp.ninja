#!/usr/bin/env python3
"""Does any shipped sound say a word? (Marek, 2026-11-25: the game is mute: no words, nothing to be understood.)

    python design/frog/tools/sound_words.py [--model large-v3] [--only pool,pool]

Runs speech recognition (OpenAI Whisper on torch, on the GPU when there is one) over every file in static/audio/ and lists
the ones it hears speech in: the pool, the file, what it heard and how sure it is. Short effects can fool a
recogniser into "hearing" filler words ("you", "uh"), so a file is only flagged when the recogniser is fairly sure
there is speech (no_speech_prob under 0.3). Exit code 1 if anything is flagged.
Needs: pip install openai-whisper (and torch)
"""
import argparse, glob, os, re, subprocess, sys
import numpy as np

# Whisper makes these up on plain noise (a swoosh, a gong): they are not speech
FILLER = {'you', 'thank you', 'thank you very much', 'thanks for watching', 'thank you for watching', 'bye', 'okay', 'oh',
          'so', 'the', 'uh', 'um', 'hmm', 'mm', 'boom', 'bang'}
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
AUDIO = os.path.join(ROOT, 'static', 'audio')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='turbo')
    ap.add_argument('--only', default='')
    ap.add_argument('--loose', action='store_true', help='list everything with any text, for a look by hand')
    a = ap.parse_args()
    import torch, whisper
    gpu = torch.cuda.is_available()
    m = whisper.load_model(a.model, device='cuda' if gpu else 'cpu')
    only = set(filter(None, a.only.split(',')))
    flagged = []
    files = sorted(glob.glob(os.path.join(AUDIO, '*.mp3')))
    for f in files:
        name = os.path.basename(f)
        pool = re.match(r'^(.+)\.\d+\.[0-9a-f]{10}\.mp3$', name)
        pool = pool.group(1) if pool else name
        if only and pool not in only:
            continue
        pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
        x = np.pad(np.frombuffer(pcm, dtype=np.float32), (8000, 8000))          # a little silence either side
        r = m.transcribe(x, language='en', fp16=gpu, condition_on_previous_text=False, temperature=0)
        segs = r['segments']
        text = ' '.join(s['text'].strip() for s in segs).strip()
        if not re.search(r'[A-Za-z]{2,}', text) or re.sub(r'[^a-z ]', '', text.lower()).strip() in FILLER:
            continue
        if re.match(r"^(the )?i'?m going to", text.lower()):            # its other favourite on hiss and wind
            continue
        sure = [s for s in segs if s['no_speech_prob'] < 0.3 and re.search(r'[A-Za-z]{2,}', s['text'])]      # (a cartoon 'Huh?' scores a low logprob: not a reason to keep it)
        if sure or a.loose:
            p = min(s['no_speech_prob'] for s in segs)
            flagged.append((pool, name, text[:60], round(p, 2), bool(sure)))
    for pool, name, text, p, sure in flagged:
        print(f"{'WORDS' if sure else 'maybe'}  {pool:18s} {name:34s} no_speech={p:<5} heard: {text}")
    pools = sorted({x[0] for x in flagged if x[4]})
    print(f'\n{len(files)} files, {len([x for x in flagged if x[4]])} with words, pools: {", ".join(pools) or "none"}')
    sys.exit(1 if pools else 0)


if __name__ == '__main__':
    main()
