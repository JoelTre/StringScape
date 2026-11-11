# Simple Protein Modeller

Serve the parent `homology_modeller` directory over HTTP, for example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/Simple_app/`. The page requires access to the external structure services. It uses the local RCSB proposal page assets and RCSB Mol* viewer.

This is a thin interface over the existing application, loaded in a hidden same-origin iframe. It uses the existing automatic chain discovery and prepared-model export with automatic simulation switched off. It is not a standalone extraction of the modelling code: the parent application's scripts and assets must remain available. The full application's stored preferences and startup behavior may also apply. A separate extraction would be needed to remove that dependency.

The page loads PDB 2D9Q by default. Use the movable demo panel to load another PDB ID; its position resets on reload. Select **Add missing residues** to build a model for the loaded structure and replace it in the viewer. The results panel appears below the viewer. The RCSB PDB data and file services must be reachable.
