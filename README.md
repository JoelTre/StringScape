# StringScape
## A high-performance, open-source web app for visualizing data from the STRING database 
Beta version 1.0

StringScape is a high-performance, browser-based bioinformatics application for the interactive visualization and analysis of complex biological networks, protein interactomes, and protein embeddings. It provides a bridge between raw STRING database data and publication-quality visual insights.

The app is available here: https://joeltre.github.io/StringScape/app

The StringScape home page: https://joeltre.github.io/StringScape 

The source code (look in the folder 'app' above): https://github.com/JoelTre/StringScape/tree/main/app

StringScape on X: https://x.com/StringScapeApp

StringScape on Youtube: https://www.youtube.com/@StringScape_app

Video tutorial on how to use StringScape: [coming soon...]

## 🚀 Key Features
- **Interactive Biological Networks:** View and explore the full STRING network from any species. The app utilises your local GPU to rapidly load the full network.
- **Easily Visualize all the STRING variables (and any custom variables):** The nodes (representing the proteins) can be coloured and sized based on any variable. These variables can also be easily visualised as graphs, such as a histogram, pie chart, scatter plot, and mind map.
- **View synchronization:** All the views in the apps are synced, allowing you to select proteins on one graph (such as points on the scatter plot) and then see those same proteins selected in the other plots (such as a network view). 
- **Many export options:** The app allows you to export publication-quality images of any of the views, as well as tables/spreadsheets of chosen subsets of the data. Other export options include fasta files and JSON files (which can be used as input for the AlphaFold server) 
- **Easily view information about the proteins:** Hovering over a node allows you to preview information about the protein. Clicking on the node allows you to view more information such as its annotation, description, sequence and structure. 
- **Useful links for each protein:** The information about each protein includes useful links to more information such as its UniProt page, NCBI pages, relevant PubMed papers, IntAct page, and STRING page.
- **Visualise embeddings:** View 2D and 3D UMAP plots of the network- and sequence-embedding spaces of the proteins to visualize functional and structural similarities.
- **Visualise protein complex structures:** See how protein interact with one another in 3D space with an intergrated Mol* structure viewer. 
- **Python console:** The app includes a python console (Pyodide), allowing you to run advanced analysis of the data utilising packages such as NumPy, Pandas, Biopython, NetworkX, and Scikit-learn, all executed securely within the browser's sandbox without needing an external server. 
- **Analysis tools:** The app includes some basic analysis tools that let you calculate metrics such as Centrality, Eigenvector Centrality, and the shortest paths between two proteins.
- **Integrated AI Research Agent:** This agent uses local LLMs via LM Studio, allowing for free and unlimited use of the agent, with all processing happening privately on your machine. This agent can;
  1. Answer questions about the proteins/data.
  2. Perform requested actions for you in the app.
  3. Create interactive guides where the agent selects and circles specific nodes while talking about them.
  4. Read the app’s own code to answer questions about it.
  5. Explain console logs, including error logs. 

## 🛠️ Technical Stack
- StringScape is built as a web application with all processing occurring locally to ensure privacy and zero-install accessibility:
- **Physics simulation:** The app utilised WebGPU to run physics simulations on the GPU for rapid loading. If this fails for some reason, the app can fall back on a D3.js simulation. 
- **Plotly:** High-fidelity 2D and 3D data plotting for embeddings and scatter analysis.
- **KaTeX:** High-quality rendering of mathematical formulas and LaTeX in protein annotations and AI responses.
- **Pyodide:** Python-in-the-browser support for advanced data processing tasks.
-  **Client-Side Processing:** All data processing occurs locally on your machine. Your biological data never leaves your browser unless you explicitly connect it to an external AI server.

The StringScape app was developed by Joel Tregurtha as part of a Ph.D. program at the University of Canterbury, New Zealand, funded by The MacDiarmid Institute.
The code was generated using AI models, including Gemini, Raptor mini, and Claude.

## 📧 Feedback
I'd love to hear from you! Send feedback, suggested additional features or bugs found to joel.tregurtha@pg.canterbury.ac.nz

## 📜 Citation
If using StringScape for a research paper, a mention of StringScape is not required, but is appreciated. A paper is in preparation. For now, cite:
Tregurtha, J., (2026). StringScape: A high-performance open-source web app for visualising data from the STRING database, https://github.com/JoelTre/StringScape/tree/main

