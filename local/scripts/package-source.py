"""Export the runnable demo source, fixtures and lockfile without runtime state."""
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
destination = root / 'public' / 'downloads'
destination.mkdir(parents=True, exist_ok=True)
files = [root / name for name in (
    'README.md', 'package.json', 'package-lock.json', 'tsconfig.json',
    'vite.config.ts', 'index.html', '.gitignore', '.env.example',
)]
for directory in ('src', 'scripts', 'tests', 'public/fixtures'):
    files.extend(p for p in (root / directory).rglob('*')
                 if p.is_file() and '__pycache__' not in p.parts)
with zipfile.ZipFile(destination / 'lienloop-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(files):
        archive.write(file, Path('lienloop') / file.relative_to(root))
shutil.copyfile(root / 'README.md', destination / 'README.md')
print(f'Packaged {len(files)} source files and fixtures.')
