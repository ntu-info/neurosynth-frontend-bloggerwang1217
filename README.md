[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/yOwut1-r)
[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=21246323&assignment_repo_type=AssignmentRepo)
# 07
Neurosynth Frontend

Last updated: 2025-10-23

Local demo server (for Clipboard API & testing)
---------------------------------------------
To test the demo and the Clipboard API locally use a secure context (localhost). Two simple options:

Python 3 built-in server (recommended):

```bash
# Run from the repo root
python3 -m http.server 8000

# Then open http://localhost:8000 in your browser
```

Node (http-server) alternative:

```bash
# install once
npm install -g http-server

# run from repo root
http-server -p 8000

# open http://localhost:8000
```

Note: Clipboard.writeText only works on secure contexts (HTTPS) or on localhost. If you test using file:// URLs the clipboard calls will fail.
