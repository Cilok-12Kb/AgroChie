import base64
import sys
from pathlib import Path

from app.ml.registry import LeafArtifact

leaf = LeafArtifact(Path("models/kualitas_tanaman"))
b64 = base64.b64encode(Path(sys.argv[1]).read_bytes()).decode()
print(leaf.predict(b64))