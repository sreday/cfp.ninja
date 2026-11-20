"""Where the art sources are: the art desk on this machine (~/Desktop/Frog Ninja art desk) if it is there, else the
copy in the repo (design/frog/art/sources: what the build tools need, so any machine can rebuild the game's art)."""
import os
DESK = os.path.expanduser('~/Desktop/Frog Ninja art desk')
SOURCES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'art', 'sources')


def desk(rel=''):
    p = os.path.join(DESK, rel)
    return p if os.path.exists(p) else os.path.join(SOURCES, rel)
