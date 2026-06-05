
            (function initEarlyUploadBridge() {
                window.uploadedFileViewerData = window.uploadedFileViewerData || {};
                window.interactionParsedEdgeCounts = window.interactionParsedEdgeCounts || {};
                window.loadedInteractionFileNames = window.loadedInteractionFileNames || [];
                window.loadedAccessoryFileNames = window.loadedAccessoryFileNames || [];
                window.uploadedInteractionFiles = window.uploadedInteractionFiles || {};
                window.uploadedAccessoryFiles = window.uploadedAccessoryFiles || {};
                window.uploadedEmbeddingFiles = window.uploadedEmbeddingFiles || {};
                window.accessoryDataFiles = window.accessoryDataFiles || {};
                window.accessoryVariableValues = window.accessoryVariableValues || {};
                window.variableConfigs = window.variableConfigs || [];
                window.gpuState = window.gpuState || {
                    supported: false,
                    initializing: false,
                    ready: false,
                    device: null,
                    adapter: null,
                    context: null,
                    format: null,
                    computePipeline: null,
                    computeBindGroupLayout: null,
                    nodeBuffer: null,
                    linkBuffer: null,
                    uniformBuffer: null,
                    readbackBuffer: null,
                    nodeCapacity: 0,
                    linkCapacity: 0,
                    needsUpload: true,
                    needsResize: true,
                    lastSignature: ''
                };

                window.handleInteractionUploadChange = window.handleInteractionUploadChange || (async function (event) {
                    const input = event?.target || document.getElementById('fileInput');
                    const files = Array.from(input?.files || []);
                    try {
                        if (typeof window.processInteractionFiles === 'function') {
                            await window.processInteractionFiles(files);
                        }
                    } catch (error) {
                    } finally {
                        if (input) input.value = '';
                    }
                });

                window.handleAccessoryUploadChange = window.handleAccessoryUploadChange || (async function (event) {
                    const input = event?.target || document.getElementById('infoInput');
                    const files = Array.from(input?.files || []);
                    try {
                        if (typeof window.processAccessoryFiles === 'function') {
                            await window.processAccessoryFiles(files);
                        }
                    } catch (error) {
                    } finally {
                        if (input) input.value = '';
                    }
                });

                const interactionInput = document.getElementById('fileInput');
                const accessoryInput = document.getElementById('infoInput');
                if (interactionInput) interactionInput.onchange = window.handleInteractionUploadChange;
                if (accessoryInput) accessoryInput.onchange = window.handleAccessoryUploadChange;
            })();

    console.log("Hello, welcome to the colsole! Below you will see console logs of function calls (except for the functions draw and checkOffscreenNodes). This is useful for debugging and understanding what the code is doing.");
    const GLOBAL_SCRIPT_OFFSET = 0; // The app code now lives in App/script.js.
    const MAIN_SCRIPT_URL = (() => {
        return 'https://joeltre.github.io/StringScape/app/script.js';
    })();
    let mainScriptSourceCache = null;
    let mainScriptSourcePromise = null;

    async function getMainScriptSource() {
        if (typeof mainScriptSourceCache === 'string') return mainScriptSourceCache;
        const scriptEl = document.getElementById('main-script');
        if (scriptEl?.textContent && scriptEl.textContent.trim()) {
            mainScriptSourceCache = scriptEl.textContent;
            return mainScriptSourceCache;
        }
        if (!mainScriptSourcePromise) {
            mainScriptSourcePromise = fetch(MAIN_SCRIPT_URL, { cache: 'no-store' })
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to load script source: ${response.status}`);
                    return response.text();
                })
                .then(text => {
                    mainScriptSourceCache = text;
                    return text;
                })
                .catch(error => {
                    mainScriptSourcePromise = null;
                    throw error;
                });
        }
        return mainScriptSourcePromise;
    }
    const canvas = document.querySelector("#network");
    const gpuCanvas = document.querySelector("#network-gpu") || (() => {
        const created = document.createElement('canvas');
        created.id = 'network-gpu';
        created.setAttribute('aria-hidden', 'true');
        created.style.pointerEvents = 'none';
        canvas.parentNode.insertBefore(created, canvas);
        return created;
    })();
    const ctx = canvas.getContext("2d");
    
    // Welcome Overlay Functions
    let welcomeOverlayShown = false; // Track if shown in this session
    
    function closeWelcomeOverlay() {
        console.log("Closing welcome overlay");
        const overlay = document.getElementById('welcome-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            welcomeOverlayShown = true;
        }
    }
    
    function showWelcomeOverlay() {
        const overlay = document.getElementById('welcome-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }
    
    // Show welcome overlay on first page load (after a short delay to ensure DOM is ready)
    if (!welcomeOverlayShown) {
        // Use a small delay to ensure the overlay element is fully rendered
        setTimeout(() => {
            showWelcomeOverlay();
        }, 100);
    }
    
    let fullAdjacency = new Map(), proteinMetadata = new Map(), aliasData = new Map(), allIDs = [];
    let nodes = [], links = [], nodeMap = new Map();
    // Expose the core research data to the window object
    window.nodes = nodes;
    window.links = links;
    window.fullAdjacency = fullAdjacency;
    window.proteinMetadata = proteinMetadata;
    window.aliasData = aliasData;
    let isPaused = false, physicsEnabled = true, isPhysicsStopped = false, selectedNodes = new Set(), selectedWedges = new Set(), selectedHistogramBins = new Set(), hoverBin = null;
    let selectionHistory = [], pathNodes = new Set(), pathEdges = new Set();
    let shortestPathDisplayMode = 'none';
    let shortestPathGroupsToolOpen = false;
    let shortestPathGroup1Ids = new Set();
    let shortestPathGroup2Ids = new Set();
    let isAdditiveMode = false, isSubtractMode = false, isIntersectMode = false;
    let additiveKeyHeld = false, subtractKeyHeld = false, intersectKeyHeld = false;
    let additiveModeLocked = false, subtractModeLocked = false, intersectModeLocked = false;
    let isVariableSettingsOpen = false;
    let isLassoMode = false, lassoPoints = [];
    let isBrushMode = false, brushPoints = [], brushRadius = 120;
    let isDragMode = false, draggedNode = null, hasDragged = false;
    let currentSeeds = [];
    let currentMousePos = [0, 0];
    let lastMousePosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let isBuilding = false;
    let isSettling = false;
    let physicsAutoPlayFromPause = false;
    let fullNetworkPostBuildAutoPauseTimer = null;
    let fullNetworkAlphaDriftTimer = null;
    let fullNetworkPostBuildAlphaStart = null;
    
    let isRenamingColl = null; 
    let currentViewId = 'base';
    let previousViewId = 'base';
    let collections = new Map();
    let activeSubData = null;
    let simulation = null;
    let selectedViewState = { nodes: [], links: [] }; 
    let isCreatingInline = false;
    let pendingDelete = null;
    let centralityScope = 'local';
    let currentColorMode = null;
    let currentColorRange = null;
    let currentColorData = null;
    let complexPdbColorState = null;
    let complexPdbColorStateDirty = true;
    let nodeVisibilityToggle = 'show';
    let nodeLabelToggle = 'hide';
    let nodeLabelField = '#string_protein_id'; // Will be updated to preferred_name if available after init
    let eigenScope = 'local';
    let hoveredNode = null;
    let isTooltipHovered = false;
    // Forward wheel events from the tooltip to the main canvas so zoom works while tooltip is hovered
    (function setupTooltipWheelForwarding() {
        try {
            const tooltip = document.getElementById('node-hover-tooltip');    
        if (!tooltip) return;
            tooltip.addEventListener('wheel', (e) => {
                // Prevent the tooltip from blocking zoom on the main canvas
                e.preventDefault();
                const synthetic = new WheelEvent('wheel', {
                    deltaY: e.deltaY,
                    deltaX: e.deltaX,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    bubbles: true,
                    cancelable: true
                });
                canvas.dispatchEvent(synthetic);
            }, { passive: false });
        } catch (err) {
            console.warn('Failed to setup tooltip wheel forwarding', err);
        }
    })();
    let chartToggleOpen = { pie: false, histogram: false };
    let histogramScope = 'full'; // 'full' or 'selected'
    let linkDirectionEnabled = false;
    let linkLabelToggle = 'hide';
    let linkLabelField = '';
    let interactionLinkLabelHeaders = [];
    let interactionLinkLabelValues = new Map();
    let isChartDragSelecting = false;
    let chartDragType = null;
    let suppressNextChartClick = false;
    let pieDataSource = 'network'; // 'network', 'selected', or 'collection_<name>'
    let histogramDataSource = 'network'; // 'network', 'selected', or 'collection_<name>'
    let vennCollectionA = 'selected';
    let vennCollectionB = null;
    let vennTransform = d3.zoomIdentity;
    let vennSelectedNodes = new Set();
    let vennPinnedSelectedNodes = new Set();
    let vennLayoutCache = null;
    let scatterXVariable = 'centrality';
    let scatterYVariable = 'size';
    let scatterTransform = d3.zoomIdentity;
    let scatterLayoutState = null;
    let scatterEigenCacheKey = null;
    let scatterPointsLoadingInProgress = false;
    let scatterPointsToRender = [];
    let scatterPointsRendered = 0;
    let mindMapSourceFile = '';
    let mindMapInfoFile = '';
    let mindMapLabelField = 'best_described_by';
    let mindMapTransform = d3.zoomIdentity;
    let mindMapLayoutState = null;
    let mindMapCollapsedNodes = new Set();
    let mindMapSelectedNodes = new Set();
    let mindMapClusterSizeColoring = false;
    let variableConfigMap = new Map();
    let embeddingViewType = 'sequence';
    let embeddingUmapDimension = '3d';
    let embeddingDataByType = {
        network: null,
        sequence: null
    };
    let embeddingWorker = null;
    let embeddingWorkerReady = false;
    let embeddingPlotReady = false;
    let embeddingLastRenderKey = '';
    let embeddingLastRenderType = null;
    let embeddingLastRenderDim = null;
    let embeddingSelectionSuppressUntil = 0;
    let embeddingIgnoreBgClicksUntil = 0;
    let embeddingControlsDirty = true;
    let embeddingPlotDirty = true;
    let embeddingRenderInFlight = false;
    let embeddingLastControlsKey = '';
    let embeddingLastInteractionKey = '';
    let embeddingSelectionHandlerEpoch = 0;
    let embeddingSelectedIdsByType = {
        network: new Set(),
        sequence: new Set()
    };
    let embeddingColorSimilarityType = 'sequence';
    let embeddingSelectionClearIntent = false;
    let embeddingReferenceNodeIdsByType = {
        network: new Set(),
        sequence: new Set()
    };
    let embeddingVectorsCacheByType = {
        network: null,
        sequence: null
    };
    let embeddingRangeMin = -1;
    let embeddingRangeMax = 1;
    let hoverVennNodeId = null;
    let hoverVennSection = null;
    let collectionMenuOpen = false;
    let histogramButtonHovered = null;
    let chartCollectionMenuView = null;
    let selectedNodesDraft = null;
    let chartCollectionMenuHover = false;
    let chartCollectionMenuHideTimer = null;
    let nodeInfoTableState = { columns: [], rows: [], filteredRows: [], searchQuery: '', mode: 'protein' };
    let isPointerOverMainCanvas = false;
    let proteinInfoBoxOpen = false;
    let proteinInfoMode = 'annotation';
    let proteinInfoCustomHeightPx = null;
    let proteinInfoNavigationHistory = [];
    let proteinInfoPreviousButtonSide = null;
    let proteinInfoStructureRenderToken = 0;
    let proteinInfoMolstarLoadPromise = null;
    let proteinInfoMolstarViewer = null;
    let proteinInfoMolstarBackgroundObserver = null;
    let proteinInfoZoomHotkeyState = null;
    let pdbAliasNearMissDebuggedNodes = new Set();
    let proteinComplexStructuresMetadataById = new Map();
    let proteinComplexStructuresLoadPromise = null;
    let proteinComplexStructuresRenderToken = 0;
    let proteinComplexStructuresObserver = null;
    let proteinComplexStructuresSearchQuery = '';
    let proteinComplexStructuresLoading = false;
    let proteinComplexStructuresPinnedPdbIds = new Set();
    let proteinComplexStructuresDetailEntry = null;
    let proteinComplexStructureDetailRenderToken = 0;
    let proteinComplexStructureDetailViewer = null;
    let proteinComplexStructureDetailBackgroundObserver = null;
let proteinComplexStructuresPlaceholderSrc = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#293546"/><stop offset="100%" stop-color="#111822"/></linearGradient></defs><rect width="800" height="500" rx="32" fill="url(#g)"/><g fill="none" stroke="#6f8ca9" stroke-width="10" stroke-linecap="round" opacity="0.6"><line x1="296" y1="140" x2="318" y2="125"/><line x1="430" y1="135" x2="475" y2="170"/><line x1="360" y1="170" x2="340" y2="240"/><line x1="480" y1="220" x2="380" y2="270"/><line x1="275" y1="190" x2="310" y2="245"/></g><g fill="none" stroke="#6f8ca9" stroke-width="10" opacity="0.8"><circle cx="250" cy="150" r="46"/><circle cx="374" cy="120" r="56"/><circle cx="510" cy="190" r="42"/><circle cx="330" cy="300" r="62"/></g><text x="50%" y="88%" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#a9c3da">Protein Complex Preview</text></svg>');    let nodeHoverTooltipTimer = null;
    let pendingNodeHoverTooltipId = null;
    
    // Guide-related variables
    let currentGuide = null; // { title, pages: [{ pageNumber, selectNodes, circleNodes, setText, text }] }
    let currentGuidePage = 1;
    let guideCircleOverlays = new Map(); // { nodeId: { color } }

    // Global log storage for AI to use
    const aiLogHistory = [];
    const maxAiLogs = 200; // Limit memory usage

    // This function intercepts console methods to store logs for AI access, while still outputting to the real console
    (function() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalDebug = console.debug;
        const originalWarn = console.warn;

        // Helper function to add logs to history
        function addLog(type, args) {
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            
            aiLogHistory.push({
                timestamp: new Date().toLocaleTimeString(),
                type: type,
                message: message
            });
            
            if (aiLogHistory.length > maxAiLogs) aiLogHistory.shift();
        }

        console.log = (...args) => { addLog('LOG', args); originalLog.apply(console, args); };
        console.error = (...args) => { addLog('ERROR', args); originalError.apply(console, args); };
        console.debug = (...args) => { addLog('DEBUG', args); originalDebug.apply(console, args); };
        console.warn = (...args) => { addLog('WARN', args); originalWarn.apply(console, args); };
    })();

    //AI tools
    const aiTools = [
        { type: 'function', function: { name: 'get_current_time', description: 'Get system time.' } },
        { type: 'function', function: { name: 'calculate_math', description: 'Solve math.', parameters: { type: 'object', properties: { eq: { type: 'string' } } } } },
        { type: 'function', function: { name: 'Search_and_select', description: 'Searches for and selects nodes. Put terms in quote marks (e.g. "lipid synthesis")', parameters: { type: 'object', properties: { query: { type: 'string' }, scope: { type: 'string', description: 'all|layer|centrality|annotation|localization|size or var::<file>::<variable>' } }, required: ['query'] } } },
        { type: 'function', function: { name: 'View_node_IDs', description: 'Views IDs of selected nodes.' } },
        { type: 'function', function: { name: 'View_preferred_name', description: 'Views preferred names of selected nodes.' } },
        { type: 'function', function: { name: 'View_annotation_data', description: 'Views annotation data of selected nodes. This is the more important protein information to view.' } },
        { type: 'function', function: { name: 'View_localisation_data', description: 'Views localisation data of selected nodes.' } },
        { type: 'function', function: { name: 'View_description_data', description: 'Views description data of selected nodes.' } },
        { type: 'function', function: { name: 'View_protein_size', description: 'Views size of selected proteins/nodes.' } },
        { type: 'function', function: { name: 'View_sequence_data', description: 'Views amino acid sequences of selected nodes.' } },
        { type: 'function', function: { name: 'View_centrality_data', description: 'Views centrality of selected nodes.' } },
        { type: 'function', function: { name: 'View_eigenvector_data', description: 'Views eigenvector centrality of selected nodes.' } },
        { type: 'function', function: { name: 'Save_to_collection', description: 'Saves selected nodes to a collection; creates it if needed.', parameters: { type: 'object', properties: { collection_name: { type: 'string' } } } } },
        { type: 'function', function: { name: 'View_screenshot', description: 'Captures and returns a screenshot of the window (including side panels). Use this if the user asks about what they are seeing.' } },
        { type: 'function', function: { name: 'create_guide', description: 'Creates a explanatory guide with multiple pages. Each page shows nodes you select, circles around specific nodes that you choose, and explanatory text. The text should mention the circled nodes (e.g. "enzymes (circled in red)"). Format the guide as: "Guide title: [title]\nPage: [number]\nSelect_nodes: [comma-separated node IDs]\nCircle_nodes: [color: node1, node2; another_color: node3]\nSet_view: [Selected Nodes|Full Network]\nText: [explanatory text]\nPage: [next page number]\n..." Repeat for each page.', parameters: { type: 'object', properties: { guide_content: { type: 'string', description: 'The complete guide text with all pages formatted as described.' } } } } },
        { type: 'function', function: { name: 'Deselect_nodes', description: 'Deselects all currently selected nodes.' } },
        { type: 'function', function: { name: 'Expand_to_connected', description: 'Expands the node selection to include nodes connected to the currently selected nodes (just like pressing the "+" hotkey).' } },
        { type: 'function', function: { name: 'View_variables', description: 'Views all available Colour Nodes By variables, their ranges (for numeric variables) and the number of categories (for categorical variables).' } },
        { type: 'function', function: { name: 'Change_node_colouring', description: 'Changes the Colour Nodes By variable to the one named when this tool is used. Use View_variables first to see available variables.', parameters: { type: 'object', properties: { variable_name: { type: 'string' } }, required: ['variable_name'] } } },
        { type: 'function', function: { name: 'View_last_console_logs', description: 'Returns the last N console logs.', parameters: { type: 'object', properties: { count: { type: 'number', description: 'Number of logs to return (e.g. 30).' } } } } },
        { type: 'function', function: { name: 'View_error_logs', description: 'Returns all captured error and debug logs.' } },
        { type: 'function', function: { name: 'See_view_options', description: 'Returns a list of all available network views and collections.' } },
        { type: 'function', function: { name: 'Change_view', description: 'Changes the active view.', parameters: { type: 'object', properties: { view_name: { type: 'string', description: 'The exact name or ID of the view.' } }, required: ['view_name'] } } },
        { 
            type: 'function', 
            function: { 
                name: 'Search_codebase', 
                description: 'Searches for a specific string or term across all accessible scripts. Use this if the user asks about a specific term in the code. When using this tool, it is best to just search for single keyword, or a two-word term like "pie chart". Avoid searching for long phrases or questions, as these are less likely to appear verbatim in the code. After using this tool, answer the users question, making sure to explain how the search results relate to the user\'s query.', 
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'The code string or term to find.' },
                        context_lines: { type: 'number', description: 'Number of lines to return for each match (1 returns just the match, 2 returns match + 1 line after, etc).' }
                    },
                    required: ['query']
                }
            } 
        },
        { 
            type: 'function', 
            function: { 
                name: 'View_code_snippet', 
                description: 'Returns all the code of a specific function (and summary of what the function does) or a range of lines from the codebase. If looking at a range of lines, don\'t look at more than 100 lines of code at once, unless you have to. After using this tool, answer the users question, making sure to explain what the code snippet represents and how it relates to the user\'s query.',
                parameters: {
                    type: 'object',
                    properties: {
                        function_name: { type: 'string', description: 'Name of the function to retrieve (e.g., "switchView"). Use this to answer questions about a function.' },
                        start_line: { type: 'number', description: 'Start line if function_name is not used.' },
                        end_line: { type: 'number', description: 'End line if function_name is not used.' }
                    }
                }
            } 
        },
        { 
            type: 'function', 
            function: { 
                name: 'View_all_functions', 
                description: 'Returns a list of all functions in the codebase along with their descriptions. Use this to get a geenral overview of the code if you need it.'
            } 
        },
        { 
            type: 'function', 
            function: { 
                name: 'Run_python_logic',
                description: 'Executes Python code (Pyodide) to analyze the research network. You have access to "app_data", which contains: "nodes", "links", "accessory_files", "accessory_values", and Colour Nodes By metadata such as "colour_nodes_by_variables" and "current_colour_mode". Example: print(len(app_data["nodes"])) or print(app_data["colour_nodes_by_variables"]);',
                parameters: {
                    type: 'object',
                    properties: {
                        code: { 
                            type: 'string', 
                            description: 'The Python code to execute. Example: "import numpy as np\nreturn np.mean(app_data)"' 
                        }
                    },
                    required: ['code']
                }
            } 
        }
    ];
    const aiChatHistory = [];
    const AI_MAIN_SYSTEM_PROMPT = 'You are an AI agent inside the StringScape app. StringScape is an app for visualising protein-protein interaction networks from the STRING database. Use multiple tool calls sequentially to gather information before answering questions. Most questions will require at least one tool call. You can also use tool calls to do things in the app that the user asks you to do. DO NOT include \"message:\" at the start of your content messages. The user is in no rush so use as many tool calls as you need until you find the answer. When you use Run_python_logic, `app_data` already contains Python-ready variable arrays in `app_data["python_variables"]`. For variable stats, always use this pattern: `vals = app_data["python_variables"].get("size", [])` or `vals = app_data["python_variables"].get(variable_name, [])`; then clean values with `clean = [float(v) for v in vals if v is not None and str(v).strip() != ""]`. Do not loop over `app_data["nodes"]` to find these variables because it may be empty. Do not write "import app_data" in Python — `app_data` is already injected as a global variable; reference it directly. These are some of the avalible python_variables: layer, centrality, eigen, pdb_structure_count, embeddings, collection, annotation, localization, size, and there are many more (use print(app_data["python_variables"].keys()) to see them all). Important: Always end each reply with a message reponce, very brefily saying what you have done.';
    const AI_FILE_SUMMARY_PROMPT = "Summarize the key things in this file fragment that are related to the users question. Be concise.";
    const aiChatTranscript = [];
    let aiAttachedItems = [];
    let aiLastSentSelectedNodes = new Set();
    let aiSelectedNodesAttachmentSuppressed = false;
    let aiConnected = false;
    let aiIsProcessing = false;
    let aiProcessingAbortController = null;
    let aiStopMessagePending = false;
    let aiSetupPanelOpen = true;
    let aiPromptsPanelOpen = false;
    const AI_CHAT_HISTORY_STORAGE_KEY = 'stringscape_ai_chat_history_v1';
    const AI_SCRIPT_HISTORY_STORAGE_KEY = 'stringscape_ai_script_history_v1';
    const AI_PYTHON_CONSOLE_SYSTEM_PROMPT = 'You are a Python script generator for StringScape. Return only Python code that can run in Pyodide. Do not include markdown code fences. Use app_data directly (already injected). If the user wants app actions, include tool_call("ToolName", {"arg":"value"}) lines in the script. Keep scripts concise and safe. If you have any questions write them as comments in the code (e.g. # Question: ...).';
    const AI_PYTHON_SCRIPT_INSTRUCTIONS_TEXT = `You can write Python scripts that run inside StringScape using Pyodide.\n\nAvailable data:\n- app_data["nodes"]: list of node objects\n- app_data["links"]: list of links\n- app_data["python_variables"]: ready-to-use variable arrays\n- app_data["colour_nodes_by_variables"] and app_data["current_colour_mode"]\n\nImportant:\n- Do not import app_data. It is already available.\n- For variable stats, use values from app_data["python_variables"] rather than scanning app_data["nodes"].\n- Use print(...) to show output.\n\nTool calls inside scripts:\n- You can perform app actions with lines such as:\n  tool_call("Change_node_colouring", {"variable_name": "size"})\n  tool_call("Change_view", {"view_name": "selected"})\n- These tool_call lines are executed by StringScape before Python execution.\n- Available tools match the AI tools (for example Search_and_select, Change_node_colouring, Change_view, Save_to_collection, etc.).`;
    const AI_EXAMPLE_SCRIPTS = [
        `# Summary of selected nodes by centrality\nvals = app_data["python_variables"].get("centrality", [])\nclean = [float(v) for v in vals if v is not None and str(v).strip() != ""]\nprint("Selected centrality values:", len(clean))\nif clean:\n    print("Mean:", sum(clean) / len(clean))`,
        `# Change the app state with tool calls\ntool_call("Change_view", {"view_name": "selected"})\ntool_call("Change_node_colouring", {"variable_name": "centrality"})\nprint("Switched to selected view and colored by centrality.")`,
        `# Top values from protein size\nvals = app_data["python_variables"].get("size", [])\nclean = [float(v) for v in vals if v is not None and str(v).strip() != ""]\nclean.sort(reverse=True)\nprint("Top 10 sizes:")\nfor v in clean[:10]:\n    print(v)`
    ];
    let aiChatHistoryRecords = [];
    let aiScriptHistoryRecords = [];
    let aiActiveChatId = null;
    let aiActiveScriptId = null;
    let aiHistoryPanelOpen = false;
    let aiEditingChatId = null;
    let aiPanelMode = 'agent';
    let aiPythonPromptHistory = [];
    let aiExamplePanelAgentHtml = '';
    let aiPythonCopyFeedbackTimer = null;
    const aiChatManualTitleIds = new Set();

    // This function toggles the visibility of the AI panel and updates the UI accordingly. It also triggers a redraw of the canvas and updates controls based on the current view to ensure everything is positioned correctly with the new panel state.
    function toggleAiPanel(forceState) {
        const nextOpen = typeof forceState === 'boolean'
            ? forceState
            : !document.body.classList.contains('ai-panel-open');
        if (!nextOpen) cancelAiProcessing(false);
        document.body.classList.toggle('ai-panel-open', nextOpen);
        // Do not shift canvas when AI panel opens/closes (keep center stable)
        
        // For Scatter Plot, only update controls without full redraw to avoid freezing
        if (currentViewId === 'Scatter Plot') {
            updateScatterControls();
            return;
        }
        
        draw();
        
        // Refresh visualizations in current view to recalculate positions based on new center
        if (currentViewId === 'Mind Map') {
            updateMindMapControls();
        } else if (currentViewId === 'Venn Diagram') {
            updateVennControls();
        } else if (currentViewId === 'Embeddings') {
            refreshEmbeddingsView(false);
        } else if (currentViewId === 'pie_chart' || currentViewId === 'histogram') {
            // These views need to re-render the mini charts
            switchView(currentViewId);
        }
        // Update the floating Ask AI button label to reflect panel state
        try {
            const askBtn = document.getElementById('ask-ai-btn');
            if (askBtn) askBtn.textContent = nextOpen ? 'Close AI' : 'Ask AI';
        } catch (e) { /* ignore */ }
        aiRefreshFloatingConsoleButton();
    }

    // This function updates the state of the AI send button based on whether the AI is currently processing a request and whether it is connected. It changes the button text, styling, and disabled state accordingly to provide feedback to the user about the AI's status.
    function updateAiSendButton() {
        const sendBtn = document.getElementById('ai-send-btn');
        if (!sendBtn) return;
        if (aiIsProcessing) {
            sendBtn.textContent = 'Stop';
            sendBtn.classList.add('ai-processing');
            sendBtn.classList.remove('ai-btn-disabled');
        } else {
            sendBtn.textContent = 'SEND';
            sendBtn.classList.remove('ai-processing');
            if (aiConnected) sendBtn.classList.remove('ai-btn-disabled');
            else sendBtn.classList.add('ai-btn-disabled');
        }
    }

    // This function cancels any ongoing AI processing. If the AI is currently processing a request and the showStopMessage flag is true, it sets a pending message to inform the user that the process was stopped. It aborts any ongoing fetch requests related to AI processing, resets the processing state, hides any AI-related UI elements (like a glow effect), and updates the send button to reflect that the AI is no longer processing.
    function cancelAiProcessing(showStopMessage = true) {
        if (aiIsProcessing && showStopMessage) aiStopMessagePending = true;
        if (aiProcessingAbortController) {
            aiProcessingAbortController.abort();
            aiProcessingAbortController = null;
        }
        aiIsProcessing = false;
        const glow = document.getElementById('ai-glow-container');
        if (glow) glow.style.display = 'none';
        updateAiSendButton();
    }

    // This function automatically expands the AI user message textarea element based on its content.
    function aiAutoExpand(el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
        el.style.borderRadius = el.scrollHeight > 44 ? '12px' : '20px';
        el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
    }

    // This function refreshes the visibility and state of the AI top panels based on the connection status and other flags.
    function refreshAiTopPanels(autoFromConnection = false) {
        if (autoFromConnection) {
            aiSetupPanelOpen = !aiConnected;
            if (!aiConnected) aiPromptsPanelOpen = false;
        }
        const setupPanel = document.getElementById('ai-setup-panel');
        const promptsPanel = document.getElementById('ai-prompts-panel');
        const setupBtn = document.getElementById('ai-setup-toggle-btn');
        const promptsBtn = document.getElementById('ai-prompts-toggle-btn');
        if (setupPanel) setupPanel.style.display = aiSetupPanelOpen ? 'block' : 'none';
        if (promptsPanel) promptsPanel.style.display = aiPromptsPanelOpen ? 'block' : 'none';
        if (setupBtn) setupBtn.classList.toggle('active', aiSetupPanelOpen);
        if (promptsBtn) promptsBtn.classList.toggle('active', aiPromptsPanelOpen);
    }

    function aiRenderExamplePanel() {
        const container = document.getElementById('ai-example-panel-content');
        if (!container) return;
        if (aiPanelMode !== 'python') {
            container.innerHTML = aiExamplePanelAgentHtml || container.innerHTML;
            // Re-bind example prompt listeners after HTML restoration
            container.querySelectorAll('.ai-example-item').forEach(button => {
                button.addEventListener('click', () => loadExamplePrompt(button.textContent));
            });
            return;
        }
        container.innerHTML = '';
        AI_EXAMPLE_SCRIPTS.forEach(script => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ai-example-item';
            btn.textContent = script;
            btn.addEventListener('click', () => loadExamplePrompt(script));
            container.appendChild(btn);
        });
    }

    function closeAiModeDropdown() {
        const dropdown = document.getElementById('ai-mode-dropdown');
        if (dropdown) dropdown.classList.remove('open');
    }

    function toggleAiModeDropdown() {
        const dropdown = document.getElementById('ai-mode-dropdown');
        if (!dropdown) return;
        dropdown.classList.toggle('open');
    }

    function aiRefreshPanelModeUi() {
        const title = document.getElementById('ai-header-title');
        const newBtn = document.getElementById('ai-new-chat-btn');
        const downloadBtn = document.getElementById('ai-download-menu-btn');
        const historyBtn = document.getElementById('ai-history-toggle-btn');
        const promptsBtn = document.getElementById('ai-prompts-toggle-btn');
        const fileBtn = document.getElementById('ai-file-btn');
        const preview = document.getElementById('ai-preview-area');
        const chatScroll = document.getElementById('ai-chat-scroll');
        const pythonConsole = document.getElementById('ai-python-console');
        const input = document.getElementById('ai-user-input');
        const statusOverlay = document.getElementById('ai-status-overlay');
        const agentModeOption = document.getElementById('ai-mode-agent-option');
        const pythonModeOption = document.getElementById('ai-mode-python-option');

        const isPython = aiPanelMode === 'python';

        if (title) title.textContent = isPython ? 'Python Console ▾' : 'AI Agent ▾';
        if (newBtn) newBtn.textContent = isPython ? '+ New Script' : '+ New Chat';
        if (downloadBtn) downloadBtn.textContent = isPython ? 'Download Script' : 'Download Chat';
        if (historyBtn) historyBtn.textContent = isPython ? 'Script History' : 'Chat History';
        if (promptsBtn) promptsBtn.textContent = isPython ? 'Example Scripts' : 'Example Prompts';
        if (chatScroll) chatScroll.style.display = isPython ? 'none' : 'flex';
        if (pythonConsole) pythonConsole.style.display = isPython ? 'block' : 'none';
        if (preview) preview.style.display = isPython ? 'none' : 'flex';
        if (fileBtn) fileBtn.style.display = isPython ? 'none' : 'inline-block';
        if (statusOverlay) statusOverlay.style.display = isPython ? 'none' : 'block';
        if (input) input.placeholder = isPython ? 'Describe what you want the script to do...' : 'Ask AI anything...';
        if (agentModeOption) agentModeOption.classList.toggle('active', !isPython);
        if (pythonModeOption) pythonModeOption.classList.toggle('active', isPython);

        const instructionsBody = document.getElementById('ai-python-instructions-body');
        if (instructionsBody) instructionsBody.textContent = aiBuildPythonInstructionsText();
        aiRenderExamplePanel();

        aiRefreshFloatingConsoleButton();
        aiRefreshAskAiButton();
    }

    function setAiPanelMode(mode) {
        if (mode !== 'agent' && mode !== 'python') return;
        if (aiPanelMode === mode) {
            closeAiModeDropdown();
            return;
        }
        if (aiPanelMode === 'agent') {
            aiArchiveCurrentChat(false);
        } else {
            aiArchiveCurrentScript(false);
        }
        aiPanelMode = mode;
        aiHistoryPanelOpen = false;
        aiEditingChatId = null;
        aiPromptsPanelOpen = false;
        aiSetupPanelOpen = (mode === 'agent') ? aiSetupPanelOpen : false;
        refreshAiTopPanels(false);
        aiRefreshPanelModeUi();
        aiRenderChatHistory();
        closeAiModeDropdown();
    }

    function openPythonInstructionsBox() {
        const box = document.getElementById('ai-python-instructions-box');
        const body = document.getElementById('ai-python-instructions-body');
        if (body) body.textContent = aiBuildPythonInstructionsText();
        if (box) box.classList.add('open');
    }

    function closePythonInstructionsBox() {
        const box = document.getElementById('ai-python-instructions-box');
        if (box) box.classList.remove('open');
    }

    async function copyPythonInstructions() {
        const button = document.getElementById('ai-copy-python-instructions');
        try {
            await navigator.clipboard.writeText(aiBuildPythonInstructionsText());
            if (button) {
                const originalLabel = button.dataset.originalLabel || button.textContent;
                button.dataset.originalLabel = originalLabel;
                button.textContent = 'Copied!';
                if (aiPythonCopyFeedbackTimer) clearTimeout(aiPythonCopyFeedbackTimer);
                aiPythonCopyFeedbackTimer = setTimeout(() => {
                    button.textContent = originalLabel;
                    aiPythonCopyFeedbackTimer = null;
                }, 1200);
            }
        } catch (error) {
            console.warn('Could not copy Python instructions', error);
        }
    }

    function aiFormatToolParameters(toolDefinition) {
        const parameters = toolDefinition?.function?.parameters;
        if (!parameters || !parameters.properties) return 'none';
        const required = new Set(parameters.required || []);
        return Object.entries(parameters.properties).map(([name, schema]) => {
            const parts = [];
            parts.push(name + (required.has(name) ? ' (required)' : ''));
            if (schema?.type) parts.push(schema.type);
            if (schema?.description) parts.push(schema.description);
            if (schema?.enum) {
                const exampleValues = schema.enum.slice(0, 3).join(', ');
                parts.push(`options: [${exampleValues}${schema.enum.length > 3 ? ', ...' : ''}]`);
            }
            return parts.join(': ');
        }).join('; ');
    }

    function aiBuildPythonInstructionsText() {
        const lines = [];
        lines.push('You can write Python scripts that run inside StringScape using Pyodide.');
        lines.push('');
        lines.push('These instructions can be given to any AI along with a description of what you want the script to do.');
        lines.push('');
        lines.push('Available data:');
        lines.push('- app_data["nodes"]: list of node objects');
        lines.push('- app_data["links"]: list of links');
        lines.push('- app_data["python_variables"]: ready-to-use variable arrays');
        lines.push('- app_data["colour_nodes_by_variables"] and app_data["current_colour_mode"]');
        lines.push('');
        lines.push('Important:');
        lines.push('- Do not import app_data. It is already available.');
        lines.push('- For variable stats, use values from app_data["python_variables"] rather than scanning app_data["nodes"].');
        lines.push('- Use print(...) to show output.');
        lines.push('');
        lines.push('Tool calls inside scripts:');
        lines.push('- Write tool calls as lines such as tool_call("Change_node_colouring", {"variable_name": "size"}).');
        lines.push('- These tool_call lines are executed by StringScape before Python execution.');
        lines.push('- Available tools:');
        aiTools.forEach(toolEntry => {
            const tool = toolEntry?.function || {};
            lines.push(`  - ${tool.name}: ${tool.description || 'No description provided.'}`);
            const params = aiFormatToolParameters(toolEntry);
            if (params && params !== 'none') lines.push(`    Parameters: ${params}`);
        });
        return lines.join('\n').replace(/&quot;/g, '"');
    }

    function aiRefreshFloatingConsoleButton() {
        const button = document.getElementById('ai-python-console-btn');
        if (!button) return;
        if (document.body.classList.contains('ai-panel-open') && aiPanelMode === 'python') {
            button.textContent = 'Close Console';
        } else {
            button.textContent = 'Python Console';
        }
    }

    function aiRefreshAskAiButton() {
        const button = document.getElementById('ask-ai-btn');
        if (!button) return;
        if (!document.body.classList.contains('ai-panel-open')) {
            button.textContent = 'Ask AI';
            button.onclick = () => {
                toggleAiPanel(true);
                setAiPanelMode('agent');
                aiRefreshAskAiButton();
            };
            return;
        }
        if (aiPanelMode === 'python') {
            button.textContent = 'Ask AI';
            button.onclick = () => {
                setAiPanelMode('agent');
                aiRefreshAskAiButton();
            };
            return;
        }
        button.textContent = 'Close AI';
        button.onclick = () => {
            toggleAiPanel(false);
            aiRefreshAskAiButton();
        };
    }

    function togglePythonConsoleMode() {
        if (document.body.classList.contains('ai-panel-open') && aiPanelMode === 'python') {
            toggleAiPanel(false);
            aiRefreshFloatingConsoleButton();
            aiRefreshAskAiButton();
            return;
        }
        if (!document.body.classList.contains('ai-panel-open')) {
            toggleAiPanel(true);
        }
        setAiPanelMode('python');
        aiRefreshFloatingConsoleButton();
        aiRefreshAskAiButton();
    }

    function aiCloseHistoryPanel() {
        aiHistoryPanelOpen = false;
        aiEditingChatId = null;
        aiRenderChatHistory();
    }

    function aiCloseSetupAndPromptsPanels() {
        aiSetupPanelOpen = false;
        aiPromptsPanelOpen = false;
        refreshAiTopPanels(false);
    }

    function aiSafeClone(value) {
        if (value === null || value === undefined) return value;
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (error) {
            }
        }
        return JSON.parse(JSON.stringify(value));
    }

    function aiGetMessageText(content) {
        if (Array.isArray(content)) {
            return content.map(part => {
                if (part?.type === 'text') return part.text || '';
                if (part?.type === 'image_url') return '[Image attachment]';
                return '';
            }).filter(Boolean).join(' ').trim();
        }
        return String(content || '').trim();
    }

    function aiBuildChatSummaryText(record) {
        const lines = [];
        (record?.messages || []).forEach(message => {
            if (message?.role !== 'user' && message?.role !== 'assistant') return;
            const text = aiGetMessageText(message.content);
            if (!text) return;
            lines.push(`${message.role === 'user' ? 'User' : 'Assistant'}: ${text}`);
        });
        return lines.join('\n\n').slice(0, 6000);
    }

    function aiCleanChatTitle(title) {
        return String(title || '')
            .replace(/^[-"'`\s]+|[-"'`\s]+$/g, '')
            .replace(/\s+/g, ' ')
            .replace(/[\r\n]+/g, ' ')
            .trim();
    }

    function aiFallbackChatTitle(record) {
        const firstUser = (record?.messages || []).find(message => message?.role === 'user');
        const firstUserText = aiCleanChatTitle(aiGetMessageText(firstUser?.content));
        if (firstUserText) return firstUserText.slice(0, 48);
        const titleSource = aiCleanChatTitle(aiBuildChatSummaryText(record));
        if (titleSource) return titleSource.slice(0, 48);
        return `Chat ${new Date(record?.updatedAt || Date.now()).toLocaleDateString()}`;
    }

    function aiLoadSavedChats() {
        const hydrateRecords = (rawRecords) => (Array.isArray(rawRecords) ? rawRecords : [])
            .filter(record => record && typeof record === 'object')
            .map(record => ({
                id: record.id || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                title: aiCleanChatTitle(record.title) || 'Untitled Chat',
                createdAt: Number(record.createdAt) || Date.now(),
                updatedAt: Number(record.updatedAt) || Number(record.createdAt) || Date.now(),
                messages: Array.isArray(record.messages) ? record.messages.map(message => aiSafeClone(message)) : [],
                transcript: Array.isArray(record.transcript) ? record.transcript.map(entry => aiSafeClone(entry)) : [],
                script: typeof record.script === 'string' ? record.script : '',
                manualTitle: Boolean(record.manualTitle)
            }))
            .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));

        try {
            const raw = localStorage.getItem(AI_CHAT_HISTORY_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            aiChatHistoryRecords = hydrateRecords(parsed);
        } catch (error) {
            aiChatHistoryRecords = [];
        }

        try {
            const raw = localStorage.getItem(AI_SCRIPT_HISTORY_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            aiScriptHistoryRecords = hydrateRecords(parsed);
        } catch (error) {
            aiScriptHistoryRecords = [];
        }
    }

    function aiPersistSavedChats(mode = aiPanelMode) {
        const storageKey = mode === 'python' ? AI_SCRIPT_HISTORY_STORAGE_KEY : AI_CHAT_HISTORY_STORAGE_KEY;
        const records = mode === 'python' ? aiScriptHistoryRecords : aiChatHistoryRecords;
        try {
            localStorage.setItem(storageKey, JSON.stringify(records));
        } catch (error) {
            console.warn('Could not save AI chat history', error);
        }
    }

    function aiUpsertSavedChat(record, mode = aiPanelMode) {
        if (!record) return null;
        const records = mode === 'python' ? aiScriptHistoryRecords : aiChatHistoryRecords;
        const safeRecord = {
            id: record.id || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: aiCleanChatTitle(record.title) || 'Untitled Chat',
            createdAt: Number(record.createdAt) || Date.now(),
            updatedAt: Number(record.updatedAt) || Date.now(),
            messages: Array.isArray(record.messages) ? record.messages.map(message => aiSafeClone(message)) : [],
            transcript: Array.isArray(record.transcript) ? record.transcript.map(entry => aiSafeClone(entry)) : [],
            script: typeof record.script === 'string' ? record.script : '',
            manualTitle: Boolean(record.manualTitle)
        };
        const index = records.findIndex(existing => existing.id === safeRecord.id);
        if (index >= 0) {
            records[index] = safeRecord;
        } else {
            records.unshift(safeRecord);
        }
        records.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
        aiPersistSavedChats(mode);
        return safeRecord;
    }

    function aiUpdateSavedChatTitle(chatId, title) {
        if (!chatId) return;
        const records = aiPanelMode === 'python' ? aiScriptHistoryRecords : aiChatHistoryRecords;
        const record = records.find(entry => entry.id === chatId);
        if (!record) return;
        record.title = aiCleanChatTitle(title) || record.title || 'Untitled Chat';
        if (aiPanelMode !== 'python') {
            aiChatManualTitleIds.add(chatId);
            record.manualTitle = true;
        }
        record.updatedAt = Date.now();
        records.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
        aiPersistSavedChats(aiPanelMode);
        aiRenderChatHistory();
        aiRefreshCurrentScriptTitle();
    }

    function aiRenderChatHistory() {
        const panel = document.getElementById('ai-history-panel');
        const button = document.getElementById('ai-history-toggle-btn');
        const records = aiPanelMode === 'python' ? aiScriptHistoryRecords : aiChatHistoryRecords;
        const activeId = aiPanelMode === 'python' ? aiActiveScriptId : aiActiveChatId;
        if (button) button.classList.toggle('active', aiHistoryPanelOpen);
        if (!panel) return;
        panel.style.display = aiHistoryPanelOpen ? 'block' : 'none';
        panel.innerHTML = '';

        if (!aiHistoryPanelOpen) return;

        if (!records.length) {
            const empty = document.createElement('div');
            empty.className = 'ai-history-empty';
            empty.textContent = aiPanelMode === 'python' ? 'No previous scripts yet.' : 'No previous chats yet.';
            panel.appendChild(empty);
            return;
        }

        const list = document.createElement('div');
        list.className = 'ai-history-list';

        records.forEach(record => {
            const item = document.createElement('div');
            item.className = 'ai-history-item';
            item.dataset.chatId = record.id;
            if (record.id === activeId) item.classList.add('active');
            if (record.id === aiEditingChatId) item.classList.add('editing');

            const main = document.createElement('button');
            main.type = 'button';
            main.className = 'ai-history-item-main';
            main.addEventListener('click', () => {
                if (aiPanelMode === 'python') aiLoadScriptFromHistory(record.id);
                else aiLoadChatFromHistory(record.id);
            });

            const titleRow = document.createElement('div');
            titleRow.className = 'ai-history-title-row';

            const content = document.createElement('div');
            content.className = 'ai-history-item-content';

            const title = document.createElement('div');
            title.className = 'ai-history-item-title';
            title.textContent = record.title || 'Untitled Chat';

            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'ai-history-title-input';
            titleInput.value = record.title || 'Untitled Chat';
            titleInput.addEventListener('click', event => event.stopPropagation());
            titleInput.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    aiCommitChatTitleEdit(record.id, titleInput.value);
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    aiCancelChatTitleEdit();
                }
            });
            titleInput.addEventListener('blur', () => aiCommitChatTitleEdit(record.id, titleInput.value));

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'ai-history-edit-btn';
            editBtn.textContent = '✎';
            editBtn.title = 'Edit chat title';
            editBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                aiBeginChatTitleEdit(record.id);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'ai-history-delete-btn';
            deleteBtn.textContent = 'X';
            deleteBtn.title = aiPanelMode === 'python' ? 'Delete script' : 'Delete chat';
            deleteBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (aiPanelMode === 'python') aiDeleteScriptFromHistory(record.id);
                else aiDeleteChatFromHistory(record.id);
            });

            titleRow.appendChild(title);
            titleRow.appendChild(titleInput);

            const meta = document.createElement('div');
            meta.className = 'ai-history-item-meta';
            meta.textContent = new Date(record.updatedAt || record.createdAt || Date.now()).toLocaleString();

            content.appendChild(titleRow);
            content.appendChild(meta);

            const actions = document.createElement('div');
            actions.className = 'ai-history-item-actions';
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);

            main.appendChild(content);
            main.appendChild(actions);

            item.appendChild(main);
            list.appendChild(item);
        });

        panel.appendChild(list);
    }

    function aiToggleHistoryPanel() {
        if (!aiHistoryPanelOpen) {
            aiCloseSetupAndPromptsPanels();
        }
        aiHistoryPanelOpen = !aiHistoryPanelOpen;
        if (!aiHistoryPanelOpen) aiEditingChatId = null;
        aiRenderChatHistory();
    }

    function aiBeginChatTitleEdit(chatId) {
        aiCloseSetupAndPromptsPanels();
        aiHistoryPanelOpen = true;
        aiEditingChatId = chatId;
        aiRenderChatHistory();
        const input = document.querySelector(`.ai-history-item[data-chat-id="${CSS.escape(chatId)}"] .ai-history-title-input`);
        if (input) {
            input.focus();
            input.select();
        }
    }

    function aiCancelChatTitleEdit() {
        aiEditingChatId = null;
        aiRenderChatHistory();
    }

    function aiCommitChatTitleEdit(chatId, nextTitle) {
        const cleaned = aiCleanChatTitle(nextTitle) || 'Untitled Chat';
        aiUpdateSavedChatTitle(chatId, cleaned);
        aiEditingChatId = null;
        aiRenderChatHistory();
    }

    function aiSetChatboxEmptyState() {
        const chatbox = document.getElementById('ai-chatbox');
        if (!chatbox) return;
        chatbox.innerHTML = '';
        const disclaimer = document.createElement('div');
        disclaimer.className = 'ai-chat-disclaimer';
        disclaimer.textContent = 'As you well know, AI can make mistakes. Please verify its claims for anything important, especially if writing a research paper.';
        chatbox.appendChild(disclaimer);
    }

    function aiBuildCurrentChatRecord() {
        const hasContent = aiChatHistory.length > 0 || aiChatTranscript.length > 0;
        if (!hasContent) return null;
        const now = Date.now();
        const existing = aiChatHistoryRecords.find(record => record.id === aiActiveChatId);
        const chatId = aiActiveChatId || `chat-${now}-${Math.random().toString(36).slice(2, 8)}`;
        if (!aiActiveChatId) aiActiveChatId = chatId;
        return {
            id: chatId,
            title: existing?.title || '',
            createdAt: existing?.createdAt || now,
            updatedAt: now,
            messages: aiSafeClone(aiChatHistory) || [],
            transcript: aiSafeClone(aiChatTranscript) || []
        };
    }

    function aiArchiveCurrentChat(generateTitle = false) {
        const record = aiBuildCurrentChatRecord();
        if (!record) return null;
        const existingRecord = aiChatHistoryRecords.find(entry => entry.id === record.id);
        const wasManuallyTitled = aiChatManualTitleIds.has(record.id) || Boolean(existingRecord?.manualTitle);
        const storedRecord = aiUpsertSavedChat({
            ...record,
            title: wasManuallyTitled ? (existingRecord?.title || record.title || 'Untitled Chat') : aiFallbackChatTitle(record),
            manualTitle: wasManuallyTitled || aiChatManualTitleIds.has(record.id)
        }, 'agent');
        if (storedRecord && generateTitle && !wasManuallyTitled) {
            void aiGenerateChatTitle(storedRecord, 'agent');
        }
        return storedRecord;
    }

    function aiBuildCurrentScriptRecord() {
        const scriptEditor = document.getElementById('ai-python-script-editor');
        const scriptText = scriptEditor ? String(scriptEditor.value || '').trim() : '';
        const hasContent = aiPythonPromptHistory.length > 0 || scriptText.length > 0;
        if (!hasContent) return null;
        const now = Date.now();
        const existing = aiScriptHistoryRecords.find(record => record.id === aiActiveScriptId);
        const scriptId = aiActiveScriptId || `script-${now}-${Math.random().toString(36).slice(2, 8)}`;
        if (!aiActiveScriptId) aiActiveScriptId = scriptId;
        const messages = aiSafeClone(aiPythonPromptHistory) || [];
        if (scriptText) messages.push({ role: 'user', content: `Current script:\n${scriptText}` });
        return {
            id: scriptId,
            title: existing?.title || '',
            createdAt: existing?.createdAt || now,
            updatedAt: now,
            messages,
            transcript: [],
            script: scriptText
        };
    }

    function aiArchiveCurrentScript(generateTitle = false) {
        const record = aiBuildCurrentScriptRecord();
        if (!record) return null;
        const storedRecord = aiUpsertSavedChat({
            ...record,
            title: aiFallbackChatTitle(record)
        }, 'python');
        if (storedRecord && generateTitle) {
            void aiGenerateChatTitle(storedRecord, 'python');
        }
        return storedRecord;
    }

    async function aiGenerateChatTitle(record, mode = 'agent') {
        if (!record) return;
        const summary = aiBuildChatSummaryText(record);
        if (!summary) return;
        const urlInput = document.getElementById('ai-server-url');
        const resolvedUrl = urlInput ? (urlInput.value.trim() || urlInput.placeholder.trim()) : '';
        if (!resolvedUrl) return;
        try {
            const response = await fetch(resolvedUrl.replace(/\/$/, '') + '/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: 'Create a short title of 2 to 6 words for this chat. Return only the title, with no quotes, punctuation, or extra commentary.'
                        },
                        {
                            role: 'user',
                            content: summary
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: 20
                })
            });
            if (!response.ok) return;
            const data = await response.json();
            const rawTitle = (() => {
                const choice = data?.choices?.[0];
                if (!choice) return '';
                if (typeof choice?.message?.content === 'string') return choice.message.content;
                if (Array.isArray(choice?.message?.content)) {
                    return choice.message.content
                        .map(part => typeof part?.text === 'string' ? part.text : '')
                        .join(' ')
                        .trim();
                }
                if (typeof choice?.text === 'string') return choice.text;
                return '';
            })();
            const title = aiCleanChatTitle(rawTitle);
            if (!title) return;
            const records = mode === 'python' ? aiScriptHistoryRecords : aiChatHistoryRecords;
            const stored = records.find(entry => entry.id === record.id);
            if (!stored) return;
            stored.title = title;
            stored.updatedAt = Date.now();
            records.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
            aiPersistSavedChats(mode);
            aiRenderChatHistory();
        } catch (error) {
            console.warn('Could not generate AI chat title', error);
        }
    }

    function aiRestoreChatFromRecord(record) {
        const chatbox = document.getElementById('ai-chatbox');
        if (!chatbox) return;
        chatbox.innerHTML = '';
        if (!record || (!Array.isArray(record.transcript) && !Array.isArray(record.messages))) {
            aiSetChatboxEmptyState();
            return;
        }

        const transcript = Array.isArray(record.transcript) ? record.transcript : [];
        let pendingAttachments = [];
        let hasRenderedContent = false;

        if (transcript.length > 0) {
            transcript.forEach(entry => {
                if (!entry) return;
                if (entry.kind === 'stringscape') {
                    return;
                }
                if (entry.kind === 'attached_files') {
                    pendingAttachments = (entry.items || []).map(item => aiCloneAttachment(item));
                    return;
                }
                if (entry.kind === 'user') {
                    aiAppendMessage(entry.content || '', 'user', pendingAttachments);
                    pendingAttachments = [];
                    hasRenderedContent = true;
                    return;
                }
                if (entry.kind === 'ai_thoughts') {
                    aiAddThoughtLog(entry.seconds || 0, entry.content || '');
                    hasRenderedContent = true;
                    return;
                }
                if (entry.kind === 'ai') {
                    aiAppendMessage(entry.content || '', 'ai');
                    hasRenderedContent = true;
                    return;
                }
                if (entry.kind === 'tool_call') {
                    const toolName = entry.name ? String(entry.name).replace(/_/g, ' ') : 'tool';
                    aiAddLog(`Used ${toolName}`);
                    hasRenderedContent = true;
                    return;
                }
                if (entry.kind === 'tool') {
                    const toolName = entry.name ? String(entry.name).replace(/_/g, ' ') : 'tool';
                    aiAddLog(`Tool response from ${toolName}`);
                    hasRenderedContent = true;
                }
            });
        }

        if (!hasRenderedContent) {
            aiSetChatboxEmptyState();
        }
        document.getElementById('ai-chat-scroll').scrollTop = document.getElementById('ai-chat-scroll').scrollHeight;
    }

    function aiLoadChatFromHistory(chatId) {
        const record = aiChatHistoryRecords.find(entry => entry.id === chatId);
        if (!record) return;
        if (aiActiveChatId !== record.id) {
            aiArchiveCurrentChat(false);
        }
        cancelAiProcessing(false);
        aiActiveChatId = record.id;
        aiChatHistory.length = 0;
        (Array.isArray(record.messages) ? record.messages : []).forEach(message => aiChatHistory.push(aiSafeClone(message)));
        aiChatTranscript.length = 0;
        (Array.isArray(record.transcript) ? record.transcript : []).forEach(entry => aiChatTranscript.push(aiSafeClone(entry)));
        aiAttachedItems = [];
        aiLastSentSelectedNodes = new Set();
        aiSelectedNodesAttachmentSuppressed = false;
        aiCloseHistoryPanel();
        const input = document.getElementById('ai-user-input');
        if (input) {
            input.value = '';
            input.style.height = 'auto';
            aiAutoExpand(input);
        }
        document.getElementById('ai-preview-area').innerHTML = '';
        aiRestoreChatFromRecord(record);
        aiRenderChatHistory();
    }

    function aiDeleteChatFromHistory(chatId) {
        const index = aiChatHistoryRecords.findIndex(entry => entry.id === chatId);
        if (index < 0) return;
        const wasActive = aiActiveChatId === chatId;
        aiChatHistoryRecords.splice(index, 1);
        aiPersistSavedChats();
        if (wasActive) {
            aiActiveChatId = null;
            aiChatHistory.length = 0;
            aiChatTranscript.length = 0;
            aiAttachedItems = [];
            aiLastSentSelectedNodes = new Set();
            aiSelectedNodesAttachmentSuppressed = false;
            const input = document.getElementById('ai-user-input');
            if (input) {
                input.value = '';
                input.style.height = 'auto';
                aiAutoExpand(input);
            }
            document.getElementById('ai-preview-area').innerHTML = '';
            aiSetChatboxEmptyState();
        }
        if (aiEditingChatId === chatId) aiEditingChatId = null;
        aiRenderChatHistory();
    }

    function aiLoadScriptFromHistory(scriptId) {
        const record = aiScriptHistoryRecords.find(entry => entry.id === scriptId);
        if (!record) return;
        if (aiActiveScriptId !== record.id) {
            aiArchiveCurrentScript(false);
        }
        cancelAiProcessing(false);
        aiActiveScriptId = record.id;
        aiPythonPromptHistory = Array.isArray(record.messages) ? record.messages.map(message => aiSafeClone(message)).filter(msg => msg?.role === 'user' || msg?.role === 'assistant') : [];
        const scriptEditor = document.getElementById('ai-python-script-editor');
        if (scriptEditor) scriptEditor.value = String(record.script || '');
        aiActiveScriptId = record.id;
        const runOut = document.getElementById('ai-python-run-output');
        if (runOut) runOut.textContent = '';
        aiCloseHistoryPanel();
        aiRefreshCurrentScriptTitle();
        aiRenderChatHistory();
    }

    function aiDeleteScriptFromHistory(scriptId) {
        const index = aiScriptHistoryRecords.findIndex(entry => entry.id === scriptId);
        if (index < 0) return;
        const wasActive = aiActiveScriptId === scriptId;
        aiScriptHistoryRecords.splice(index, 1);
        aiPersistSavedChats('python');
        if (wasActive) {
            aiActiveScriptId = null;
            aiPythonPromptHistory = [];
            const scriptEditor = document.getElementById('ai-python-script-editor');
            if (scriptEditor) scriptEditor.value = '';
            const runOut = document.getElementById('ai-python-run-output');
            if (runOut) runOut.textContent = '';
        }
        if (aiEditingChatId === scriptId) aiEditingChatId = null;
        aiRefreshCurrentScriptTitle();
        aiRenderChatHistory();
    }

    function aiRefreshCurrentScriptTitle() {
        const titleEl = document.getElementById('ai-current-script-title');
        if (!titleEl) return;
        const record = aiScriptHistoryRecords.find(entry => entry.id === aiActiveScriptId);
        const title = record?.title || 'Untitled Script';
        titleEl.textContent = `Current Script: ${title}`;
    }

    // This function toggles the visibility of the AI top panels (setup and prompts) based on user interaction. It ensures that only one panel is open at a time and updates the UI accordingly by calling refreshAiTopPanels.
    function toggleAiTopPanel(panel) {
        if (panel === 'setup') {
            aiCloseHistoryPanel();
            aiSetupPanelOpen = !aiSetupPanelOpen;
            if (aiSetupPanelOpen) aiPromptsPanelOpen = false;
        } else if (panel === 'prompts') {
            aiCloseHistoryPanel();
            aiPromptsPanelOpen = !aiPromptsPanelOpen;
            if (aiPromptsPanelOpen) aiSetupPanelOpen = false;
        }
        refreshAiTopPanels(false);
    }

    // This function loads an example prompt into the AI user input field.
    function loadExamplePrompt(promptText) {
        if (aiPanelMode === 'python') {
            const scriptEditor = document.getElementById('ai-python-script-editor');
            const currentScript = String(scriptEditor?.value || '').trim();
            if (currentScript) {
                aiNewChat();
            }
            if (scriptEditor) scriptEditor.value = String(promptText || '').trim();
            aiPromptsPanelOpen = false;
            refreshAiTopPanels(false);
            aiRefreshPanelModeUi();
            aiRefreshCurrentScriptTitle();
            return;
        }
        const input = document.getElementById('ai-user-input');
        if (!input) return;
        input.value = String(promptText || '').trim();
        aiAutoExpand(input);
        input.focus();
        // Close the example prompts panel after clicking an example
        aiPromptsPanelOpen = false;
        refreshAiTopPanels(false);
    }

    // This function toggles the color of the AI connect button based on whether there is text in the AI server URL input field. If the input field has a non-empty value, it adds a green color class to the button; otherwise, it removes that class.
    function aiToggleConnectColor(input) {
        const btn = document.getElementById('ai-connect-btn');
        if (btn) btn.classList.toggle('btn-green', input.value.trim().length > 0);
    }

    // This function checks the connection to the AI server by sending a GET request to the specified URL. It updates the UI to reflect whether the connection was successful or not, and sets the appropriate state variables for connection status and panel visibility.
    async function checkAiConnection() {
        const urlInput = document.getElementById('ai-server-url');
        const resolvedUrl = urlInput.value.trim() || urlInput.placeholder.trim();
        urlInput.value = resolvedUrl;
        try {
            const response = await fetch(resolvedUrl.replace(/\/$/, '') + '/v1/models', {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error(`AI server responded with ${response.status}`);
            const data = await response.json();
            if (!Array.isArray(data?.data)) throw new Error('AI server did not return a model list');
            const pill = document.getElementById('ai-status-pill');
            pill.textContent = "Connected";
            pill.className = "status-pill status-connected";
            aiConnected = true;
            aiSetupPanelOpen = false;
            refreshAiTopPanels(true);
            updateAiSendButton();
        } catch (error) {
            const pill = document.getElementById('ai-status-pill');
            pill.textContent = "Disconnected";
            pill.className = "status-pill status-disconnected";
            aiConnected = false;
            aiSetupPanelOpen = true;
            refreshAiTopPanels(true);
            updateAiSendButton();
        }
    }

    // This function starts a new AI chat session by clearing the chat history, resetting attached items, and clearing the user input field. It also automatically attaches the currently selected nodes as a file to the new chat session, providing context for the AI to work with.
    function aiNewChat() {
        if (aiPanelMode === 'python') {
            cancelAiProcessing(false);
            aiArchiveCurrentScript(true);
            aiActiveScriptId = null;
            aiPythonPromptHistory = [];
            const scriptEditor = document.getElementById('ai-python-script-editor');
            if (scriptEditor) scriptEditor.value = '';
            const runOut = document.getElementById('ai-python-run-output');
            if (runOut) runOut.textContent = '';
            const input = document.getElementById('ai-user-input');
            if (input) {
                input.value = '';
                input.style.height = 'auto';
                aiAutoExpand(input);
            }
            aiRenderChatHistory();
            aiRefreshCurrentScriptTitle();
            return;
        }
        cancelAiProcessing(false);
        aiArchiveCurrentChat(true);
        aiActiveChatId = null;
        aiChatHistory.length = 0;
        aiChatTranscript.length = 0;
        aiAttachedItems = [];
        document.getElementById('ai-preview-area').innerHTML = '';
        aiLastSentSelectedNodes = new Set();
        aiSelectedNodesAttachmentSuppressed = false;
        const input = document.getElementById('ai-user-input');
        if (input) {
            input.value = '';
            input.style.height = 'auto';
            aiAutoExpand(input);
        }
        // Attach selected_nodes.txt automatically on new chat
        try {
            aiSyncSelectedNodesAttachment();
            aiLastSentSelectedNodes = new Set(Array.from(getEffectiveSelectedNodesSet() || new Set()));
        } catch (e) { console.warn('Could not attach selected nodes on new chat', e); }
        aiSetChatboxEmptyState();
        aiRenderChatHistory();
    }

    // This function toggles the AI three dots menu dropdown menu in the chat panel
    function toggleAiMenu() {
        const dropdown = document.getElementById('ai-menu-dropdown');
        if (dropdown) {
            const isOpen = dropdown.classList.contains('open');
            dropdown.classList.toggle('open');
            
            // Add/remove document click listener for closing the menu
            if (!isOpen) {
                setTimeout(() => {
                    document.addEventListener('click', closeAiMenuOnClickOutside);
                }, 50);
            } else {
                document.removeEventListener('click', closeAiMenuOnClickOutside);
            }
        }
    }

    // This function closes the AI menu dropdown (three dots) if a click occurs outside of the menu or the button that toggles it.
    function closeAiMenuOnClickOutside(e) {
        const btn = document.getElementById('ai-menu-btn');
        const dropdown = document.getElementById('ai-menu-dropdown');
        if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
            document.removeEventListener('click', closeAiMenuOnClickOutside);
        }
    }

    // This function downloads the AI chat history as a text file. It formats the chat messages, including handling different content types (text and image URLs), and creates a downloadable file with a timestamped name. 
    function downloadAiChat() {
        if (aiPanelMode === 'python') {
            const scriptEditor = document.getElementById('ai-python-script-editor');
            const scriptText = scriptEditor ? String(scriptEditor.value || '') : '';
            const lines = [];
            lines.push('### Python Script');
            lines.push(scriptText || '(No script)');
            lines.push('');
            if (aiPythonPromptHistory.length > 0) {
                lines.push('### Script Request History');
                aiPythonPromptHistory.forEach(msg => {
                    const role = msg.role === 'assistant' ? 'AI' : 'User';
                    lines.push(`${role}: ${String(msg.content || '')}`);
                    lines.push('');
                });
            }
            const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `StringScape_Python_Script_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.txt`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return;
        }
        const lines = [];
        const pushBlock = (heading, bodyLines) => {
            lines.push(`### ${heading}:`);
            if (bodyLines && bodyLines.length > 0) {
                bodyLines.forEach(line => lines.push(line));
            } else {
                lines.push('');
            }
            lines.push('');
        };

        const formatContent = (content) => {
            if (Array.isArray(content)) {
                return content.map(part => {
                    if (part.type === 'text') return part.text || '';
                    if (part.type === 'image_url') return '[Image attachment]';
                    return '';
                }).filter(Boolean).join('\n');
            }
            return content ? String(content) : '';
        };

        const formatAttachment = (item) => {
            if (!item) return '';
            if (item.type === 'image') return `${item.name || 'Image'}\n[Image attachment]`;
            return `${item.name || 'Attached file'}\n${String(item.data || '')}`;
        };

        if (aiChatTranscript.length > 0) {
            aiChatTranscript.forEach(entry => {
                if (entry.kind === 'stringscape') {
                    pushBlock('StringScape', [formatContent(entry.content)]);
                } else if (entry.kind === 'attached_files') {
                    const body = [];
                    (entry.items || []).forEach((item, index) => {
                        body.push(`${index + 1}. ${formatAttachment(item)}`);
                    });
                    pushBlock('Attached files', body);
                } else if (entry.kind === 'user') {
                    pushBlock('User', [formatContent(entry.content)]);
                } else if (entry.kind === 'ai_thoughts') {
                    pushBlock('AI thoughts', [
                        `Thought for ${aiFormatSeconds(entry.seconds)} seconds`,
                        formatContent(entry.content)
                    ]);
                } else if (entry.kind === 'ai') {
                    pushBlock('AI', [formatContent(entry.content)]);
                } else if (entry.kind === 'tool_call') {
                    const body = [];
                    if (entry.name) body.push(`Name: ${entry.name}`);
                    if (entry.arguments) body.push(`Arguments: ${entry.arguments}`);
                    pushBlock('Tool call', body);
                } else if (entry.kind === 'tool') {
                    const body = [];
                    if (entry.name) body.push(`Name: ${entry.name}`);
                    const content = formatContent(entry.content);
                    if (content) body.push(content);
                    pushBlock('Tool response', body);
                }
            });
        } else {
            aiChatHistory.forEach(msg => {
                const label = msg.role === 'assistant' ? 'AI' : msg.role === 'user' ? 'User' : msg.role === 'tool' ? 'Tool' : msg.role;
                pushBlock(label, [formatContent(msg.content)]);
            });
        }

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `StringScape_AI_Chat_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // This function opens the AI attachment viewer modal with the specified item.
    function openAiAttachmentViewer(item) {
        currentFileViewer = {
            fileName: item.name,
            separator: item.type === 'image' ? null : detectDefaultSeparator(item.data || ''),
            isFasta: false,
            embeddedItem: item
        };
        document.getElementById('file-viewer-title').textContent = item.name || 'Embedded file';
        openModal('fileViewerModal');
        renderFileViewer();
    }

    // This function retrieves the currently selected nodes in the network and returns them as an array of node objects. It uses the effective selected nodes set to get the IDs of selected nodes, then maps those IDs to their corresponding node objects using the nodeMap. It filters out any undefined values in case some IDs do not have corresponding nodes.
    function aiGetSelectedNodesForTools() {
        return Array.from(getEffectiveSelectedNodesSet() || new Set()).map(id => nodeMap.get(id)).filter(Boolean);
    }

    // This function builds a string representation of the selected nodes based on a provided function that extracts a specific value from each node. It returns a formatted string where each line contains the node ID and the corresponding value obtained from the provided function.
    function aiBuildSelectedTable(getValueFn) {
        const selected = aiGetSelectedNodesForTools();
        if (!selected.length) return 'No nodes are currently selected.';
        return selected.map(node => {
            const val = getValueFn(node);
            return `${node.id}: ${val === undefined || val === null || val === '' ? 'Unknown' : String(val)}`;
        }).join('\n');
    }

    //AI tool execution functions
    // This function performs a search for nodes based on a query and selects the matching nodes in the network visualization. It takes a search query and an optional scope parameter that defines where to search (e.g., all, layer, centrality, annotation, localization, size, or a specific variable). It returns a message indicating how many nodes were selected based on the search.
    function aiSearchAndSelect(query, scope = 'all') {
        const rawInput = String(query || '').trim();
        if (!rawInput) return 'No search query provided.';

        const searchScopeEl = document.getElementById('searchScope');
        const allowedScopes = searchScopeEl ? Array.from(searchScopeEl.options).map(o => o.value) : [];
        const resolvedScope = allowedScopes.includes(scope) ? scope : 'all';
        if (searchScopeEl) searchScopeEl.value = resolvedScope;

        const queries = rawInput.split(/[\s,]+/).map(q => q.trim()).filter(Boolean);
        const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
        const matchedById = new Map();
        queries.forEach(q => {
            const lowerQ = q.toLowerCase();
            activeNodes.forEach(node => {
                const m = proteinMetadata.get(node.id) || {};
                if (matchesSearchQuery(node, m, lowerQ, resolvedScope)) matchedById.set(node.id, node);
            });
        });

        const matches = Array.from(matchedById.values());
        applySearchLogic(matches, rawInput);
        draw();
        return `Selected ${getEffectiveSelectedNodesSet().size} node(s) for query "${rawInput}" using scope "${resolvedScope}".`;
    }

    // This function saves the currently selected nodes to a collection with the specified name (or a default name). It updates the collection data structure with the selected node IDs and refreshes the view if necessary. It returns a message indicating how many nodes were saved to which collection.
    function aiSaveToCollection(collectionNameRaw = '') {
        const selectedIds = Array.from(getEffectiveSelectedNodesSet() || new Set());
        if (!selectedIds.length) return 'No nodes are selected, so nothing was saved.';

        let collectionName = String(collectionNameRaw || '').trim();
        if (!collectionName) {
            let idx = 1;
            while (collections.has(`AI Collection ${idx}`)) idx++;
            collectionName = `AI Collection ${idx}`;
        }

        if (!collections.has(collectionName)) {
            collections.set(collectionName, { nodeIds: new Set(), nodes: [], links: [] });
        }

        const target = collections.get(collectionName);
        selectedIds.forEach(id => target.nodeIds.add(id));
        // If user is colouring by collection, refresh the legend so new membership appears
        refreshLegendIfCollectionMode();
        updateViewMenu();
        draw();
        return `Saved ${selectedIds.length} selected node(s) to collection "${collectionName}".`;
    }

    // This function captures a screenshot of the current view and returns it as a data URL for the AI to view.
    async function aiCaptureScreenshot() {
        if (typeof html2canvas !== 'function') {
            return 'Screenshot capture is unavailable (html2canvas not loaded).';
        }
        const snap = await html2canvas(document.body, {
            useCORS: true,
            backgroundColor: '#1a1a1a',
            logging: false,
            scale: 1
        });

        const maxWidth = 1400;
        if (snap.width > maxWidth) {
            const ratio = maxWidth / snap.width;
            const scaled = document.createElement('canvas');
            scaled.width = Math.round(snap.width * ratio);
            scaled.height = Math.round(snap.height * ratio);
            const ctx = scaled.getContext('2d');
            ctx.drawImage(snap, 0, 0, scaled.width, scaled.height);
            return {
                type: 'image',
                name: 'window-screenshot.jpg',
                data: scaled.toDataURL('image/jpeg', 0.75)
            };
        }
        return {
            type: 'image',
            name: 'window-screenshot.jpg',
            data: snap.toDataURL('image/jpeg', 0.75)
        };
    }

    // This function creates an AI guide based on the provided content. The function returns a message indicating that the guide was created and is being opened.
    function aiCreateGuide(guideContent) {
        // Parse guide content in format:
        // Guide title: [title]
        // Page: [number]
        // Select_nodes: [node1,node2,...]
        // Circle_nodes: [color: node1, node2; color2: node3]
        // Set_view: [Selected Nodes|Full Network]
        // Text: [description]
        // Page: [next number]
        // ...
        
        const lines = guideContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let title = 'Untitled Guide';
        const pages = [];
        let currentPage = null;
        let collectingText = false;
        let currentText = '';
        
        for (const line of lines) {
            if (line.startsWith('Guide title:')) {
                title = line.replace('Guide title:', '').trim();
            } else if (line.startsWith('Page:')) {
                // Save previous page if exists
                if (currentPage) {
                    currentPage.text = currentText.trim();
                    pages.push(currentPage);
                }
                // Start new page
                const pageNum = parseInt(line.replace('Page:', '').trim());
                currentPage = {
                    pageNumber: pageNum,
                    selectNodes: [],
                    circleNodes: new Map(), // { nodeId: color }
                    setText: 'Full Network',
                    text: ''
                };
                collectingText = false;
                currentText = '';
            } else if (line.startsWith('Select_nodes:')) {
                if (currentPage) {
                    const nodesStr = line.replace('Select_nodes:', '').trim();
                    currentPage.selectNodes = nodesStr.split(',').map(n => n.trim()).filter(n => n.length > 0);
                }
            } else if (line.startsWith('Circle_nodes:')) {
                if (currentPage) {
                    const circleStr = line.replace('Circle_nodes:', '').trim();
                    // Parse format: "blue: node1, node2; red: node3"
                    const colorGroups = circleStr.split(';').map(g => g.trim());
                    for (const group of colorGroups) {
                        const [color, nodesStr] = group.split(':').map(p => p.trim());
                        if (color && nodesStr) {
                            const nodeIds = nodesStr.split(',').map(n => n.trim()).filter(n => n.length > 0);
                            for (const nodeId of nodeIds) {
                                currentPage.circleNodes.set(nodeId, color);
                            }
                        }
                    }
                }
            } else if (line.startsWith('Set_view:')) {
                if (currentPage) {
                    const view = line.replace('Set_view:', '').trim();
                    currentPage.setText = view === 'Selected Nodes' ? 'Selected Nodes' : 'Full Network';
                }
            } else if (line.startsWith('Text:')) {
                if (currentPage) {
                    currentText = line.replace('Text:', '').trim();
                    collectingText = true;
                }
            } else if (collectingText && currentPage) {
                currentText += '\n' + line;
            }
        }
        
        // Save final page
        if (currentPage) {
            currentPage.text = currentText.trim();
            pages.push(currentPage);
        }
        
        if (pages.length === 0) {
            return 'Failed to parse guide content. No pages created.';
        }
        
        // Store the guide
        currentGuide = { title, pages };
        currentGuidePage = 1;
        
        // Open protein info box in guide mode
        proteinInfoMode = 'guide';
        proteinInfoBoxOpen = true;
        refreshProteinInfoPanel();
        
        // Apply first page
        aiApplyGuidePage(1);
        
        return `Guide "${title}" created with ${pages.length} page(s). Opening guide now.`;
    }

    // This function applies the specified page of the current guide by selecting nodes, adding circle overlays, zooming to nodes, and setting the view according to the page's instructions.
    function aiApplyGuidePage(pageNum) {
        if (!currentGuide || !currentGuide.pages) return;
        
        const page = currentGuide.pages.find(p => p.pageNumber === pageNum);
        if (!page) return;
        
        currentGuidePage = pageNum;
        
        // Select nodes
        if (page.selectNodes && page.selectNodes.length > 0) {
            const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
            const nodesToSelect = page.selectNodes
                .map(id => activeNodes.find(n => n.id === id) || nodeMap.get(id) || nodes.find(n => n.id === id))
                .filter(Boolean);
            
            if (nodesToSelect.length > 0) {
                selectNodes(nodesToSelect, false, 'Guide Navigation', null, true);
            }
        }
        
        // Update circle overlays
        guideCircleOverlays.clear();
        for (const [nodeId, color] of page.circleNodes.entries()) {
            guideCircleOverlays.set(nodeId, { color });
        }
        
        // Zoom to selected nodes
        if (page.selectNodes && page.selectNodes.length > 0) {
            const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
            const nodesToZoom = page.selectNodes
                .map(id => activeNodes.find(n => n.id === id) || nodeMap.get(id) || nodes.find(n => n.id === id))
                .filter(Boolean);
            
            if (nodesToZoom.length > 0) {
                const fitTransform = fitNodesInView(nodesToZoom, 180);
                d3.select(canvas).transition().duration(800).call(zoomBehavior.transform, fitTransform);
            }
        }
        
        // Apply view setting
        if (page.setText === 'Selected Nodes' && currentViewId === 'base') {
            switchView('selected');
        } else if (page.setText === 'Full Network' && currentViewId !== 'base') {
            switchView('base');
        }
        
        refreshProteinInfoPanel();
        draw();
    }

    //This function executes AI tools - takes a tool name and arguments, performs the corresponding action, and returns the result
    async function aiExecuteToolCall(toolName, args) {
        if (toolName === 'get_current_time') return new Date().toLocaleTimeString();
        if (toolName === 'calculate_equation' || toolName === 'calculate_math') {
            const parser = new exprEval.Parser();

            try {
                const result = parser.evaluate(args.equation || args.eq);

                if (typeof result !== 'number' || !isFinite(result)) {
                    return 'Error: Invalid Result';
                }

                return result;

            } catch {
                return 'Error: Invalid Math';
            }
        }
        if (toolName === 'Search_and_select') return aiSearchAndSelect(args.query, args.scope || 'all');
        if (toolName === 'View_node_IDs') return aiBuildSelectedTable(node => node.id);
        if (toolName === 'View_preferred_name') return aiBuildSelectedTable(node => {
            return getPreferredProteinName(node.id) || 'Unknown';
        });
        if (toolName === 'View_annotation_data') {
            const source = resolveBuiltInColorSource('annotation', aiGetSelectedNodesForTools());
            return aiBuildSelectedTable(node => getBuiltInColorValueFromSource(node.id, 'annotation', source));
        }
        if (toolName === 'View_localisation_data') {
            const source = resolveBuiltInColorSource('localization', aiGetSelectedNodesForTools());
            return aiBuildSelectedTable(node => getBuiltInColorValueFromSource(node.id, 'localization', source));
        }
        if (toolName === 'View_description_data') {
            return aiBuildSelectedTable(node => {
                return getProteinInfoDescription(node.id) || 'Unknown';
            });
        }
        if (toolName === 'View_protein_size') {
            const source = resolveProteinSizeSource(aiGetSelectedNodesForTools());
            return aiBuildSelectedTable(node => getProteinSizeValue(node.id, source));
        }
        if (toolName === 'View_sequence_data') {
            return aiBuildSelectedTable(node => (proteinMetadata.get(node.id) || {}).sequence || 'Unknown');
        }
        if (toolName === 'View_centrality_data') return aiBuildSelectedTable(node => Number.isFinite(node.centrality) ? node.centrality : 'Unknown');
        if (toolName === 'View_eigenvector_data') return aiBuildSelectedTable(node => Number.isFinite(node.eigen) ? node.eigen : 'Unknown');
        if (toolName === 'Save_to_collection') return aiSaveToCollection(args.collection_name || args.collection || args.name || '');
        if (toolName === 'View_screenshot') return await aiCaptureScreenshot();
        if (toolName === 'create_guide') return aiCreateGuide(args.guide_content || '');
        if (toolName === 'Deselect_nodes') {
            try {
                selectedNodes.clear();
                selectedWedges.clear();
                aiLastSentSelectedNodes = new Set();
                draw();
                return 'Deselected all nodes.';
            } catch (e) { return 'Error deselecting nodes: ' + e.message; }
        }
        if (toolName === 'Expand_to_connected') {
            try {
                const originalSelection = new Set(getEffectiveSelectedNodesSet());
                if (originalSelection.size === 0) return 'No nodes currently selected to expand.';
                const expanded = modifySelection(1);
                selectedNodes = expanded;
                aiLastSentSelectedNodes = new Set(expanded);
                draw();
                return `Expanded selection from ${originalSelection.size} to ${expanded.size} nodes.`;
            } catch (e) { return 'Error expanding selection: ' + e.message; }
        }
        if (toolName === 'View_variables') {
            try {
                const entries = getVisibleColorModeVariableEntries();
                if (!entries || !entries.length) return 'No variables available.';
                const lines = entries.map(e => {
                    if (e.min !== null && e.max !== null) return `${e.label} (numeric, range: ${e.min} to ${e.max})`;
                    if (e.categories !== null) return `${e.label} (categorical, ${e.categories} categories)`;
                    return `${e.label}`;
                }).join('\n');
                return `Available variables:\n${lines}`;
            } catch (e) { return 'Error viewing variables: ' + e.message; }
        }
        if (toolName === 'Change_node_colouring') {
            try {
                const varNameRaw = String(args.variable_name || '').trim();
                if (!varNameRaw) return 'No variable name provided. Use View_variables to see available options.';

                const normalize = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
                const normalizeLoose = (v) => normalize(v).replace(/[^a-z0-9]/g, '');
                const varNameNorm = normalize(varNameRaw);
                const varNameLoose = normalizeLoose(varNameRaw);

                const entries = getVisibleColorModeVariableEntries();
                const aliases = {
                    layer: 'layer',
                    degreeofseparation: 'layer',
                    degreesofseparation: 'layer',
                    centrality: 'centrality',
                    eigen: 'eigen',
                    eigenvector: 'eigen',
                    embeddings: 'embeddings',
                    collection: 'collection',
                    annotation: 'annotation',
                    annotationlength: 'annotation',
                    localization: 'localization',
                    localisation: 'localization',
                    proteinlocalization: 'localization',
                    proteinlocalisation: 'localization',
                    size: 'size',
                    proteinsize: 'size',
                    random: 'random',
                    mono: 'mono'
                };

                let matchedEntry = entries.find(e =>
                    normalize(e.label) === varNameNorm ||
                    normalize(e.key) === varNameNorm ||
                    normalize(e.variable) === varNameNorm ||
                    normalizeLoose(e.label) === varNameLoose ||
                    normalizeLoose(e.key) === varNameLoose ||
                    normalizeLoose(e.variable) === varNameLoose
                );

                if (!matchedEntry && aliases[varNameLoose]) {
                    matchedEntry = entries.find(e => e.key === aliases[varNameLoose]);
                }

                if (!matchedEntry) return `Variable "${varNameRaw}" not found. Use View_variables to see available options.`;

                const colorModeSelect = document.getElementById('colorMode');
                if (!colorModeSelect) return 'Colour mode control is not available.';

                if (!Array.from(colorModeSelect.options).some(o => o.value === matchedEntry.key)) {
                    updateColorModeOptions();
                }
                if (!Array.from(colorModeSelect.options).some(o => o.value === matchedEntry.key)) {
                    return `Variable "${varNameRaw}" is currently unavailable.`;
                }

                colorModeSelect.value = matchedEntry.key;
                handleColorModeChange(matchedEntry.key);
                return `Changed node colouring to "${matchedEntry.label}".`;
            } catch (e) { return 'Error changing colouring: ' + e.message; }
        }
        if (toolName === 'View_last_console_logs') {
            const count = parseInt(args.count) || 20;
            const logs = aiLogHistory.slice(-count);
            return logs.length ? logs.map(l => `[${l.timestamp}] [${l.type}] ${l.message}`).join('\n') : "No logs found.";
        }

        if (toolName === 'View_error_logs') {
            const errors = aiLogHistory.filter(l => l.type === 'ERROR' || l.type === 'DEBUG');
            return errors.length ? errors.map(l => `[${l.timestamp}] [${l.type}] ${l.message}`).join('\n') : "No error or debug logs found.";
        }
        if (toolName === 'See_view_options') {
            const coreViews = ["Full Network (ID: base)", "Selected Nodes (ID: selected)", "Scatter Plot", "Venn Diagram", "Histogram", "Pie Chart", "Mind Map", "Embeddings"];
            const collectionViews = Array.from(collections.keys()).map(name => `${name} (ID: coll_${name})`);
            return `CORE VIEWS:\n${coreViews.join('\n')}\n\nCOLLECTIONS:\n${collectionViews.length ? collectionViews.join('\n') : "None"}`;
        }

        if (toolName === 'Change_view') {
            const target = String(args.view_name || '').trim();
            // Normalize mapping for AI common names to IDs
            const viewMap = {
                'full network': 'base',
                'selected nodes': 'selected',
                'scatter plot': 'Scatter Plot',
                'venn diagram': 'Venn Diagram',
                'histogram': 'histogram',
                'pie chart': 'pie_chart',
                'mind map': 'Mind Map',
                'embeddings': 'Embeddings'
            };

            let targetId = viewMap[target.toLowerCase()] || target;

            // Check if it's a collection name without the prefix
            if (!viewMap[target.toLowerCase()] && collections.has(target)) {
                targetId = `coll_${target}`;
            }

            try {
                switchView(targetId);
                return `Successfully switched view to: ${target}`;
            } catch (e) {
                return `Error switching view: ${e.message}. Ensure you use the exact Name or ID.`;
            }
        }
        if (toolName === 'Search_codebase') {
            const query = args.query.toLowerCase(); // Simple case-insensitive search
            const context = Math.max(1, parseInt(args.context_lines) || 1);
            const results = [];

            const content = await getMainScriptSource();
            const lines = (content || "").split('\n');

            lines.forEach((line, index) => {
                if (line.toLowerCase().includes(query)) {
                    const trueLineStart = index + 1 + GLOBAL_SCRIPT_OFFSET;
                    
                    // Grab the match plus requested context lines
                    // Example: context 2 grabs index and index + 1
                    const snippet = lines.slice(index, index + context).join('\n');
                    
                    results.push(`--- Match at Line ${trueLineStart} ---\n${snippet}`);
                }
            });

            // Limit the number of results to avoid context overflow if many matches exist. This set the limit to 100 results, but can be adjusted as needed.
            const finalOutput = results.slice(0, 100).join('\n\n');
            const suggestion = "\n\nSuggestion: use View_code_snippet to view the code around relevant search results";
            return results.length ? (finalOutput + suggestion) : "No matches found.";

        }
        if (toolName === 'View_code_snippet') {
            const content = await getMainScriptSource();
            const lines = content.split('\n');

            // 1. Handle Function Name Search
            if (args.function_name) {
                // Updated regex to handle potential leading whitespace in indentation
                const regex = new RegExp(`^\\s*(async\\s+)?function\\s+${args.function_name}\\s*\\([^{]*\\)\\s*\\{[\\s\\S]*?\\}`, 'gm');
                const match = content.match(regex);
                
                if (match) {
                    // Find the local line index where the function starts
                    const localIndex = lines.findIndex(l => l.includes(`function ${args.function_name}`));
                    const trueLine = localIndex !== -1 ? localIndex + 1 + GLOBAL_SCRIPT_OFFSET : "Unknown";
                    
                    let finalOutput = match[0];

                    // Look back up to 2 lines for the summary comment
                    if (localIndex !== -1) {
                        for (let i = 1; i <= 2; i++) {
                            const prevLine = lines[localIndex - i]?.trim();
                            if (prevLine && prevLine.startsWith("// ")) {
                                finalOutput = `${lines[localIndex - i]}\n${finalOutput}`;
                                break; 
                            }
                        }
                    }

                    return `--- Function: ${args.function_name} (starts around True Line ${trueLine}) ---\n${finalOutput}`;
                }
                return `Function "${args.function_name}" not found in script.js.`;
            }

            // 2. Handle Line Ranges
            if (args.start_line !== undefined && args.end_line !== undefined) {
                const localStart = args.start_line - GLOBAL_SCRIPT_OFFSET - 1;
                const localEnd = args.end_line - GLOBAL_SCRIPT_OFFSET;

                const snippet = lines.slice(Math.max(0, localStart), localEnd).join('\n');
                return `--- Showing True Lines ${args.start_line} to ${args.end_line} ---\n${snippet}`;
            }

            return "Please provide a function_name or a line range (start_line and end_line).";
        }
        if (toolName === 'View_all_functions') {
            const content = await getMainScriptSource();
            const lines = content.split('\n');
            
            // This allows for optional indentation (spaces or tabs) before 'function'
            const functionRegex = /^\s*function\s+([a-zA-Z0-9_$]+)\s*\(/gm;
            
            // matchAll creates an array of all matches instantly
            const allMatches = [...content.matchAll(functionRegex)];
            const results = [];

            allMatches.forEach(match => {
                const funcName = match[1];
                
                // Calculate the line number by looking at the content up to the match
                const charIndex = match.index;
                const localLineIndex = content.substring(0, charIndex).split('\n').length - 1;
                const trueLine = localLineIndex + 1 + GLOBAL_SCRIPT_OFFSET;

                // Summary Extraction
                let summary = "No summary provided.";
                for (let i = 1; i <= 2; i++) {
                    const prevLine = lines[localLineIndex - i]?.trim();
                    if (prevLine && prevLine.startsWith("// ")) {
                        summary = prevLine.replace("//", "").trim();
                        break; 
                    }
                }

                results.push(`${funcName} (Line ${trueLine}): ${summary}`);
            });

            const summaryReport = `TOTAL_FUNCTION_COUNT: ${results.length}\n` + 
                     `NOTE: Showing first 1000 functions due to context limits.\n\n` + 
                     results.slice(0, 1000).join('\n'); // Limit to first 100 functions

            const suggestion = "\n\nSuggestion: use View_code_snippet with a function name to view the code for a function of interest. Important: you MUST NOT use the View_all_functions tool in this chat (you don't need to because you can see all the output above)";
            return results.length ? (summaryReport + suggestion) : "No functions found.";

            return `### ${results.length} Total Functions Found in the App:\n` + results.join('\n');
        }

        // Global variable to keep the Python environment alive between calls
        let pyodideInstance = null;

        if (toolName === 'Run_python_logic') {
            try {
                if (!pyodideInstance) {
                    pyodideInstance = await loadPyodide();
                    await pyodideInstance.loadPackage(['numpy', 'pandas']);
                }

                pyodideInstance.runPython(`
def get_var(name, default=None):
    vars_dict = app_data.get("python_variables", {}) if isinstance(app_data, dict) else {}
    return vars_dict.get(name, default if default is not None else [])

def clean_numeric(values):
    cleaned = []
    for value in values or []:
        if value is None:
            continue
        text = str(value).strip()
        if not text:
            continue
        try:
            cleaned.append(float(value))
        except Exception:
            continue
    return cleaned
                `);

                // Setup stdout capture
                pyodideInstance.runPython(`import sys, io; sys.stdout = io.StringIO()`);

                // Create a data dictionary for Python
                const colourModeEntries = typeof getVisibleColorModeVariableEntries === 'function' ? getVisibleColorModeVariableEntries() : [];
                const safeNodes = Array.isArray(window.nodes) && window.nodes.length
                    ? window.nodes
                    : (typeof nodeMap !== 'undefined' && nodeMap instanceof Map ? Array.from(nodeMap.values()) : []);
                const safeNodeIds = safeNodes.map(n => n.id);

                const toCleanValueArray = (values) => (Array.isArray(values) ? values : [])
                    .map(v => (v === undefined || v === null) ? null : v)
                    .filter(v => v !== null && String(v).trim() !== '');

                const collectVisibleVariableValues = () => {
                    const out = {};
                    const entries = Array.isArray(colourModeEntries) ? colourModeEntries : [];
                    entries.forEach(entry => {
                        const key = String(entry?.key || entry?.variable || entry?.label || '').trim();
                        if (!key) return;

                        let values = [];
                        if (key === 'layer') {
                            values = safeNodes.map(n => n?.layer);
                        } else if (key === 'centrality') {
                            values = safeNodes.map(n => Number.isFinite(n?.centrality) ? n.centrality : null);
                        } else if (key === 'eigen') {
                            values = safeNodes.map(n => Number.isFinite(n?.eigen) ? n.eigen : null);
                        } else if (key === 'pdb_structure_count') {
                            values = safeNodes.map(n => getPdbStructureCount(n?.id));
                        } else if (key === 'annotation') {
                            const source = resolveBuiltInColorSource('annotation', safeNodes);
                            values = safeNodes.map(n => getAnnotationLengthFromSource(n?.id, source));
                        } else if (key === 'localization') {
                            const source = resolveBuiltInColorSource('localization', safeNodes);
                            values = safeNodes.map(n => getBuiltInColorValueFromSource(n?.id, 'localization', source));
                        } else if (key === 'size') {
                            const source = resolveProteinSizeSource(safeNodes);
                            values = safeNodes.map(n => getProteinSizeValue(n?.id, source));
                        } else if (key === 'random') {
                            values = safeNodes.map(() => Math.random());
                        } else if (key === 'mono') {
                            values = safeNodes.map(() => 1);
                        } else if (String(key).startsWith('var::')) {
                            const parts = String(key).split('::');
                            const fileName = parts[1];
                            const variableName = parts[2];
                            const childVariable = parts[4] || null;
                            const valueMap = window.accessoryVariableValues?.[fileName]?.[variableName];
                            if (valueMap instanceof Map) {
                                values = safeNodes.map(n => {
                                    const raw = valueMap.get(n?.id);
                                    if (childVariable && raw && typeof raw === 'object') {
                                        return raw?.[childVariable] ?? null;
                                    }
                                    return raw;
                                });
                            }
                        } else {
                            const matchingCfg = typeof variableConfigMap !== 'undefined'
                                ? Array.from(variableConfigMap.values()).find(cfg => getVariableModeKey(cfg) === key)
                                : null;
                            const valueMap = matchingCfg ? window.accessoryVariableValues?.[matchingCfg.fileName]?.[matchingCfg.variable] : null;
                            if (valueMap instanceof Map) {
                                values = safeNodes.map(n => valueMap.get(n?.id));
                            }
                        }

                        out[key] = toCleanValueArray(values);
                    });
                    return out;
                };

                const colourVariableValues = collectVisibleVariableValues();

                const pythonVariables = {
                    ...colourVariableValues,
                    nodes: safeNodes,
                    node_ids: safeNodeIds,
                    links: window.links || [],
                    current_colour_mode: document.getElementById('colorMode') ? document.getElementById('colorMode').value : null,
                    colour_nodes_by_variables: Array.isArray(colourModeEntries) ? colourModeEntries.map(entry => ({ ...entry })) : []
                };

                const researchContext = {
                    "nodes": safeNodes,
                    "node_ids": safeNodeIds,
                    "links": window.links || [],
                    "accessory_files": window.accessoryDataFiles || {},
                    "accessory_values": window.accessoryVariableValues || {},
                    "colour_nodes_by_variables": Array.isArray(colourModeEntries)
                        ? colourModeEntries.map(entry => ({ ...entry }))
                        : [],
                    "current_colour_mode": document.getElementById('colorMode') ? document.getElementById('colorMode').value : null,
                    "colour_variable_values": colourVariableValues,
                    "python_variables": pythonVariables,
                    "variable_list": Array.from(new Set([].concat(
                        Array.isArray(colourModeEntries) ? colourModeEntries.map(e => e.key || e.variable || e.label) : [],
                        Object.keys(colourVariableValues || {})
                    )))
                };

                // Convert the whole suite to Python-friendly formats
                const pyContext = pyodideInstance.toPy(researchContext);
                
                // --- CHANGE THIS SECTION ---
                // Directly set 'app_data' in the globals
                pyodideInstance.globals.set("app_data", pyContext);
                // ----------------------------

                await pyodideInstance.runPythonAsync(args.code);
                const stdout = pyodideInstance.runPython("sys.stdout.getvalue()").trim();

                // Only add hello if there is actually something in stdout
                return stdout ? stdout + `\nIf you don't get the output you were looking for, try this: app_data["python_variables"].get("<variable_name>", []) or get_var("<variable_name>"). For numeric stats, clean values first: clean = clean_numeric(vals); print(sum(clean) / len(clean)) if clean else print("No numeric values found.")` : "Calculation complete.";
            } catch (error) {
                return `Python Error: ${error.message}\n\nTry again with app_data["python_variables"].get("<variable_name>", []) or get_var("<variable_name>") instead of iterating app_data["nodes"]. For numeric stats, clean values first: clean = clean_numeric(vals); print(sum(clean) / len(clean)) if clean else print("No numeric values found.")`;
            }
        }

        return `Unsupported tool: ${toolName}`;
    }

    // Functions for managing AI chat interface and interactions
    const aiChunkText = (str, size) => {
        const chunks = [];
        for (let i = 0; i < str.length; i += size) chunks.push(str.substring(i, i + size));
        return chunks;
    };

    function aiCloneContentPart(part) {
        if (!part || typeof part !== 'object') return part;
        const clone = { ...part };
        if (part.image_url && typeof part.image_url === 'object') {
            clone.image_url = { ...part.image_url };
        }
        return clone;
    }

    function aiCloneContent(content) {
        if (Array.isArray(content)) return content.map(part => aiCloneContentPart(part));
        return content;
    }

    function aiCloneAttachment(item) {
        if (!item) return item;
        const clone = { ...item };
        if (Array.isArray(item.data)) {
            clone.data = item.data.map(part => aiCloneContentPart(part));
        }
        return clone;
    }

    function aiFormatSeconds(seconds) {
        const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
        const rounded = Math.round(safeSeconds * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    function aiCreateBubbleElement(content, role, items = []) {
        const div = document.createElement('div');
        div.className = `${role === 'user' ? 'ai-user-bubble' : 'ai-agent-bubble'} ai-bubble`;

        if (items && items.length > 0) {
            const attachmentContainer = document.createElement('div');
            attachmentContainer.style.marginBottom = '8px';
            attachmentContainer.style.display = 'flex';
            attachmentContainer.style.flexWrap = 'wrap';
            attachmentContainer.style.gap = '6px';

            items.forEach(item => {
                if (item.type === 'image') {
                    const img = document.createElement('img');
                    img.src = item.data;
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '8px';
                    img.style.marginBottom = '8px';
                    img.style.maxHeight = '250px';
                    img.style.display = 'block';
                    img.style.cursor = 'pointer';
                    img.title = 'Open image in file viewer';
                    img.onclick = () => openAiAttachmentViewer(item);
                    attachmentContainer.appendChild(img);
                } else {
                    const tag = document.createElement('button');
                    tag.type = 'button';
                    tag.className = 'ai-file-attachment-tag';
                    tag.textContent = `📄 ${item.name}`;
                    tag.style.display = 'inline-flex';
                    tag.style.alignItems = 'center';
                    tag.style.background = 'rgba(52, 152, 219, 0.2)';
                    tag.style.border = '1px solid #3498db';
                    tag.style.borderRadius = '10px';
                    tag.style.padding = '4px 8px';
                    tag.style.color = '#022824';
                    tag.style.fontWeight = '500';
                    tag.style.lineHeight = '1.2';
                    tag.style.cursor = 'pointer';
                    tag.onclick = () => openAiAttachmentViewer(item);
                    attachmentContainer.appendChild(tag);
                }
            });
            div.appendChild(attachmentContainer);
        }

        const textDiv = document.createElement('div');
        textDiv.className = 'ai-bubble-text';
        applyMarkdownLatexContent(textDiv, content);
        div.appendChild(textDiv);
        return div;
    }

    function aiRecordTranscript(entry) {
        aiChatTranscript.push(entry);
    }

    // This function appends a message to the AI chatbox with the specified content, role (user or agent), and optional attached items (like images or files). It creates a new chat bubble element, formats the content with markdown and LaTeX support, and handles the display of attachments. After appending the message, it scrolls the chatbox to the bottom to show the latest message.
    function aiAppendMessage(content, role, items = []) {
        const chatbox = document.getElementById('ai-chatbox');
        const div = aiCreateBubbleElement(content, role, items);
        chatbox.appendChild(div);
        document.getElementById('ai-chat-scroll').scrollTop = document.getElementById('ai-chat-scroll').scrollHeight;
        return div;
    }

    function aiUpdateBubbleMessage(bubble, content) {
        if (!bubble) return;
        const textDiv = bubble.querySelector('.ai-bubble-text');
        if (!textDiv) return;
        applyMarkdownLatexContent(textDiv, content || '');
        document.getElementById('ai-chat-scroll').scrollTop = document.getElementById('ai-chat-scroll').scrollHeight;
    }

    //This function adds a bullet-point log message to the AI chatbox (with optional pulsing animation), so the user can get updates on what tool calls the AI is using.
    function aiAddLog(text, pulse = false) {
        const logGroup = document.getElementById('ai-chatbox');
        const el = document.createElement('div');
        el.className = `log-item ${pulse ? 'animate-pulse' : ''}`;
        el.textContent = text;
        logGroup.appendChild(el);
        return el;
    }

    function aiAddThoughtLog(seconds, reasoningContent) {
        const logGroup = document.getElementById('ai-chatbox');
        const wrapper = document.createElement('div');
        const el = document.createElement('div');
        const secondsText = aiFormatSeconds(seconds);
        el.className = 'log-item ai-thought-log';
        el.textContent = `Thought for ${secondsText} seconds >`;
        el.title = 'Click to show the AI thoughts';

        const bubble = document.createElement('div');
        bubble.className = 'ai-thought-bubble';
        bubble.style.display = 'none';

        el.addEventListener('click', () => {
            if (bubble.style.display === 'none') {
                bubble.style.display = 'block';
                bubble.innerHTML = '';
                bubble.appendChild(aiCreateBubbleElement(reasoningContent || '', 'ai'));
            } else {
                bubble.style.display = 'none';
            }
            document.getElementById('ai-chat-scroll').scrollTop = document.getElementById('ai-chat-scroll').scrollHeight;
        });

        wrapper.appendChild(el);
        wrapper.appendChild(bubble);
        logGroup.appendChild(wrapper);
        return el;
    }

    // This function removes an attached item from the users current message.
    function aiRemoveItem(id) {
        const removedItem = aiAttachedItems.find(item => item.id === id);
        aiAttachedItems = aiAttachedItems.filter(item => item.id !== id);
        const element = document.getElementById(`ai-prev-${id}`);
        if (element) element.remove();
        if (removedItem?.type === 'file' && removedItem?.name === 'Selected_nodes.txt') {
            aiSelectedNodesAttachmentSuppressed = true;
        }
    }

    function aiSyncSelectedNodesAttachment() {
        if (aiSelectedNodesAttachmentSuppressed) return;
        const currentSelectedArr = Array.from(getEffectiveSelectedNodesSet() || new Set());
        if (!currentSelectedArr.length) return;
        if (aiAttachedItems.some(item => item?.type === 'file' && item?.name === 'Selected_nodes.txt')) return;

        const selectedObjs = aiGetSelectedNodesForTools();
        const preferredList = selectedObjs.map(n => getPreferredProteinName(n?.id)).filter(Boolean);
        const hasPreferred = preferredList.some(name => name && !/^\d+\./.test(String(name)));
        const list = selectedObjs.map(n => hasPreferred ? getPreferredProteinName(n?.id) : n.id).join(', ');
        const content = hasPreferred
            ? `These are the currently selected nodes (their preferred names): [${list}].`
            : `These are the currently selected nodes (their STRING IDs): [${list}].`;
        const attachmentId = 'selnodes-' + Date.now();
        aiAttachedItems.push({ id: attachmentId, type: 'file', name: 'Selected_nodes.txt', data: content });
        document.getElementById('ai-preview-area').appendChild(aiCreateAttachmentPreviewChip('Selected_nodes.txt', attachmentId));
    }
    // Build attachment preview chips with textContent so file names and generated labels cannot inject HTML into the AI panel.
    function aiCreateAttachmentPreviewChip(label, attachmentId) {
        const chip = document.createElement('div');
        chip.id = `ai-prev-${attachmentId}`;
        chip.style.display = 'inline-flex';
        chip.style.alignItems = 'center';
        chip.style.gap = '8px';
        chip.style.background = 'rgba(52, 152, 219, 0.2)';
        chip.style.border = '1px solid #3498db';
        chip.style.borderRadius = '9999px';
        chip.style.padding = '4px 10px';
        chip.style.fontSize = '0.75rem';
        chip.style.color = '#022824';
        chip.style.fontWeight = '500';
        chip.style.lineHeight = '1';
        chip.style.maxWidth = '100%';

        const labelSpan = document.createElement('span');
        labelSpan.textContent = String(label ?? 'Attachment');
        chip.appendChild(labelSpan);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '𐌗';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontWeight = '700';
        removeBtn.style.color = '#022824';
        removeBtn.style.lineHeight = '1';
        removeBtn.style.border = 'none';
        removeBtn.style.background = 'transparent';
        removeBtn.style.padding = '0';
        removeBtn.addEventListener('click', () => aiRemoveItem(attachmentId));
        removeBtn.addEventListener('mouseover', () => { removeBtn.style.color = '#ff9999'; });
        removeBtn.addEventListener('mouseout', () => { removeBtn.style.color = '#022824'; });
        chip.appendChild(removeBtn);

        return chip;
    }

    // This function handles file input from the user, reads the file content, and prepares it for attachment to the AI message. It supports both image files (which are read as data URLs) and other file types (which are read as text).
    function aiHandleFile(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        const isImg = file.type.startsWith('image/');
        reader.onload = (e) => {
            const attachmentId = Date.now() + Math.random();
            aiAttachedItems.push({
                id: attachmentId,
                type: isImg ? 'image' : 'file',
                name: file.name,
                data: e.target.result
            });

            // File names are untrusted input, so the preview chip is built with textContent instead of HTML.
            document.getElementById('ai-preview-area').appendChild(aiCreateAttachmentPreviewChip(file.name, attachmentId));
        };
        isImg ? reader.readAsDataURL(file) : reader.readAsText(file);
    }

    function aiStripCodeFence(text) {
        const raw = String(text || '').trim();
        const fenced = raw.match(/^```(?:python)?\s*([\s\S]*?)\s*```$/i);
        return fenced ? fenced[1].trim() : raw;
    }

    function aiParseScriptToolCalls(scriptText) {
        const toolCalls = [];
        const pythonLines = [];
        const lines = String(scriptText || '').split('\n');
        const parseLine = (line) => {
            const trimmed = line.trim();
            const match = trimmed.match(/^tool_call\(\s*['\"]([^'\"]+)['\"]\s*,\s*(\{[\s\S]*\})\s*\)\s*$/);
            if (!match) return false;
            const toolName = String(match[1] || '').trim();
            if (!toolName) return false;
            let args = {};
            try {
                args = JSON.parse(match[2]);
            } catch (error) {
                throw new Error(`Invalid JSON args in tool_call: ${line}`);
            }
            toolCalls.push({ toolName, args });
            return true;
        };

        lines.forEach(line => {
            if (!parseLine(line)) pythonLines.push(line);
        });

        return {
            toolCalls,
            pythonCode: pythonLines.join('\n').trim()
        };
    }

    async function runPythonConsoleScript() {
        const editor = document.getElementById('ai-python-script-editor');
        const output = document.getElementById('ai-python-run-output');
        if (!editor) return;
        const scriptText = String(editor.value || '').trim();
        if (!scriptText) {
            if (output) output.textContent = 'No script to run.';
            return;
        }
        try {
            if (output) output.textContent = 'Running script...';
            const parsed = aiParseScriptToolCalls(scriptText);
            const responses = [];
            for (const call of parsed.toolCalls) {
                const res = await aiExecuteToolCall(call.toolName, call.args || {});
                responses.push(`tool_call(${call.toolName}): ${typeof res === 'string' ? res : JSON.stringify(res)}`);
            }

            let pythonResult = '';
            if (parsed.pythonCode) {
                pythonResult = await aiExecuteToolCall('Run_python_logic', { code: parsed.pythonCode });
            }

            const blocks = [];
            if (responses.length > 0) blocks.push(responses.join('\n'));
            if (String(pythonResult || '').trim()) blocks.push(String(pythonResult));
            const finalResult = blocks.length ? blocks.join('\n\n') : 'Script completed.';
            if (output) output.textContent = finalResult;

            if (/Python Error:\s*Traceback/i.test(finalResult)) {
                const input = document.getElementById('ai-user-input');
                if (input) {
                    input.value = `${finalResult}\nThe script returns this error. Edit the script to fix.`;
                    aiAutoExpand(input);
                }
            }

            aiArchiveCurrentScript(false);
            aiRenderChatHistory();
        } catch (error) {
            const errorText = `Python Error: ${error?.message || error}`;
            if (output) output.textContent = errorText;
            const input = document.getElementById('ai-user-input');
            if (input) {
                input.value = `${errorText}\nThe script returns this error. Edit the script to fix.`;
                aiAutoExpand(input);
            }
        }
    }

    async function sendPythonScriptAssistMessage() {
        const input = document.getElementById('ai-user-input');
        const text = String(input?.value || '').trim();
        let url = document.getElementById('ai-server-url').value.trim() || document.getElementById('ai-server-url').placeholder.trim();
        const output = document.getElementById('ai-python-run-output');
        if (!text || !url) return;

        if (input) {
            input.value = '';
            input.style.height = 'auto';
            aiAutoExpand(input);
        }

        aiIsProcessing = true;
        aiProcessingAbortController = new AbortController();
        updateAiSendButton();
        if (output) output.textContent = 'Generating script...';

        try {
            aiPythonPromptHistory.push({ role: 'user', content: text });
            const endpoint = url.replace(/\/$/, '') + '/v1/chat/completions';
            const response = await fetch(endpoint, {
                method: 'POST',
                signal: aiProcessingAbortController.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: AI_PYTHON_CONSOLE_SYSTEM_PROMPT },
                        { role: 'system', content: AI_PYTHON_SCRIPT_INSTRUCTIONS_TEXT },
                        ...aiPythonPromptHistory
                    ],
                    temperature: 0.2
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const content = aiStripCodeFence(data?.choices?.[0]?.message?.content || '');
            aiPythonPromptHistory.push({ role: 'assistant', content });

            const editor = document.getElementById('ai-python-script-editor');
            if (editor && content) editor.value = content;
            if (output) output.textContent = content ? 'Script generated and pasted into editor.' : 'No script text was returned.';
            if (input) {
                input.value = '';
                input.style.height = 'auto';
                aiAutoExpand(input);
            }

            aiArchiveCurrentScript(false);
            aiRenderChatHistory();
        } catch (error) {
            if (output) output.textContent = `Error generating script: ${error?.message || error}`;
        } finally {
            aiIsProcessing = false;
            aiProcessingAbortController = null;
            updateAiSendButton();
        }
    }

    // This function is called when the user clicks the "Send" button in the AI chat interface. It checks if the AI is currently processing a message, and if so, it cancels the processing. Otherwise, it gathers the user's input text and any attached items, prepares a message for sending to the AI, and handles special cases like auto-attaching selected nodes or guide instructions based on the user's message content.
    async function sendAiMessage() {
        if (aiPanelMode === 'python') {
            if (aiIsProcessing) {
                cancelAiProcessing(true);
                return;
            }
            await sendPythonScriptAssistMessage();
            return;
        }
        if (aiIsProcessing) {
            cancelAiProcessing(true);
            return;
        }
        document.getElementById('ai-glow-container').style.display = 'block';
        const text = document.getElementById('ai-user-input').value.trim();
        let url = document.getElementById('ai-server-url').value.trim() || document.getElementById('ai-server-url').placeholder.trim();
        if (!text || !url) return;

        // Refresh the auto-generated Selected_nodes.txt only if it is still attached.
        try {
            const autoSelectedNodeItemIds = aiAttachedItems
                .filter(item => item?.type === 'file' && item?.name === 'Selected_nodes.txt' && String(item?.id || '').startsWith('selnodes-'))
                .map(item => item.id);
            const currentSelectedArr = Array.from(getEffectiveSelectedNodesSet() || new Set());
            aiLastSentSelectedNodes = new Set(currentSelectedArr);
            if (autoSelectedNodeItemIds.length && !aiSelectedNodesAttachmentSuppressed) {
                const selectedObjs = aiGetSelectedNodesForTools();
                const preferredList = selectedObjs.map(n => getPreferredProteinName(n?.id)).filter(Boolean);
                const hasPreferred = preferredList.some(name => name && !/^\d+\./.test(String(name)));
                const list = selectedObjs.map(n => hasPreferred ? getPreferredProteinName(n?.id) : n.id).join(', ');
                const content = hasPreferred
                    ? `These are the currently selected nodes (their preferred names): [${list}].`
                    : `These are the currently selected nodes (their STRING IDs): [${list}].`;
                autoSelectedNodeItemIds.forEach(id => {
                    const attachment = aiAttachedItems.find(item => item?.id === id);
                    if (attachment) attachment.data = content;
                });
            }
        } catch (e) { console.warn('Could not attach selected nodes file', e); }

        // If the user's message contains the word "guide", attach How_to_create_guides.txt
        try {
            if (/\bguide\b/i.test(text)) {
                const guideText = `Here are instructions on how to create guides in StringScape.\nFirst, use tools like Search_and_select, View_annotation_data, View_description_data and View_localisation_data to find out relevant information about the proteins. If nodes are currently selected, create the guide on those proteins, unless the user specifies otherwise.\n\nThen, use the create_guide tool to create the guide. The guide should be a few pages long, unless the user specifies otherwise. For each page, select the necessary nodes to show, and circle any proteins you want to refer to, e.g., "ProA (circled in red) works together with the ProB (circled in blue)". In your create_guide tool call, make sure you specify which nodes to circle and what colour to use. Use the proteins preferred names if available. It is often good for the first page to be an overview with all the relevant proteins selected. Have the view set to Selected Nodes unless you strictly need to show the full network (and then use Full Network). You can also set the view to a graph view if needed. \n\nMake the guide title no more than five words long. The user can see what page they are on so there is no need to say "Page 1 shows..." in the page 1 text. Just state what the user sees as if the text is an explanatory caption. Make the guide helpful and on-topic to what the user asks for. Help the user get a big-picture understanding. Finally, Make sure you actually submit the guide to StringScape using the create_guide tool, and make sure that you circle any proteins you intend to.`;
                const attachmentId = 'howtoguides-' + Date.now();
                aiAttachedItems.push({ id: attachmentId, type: 'file', name: 'How_to_create_guides.txt', data: guideText });
                // This preview label is fixed text, and the chip builder avoids HTML injection through the attachment UI.
                document.getElementById('ai-preview-area').appendChild(aiCreateAttachmentPreviewChip('How_to_create_guides.txt', attachmentId));
            }
        } catch (e) { console.warn('Could not attach guide helper file', e); }

        // If the user's message contains the word "code" or "function", attach How_to_use_code_tools.txt
        try {
            if (/\bcode\b|\bfunction\b/i.test(text)) {
                const codeGuideText = `You are no longer just an AI assistant. You are an expert AI software developer in StringScape.\n\nYou have five code tools: Search_codebase, View_code_snippet, View_all_functions, View_error_logs, and View_last_console_logs. You know these three tools are very powerful when combined. When a user asks you a question about the code, you first write out a detailed plan of how you will use combinations of your tools to answer their question. \n\nExample reasoning: The user has asked how the code for the AI chat interface works. I will use View_all_functions once to see a list of all functions and what they do. From this list I will  identify functions that relate to the AI chat interface. I will then use View_code_snippet multiple times looking up the code for any relevant functions. This will give me insight into how these functions work. Then, I will answer the user's question.\n\nExample reasoning 2: The user has asked about how the code for the pie chart works. I will use Search_codebase to perform multiple searches for terms like “pie chart”, “pie_chart, and “piechart”. Then, I will use View_code_snippet to view the code around relevant search results (e.g., if “pie chart” was found on line 123, I will look at the code snippet for lines 100-130). I will then see the code relating to the pie chart. If needed, I can also use View_code_snippet with a function name to see all the code of a function. Then I can answer the user's question.\n\nExample reasoning 3: The user has asked what other functions use drawLinkDirectionArrow. I will use Search_codebase to search for “drawLinkDirectionArrow”. Then, I will use View_code_snippet to view the code around relevant search results (e.g., if “drawLinkDirectionArrow” was found on line 123, look at the code snippet for lines 80-123 to see what function is calling drawLinkDirectionArrow. If needed, I can also use View_code_snippet with a function name to see all the code of a function. Then, I can answer the user's question.\n\nIf you notice that a function calls another function, you can look up that other function using View_code_snippet to get more context on what it does. That way you can build up a map of “function A does this and calls function B which does this which itself calls function C which does this”\n\nBe smart about how you use the functions, planning out what combinations of functions you will use to get the necessary information to answer the users question. Don’t give up early if you can’t find the answer. Keep trying to find the relevant code until you believe it is unlikely to exist. If a search returns no results, it can be good to try again with a similar term (like “pie chart”, “pie_chart, and “piechart”) until you find the results, you believe there are no results. End your message to the user with a suggestion of what you can do next.`;
                const attachmentId = 'codeguides-' + Date.now();
                aiAttachedItems.push({ id: attachmentId, type: 'file', name: 'How_to_use_code_tools.txt', data: codeGuideText });
                // This preview label is fixed text, and the chip builder keeps the attachment UI inert.
                document.getElementById('ai-preview-area').appendChild(aiCreateAttachmentPreviewChip('How_to_use_code_tools.txt', attachmentId));
            }
        } catch (e) { console.warn('Could not attach code guide file', e); }

        aiIsProcessing = true;
        aiProcessingAbortController = new AbortController();
        updateAiSendButton();

        let displayItems = [...aiAttachedItems];
        aiAppendMessage(text, 'user', displayItems);
        aiSelectedNodesAttachmentSuppressed = false;

        const logGroup = document.getElementById('ai-chatbox');
        let thinking = aiAddLog("AI is thinking...", true);
        document.getElementById('ai-chat-scroll').scrollTop = document.getElementById('ai-chat-scroll').scrollHeight;

        let userContent = [{ type: "text", text: text }];

        try {

        for (const item of aiAttachedItems) {
            if (item.type === 'image') {
                userContent[0].text += `\n\n### ATTACHED IMAGE: ${item.name}\n`;
                userContent.push({ type: "image_url", image_url: { url: item.data } });
            } else if (item.type === 'file') {
                const CHAR_LIMIT = 80000;
                
                if (item.data.length > CHAR_LIMIT) {
                    if (thinking) thinking.remove();
                    const chunks = aiChunkText(item.data, CHAR_LIMIT);
                    let summaryContext = "";

                    for (let i = 0; i < chunks.length; i++) {
                        aiAddLog(`Analyzing ${item.name} (Part ${i + 1}/${chunks.length})...`);
                        aiRecordTranscript({ kind: 'stringscape', content: AI_FILE_SUMMARY_PROMPT });
                        aiRecordTranscript({ kind: 'attached_files', items: [{ ...aiCloneAttachment(item), name: `${item.name} (Part ${i + 1}/${chunks.length})`, data: chunks[i] }] });
                        
                        const chunkRequestStartedAt = Date.now();
                        const chunkRes = await fetch(url.replace(/\/$/, '') + '/v1/chat/completions', {
                            method: 'POST',
                            signal: aiProcessingAbortController.signal,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                messages: [
                                    { role: "system", content: AI_FILE_SUMMARY_PROMPT },
                                    { role: "user", content: chunks[i] }
                                ]
                            })
                        });
                        const chunkData = await chunkRes.json();
                        const chunkMsg = chunkData?.choices?.[0]?.message || {};
                        if (chunkMsg.reasoning_content) {
                            aiRecordTranscript({ kind: 'ai_thoughts', seconds: (Date.now() - chunkRequestStartedAt) / 1000, content: chunkMsg.reasoning_content });
                        }
                        if (chunkMsg.content) {
                            aiRecordTranscript({ kind: 'ai', content: chunkMsg.content });
                            summaryContext += `\n[Fragment ${i+1} Summary]: ${chunkMsg.content}`;
                        }
                    }
                    
                    thinking = aiAddLog("Synthesizing final answer...", true);
                    userContent[0].text += `\n\n### FILE SUMMARY: ${item.name}\n${summaryContext}\n`;
                } else {
                    userContent[0].text += `\n\n### ATTACHED FILE: ${item.name}\n\`\`\`csv\n${item.data}\n\`\`\`\n`;
                }
            }
        }

        if (displayItems.length > 0) {
            aiRecordTranscript({ kind: 'attached_files', items: displayItems.map(aiCloneAttachment) });
        }
        aiRecordTranscript({ kind: 'user', content: text });

        aiChatHistory.push({ role: "user", content: userContent });
        
        document.getElementById('ai-user-input').value = '';
        document.getElementById('ai-user-input').style.height = 'auto';
        document.getElementById('ai-preview-area').innerHTML = '';
        aiAttachedItems = [];

            const endpoint = url.replace(/\/$/, '') + '/v1/chat/completions';
            while (aiIsProcessing && !aiProcessingAbortController.signal.aborted) {
                const requestStartedAt = Date.now();
                aiRecordTranscript({ kind: 'stringscape', content: AI_MAIN_SYSTEM_PROMPT });
                const response = await fetch(endpoint, {
                    method: 'POST',
                    signal: aiProcessingAbortController.signal,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [
                            { role: "system", content: AI_MAIN_SYSTEM_PROMPT },
                            ...aiChatHistory
                        ],
                        tools: aiTools,
                        tool_choice: "auto",
                        stream: true
                    })
                });
                const responseContentType = response.headers.get('content-type') || '';
                const supportsStreaming = Boolean(response.body) && !responseContentType.includes('application/json');
                let msg = null;
                let streamedAssistantContent = '';
                let streamedReasoningContent = '';
                let streamedToolCalls = [];
                let streamedBubble = null;

                const ensureStreamedBubble = () => {
                    if (!streamedBubble) {
                        if (thinking) thinking.remove();
                        streamedBubble = aiAppendMessage('', 'ai');
                    }
                    return streamedBubble;
                };

                const mergeToolCallDelta = (deltaToolCalls) => {
                    if (!Array.isArray(deltaToolCalls)) return;
                    deltaToolCalls.forEach((deltaCall, index) => {
                        if (!deltaCall) return;
                        if (!streamedToolCalls[index]) {
                            streamedToolCalls[index] = {
                                id: deltaCall.id || '',
                                type: deltaCall.type || 'function',
                                function: {
                                    name: deltaCall.function?.name || '',
                                    arguments: deltaCall.function?.arguments || ''
                                }
                            };
                        } else {
                            if (deltaCall.id) streamedToolCalls[index].id = deltaCall.id;
                            if (deltaCall.type) streamedToolCalls[index].type = deltaCall.type;
                            if (deltaCall.function?.name) streamedToolCalls[index].function.name += deltaCall.function.name;
                            if (deltaCall.function?.arguments) streamedToolCalls[index].function.arguments += deltaCall.function.arguments;
                        }
                    });
                };

                const finalizeStreamedMessage = () => {
                    const message = { role: 'assistant', content: streamedAssistantContent };
                    if (streamedReasoningContent) message.reasoning_content = streamedReasoningContent;
                    if (streamedToolCalls.length > 0) message.tool_calls = streamedToolCalls;
                    msg = message;
                };

                const processSsePayload = (payload) => {
                    const trimmed = String(payload || '').trim();
                    if (!trimmed || trimmed === '[DONE]') return false;
                    const chunkData = JSON.parse(trimmed);
                    const choice = chunkData?.choices?.[0] || {};
                    const delta = choice.delta || {};
                    if (typeof delta.content === 'string' && delta.content.length > 0) {
                        streamedAssistantContent += delta.content;
                        aiUpdateBubbleMessage(ensureStreamedBubble(), streamedAssistantContent);
                    }
                    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
                        streamedReasoningContent += delta.reasoning_content;
                    }
                    if (delta.tool_calls && delta.tool_calls.length > 0) {
                        mergeToolCallDelta(delta.tool_calls);
                    }
                    if (choice.finish_reason) {
                        finalizeStreamedMessage();
                    }
                    return true;
                };

                if (supportsStreaming) {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        buffer = buffer.replace(/\r/g, '');
                        let eventBoundary = buffer.indexOf('\n\n');
                        while (eventBoundary !== -1) {
                            const rawEvent = buffer.slice(0, eventBoundary);
                            buffer = buffer.slice(eventBoundary + 2);
                            const dataLines = rawEvent
                                .split('\n')
                                .filter(line => line.startsWith('data:'))
                                .map(line => line.slice(5).trimStart());
                            for (const payload of dataLines) {
                                processSsePayload(payload);
                            }
                            eventBoundary = buffer.indexOf('\n\n');
                        }
                    }
                    if (buffer.trim()) {
                        const trailingLines = buffer.replace(/\r/g, '').split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart());
                        trailingLines.forEach(processSsePayload);
                    }
                    if (!msg) finalizeStreamedMessage();
                } else {
                    const data = await response.json();
                    msg = data.choices[0].message;
                }
                const elapsedSeconds = (Date.now() - requestStartedAt) / 1000;

                if (msg && msg.reasoning_content) {
                    aiRecordTranscript({ kind: 'ai_thoughts', seconds: elapsedSeconds, content: msg.reasoning_content });
                    if (!String(msg.content || '').trim()) {
                        if (thinking) thinking.remove();
                        aiAddThoughtLog(elapsedSeconds, msg.reasoning_content);
                    }
                }

                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    aiChatHistory.push({
                        role: 'assistant',
                        content: msg.content || '',
                        tool_calls: msg.tool_calls
                    });
                    if (msg.content && msg.content.trim() !== '') {
                        aiRecordTranscript({ kind: 'ai', content: msg.content });
                    }

                    for (let call of msg.tool_calls) {
                        if (!aiIsProcessing || aiProcessingAbortController.signal.aborted) break;
                        if (thinking) thinking.remove();
                        // 1. Parse arguments to use in the log message
                        const logArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
                        let logMessage = `Using ${call.function.name.replace(/_/g, ' ')}`; // Fallback

                        // 2. Map tool names to informative message to display in the chat log as a bullet point (AI tool bullet points)
                        const toolDescriptions = {
                            'Search_and_select': `Searching for "${logArgs.query}"`,
                            'View_node_IDs': "Viewing node IDs",
                            'Save_to_collection': `Adding to a collection named "${logArgs.collection_name || logArgs.name || 'new collection'}"`,
                            'Change_node_colouring': `Setting node colouring to ${logArgs.variable_name}`,
                            'View_screenshot': "Viewing screenshot",
                            'View_annotation_data': "Viewing annotation data",
                            'View_description_data': "Viewing description data",
                            'View_centrality_data': "Viewing centrality",
                            'Deselect_nodes': "Deselecting nodes",
                            'Expand_to_connected': "Expanding selection to connected nodes",
                            'View_variables': "Viewing available variables",
                            'See_view_options': "Viewing available views",
                            'Change_view': `Changing view to ${logArgs.view_name}`,
                            'View_error_logs': "Viewing error and debug logs",
                            'View_last_console_logs': `Viewing last ${logArgs.count || 20} logs`,
                            'View_preferred_name': "Viewing preferred names",
                            'View_sequence_data': "Viewing sequence data",
                            'create_guide': "Created interactive guide",
                            'calculate_math' : `Using calculator to solve ${logArgs.equation || logArgs.eq || 'N/A'}`,
                            'get_current_time': "Checking the clock",
                            'View_localisation_data': "Viewing localisation data",
                            'Search_codebase': `Searching code for "${logArgs.query}" (${logArgs.context_lines || 1} line context)`,
                            'View_code_snippet': logArgs.function_name 
                                ? `Viewing code for the function "${logArgs.function_name}"` 
                                : `Viewing code lines ${logArgs.start_line} to ${logArgs.end_line}`,
                            'View_all_functions': "Viewing list of all functions in the codebase",
                            'Run_python_logic': `Running Python code: ${logArgs.code ? (logArgs.code.length > 100 ? logArgs.code.substring(0, 100) + '...' : logArgs.code) : 'N/A'}`
                        };

                        if (toolDescriptions[call.function.name]) {
                            logMessage = toolDescriptions[call.function.name];
                        }

                        aiAddLog(logMessage);
                        thinking = aiAddLog("AI is thinking...", true);
                        aiRecordTranscript({ kind: 'tool_call', name: call.function.name, arguments: call.function.arguments || JSON.stringify(logArgs || {}) });

                        let res = "";
                        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
                        res = await aiExecuteToolCall(call.function.name, args);

                        if (res && typeof res === 'object' && res.type === 'image' && typeof res.data === 'string') {
                            aiChatHistory.push({ role: "tool", tool_call_id: call.id, content: '[Screenshot captured and attached as image.]' });
                            aiRecordTranscript({ kind: 'tool', name: call.function.name, content: '[Screenshot captured and attached as image.]' });
                            aiChatHistory.push({
                                role: 'user',
                                content: [
                                    { type: 'text', text: `Tool output image: ${res.name || 'screenshot'}` },
                                    { type: 'image_url', image_url: { url: res.data } }
                                ]
                            });
                        } else {
                            aiChatHistory.push({ role: "tool", tool_call_id: call.id, content: String(res) });
                            aiRecordTranscript({ kind: 'tool', name: call.function.name, content: String(res) });
                        }
                    }
                } else {
                    aiIsProcessing = false;
                    document.getElementById('ai-glow-container').style.display = 'none';
                    if (thinking) thinking.remove();

                    if (msg.content && msg.content.trim() !== "") {
                        if (streamedBubble) {
                            aiUpdateBubbleMessage(streamedBubble, msg.content);
                        } else {
                            aiAppendMessage(msg.content, 'ai');
                        }
                        aiChatHistory.push({ role: "assistant", content: msg.content });
                        aiRecordTranscript({ kind: 'ai', content: msg.content });
                    }
                }
            }
            document.getElementById('ai-chat-scroll').scrollTop = document.getElementById('ai-chat-scroll').scrollHeight;
        } catch (e) {
            if (thinking) thinking.remove();
            document.getElementById('ai-glow-container').style.display = 'none';
            if (aiStopMessagePending) {
                aiAppendMessage("You stopped the AI", 'ai');
                aiStopMessagePending = false;
            } else if (!(aiProcessingAbortController && aiProcessingAbortController.signal.aborted)) {
                aiAppendMessage("An error occurred: Check the developer logs in LM Studio and check that CORS is enabled in the LM Studio server settings.", 'ai');
            }
        } finally {
            aiIsProcessing = false;
            aiProcessingAbortController = null;
            aiStopMessagePending = false;
            aiArchiveCurrentChat(true);
            updateAiSendButton();
        }
    }

    // This function initializes the AI panel by setting up event listeners for user input, server URL input, and keyboard shortcuts. It also initializes the AI status indicator and refreshes the top panels to reflect the AI integration.
    function initAiPanel() {
        const input = document.getElementById('ai-user-input');
        const serverInput = document.getElementById('ai-server-url');
        const connectBtn = document.getElementById('ai-connect-btn');
        const examplePanel = document.getElementById('ai-example-panel-content');
        if (examplePanel && !aiExamplePanelAgentHtml) aiExamplePanelAgentHtml = examplePanel.innerHTML;
        
        if (input) {
            input.addEventListener('input', () => aiAutoExpand(input));
            input.addEventListener('focus', () => {
                if (aiHistoryPanelOpen) aiCloseHistoryPanel();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendAiMessage();
                }
            });
        }
        if (serverInput) {
            serverInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    checkAiConnection();
                }
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('ai-panel-open')) {
                toggleAiPanel(false);
            }
        });
        document.addEventListener('click', (e) => {
            const title = document.getElementById('ai-header-title');
            const dropdown = document.getElementById('ai-mode-dropdown');
            if (!dropdown || !title) return;
            if (title.contains(e.target) || dropdown.contains(e.target)) return;
            dropdown.classList.remove('open');
        });
        // Initialize status
        const pill = document.getElementById('ai-status-pill');
        if (pill) {
            pill.textContent = "Disconnected";
            pill.className = "status-pill status-disconnected";
        }
        refreshAiTopPanels(true);
        aiLoadSavedChats();
        aiRefreshPanelModeUi();
        aiRefreshCurrentScriptTitle();
        aiRenderChatHistory();
        aiRefreshAskAiButton();
        updateAiSendButton();
        aiRefreshFloatingConsoleButton();
    }

    // End of AI tool and chat interface functions

    let transform = d3.zoomIdentity.translate(window.innerWidth/2, window.innerHeight/2).scale(0.15).translate(-window.innerWidth/2, -window.innerHeight/2);
    let linkOpacity = 0.6, geneLinkOpacity = 0.9, totalUniqueLinks = 0;
    let backgroundMode = 'mono';
    let bgVoronoiOpacity = 0.35;
    let bgVoronoiBlur = 2;
    let bgVoronoiCache = { canvas: null, signature: '', lastBuildMs: 0 };
    let isFrameMode = false;
    let exportFrame = null; // {x, y, w, h} in world coordinates
    let isDrawing = false;
    let activeHandle = null; // 'nw', 'ne', 'sw', 'se', or 'move'
    let selectedRatio = 'custom';
    let targetResolution = 7680;
    let isResizingFrame = false;
    let isMovingFrame = false;
    let frameDragOffset = { x: 0, y: 0 };

    let lastHoveredBar = null; // Global scope variable to track the last hovered histogram bar
    let currentHistogramBins = []; // This will store your binData globally
    let collectionColorCycleTimer = null;
    
    const FRAME_HANDLE_SIZE = 10; // Hit area for corners in world units

    // This function generates a consistent key for an undirected edge between two nodes, ensuring that the order of the nodes does not affect the key. It takes two node identifiers (a and b) and returns a string key in the format "node1||node2", where node1 and node2 are sorted alphabetically.
    function getUndirectedEdgeKey(a, b) {
        //console.log("function getUndirectedEdgeKey()", a, b); <--this function is called very frequently during network building, so I have commented out the console logs. 
        if (!a || !b) return '';
        return a < b ? `${a}||${b}` : `${b}||${a}`;
    }

    // This function updates the options in the dropdown menu for selecting the link label field based on the currently loaded interaction data. 
    function updateLinkLabelFieldOptions() {
        console.log("function updateLinkLabelFieldOptions()");
        const select = document.getElementById('linkLabelField');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '';

        if (!interactionLinkLabelHeaders.length) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No link label columns loaded';
            select.appendChild(opt);
            select.disabled = true;
            linkLabelField = '';
            return;
        }

        select.disabled = false;
        interactionLinkLabelHeaders.forEach(header => {
            const opt = document.createElement('option');
            opt.value = header;
            opt.textContent = header;
            select.appendChild(opt);
        });

        const hasCurrent = currentValue && interactionLinkLabelHeaders.includes(currentValue);
        const preferredHeader = interactionLinkLabelHeaders.find(header => {
            const normalized = String(header).toLowerCase().replace(/[^a-z0-9]+/g, '');
            return normalized === 'combinedscore';
        });
        select.value = hasCurrent ? currentValue : (preferredHeader || interactionLinkLabelHeaders[0]);
        linkLabelField = select.value;
    }

    // This function determines the grey color for a link based on its score value (normalizes to a range between 0 and 1). The function uses D3's interpolateGreys.
    function getScoreLinkGreyColor(value) {
        //console.log("function getScoreLinkGreyColor()", value); <-- This function is called very frequently during network building, so I have commented out the console logs.
        const normalized = Math.max(0, Math.min(1, (value - 200) / 800));
        const greyT = 0.18 + (1 - normalized) * 0.58;
        return d3.interpolateGreys(greyT);
    }

    // This function updates the visibility of the background controls in the UI based on the current background mode. 
    function updateBackgroundControlsUI() {
        console.log("function updateBackgroundControlsUI()");
        const wrap = document.getElementById('bgVoronoiControls');
        if (wrap) wrap.style.display = backgroundMode === 'voronoi' ? 'block' : 'none';
    }

    // This function extracts the embedding kind (e.g., 'network' or 'sequence') from a given file name (ending in .h5) based on specific naming patterns. 
    function getEmbeddingKindFromFileName(fileName) {
        console.log("function getEmbeddingKindFromFileName()", fileName);
        const lower = String(fileName || '').toLowerCase();
        if (!lower.endsWith('.h5')) return null;
        if (lower.includes('.protein.network.embeddings.')) return 'network';
        if (lower.includes('.protein.sequence.embeddings.')) return 'sequence';
        return null;
    }

    // This function initializes a web worker for processing embeddings. It creates a new worker using an inline script that imports necessary libraries (hdf5.js and umap-js) and defines functions for listing keys, safely accessing file paths, reading dataset values, flattening data to rows, normalizing numeric rows, fitting UMAP, and choosing the best datasets from an HDF5 file.
    function initEmbeddingWorker() {
        console.log("function initEmbeddingWorker()");
        if (embeddingWorker) return embeddingWorker;
        const workerSource = `
self.importScripts('https://cdn.jsdelivr.net/npm/jsfive@0.3.10/dist/browser/hdf5.js');
self.importScripts('https://cdn.jsdelivr.net/npm/umap-js@1.4.0/lib/umap-js.min.js');

function listKeys(obj) {
    if (!obj) return [];
    if (Array.isArray(obj.keys)) return obj.keys;
    if (typeof obj.keys === 'function') {
        try { return obj.keys(); } catch (e) { return []; }
    }
    return [];
}

function asPath(base, key) {
    console.log("function asPath()", base, key);
    return base ? (base + '/' + key) : key;
}

function safeGet(file, path) {
    console.log("function safeGet()");
    try { return file.get(path); } catch (e) { return null; }
}

function readDatasetValue(ds) {
    console.log("function readDatasetValue()");
    try {
        return ds.value;
    } catch (e) {
        try {
            return ds.to_array ? ds.to_array() : null;
        } catch (err) {
            return null;
        }
    }
}

function flattenToRows(value, rows, cols) {
    console.log("function flattenToRows()");
    if (!value) return null;
    if (Array.isArray(value)) {
        if (Array.isArray(value[0])) return value;
        const out = new Array(rows);
        for (let i = 0; i < rows; i++) {
            const row = new Array(cols);
            const offset = i * cols;
            for (let j = 0; j < cols; j++) row[j] = Number(value[offset + j]) || 0;
            out[i] = row;
        }
        return out;
    }
    if (ArrayBuffer.isView(value)) {
        const out = new Array(rows);
        for (let i = 0; i < rows; i++) {
            const row = new Array(cols);
            const offset = i * cols;
            for (let j = 0; j < cols; j++) row[j] = Number(value[offset + j]) || 0;
            out[i] = row;
        }
        return out;
    }
    return null;
}

function normalizeNumericRows(rows) {
    console.log("function normalizeNumericRows()");
    return rows.map(r => r.map(v => {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
        return 0;
    }));
}

function safeFitUmap(data, dims, epochLabel) {
    console.log("function safeFitUmap()");
    const UMAPCtor = self.UMAP && self.UMAP.UMAP ? self.UMAP.UMAP : null;
    if (!UMAPCtor) throw new Error('UMAP library failed to load in worker.');
    const reducer = new UMAPCtor({
        nComponents: dims,
        nNeighbors: 15,
        minDist: 0.1,
        nEpochs: 250
    });
    return reducer.fitAsync(data, (epoch) => {
        if (epoch % 25 === 0) {
            self.postMessage({ type: 'progress', phase: epochLabel, epoch });
        }
        return true;
    });
}

function chooseBestDatasets(file) {
    console.log("function chooseBestDatasets()");
    const all = [];

    function walkGroup(basePath, groupObj) {
        const keys = listKeys(groupObj);
        for (const key of keys) {
            const childPath = asPath(basePath, key);
            const child = safeGet(file, childPath);
            if (!child) continue;

            const shape = child.shape;
            if (Array.isArray(shape) && shape.length) {
                all.push({ path: childPath, shape: shape.slice(), obj: child });
            }

            if (listKeys(child).length) {
                walkGroup(childPath, child);
            }
        }
    }

    const rootKeys = listKeys(file);
    for (const key of rootKeys) {
        const top = safeGet(file, key);
        if (!top) continue;
        const shape = top.shape;
        if (Array.isArray(shape) && shape.length) {
            all.push({ path: key, shape: shape.slice(), obj: top });
        }
        if (listKeys(top).length) {
            walkGroup(key, top);
        }
    }

    const matrixCandidates = all
        .filter(d => d.shape.length === 2 && d.shape[0] > 1 && d.shape[1] > 1)
        .sort((a, b) => {
            const av = a.shape[0] * a.shape[1];
            const bv = b.shape[0] * b.shape[1];
            return bv - av;
        });

    const matrix = matrixCandidates[0] || null;
    if (!matrix) return { matrix: null, ids: null };

    const rowCount = matrix.shape[0];
    const idCandidates = all
        .filter(d => {
            const s = d.shape;
            if (s.length === 1 && s[0] === rowCount) return true;
            if (s.length === 2 && s[0] === rowCount && s[1] === 1) return true;
            return false;
        })
        .sort((a, b) => {
            const ap = a.path.toLowerCase();
            const bp = b.path.toLowerCase();
            const as = (ap.includes('id') || ap.includes('protein') || ap.includes('string')) ? 1 : 0;
            const bs = (bp.includes('id') || bp.includes('protein') || bp.includes('string')) ? 1 : 0;
            return bs - as;
        });

    return { matrix, ids: idCandidates[0] || null };
}

self.onmessage = async (event) => {
    const msg = event.data || {};
    if (msg.type !== 'parse_embeddings') return;
    try {
        const file = msg.file;
        if (!file) throw new Error('No file provided to worker parser.');

        self.postMessage({ type: 'progress', phase: 'read' });
        const reader = new FileReaderSync();
        const arrayBuffer = reader.readAsArrayBuffer(file);

        self.postMessage({ type: 'progress', phase: 'parse_h5' });
        const h5file = new self.hdf5.File(arrayBuffer, file.name);
        const picked = chooseBestDatasets(h5file);
        if (!picked.matrix) {
            throw new Error('No 2D embedding matrix was found in the .h5 file.');
        }

        const rows = picked.matrix.shape[0];
        const cols = picked.matrix.shape[1];
        const matrixRaw = readDatasetValue(picked.matrix.obj);
        const matrixRows = flattenToRows(matrixRaw, rows, cols);
        if (!matrixRows || !matrixRows.length) {
            throw new Error('Could not read embedding matrix values from .h5 file.');
        }

        const maxPoints = 2500;
        const step = Math.max(1, Math.ceil(matrixRows.length / maxPoints));
        const sampleIndices = [];
        for (let i = 0; i < matrixRows.length; i += step) sampleIndices.push(i);
        const sampledRows = sampleIndices.map(i => matrixRows[i]);
        const sampled = normalizeNumericRows(sampledRows);

        let ids = sampleIndices.map(i => 'row_' + i);
        if (picked.ids && picked.ids.obj) {
            const idRaw = readDatasetValue(picked.ids.obj);
            if (Array.isArray(idRaw) && idRaw.length >= rows) {
                ids = sampleIndices.map(i => String(idRaw[i] ?? ('row_' + i)));
            } else if (ArrayBuffer.isView(idRaw) && idRaw.length >= rows) {
                ids = sampleIndices.map(i => String(idRaw[i] ?? ('row_' + i)));
            }
        }

        self.postMessage({ type: 'progress', phase: 'umap2d' });
        const umap2d = await safeFitUmap(sampled, 2, 'umap2d');

        self.postMessage({ type: 'progress', phase: 'umap3d' });
        const umap3d = await safeFitUmap(sampled, 3, 'umap3d');

        self.postMessage({
            type: 'result',
            payload: {
                fileName: file.name,
                sourceType: msg.sourceType,
                matrixPath: picked.matrix.path,
                totalRows: rows,
                dimensions: cols,
                sampledRows: sampled.length,
                ids,
                vectors: sampled,
                umap2d,
                umap3d
            }
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: (error && error.message) ? error.message : String(error)
        });
    }
};`;

        embeddingWorker = new Worker(URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' })));
        embeddingWorkerReady = true;
        return embeddingWorker;
    }

    // This function uses the initialized embedding worker to parse an embedding file in a separate thread. 
    async function parseEmbeddingFileInWorker(file, sourceType) {
        console.log("async function parseEmbeddingFileInWorker(file, sourceType)");
        const worker = initEmbeddingWorker();
        return new Promise((resolve, reject) => {
            const onMessage = (event) => {
                const data = event.data || {};
                if (data.type === 'progress') return;
                if (data.type === 'error') {
                    worker.removeEventListener('message', onMessage);
                    reject(new Error(data.error || 'Unknown embedding parse error'));
                    return;
                }
                if (data.type === 'result') {
                    worker.removeEventListener('message', onMessage);
                    resolve(data.payload);
                }
            };
            worker.addEventListener('message', onMessage);
            worker.postMessage({ type: 'parse_embeddings', file, sourceType });
        });
    }

    // This function retrieves the currently active embedding data based on the selected embedding view type. 
    function getActiveEmbeddingData() {
        console.log("function getActiveEmbeddingData()");
        return embeddingDataByType[embeddingViewType] || null;
    }

    // This function ensures that a given value is clamped between -1 and 1, which is important for cosine similarity values that should not exceed this range.
    function clampCosine(value) {
        return Math.max(-1, Math.min(1, Number.isFinite(+value) ? +value : 0));
    }

    // This function clamps a value between 0 and 1, which is useful for normalizing similarity scores to a range suitable for color mapping.
    function getEmbeddingSimilarityColor(similarity) {
        const normalized = (clampCosine(similarity) + 1) / 2;
        return d3.interpolateRdYlBu(1 - normalized);
    }

    function getPdbStructureCount(nodeId) {
        if (!aliasData) return 0;
        const aliasList = aliasData?.get?.(nodeId) || [];
        let count = 0;
        const nearMissSources = [];
        for (const aliasEntry of aliasList) {
            const source = String(aliasEntry?.source || '').trim();
            if (source === 'UniProt_DR_PDB' || source === 'Ensembl_PDB') {
                count++;
            } else {
                const normalizedSource = source.toLowerCase().replace(/[\s-]+/g, '_');
                if (normalizedSource.includes('pdb')) nearMissSources.push(source || '(empty)');
            }
        }
        if (count === 0 && nearMissSources.length && !pdbAliasNearMissDebuggedNodes.has(nodeId)) {
            pdbAliasNearMissDebuggedNodes.add(nodeId);
            console.debug('[PDB DEBUG] PDB-like alias sources found but not exact-match for node', {
                nodeId,
                nearMissSources: Array.from(new Set(nearMissSources)).slice(0, 8),
                aliasCount: aliasList.length
            });
        }
        return count;
    }


    function getEmbeddingSimilarityColorByRange(similarity, minValue, maxValue) {
        const minV = Number.isFinite(minValue) ? minValue : -1;
        const maxV = Number.isFinite(maxValue) ? maxValue : 1;
        const span = maxV - minV;
        const normalized = span > 1e-12
            ? clamp01((similarity - minV) / span)
            : 1;
        return d3.interpolateRdYlBu(1 - normalized);
    }

    // This function retrieves the set of node IDs that are currently being used as reference points for calculating embedding similarities, based on the selected embedding color similarity type.
    function getActiveEmbeddingReferenceSet() {
        return embeddingReferenceNodeIdsByType[embeddingColorSimilarityType] || new Set();
    }

    // This function invalidates the cache of embedding vectors for a given type (network or sequence) or for all types if no specific type is provided. This is important to ensure that updated embeddings are used when calculating similarities.
    function invalidateEmbeddingVectorCache(type = null) {
        if (type === 'network' || type === 'sequence') {
            embeddingVectorsCacheByType[type] = null;
            return;
        }
        embeddingVectorsCacheByType.network = null;
        embeddingVectorsCacheByType.sequence = null;
    }

    // This function retrieves a mapping of node IDs to their corresponding embedding vectors and norms for a specified embedding type (network or sequence). 
    function getEmbeddingVectorsByNodeForType(type) {
        if (embeddingVectorsCacheByType[type]) return embeddingVectorsCacheByType[type];
        const data = embeddingDataByType[type] || null;
        if (!data || !Array.isArray(data.ids) || !Array.isArray(data.vectors)) {
            embeddingVectorsCacheByType[type] = new Map();
            return embeddingVectorsCacheByType[type];
        }
        const lookup = buildEmbeddingNodeLookup();
        const vectorsByNode = new Map();
        const length = Math.min(data.ids.length, data.vectors.length);
        for (let i = 0; i < length; i++) {
            const node = resolveEmbeddingIdToNode(data.ids[i], lookup);
            const vecRaw = data.vectors[i];
            if (!node || !Array.isArray(vecRaw) || !vecRaw.length) continue;
            const vec = vecRaw.map(v => Number(v) || 0);
            const norm = Math.sqrt(vec.reduce((acc, v) => acc + (v * v), 0));
            if (!Number.isFinite(norm) || norm <= 1e-12) continue;
            vectorsByNode.set(node.id, { vec, norm });
        }
        embeddingVectorsCacheByType[type] = vectorsByNode;
        return vectorsByNode;
    }

    // This function computes the embedding similarity scores for a set of target nodes based on the currently active embedding reference nodes and the selected embedding color similarity type.
    function computeEmbeddingSimilarityState(targetNodes = null) {
        const type = embeddingColorSimilarityType;
        const refs = Array.from(getActiveEmbeddingReferenceSet());
        const vectorsByNode = getEmbeddingVectorsByNodeForType(type);
        const useNodes = Array.isArray(targetNodes) && targetNodes.length ? targetNodes : nodes;

        if (!vectorsByNode.size) {
            return {
                type,
                scores: new Map(),
                refNodeIds: new Set(refs),
                refWithVectors: new Set(),
                min: -1,
                max: 1,
                hasData: false,
                isFallbackNoReference: false
            };
        }

        if (!refs.length) {
            const scores = new Map();
            useNodes.forEach(node => {
                if (vectorsByNode.has(node.id)) scores.set(node.id, 1);
            });
            return {
                type,
                scores,
                refNodeIds: new Set(),
                refWithVectors: new Set(),
                min: scores.size ? 1 : -1,
                max: scores.size ? 1 : 1,
                hasData: scores.size > 0,
                isFallbackNoReference: true
            };
        }

        const refVectors = refs
            .map(id => ({ id, entry: vectorsByNode.get(id) }))
            .filter(d => !!d.entry);

        if (!refVectors.length) {
            return {
                type,
                scores: new Map(),
                refNodeIds: new Set(refs),
                refWithVectors: new Set(),
                min: -1,
                max: 1,
                hasData: false,
                isFallbackNoReference: false
            };
        }

        const scores = new Map();
        useNodes.forEach(node => {
            const candidate = vectorsByNode.get(node.id);
            if (!candidate) return;
            let total = 0;
            let count = 0;
            refVectors.forEach(ref => {
                const refEntry = ref.entry;
                const len = Math.min(candidate.vec.length, refEntry.vec.length);
                if (!len) return;
                let dot = 0;
                for (let i = 0; i < len; i++) dot += candidate.vec[i] * refEntry.vec[i];
                const denom = candidate.norm * refEntry.norm;
                if (!Number.isFinite(denom) || denom <= 1e-12) return;
                total += clampCosine(dot / denom);
                count++;
            });
            if (!count) return;
            scores.set(node.id, clampCosine(total / count));
        });

        const values = Array.from(scores.values());
        const min = values.length ? d3.min(values) : -1;
        const max = values.length ? d3.max(values) : 1;
        return {
            type,
            scores,
            refNodeIds: new Set(refs),
            refWithVectors: new Set(refVectors.map(r => r.id)),
            min: Number.isFinite(min) ? min : -1,
            max: Number.isFinite(max) ? max : 1,
            hasData: values.length > 0,
            isFallbackNoReference: false
        };
    }

    // This function sets the embedding reference nodes based on the currently selected nodes in the network. 
    function setEmbeddingReferenceFromCurrentSelection() {
        const selectedIds = Array.from(getEffectiveSelectedNodesSet());
        if (!selectedIds.length) {
            alert('Select one or more nodes first.');
            return;
        }
        const vectorsByNode = getEmbeddingVectorsByNodeForType(embeddingColorSimilarityType);
        const available = selectedIds.filter(id => vectorsByNode.has(id));
        if (!available.length) {
            alert('None of the selected nodes have available embeddings for the selected embedding type.');
            return;
        }
        embeddingReferenceNodeIdsByType[embeddingColorSimilarityType] = new Set(available);
        if ((document.getElementById('colorMode')?.value || 'layer') === 'embeddings') {
            updateSizesAndColors();
        } else {
            draw();
        }
        if (currentViewId === 'Embeddings') {
            markEmbeddingsDirty(true);
            refreshEmbeddingsView(false);
        }
    }

    // This function checks if a given node ID is part of the current embedding reference set, which is used for calculating embedding similarities and coloring nodes accordingly.
    function isEmbeddingReferenceNode(nodeId) {
        if ((document.getElementById('colorMode')?.value || '') !== 'embeddings') return false;
        return getActiveEmbeddingReferenceSet().has(nodeId);
    }

    // This function applies colors to nodes based solely on their embedding similarity scores, using the currently selected embedding color similarity type and the defined range for coloring. Nodes that do not have embeddings or do not fall within the specified range are colored with default grey tones.
    function applyEmbeddingColorsOnly() {
        if ((document.getElementById('colorMode')?.value || '') !== 'embeddings') return;
        const vectorsByNode = getEmbeddingVectorsByNodeForType(embeddingColorSimilarityType);
        const useGlobalNodesForStyle = currentViewId === 'base' || currentViewId === 'Venn Diagram' || currentViewId === 'Scatter Plot' || currentViewId === 'Embeddings';
        const targetNodes = useGlobalNodesForStyle ? nodes : (activeSubData?.nodes || []);

        targetNodes.forEach(n => {
            const hasEmbedding = vectorsByNode.has(n.id);
            if (!hasEmbedding) {
                n.col = '#333';
                return;
            }
            const sim = n.embeddingSimilarity;
            if (Number.isFinite(sim)) {
                const norm = Number.isFinite(n.embeddingSimilarityNorm) ? n.embeddingSimilarityNorm : 1;
                n.col = (sim >= embeddingRangeMin && sim <= embeddingRangeMax)
                    ? d3.interpolateRdYlBu(1 - clamp01(norm))
                    : '#333';
            } else {
                n.col = '#666'; //This is the color assigned to nodes that have an embedding available but do not have a finite similarity score.
            }
        });

        gpuState.needsUpload = true;
        draw();
    }

    // This function generates a unique key for caching the rendered embedding points based on the current embedding view type, UMAP dimension, file name, and point count. This key is used to determine if the cached rendering can be reused or if it needs to be updated.
    function getEmbeddingRenderKey() {
        const active = embeddingDataByType[embeddingViewType] || null;
        const pointCount = active
            ? ((embeddingUmapDimension === '3d' ? active.umap3d : active.umap2d) || []).length
            : 0;
        return `${embeddingViewType}|${embeddingUmapDimension}|${active?.fileName || ''}|${pointCount}`;
    }

    // This function marks the embedding data as dirty (i.e., "needs update"). If the render parameter is true, it also marks the embedding plot as dirty, indicating that it needs to be re-rendered. 
    function markEmbeddingsDirty(render = false) {
        embeddingControlsDirty = true;
        if (render) embeddingPlotDirty = true;
    }

    // This function retrieves the coordinates for rendering the embedding points based on the current embedding data and the selected UMAP dimension (2D or 3D). It returns an object containing arrays of x, y, and optionally z coordinates for the embedding points.
    function getEmbeddingRenderPoints(data, dimension) {
        if (!data) return null;
        if (dimension === '3d') {
            const arr = data.umap3d || [];
            return {
                x: arr.map(v => Number(v[0]) || 0),
                y: arr.map(v => Number(v[1]) || 0),
                z: arr.map(v => Number(v[2]) || 0)
            };
        }
        const arr = data.umap2d || [];
        return {
            x: arr.map(v => Number(v[0]) || 0),
            y: arr.map(v => Number(v[1]) || 0)
        };
    }

    // This function builds a lookup map for embedding nodes based on their IDs, allowing for efficient resolution of node IDs to node objects when processing embedding data. It also identifies a prefix hint from the node IDs to assist in resolving IDs that may have a common prefix.
    function buildEmbeddingNodeLookup() {
        const suffixMap = new Map();
        const prefixHint = (nodes.find(n => /^\d+\./.test(String(n.id || '')))?.id || '').split('.')[0];
        nodes.forEach(n => {
            const sid = String(n.id || '');
            const suffix = sid.includes('.') ? sid.split('.').slice(1).join('.') : sid;
            if (!suffixMap.has(suffix)) suffixMap.set(suffix, n);
        });
        return { suffixMap, prefixHint };
    }

    // This function resolves a raw embedding ID to a node object by checking the node map and using the prepared lookup for suffixes and prefixes. 
    function resolveEmbeddingIdToNode(rawId, lookup = null) {
        const prepared = lookup || buildEmbeddingNodeLookup();
        const id = String(rawId || '').trim();
        let n = nodeMap.get(id);
        if (!n && id.includes('.')) n = prepared.suffixMap.get(id.split('.').slice(1).join('.')) || null;
        if (!n && prepared.prefixHint && !id.includes('.')) {
            n = nodeMap.get(`${prepared.prefixHint}.${id}`) || prepared.suffixMap.get(id) || null;
        }
        if (!n) n = prepared.suffixMap.get(id) || null;
        return n;
    }

    // This function retrieves the set of embedding point IDs that are currently selected for the active embedding view type. 
    function getActiveEmbeddingSelectionSet() {
        return embeddingSelectedIdsByType[embeddingViewType] || new Set();
    }

    // This function sets the active embedding selection for the current embedding view type by taking an array of IDs and storing them in a set for efficient lookup. The IDs are converted to strings and trimmed to ensure consistency.
    function setActiveEmbeddingSelection(ids) {
        embeddingSelectedIdsByType[embeddingViewType] = new Set(Array.from(ids || []).map(v => String(v || '').trim()));
    }

    // This function retrieves the indices of the embedding points that are currently selected based on the provided IDs and the active embedding selection set. 
    function getEmbeddingSelectedPointIndices(ids) {
        const selected = getActiveEmbeddingSelectionSet();
        if (!selected || selected.size === 0) return null;
        const indices = [];
        (ids || []).forEach((rawId, i) => {
            if (selected.has(String(rawId || '').trim())) indices.push(i);
        });
        return indices.length ? indices : null;
    }

    // This function retrieves the current embedding point IDs and their corresponding coordinates for rendering, based on the active embedding view type and UMAP dimension. 
    function getEmbeddingCurrentIdsAndPoints() {
        const active = embeddingDataByType[embeddingViewType] || null;
        if (!active) return { ids: [], points: null };
        const points = getEmbeddingRenderPoints(active, embeddingUmapDimension);
        if (!points || !points.x || !points.x.length) return { ids: [], points: null };
        const ids = active.ids || points.x.map((_, i) => `row_${i}`);
        return { ids, points };
    }

    // This function projects a 3D point from the embedding space to screen coordinates using the camera parameters from the Plotly 3D scene. 
    function projectGl3dPoint(cameraParams, point) {
        if (!cameraParams || !Array.isArray(point) || point.length < 3) return null;

        const xformMatrix = (matrix, vector) => {
            const out = [0, 0, 0, 0];
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    out[j] += matrix[4 * i + j] * vector[i];
                }
            }
            return out;
        };

        const result = xformMatrix(
            cameraParams.projection,
            xformMatrix(
                cameraParams.view,
                xformMatrix(cameraParams.model, [point[0], point[1], point[2], 1])
            )
        );

        if (!result || result.length < 4) return null;
        return result;
    }

    // This function retrieves the screen coordinates for the currently selected embedding points, which is necessary for performing hit-tests during selection gestures in the embedding plot. It handles both 2D and 3D UMAP projections and uses Plotly's internal projection when available for consistency with the rendered view.
    function getEmbeddingProjectedPointsForSelection() {
        const plotEl = document.getElementById('embeddings-plot');
        if (!plotEl) return [];
        const { ids, points } = getEmbeddingCurrentIdsAndPoints();
        if (!ids.length || !points) return [];

        const canvasRect = canvas.getBoundingClientRect();
        const plotRect = plotEl.getBoundingClientRect();
        const out = [];

        if (embeddingUmapDimension === '2d') {
            const xa = plotEl?._fullLayout?.xaxis;
            const ya = plotEl?._fullLayout?.yaxis;
            if (!xa || !ya || typeof xa.l2p !== 'function' || typeof ya.l2p !== 'function') return [];
            for (let i = 0; i < ids.length; i++) {
                const sx = (plotRect.left - canvasRect.left) + (xa._offset || 0) + xa.l2p(points.x[i]);
                const sy = (plotRect.top - canvasRect.top) + (ya._offset || 0) + ya.l2p(points.y[i]);
                if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
                // Embeddings gesture matching uses screen-space coordinates.
                out.push({ id: String(ids[i] || '').trim(), x: sx, y: sy });
            }
            return out;
        }

        const sceneRoot = plotEl?._fullLayout?.scene;
        const sceneInstance = sceneRoot?._scene;
        const cameraParams = sceneInstance?.glplot?.cameraParams;
        const dataScale = Array.isArray(sceneInstance?.dataScale) && sceneInstance.dataScale.length >= 3
            ? sceneInstance.dataScale
            : [1, 1, 1];
        if (!sceneInstance || !cameraParams) return [];

        // Use the same viewport basis Plotly scene hover uses: scene container rect.
        let viewportRect = sceneInstance?.container?.getBoundingClientRect?.() || plotRect;
        let width = viewportRect.width;
        let height = viewportRect.height;
        let glCanvas = null;
        let glRect = null;
        
        try {
            glCanvas = sceneInstance?.canvas;
            if (!glCanvas && sceneInstance?.container) {
                glCanvas = sceneInstance.container.querySelector('canvas');
            }
            if (glCanvas) {
                glRect = glCanvas.getBoundingClientRect();
            }
        } catch (e) {
            // Keep viewportRect fallback
        }

        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            viewportRect = plotRect;
            width = plotRect.width;
            height = plotRect.height;
        }

        const project3dToScreen = (coord) => {
            // Prefer Plotly's internal scene projection when available.
            // This keeps selection coordinates consistent with what Plotly actually renders.
            try {
                if (typeof sceneInstance?.project === 'function') {
                    const p = sceneInstance.project(coord);
                    if (Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
                        return [p[0], p[1], null, null, null, 'scene.project'];
                    }
                }
            } catch (e) {
                // Fallback below
            }

            const pdata = projectGl3dPoint(cameraParams, coord);
            if (!Array.isArray(pdata) || pdata.length < 4 || !Number.isFinite(pdata[3]) || pdata[3] === 0) return null;
            const ndcX = pdata[0] / pdata[3];
            const ndcY = pdata[1] / pdata[3];
            if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;
            // Keep only extreme outliers out of hit-tests; avoid strict clipping that shrinks selection.
            if (Math.abs(ndcX) > 6 || Math.abs(ndcY) > 6) return null;
            // Convert from NDC [-1,1] to screen pixels [0, width] and [0, height]
            const screenX = (0.5 + 0.5 * ndcX) * width;
            const screenY = (0.5 - 0.5 * ndcY) * height;
            return [screenX, screenY, pdata, ndcX, ndcY, 'manual'];
        };

        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < ids.length; i++) {
            let projected = null;
            try {
                const rawCoord = [points.x[i], points.y[i], points.z?.[i] || 0];
                const coord = [
                    rawCoord[0] * dataScale[0],
                    rawCoord[1] * dataScale[1],
                    rawCoord[2] * dataScale[2]
                ];
                projected = project3dToScreen(coord);
                
            } catch (e) {
                failCount++;
                continue;
            }
            
            if (!projected || !Array.isArray(projected) || projected.length < 2) {
                failCount++;
                continue;
            }
            if (!Number.isFinite(projected[0]) || !Number.isFinite(projected[1])) {
                failCount++;
                continue;
            }
            
            // Anchor projected screen points to the scene viewport origin.
            const sx = (viewportRect.left - canvasRect.left) + projected[0];
            const sy = (viewportRect.top - canvasRect.top) + projected[1];
            
            // 3D gesture selection is done in screen space to match what users see.
            out.push({ id: String(ids[i] || '').trim(), x: sx, y: sy });
            successCount++;
        }
        
        return out;
    }

    // This function applies the selection of embedding points based on the user's gesture (lasso or brush) in the embedding plot. It determines which points fall within the gesture area and updates the active embedding selection accordingly.
    function applyEmbeddingGestureSelection(useLasso) {
        if (currentViewId !== 'Embeddings') return;
        
        const projected = getEmbeddingProjectedPointsForSelection();
        const { ids } = getEmbeddingCurrentIdsAndPoints();
        const plotEl = document.getElementById('embeddings-plot');
        if (!plotEl || !ids.length) return;

        const gesturePoints = embeddingUmapDimension === '3d'
            ? (useLasso ? lassoPoints : brushPoints)
            : (useLasso ? lassoPoints : brushPoints);
        const effectiveBrushRadius = brushRadius;

        const matched = new Set();
        if (useLasso) {
            if (gesturePoints.length < 3) {
                return;
            }
            projected.forEach((p, idx) => {
                const contained = d3.polygonContains(gesturePoints, [p.x, p.y]);
                if (contained) {
                    matched.add(p.id);
                }
            });
        } else {
            if (!gesturePoints.length) {
                return;
            }
            projected.forEach((p, idx) => {
                const hit = gesturePoints.some(pt => {
                    const dx = p.x - pt[0];
                    const dy = p.y - pt[1];
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    return dist <= effectiveBrushRadius;
                });
                if (hit) {
                    matched.add(p.id);
                }
            });
        }

        updateEmbeddingSelectionFromPointIds(matched, ids, plotEl);
    }

    // This function ensures that there is a canvas element overlaying the embedding plot for rendering selection gestures (lasso and brush). It creates the canvas if it does not exist and sizes it to match the embedding plot area.
    function ensureEmbeddingsOverlayCanvas() {
        const viewEl = document.getElementById('embeddings-view');
        if (!viewEl) return null;
        let overlay = document.getElementById('embeddings-overlay-canvas');
        if (!overlay) {
            overlay = document.createElement('canvas');
            overlay.id = 'embeddings-overlay-canvas';
            overlay.style.position = 'absolute';
            overlay.style.inset = '0';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '5';
            overlay.style.background = 'transparent';
            overlay.style.cursor = 'inherit';
            viewEl.appendChild(overlay);
        }
        const dpr = window.devicePixelRatio || 1;
        overlay.width = Math.round(window.innerWidth * dpr);
        overlay.height = Math.round(window.innerHeight * dpr);
        overlay.style.width = `${window.innerWidth}px`;
        overlay.style.height = `${window.innerHeight}px`;
        return overlay;
    }

    // This function draws the selection overlay for the embedding plot, rendering the lasso or brush gestures as the user interacts with the plot. 
    function drawEmbeddingsSelectionOverlay() {
        const overlay = ensureEmbeddingsOverlayCanvas();
        if (!overlay) return;
        const dpr = window.devicePixelRatio || 1;
        const octx = overlay.getContext('2d');
        if (!octx) return;
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.clearRect(0, 0, overlay.width, overlay.height);

        // Embeddings gestures are captured in screen-space pixels.
        const tx = (x) => x * dpr;
        const ty = (y) => y * dpr;
        const tk = 1;

        if (isLassoMode && lassoPoints.length > 1) {
            octx.beginPath();
            octx.moveTo(tx(lassoPoints[0][0]), ty(lassoPoints[0][1]));
            lassoPoints.forEach(p => octx.lineTo(tx(p[0]), ty(p[1])));
            octx.strokeStyle = '#ff9800';
            octx.lineWidth = 4;
            octx.setLineDash([5, 5]);
            octx.stroke();
            octx.setLineDash([]);
            octx.fillStyle = 'rgba(255, 152, 0, 0.2)';
            octx.fill();
        }

        if (isBrushMode) {
            if (brushPoints.length > 1) {
                octx.beginPath();
                octx.lineCap = 'round';
                octx.lineJoin = 'round';
                octx.moveTo(tx(brushPoints[0][0]), ty(brushPoints[0][1]));
                brushPoints.forEach(p => octx.lineTo(tx(p[0]), ty(p[1])));
                octx.strokeStyle = 'rgba(255, 152, 0, 0.25)';
                octx.lineWidth = brushRadius * 2 * tk * dpr;
                octx.stroke();
            }
            octx.beginPath();
            octx.arc(tx(currentMousePos[0]), ty(currentMousePos[1]), brushRadius * tk * dpr, 0, 2 * Math.PI);
            octx.fillStyle = 'rgba(255, 152, 0, 0.07)';
            octx.fill();
            octx.strokeStyle = '#ff9800';
            octx.lineWidth = 2 * dpr;
            octx.setLineDash([4 * dpr, 4 * dpr]);
            octx.stroke();
            octx.setLineDash([]);
        }
    }

    // This function synchronizes the embedding point selection with the currently selected nodes in the graph. 
    function syncEmbeddingSelectionFromGraphNodes() {
        const active = embeddingDataByType[embeddingViewType] || null;
        if (!active) {
            setActiveEmbeddingSelection(new Set());
            refreshInfoBoxFromSelection();
            return;
        }
        const points = getEmbeddingRenderPoints(active, embeddingUmapDimension);
        const ids = active.ids || points?.x?.map((_, i) => `row_${i}`) || [];
        if (!ids.length) {
            setActiveEmbeddingSelection(new Set());
            refreshInfoBoxFromSelection();
            return;
        }

        const selectedGraphIds = new Set(Array.from(getEffectiveSelectedNodesSet() || new Set()));
        if (!selectedGraphIds.size) {
            setActiveEmbeddingSelection(new Set());
            refreshInfoBoxFromSelection();
            return;
        }

        const lookup = buildEmbeddingNodeLookup();
        const next = new Set();
        ids.forEach(rawId => {
            const node = resolveEmbeddingIdToNode(rawId, lookup);
            if (node && selectedGraphIds.has(node.id)) next.add(String(rawId || '').trim());
        });
        setActiveEmbeddingSelection(next);
        refreshInfoBoxFromSelection();
    }

    // This function applies styling to the embedding points in the plot based on the current selection. It dims unselected points and highlights selected points to visually distinguish them in the embedding view. 
    async function applyEmbeddingSelectionStyling(plotEl, ids) {
        if (!plotEl || typeof Plotly === 'undefined' || !Array.isArray(ids) || !ids.length) return;
        const is3d = embeddingUmapDimension === '3d';
        const selectedIndices = getEmbeddingSelectedPointIndices(ids);
        const hasSelection = Array.isArray(selectedIndices) && selectedIndices.length > 0;
        const baseColors = getEmbeddingMarkerColors(ids);
        const baseBorderColors = getEmbeddingMarkerBorderColors(baseColors);

        const dimmedColors = hasSelection
            ? ids.map((rawId, i) => {
                const isSelected = getActiveEmbeddingSelectionSet().has(String(rawId || '').trim());
                if (isSelected) return baseColors[i] || '#58b8ff';
                const c = d3.color(baseColors[i] || '#58b8ff');
                if (!c) return is3d ? '#2a2a2a' : 'rgba(88,184,255,0.22)';
                //the 1.15 here darkens the color for unselected points in 3D mode to make them less prominent, while in 2D mode we simply reduce the opacity to achieve a similar effect. This is because Plotly's 3D scatter plots do not support per-point opacity.
                if (is3d) return c.darker(1.65).formatRgb();
                c.opacity = 0.42;
                return c.formatRgb();
            })
            : baseColors;

        const dimmedBorderColors = hasSelection
            ? ids.map((rawId, i) => {
                const isSelected = getActiveEmbeddingSelectionSet().has(String(rawId || '').trim());
                if (isSelected) return baseBorderColors[i] || '#d0d0d0';
                const c = d3.color(baseBorderColors[i] || '#d0d0d0');
                //What does opacity here affect? It affects the opacity of the border color for unselected points, making them more transparent. In 3D mode, it darkens the border color instead of changing opacity, to maintain visibility in the 3D space.
                if (!c) return is3d ? '#2f2f2f' : 'rgba(208,208,208,0.22)';
                if (is3d) return c.darker(1.65).formatRgb();
                //opacity of unselected points on 2D UMAP plot
                c.opacity = 0.42;
                return c.formatRgb();
            })
            : baseBorderColors;

        // In 3D mode, Plotly does not support per-point opacity, so we simulate it by dimming the colors of unselected points. In 2D mode, we can directly set the opacity.
        const markerOpacity = hasSelection
            ? ids.map((rawId) => getActiveEmbeddingSelectionSet().has(String(rawId || '').trim()) ? 0.98 : 0.42)
            : ids.map(() => 0.95);
        try {
            const styleUpdate = is3d
                ? {
                    'marker.color': [dimmedColors],
                    'marker.line.color': [dimmedBorderColors]
                }
                : {
                    selectedpoints: [selectedIndices],
                    'marker.opacity': [markerOpacity],
                    'marker.color': [dimmedColors],
                    'marker.line.color': [dimmedBorderColors]
                };
            await Plotly.restyle(plotEl, styleUpdate, [0]);
        } catch (err) {
        }
    }

    // This function updates the embedding point selection based on a set of point IDs that were determined to be selected through a user gesture. 
    function updateEmbeddingSelectionFromPointIds(pointIds, ids, plotEl) {
        // Ignore delayed Plotly callbacks after leaving Embeddings.
        if (currentViewId !== 'Embeddings') return;

        const incoming = new Set(Array.from(pointIds || []).map(v => String(v || '').trim()));
        const current = new Set(getActiveEmbeddingSelectionSet());
        let next = new Set(current);

        if (isSubtractMode) {
            incoming.forEach(id => next.delete(id));
        } else if (isIntersectMode) {
            const inter = new Set();
            incoming.forEach(id => { if (current.has(id)) inter.add(id); });
            next = inter;
        } else if (isAdditiveMode) {
            incoming.forEach(id => next.add(id));
        } else {
            next = incoming;
        }

        setActiveEmbeddingSelection(next);
        applyEmbeddingSelectionStyling(plotEl, ids);
        applyEmbeddingsSelectionToGraphNodes();
        refreshInfoBoxFromSelection();
    }

    // This function checks if embedding selection is currently suppressed, which can happen temporarily after certain interactions to prevent unintended selection changes. 
    function isEmbeddingSelectionSuppressed() {
        return Date.now() < embeddingSelectionSuppressUntil;
    }

    // This function updates the interaction mode of the embedding plot based on the current selection mode (brush or lasso) and the UMAP dimension. 
    async function updateEmbeddingInteractionMode(plotEl) {
        if (currentViewId !== 'Embeddings' || !plotEl || typeof Plotly === 'undefined') return;
        const interactionKey = `${embeddingUmapDimension}|${isBrushMode}|${isLassoMode}`;
        if (interactionKey === embeddingLastInteractionKey) return;
        const inSelectionMode = isBrushMode || isLassoMode;
        const selectionCursor = inSelectionMode ? 'crosshair' : 'grab';

        if (embeddingUmapDimension === '2d') {
            const lockView = isBrushMode || isLassoMode;
            try {
                await Plotly.relayout(plotEl, {
                    dragmode: 'pan',
                    'xaxis.fixedrange': !!lockView,
                    'yaxis.fixedrange': !!lockView
                });
            } catch (err) {
            }
        }

        plotEl.style.pointerEvents = inSelectionMode ? 'none' : 'auto';
        plotEl.style.cursor = selectionCursor;
        const viewEl = document.getElementById('embeddings-view');
        if (viewEl) viewEl.style.cursor = selectionCursor;
        const overlay = document.getElementById('embeddings-overlay-canvas');
        if (overlay) overlay.style.cursor = selectionCursor;
        if (canvas) canvas.style.cursor = selectionCursor;

        embeddingLastInteractionKey = interactionKey;
    }

    // This function binds event handlers to the embedding plot for handling selection interactions. It manages mouse events to detect clicks and drags, and updates the embedding selection accordingly. It also ensures that selection updates are not triggered during unintended interactions, such as dragging the plot.
    function bindEmbeddingSelectionHandlers(plotEl, ids) {
        if (!plotEl || typeof plotEl.on !== 'function') return;
        const is3d = embeddingUmapDimension === '3d';
        const handlerEpoch = ++embeddingSelectionHandlerEpoch;
        let lastSelectionInteractionTs = 0;
        let pointerDownPos = null;
        let pointerDownButton = -1;
        let pointerDragged = false;
        let pendingClickedId = null;
        // Drag detection happens on the overlay canvas (which has pointerEvents: none but we'll detect via window events)
        const detectDragOnWindow = (ev) => {
            if (!pointerDownPos) return;
            const dx = ev.clientX - pointerDownPos.x;
            const dy = ev.clientY - pointerDownPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Threshold for detecting drag (4 pixels)
            if (dist > 4 && !pointerDragged) {
                pointerDragged = true;
            }
        };
        
        const handleWindowMouseDown = (ev) => {
            // Only track if click is within embeddings plot area
            const plotRect = plotEl.getBoundingClientRect();
            if (ev.clientX < plotRect.left || ev.clientX > plotRect.right || 
                ev.clientY < plotRect.top || ev.clientY > plotRect.bottom) {
                return;
            }
            pointerDownPos = { x: ev.clientX, y: ev.clientY };
            pointerDownButton = ev.button;  // 0=left, 1=middle, 2=right
            pointerDragged = false;
        };
        
        const handleWindowMouseUp = () => {
            if (isEmbeddingSelectionSuppressed()) {
                pointerDownPos = null;
                pointerDownButton = -1;
                pointerDragged = false;
                pendingClickedId = null;
                return;
            }
            if (is3d && pointerDownButton === 0 && !pointerDragged) {
                if (pendingClickedId) {
                    lastSelectionInteractionTs = Date.now();
                    queueSelectionUpdate(new Set([pendingClickedId]));
                } else if (!(isAdditiveMode || isSubtractMode || isIntersectMode)) {
                    lastSelectionInteractionTs = Date.now();
                    setTimeout(() => {
                        if (currentViewId !== 'Embeddings') return;
                        if (handlerEpoch !== embeddingSelectionHandlerEpoch) return;
                        if (isEmbeddingSelectionSuppressed()) return;
                        if (Date.now() < embeddingIgnoreBgClicksUntil) return;
                        setActiveEmbeddingSelection(new Set());
                        applyEmbeddingSelectionStyling(plotEl, ids);
                        applyEmbeddingsSelectionToGraphNodes();
                        refreshInfoBoxFromSelection();
                    }, 0);
                }
            }
            pendingClickedId = null;
            pointerDownPos = null;
            pointerDownButton = -1;
            pointerDragged = false;
        };

        // Remove old handlers if they exist
        if (plotEl.__embeddingWindowDragListener) {
            window.removeEventListener('mousemove', plotEl.__embeddingWindowDragListener);
        }
        if (plotEl.__embeddingWindowDownListener) {
            window.removeEventListener('mousedown', plotEl.__embeddingWindowDownListener);
        }
        if (plotEl.__embeddingWindowUpListener) {
            window.removeEventListener('mouseup', plotEl.__embeddingWindowUpListener);
        }

        plotEl.__embeddingWindowDragListener = detectDragOnWindow;
        plotEl.__embeddingWindowDownListener = handleWindowMouseDown;
        plotEl.__embeddingWindowUpListener = handleWindowMouseUp;
        
        window.addEventListener('mousemove', detectDragOnWindow);
        window.addEventListener('mousedown', handleWindowMouseDown);
        window.addEventListener('mouseup', handleWindowMouseUp);

        const queueSelectionUpdate = (pointIds) => {
            setTimeout(() => {
                if (handlerEpoch !== embeddingSelectionHandlerEpoch) return;
                updateEmbeddingSelectionFromPointIds(pointIds, ids, plotEl);
            }, 0);
        };
        if (typeof plotEl.removeAllListeners === 'function') {
            plotEl.removeAllListeners('plotly_selected');
            plotEl.removeAllListeners('plotly_click');
            plotEl.removeAllListeners('plotly_deselect');
        }

        if (!is3d) {
            plotEl.on('plotly_selected', (eventData) => {
                const selectedIds = new Set((eventData?.points || []).map(p => p?.text).filter(Boolean));
                lastSelectionInteractionTs = Date.now();
                queueSelectionUpdate(selectedIds);
            });
        }

        // 2D commits selection on plotly_click (which fires on release); 3D defers commit to mouseup.
        plotEl.on('plotly_click', (eventData) => {
            const hasPoints = eventData?.points && eventData.points.length > 0;
            const clickedId = hasPoints ? eventData.points[0]?.text : null;
            
            if (is3d) {
                if (pointerDownButton !== 0) {
                    return;
                }
                pendingClickedId = clickedId || null;
                return;
            }
            
            // Ignore if: right/middle click, or drag operation
            if (pointerDownButton !== 0 || pointerDragged) {
                return;
            }
            
            if (!clickedId) {
                return;
            }
            
            lastSelectionInteractionTs = Date.now();
            queueSelectionUpdate(new Set([clickedId]));
        });

        if (!is3d) {
            plotEl.on('plotly_deselect', () => {
                if (isEmbeddingSelectionSuppressed()) return;
                if (isAdditiveMode || isSubtractMode || isIntersectMode) return;
                setTimeout(() => {
                    if (currentViewId !== 'Embeddings') return;
                    if (handlerEpoch !== embeddingSelectionHandlerEpoch) return;
                    if (isEmbeddingSelectionSuppressed()) return;
                    if (Date.now() < embeddingIgnoreBgClicksUntil) return;
                    embeddingSelectionClearIntent = true;
                    try {
                        setActiveEmbeddingSelection(new Set());
                        applyEmbeddingSelectionStyling(plotEl, ids);
                        applyEmbeddingsSelectionToGraphNodes();
                        refreshInfoBoxFromSelection();
                    } finally {
                        embeddingSelectionClearIntent = false;
                    }
                }, 0);
            });
        }

        if (plotEl.__embeddingBgClickHandler) {
            plotEl.removeEventListener('click', plotEl.__embeddingBgClickHandler);
        }
        if (!is3d) {
            const bgClickHandler = () => {
                if (isEmbeddingSelectionSuppressed()) return;
                if (Date.now() < embeddingIgnoreBgClicksUntil) return;
                if (pointerDragged || pointerDownButton !== 0) return;
                const elapsed = Date.now() - lastSelectionInteractionTs;
                if (elapsed < 120) return;
                setTimeout(() => {
                    if (currentViewId !== 'Embeddings') return;
                    if (handlerEpoch !== embeddingSelectionHandlerEpoch) return;
                    if (isEmbeddingSelectionSuppressed()) return;
                    if (Date.now() < embeddingIgnoreBgClicksUntil) return;
                    if (isAdditiveMode || isSubtractMode || isIntersectMode) return;
                    embeddingSelectionClearIntent = true;
                    try {
                        setActiveEmbeddingSelection(new Set());
                        applyEmbeddingSelectionStyling(plotEl, ids);
                        applyEmbeddingsSelectionToGraphNodes();
                        refreshInfoBoxFromSelection();
                    } finally {
                        embeddingSelectionClearIntent = false;
                    }
                }, 0);
            };
            plotEl.__embeddingBgClickHandler = bgClickHandler;
            plotEl.addEventListener('click', bgClickHandler);
        }
    }

    // This function applies the current embedding point selection to the graph nodes, ensuring that the selected points in the embedding view correspond to selected nodes in the graph. 
    function applyEmbeddingsSelectionToGraphNodes(force = false) {
        if (!force && currentViewId !== 'Embeddings') return;

        const selectedEmbeddingIds = getActiveEmbeddingSelectionSet();
        if (!selectedEmbeddingIds || selectedEmbeddingIds.size === 0) {
            deselectNodes();
            return;
        }

        const lookup = buildEmbeddingNodeLookup();
        const matched = [];
        selectedEmbeddingIds.forEach(rawId => {
            const node = resolveEmbeddingIdToNode(rawId, lookup);
            if (node) matched.push(node);
        });

        if (!matched.length) {
            deselectNodes();
            return;
        }

        const unique = Array.from(new Map(matched.map(n => [n.id, n])).values());
        selectNodes(unique, false, `Embeddings ${embeddingViewType} selection`);
    }

    // This function retrieves the marker colors for the embedding points based on the current color mode (layer or collection) and the corresponding node colors. It uses a suffix map to allow flexible matching of embedding point IDs to graph nodes, supporting cases where IDs may have prefixes or suffixes.
    function getEmbeddingMarkerColors(ids) {
        console.log("function getEmbeddingMarkerColors()");
        const mode = document.getElementById('colorMode')?.value || 'layer';
        const nowMs = Date.now();
        const defaultColor = '#58b8ff';
        const suffixMap = new Map();
        const prefixHint = (nodes.find(n => /^\d+\./.test(String(n.id || '')))?.id || '').split('.')[0];

        // Build a suffix map for quick lookup of nodes by their ID suffixes
        nodes.forEach(n => {
            const sid = String(n.id || '');
            const suffix = sid.includes('.') ? sid.split('.').slice(1).join('.') : sid;
            if (!suffixMap.has(suffix)) suffixMap.set(suffix, n);
        });

        // Function to determine the color for a given node object based on the current mode
        const colorForNode = (nodeObj) => {
            if (!nodeObj) return defaultColor;
            return mode === 'collection' ? getCollectionColorForNode(nodeObj.id, nowMs) : (nodeObj.col || defaultColor);
        };

        // Map each ID to its corresponding node color, using the suffix map and prefix hint for flexible matching
        return ids.map(rawId => {
            const id = String(rawId || '').trim();
            let n = nodeMap.get(id);
            if (!n && id.includes('.')) {
                n = suffixMap.get(id.split('.').slice(1).join('.')) || null;
            }
            if (!n && prefixHint && !id.includes('.')) {
                n = nodeMap.get(`${prefixHint}.${id}`) || suffixMap.get(id) || null;
            }
            if (!n) n = suffixMap.get(id) || null;
            return colorForNode(n);
        });
    }

    // This function computes the border colors for the embedding markers by taking the fill colors and applying a brightening transformation. 
    function getEmbeddingMarkerBorderColors(fillColors) {
        console.log("function getEmbeddingMarkerBorderColors()");
        return (fillColors || []).map(c => {
            const color = d3.color(c);
            return color ? color.brighter(0.9).formatHex() : '#d0d0d0';
        });
    }

    // This function checks if the full network build is complete by verifying that the node map has been populated with all expected nodes based on the list of all IDs. 
    function isFullNetworkBuildComplete() {
        console.log("function isFullNetworkBuildComplete()");
        if (isBuilding || isPaused) return false;
        if (!Array.isArray(allIDs) || allIDs.length === 0) return false;
        return nodeMap.size >= allIDs.length;
    }

    // This function updates the visibility and state of the embedding controls based on the current view and embedding data availability. 
    function updateEmbeddingsControls() {
        console.log("function updateEmbeddingsControls()");
        const controls = document.getElementById('embeddings-controls');
        const view = document.getElementById('embeddings-view');
        const networkBtn = document.getElementById('embeddingTypeNetwork');
        const sequenceBtn = document.getElementById('embeddingTypeSequence');
        const dim2dBtn = document.getElementById('embeddingDim2d');
        const dim3dBtn = document.getElementById('embeddingDim3d');
        const pngBtn = document.getElementById('embeddings-download-png');
        if (!controls || !view) return;

        const isEmbeddingsView = currentViewId === 'Embeddings';
        controls.style.display = isEmbeddingsView ? 'block' : 'none';
        view.style.display = isEmbeddingsView ? 'block' : 'none';

        if (networkBtn) networkBtn.classList.toggle('active', embeddingViewType === 'network');
        if (sequenceBtn) sequenceBtn.classList.toggle('active', embeddingViewType === 'sequence');
        if (dim2dBtn) dim2dBtn.classList.toggle('active', embeddingUmapDimension === '2d');
        if (dim3dBtn) dim3dBtn.classList.toggle('active', embeddingUmapDimension === '3d');

        if (pngBtn) {
            const canDownload = !!(embeddingDataByType[embeddingViewType] || null);
            pngBtn.disabled = !canDownload;
            pngBtn.title = canDownload ? '' : 'Load an embedding to enable PNG export';
        }

        embeddingLastControlsKey = `${currentViewId}|${embeddingViewType}|${embeddingUmapDimension}|${!!embeddingDataByType[embeddingViewType]}`;
        embeddingControlsDirty = false;
    }

    // This function hides the embedding plot and related elements when the user navigates away from the Embeddings view or when there is no embedding data to display.
    function hideEmbeddingsPlot() {
        console.log("function hideEmbeddingsPlot()");
        const view = document.getElementById('embeddings-view');
        const empty = document.getElementById('embeddings-empty');
        if (view) view.style.display = 'none';
        if (empty) empty.style.display = 'none';
    }

    // This is the main function responsible for rendering the embedding plot using Plotly. 
    async function renderEmbeddingsPlot(animate = false) {
        console.log("async function renderEmbeddingsPlot()");
        if (currentViewId !== 'Embeddings') {
            hideEmbeddingsPlot();
            return;
        }
        const plotEl = document.getElementById('embeddings-plot');
        const emptyEl = document.getElementById('embeddings-empty');
        const viewEl = document.getElementById('embeddings-view');
        if (!plotEl || !emptyEl || !viewEl || typeof Plotly === 'undefined') return;

        viewEl.style.display = 'block';

        const active = embeddingDataByType[embeddingViewType] || null;
        if (!active) {
            emptyEl.textContent = embeddingViewType === 'network'
                ? 'Upload [taxonID].protein.network.embeddings.[version_number].h5 in Accessory Data to view a UMAP plot. Note that the STRING database does not store .h5 files for prokaryotes.'
                : 'Upload [taxonID].protein.sequence.embeddings.[version_number].h5 in Accessory Data to view a UMAP plot. Note that the STRING database does not store .h5 files for prokaryotes.';
            emptyEl.style.display = 'block';
            await Plotly.purge(plotEl);
            embeddingPlotReady = false;
            embeddingLastRenderKey = '';
            return;
        }

        const points = getEmbeddingRenderPoints(active, embeddingUmapDimension);
        if (!points || !points.x || !points.x.length) {
            emptyEl.textContent = 'No embedding points are available for plotting.';
            emptyEl.style.display = 'block';
            await Plotly.purge(plotEl);
            embeddingPlotReady = false;
            embeddingLastRenderKey = '';
            return;
        }

        emptyEl.style.display = 'none';

        const ids = active.ids || points.x.map((_, i) => `row_${i}`);
        const markerColors = getEmbeddingMarkerColors(ids);
        const markerBorderColors = getEmbeddingMarkerBorderColors(markerColors);
        const panelBg = document.getElementById('bgColor')?.value || '#1a1a1a';
        const baseMarker = {
            size: embeddingUmapDimension === '3d' ? 4 : 7,
            color: markerColors,
            opacity: 0.95,
            line: {
                width: embeddingUmapDimension === '3d' ? 0.55 : 1.0,
                color: markerBorderColors
            }
        };

        const title = `${embeddingViewType === 'network' ? 'Network' : 'Sequence'} Embeddings UMAP (${embeddingUmapDimension.toUpperCase()})`;
        const renderKey = `${embeddingViewType}|${embeddingUmapDimension}|${active.fileName}|${points.x.length}`;
        const selectedPointIndices = getEmbeddingSelectedPointIndices(ids);

        if (embeddingUmapDimension === '3d') {
            const preservedCamera = plotEl?._fullLayout?.scene?.camera
                ? JSON.parse(JSON.stringify(plotEl._fullLayout.scene.camera))
                : null;
            const trace3d = {
                type: 'scatter3d',
                mode: 'markers',
                x: points.x,
                y: points.y,
                z: points.z,
                marker: baseMarker,
                text: ids,
                hovertemplate: 'ID: %{text}<extra></extra>'
            };
            const layout3d = {
                title: { text: title, font: { color: '#f0f0f0', size: 15 } },
                uirevision: `${embeddingViewType}|${embeddingUmapDimension}`,
                paper_bgcolor: panelBg,
                plot_bgcolor: panelBg,
                margin: { l: 34, r: 34, t: 52, b: 34 },
                scene: {
                    camera: preservedCamera || undefined,
                    bgcolor: panelBg,
                    xaxis: { title: 'UMAP-1', color: '#ccc', gridcolor: 'rgba(255,255,255,0.12)' },
                    yaxis: { title: 'UMAP-2', color: '#ccc', gridcolor: 'rgba(255,255,255,0.12)' },
                    zaxis: { title: 'UMAP-3', color: '#ccc', gridcolor: 'rgba(255,255,255,0.12)' }
                }
            };
            await Plotly.react(plotEl, [trace3d], layout3d, { responsive: true, displaylogo: false, scrollZoom: true });
            bindEmbeddingSelectionHandlers(plotEl, ids);
            await applyEmbeddingSelectionStyling(plotEl, ids);
            embeddingLastInteractionKey = '';
            await updateEmbeddingInteractionMode(plotEl);
            embeddingPlotReady = true;
            embeddingLastRenderKey = renderKey;
            embeddingLastRenderType = embeddingViewType;
            embeddingLastRenderDim = embeddingUmapDimension;
            embeddingPlotDirty = false;
            return;
        }

        const trace2d = {
            type: 'scatter',
            mode: 'markers',
            x: points.x,
            y: points.y,
            marker: baseMarker,
            selectedpoints: selectedPointIndices,
            text: ids,
            hovertemplate: 'ID: %{text}<extra></extra>'
        };
        const layout2d = {
            title: { text: title, font: { color: '#f0f0f0', size: 15 } },
            uirevision: `${embeddingViewType}|${embeddingUmapDimension}`,
            paper_bgcolor: panelBg,
            plot_bgcolor: panelBg,
            margin: { l: 328, r: 328, t: 52, b: 106 },
            xaxis: { title: 'UMAP-1', color: '#ccc', gridcolor: 'rgba(255,255,255,0.12)', zeroline: false },
            yaxis: { title: 'UMAP-2', color: '#ccc', gridcolor: 'rgba(255,255,255,0.12)', zeroline: false }
        };

        const canAnimateSwitch = embeddingPlotReady
            && embeddingLastRenderDim === '2d'
            && embeddingLastRenderType !== embeddingViewType
            && animate
            && plotEl.data
            && plotEl.data.length;

        if (!embeddingPlotReady || embeddingLastRenderDim !== '2d') {
            await Plotly.react(plotEl, [trace2d], layout2d, { responsive: true, displaylogo: false, scrollZoom: true });
        } else if (canAnimateSwitch) {
            await Plotly.relayout(plotEl, layout2d);
            await Plotly.animate(plotEl, {
                data: [{ x: points.x, y: points.y, text: ids }],
                traces: [0]
            }, {
                transition: { duration: 650, easing: 'cubic-in-out' },
                frame: { duration: 650, redraw: false }
            });
        } else {
            await Plotly.react(plotEl, [trace2d], layout2d, { responsive: true, displaylogo: false, scrollZoom: true });
        }

        bindEmbeddingSelectionHandlers(plotEl, ids);
        await applyEmbeddingSelectionStyling(plotEl, ids);
        embeddingLastInteractionKey = '';
        await updateEmbeddingInteractionMode(plotEl);

        embeddingPlotReady = true;
        embeddingLastRenderKey = renderKey;
        embeddingLastRenderType = embeddingViewType;
        embeddingLastRenderDim = embeddingUmapDimension;
        embeddingPlotDirty = false;
    }

    // This function refreshes the embedding plot view by checking if the controls or the plot need to be updated based on changes in the embedding data or user interactions. 
    async function refreshEmbeddingsView(animate = false) {
        if (currentViewId !== 'Embeddings') return;
        const controlKey = `${currentViewId}|${embeddingViewType}|${embeddingUmapDimension}|${!!embeddingDataByType[embeddingViewType]}`;
        if (embeddingControlsDirty || embeddingLastControlsKey !== controlKey) {
            updateEmbeddingsControls();
        }

        const renderKey = getEmbeddingRenderKey();
        if (embeddingPlotDirty || embeddingLastRenderKey !== renderKey) {
            if (embeddingRenderInFlight) return;
            embeddingRenderInFlight = true;
            try {
                await renderEmbeddingsPlot(animate);
            } finally {
                embeddingRenderInFlight = false;
            }
        }

        const plotEl = document.getElementById('embeddings-plot');
        if (plotEl && embeddingPlotReady) {
            await updateEmbeddingInteractionMode(plotEl);
        }
    }

    // This function generates a PNG image of the current embedding plot using Plotly's built-in image export functionality. It ensures that the current camera view is preserved for 3D plots and that the image is appropriately sized and named based on the embedding type and dimension.
    async function downloadEmbeddingPng() {
        console.log("async function downloadEmbeddingPng()");
        const plotEl = document.getElementById('embeddings-plot');
        if (!plotEl || !getActiveEmbeddingData() || typeof Plotly === 'undefined') return;
        if (embeddingUmapDimension === '3d') {
            const camera = plotEl?._fullLayout?.scene?.camera;
            if (camera) {
                await Plotly.relayout(plotEl, {
                    'scene.camera': JSON.parse(JSON.stringify(camera))
                });
            }
        }
        await Plotly.downloadImage(plotEl, {
            format: 'png',
            filename: `umap_${embeddingViewType}_${embeddingUmapDimension}_${Date.now()}`,
            width: 1900,
            height: 1200,
            scale: 1
        });
    }

    // This function removes the signature from the Voronoi background cache, effectively invalidating the cache and forcing a recomputation of the Voronoi background on the next render. 
    function invalidateVoronoiCache() {
        console.log("function invalidateVoronoiCache()");
        bgVoronoiCache.signature = '';
    }

    // This function computes a signature string that represents the current state of the Voronoi background, taking into account the number of nodes being drawn, the canvas dimensions, the current view transformation, and the node color mode. This signature is used to determine if the cached Voronoi background can be reused or if it needs to be recomputed.
    function getVoronoiSignature(drawNodes, nodeColorMode) {
        console.log("function getVoronoiSignature()");
        const len = drawNodes.length;
        const step = Math.max(1, Math.floor(len / 48));
        let sampleX = 0;
        let sampleY = 0;
        let sampleN = 0;
        for (let i = 0; i < len; i += step) {
            const n = drawNodes[i];
            sampleX += n.x || 0;
            sampleY += n.y || 0;
            sampleN++;
        }
        const inv = sampleN ? 1 / sampleN : 0;
        return [
            currentViewId,
            len,
            canvas.width,
            canvas.height,
            Math.round(transform.x / 14),
            Math.round(transform.y / 14),
            Math.round((transform.k || 1) * 36),
            Math.round(sampleX * inv / 16),
            Math.round(sampleY * inv / 16),
            nodeColorMode
        ].join('|');
    }

    // This function ensures that a Voronoi background layer is generated and cached for the embedding plot when the background mode is set to 'voronoi'. 
    function ensureVoronoiBackground(drawNodes, nodeColorMode, nowMs) {
        console.log("function ensureVoronoiBackground()");
        if (backgroundMode !== 'voronoi') return null;
        if (!Array.isArray(drawNodes) || drawNodes.length === 0) return null;
        if (!d3 || !d3.Delaunay) return null;

        const signature = getVoronoiSignature(drawNodes, nodeColorMode);
        const now = performance.now();
        const recentlyBuilt = (now - (bgVoronoiCache.lastBuildMs || 0)) < 120;
        if (bgVoronoiCache.canvas && bgVoronoiCache.signature === signature) {
            return bgVoronoiCache.canvas;
        }
        if (bgVoronoiCache.canvas && recentlyBuilt && physicsEnabled) {
            return bgVoronoiCache.canvas;
        }

        const aspect = Math.max(0.2, canvas.width / Math.max(1, canvas.height));
        const targetPixels = 145000;
        let h = Math.round(Math.sqrt(targetPixels / aspect));
        let w = Math.round(h * aspect);
        w = Math.max(140, Math.min(560, w));
        h = Math.max(140, Math.min(560, h));

        const layer = bgVoronoiCache.canvas || document.createElement('canvas');
        layer.width = w;
        layer.height = h;
        const lctx = layer.getContext('2d');
        if (!lctx) return null;

        const sx = w / Math.max(1, canvas.width);
        const sy = h / Math.max(1, canvas.height);
        const points = [];
        const colors = [];
        const screenMin = -0.5 * Math.max(canvas.width, canvas.height);
        const screenMaxX = canvas.width * 1.5;
        const screenMaxY = canvas.height * 1.5;

        drawNodes.forEach(n => {
            const nx = transform.applyX(n.x);
            const ny = transform.applyY(n.y);
            if (nx < screenMin || ny < screenMin || nx > screenMaxX || ny > screenMaxY) return;
            points.push([nx * sx, ny * sy]);
            colors.push(nodeColorMode === 'collection' ? getCollectionColorForNode(n.id, nowMs) : (n.col || '#4caf50'));
        });

        if (!points.length) return null;

        lctx.clearRect(0, 0, w, h);
        if (points.length === 1) {
            lctx.fillStyle = colors[0];
            lctx.fillRect(0, 0, w, h);
        } else {
            const delaunay = d3.Delaunay.from(points);
            const voronoi = delaunay.voronoi([0, 0, w, h]);
            for (let i = 0; i < points.length; i++) {
                const path = voronoi.renderCell(i);
                if (!path) continue;
                lctx.fillStyle = colors[i];
                lctx.fill(new Path2D(path));
            }
        }

        bgVoronoiCache.canvas = layer;
        bgVoronoiCache.signature = signature;
        bgVoronoiCache.lastBuildMs = now;
        return layer;
    }

    // This function retrieves the label to be displayed for a given link based on the current settings for link labels. 
    function getLinkLabelForLink(link) {
        console.log("function getLinkLabelForLink()");
        if (linkLabelToggle !== 'show' || !linkLabelField) return '';
        const edgeKey = getUndirectedEdgeKey(link?.source?.id, link?.target?.id);
        if (!edgeKey) return '';
        const meta = interactionLinkLabelValues.get(edgeKey);
        if (!meta) return '';
        const value = meta[linkLabelField];
        if (value === undefined || value === null) return '';
        return String(value).trim();
    }

    // This function retrieves the color palette to be used for coloring nodes based on their collection memberships. It currently uses D3's Tableau10 color scheme, which provides a set of 10 distinct colors suitable for categorical data.
    function getCollectionColorPalette() {
        console.log("function getCollectionColorPalette()");
        return d3.schemeTableau10;
    }

    // This function determines the color associated with a given collection name by mapping it to a color in the collection color palette. It uses the index of the collection name in the list of collection names to assign a consistent color, cycling through the palette if there are more collections than colors.
    function getCollectionColorByName(name) {
        console.log("function getCollectionColorByName()");
        const palette = getCollectionColorPalette();
        const names = Array.from(collections.keys());
        const idx = names.indexOf(name);
        if (idx < 0) return palette[0];
        return palette[idx % palette.length];
    }

    function getLocalizationColorScale(activeNodes, builtInColorSource = null) {
        const values = Array.from(new Set((activeNodes || [])
            .map(node => getBuiltInColorValueFromSource(node.id, 'localization', builtInColorSource))
            .map(value => String(value ?? '').trim())
            .filter(Boolean)))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const domain = values.length ? values : ['Unknown'];
        return d3.scaleOrdinal().domain(domain).range(d3.quantize(d3.interpolateRainbow, Math.max(domain.length, 1)));
    }

    // This function retrieves the list of collection names that a given node belongs to by checking the collections data structure for memberships. It iterates through all collections and checks if the node ID is part of each collection's node IDs set, accumulating the names of the collections that include the node.
    function getNodeCollectionMemberships(nodeId) {
        console.log("function getNodeCollectionMemberships()");
        const memberships = [];
        collections.forEach((coll, name) => {
            if (coll?.nodeIds?.has(nodeId)) memberships.push(name);
        });
        return memberships;
    }

    // This function determines the color to be used for a node when the node coloring mode is set to 'collection'. 
    function getCollectionColorForNode(nodeId, timestampMs = Date.now()) {
        console.log("function getCollectionColorForNode()");
        const memberships = getNodeCollectionMemberships(nodeId);
        if (!memberships.length) return '#444';
        const slot = Math.floor(timestampMs / 500);
        const activeName = memberships[slot % memberships.length];
        return getCollectionColorByName(activeName);
    }

    function ensureComplexPdbColorState() {
        if (!complexPdbColorStateDirty && complexPdbColorState) return complexPdbColorState;

        const pdbToNodeIds = new Map();
        proteinMetadata.forEach((meta, nodeId) => {
            const pdbIds = Array.from(new Set((Array.isArray(meta?.pdbIds) ? meta.pdbIds : [])
                .map(id => String(id ?? '').trim())
                .filter(Boolean)));
            pdbIds.forEach(pdbId => {
                if (!pdbToNodeIds.has(pdbId)) pdbToNodeIds.set(pdbId, new Set());
                pdbToNodeIds.get(pdbId).add(nodeId);
            });
        });

        const complexPdbIds = Array.from(pdbToNodeIds.entries())
            .filter(([, nodeIds]) => nodeIds.size > 1)
            .map(([pdbId]) => pdbId)
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        const nodeToComplexPdbIds = new Map();
        proteinMetadata.forEach((meta, nodeId) => {
            const memberships = Array.from(new Set((Array.isArray(meta?.pdbIds) ? meta.pdbIds : [])
                .map(id => String(id ?? '').trim())
                .filter(Boolean)))
                .filter(pdbId => (pdbToNodeIds.get(pdbId)?.size || 0) > 1)
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            if (memberships.length) nodeToComplexPdbIds.set(nodeId, memberships);
        });

        complexPdbColorState = {
            complexPdbIds,
            nodeToComplexPdbIds,
            colorScale: d3.scaleOrdinal(d3.schemeTableau10).domain(complexPdbIds)
        };
        complexPdbColorStateDirty = false;
        return complexPdbColorState;
    }

    function getComplexPdbMemberships(nodeId) {
        return ensureComplexPdbColorState().nodeToComplexPdbIds.get(nodeId) || [];
    }

    function getComplexPdbColorForNode(nodeId, timestampMs = Date.now()) {
        const memberships = getComplexPdbMemberships(nodeId);
        if (!memberships.length) return '#444';
        const slot = Math.floor(timestampMs / 500);
        const activePdbId = memberships[slot % memberships.length];
        return ensureComplexPdbColorState().colorScale(activePdbId);
    }

    // Escape first so any user, AI, or file-derived text becomes inert before it is rendered anywhere in the UI.
    function escapeHtml(value) {
        // console.log("function escapeHtml()");
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // This function takes a string containing simple markdown syntax and converts it into HTML for rendering in the info box or other UI elements. It supports headers, bold text, inline code, bullet points, and line breaks.
    // Convert only already-escaped text into a tiny, known-safe markdown subset so untrusted input cannot create executable HTML.
    function buildSimpleMarkdownHtml(value) {
        const safeText = escapeHtml(value ?? '');
        return safeText
            .replace(/^##### (.+)$/gm, '<h5>$1</h5>')    
            .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/^\* (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.+<\/li>)(\n<li>.+<\/li>)*/gm, '<ul>$&</ul>')
            .replace(/\n/g, '<br>');
    }

    // This function renders LaTeX math expressions within a given HTML element using the KaTeX library. 
    function renderLatexInElement(el) {
        if (!el) return;
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(el, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false,
                strict: 'ignore'
            });
            return;
        }

        setTimeout(() => {
            if (typeof renderMathInElement === 'function') {
                renderMathInElement(el, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false,
                    strict: 'ignore'
                });
            }
        }, 60);
    }

    // This sink only receives escaped helper output, so the innerHTML assignment stays limited to inert, controlled markup.
    function applyMarkdownLatexContent(el, value) {
        if (!el) return;
        el.innerHTML = buildSimpleMarkdownHtml(value);
        renderLatexInElement(el);
    }

    // The function below runs even when node coloring is not set to 'collection', which is inefficient. We should check the color mode before calling this function.
    // This function determines the color for a node based on its collection memberships and the current time, creating a cycling effect through the collections it belongs to. If the node is not part of any collection, it returns a default color.
    function updateCollectionColorCycleTimer() {
        console.log("function updateCollectionColorCycleTimer()");
        
        const mode = document.getElementById('colorMode')?.value;
        if (mode === 'collection' || mode === 'complex_pdbs') {
            if (!collectionColorCycleTimer) {
                collectionColorCycleTimer = setInterval(() => draw(), 500);
            }
        } else if (collectionColorCycleTimer) {
            clearInterval(collectionColorCycleTimer);
            collectionColorCycleTimer = null;
        }
    }

    // This function calculates the eigenvector centrality scores for a subset of nodes and links, using an iterative approach. It constructs a local adjacency structure based on the provided nodes and links, and then repeatedly updates the centrality scores until they converge or a maximum number of iterations is reached. The resulting scores are normalized to the range [0, 1] for use in visualizations or further analysis.
    function calculateLocalEigenvectorCentrality(targetNodes, targetLinks, threshold) {
        console.log("function calculateLocalEigenvectorCentrality()");
        const ids = new Set(targetNodes.map(n => n.id));
        const scoreMap = new Map(targetNodes.map(n => [n.id, 1]));
        const neighbors = new Map(targetNodes.map(n => [n.id, []]));

        targetLinks.forEach(link => {
            if (link.value < threshold) return;
            const sid = link.source?.id;
            const tid = link.target?.id;
            if (!ids.has(sid) || !ids.has(tid)) return;
            neighbors.get(sid).push(tid);
            neighbors.get(tid).push(sid);
        });

        for (let i = 0; i < 20; i++) {
            const next = new Map();
            ids.forEach(id => {
                let sum = 0;
                (neighbors.get(id) || []).forEach(nb => {
                    sum += scoreMap.get(nb) || 0;
                });
                next.set(id, sum);
            });
            const maxVal = Math.max(...Array.from(next.values()), 0);
            if (maxVal <= 0) {
                ids.forEach(id => scoreMap.set(id, 0));
            } else {
                ids.forEach(id => scoreMap.set(id, (next.get(id) || 0) / maxVal));
            }
        }
        return scoreMap;
    }

    // This function retrieves the current frame rectangle in screen coordinates by applying the current view transformation to the frame's world coordinates. 
    function getFrameRect() {
        console.log("function getFrameRect()");
        if (!exportFrame) return null;
        // Project world coordinates to screen for rendering
        return {
            x: transform.applyX(exportFrame.x),
            y: transform.applyY(exportFrame.y),
            w: exportFrame.w * transform.k,
            h: exportFrame.h * transform.k
        };
    }

    // This function draws an overlay on the canvas to indicate the current export frame, including a semi-transparent darkening of the area outside the frame, a highlighted border around the frame, and handles at the corners for resizing. 
    function drawFrameOverlay() {
        console.log("function drawFrameOverlay()");
        if (!exportFrame) return;
        const rect = getFrameRect();

        // 1. Draw Grey Overlay
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        // Top
        ctx.fillRect(0, 0, canvas.width, rect.y);
        // Bottom
        ctx.fillRect(0, rect.y + rect.h, canvas.width, canvas.height - (rect.y + rect.h));
        // Left
        ctx.fillRect(0, rect.y, rect.x, rect.h);
        // Right
        ctx.fillRect(rect.x + rect.w, rect.y, canvas.width - (rect.x + rect.w), rect.h);

        // 2. Draw Frame Border
        ctx.strokeStyle = "#ff9800";
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

        // 3. Draw Handles (Circles for corners, Pills for edges)
        ctx.fillStyle = "white";
        // Simplified logic: Corner circles
        [[rect.x, rect.y], [rect.x+rect.w, rect.y], [rect.x, rect.y+rect.h], [rect.x+rect.w, rect.y+rect.h]].forEach(p => {
            ctx.beginPath();
            ctx.arc(p[0], p[1], 6, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // This function toggles the display of directional arrows on the links between nodes based on the provided enabled flag. It updates the UI to reflect the current state and triggers a redraw of the canvas to show or hide the link direction indicators accordingly.
    function setLinkDirection(enabled) {
        console.log("function setLinkDirection(enabled: " + enabled + ")");
        linkDirectionEnabled = !!enabled;
        document.getElementById('linkDirectionOn')?.classList.toggle('active', linkDirectionEnabled);
        document.getElementById('linkDirectionOff')?.classList.toggle('active', !linkDirectionEnabled);
        draw();
    }

    //The function below is running even when linkDirectionEnabled is false, which is inefficient. We should check the flag before calling this function.
    // This function calculates the position and orientation of an arrow to indicate the direction of a link between two nodes. It uses vector math to determine the unit direction vector, the midpoint of the link, and the perpendicular vector for the arrowhead. The arrow is then drawn as a filled triangle on the canvas.
    function drawLinkDirectionArrow(renderCtx, source, target, color, lineWidth) {
        //console.log("function drawLinkDirectionArrow()"); <-- This runs a lot during building
        if (!linkDirectionEnabled || !source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (!isFinite(len) || len < 1e-6) return;

        const ux = dx / len;
        const uy = dy / len;
        const mx = source.x + dx * 0.5;
        const my = source.y + dy * 0.5;
        const arrowLen = Math.max(9, lineWidth * 5);
        const arrowHalfWidth = Math.max(4, lineWidth * 2.4);

        const tipX = mx + ux * arrowLen * 0.5;
        const tipY = my + uy * arrowLen * 0.5;
        const baseX = mx - ux * arrowLen * 0.5;
        const baseY = my - uy * arrowLen * 0.5;
        const perpX = -uy;
        const perpY = ux;

        renderCtx.beginPath();
        renderCtx.moveTo(tipX, tipY);
        renderCtx.lineTo(baseX + perpX * arrowHalfWidth, baseY + perpY * arrowHalfWidth);
        renderCtx.lineTo(baseX - perpX * arrowHalfWidth, baseY - perpY * arrowHalfWidth);
        renderCtx.closePath();
        renderCtx.fillStyle = color;
        renderCtx.fill();
    }

    function getCurrentNodeLabelZoomAlpha() {
        if (nodeVisibilityToggle !== 'show' || nodeLabelToggle !== 'show') return 0;
        const zoomStart = 1.0;
        const zoomEnd = 1.3;
        const k = transform?.k || 1;
        if (k <= zoomStart) return 0;
        if (k >= zoomEnd) return 1;
        return (k - zoomStart) / (zoomEnd - zoomStart);
    }

    // This function captures the current view of the network within the defined export frame and either downloads it as a PNG image or copies it to the clipboard, depending on the specified type. It creates an offscreen canvas, applies the necessary transformations to align with the export frame, renders the network data at a high resolution, and then executes the desired action based on the type parameter.
    async function captureFrame(type) {
        console.log("function captureFrame(type: " + type + ")");
        if (!exportFrame) {
            alert("Please draw a frame first.");
            return;
        }

        // 1. Determine dimensions based on targetResolution (longest edge)
        const frameW = Math.abs(exportFrame.w);
        const frameH = Math.abs(exportFrame.h);
        const isHorizontal = frameW >= frameH;
        
        // Calculate scale factor to reach 2k/4k/8k on the longest side
        const scaleFactor = targetResolution / (isHorizontal ? frameW : frameH);
        
        const exportW = frameW * scaleFactor;
        const exportH = frameH * scaleFactor;

        // 2. Create offscreen canvas
        const offscreen = document.createElement('canvas');
        offscreen.width = exportW;
        offscreen.height = exportH;
        const octx = offscreen.getContext('2d');

        // 3. Set Background
        octx.fillStyle = document.getElementById('bgColor').value;
        octx.fillRect(0, 0, exportW, exportH);

        // 4. Transform "Camera" to the Frame's location
        octx.save();
        octx.scale(scaleFactor, scaleFactor);
        
        // Find the top-left corner (handles frames drawn in any direction)
        const minX = Math.min(exportFrame.x, exportFrame.x + exportFrame.w);
        const minY = Math.min(exportFrame.y, exportFrame.y + exportFrame.h);
        octx.translate(-minX, -minY);

        // 5. Render Network Data (Reusing your high-res logic)
        const threshold = +document.getElementById('thresholdInput').value;
        const linkMode = document.getElementById('linkMode').value;
        const linkWidthMultiplier = +document.getElementById('linkWidthSlider')?.value || 1;
        const isSearching = selectedNodes.size > 0;
        const drawNodes = currentViewId === 'base' ? nodes : activeSubData?.nodes || [];
        const drawLinks = currentViewId === 'base' ? links : activeSubData?.links || [];

        // Draw Links
        drawLinks.filter(l => l.value >= threshold).forEach(l => {
            const isHigh = isSearching && (selectedNodes.has(l.source.id) || selectedNodes.has(l.target.id));
            octx.beginPath(); 
            octx.moveTo(l.source.x, l.source.y); 
            octx.lineTo(l.target.x, l.target.y);
            let alpha = isSearching ? (isHigh ? linkOpacity : linkOpacity * 0.05) : linkOpacity;
            if (isGeneGeneLink(l)) alpha *= geneLinkOpacity;
            octx.globalAlpha = alpha;
            octx.strokeStyle = linkMode === 'score' ? d3.interpolateGreys((l.value - 200) / 800) : document.getElementById('linkColor').value;
            octx.lineWidth = ((linkMode === 'score' ? Math.sqrt(l.value) / 8 : 1) * (isHigh ? 2 : 1)) * linkWidthMultiplier;
            octx.stroke();
        });

        // Draw Nodes
        drawNodes.forEach(n => {
            const isHigh = isSearching && selectedNodes.has(n.id);
            octx.globalAlpha = isHigh ? 1 : (isSearching ? 0.1 : 1);
            octx.beginPath(); 
            octx.arc(n.x, n.y, n.r, 0, 2 * Math.PI); 
            octx.fillStyle = n.col; 
            octx.fill();
            octx.strokeStyle = d3.color(n.col).brighter(1); 
            octx.lineWidth = 1; 
            octx.stroke();
        });

        const labelZoomAlpha = getCurrentNodeLabelZoomAlpha();
        if (labelZoomAlpha > 0 && nodeVisibilityToggle === 'show') {
            const screenBg = document.getElementById('bgColor')?.value || '#1a1a1a';
            octx.save();
            octx.font = `bold 5px Arial`;
            octx.textAlign = 'center';
            octx.textBaseline = 'middle';
            octx.fillStyle = '#ffffff';
            octx.shadowColor = screenBg;
            octx.shadowBlur = 8;
            drawNodes.forEach(n => {
                const label = getNodeLabelText(n);
                if (!label) return;
                const isHigh = isSearching && selectedNodes.has(n.id);
                const nodeAlpha = isHigh ? 1 : (isSearching ? 0.1 : 1);
                octx.globalAlpha = nodeAlpha * labelZoomAlpha;
                octx.fillText(label, n.x, n.y);
            });
            octx.globalAlpha = 1;
            octx.shadowBlur = 0;
            octx.restore();
        }

        octx.restore();

        drawStringScapeLogoOnCanvas(octx, exportW, exportH);

        // 6. Execute Action
        if (type === 'download') {
            const link = document.createElement('a');
            link.download = `StringScape_Frame_${Date.now()}.png`;
            link.href = offscreen.toDataURL('image/png', 1.0);
            link.click();
        } else if (type === 'copy') {
            offscreen.toBlob(async (blob) => {
                try {
                    const item = new ClipboardItem({ "image/png": blob });
                    await navigator.clipboard.write([item]);
                    alert("Frame copied to clipboard!");
                } catch (err) {
                    alert("Clipboard failed. Use Download instead.");
                }
            });
        }
    }

    // This function handles the resizing of the canvas element when the window size changes. It updates the canvas dimensions based on the device pixel ratio, ensures that GPU buffers are resized if necessary, and triggers a redraw of the canvas. Additionally, it resizes the embedding plot if it is currently active.
    function resize() {
        console.log("function resize()");
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ensureGpuCanvasSize();
        if (window.gpuState) window.gpuState.needsResize = true;
        ctx.scale(dpr, dpr);
        draw();
        if (currentViewId === 'Embeddings' && typeof Plotly !== 'undefined') {
            const plotEl = document.getElementById('embeddings-plot');
            if (plotEl) Plotly.Plots.resize(plotEl);
        }
    }
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resize(); 
        }, 50); // 250ms delay is usually the "sweet spot"
    });
    resize();

    // This function determines whether a given link is a gene-gene link based on its edge type.
    function isGeneGeneLink(link) {
        return link?.edgeType === 'gene-gene';
    }

    // This function calculates the appropriate link distance for the force-directed layout based on the type of link and a base distance value. Gene-gene links are given a shorter distance to reflect their stronger relationship, while other links use the base distance.
    function getLinkDistanceForForce(link, baseDistance) {
        const base = Number.isFinite(+baseDistance) ? +baseDistance : 70;
        if (isGeneGeneLink(link)) return Math.max(8, base * 0.18);
        return base;
    }

    // This function calculates the strength of the link forces for the force-directed layout based on the type of link. Gene-gene links are given a stronger force to reflect their stronger relationship, while other links use a default strength.
    function getLinkStrengthForForce(link) {
        return isGeneGeneLink(link) ? 2.8 : 1;
    }

    // This function generates a pseudo-random unit value in the range [0, 1] based on a hash of the input string. This can be used for consistent color generation or other purposes where a deterministic random value is needed based on a string input.
    function hashStringToUnit(value) {
        let hash = 2166136261;
        const text = String(value ?? '');
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return ((hash >>> 0) % 256) / 255;
    }

    // This function clamps a given value to the range [0, 1]. 
    function clamp01(value) {
        return Math.max(0, Math.min(1, value));
    }

    // This var declaration initializes the gpuState object on the window, which is used to track the state of WebGPU support, initialization, and resources for GPU-accelerated physics simulations. It includes properties for tracking support status, device and adapter information, buffers for nodes and links, and flags for when uploads or resizes are needed.
    var gpuState = window.gpuState || {
        supported: false,
        initializing: false,
        ready: false,
        resizingBuffers: false,
        lastBufferResizeTime: 0,
        device: null,
        adapter: null,
        context: null,
        format: null,
        computePipeline: null,
        computeBindGroupLayout: null,
        nodeBuffer: null,
        nodeBufferAlt: null,
        linkBuffer: null,
        uniformBuffer: null,
        readbackBuffer: null,
        nodeCapacity: 0,
        linkCapacity: 0,
        needsUpload: true,
        needsResize: true,
        lastSignature: ''
    };
    window.gpuState = gpuState;

    // This function generates a signature string that represents the current state of the nodes and links being used for GPU-accelerated physics simulations. 
    function makeNodeGpuSignature(targetNodes, targetLinks, threshold) {
        const attraction = +document.getElementById('attractionSlider')?.value || 70;
        return `${targetNodes.length}|${targetLinks.length}|${threshold}|${attraction}|${window.innerWidth}|${window.innerHeight}|${document.getElementById('colorMode')?.value || 'layer'}`;
    }

    // This function restarts the physics simulation for the active view (either the base view or a subgraph view) by setting the alpha value and restarting the simulation. 
    function restartActivePhysics(alpha = null) {
        if (!canPhysicsRun()) return;
        if (gpuState.ready && currentViewId === 'base') {
            gpuState.needsUpload = true;
            ensureGpuAnimationLoop(alpha);
            return;
        }
        const sim = currentViewId === 'base' ? simulation : activeSubData?.simulation;
        if (sim && canPhysicsRun()) {
            const startAlpha = alpha ?? ((isBuilding || isSettling) ? 0.5 : +document.getElementById('alphaSlider').value);
            sim.alpha(startAlpha).restart();
        }
    }

    // This function uploads the node data to the GPU for physics simulations, calculating the appropriate radius and color for each node based on the current settings and modes. It also computes embedding similarity scores if the mode is set to 'embeddings', and applies the corresponding colors based on those scores.
    function uploadNodeGpuStyles(targetNodes, mode, cRange, sRange, eRange, monoCol) {
        const nowMs = Date.now();
        const cMin = cRange?.[0] ?? 0;
        const cSpan = (cRange?.[1] - cMin) || 1;
        const sMin = sRange?.[0] ?? 0;
        const sSpan = (sRange?.[1] - sMin) || 1;
        const eMin = eRange?.[0] ?? 0;
        const eSpan = (eRange?.[1] - eMin) || 1;
        const catScale = d3.scaleOrdinal(d3.schemeTableau10);
        const embeddingState = mode === 'embeddings' ? computeEmbeddingSimilarityState(targetNodes) : null;
        const embeddingVectorsByNode = mode === 'embeddings' ? getEmbeddingVectorsByNodeForType(embeddingColorSimilarityType) : null;
        const embMin = embeddingState?.min ?? -1;
        const embMax = embeddingState?.max ?? 1;
        const embSpanRaw = embMax - embMin;
        const embSpan = embSpanRaw || 1;
        const embIsFallbackNoReference = !!embeddingState?.isFallbackNoReference;
        const builtInColorSource = (mode === 'annotation' || mode === 'localization')
            ? resolveBuiltInColorSource(mode, targetNodes)
            : null;
        const localizationScale = mode === 'localization'
            ? getLocalizationColorScale(targetNodes, builtInColorSource)
            : null;
        const complexPdbState = mode === 'complex_pdbs' ? ensureComplexPdbColorState() : null;
        const complexPdbScale = complexPdbState?.colorScale || d3.scaleOrdinal(d3.schemeTableau10);
        const proteinSizeSource = resolveProteinSizeSource(targetNodes);
        const annotationMinMax = mode === 'annotation'
            ? d3.extent(targetNodes, n => getAnnotationLengthFromSource(n.id, builtInColorSource))
            : null;
        const annotationMin = annotationMinMax?.[0] ?? 0;
        const annotationSpan = (annotationMinMax?.[1] - annotationMin) || 1;
        const pdbCounts = mode === 'pdb_structure_count'
            ? targetNodes.map(n => getPdbStructureCount(n.id))
            : null;
        const pdbMin = pdbCounts?.length ? Math.min(...pdbCounts) : 0;
        const pdbMax = pdbCounts?.length ? Math.max(...pdbCounts) : 1;
        const pdbSpan = (pdbMax - pdbMin) || 1;

        targetNodes.forEach(n => {
            const m = proteinMetadata.get(n.id) || { size: 0, annotation: 'Unknown', localization: 'Unknown' };
            const centralityVal = Number.isFinite(n.centrality) ? n.centrality : 0;
            const eigenVal = Number.isFinite(n.eigen) ? n.eigen : 0;
            const proteinSizeVal = getProteinSizeValue(n.id, proteinSizeSource);

            n.r = (6 * (+document.getElementById('nodeSizeSlider')?.value || 0))
                + (centralityVal * 0.5 * (+document.getElementById('sizeSlider')?.value || 0))
                + (eigenVal * 60 * (+document.getElementById('eigenSlider')?.value || 0))
                + ((proteinSizeVal / 500) * 4 * (+document.getElementById('proteinSizeSlider')?.value || 0));

            let colorValue = 0.5;
            if (mode === 'layer') {
                n.col = (n.layer === 99) ? '#888' : d3.interpolateViridis(1 - ((n.layer || 0) / 10));
                colorValue = clamp01(1 - ((n.layer || 0) / 10));
            } else if (mode === 'centrality') {
                const normalized = clamp01((centralityVal - cMin) / cSpan);
                n.col = d3.interpolateInferno(0.3 + 0.8 * normalized);
                colorValue = normalized;
            } else if (mode === 'eigen') {
                const normalized = clamp01((eigenVal - eMin) / eSpan);
                n.col = d3.interpolateInferno(0.3 + 0.8 * normalized);
                colorValue = normalized;
            } else if (mode === 'collection') {
                const color = getCollectionColorForNode(n.id, nowMs);
                const paletteIndex = d3.schemeTableau10.indexOf(color);
                n.col = color;
                colorValue = clamp01((paletteIndex >= 0 ? paletteIndex : 0) / 9);
            } else if (mode === 'size') {
                const normalized = clamp01((proteinSizeVal - sMin) / sSpan);
                n.col = d3.interpolateCool(normalized);
                colorValue = normalized;
            } else if (mode === 'embeddings') {
                const sim = embeddingState?.scores?.get(n.id);
                const hasEmbedding = !!embeddingVectorsByNode?.has(n.id);
                if (!hasEmbedding) {
                    n.col = '#666';
                    colorValue = 0.5;
                } else if (Number.isFinite(sim)) {
                    if (embIsFallbackNoReference) {
                        n.col = getEmbeddingSimilarityColor(sim);
                        colorValue = clamp01((clampCosine(sim) + 1) / 2);
                    } else {
                        n.col = getEmbeddingSimilarityColorByRange(sim, embMin, embMax);
                        colorValue = embSpanRaw > 1e-12 ? clamp01((sim - embMin) / embSpanRaw) : 1;
                    }
                } else {
                    n.col = '#333';
                    colorValue = 0.5;
                }
            } else if (mode === 'annotation') {
                const annLen = getAnnotationLengthFromSource(n.id, builtInColorSource);
                const normalized = clamp01((annLen - annotationMin) / annotationSpan);
                n.col = d3.interpolatePlasma(normalized);
                colorValue = normalized;
            } else if (mode === 'pdb_structure_count') {
                const pdbCount = getPdbStructureCount(n.id);
                const normalized = clamp01((pdbCount - pdbMin) / pdbSpan);
                n.col = d3.interpolateCool(normalized);
                colorValue = normalized;
            } else if (mode === 'complex_pdbs') {
                const memberships = getComplexPdbMemberships(n.id);
                if (!memberships.length) {
                    n.col = '#444';
                    colorValue = 0.5;
                } else {
                    const activePdbId = memberships[Math.floor(nowMs / 500) % memberships.length];
                    n.col = complexPdbScale(activePdbId);
                    colorValue = hashStringToUnit(activePdbId);
                }
            } else if (mode === 'localization') {
                const raw = getBuiltInColorValueFromSource(n.id, mode, builtInColorSource);
                n.col = localizationScale(raw);
                colorValue = hashStringToUnit(raw);
            } else if (mode === 'biological_process') {
                const raw = getBiologicalProcessKey(n.id);
                n.col = catScale(raw);
                colorValue = hashStringToUnit(raw);
            } else if (mode && mode.startsWith('var::')) {
                const modeParts = String(mode).split('::');
                const file = modeParts[1], variable = modeParts[2];
                const childMode = modeParts[3] === 'child' ? modeParts[4] : null;
                const cfg = variableConfigs.find(c => c.fileName === file && c.variable === variable);
                const valueField = childMode && cfg?.splitBase ? cfg.splitBase : variable;
                const rawValue = accessoryVariableValues[file]?.[valueField]?.get(n.id);
                if (!cfg || rawValue === undefined || rawValue === null) {
                    n.col = monoCol;
                    colorValue = 0.5;
                } else {
                    const type = cfg.type || 'Categorical - Nominal';
                    const childCfg = childMode ? (cfg.splitChildren?.[childMode] || {}) : null;
                    const effectiveType = childCfg?.type || type;
                    const allValues = targetNodes.map(node => accessoryVariableValues[file]?.[valueField]?.get(node.id)).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
                    const numericValues = allValues.map(v => +v).filter(v => !isNaN(v));
                    const uniqueValues = Array.from(new Set(allValues));
                    const sortedValues = [...uniqueValues].sort((a, b) => {
                        const na = +a, nb = +b;
                        if (!isNaN(na) && !isNaN(nb)) return na - nb;
                        return String(a).localeCompare(String(b), undefined, { numeric: true });
                    });
                    const valueScale = d3.scaleOrdinal(d3.schemeTableau10).domain(sortedValues);
                    const matches = !childMode || String(rawValue).trim() === childMode;
                    if (!matches) {
                        n.col = monoCol;
                        colorValue = 0.5;
                    } else if (effectiveType === 'Numerical - Continuous') {
                        const minv = d3.min(numericValues) || 0;
                        const maxv = d3.max(numericValues) || 1;
                        const normalized = isNaN(+rawValue) ? 0.5 : clamp01((+rawValue - minv) / ((maxv - minv) || 1));
                        n.col = d3.interpolateInferno(normalized);
                        colorValue = normalized;
                    } else if (effectiveType === 'Numerical - Discrete' || effectiveType === 'Categorical - Ordinal') {
                        const paletteIndex = d3.schemeTableau10.indexOf(valueScale(rawValue));
                        n.col = valueScale(rawValue);
                        colorValue = clamp01((paletteIndex >= 0 ? paletteIndex : 0) / 9);
                    } else {
                        n.col = catScale(rawValue || 'Unknown');
                        colorValue = hashStringToUnit(rawValue || 'Unknown');
                    }
                }
            } else if (mode === 'random') {
                n.col = n.randColor || '#fff';
                colorValue = hashStringToUnit(n.id);
            } else {
                n.col = monoCol;
                colorValue = 0.5;
            }

            n.gpuColorValue = clamp01(colorValue);
        });
    }

    // This function ensures that the WebGPU context and resources are initialized and ready for use. It checks for support, requests the necessary adapter and device, configures the canvas context, and sets up the compute shader for physics simulations. If any step fails, it updates the state accordingly and updates the UI to reflect the lack of GPU support.
    async function initWebGPU() {
        if (gpuState.initializing || gpuState.ready) return;
        if (!navigator.gpu) {
            gpuState.supported = false;
            gpuState.ready = false;
            updatePhysicsRuntimeLabel();
            return;
        }
        gpuState.initializing = true;
        try {
            gpuState.adapter = await navigator.gpu.requestAdapter();
            if (!gpuState.adapter) {
                return;
            }
            gpuState.device = await gpuState.adapter.requestDevice();
            gpuState.context = gpuCanvas.getContext('webgpu');
            if (!gpuState.context) {
                return;
            }
            gpuState.format = navigator.gpu.getPreferredCanvasFormat();
            gpuState.context.configure({ device: gpuState.device, format: gpuState.format, alphaMode: 'premultiplied' });
                        const computeShader = gpuState.device.createShaderModule({
                                code: `struct NodeData { posVel: vec4<f32>, meta0: vec4<f32>, meta1: vec4<f32>, meta2: vec4<f32> };
struct LinkData { data: vec4<f32> };
struct Params { screen: vec4<f32>, transform: vec4<f32>, forces: vec4<f32>, counts: vec4<f32> };

@group(0) @binding(0) var<storage, read> inNodes: array<NodeData>;
@group(0) @binding(1) var<storage, read_write> outNodes: array<NodeData>;
@group(0) @binding(2) var<storage, read> links: array<LinkData>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) gid: vec3<u32>) {
  let index = gid.x;
  let nodeCount = u32(params.counts.x);
  let linkCount = u32(params.counts.y);
  if (index >= nodeCount) { return; }

    var node = inNodes[index];
  let fixed = node.meta0.w;
  if (fixed > 0.5) {
        let fixedPos = vec2<f32>(node.meta1.x, node.meta1.y);
        node.posVel = vec4<f32>(fixedPos, 0.0, 0.0);
        outNodes[index] = node;
    return;
  }

  var pos = node.posVel.xy;
  var vel = node.posVel.zw;
  let repulsion = params.forces.x;
  let attraction = params.forces.y;
    let drift = max(params.forces.z, 10.0);
    let alpha = max(params.forces.w, 0.001);

  for (var other: u32 = 0u; other < nodeCount; other = other + 1u) {
    if (other == index) { continue; }
        let otherNode = inNodes[other];
    let delta = pos - otherNode.posVel.xy;
        let distSqRaw = dot(delta, delta);
        if (distSqRaw > 1e-6) {
            let distSq = max(distSqRaw, 1.0);
            let forceScale = (repulsion * alpha) / distSq;
            vel = vel + delta * forceScale;
        }
  }

  for (var linkIndex: u32 = 0u; linkIndex < linkCount; linkIndex = linkIndex + 1u) {
    let link = links[linkIndex].data;
    if (link.x < 0.0 || link.y < 0.0) { continue; }
    let sourceIndex = u32(link.x);
    let targetIndex = u32(link.y);
    if (sourceIndex >= nodeCount || targetIndex >= nodeCount) { continue; }
    if (sourceIndex != index && targetIndex != index) { continue; }
    let otherIndex = select(sourceIndex, targetIndex, sourceIndex == index);
    let otherPos = inNodes[otherIndex].posVel.xy;
    let delta = otherPos - pos;
        let distSq = dot(delta, delta);
        if (distSq > 1e-6) {
            let dist = sqrt(distSq);
            let desired = max(link.z, 1.0);
            let sourceDeg = max(inNodes[sourceIndex].meta1.z, 1.0);
            let targetDeg = max(inNodes[targetIndex].meta1.z, 1.0);
            let bias = sourceDeg / (sourceDeg + targetDeg);
            let roleFactor = select(bias, 1.0 - bias, sourceIndex == index);
            let springScale = ((dist - desired) / dist) * link.w * roleFactor * alpha;
            vel = vel + delta * springScale;
        }
  }

    vel = vel * 0.6;
    
    let center = vec2<f32>(params.screen.x * 0.5, params.screen.y * 0.5);
    let toCenter = center - pos;
    let distToCenter = length(toCenter);
    
    pos = pos + vel;

    if (abs(pos.x - center.x) > drift) {
        pos.x = center.x + sign(pos.x - center.x) * drift;
        vel.x = 0.0;
    }
    if (abs(pos.y - center.y) > drift) {
        pos.y = center.y + sign(pos.y - center.y) * drift;
        vel.y = 0.0;
    }

    node.posVel = vec4<f32>(pos, vel);
    outNodes[index] = node;
}`
                        });

            gpuState.computeBindGroupLayout = gpuState.device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                    { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                    { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                    { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
                ]
            });

            const computePipelineLayout = gpuState.device.createPipelineLayout({ bindGroupLayouts: [gpuState.computeBindGroupLayout] });
            gpuState.computePipeline = gpuState.device.createComputePipeline({
                layout: computePipelineLayout,
                compute: { module: computeShader, entryPoint: 'computeMain' }
            });

            gpuState.nodeBuffer = gpuState.device.createBuffer({ size: 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
            gpuState.nodeBufferAlt = gpuState.device.createBuffer({ size: 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
            gpuState.linkBuffer = gpuState.device.createBuffer({ size: 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
            gpuState.uniformBuffer = gpuState.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            gpuState.readbackBuffer = gpuState.device.createBuffer({ size: 64, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
            gpuState.ready = true;
            gpuState.supported = true;
            gpuState.needsUpload = true;
            gpuState.needsResize = true;
            updatePhysicsRuntimeLabel();
            if (currentViewId === 'base') {
                simulation.stop();
            }
        } catch (error) {
            gpuState.ready = false;
            gpuState.supported = false;
            updatePhysicsRuntimeLabel();
        } finally {
            gpuState.initializing = false;
        }
    }

    // This function ensures that the canvas used for GPU rendering is sized correctly based on the current window dimensions and device pixel ratio.
    function ensureGpuCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        gpuCanvas.width = window.innerWidth * dpr;
        gpuCanvas.height = window.innerHeight * dpr;
    }

    // This function ensures that the GPU buffers used for physics simulations are appropriately sized based on the number of nodes and links in the current view. 
    function ensureGpuBuffers(targetNodes, targetLinks) {
        if (!gpuState.ready) return;
        const nodeStride = 16;
        const linkStride = 4;
        const nodeBytes = Math.max(1, targetNodes.length * nodeStride * 4);
        const linkBytes = Math.max(1, targetLinks.length * linkStride * 4);
        
        // Always resize if capacity is insufficient or if buffer is too small
        if (gpuState.nodeCapacity < targetNodes.length || (gpuState.nodeBuffer && gpuState.nodeBuffer.size < nodeBytes)) {
            gpuState.nodeCapacity = Math.max(targetNodes.length, 1);
            gpuState.nodeBuffer = gpuState.device.createBuffer({ size: Math.max(64, gpuState.nodeCapacity * nodeStride * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
            gpuState.nodeBufferAlt = gpuState.device.createBuffer({ size: Math.max(64, gpuState.nodeCapacity * nodeStride * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
            gpuState.readbackBuffer = gpuState.device.createBuffer({ size: Math.max(64, gpuState.nodeCapacity * nodeStride * 4), usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        }
        if (gpuState.linkCapacity < targetLinks.length || (gpuState.linkBuffer && gpuState.linkBuffer.size < linkBytes)) {
            gpuState.linkCapacity = Math.max(targetLinks.length, 1);
            gpuState.linkBuffer = gpuState.device.createBuffer({ size: Math.max(64, gpuState.linkCapacity * linkStride * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        }
        gpuState.needsUpload = gpuState.needsUpload
            || gpuState.needsResize
            || gpuState.nodeBuffer.size < nodeBytes
            || gpuState.nodeBufferAlt.size < nodeBytes
            || gpuState.linkBuffer.size < linkBytes;
    }

    // This function prepares the node and link data for upload to the GPU by packing it into Float32Arrays in a specific format expected by the compute shader.
    function packGpuData(targetNodes, targetLinks) {
        const degreeMap = new Map();
        targetLinks.forEach(link => {
            const sid = link.source?.id ?? link.source;
            const tid = link.target?.id ?? link.target;
            if (!sid || !tid) return;
            degreeMap.set(sid, (degreeMap.get(sid) || 0) + 1);
            degreeMap.set(tid, (degreeMap.get(tid) || 0) + 1);
        });

        const nodeArray = new Float32Array(Math.max(1, targetNodes.length) * 16);
        const nodeIndex = new Map(targetNodes.map((node, index) => [node.id, index]));
        targetNodes.forEach((node, index) => {
            const base = index * 16;
            nodeArray[base + 0] = Number.isFinite(node.x) ? node.x : window.innerWidth / 2;
            nodeArray[base + 1] = Number.isFinite(node.y) ? node.y : window.innerHeight / 2;
            nodeArray[base + 2] = Number.isFinite(node.vx) ? node.vx : 0;
            nodeArray[base + 3] = Number.isFinite(node.vy) ? node.vy : 0;
            nodeArray[base + 4] = Math.max(2, Number.isFinite(node.r) ? node.r : 5);
            nodeArray[base + 5] = Number.isFinite(node.layer) ? node.layer : 0;
            nodeArray[base + 6] = clamp01(Number.isFinite(node.gpuColorValue) ? node.gpuColorValue : 0.5);
            nodeArray[base + 7] = node.fx === undefined || node.fx === null ? 0 : 1;
            nodeArray[base + 8] = node.fx === undefined || node.fx === null ? 0 : Number(node.fx);
            nodeArray[base + 9] = node.fy === undefined || node.fy === null ? 0 : Number(node.fy);
            nodeArray[base + 10] = degreeMap.get(node.id) || 1;
            nodeArray[base + 11] = Number.isFinite(node.centrality) ? node.centrality : 0;
            nodeArray[base + 12] = Number.isFinite(node.eigen) ? node.eigen : 0;
            nodeArray[base + 13] = Number.isFinite(proteinMetadata.get(node.id)?.size) ? proteinMetadata.get(node.id)?.size : 0;
            nodeArray[base + 14] = 0;
            nodeArray[base + 15] = 0;
        });

        const attractionDistance = +document.getElementById('attractionSlider')?.value || 70;

        const linkArray = new Float32Array(Math.max(1, targetLinks.length) * 4);
        targetLinks.forEach((link, index) => {
            const base = index * 4;
            const sourceIndex = nodeIndex.get(link.source?.id ?? link.source);
            const targetIndex = nodeIndex.get(link.target?.id ?? link.target);
            const sourceId = link.source?.id ?? link.source;
            const targetId = link.target?.id ?? link.target;
            const sourceDeg = degreeMap.get(sourceId) || 1;
            const targetDeg = degreeMap.get(targetId) || 1;
            const cpuLikeStrength = 1 / Math.min(sourceDeg, targetDeg);
            linkArray[base + 0] = Number.isFinite(sourceIndex) ? sourceIndex : -1;
            linkArray[base + 1] = Number.isFinite(targetIndex) ? targetIndex : -1;
            linkArray[base + 2] = attractionDistance;
            linkArray[base + 3] = cpuLikeStrength;
        });

        return { nodeArray, linkArray };
    }

    // This function uploads the current node and link data to the GPU buffers, preparing them for use in the compute shader for physics simulations. 
    async function uploadGpuScene(targetNodes, targetLinks) {
        if (!gpuState.ready) return;
        ensureGpuCanvasSize();
        ensureGpuBuffers(targetNodes, targetLinks);
        const { nodeArray, linkArray } = packGpuData(targetNodes, targetLinks);
        gpuState.device.queue.writeBuffer(gpuState.nodeBuffer, 0, nodeArray.buffer, nodeArray.byteOffset, nodeArray.byteLength);
        gpuState.device.queue.writeBuffer(gpuState.nodeBufferAlt, 0, nodeArray.buffer, nodeArray.byteOffset, nodeArray.byteLength);
        gpuState.device.queue.writeBuffer(gpuState.linkBuffer, 0, linkArray.buffer, linkArray.byteOffset, linkArray.byteLength);
        gpuState.needsUpload = false;
        gpuState.needsResize = false;
        gpuState.lastSignature = makeNodeGpuSignature(targetNodes, targetLinks, +document.getElementById('thresholdInput').value);
    }

    // This function performs a single step of the GPU-accelerated physics simulation, dispatching the compute shader and then reading back the updated node positions and velocities to update the in-memory node data. It includes various checks to ensure that the GPU state is valid and that buffers are not being resized during the operation, and it handles the mapping and unmapping of the readback buffer to access the results from the GPU.
    async function stepGpuPhysicsAndReadback(targetNodes, targetLinks) {
        if (!gpuState.ready || !canPhysicsRun() || currentViewId !== 'base') return;
        // Skip physics if render is resizing buffers, or if buffers were recently resized (grace period)
        if (gpuState.resizingBuffers || (Date.now() - gpuState.lastBufferResizeTime) < 100) return;
        try {
            const threshold = +document.getElementById('thresholdInput').value;
            const repulsion = +document.getElementById('repulsionSlider').value;
            const attraction = +document.getElementById('attractionSlider').value;
            const drift = +document.getElementById('driftSlider').value;
            const dt = 0.016;
            const readbackBytes = Math.max(1, targetNodes.length) * 16 * 4;
            
            // Defensive: Validate readback buffer can hold the data
            if (!gpuState.readbackBuffer || gpuState.readbackBuffer.size < readbackBytes) {
                ensureGpuBuffers(targetNodes, targetLinks);
                gpuState.lastBufferResizeTime = Date.now();
                return; // Skip this frame and let buffers settle
            }

            // Pin buffer references for the full frame to avoid races when global gpuState buffers are replaced.
            const readNodeBuffer = gpuState.nodeBuffer;
            const writeNodeBuffer = gpuState.nodeBufferAlt;
            const linkBuffer = gpuState.linkBuffer;
            const uniformBuffer = gpuState.uniformBuffer;
            const readbackBuffer = gpuState.readbackBuffer;
            const screenW = canvas?.clientWidth || window.innerWidth;
            const screenH = canvas?.clientHeight || window.innerHeight;
            const uniformData = new Float32Array([
                screenW,
                screenH,
                0.016,
                0,
                transform.x || 0,
                transform.y || 0,
                transform.k || 1,
                0,
                repulsion,
                attraction,
                drift,
                +document.getElementById('alphaSlider').value,
                targetNodes.length,
                targetLinks.length,
                1,
                0
            ]);
            gpuState.device.queue.writeBuffer(uniformBuffer, 0, uniformData);
            const commandEncoder = gpuState.device.createCommandEncoder();
            const bindGroup = gpuState.device.createBindGroup({
                layout: gpuState.computeBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: readNodeBuffer } },
                    { binding: 1, resource: { buffer: writeNodeBuffer } },
                    { binding: 2, resource: { buffer: linkBuffer } },
                    { binding: 3, resource: { buffer: uniformBuffer } }
                ]
            });

            const computePass = commandEncoder.beginComputePass();
            computePass.setPipeline(gpuState.computePipeline);
            computePass.setBindGroup(0, bindGroup);
            computePass.dispatchWorkgroups(Math.max(1, Math.ceil(targetNodes.length / 64)));
            computePass.end();

            commandEncoder.copyBufferToBuffer(writeNodeBuffer, 0, readbackBuffer, 0, readbackBytes);
            gpuState.device.queue.submit([commandEncoder.finish()]);
            
            if (gpuState.readbackBuffer !== readbackBuffer || gpuState.resizingBuffers) {
                console.log(`[GPU-PHYSICS-ABORT-PRE-MAP] Buffer invalid or resize detected before mapAsync`);
                return;
            }
            
            await readbackBuffer.mapAsync(GPUMapMode.READ, 0, readbackBytes);
            
            if (gpuState.readbackBuffer !== readbackBuffer || gpuState.resizingBuffers) {
                try { readbackBuffer.unmap(); } catch (e) { }
                return;
            }
            
            const mapped = readbackBuffer.getMappedRange(0, readbackBytes);
            const copy = new Float32Array(mapped.slice(0));
            readbackBuffer.unmap();

            let invalidCount = 0;
            targetNodes.forEach((node, index) => {
                const base = index * 16;
                const nx = copy[base + 0];
                const ny = copy[base + 1];
                const nvx = copy[base + 2];
                const nvy = copy[base + 3];
                if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nvx) || !Number.isFinite(nvy)) {
                    invalidCount++;
                    return;
                }
                node.x = nx;
                node.y = ny;
                node.vx = nvx;
                node.vy = nvy;
            });

            // Keep Full Network centered by correcting translation drift each frame.
            let sumX = 0;
            let sumY = 0;
            let validCount = 0;
            targetNodes.forEach(node => {
                if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
                sumX += node.x;
                sumY += node.y;
                validCount++;
            });
            if (validCount > 0) {
                const avgX = sumX / validCount;
                const avgY = sumY / validCount;
                const screenW = canvas?.clientWidth || window.innerWidth;
                const screenH = canvas?.clientHeight || window.innerHeight;
                const centerX = screenW * 0.5;
                const centerY = screenH * 0.5;
                const shiftX = centerX - avgX;
                const shiftY = centerY - avgY;
                                if (Math.abs(shiftX) > 1e-4 || Math.abs(shiftY) > 1e-4) {
                    targetNodes.forEach((node, index) => {
                        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
                        node.x += shiftX;
                        node.y += shiftY;
                        const base = index * 16;
                        copy[base + 0] = node.x;
                        copy[base + 1] = node.y;
                        if (Number.isFinite(node.fx)) node.fx += shiftX;
                        if (Number.isFinite(node.fy)) node.fy += shiftY;
                    });

                    // Keep GPU state aligned with CPU recentering to avoid frame-to-frame drift artifacts.
                    gpuState.device.queue.writeBuffer(writeNodeBuffer, 0, copy.buffer, copy.byteOffset, copy.byteLength);
                }
            }

            if (invalidCount > 0) {
            }
            gpuState.nodeBuffer = writeNodeBuffer;
            gpuState.nodeBufferAlt = readNodeBuffer;
        } catch (error) {
        }
    }

    let gpuAnimationRunning = false;

    // This function manages the animation loop for GPU-accelerated physics simulations. 
    async function ensureGpuAnimationLoop(alpha = null) {
        if (!gpuState.ready || currentViewId !== 'base' || !canPhysicsRun()) return;
        if (gpuAnimationRunning) return;
        gpuAnimationRunning = true;
        const tick = async () => {
            if (!gpuState.ready || currentViewId !== 'base' || !canPhysicsRun()) {
                gpuAnimationRunning = false;
                return;
            }
            const targetNodes = nodes;
            const targetLinks = links;
            const signature = makeNodeGpuSignature(targetNodes, targetLinks, +document.getElementById('thresholdInput').value);
            if (gpuState.needsUpload || gpuState.lastSignature !== signature) {
                await uploadGpuScene(targetNodes, targetLinks);
            }
            await stepGpuPhysicsAndReadback(targetNodes, targetLinks);
            draw();
            requestAnimationFrame(tick);
        };
        if (alpha !== null && simulation) simulation.alpha(alpha);
        requestAnimationFrame(tick);
    }

    simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(70))
        .force("charge", d3.forceManyBody().strength(-150))
        .force("x", d3.forceX(window.innerWidth / 2).strength(0))
        .force("y", d3.forceY(window.innerHeight / 2).strength(0))
        .force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .on("tick", () => {
            if (isSettling && simulation.alpha() < 0.05) isSettling = false;
            const limit = +document.getElementById('driftSlider').value;
            const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
            const targetNodes = currentViewId === 'base' ? nodes : activeSubData?.nodes || [];
            targetNodes.forEach(n => {
                if (Math.abs(n.x - cx) > limit) { n.x = n.x > cx ? cx + limit : cx - limit; n.vx = 0; }
                if (Math.abs(n.y - cy) > limit) { n.y = n.y > cy ? cy + limit : cy - limit; n.vy = 0; }
            });
            draw();
        });

    const zoomBehavior = d3.zoom()
        .scaleExtent([0.001, 20])
        .filter(event => {
            if (isBrushMode) return false;
            if (isLassoMode) return event.type === 'wheel';
            if (isFrameMode) return false;
            if (currentViewId === 'pie_chart' || currentViewId === 'histogram') return false;

            if (event.type === 'mousedown' && isDragMode && currentViewId !== 'Scatter Plot' && currentViewId !== 'Venn Diagram' && currentViewId !== 'Mind Map') {
                const [mx, my] = d3.pointer(event);
                const pt = transform.invert([mx, my]);
                const drawNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
                const found = drawNodes.find(n => {
                    const dx = n.x - pt[0], dy = n.y - pt[1];
                    return Math.sqrt(dx*dx + dy*dy) < (n.r || 5);
                });
                if (found) {
                    draggedNode = found; draggedNode.fx = draggedNode.x; draggedNode.fy = draggedNode.y;
                    const sim = currentViewId === 'base' ? simulation : activeSubData?.simulation;
                    if (physicsEnabled) { restartActivePhysics((isBuilding || isSettling) ? 0.5 : +document.getElementById('alphaSlider').value); }
                    return false;
                }
            }

            // Default: Allow zoom/pan if not right-clicking or holding Ctrl
            return !event.button;
        })
        .on("zoom", (e) => {
            if (currentViewId === 'Venn Diagram') {
                vennTransform = e.transform;
                updateVennControls();
            } else if (currentViewId === 'Scatter Plot') {
                scatterTransform = e.transform;
                updateScatterControls();
            } else if (currentViewId === 'Mind Map') {
                mindMapTransform = e.transform;
            } else {
                transform = e.transform;
                if (proteinInfoZoomHotkeyState && e.sourceEvent) {
                    proteinInfoZoomHotkeyState.invalidated = true;
                }
                if (physicsEnabled && transform.k >= 1.0) {
                    togglePhysics(false, 'auto-zoom');
                }
            }
            draw();
            if (currentViewId !== 'Venn Diagram' && currentViewId !== 'Scatter Plot' && currentViewId !== 'Mind Map') checkOffscreenNodes();
        });

        // This function determines the set of nodes that should be considered "active" for the pie chart view, based on the current data source selection (e.g., selected nodes, specific collection, or all nodes).
    function getPieChartActiveNodes() {
        if (pieDataSource === 'selected') {
            return Array.from(selectedNodes).map(id => nodeMap.get(id)).filter(Boolean);
        }
        if (pieDataSource?.startsWith('collection_')) {
            const collName = pieDataSource.replace('collection_', '');
            const coll = collections.get(collName);
            if (!coll) return [];
            if (coll.nodeIds?.size) return Array.from(coll.nodeIds).map(id => nodeMap.get(id)).filter(Boolean);
            return coll.nodes || [];
        }
        return nodes;
    }

    // This function gets the available options for the Venn diagram collection selector, including the count of nodes in each collection and the count of selected nodes if the "Selected Nodes" option is chosen.
    function getVennCollectionOptions() {
        const selectedCount = currentViewId === 'Venn Diagram' ? vennPinnedSelectedNodes.size : getEffectiveSelectedNodesSet().size;
        const opts = [{ value: 'selected', label: `Selected Nodes (${selectedCount})` }];
        collections.forEach((coll, name) => {
            const count = coll?.nodeIds?.size || 0;
            opts.push({ value: `collection_${name}`, label: `${name} (${count})` });
        });
        return opts;
    }

    // This function retrieves the available options for the scatter plot variable selector, including built-in options
    function getScatterVariableOptions() {
        const opts = [
            { value: 'centrality', label: 'Centrality' },
            { value: 'size', label: 'Protein Size' },
            { value: 'eigen', label: 'Eigenvector Centrality' },
            { value: 'pdb_structure_count', label: 'PDB Structure Count' }
        ];

        // Built-in continuous options
        opts.push({ value: 'annotation', label: 'Annotation length' });
        
        // Add embedding cosine similarity options if embeddings are available
        if (embeddingDataByType?.sequence) {
            opts.push({ value: 'embedding_sequence_similarity', label: 'Sequence Embedding Cosine Similarity' });
        }
        if (embeddingDataByType?.network) {
            opts.push({ value: 'embedding_network_similarity', label: 'Network Embedding Cosine Similarity' });
        }

        const isContinuousType = (type) => /continuous/i.test(String(type || ''));
        const seen = new Set(opts.map(o => o.value));

        const pushOption = (value, label) => {
            if (!value || seen.has(value)) return;
            seen.add(value);
            opts.push({ value, label });
        };

        variableConfigs.forEach(cfg => {
            if (!cfg?.fileName || !cfg?.variable) return;
            if (!isContinuousType(cfg.type)) return;
            pushOption(`var::${cfg.fileName}::${cfg.variable}`, `${cfg.variable} (${cfg.fileName})`);
        });

        return opts;
    }

    // This function retrieves the value to be used for a given node and scatter plot variable key.
    function getScatterValueForNode(node, key, resolvedSizeSource, resolvedAnnotationSource) {
        if (key === 'centrality') return Number.isFinite(node.centrality) ? node.centrality : 0;
        if (key === 'size') {
            // Use the source passed in from outside the loop
            return getProteinSizeValue(node.id, resolvedSizeSource);
        }
        if (key === 'annotation') {
            return getAnnotationLengthFromSource(node.id, resolvedAnnotationSource);
        }
        if (key === 'embedding_sequence_similarity' || key === 'embedding_network_similarity') {
            const embType = key === 'embedding_sequence_similarity' ? 'sequence' : 'network';
            const embData = embeddingDataByType[embType];
            if (!embData) return undefined;
            
            const vectorsByNode = getEmbeddingVectorsByNodeForType(embType);
            const nodeVec = vectorsByNode.get(node.id);
            if (!nodeVec) return undefined;
            const referenceSet = getActiveEmbeddingReferenceSet();
            if (!referenceSet.size) return undefined;
            const refNodeId = Array.from(referenceSet)[0];
            if (!refNodeId) return undefined;
            const refVec = vectorsByNode.get(refNodeId);
            if (!refVec) return undefined;
            
            // Calculate cosine similarity
            const len = Math.min(nodeVec.vec.length, refVec.vec.length);
            let dot = 0;
            for (let i = 0; i < len; i++) dot += nodeVec.vec[i] * refVec.vec[i];
            const denom = nodeVec.norm * refVec.norm;
            if (!Number.isFinite(denom) || denom <= 1e-12) return undefined;
            return clampCosine(dot / denom);
        }
        if (key === 'eigen') {
            return Number.isFinite(node.eigen) ? node.eigen : undefined;
        }
        if (key === 'pdb_structure_count') {
            return getPdbStructureCount(node.id);
        }
        if (key?.startsWith('var::')) {
            const parts = key.split('::');
            const file = parts[1], variable = parts[2];
            const raw = accessoryVariableValues[file]?.[variable]?.get(node.id);
            const v = +raw;
            return Number.isFinite(v) ? v : undefined;
        }
        return undefined;
    }

    function normalizeVariableKey(value) {
        return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
    }

    function resolveBuiltInColorSource(mode, targetNodes = nodes) {
        if (mode !== 'annotation' && mode !== 'localization') return null;

        if (mode === 'annotation') {
            const targetIds = new Set((targetNodes || []).map(n => n.id));
            const exactMatches = [];

            Object.entries(accessoryVariableValues || {}).forEach(([fileName, vars]) => {
                Object.entries(vars || {}).forEach(([variable, valueMap]) => {
                    if (!(valueMap instanceof Map)) return;
                    const normalized = normalizeVariableKey(variable);
                    if (normalized !== 'annotation' && normalized !== 'proteinannotation') return;

                    let presentCount = 0;
                    valueMap.forEach((raw, nodeId) => {
                        if (!targetIds.has(nodeId)) return;
                        if (raw === undefined || raw === null || String(raw).trim() === '') return;
                        presentCount++;
                    });
                    if (!presentCount) return;

                    const fileBoost = String(fileName || '').toLowerCase().includes('protein.info') ? 100000 : 0;
                    exactMatches.push({ fileName, variable, score: fileBoost + presentCount });
                });
            });

            if (exactMatches.length) {
                exactMatches.sort((a, b) => b.score - a.score);
                return { fileName: exactMatches[0].fileName, variable: exactMatches[0].variable };
            }
            return null;
        }

        const candidates = new Set(['localization', 'localisation', 'subcellularlocalization', 'subcellularlocation', 'location', 'description']);

        const targetIds = new Set((targetNodes || []).map(n => n.id));
        let best = null;

        Object.entries(accessoryVariableValues || {}).forEach(([fileName, vars]) => {
            Object.entries(vars || {}).forEach(([variable, valueMap]) => {
                if (!(valueMap instanceof Map)) return;

                let presentCount = 0;
                valueMap.forEach((raw, nodeId) => {
                    if (!targetIds.has(nodeId)) return;
                    if (raw === undefined || raw === null || String(raw).trim() === '') return;
                    presentCount++;
                });
                if (presentCount === 0) return;

                const normalized = normalizeVariableKey(variable);
                const nameScore = candidates.has(normalized)
                    ? 2000
                    : (Array.from(candidates).some(c => normalized.includes(c) || c.includes(normalized)) ? 800 : 0);
                const score = nameScore + presentCount;

                if (!best || score > best.score) {
                    best = { fileName, variable, score };
                }
            });
        });

        return best ? { fileName: best.fileName, variable: best.variable } : null;
    }

    function getBuiltInColorValueFromSource(nodeId, mode, source = null) {
        if (source?.fileName && source?.variable) {
            const raw = accessoryVariableValues[source.fileName]?.[source.variable]?.get(nodeId);
            if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
                return String(raw).trim();
            }
        }

        const metadata = proteinMetadata.get(nodeId) || {};
        const fallback = metadata[mode];
        return (fallback === undefined || fallback === null || String(fallback).trim() === '')
            ? 'Unknown'
            : String(fallback).trim();
    }

    function getAnnotationLengthFromSource(nodeId, source = null) {
        const raw = getBuiltInColorValueFromSource(nodeId, 'annotation', source);
        const normalized = String(raw || '').trim();
        if (!normalized || normalized.toLowerCase() === 'unknown') return 0;
        return normalized.length;
    }

    function resolveProteinSizeSource(targetNodes = nodes) {
        const targetIds = new Set((targetNodes || []).map(n => n.id));
        let best = null;
        const preferred = new Set(['proteinsize', 'size', 'proteinlength', 'sequencelength', 'aalength']);

        Object.entries(accessoryVariableValues || {}).forEach(([fileName, vars]) => {
            Object.entries(vars || {}).forEach(([variable, valueMap]) => {
                if (!(valueMap instanceof Map)) return;

                let numericCount = 0;
                valueMap.forEach((raw, nodeId) => {
                    if (!targetIds.has(nodeId)) return;
                    const parsed = +raw;
                    if (Number.isFinite(parsed)) numericCount++;
                });
                if (!numericCount) return;

                const normalized = normalizeVariableKey(variable);
                const nameScore = preferred.has(normalized)
                    ? 2000
                    : (Array.from(preferred).some(p => normalized.includes(p) || p.includes(normalized)) ? 800 : 0);
                const score = nameScore + numericCount;

                if (!best || score > best.score) {
                    best = { fileName, variable, score };
                }
            });
        });

        return best ? { fileName: best.fileName, variable: best.variable } : null;
    }

    function getProteinSizeValue(nodeId, source = null) {
        const metaVal = +(proteinMetadata.get(nodeId)?.size);
        if (Number.isFinite(metaVal) && metaVal > 0) return metaVal;

        if (source?.fileName && source?.variable) {
            const raw = accessoryVariableValues[source.fileName]?.[source.variable]?.get(nodeId);
            const parsed = +raw;
            if (Number.isFinite(parsed)) return parsed;
        }

        return Number.isFinite(metaVal) ? metaVal : 0;
    }

    // Returns the most-specific (furthest-right) mind-map node label that the given protein is associated with.
    function getBiologicalProcessKey(nodeId) {
        // Find the proteins->cluster accessory file (clusters.proteins)
        const proteinsFile = Object.keys(accessoryDataFiles || {}).find(f => /^\d+\.clusters\.proteins\.v[\d.]+\.txt$/i.test(f));
        const proteinsRows = proteinsFile ? (accessoryDataFiles[proteinsFile].rows || []) : [];
        const proteinsHeaders = proteinsFile ? (accessoryDataFiles[proteinsFile].headers || []) : [];
        const clusterHeader = proteinsHeaders.find(h => /cluster/i.test(h) && /id/i.test(h)) || proteinsHeaders.find(h => /cluster/i.test(h)) || 'cluster_id';
        const proteinHeader = proteinsHeaders.find(h => /protein/i.test(h)) || 'protein_id';

        // Build mapping protein -> cluster ids
        const proteinToClusters = new Map();
        proteinsRows.forEach(r => {
            const cid = String(r[clusterHeader] || '').trim();
            const pid = String(r[proteinHeader] || '').trim();
            if (!cid || !pid) return;
            if (!proteinToClusters.has(pid)) proteinToClusters.set(pid, new Set());
            proteinToClusters.get(pid).add(cid);
        });

        const layout = buildMindMapLayout();
        if (!layout || !layout.nodes || !layout.nodes.size) return 'Unknown';

        const clusters = proteinToClusters.get(nodeId) || new Set();
        if (!clusters.size) return 'Unknown';

        // Find the node among the clusters with the largest x coordinate (furthest right)
        let bestNode = null;
        let bestX = -Infinity;
        clusters.forEach(cid => {
            const n = layout.nodes.get(cid);
            if (!n) return;
            if ((n.x || 0) > bestX) {
                bestX = n.x || 0;
                bestNode = n;
            }
        });

        return bestNode ? String(bestNode.label || bestNode.id) : 'Unknown';
    }

    function ensureScatterEigenCentrality(force = false) {
        if (scatterXVariable !== 'eigen' && scatterYVariable !== 'eigen') return;

        const threshold = +document.getElementById('thresholdInput').value;
        const hasMissing = nodes.some(n => !Number.isFinite(n.eigen));
        const cacheKey = `${nodes.length}|${links.length}|${threshold}`;
        if (force || hasMissing || scatterEigenCacheKey !== cacheKey) {
            calculateEigenvectorCentrality();
            scatterEigenCacheKey = cacheKey;
        }
    }

    function updateScatterControls(layout = null) {
        const controls = document.getElementById('scatter-controls');
        const xSel = document.getElementById('scatterXVariable');
        const ySel = document.getElementById('scatterYVariable');
        const recenterBtn = document.getElementById('scatter-recenter-btn');
        if (!controls || !xSel || !ySel) return;

        controls.style.display = currentViewId === 'Scatter Plot' ? 'block' : 'none';
        if (currentViewId !== 'Scatter Plot') {
            if (recenterBtn) recenterBtn.style.display = 'none';
            return;
        }

        const options = getScatterVariableOptions();
        const values = new Set(options.map(o => o.value));
        if (!values.has(scatterXVariable)) scatterXVariable = options[0]?.value || 'centrality';
        if (!values.has(scatterYVariable)) scatterYVariable = options[1]?.value || options[0]?.value || 'size';
        if (scatterXVariable === scatterYVariable && options.length > 1) {
            scatterYVariable = options.find(o => o.value !== scatterXVariable)?.value || scatterYVariable;
        }

        const fill = (sel, selectedValue) => {
            sel.innerHTML = '';
            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if (opt.value === selectedValue) option.selected = true;
                sel.appendChild(option);
            });
        };

        fill(xSel, scatterXVariable);
        fill(ySel, scatterYVariable);

        if (layout?.controlX !== undefined && layout?.controlY !== undefined) {
            controls.style.left = `${layout.controlX}px`;
            controls.style.top = `${layout.controlY}px`;
        }

        if (recenterBtn) {
            const isReset = Math.abs((scatterTransform?.k || 1) - 1) < 1e-6
                && Math.abs(scatterTransform?.x || 0) < 1e-6
                && Math.abs(scatterTransform?.y || 0) < 1e-6;
            recenterBtn.style.display = isReset ? 'none' : 'block';
            recenterBtn.style.left = '50%';
            recenterBtn.style.top = '-44px';
        }
    }

    function recenterScatterPlot() {
        scatterTransform = d3.zoomIdentity;
        d3.select(canvas).call(zoomBehavior.transform, scatterTransform);
        updateScatterControls();
        draw();
    }

    function startScatterPlotAsyncLoading() {
        if (currentViewId !== 'Scatter Plot') return;
        
        const pointData = nodes.map(node => {
            const xv = getScatterValueForNode(node, scatterXVariable);
            const yv = getScatterValueForNode(node, scatterYVariable);
            if (!Number.isFinite(xv) || !Number.isFinite(yv)) return null;
            return { node, xVal: xv, yVal: yv };
        }).filter(Boolean);
        
        scatterPointsToRender = pointData;
        scatterPointsRendered = 0;
        scatterPointsLoadingInProgress = true;
        
        // Start rendering points in batches
        function renderBatch() {
            if (currentViewId !== 'Scatter Plot' || !scatterPointsLoadingInProgress) return;
            
            const batchSize = Math.max(50, Math.ceil(scatterPointsToRender.length / 20));
            const endIdx = Math.min(scatterPointsRendered + batchSize, scatterPointsToRender.length);
            
            scatterPointsRendered = endIdx;
            
            if (scatterPointsRendered >= scatterPointsToRender.length) {
                scatterPointsLoadingInProgress = false;
                draw();
            } else {
                draw();
                requestAnimationFrame(renderBatch);
            }
        }
        
        renderBatch();
    }

    function getMindMapRelationHeaders(fileName) {
        const headers = accessoryDataFiles[fileName]?.headers || [];
        const parentHeader = headers.find(h => h.toLowerCase().includes('parent')) || null;
        const childHeader = headers.find(h => h.toLowerCase().includes('child')) || null;
        return { parentHeader, childHeader };
    }

    function getMindMapSourceFiles() {
        return Object.entries(accessoryDataFiles)
            .filter(([fileName]) => {
                const { parentHeader, childHeader } = getMindMapRelationHeaders(fileName);
                return !!parentHeader && !!childHeader;
            })
            .map(([fileName]) => fileName)
            .sort((a, b) => a.localeCompare(b));
    }

    function getMindMapInfoFiles() {
        return Object.keys(accessoryDataFiles).sort((a, b) => a.localeCompare(b));
    }

    function getMindMapIdHeader(fileName, preferredIds = null) {
        const headers = accessoryDataFiles[fileName]?.headers || [];
        const rows = accessoryDataFiles[fileName]?.rows || [];
        const preferredSet = preferredIds instanceof Set ? preferredIds : new Set(Array.isArray(preferredIds) ? preferredIds : []);
        const normalized = new Map(headers.map(h => [h.toLowerCase().trim(), h]));

        const heuristicOrder = [
            normalized.get('cluster_id'),
            normalized.get('node_id'),
            normalized.get('id'),
            normalized.get('#string_protein_id'),
            normalized.get('string_protein_id'),
            normalized.get('protein_id'),
            normalized.get('protein')
        ].filter(Boolean);

        const candidateHeaders = [
            ...heuristicOrder,
            ...headers.filter(h => /(^|[^a-z])id([^a-z]|$)/i.test(h)),
            ...headers  // Include all headers for comprehensive scoring
        ];

        const uniqueCandidates = Array.from(new Set(candidateHeaders));

        if (preferredSet.size && uniqueCandidates.length) {
            let bestHeader = null;
            let bestScore = -1;

            uniqueCandidates.forEach(header => {
                const score = rows.reduce((count, row) => {
                    const value = String(row[header] || '').trim();
                    return count + (preferredSet.has(value) ? 1 : 0);
                }, 0);
                if (score > bestScore) {
                    bestScore = score;
                    bestHeader = header;
                }
            });

            if (bestHeader && bestScore > 0) return bestHeader;
        }

        return uniqueCandidates[0] || headers.find(h => /(^|[^a-z])id([^a-z]|$)/i.test(h)) || null;
    }

    function fillSelect(selectEl, options, selectedValue, placeholder = null) {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        if (placeholder !== null) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = placeholder;
            selectEl.appendChild(opt);
        }
        options.forEach(item => {
            const opt = document.createElement('option');
            opt.value = typeof item === 'string' ? item : item.value;
            opt.textContent = typeof item === 'string' ? item : item.label;
            if (opt.value === selectedValue) opt.selected = true;
            selectEl.appendChild(opt);
        });
        if (selectedValue && Array.from(selectEl.options).some(o => o.value === selectedValue)) {
            selectEl.value = selectedValue;
        } else if (selectEl.options.length) {
            selectEl.value = selectEl.options[0].value;
        }
    }

    function updateMindMapControls() {
        const controls = document.getElementById('mind-map-controls');
        const sourceSel = document.getElementById('mindMapSourceFile');
        const infoSel = document.getElementById('mindMapInfoFile');
        const labelSel = document.getElementById('mindMapLabelField');
        const toggleBtn = document.getElementById('mindMapClusterSizeToggle');
        if (!controls || !sourceSel || !infoSel || !labelSel || !toggleBtn) return;

        controls.style.display = currentViewId === 'Mind Map' ? 'block' : 'none';
        if (currentViewId !== 'Mind Map') return;

        const sourceFiles = getMindMapSourceFiles();
        if (!mindMapSourceFile || !sourceFiles.includes(mindMapSourceFile)) {
            mindMapSourceFile = sourceFiles[0] || '';
        }
        fillSelect(sourceSel, sourceFiles, mindMapSourceFile, 'No parent-child file');

        const infoFiles = getMindMapInfoFiles();
        // Prefer a clusters.info file as the default Node Info File for Mind Map when available
        if ((!mindMapInfoFile || !infoFiles.includes(mindMapInfoFile))) {
            const clustersInfo = infoFiles.find(f => /^\d+\.clusters\.info\.v[\d.]+\.txt$/i.test(f));
            mindMapInfoFile = clustersInfo || '';
        }
        fillSelect(infoSel, infoFiles, mindMapInfoFile, 'None');

        const labelOptions = [{ value: 'default', label: 'Default' }];
        if (mindMapInfoFile && accessoryDataFiles[mindMapInfoFile]) {
            accessoryDataFiles[mindMapInfoFile].headers.forEach(header => {
                labelOptions.push({ value: header, label: header });
            });
        }
        if (!labelOptions.some(opt => opt.value === mindMapLabelField)) {
            mindMapLabelField = labelOptions.some(opt => opt.value === 'best_described_by') ? 'best_described_by' : 'default';
        }
        fillSelect(labelSel, labelOptions, mindMapLabelField, null);

        sourceSel.onchange = () => {
            mindMapSourceFile = sourceSel.value || '';
            mindMapCollapsedNodes = new Set();
            mindMapSelectedNodes = new Set();
            mindMapLayoutState = null;
            centerMindMapView();
            updateMindMapControls();
            draw();
        };

        infoSel.onchange = () => {
            mindMapInfoFile = infoSel.value || '';
            if (mindMapLabelField !== 'default') {
                const headers = mindMapInfoFile ? (accessoryDataFiles[mindMapInfoFile]?.headers || []) : [];
                if (!headers.includes(mindMapLabelField)) mindMapLabelField = 'default';
            }
            mindMapLayoutState = null;
            updateMindMapControls();
            draw();
        };

        labelSel.onchange = () => {
            mindMapLabelField = labelSel.value || 'default';
            mindMapLayoutState = null;
            draw();
        };

        toggleBtn.textContent = mindMapClusterSizeColoring ? 'On' : 'Off';
        toggleBtn.onclick = () => {
            mindMapClusterSizeColoring = !mindMapClusterSizeColoring;
            updateMindMapControls();
            draw();
        };
    }

    function centerMindMapView() {
        const layout = buildMindMapLayout();
        if (!layout || !layout.nodes?.size) {
            mindMapTransform = d3.zoomIdentity;
            d3.select(canvas).call(zoomBehavior.transform, mindMapTransform);
            return;
        }

        const points = Array.from(layout.nodes.values());
        const minX = Math.min(...points.map(n => n.x + layout.offsetX - 12));
        const maxX = Math.max(...points.map(n => n.x + layout.offsetX + 180));
        const minY = Math.min(...points.map(n => n.y + layout.offsetY - 16));
        const maxY = Math.max(...points.map(n => n.y + layout.offsetY + 16));
        const padding = 80;
        const viewW = Math.max(1, canvas.width - padding * 2);
        const viewH = Math.max(1, canvas.height - padding * 2);
        const contentW = Math.max(1, maxX - minX);
        const contentH = Math.max(1, maxY - minY);
        const scale = Math.min(viewW / contentW, viewH / contentH, 1);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const vx = canvas.width / 2;
        const vy = canvas.height / 2;
        mindMapTransform = d3.zoomIdentity
            .translate(vx, vy)
            .scale(scale)
            .translate(-cx, -cy);
        d3.select(canvas).call(zoomBehavior.transform, mindMapTransform);
    }

    function toggleMindMapNode(nodeId) {
        if (!nodeId) return;
        if (mindMapCollapsedNodes.has(nodeId)) mindMapCollapsedNodes.delete(nodeId);
        else mindMapCollapsedNodes.add(nodeId);
        mindMapLayoutState = null;
        updateMindMapControls();
    }

    function toggleMindMapExpandCollapseAll() {
        const layout = buildMindMapLayout();
        if (!layout) return;
        const expandable = Array.from(layout.nodes.values()).filter(n => n.children.size > 0);
        const allCollapsed = expandable.length > 0 && expandable.every(n => mindMapCollapsedNodes.has(n.id));
        mindMapCollapsedNodes = allCollapsed ? new Set() : new Set(expandable.map(n => n.id));
        mindMapLayoutState = null;
        updateMindMapControls();
        draw();
    }

    function selectMindMapNodes(nodeIds, additive = false) {
        const ids = Array.from(new Set((nodeIds || []).filter(Boolean)));
        if (!additive) {
            mindMapSelectedNodes = new Set(ids);
        } else {
            const next = new Set(mindMapSelectedNodes);
            ids.forEach(id => next.add(id));
            mindMapSelectedNodes = next;
        }
        refreshInfoBoxFromSelection();
        draw();
    }

    function selectMindMapParents(evt) {
        const layout = mindMapLayoutState || buildMindMapLayout();
        if (!layout || mindMapSelectedNodes.size === 0) return;
        const parentIds = new Set();
        mindMapSelectedNodes.forEach(nodeId => {
            // Find the parent of this node by searching the layout
            for (const node of layout.nodes.values()) {
                if (node.children && node.children.has(nodeId)) {
                    parentIds.add(node.id);
                }
            }
        });
        if (parentIds.size > 0) {
            const additive = Boolean(isAdditiveMode || (evt && (evt.shiftKey || evt.ctrlKey || evt.metaKey)));
            selectMindMapNodes(Array.from(parentIds), additive);
        }
    }

    function selectMindMapChildren(evt) {
        const layout = mindMapLayoutState || buildMindMapLayout();
        if (!layout || mindMapSelectedNodes.size === 0) return;
        const childIds = new Set();
        mindMapSelectedNodes.forEach(nodeId => {
            const node = layout.nodes.get(nodeId);
            if (node && node.children) {
                node.children.forEach(childId => childIds.add(childId));
            }
        });
        if (childIds.size > 0) {
            const additive = Boolean(isAdditiveMode || (evt && (evt.shiftKey || evt.ctrlKey || evt.metaKey)));
            selectMindMapNodes(Array.from(childIds), additive);
        }
    }

    function buildMindMapLayout() {
        const sourceCandidates = getMindMapSourceFiles();
        if (!sourceCandidates.length) {
            mindMapLayoutState = null;
            return null;
        }

        if (!mindMapSourceFile || !sourceCandidates.includes(mindMapSourceFile)) {
            mindMapSourceFile = sourceCandidates[0];
        }

        const sourceData = accessoryDataFiles[mindMapSourceFile];
        if (!sourceData) {
            mindMapLayoutState = null;
            return null;
        }

        const { parentHeader, childHeader } = getMindMapRelationHeaders(mindMapSourceFile);
        if (!parentHeader || !childHeader) {
            mindMapLayoutState = null;
            return null;
        }

        const parentToChildren = new Map();
        const childToParents = new Map();
        const nodeIds = new Set();

        (sourceData.rows || []).forEach(row => {
            const parent = String(row[parentHeader] || '').trim();
            const child = String(row[childHeader] || '').trim();
            if (!parent || !child) return;
            nodeIds.add(parent);
            nodeIds.add(child);
            if (!parentToChildren.has(parent)) parentToChildren.set(parent, new Set());
            if (!childToParents.has(child)) childToParents.set(child, new Set());
            parentToChildren.get(parent).add(child);
            childToParents.get(child).add(parent);
        });

        const infoMap = new Map();
        const infoIdHeader = mindMapInfoFile ? getMindMapIdHeader(mindMapInfoFile, nodeIds) : null;
        if (mindMapInfoFile && accessoryDataFiles[mindMapInfoFile] && infoIdHeader) {
            (accessoryDataFiles[mindMapInfoFile].rows || []).forEach(row => {
                const id = String(row[infoIdHeader] || '').trim();
                if (!id) return;
                infoMap.set(id, row);
            });
        }

        const nodes = new Map();
        Array.from(nodeIds).forEach(id => {
            const children = parentToChildren.get(id) || new Set();
            const infoRow = infoMap.get(id) || {};
            const label = mindMapLabelField === 'default'
                ? id
                : (infoRow[mindMapLabelField] ?? id);
            const pillWidth = Math.max(132, String(label || id).length * 7 + 34);
            nodes.set(id, {
                id,
                label: String(label || id),
                children,
                parents: childToParents.get(id) || new Set(),
                hasChildren: children.size > 0,
                collapsed: mindMapCollapsedNodes.has(id),
                pillWidth,
                pillHeight: 28,
                x: 0,
                y: 0
            });
        });

        const roots = Array.from(nodes.values())
            .filter(n => !n.parents || n.parents.size === 0)
            .map(n => n.id)
            .sort((a, b) => a.localeCompare(b));
        const rootIds = roots.length ? roots : Array.from(nodes.keys()).sort((a, b) => a.localeCompare(b));

        const nextY = { value: 0 };
        const placed = new Set();
        const visiting = new Set();
        const xGap = 700;
        const yGap = 58;

        const placeNode = (id, depth) => {
            const node = nodes.get(id);
            if (!node) return 0;
            if (placed.has(id)) return node.y;
            if (visiting.has(id)) {
                node.x = depth * xGap;
                node.y = nextY.value;
                nextY.value += 1;
                placed.add(id);
                return node.y;
            }

            visiting.add(id);
            node.x = depth * xGap;
            const childIds = node.collapsed ? [] : Array.from(node.children).sort((a, b) => a.localeCompare(b));
            if (!childIds.length) {
                node.y = nextY.value;
                nextY.value += 1;
            } else {
                const childYs = [];
                childIds.forEach(childId => {
                    if (!nodes.has(childId)) return;
                    childYs.push(placeNode(childId, depth + 1));
                });
                if (childYs.length) {
                    node.y = childYs.reduce((a, b) => a + b, 0) / childYs.length;
                } else {
                    node.y = nextY.value;
                    nextY.value += 1;
                }
            }
            visiting.delete(id);
            placed.add(id);
            return node.y;
        };

        rootIds.forEach((rootId, idx) => {
            placeNode(rootId, 0);
            nextY.value += idx < rootIds.length - 1 ? 1.25 : 0;
        });

        Array.from(nodes.keys()).forEach(id => {
            if (!placed.has(id)) {
                placeNode(id, 0);
                nextY.value += 0.75;
            }
        });

        const values = Array.from(nodes.values());
        const xs = values.flatMap(n => [n.x - (n.pillWidth || 132) / 2, n.x + (n.pillWidth || 132) / 2]);
        const ys = values.map(n => n.y * yGap);
        const minX = xs.length ? Math.min(...xs) : 0;
        const maxX = xs.length ? Math.max(...xs) : 0;
        const minY = ys.length ? Math.min(...ys) : 0;
        const maxY = ys.length ? Math.max(...ys) : 0;
        const offsetX = canvas.width / 2 - ((minX + maxX) / 2);
        const offsetY = canvas.height / 2 - ((minY + maxY) / 2);

        values.forEach(node => {
            node.y *= yGap;
        });

        mindMapLayoutState = {
            sourceFile: mindMapSourceFile,
            infoFile: mindMapInfoFile,
            labelField: mindMapLabelField,
            nodes,
            parentToChildren,
            childToParents,
            offsetX,
            offsetY,
            xGap,
            yGap
        };
        return mindMapLayoutState;
    }

    function getMindMapClusterProteinCounts() {
        const proteinsFile = Object.keys(accessoryDataFiles || {}).find(f => /^\d+\.clusters\.proteins\.v[\d.]+\.txt$/i.test(f));
        if (!proteinsFile) return new Map();

        const proteinsRows = accessoryDataFiles[proteinsFile]?.rows || [];
        const proteinsHeaders = accessoryDataFiles[proteinsFile]?.headers || [];
        const clusterHeader = proteinsHeaders.find(h => /cluster/i.test(h) && /id/i.test(h)) || proteinsHeaders.find(h => /cluster/i.test(h)) || 'cluster_id';
        const proteinHeader = proteinsHeaders.find(h => /protein/i.test(h)) || 'protein_id';
        const counts = new Map();

        proteinsRows.forEach(row => {
            const clusterId = String(row[clusterHeader] || '').trim();
            const proteinId = String(row[proteinHeader] || '').trim();
            if (!clusterId || !proteinId) return;
            counts.set(clusterId, (counts.get(clusterId) || 0) + 1);
        });

        return counts;
    }

    function getMindMapHitTarget(mx, my) {
        const layout = mindMapLayoutState || buildMindMapLayout();
        if (!layout) return null;
        const world = mindMapTransform.invert([mx, my]);
        const wx = world[0] - layout.offsetX;
        const wy = world[1] - layout.offsetY;
        const toggleRadius = 9;
        const toggleGap = 156;

        for (const node of layout.nodes.values()) {
            const pillWidth = node.pillWidth || 132;
            const pillHeight = node.pillHeight || 28;
            const dx = Math.abs(wx - node.x);
            const dy = Math.abs(wy - node.y);
            if (dx <= pillWidth / 2 && dy <= pillHeight / 2) {
                return { type: 'node', id: node.id };
            }
            if (node.hasChildren) {
                const tx = node.x + toggleGap;
                const tdX = wx - tx;
                const tdY = wy - node.y;
                if (Math.sqrt(tdX * tdX + tdY * tdY) <= toggleRadius) {
                    return { type: 'toggle', id: node.id };
                }
            }
        }
        return null;
    }

    function drawMindMapView() {
        console.log("function drawMindMapView()");
        const layout = buildMindMapLayout();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!layout || !layout.nodes.size) {
            ctx.fillStyle = '#ccc';
            ctx.font = '22px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Select a parent-child accessory file below.', canvas.width / 2, canvas.height / 2);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
            return;
        }
        
        // Draw heading with the topmost root node label
        const rootNodes = Array.from(layout.nodes.values()).filter(n => !n.parents || n.parents.size === 0);
        const topNode = rootNodes.length
            ? rootNodes.reduce((best, node) => (!best || node.y < best.y ? node : best), null)
            : Array.from(layout.nodes.values()).reduce((best, node) => (!best || node.y < best.y ? node : best), null);
        const topNodeLabel = topNode ? topNode.label : 'Mind Map';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`Mind map of ${topNodeLabel}`, canvas.width / 2, 40);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';

        const nodeRadius = 11;
        const toggleRadius = 9;
        const toggleGap = 85;
        const points = Array.from(layout.nodes.values());
        const clusterCounts = mindMapClusterSizeColoring ? getMindMapClusterProteinCounts() : null;
        const countValues = clusterCounts ? Array.from(clusterCounts.values()) : [];
        const minCount = countValues.length ? Math.min(...countValues) : 0;
        const maxCount = countValues.length ? Math.max(...countValues) : 1;

        ctx.save();
        ctx.setTransform(mindMapTransform.k, 0, 0, mindMapTransform.k, mindMapTransform.x, mindMapTransform.y);

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(170, 170, 170, 0.55)';
        points.forEach(node => {
            if (node.collapsed) return;
            node.children.forEach(childId => {
                const child = layout.nodes.get(childId);
                if (!child) return;
                ctx.beginPath();
                const parentToggleX = node.x + layout.offsetX + toggleGap;
                const childPillWidth = child.pillWidth || 132;
                const childLeft = child.x + layout.offsetX - childPillWidth / 2;
                ctx.moveTo(parentToggleX + toggleRadius, node.y + layout.offsetY);
                ctx.lineTo(childLeft, child.y + layout.offsetY);
                ctx.stroke();
            });
        });

        points.forEach(node => {
            const pillWidth = node.pillWidth || 132;
            const pillHeight = node.pillHeight || 28;
            const x = node.x + layout.offsetX;
            const y = node.y + layout.offsetY;
            const pillLeft = x - pillWidth / 2;
            const pillRight = x + pillWidth / 2;
            const pillTop = y - pillHeight / 2;
            const toggleX = x + toggleGap;
            const isCollapsed = node.collapsed;
            const isSelected = mindMapSelectedNodes.has(node.id);
            const hasSelection = mindMapSelectedNodes.size > 0;
            const alpha = !hasSelection || isSelected ? 1.0 : 0.3;
            const clusterCount = clusterCounts?.get(node.id) || 0;
            const clusterT = clusterCounts ? clamp01((clusterCount - minCount) / ((maxCount - minCount) || 1)) : 0;

            // Draw toggle node (>) if node has children
            if (node.hasChildren) {
                ctx.beginPath();
                ctx.moveTo(pillRight, y);
                ctx.lineTo(toggleX - toggleRadius, y);
                ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.35, alpha)})`;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(toggleX, y, toggleRadius, 0, Math.PI * 2);
                ctx.fillStyle = isCollapsed ? `rgba(255, 141, 58, ${alpha})` : `rgba(47, 47, 47, ${alpha})`;
                ctx.fill();
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.font = 'bold 13px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(isCollapsed ? '>' : '>', toggleX, y + 0.5);
            }

            // Draw mind map node
            ctx.beginPath();
            ctx.moveTo(pillLeft + 12, pillTop);
            ctx.lineTo(pillRight - 12, pillTop);
            ctx.quadraticCurveTo(pillRight, pillTop, pillRight, pillTop + 12);
            ctx.lineTo(pillRight, pillTop + pillHeight - 12);
            ctx.quadraticCurveTo(pillRight, pillTop + pillHeight, pillRight - 12, pillTop + pillHeight);
            ctx.lineTo(pillLeft + 12, pillTop + pillHeight);
            ctx.quadraticCurveTo(pillLeft, pillTop + pillHeight, pillLeft, pillTop + pillHeight - 12);
            ctx.lineTo(pillLeft, pillTop + 12);
            ctx.quadraticCurveTo(pillLeft, pillTop, pillLeft + 12, pillTop);
            ctx.closePath();
            ctx.fillStyle = clusterCounts
                ? d3.interpolateCool(clusterT)
                : (isSelected ? `rgba(124, 200, 255, ${alpha})` : `rgba(90, 167, 255, ${alpha})`);
            if (clusterCounts) {
                ctx.globalAlpha = alpha;
            }
            ctx.fill();
            ctx.strokeStyle = isSelected ? `rgba(255, 255, 255, ${alpha})` : `rgba(215, 236, 255, ${alpha})`;
            ctx.lineWidth = isSelected ? 2 : 1.5;
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.label, x, y);

            if (isSelected) {
                ctx.beginPath();
                ctx.arc(pillRight + 12, y, 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fill();
            }
        });

        ctx.restore();
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    function getDefaultVennSources() {
        const collKeys = Array.from(collections.keys());
        if (collKeys.length >= 2) {
            return { a: `collection_${collKeys[0]}`, b: `collection_${collKeys[1]}` };
        }
        if (collKeys.length === 1) {
            return { a: `collection_${collKeys[0]}`, b: 'selected' };
        }
        return { a: 'selected', b: 'selected' };
    }

    function getNodeIdSetFromVennSource(sourceId) {
        if (sourceId === 'selected') {
            if (currentViewId === 'Venn Diagram') return new Set(vennPinnedSelectedNodes);
            return new Set(getEffectiveSelectedNodesSet());
        }
        if (sourceId?.startsWith('collection_')) {
            const collName = sourceId.replace('collection_', '');
            const coll = collections.get(collName);
            return new Set(coll?.nodeIds || []);
        }
        return new Set();
    }

    function getVennActiveNodeIds() {
        const leftSet = getNodeIdSetFromVennSource(vennCollectionA);
        const rightSet = getNodeIdSetFromVennSource(vennCollectionB);
        const all = new Set(leftSet);
        rightSet.forEach(id => all.add(id));
        return all;
    }

    function syncVennSourcesWithOptions() {
        const options = getVennCollectionOptions();
        const values = new Set(options.map(o => o.value));
        const defaults = getDefaultVennSources();
        if (!values.has(vennCollectionA)) {
            vennCollectionA = values.has(defaults.a) ? defaults.a : 'selected';
        }
        if (!values.has(vennCollectionB)) {
            if (values.has(defaults.b) && defaults.b !== vennCollectionA) {
                vennCollectionB = defaults.b;
            } else {
                vennCollectionB = options.find(o => o.value !== vennCollectionA)?.value || defaults.b;
            }
        }
        if (!vennCollectionB) {
            vennCollectionB = options.find(o => o.value !== vennCollectionA)?.value || defaults.b;
        }
        if (vennCollectionA === vennCollectionB && options.length > 1) {
            vennCollectionB = options.find(o => o.value !== vennCollectionA)?.value || vennCollectionB;
        }
    }

    function updateVennControls() {
        const controls = document.getElementById('venn-controls');
        const selA = document.getElementById('vennCollectionA');
        const selB = document.getElementById('vennCollectionB');
        const recenterBtn = document.getElementById('venn-recenter-btn');
        if (!controls || !selA || !selB) return;

        controls.style.display = currentViewId === 'Venn Diagram' ? 'flex' : 'none';
        if (currentViewId !== 'Venn Diagram') {
            if (recenterBtn) recenterBtn.style.display = 'none';
            return;
        }

        syncVennSourcesWithOptions();
        const options = getVennCollectionOptions();
        const makeOptions = (selectEl, selectedValue) => {
            selectEl.innerHTML = '';
            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if (opt.value === selectedValue) option.selected = true;
                selectEl.appendChild(option);
            });
        };

        makeOptions(selA, vennCollectionA);
        makeOptions(selB, vennCollectionB);

        if (vennLayoutCache) {
            controls.style.left = `${vennLayoutCache.controlX}px`;
            controls.style.top = `${vennLayoutCache.controlY}px`;
        }

        if (recenterBtn) {
            const isReset = Math.abs((vennTransform?.k || 1) - 1) < 1e-6
                && Math.abs(vennTransform?.x || 0) < 1e-6
                && Math.abs(vennTransform?.y || 0) < 1e-6;
            recenterBtn.style.display = isReset ? 'none' : 'block';
            recenterBtn.style.left = '50%';
            recenterBtn.style.top = '-48px';
        }
    }

    function recenterVennDiagram() {
        vennTransform = d3.zoomIdentity;
        d3.select(canvas).call(zoomBehavior.transform, vennTransform);
        hoverVennNodeId = null;
        hoverVennSection = null;
        updateVennControls();
        draw();
    }

    function downloadVennDiagram(format) {
        if (currentViewId !== 'Venn Diagram') return;
        const targetLongestSide = 15360;
        const baseLongest = Math.max(canvas.width, canvas.height) || 1;
        const scale = targetLongestSide / baseLongest;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = Math.max(1, Math.round(canvas.width * scale));
        exportCanvas.height = Math.max(1, Math.round(canvas.height * scale));
        const ectx = exportCanvas.getContext('2d');
        ectx.imageSmoothingEnabled = true;
        ectx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
        const pngDataUrl = exportCanvas.toDataURL('image/png', 1.0);

        if (format === 'png') {
            const link = document.createElement('a');
            link.download = `venn_diagram_${Date.now()}.png`;
            link.href = pngDataUrl;
            link.click();
            return;
        }
    }

    function applyVennSelectionIds(matchIds) {
        let next = new Set(vennSelectedNodes);
        if (isSubtractMode) {
            matchIds.forEach(id => next.delete(id));
        } else if (isIntersectMode) {
            const inter = new Set();
            matchIds.forEach(id => { if (next.has(id)) inter.add(id); });
            next = inter;
        } else if (isAdditiveMode) {
            matchIds.forEach(id => next.add(id));
        } else {
            next = new Set(matchIds);
        }
        vennSelectedNodes = next;
        refreshInfoBoxFromSelection();
    }

    function circleIntersectionArea(r1, r2, d) {
        if (d >= r1 + r2) return 0;
        if (d <= Math.abs(r1 - r2)) {
            const rMin = Math.min(r1, r2);
            return Math.PI * rMin * rMin;
        }

        const alpha = Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
        const beta = Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
        const area1 = r1 * r1 * alpha;
        const area2 = r2 * r2 * beta;
        const area3 = 0.5 * Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
        return area1 + area2 - area3;
    }

    function solveCircleDistanceForOverlap(r1, r2, targetArea) {
        const maxIntersect = Math.PI * Math.min(r1, r2) * Math.min(r1, r2);
        const clampedTarget = Math.max(0, Math.min(maxIntersect, targetArea));
        if (clampedTarget <= 0) return r1 + r2;
        if (Math.abs(clampedTarget - maxIntersect) < 1e-6) return Math.abs(r1 - r2);

        let lo = Math.abs(r1 - r2);
        let hi = r1 + r2;
        for (let i = 0; i < 26; i++) {
            const mid = (lo + hi) / 2;
            const area = circleIntersectionArea(r1, r2, mid);
            if (area > clampedTarget) lo = mid;
            else hi = mid;
        }
        return (lo + hi) / 2;
    }

    function getHistogramEffectiveScope() {
        if (histogramScope !== 'full' && histogramScope !== 'selected') {
            histogramScope = selectedNodes.size > 0 ? 'selected' : 'full';
        }
        if (histogramScope === 'selected' && selectedNodes.size === 0) {
            return 'full';
        }
        return histogramScope;
    }

    function getHistogramActiveNodes() {
        if (histogramDataSource === 'selected') {
            return Array.from(selectedNodes).map(id => nodeMap.get(id)).filter(Boolean);
        }
        if (histogramDataSource?.startsWith('collection_')) {
            const collName = histogramDataSource.replace('collection_', '');
            const coll = collections.get(collName);
            if (!coll) return [];
            if (coll.nodeIds?.size) return Array.from(coll.nodeIds).map(id => nodeMap.get(id)).filter(Boolean);
            return coll.nodes || [];
        }
        return nodes;
    }

    function getHistogramDisplayMode() {
        let displayMode = currentColorMode;
        if (currentColorMode?.startsWith('var::')) {
            const parts = currentColorMode.split('::');
            const file = parts[1], variable = parts[2];
            const cfg = variableConfigs.find(c => c.fileName === file && c.variable === variable);
            if (cfg && (cfg.type === 'Categorical - Nominal' || cfg.type === 'Categorical - Ordinal')) {
                displayMode = 'centrality';
            }
        }
        return displayMode;
    }

    function getHistogramNodeValue(node, displayMode) {
        if (displayMode === 'centrality') return node.centrality || 0;
        if (displayMode === 'size') {
            const sizeSource = resolveProteinSizeSource(nodes);
            return getProteinSizeValue(node.id, sizeSource);
        }
        if (displayMode?.startsWith('var::')) {
            const parts = displayMode.split('::');
            const file = parts[1], variable = parts[2];
            const raw = accessoryVariableValues[file]?.[variable]?.get(node.id);
            if (raw === undefined || raw === null) return undefined;
            const v = +raw;
            return isNaN(v) ? undefined : v;
        }
        return undefined;
    }

    function getPieWedgeAtPoint(mx, my) {
        if (!window.pieChartWedges?.length) return null;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) / 3.5;
        const dx = mx - centerX;
        const dy = my - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > radius) return null;
        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += 2 * Math.PI;
        return window.pieChartWedges.find(w => angle >= w.startAngle && angle <= w.endAngle) || null;
    }

    function applyPieSelectionsFromSet(labelSet) {
        selectedWedges = new Set(labelSet);
        const activeNodes = getPieChartActiveNodes();
        const displayMode = currentColorMode?.startsWith('var::')
            ? (() => {
                const parts = currentColorMode.split('::');
                const file = parts[1], variable = parts[2];
                const cfg = variableConfigs.find(c => c.fileName === file && c.variable === variable);
                return (cfg && cfg.type === 'Numerical - Continuous') ? 'layer' : currentColorMode;
            })()
            : currentColorMode;
        const builtInSource = (displayMode === 'annotation' || displayMode === 'localization')
            ? resolveBuiltInColorSource(displayMode, activeNodes)
            : null;

        const matches = activeNodes.filter(node => {
            if (displayMode === 'layer') {
                const key = node.layer === 99 ? 'Disconnected' : `Layer ${node.layer}`;
                return selectedWedges.has(key);
            }
            if (displayMode === 'collection') {
                const memberships = getNodeCollectionMemberships(node.id);
                if (!memberships.length) return selectedWedges.has('No Collection');
                return memberships.some(name => selectedWedges.has(name));
            }
            if (['annotation', 'localization'].includes(displayMode)) {
                const key = getBuiltInColorValueFromSource(node.id, displayMode, builtInSource);
                return selectedWedges.has(key);
            }
            if (displayMode?.startsWith('var::')) {
                const displayParts = String(displayMode).split('::');
                const file = displayParts[1], variable = displayParts[2];
                const childMode = displayParts[3] === 'child' ? displayParts[4] : null;
                const cfg = variableConfigs.find(c => c.fileName === file && c.variable === variable);
                const valueField = childMode && cfg?.splitBase ? cfg.splitBase : variable;
                const val = accessoryVariableValues[file]?.[valueField]?.get(node.id) || 'Unknown';
                return selectedWedges.has(val);
            }
            return false;
        });
        return matches;
    }

    function applyHistogramSelectionsFromSet(startSet) {
        selectedHistogramBins = new Set(startSet);
        const activeNodes = getHistogramActiveNodes();
        const displayMode = getHistogramDisplayMode();

        const matches = activeNodes.filter(node => {
            const value = getHistogramNodeValue(node, displayMode);
            if (value === undefined || value === null) return false;
            for (const x0 of selectedHistogramBins) {
                const bin = window.histogramBins?.find(b => b.x0 === x0);
                if (bin && value >= bin.x0 && value < bin.x1) return true;
            }
            return false;
        });
        return matches;
    }

    function commitGraphSelectionsToNodes() {
        if (currentViewId === 'pie_chart') {
            const matches = selectedWedges.size > 0 ? applyPieSelectionsFromSet(selectedWedges) : [];
            if (matches.length > 0) selectNodes(matches, false, 'Pie selection commit');
            else deselectNodes();
            return;
        }

        if (currentViewId === 'histogram') {
            const matches = selectedHistogramBins.size > 0 ? applyHistogramSelectionsFromSet(selectedHistogramBins) : [];
            if (matches.length > 0) selectNodes(matches, false, 'Histogram selection commit');
            else deselectNodes();
            return;
        }

        if (currentViewId === 'Venn Diagram') {
            const matches = nodes.filter(n => vennSelectedNodes.has(n.id));
            if (matches.length > 0) selectNodes(matches, false, 'Venn selection commit');
            else deselectNodes();
        }

        // When leaving Mind Map, map selected mind map nodes to the proteins they represent
        if (currentViewId === 'Mind Map') {
            const proteinsFile = Object.keys(accessoryDataFiles).find(f => /^\d+\.clusters\.proteins\.v[\d.]+\.txt$/i.test(f));
            const rows = proteinsFile ? (accessoryDataFiles[proteinsFile].rows || []) : [];
            const headers = proteinsFile ? (accessoryDataFiles[proteinsFile].headers || []) : [];
            const clusterHeader = headers.find(h => /cluster/i.test(h) && /id/i.test(h)) || headers.find(h => /cluster/i.test(h)) || 'cluster_id';
            const proteinHeader = headers.find(h => /protein/i.test(h)) || 'protein_id';

            const selectedClusters = Array.from(mindMapSelectedNodes || []);
            const proteinIds = new Set();
            if (rows && rows.length && selectedClusters.length) {
                rows.forEach(r => {
                    const cid = String(r[clusterHeader] || '').trim();
                    const pid = String(r[proteinHeader] || '').trim();
                    if (cid && selectedClusters.includes(cid) && pid) proteinIds.add(pid);
                });
            }

            if (proteinIds.size) {
                const matches = Array.from(proteinIds).map(id => nodeMap.get(id) || nodes.find(n => n.id === id)).filter(Boolean);
                if (matches.length) selectNodes(matches, false, 'Mind Map selection commit');
                else deselectNodes();
            } else {
                deselectNodes();
            }
        }
    }

    d3.select(canvas).call(zoomBehavior).call(zoomBehavior.transform, transform);

    updateViewMenu();
    updateVennControls();
    updateEmbeddingsControls();

    document.getElementById('vennCollectionA')?.addEventListener('change', (e) => {
        vennCollectionA = e.target.value;
        if (vennCollectionA === vennCollectionB) {
            const fallback = getVennCollectionOptions().find(o => o.value !== vennCollectionA);
            if (fallback) vennCollectionB = fallback.value;
        }
        vennLayoutCache = null;
        hoverVennNodeId = null;
        hoverVennSection = null;
        updateVennControls();
        draw();
    });

    document.getElementById('vennCollectionB')?.addEventListener('change', (e) => {
        vennCollectionB = e.target.value;
        if (vennCollectionB === vennCollectionA) {
            const fallback = getVennCollectionOptions().find(o => o.value !== vennCollectionB);
            if (fallback) vennCollectionA = fallback.value;
        }
        vennLayoutCache = null;
        hoverVennNodeId = null;
        hoverVennSection = null;
        updateVennControls();
        draw();
    });

    document.getElementById('venn-recenter-btn')?.addEventListener('click', () => {
        recenterVennDiagram();
    });

    document.getElementById('venn-download-png')?.addEventListener('click', () => {
        downloadVennDiagram('png');
    });

    document.getElementById('scatterXVariable')?.addEventListener('change', (e) => {
        scatterXVariable = e.target.value;
        if (scatterXVariable === scatterYVariable) {
            const fallback = getScatterVariableOptions().find(o => o.value !== scatterXVariable);
            if (fallback) scatterYVariable = fallback.value;
        }
        ensureScatterEigenCentrality();
        if (currentViewId === 'Scatter Plot') {
            startScatterPlotAsyncLoading();
        } else {
            draw();
        }
    });

    document.getElementById('scatterYVariable')?.addEventListener('change', (e) => {
        scatterYVariable = e.target.value;
        if (scatterYVariable === scatterXVariable) {
            const fallback = getScatterVariableOptions().find(o => o.value !== scatterYVariable);
            if (fallback) scatterXVariable = fallback.value;
        }
        ensureScatterEigenCentrality();
        if (currentViewId === 'Scatter Plot') {
            startScatterPlotAsyncLoading();
        } else {
            draw();
        }
    });

    document.getElementById('scatter-recenter-btn')?.addEventListener('click', () => {
        recenterScatterPlot();
    });

    document.getElementById('embeddingTypeNetwork')?.addEventListener('click', async () => {
        if (embeddingViewType === 'network') return;
        embeddingViewType = 'network';
        markEmbeddingsDirty(true);
        await refreshEmbeddingsView(true);
    });

    document.getElementById('embeddingTypeSequence')?.addEventListener('click', async () => {
        if (embeddingViewType === 'sequence') return;
        embeddingViewType = 'sequence';
        markEmbeddingsDirty(true);
        await refreshEmbeddingsView(true);
    });

    document.getElementById('embeddingDim2d')?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        embeddingSelectionSuppressUntil = Date.now() + 600;
        embeddingIgnoreBgClicksUntil = Date.now() + 600;
        if (embeddingUmapDimension === '2d') return;
        embeddingUmapDimension = '2d';
        markEmbeddingsDirty(true);
        await refreshEmbeddingsView(false);
    });

    document.getElementById('embeddingDim3d')?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        embeddingSelectionSuppressUntil = Date.now() + 600;
        embeddingIgnoreBgClicksUntil = Date.now() + 600;
        if (embeddingUmapDimension === '3d') return;
        embeddingUmapDimension = '3d';
        markEmbeddingsDirty(true);
        await refreshEmbeddingsView(false);
    });

    document.getElementById('embeddings-download-png')?.addEventListener('click', async () => {
        await downloadEmbeddingPng();
    });

    document.addEventListener('contextmenu', (e) => {
        console.log("CAPTURE contextmenu fired on:", e.target, "| tag:", e.target.tagName, "| id:", e.target.id, "| class:", e.target.className);
        const item = e.target.closest('.view-option-item');
        console.log("Closest .view-option-item:", item);
        if (!item) return;

        e.preventDefault();
        e.stopPropagation();

        console.log("Right-click detected on:", item.dataset.collName);

        window.targetCollectionToRename = item.dataset.collName;

        const menu = document.getElementById('custom-context-menu');
        menu.style.display = 'block';
        menu.style.left = e.clientX + 'px';
        menu.style.top = (e.clientY - 10) + 'px';

        d3.select("#view-selector-box").classed('locked-open', true);
    }, true);

    window.addEventListener('contextmenu', (e) => {
        console.log("WINDOW contextmenu — target:", e.target.tagName, e.target.className);
    }, true);

    function openModal(id) { 
        console.log("function openModal(id: " + id + ")");
        d3.select(`#${id}`).style("display", "block"); 
    }

    function closeModal(id) { 
        console.log("function closeModal(id: " + id + ")");
        d3.select(`#${id}`).style("display", "none");
        if (id === 'variablesModal') isVariableSettingsOpen = false;
        closeCollectionMenu();
    }
    window.onclick = (e) => { if (e.target.className === 'modal') closeModal(e.target.id); };

    // Variable settings state
    const AUTO_HIDE_VARIABLE_NAMES = new Set([
        'cluster_size',
        'best_described_by',
        'cluster_id',
        'parent_cluster_id',
        'source',
        'category',
        'term',
        'protein_id',
        'alias',
        '#protein',
        'taxonomy_level',
        'orthologous_group_or_ortholog',
        'sequence',
        'protein_size',
        'description',
        'annotation',
    ]);
    var accessoryDataFiles = window.accessoryDataFiles || {}; // filename -> {headers:[], rows:[{}], text: ''}
    window.accessoryDataFiles = accessoryDataFiles;
    var accessoryVariableValues = window.accessoryVariableValues || {}; // filename -> variable -> Map(nodeId -> value)
    window.accessoryVariableValues = accessoryVariableValues;
    var variableConfigs = window.variableConfigs || [];
    window.variableConfigs = variableConfigs;
    let variableFilterText = '';
    var uploadedFileViewerData = window.uploadedFileViewerData || {}; // filename -> { text: '' }
    window.uploadedFileViewerData = uploadedFileViewerData;
    var interactionParsedEdgeCounts = window.interactionParsedEdgeCounts || {}; // filename -> parsed edge count
    window.interactionParsedEdgeCounts = interactionParsedEdgeCounts;
    var loadedInteractionFileNames = window.loadedInteractionFileNames || [];
    window.loadedInteractionFileNames = loadedInteractionFileNames;
    var loadedAccessoryFileNames = window.loadedAccessoryFileNames || [];
    window.loadedAccessoryFileNames = loadedAccessoryFileNames;
    var uploadedInteractionFiles = window.uploadedInteractionFiles || {}; // filename -> text
    window.uploadedInteractionFiles = uploadedInteractionFiles;
    var uploadedAccessoryFiles = window.uploadedAccessoryFiles || {}; // filename -> text
    window.uploadedAccessoryFiles = uploadedAccessoryFiles;
    var uploadedEmbeddingFiles = window.uploadedEmbeddingFiles || {}; // filename -> { kind, summary }
    window.uploadedEmbeddingFiles = uploadedEmbeddingFiles;
    var sessionSettingDefaults = window.sessionSettingDefaults || new Map();
    window.sessionSettingDefaults = sessionSettingDefaults;
    var pendingSessionRestore = false;
    var sessionRestoreAppliedSignature = '';

    function getDefaultSessionFolderName() {
        const prefixes = getAllTaxonIdPrefixes();
        if (prefixes.size === 1) return `Taxon_${Array.from(prefixes)[0]}_session`;
        const seedText = document.getElementById('seedInput')?.value?.trim() || '';
        const seedPrefix = seedText.split(/[\s,]+/).find(Boolean)?.split('.')[0];
        if (seedPrefix) return `Taxon_${seedPrefix}_session`;
        return 'Taxon_session';
    }

    function openDownloadSessionModal() {
        const modal = document.getElementById('downloadSessionModal');
        if (!modal) return;
        document.getElementById('downloadSessionFolderName').value = getDefaultSessionFolderName();
        const selectAll = document.getElementById('downloadSessionSelectAll');
        const options = Array.from(document.querySelectorAll('.download-session-option'));
        if (selectAll) selectAll.checked = true;
        options.forEach(option => { option.checked = true; });
        modal.style.display = 'block';
    }

    function closeDownloadSessionModal() {
        const modal = document.getElementById('downloadSessionModal');
        if (modal) modal.style.display = 'none';
    }

    function shouldIncludeStringScapeLogo() {
        return document.getElementById('includeStringScapeLogo')?.checked !== false;
    }

    function getStringScapeLogoBaseLayout(width, height) {
        const minDim = Math.min(width, height);
        const scale = Math.max(3.85, minDim / 2200);
        const padding = Math.max(0.1, minDim * 0.03);
        return {
            scale,
            padding,
            iconSize: 90 * scale,
            gap: 0.3 * scale,
            fontSize: 42 * scale,
        };
    }

    function drawStringScapeLogoOnCanvas(ctx, width, height) {
        if (!shouldIncludeStringScapeLogo()) return;

        const { scale, padding, iconSize, gap, fontSize } = getStringScapeLogoBaseLayout(width, height);
        const text = 'StringScape';

        ctx.save();
        ctx.globalAlpha = 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.font = `700 ${fontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const textWidth = ctx.measureText(text).width;
        const totalWidth = iconSize + gap + textWidth;
        const totalHeight = Math.max(iconSize, fontSize * 1.1);
        const originX = width - padding - totalWidth;
        const originY = height - padding - totalHeight;
        const iconX = originX;
        const iconY = originY + (totalHeight) / 2 - 67;
        const textX = iconX + 150 + gap;
        const textY = originY + totalHeight / 2;

        ctx.fillStyle = '#888';
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2.5 * scale;

        ctx.save();
        ctx.translate(iconX + 13 * scale, iconY + 11 * scale);
        ctx.rotate(-Math.PI / 6);
        ctx.fillRect(-7 * scale, -1.25 * scale, 14 * scale, 2.5 * scale);
        ctx.restore();

        ctx.save();
        ctx.translate(iconX + 22 * scale, iconY + 14 * scale);
        ctx.rotate(Math.PI / 2);
        ctx.fillRect(-7 * scale, -1.25 * scale, 14 * scale, 2.5 * scale);
        ctx.restore();

        ctx.fillStyle = '#3498db';
        ctx.strokeStyle = '#6dc5ff';
        ctx.lineWidth = 1.5 * scale;

        const circleRadius = 5 * scale;
        const circles = [
            { x: iconX + 7 * scale, y: iconY + 12 * scale },
            { x: iconX + 23 * scale, y: iconY + 5 * scale },
            { x: iconX + 23 * scale, y: iconY + 23 * scale },
        ];
        circles.forEach(({ x, y }) => {
            ctx.beginPath();
            ctx.arc(x, y, circleRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        });

        ctx.lineWidth = 3 * scale;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillStyle = '#f5f8ff';
        ctx.strokeText(text, textX, textY);
        ctx.fillText(text, textX, textY);
        ctx.restore();
    }

    function getStringScapeLogoSvg(width, height) {
        if (!shouldIncludeStringScapeLogo()) return '';

        const { scale, padding, iconSize, gap, fontSize } = getStringScapeLogoBaseLayout(width, height);
        const estimatedTextWidth = fontSize * 5.8;
        const totalWidth = iconSize + gap + estimatedTextWidth;
        const totalHeight = Math.max(iconSize, fontSize * 1.1);
        const originX = width - padding - totalWidth;
        const originY = height - padding - totalHeight;
        const iconX = originX + (5 * scale);;
        const iconY = originY + (totalHeight - iconSize) / 2 + (12 * scale);
        const textX = iconX + (30 * scale) + gap; 
        const textY = originY + totalHeight / 2 + (5 * scale); 

        return `
            <g>
                <g transform="translate(${iconX} ${iconY}) scale(${scale})">
                    <line x1="6" y1="10" x2="20" y2="10" stroke="#888" stroke-width="2.5" transform="rotate(-30 13 11)" stroke-linecap="round" />
                    <line x1="13" y1="13" x2="13" y2="27" stroke="#888" stroke-width="2.5" transform="rotate(90 13 14)" stroke-linecap="round" />
                    <circle cx="7" cy="12" r="5" fill="#3498db" stroke="#6dc5ff" stroke-width="1.5" />
                    <circle cx="23" cy="5" r="5" fill="#3498db" stroke="#6dc5ff" stroke-width="1.5" />
                    <circle cx="23" cy="23" r="5" fill="#3498db" stroke="#6dc5ff" stroke-width="1.5" />
                </g>
                <text 
                x="${textX}" 
                y="${textY}" 
                style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;" 
                font-size="${fontSize}" 
                font-weight="700" 
                fill="#f5f8ff" 
                stroke="rgba(0, 0, 0, 0.7)" 
                stroke-width="${3 * scale}" 
                paint-order="stroke fill" 
                dominant-baseline="middle"
                >StringScape</text>            
                </g>`;
    }

    function captureSessionSettingDefaults() {
        const elements = Array.from(document.querySelectorAll('#right-panel input, #right-panel select, #right-panel textarea, #variables-settings-modal input, #variables-settings-modal select, #variables-settings-modal textarea'))
            .filter(el => el && el.id && !['file','button','submit','reset','image'].includes((el.type || '').toLowerCase()));
        elements.forEach(el => {
            if (!sessionSettingDefaults.has(el.id)) {
                sessionSettingDefaults.set(el.id, el.type === 'checkbox' || el.type === 'radio' ? !!el.checked : String(el.value ?? ''));
            }
        });
    }

    function getSessionSettingElements() {
        return Array.from(document.querySelectorAll('#right-panel input, #right-panel select, #right-panel textarea, #variables-settings-modal input, #variables-settings-modal select, #variables-settings-modal textarea'))
            .filter(el => el && el.id && !['file','button','submit','reset','image'].includes((el.type || '').toLowerCase()) && !/(search|filter|viewer|chat|prompt)/i.test(el.id));
    }

    function getSessionSettingValue(el) {
        if (!el) return '';
        return el.type === 'checkbox' || el.type === 'radio' ? !!el.checked : String(el.value ?? '');
    }

    function collectChangedSessionSettings() {
        const lines = [];
        getSessionSettingElements().forEach(el => {
            const defaultValue = sessionSettingDefaults.has(el.id) ? sessionSettingDefaults.get(el.id) : (el.type === 'checkbox' || el.type === 'radio' ? false : '');
            const currentValue = getSessionSettingValue(el);
            if (String(currentValue) !== String(defaultValue)) {
                lines.push(`${el.id}: ${currentValue}`);
            }
        });
        return lines.join('\n');
    }

    function parseSessionTextList(text) {
        return String(text || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }

    function parseSessionNodePositionsJSON(text) {
        if (!text) return null;
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { return null; }
        const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.nodes) ? parsed.nodes : null;
        if (!source) return null;
        const positions = new Map();
        source.forEach(item => {
            const id = item?.id ?? item?.name ?? item?.nodeId;
            const x = Number(item?.x);
            const y = Number(item?.y);
            if (id !== undefined && id !== null && Number.isFinite(x) && Number.isFinite(y)) {
                positions.set(String(id), { x, y, fx: Number.isFinite(Number(item?.fx)) ? Number(item.fx) : null, fy: Number.isFinite(Number(item?.fy)) ? Number(item.fy) : null });
            }
        });
        return positions.size ? positions : null;
    }

    function getUploadedSessionNodePositions() {
        for (const [name, text] of Object.entries(uploadedAccessoryFiles || {})) {
            if (!/\.json$/i.test(name) && !/node.*position|position.*node|session.*json/i.test(name)) continue;
            const positions = parseSessionNodePositionsJSON(text);
            if (positions) return { fileName: name, positions };
        }
        return null;
    }

    function parseCollectionsText(text) {
        const collectionsOut = [];
        let currentName = '';
        let currentNodes = [];
        const flush = () => {
            if (currentName) collectionsOut.push({ name: currentName, nodeIds: currentNodes.slice() });
            currentName = '';
            currentNodes = [];
        };
        parseSessionTextList(text).forEach(line => {
            const collectionMatch = line.match(/^collection\s*[:=]\s*(.+)$/i);
            if (collectionMatch) { flush(); currentName = collectionMatch[1].trim(); return; }
            const nodesMatch = line.match(/^nodes?\s*[:=]\s*(.+)$/i);
            if (nodesMatch) {
                currentNodes = nodesMatch[1].split(/[,;\t]/).map(s => s.trim()).filter(Boolean);
                return;
            }
            const inlineMatch = line.match(/^(.+?)\s*[:=]\s*(.+)$/);
            if (inlineMatch) {
                flush();
                currentName = inlineMatch[1].trim();
                currentNodes = inlineMatch[2].split(/[,;\t]/).map(s => s.trim()).filter(Boolean);
                return;
            }
            if (!currentName) {
                currentName = line.trim();
            } else {
                currentNodes.push(...line.split(/[,;\t]/).map(s => s.trim()).filter(Boolean));
            }
        });
        flush();
        return collectionsOut.filter(item => item.name);
    }

    function parseSelectedNodesText(text) {
        return parseSessionTextList(text).flatMap(line => line.split(/[,;\t]/).map(s => s.trim()).filter(Boolean)).filter(Boolean);
    }

    function parseChangedSettingsText(text) {
        const entries = [];
        parseSessionTextList(text).forEach(line => {
            const match = line.match(/^([^:=]+)\s*[:=]\s*(.*)$/);
            if (!match) return;
            entries.push({ key: match[1].trim(), value: match[2].trim() });
        });
        return entries;
    }

    function applySessionSettingValue(key, value) {
        const el = document.getElementById(key) || Array.from(document.querySelectorAll(`#right-panel [name="${CSS.escape(key)}"], #variables-settings-modal [name="${CSS.escape(key)}"]`))[0];
        if (!el) return false;
        if (el.type === 'checkbox') {
            el.checked = /^(true|1|yes|on)$/i.test(String(value));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }
        if (el.type === 'radio') {
            const radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`));
            radios.forEach(radio => { radio.checked = radio.value === String(value); });
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function applyNodePositionsFromSession() {
        const sessionPositions = getUploadedSessionNodePositions();
        if (!sessionPositions || !nodes.length) return false;
        sessionPositions.positions.forEach((pos, id) => {
            const node = nodeMap.get(id) || nodes.find(n => n.id === id);
            if (!node) return;
            node.x = pos.x;
            node.y = pos.y;
            if (Number.isFinite(pos.fx)) node.fx = pos.fx;
            if (Number.isFinite(pos.fy)) node.fy = pos.fy;
        });
        return true;
    }

    function restoreCollectionsFromSession() {
        const source = Object.entries(uploadedAccessoryFiles || {}).find(([name]) => /collections\.txt$/i.test(name));
        if (!source) return false;
        const parsed = parseCollectionsText(source[1]);
        if (!parsed.length) return false;
        collections = new Map();
        parsed.forEach(item => {
            const matchingNodes = item.nodeIds.map(id => nodeMap.get(id) || nodes.find(n => n.id === id)).filter(Boolean);
            collections.set(item.name, { nodeIds: new Set(matchingNodes.map(n => n.id)), nodes: matchingNodes.slice(), links: [] });
        });
        refreshLegendIfCollectionMode();
        updateViewMenu();
        return true;
    }

    function restoreSelectedNodesFromSession() {
        const source = Object.entries(uploadedAccessoryFiles || {}).find(([name]) => /currently_selected_nodes\.txt$/i.test(name) || /selected_nodes\.txt$/i.test(name));
        if (!source) return false;
        const ids = parseSelectedNodesText(source[1]);
        if (!ids.length) return false;
        const targets = ids.map(id => nodeMap.get(id) || nodes.find(n => n.id === id)).filter(Boolean);
        if (!targets.length) return false;
        selectNodes(targets, false, 'Session restore', null, true);
        return true;
    }

    function restoreChangedSettingsFromSession() {
        const source = Object.entries(uploadedAccessoryFiles || {}).find(([name]) => /changed_settings\.txt$/i.test(name));
        if (!source) return false;
        const entries = parseChangedSettingsText(source[1]);
        if (!entries.length) return false;
        let changed = false;
        entries.forEach(entry => { if (applySessionSettingValue(entry.key, entry.value)) changed = true; });
        if (changed) {
            try { updateSizesAndColors(); } catch (e) {}
            try { draw(); } catch (e) {}
            try { updateViewMenu(); } catch (e) {}
        }
        return changed;
    }

    async function applyUploadedSessionFiles() {
        if (!nodes.length || !nodeMap.size) {
            pendingSessionRestore = true;
            return false;
        }
        const signature = [
            Object.keys(uploadedAccessoryFiles || {}).sort().join('|'),
            Object.keys(uploadedInteractionFiles || {}).sort().join('|'),
            nodes.length,
            links.length
        ].join('::');
        if (signature === sessionRestoreAppliedSignature) return false;
        pendingSessionRestore = false;
        let positionsApplied = applyNodePositionsFromSession();
        restoreCollectionsFromSession();
        restoreChangedSettingsFromSession();
        restoreSelectedNodesFromSession();
        if (positionsApplied) {
            try { draw(); } catch (e) {}
            if (physicsEnabled) {
                restartActivePhysics((isBuilding || isSettling) ? 0.5 : +document.getElementById('alphaSlider').value);
            }
        }
        sessionRestoreAppliedSignature = signature;
        return true;
    }

    async function downloadSessionFiles() {
        const folderNameInput = document.getElementById('downloadSessionFolderName');
        const folderName = (folderNameInput?.value || '').trim() || getDefaultSessionFolderName();
        const choices = {
            uploadedFiles: document.getElementById('downloadSessionUploadedFiles')?.checked,
            nodePositions: document.getElementById('downloadSessionNodePositions')?.checked,
            collections: document.getElementById('downloadSessionCollections')?.checked,
            selectedNodes: document.getElementById('downloadSessionSelectedNodes')?.checked,
            changedSettings: document.getElementById('downloadSessionChangedSettings')?.checked
        };
        const files = [];
        if (choices.uploadedFiles) {
            Object.entries(uploadedInteractionFiles || {}).forEach(([name, text]) => files.push([name, text, 'text/plain;charset=utf-8;']));
            Object.entries(uploadedAccessoryFiles || {}).forEach(([name, text]) => files.push([name, text, 'text/plain;charset=utf-8;']));
        }
        if (choices.nodePositions) {
            const payload = {
                format: 'StringScape node positions',
                nodes: nodes.map(node => ({ id: node.id, x: node.x, y: node.y, fx: Number.isFinite(node.fx) ? node.fx : null, fy: Number.isFinite(node.fy) ? node.fy : null, layer: node.layer ?? null }))
            };
            files.push(['current_node_positions.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8;']);
        }
        if (choices.collections) {
            const lines = [];
            collections.forEach((collection, name) => {
                const nodeIds = Array.from(collection?.nodeIds || collection?.nodes || []).map(item => item?.id ?? item).filter(Boolean);
                lines.push(`Collection: ${name}`);
                lines.push(`Nodes: ${nodeIds.join(', ')}`);
                lines.push('');
            });
            files.push(['collections.txt', lines.join('\n').trim() + '\n', 'text/plain;charset=utf-8;']);
        }
        if (choices.selectedNodes) {
            const ids = Array.from(getEffectiveSelectedNodesSet ? getEffectiveSelectedNodesSet() : selectedNodes).filter(Boolean);
            files.push(['currently_selected_nodes.txt', ids.join('\n') + (ids.length ? '\n' : ''), 'text/plain;charset=utf-8;']);
        }
        if (choices.changedSettings) {
            const text = collectChangedSessionSettings();
            files.push(['changed_settings.txt', (text ? text + '\n' : ''), 'text/plain;charset=utf-8;']);
        }

        if (!files.length) {
            alert('Select at least one session file type to download.');
            return;
        }

        try {
            if (window.showDirectoryPicker) {
                const parentDir = await window.showDirectoryPicker({ mode: 'readwrite' });
                const sessionDir = await parentDir.getDirectoryHandle(folderName, { create: true });
                for (const [name, content, mime] of files) {
                    const fileHandle = await sessionDir.getFileHandle(name, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(new Blob([content], { type: mime }));
                    await writable.close();
                }
            } else {
                files.forEach(([name, content, mime]) => {
                    const blob = new Blob([content], { type: mime });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = name;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                });
            }
            closeDownloadSessionModal();
        } catch (error) {
            console.warn('Session download failed', error);
            alert('Could not open a folder picker in this browser. If supported, use a Chromium-based browser to download into a chosen folder.');
        }
    }

    const selectAllEl = document.getElementById('downloadSessionSelectAll');
    if (selectAllEl) {
        selectAllEl.addEventListener('change', () => {
            document.querySelectorAll('.download-session-option').forEach(el => { el.checked = selectAllEl.checked; });
        });
    }
    document.querySelectorAll('.download-session-option').forEach(el => {
        el.addEventListener('change', () => {
            const optionStates = Array.from(document.querySelectorAll('.download-session-option')).map(item => item.checked);
            if (selectAllEl) selectAllEl.checked = optionStates.length > 0 && optionStates.every(Boolean);
        });
    });

    captureSessionSettingDefaults();
function renderUploadedFileList(containerId, fileNames, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'upload-inline-open-btn';
        openButton.textContent = options.openLabel || 'Open Files';
        openButton.onclick = () => {
            closeWelcomeOverlay();
            if (options.inputId) document.getElementById(options.inputId)?.click();
        };
        container.appendChild(openButton);

        const itemsWrap = document.createElement('div');
        itemsWrap.className = 'uploaded-file-items';
        container.appendChild(itemsWrap);

        if (!fileNames || !fileNames.length) {
            const empty = document.createElement('span');
            empty.className = 'uploaded-file-list-empty';
            empty.textContent = 'No files uploaded';
            itemsWrap.appendChild(empty);
            return;
        }

        fileNames.forEach(name => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'uploaded-file-chip';
            chip.title = name;

            const label = document.createElement('span');
            label.className = 'uploaded-file-chip-label';
            label.textContent = name;

            const remove = document.createElement('span');
            remove.className = 'uploaded-file-chip-remove';
            remove.textContent = '×';
            remove.title = 'Remove file';
            remove.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (typeof options.onRemove === 'function') options.onRemove(name);
            };

            chip.appendChild(label);
            chip.appendChild(remove);
            chip.onclick = () => openFileViewer(name);
            itemsWrap.appendChild(chip);
        });
    }

    function updateUploadedListsUI() {
        loadedInteractionFileNames = Object.keys(uploadedInteractionFiles);
        loadedAccessoryFileNames = [
            ...Object.keys(uploadedAccessoryFiles),
            ...Object.keys(uploadedEmbeddingFiles)
        ];

        renderUploadedFileList('fileInputList', loadedInteractionFileNames, {
            inputId: 'fileInput',
            openLabel: 'Open File',
            onRemove: removeInteractionUpload
        });
        renderUploadedFileList('infoInputList', loadedAccessoryFileNames, {
            inputId: 'infoInput',
            openLabel: 'Open Files',
            onRemove: removeAccessoryUpload
        });
    }

    function refreshVariableFileList() {
        console.log("function refreshVariableFileList()");
        const files = Object.keys(accessoryDataFiles);
        const el = document.getElementById('variables-file-list');
        if (el) {
            el.textContent = files.length ? files.join(', ') : 'None';
        }
    }

    function inferVarType(values) {
        console.log("function inferVarType(values: " + values.length + ")");
        const normalized = values.map(v => (v === undefined || v === null ? '' : String(v).trim())).filter(v => v !== '');
        if (!normalized.length) return 'Categorical - Nominal';

        const numericValues = normalized.map(v => +v).filter(v => v !== '' && !isNaN(v));
        const allNumeric = numericValues.length === normalized.length;

        if (allNumeric) {
            const allInt = numericValues.every(v => Number.isInteger(v));
            return allInt ? 'Numerical - Discrete' : 'Numerical - Continuous';
        }

        // default to categorical nominal (ordinal requires explicit user setting)
        return 'Categorical - Nominal';
    }

    function shouldAutoHideVariable(values) {
        console.log("function shouldAutoHideVariable(values: " + values.length + ")");
        if (!values || values.length === 0) return false;
        const normalized = values.map(v => (v === undefined || v === null ? '' : String(v).trim()));
        const uniqueCount = new Set(normalized).size;
        const fullCount = normalized.length;
        if (uniqueCount <= 1) return true; // all identical
        if (uniqueCount === fullCount) return true; // all unique
        return false;
    }

    function buildVariableConfigs() {
        console.log("function buildVariableConfigs()");
        // Initialize variable configs only for loaded files/headers not already tracked.
        Object.entries(accessoryDataFiles).forEach(([fileName, data]) => {
            data.headers.forEach(header => {
                if (header.toLowerCase() === '#string_protein_id') return;
                const exists = variableConfigs.some(c => c.fileName === fileName && c.variable === header);
                const vals = data.rows.map(r => r[header] || '');
                const type = inferVarType(vals);
                const hiddenSuggested = shouldAutoHideVariable(vals);
                const forceHidden = AUTO_HIDE_VARIABLE_NAMES.has(String(header || '').trim().toLowerCase());
                if (!exists) {
                    variableConfigs.push({ fileName, variable: header, label: header, type, split: false, splitBase: null, splitChildren: {}, hidden: hiddenSuggested || forceHidden });
                } else {
                    // keep existing manual hide/unhide but auto-hide if now all unique/identical and not already set to visible
                    const existing = variableConfigs.find(c => c.fileName === fileName && c.variable === header);
                    if (existing && (hiddenSuggested || forceHidden)) existing.hidden = true;
                    existing.type = type; // keep type synced (optional)
                }
            });
        });
        // no removal; keep old file configs in table even if accessory file unloaded
        // variableConfigs = variableConfigs.filter(c => accessoryDataFiles[c.fileName]);

        // Populate variableConfigMap for tools (View_variables, Change_node_colouring, etc.)
        variableConfigMap.clear();
        variableConfigs.forEach(cfg => {
            const key = getVariableModeKey(cfg);
            let min = null, max = null, categories = null;
            const valsMap = accessoryVariableValues?.[cfg.fileName]?.[cfg.variable];
            if (valsMap) {
                const vals = Array.from(valsMap.values()).map(v => (v === undefined || v === null) ? '' : String(v).trim()).filter(v => v !== '');
                const numeric = vals.map(v => +v).filter(v => v !== '' && !isNaN(v));
                if (vals.length && numeric.length === vals.length) {
                    min = Math.min(...numeric);
                    max = Math.max(...numeric);
                } else {
                    categories = Array.from(new Set(vals));
                }
            }
            variableConfigMap.set(key, { fileName: cfg.fileName, variable: cfg.variable, label: cfg.label, type: cfg.type, min, max, categories });
        });
        window.variableConfigMap = variableConfigMap;
    }

    function getVisibleColorModeVariableEntries() {
        const entries = [];

        // 1. Built-in colour mode options
        const builtins = [
            { key: 'layer', label: 'Degrees of Separation', type: 'Numerical - Discrete' },
            { key: 'centrality', label: 'Centrality', type: 'Numerical - Continuous' },
            { key: 'eigen', label: 'Eigenvector centrality', type: 'Numerical - Continuous' },
            { key: 'pdb_structure_count', label: 'PDB structure count', type: 'Numerical - Continuous' },
            { key: 'complex_pdbs', label: 'Complex PDBs', type: 'Categorical - Nominal' },
            { key: 'embeddings', label: 'Embeddings', type: 'Numerical - Continuous' },
            { key: 'collection', label: 'Collection', type: 'Categorical - Nominal' },
            { key: 'annotation', label: 'Annotation length', type: 'Numerical - Discrete' },
            { key: 'localization', label: 'Protein localisation', type: 'Categorical - Nominal' },
            { key: 'biological_process', label: 'Biological process (mind-map most specific)', type: 'Categorical - Nominal' },
            { key: 'size', label: 'Protein size', type: 'Numerical - Continuous' },
            { key: 'random', label: 'Random', type: 'Categorical - Nominal' },
            { key: 'mono', label: 'Mono', type: 'Categorical - Nominal' }
        ];

        // Add built-ins to entries (without computing min/max/categories)
        builtins.forEach(b => {
            entries.push({ 
                ...b, 
                min: null, 
                max: null, 
                categories: null 
            });
        });

        // 2. Add accessory file variables (visible ones)
        const visibleVariableConfigs = variableConfigs.filter(cfg => !cfg.hidden);
        
        visibleVariableConfigs.forEach(cfg => {
            const key = getVariableModeKey(cfg);
            const isSplitParent = cfg.split && cfg.splitBase && accessoryDataFiles[cfg.fileName];

            if (!isSplitParent) {
                entries.push({
                    key: key,
                    label: cfg.label,
                    type: cfg.type,
                    fileName: cfg.fileName,
                    variable: cfg.variable,
                    min: null,
                    max: null,
                    categories: null
                });
            }

            if (isSplitParent) {
                const fileData = accessoryDataFiles[cfg.fileName];
                // Get unique values for the split
                const groupValues = Array.from(new Set(
                    fileData.rows
                        .map(r => r[cfg.splitBase])
                        .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
                ));

                groupValues.forEach(gv => {
                    const childCfg = cfg.splitChildren[gv] || {};
                    if (childCfg.hidden) return;
                    const childLabel = (normalizeVariableKey(cfg.variable) === 'description' && /\.protein\.enrichment\.terms\./i.test(cfg.fileName))
                        ? (childCfg.label || gv)
                        : `${cfg.label} - ${childCfg.label || gv}`;

                    entries.push({
                        key: `${key}::child::${gv}`,
                        label: childLabel,
                        type: childCfg.type || cfg.type,
                        fileName: cfg.fileName,
                        variable: cfg.variable,
                        splitBase: cfg.splitBase,
                        splitChild: gv,
                        min: null,
                        max: null,
                        categories: null
                    });
                });
            }
        });

        return entries;
    }

    function updateVariablesModalHeight() {
        console.log("function updateVariablesModalHeight()");
        const modalContent = document.querySelector('#variablesModal .modal-content');
        if (!modalContent) return;
        const marginTop = 20;
        const marginBottom = 100;
        const targetHeight = Math.max(200, window.innerHeight - marginTop - marginBottom);
        modalContent.style.top = `${marginTop}px`;
        modalContent.style.bottom = `${marginBottom}px`;
        modalContent.style.height = `${targetHeight}px`;
        modalContent.style.maxHeight = `${targetHeight}px`;

        const tableContainer = document.getElementById('variables-table-container');
        if (tableContainer) {
            const spaceForControls = 120; // header + filter row + padding
            const tableHeight = Math.max(120, targetHeight - spaceForControls);
            tableContainer.style.height = `${tableHeight}px`;
            tableContainer.style.maxHeight = `${tableHeight}px`;
        }
    }

    window.addEventListener('resize', updateVariablesModalHeight);

    function openVariableSettings() {
        console.log("function openVariableSettings()");
        isVariableSettingsOpen = true;
        // deactivate brush/lasso while variable settings are open
        isBrushMode = false;
        isLassoMode = false;
        document.getElementById('brushBtn').classList.remove('active');
        document.getElementById('lassoBtn').classList.remove('active');
        updateCanvasCursor();

        updateVariablesModalHeight();
        openModal('variablesModal');
        const container = document.getElementById('variables-table-container');
        if (container) container.innerHTML = '<div style="color:#ccc;">Loading variable settings...</div>';

        const filterInput = document.getElementById('variable-filter');
        if (filterInput) {
            variableFilterText = '';
            filterInput.value = '';
            filterInput.oninput = (e) => {
                variableFilterText = e.target.value.toLowerCase().trim();
                renderVariableTable();
            };
        }

        setTimeout(() => {
            buildVariableConfigs();
            renderVariableTable();
            updateColorModeOptions();
        }, 10);
    }

    function getVariableModeKey(cfg) {
        console.log("function getVariableModeKey(cfg: " + cfg.variable + ")");
        return `var::${cfg.fileName}::${cfg.variable}`;
    }

    function getVariableTypeColor(type) {
        console.log("function getVariableTypeColor(type: " + type + ")");
        if (type && type.startsWith('Categorical')) return '#ff9800';
        if (type && type.startsWith('Numerical')) return '#93c5fd';
        return '#ccc';
    }

    function setVariableTypeSelectColor(selectEl, type) {
        console.log("function setVariableTypeSelectColor(selectEl, type: " + type + ")");
        const color = getVariableTypeColor(type);
        selectEl.style.background = type && type.startsWith('Categorical') ? '#ff9800' : (type && type.startsWith('Numerical') ? '#1b5f8f' : '#444');
        selectEl.style.color = (type && type.startsWith('Categorical')) ? '#000' : '#fff';
        selectEl.style.border = '1px solid #555';
    }

    function updateColorModeOptions() {
        console.log("function updateColorModeOptions()");
        const select = document.getElementById('colorMode');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '';

        const defaults = [
            {value:'layer', text:'Degrees of separation', color:'#93c5fd'},
            {value:'centrality', text:'Centrality', color:'#93c5fd'},
            {value:'eigen', text:'Eigenvector centrality', color:'#93c5fd'},
            {value:'pdb_structure_count', text:'PDB structure count', color:'#93c5fd'},
            {value:'complex_pdbs', text:'Complex PDBs', color:'#ccc'},
            {value:'embeddings', text:'Embeddings', color:'#93c5fd'},
            {value:'collection', text:'Collection', color:'#ccc'},
            {value:'annotation', text:'Annotation length', color:'#93c5fd'},
            {value:'localization', text:'Protein localisation', color:'#ccc'},
            {value:'biological_process', text:'Biological process (mind-map most specific)', color:'#ccc'},
            {value:'size', text:'Protein size', color:'#93c5fd'},
            {value:'random', text:'Random', color:'#ffffff'},
            {value:'mono', text:'Mono', color:'#ffffff'}
        ];

        const variableTypeOptions = [
            {value: 'Categorical - Nominal', text: 'Categorical - Nominal'},
            {value: 'Categorical - Ordinal', text: 'Categorical - Ordinal'},
            {value: 'Numerical - Discrete', text: 'Numerical - Discrete'},
            {value: 'Numerical - Continuous', text: 'Numerical - Continuous'}
        ];
        defaults.forEach(opt => {
            const o = document.createElement('option'); o.value = opt.value; o.textContent = opt.text;
            if (opt.color) o.style.color = opt.color;
            select.appendChild(o);
        });

        const visibleVariableConfigs = variableConfigs.filter(cfg => !cfg.hidden);
        if (visibleVariableConfigs.length) {
            const group = document.createElement('optgroup'); group.label = 'Variables';
            visibleVariableConfigs.forEach(cfg => {
                const isSplitParent = cfg.split && cfg.splitBase && accessoryDataFiles[cfg.fileName];
                if (!isSplitParent) {
                    const o = document.createElement('option');
                    o.value = getVariableModeKey(cfg);
                    o.textContent = cfg.label;
                    o.style.color = getVariableTypeColor(cfg.type);
                    group.appendChild(o);
                }

                if (cfg.split && cfg.splitBase && accessoryDataFiles[cfg.fileName]) {
                    const fileData = accessoryDataFiles[cfg.fileName];
                    const groupValues = Array.from(new Set(fileData.rows.map(r => r[cfg.splitBase]).filter(v => v !== undefined && v !== null && String(v).trim() !== '')));
                    groupValues.forEach(gv => {
                        const childCfg = cfg.splitChildren[gv] || {};
                        if (childCfg.hidden) return;
                        const oc = document.createElement('option');
                        oc.value = `${getVariableModeKey(cfg)}::child::${gv}`;
                        oc.textContent = (normalizeVariableKey(cfg.variable) === 'description' && /\.protein\.enrichment\.terms\./i.test(cfg.fileName))
                            ? (childCfg.label || gv)
                            : `${cfg.label} - ${childCfg.label || gv}`;
                        const childType = childCfg.type || cfg.type;
                        oc.style.color = getVariableTypeColor(childType);
                        group.appendChild(oc);
                    });
                }
            });
            select.appendChild(group);
        }

        // Force immediate color mode update so menu reflects data changes instantly.
        updateSizesAndColors();

        if (Array.from(select.options).some(o => o.value === currentValue)) {
            select.value = currentValue;
        } else {
            select.value = 'layer';
        }

        syncColorModeSelects(select.value);

        updateNodeLabelFieldOptions();
        updateSearchScopeOptions();
    }

    function cloneSelectOptions(sourceSelect, targetSelect) {
        if (!sourceSelect || !targetSelect) return;
        targetSelect.innerHTML = '';
        Array.from(sourceSelect.children).forEach(child => {
            if (child.tagName === 'OPTGROUP') {
                const group = document.createElement('optgroup');
                group.label = child.label;
                Array.from(child.children).forEach(opt => {
                    group.appendChild(opt.cloneNode(true));
                });
                targetSelect.appendChild(group);
            } else if (child.tagName === 'OPTION') {
                targetSelect.appendChild(child.cloneNode(true));
            }
        });
    }

    function syncColorModeSelects(selectedValue = null) {
        const nodeSelect = document.getElementById('colorMode');
        const keySelect = document.getElementById('keyColorMode');
        if (!nodeSelect) return;

        if (keySelect) {
            cloneSelectOptions(nodeSelect, keySelect);
        }

        const desiredValue = selectedValue ?? nodeSelect.value;
        const nodeHasDesired = Array.from(nodeSelect.options).some(o => o.value === desiredValue);
        nodeSelect.value = nodeHasDesired ? desiredValue : 'layer';

        if (keySelect) {
            const keyHasNodeValue = Array.from(keySelect.options).some(o => o.value === nodeSelect.value);
            keySelect.value = keyHasNodeValue ? nodeSelect.value : 'layer';
        }
    }

    function handleColorModeChange(mode) {
        syncColorModeSelects(mode);
        if (mode === 'eigen') {
            calculateEigenvectorCentrality();
        }
        if (currentViewId === 'Embeddings') {
            markEmbeddingsDirty(true);
        }
        updateSizesAndColors();
        updatePhysicsForce();
    }

    function refreshLegendIfCollectionMode() {
        const modeSelect = document.getElementById('colorMode');
        if (modeSelect && modeSelect.value === 'collection') {
            updateSizesAndColors();
        }
    }

    function getClusterVariableKey(node, mode) {
        if (!node || !mode) return null;

        if (mode === 'layer') {
            const layerVal = Number.isFinite(+node.layer) ? +node.layer : 99;
            return `layer::${layerVal}`;
        }

        if (mode === 'collection') {
            const memberships = getNodeCollectionMemberships(node.id).sort((a, b) => a.localeCompare(b));
            return memberships.length ? `collection::${memberships.join('|')}` : 'collection::__none__';
        }

        if (mode === 'annotation' || mode === 'localization') {
            const source = resolveBuiltInColorSource(mode);
            const value = getBuiltInColorValueFromSource(node.id, mode, source);
            return `${mode}::${value}`;
        }

        if (mode === 'biological_process') {
            const val = getBiologicalProcessKey(node.id);
            return `biological_process::${val}`;
        }

        if (!mode.startsWith('var::')) return null;

        const modeParts = String(mode).split('::');
        if (modeParts.length < 3) return null;

        const fileName = modeParts[1];
        const variable = modeParts[2];
        const childMode = modeParts[3] === 'child' ? modeParts[4] : null;
        const cfg = variableConfigs.find(c => c.fileName === fileName && c.variable === variable);
        if (!cfg) return null;

        const childCfg = childMode ? (cfg.splitChildren?.[childMode] || {}) : null;
        const effectiveType = (childCfg.type || cfg.type || 'Categorical - Nominal');
        if (!effectiveType.startsWith('Categorical')) return null;

        const valueField = childMode && cfg.splitBase ? cfg.splitBase : variable;
        const rawValue = accessoryVariableValues[fileName]?.[valueField]?.get(node.id);
        if (childMode) {
            const childValue = (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') ? 'Unknown' : String(rawValue).trim();
            if (childValue !== childMode) return `${fileName}::${variable}::__other__`;
            return `${fileName}::${variable}::${childValue}`;
        }
        const value = (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') ? 'Unknown' : String(rawValue).trim();
        return `${fileName}::${variable}::${value}`;
    }

    function getClusterCentersForNodes(targetNodes, mode) {
        const clusters = new Map();
        (targetNodes || []).forEach(node => {
            const key = getClusterVariableKey(node, mode);
            if (!key) return;
            if (!clusters.has(key)) clusters.set(key, []);
            clusters.get(key).push(node.id);
        });

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const keys = Array.from(clusters.keys()).sort((a, b) => a.localeCompare(b));
        const centersByNode = new Map();
        if (!keys.length) return centersByNode;

        if (keys.length === 1) {
            clusters.get(keys[0]).forEach(nodeId => {
                centersByNode.set(nodeId, { x: centerX, y: centerY });
            });
            return centersByNode;
        }

        const radius = Math.max(80, Math.min(window.innerWidth, window.innerHeight) * 0.28);
        keys.forEach((key, idx) => {
            const angle = (idx / keys.length) * Math.PI * 2;
            const cx = centerX + radius * Math.cos(angle);
            const cy = centerY + radius * Math.sin(angle);
            clusters.get(key).forEach(nodeId => {
                centersByNode.set(nodeId, { x: cx, y: cy });
            });
        });

        return centersByNode;
    }

    function updateNodeLabelFieldOptions() {
        const fieldSel = document.getElementById('nodeLabelField');
        if (!fieldSel) return;

        const currentValue = fieldSel.value;
        fieldSel.innerHTML = '';

        const addOption = (value, label) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            fieldSel.appendChild(opt);
        };

        addOption('#string_protein_id', 'String Protein ID');

        addOption('#description', 'Description');
        addOption('#annotation', 'Annotation');

        const preferredConfigs = variableConfigs.filter(cfg => cfg.variable.toLowerCase() === 'preferred_name');
        if (preferredConfigs.length) {
            // Add first matching preferred_name variable (hidden or visible)
            const cfg = preferredConfigs[0];
            addOption(`var::${cfg.fileName}::${cfg.variable}`, 'Preferred Name');
        }
        
        // Add KEGG_Product as a built-in option
        addOption('#kegg_product', 'KEGG_Product');

        const visibleVariableConfigs = variableConfigs.filter(cfg => !cfg.hidden);
        visibleVariableConfigs.forEach(cfg => {
            if (cfg.variable.toLowerCase() === 'preferred_name') return;
            addOption(`var::${cfg.fileName}::${cfg.variable}`, `${cfg.variable} (${cfg.fileName})`);
        });

        const preferredOption = Array.from(fieldSel.options).find(opt => opt.textContent === 'Preferred Name');
        const hasCurrentValue = currentValue && Array.from(fieldSel.options).some(opt => opt.value === currentValue);
        if (hasCurrentValue && currentValue !== '#string_protein_id') {
            // Preserve explicit user choice, but do not lock default protein id when preferred_name becomes available.
            fieldSel.value = currentValue;
        } else if (preferredOption) {
            fieldSel.value = preferredOption.value; // Default to Preferred Name if available
        } else if (hasCurrentValue) {
            fieldSel.value = currentValue;
        } else {
            fieldSel.value = '#string_protein_id';
        }
        nodeLabelField = fieldSel.value;
    }

    function updateSearchScopeOptions() {
        const scopeSel = document.getElementById('searchScope');
        if (!scopeSel) return;

        const currentValue = scopeSel.value || 'all';
        const builtInOptions = [
            { value: 'all', label: 'All' },
            { value: 'layer', label: 'Degrees of Separation' },
            { value: 'centrality', label: 'Centrality' },
            { value: 'annotation', label: 'Annotation length' },
            { value: 'localization', label: 'Protein localisation' },
            { value: 'size', label: 'Protein size' }
        ];

        const variableOptions = variableConfigs
            .filter(cfg => cfg?.fileName && cfg?.variable)
            .map(cfg => ({
                value: `var::${cfg.fileName}::${cfg.variable}`,
                label: `${cfg.variable} (${cfg.fileName})`
            }));

        scopeSel.innerHTML = '';
        const seen = new Set();
        [...builtInOptions, ...variableOptions].forEach(opt => {
            if (seen.has(opt.value)) return;
            seen.add(opt.value);
            const el = document.createElement('option');
            el.value = opt.value;
            el.textContent = opt.label;
            scopeSel.appendChild(el);
        });

        scopeSel.value = Array.from(scopeSel.options).some(opt => opt.value === currentValue) ? currentValue : 'all';
    }

    function getAllTaxonIdPrefixes() {
        const prefixes = new Set();
        nodes.forEach(node => {
            const id = node.id || '';
            const dotIndex = id.indexOf('.');
            if (dotIndex > 0) {
                const prefix = id.substring(0, dotIndex);
                prefixes.add(prefix);
            }
        });
        return prefixes;
    }

    function getNodeLabelText(node) {
        if (!node) return '';
        if (nodeLabelField === '#string_protein_id') {
            // Check if all nodes have the same taxon ID prefix
            const taxonPrefixes = getAllTaxonIdPrefixes();
            if (taxonPrefixes.size === 1) {
                // All nodes have the same taxon ID - strip it
                const prefix = Array.from(taxonPrefixes)[0];
                const dotIndex = node.id.indexOf('.');
                if (dotIndex > 0 && node.id.substring(0, dotIndex) === prefix) {
                    return node.id.substring(dotIndex + 1);
                }
            }
            return node.id;
        }
        if (nodeLabelField === '#kegg_product') {
            return getKeggProductText(node.id);
        }
        if (nodeLabelField === '#description') {
            return getProteinInfoDescription(node.id);
        }
        if (nodeLabelField === '#annotation') {
            return (getProteinInfoAnnotation(node.id) || '').slice(0, 50);
        }
        if (!nodeLabelField.startsWith('var::')) return '';

        const parts = nodeLabelField.split('::');
        if (parts.length < 3) return '';
        const fileName = parts[1];
        const variable = parts[2];
        const item = accessoryVariableValues[fileName]?.[variable]?.get(node.id);
        if (item !== undefined && item !== null && String(item).trim() !== '') return String(item);
        const metadata = proteinMetadata.get(node.id) || {};
        if (variable === 'preferred_name') {
            return metadata.geneId || metadata.aliases?.[0] || metadata.annotation || '';
        }
        return ''; 
    }

    function getKeggProductText(nodeId) {
        const aliasList = aliasData?.get?.(nodeId) || [];
        for (const aliasEntry of aliasList) {
            if (aliasEntry.source === 'KEGG_PRODUCT') {
                return aliasEntry.alias || '';
            }
        }
        return '';
    }

    function renderVariableTable() {
        console.log("function renderVariableTable()")
        const container = document.getElementById('variables-table-container');
        container.innerHTML = '';

        const filterText = variableFilterText || document.getElementById('variable-filter')?.value.toLowerCase().trim() || '';

        if (!variableConfigs.length) {
            container.innerHTML = '<div style="color:#ccc;">No accessory data loaded yet.</div>';
            return;
        }

        const filteredConfigs = variableConfigs.filter(cfg => {
            if (!filterText) return true;
            return cfg.fileName.toLowerCase().includes(filterText) || cfg.variable.toLowerCase().includes(filterText) || cfg.label.toLowerCase().includes(filterText);
        });

        if (!filteredConfigs.length) {
            container.innerHTML = `<div style="color:#ccc;">No variables match the filter: ${filterText}</div>`;
            return;
        }

        container.style.position = 'relative';

        // create sticky header row in scroll area
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        const header = document.createElement('tr');
        const colWidths = { 'Labeled as': '28%', 'Variable type': '28%', 'Hide': '10%' };
        ['File', 'Variable', 'Labeled as', 'Variable type', 'Split', 'Hide'].forEach(text => {
            const th = document.createElement('th'); th.textContent = text;
            th.style.borderBottom = '1px solid #666'; th.style.padding = '8px'; th.style.color = 'white'; th.style.textAlign = 'left';
            if (colWidths[text]) th.style.width = colWidths[text];
            header.appendChild(th);
        });
        table.appendChild(header);

        const fileNameMap = {};
        let fileIndex = 0;
        filteredConfigs.forEach((cfg, idx) => {
            if (fileNameMap[cfg.fileName] === undefined) {
                fileNameMap[cfg.fileName] = fileIndex++;
            }
            const tr = document.createElement('tr');
            tr.style.background = idx % 2 ? '#1f1f1f' : '#252525';

            const cells = [];
            cells.push(cfg.fileName);
            cells.push(cfg.variable);

            const labelInput = document.createElement('input');
            labelInput.value = cfg.label;
            labelInput.style.width = '100%';
            labelInput.style.background = '#333';
            labelInput.style.color = 'white';
            labelInput.style.border = '1px solid #555';
            labelInput.style.padding = '6px';
            labelInput.oninput = (e) => { cfg.label = e.target.value; updateColorModeOptions(); };

            const typeSelect = document.createElement('select');
            typeSelect.className = 'variable-type-select';
            ['Categorical - Nominal', 'Categorical - Ordinal', 'Numerical - Discrete', 'Numerical - Continuous'].forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.text = opt;
                if (opt === cfg.type) o.selected = true;
                typeSelect.appendChild(o);
            });
            typeSelect.style.width = '100%';
            typeSelect.onchange = (e) => { cfg.type = e.target.value; setVariableTypeSelectColor(typeSelect, cfg.type); updateColorModeOptions(); };
            setVariableTypeSelectColor(typeSelect, cfg.type);

            const splitTd = document.createElement('td');
            const splitBtn = document.createElement('button');
            splitBtn.textContent = cfg.split ? 'Unsplit' : 'Split';
            splitBtn.style.padding = '4px 8px';
            splitBtn.style.background = cfg.split ? '#ff9800' : '#888';
            splitBtn.style.color = 'white';
            splitBtn.style.border = 'none';
            splitBtn.style.borderRadius = '6px';
            splitBtn.onclick = () => {
                cfg.split = !cfg.split;
                if (cfg.split) {
                    cfg.splitBase = null;
                    cfg.splitChildren = {};
                } else {
                    cfg.splitBase = null;
                    cfg.splitChildren = {};
                }
                renderVariableTable();
            };
            splitTd.appendChild(splitBtn);

            // File cell
            const fileTd = document.createElement('td');
            fileTd.style.padding = '8px';
            fileTd.style.borderBottom = '1px solid #444';
            const fileBtn = document.createElement('button');
            const fileBtnColor = fileNameMap[cfg.fileName] % 2 === 0 ? '#3498db' : '#1b5f8f';
            fileBtn.textContent = cfg.fileName;
            fileBtn.className = 'variable-file-btn';
            fileBtn.style.background = fileBtnColor;
            fileBtn.style.border = '1px solid #1f5b92';
            fileBtn.onclick = () => openFileViewer(cfg.fileName);
            fileTd.appendChild(fileBtn);
            tr.appendChild(fileTd);

            // Variable name cell
            const variableTd = document.createElement('td');
            variableTd.style.padding = '8px';
            variableTd.style.borderBottom = '1px solid #444';
            variableTd.textContent = cfg.variable;
            tr.appendChild(variableTd);

            // Label cell
            const labelTd = document.createElement('td');
            labelTd.style.padding = '8px';
            labelTd.style.borderBottom = '1px solid #444';
            labelTd.appendChild(labelInput);
            tr.appendChild(labelTd);

            // Type cell
            const typeTd = document.createElement('td');
            typeTd.style.padding = '8px';
            typeTd.style.borderBottom = '1px solid #444';
            typeTd.appendChild(typeSelect);
            tr.appendChild(typeTd);

            // Split cell
            splitTd.style.padding = '8px';
            splitTd.style.borderBottom = '1px solid #444';
            splitTd.appendChild(splitBtn);
            tr.appendChild(splitTd);

            // Hide cell
            const hideTd = document.createElement('td');
            hideTd.style.padding = '8px';
            hideTd.style.borderBottom = '1px solid #444';
            const hideBtn = document.createElement('button');
            hideBtn.textContent = cfg.hidden ? 'Unhide' : 'Hide';
            hideBtn.style.padding = '4px 8px';
            hideBtn.style.background = cfg.hidden ? '#333' : '#cc4444';
            hideBtn.style.color = '#fff';
            hideBtn.style.border = 'none';
            hideBtn.style.borderRadius = '6px';
            hideBtn.onclick = () => {
                cfg.hidden = !cfg.hidden;
                renderVariableTable();
                updateColorModeOptions();
            };
            hideTd.appendChild(hideBtn);
            tr.appendChild(hideTd);

            if (cfg.hidden) {
                tr.style.opacity = '0.4';
                tr.style.filter = 'grayscale(0.7)';
            }

            table.appendChild(tr);

            if (cfg.split) {
                const splitRow = document.createElement('tr');
                splitRow.style.background = '#2a2a2a';
                const splitCell = document.createElement('td');
                splitCell.colSpan = 6;
                const splitLabel = document.createElement('div');
                splitLabel.style.display = 'flex';
                splitLabel.style.alignItems = 'center';
                splitLabel.style.gap = '10px';
                const splitTitle = document.createElement('span');
                splitTitle.textContent = 'Split using:';
                const splitSelect = document.createElement('select');
                splitSelect.style.flex = '1';
                splitSelect.style.background = '#4a4a4a';
                splitSelect.style.color = 'white';
                splitSelect.style.border = '1px solid #666';
                const placeholderOption = document.createElement('option');
                placeholderOption.value = '';
                placeholderOption.textContent = 'Select column...';
                placeholderOption.disabled = true;
                placeholderOption.selected = !cfg.splitBase;
                splitSelect.appendChild(placeholderOption);

                const fileData = accessoryDataFiles[cfg.fileName];
                if (fileData) {
                    fileData.headers.forEach(h => {
                        const o = document.createElement('option');
                        o.value = h;
                        o.textContent = h;
                        if (h === cfg.splitBase) o.selected = true;
                        splitSelect.appendChild(o);
                    });
                }
                splitSelect.onchange = (e) => {
                    cfg.splitBase = e.target.value;
                    renderVariableTable();
                };
                splitLabel.appendChild(splitTitle);
                splitLabel.appendChild(splitSelect);
                splitCell.appendChild(splitLabel);
                splitRow.appendChild(splitCell);
                table.appendChild(splitRow);

                if (cfg.splitBase && fileData) {
                    const groupValues = {};
                    fileData.rows.forEach(row => {
                        const groupKey = row[cfg.splitBase];
                        const value = row[cfg.variable];
                        if (!groupKey) return;
                        if (!groupValues[groupKey]) groupValues[groupKey] = [];
                        groupValues[groupKey].push(value);
                    });

                    const groups = Object.entries(groupValues);
                    groups.forEach(([groupKey, records], gidx) => {
                        const storedChild = cfg.splitChildren[groupKey] || {};
                        const childType = storedChild.type || cfg.type || inferVarType(records);
                        const childLabel = storedChild.label || groupKey;

                        const childRow = document.createElement('tr');
                        childRow.style.background = gidx % 2 ? '#1f1f1f' : '#252525';

                        const isLast = gidx === groups.length - 1;
                        const prefix = isLast ? 'ㄴ' : '⊢';

                        const fileTd = document.createElement('td');
                        fileTd.style.padding = '8px'; fileTd.style.borderBottom = '1px solid #444';
                        childRow.appendChild(fileTd);

                        const variableTd = document.createElement('td');
                        variableTd.style.padding = '8px'; variableTd.style.borderBottom = '1px solid #444';
                        variableTd.style.color = '#ddd';
                        variableTd.textContent = `${prefix}${groupKey}`;
                        childRow.appendChild(variableTd);

                        const labelTd = document.createElement('td');
                        labelTd.style.padding = '8px'; labelTd.style.borderBottom = '1px solid #444';
                        const labelInputChild = document.createElement('input');
                        labelInputChild.value = childLabel;
                        labelInputChild.style.width = '100%';
                        labelInputChild.style.background = '#333';
                        labelInputChild.style.color = 'white';
                        labelInputChild.style.border = '1px solid #555';
                        labelInputChild.style.padding = '6px';
                        labelInputChild.oninput = (e) => {
                            cfg.splitChildren[groupKey] = cfg.splitChildren[groupKey] || {};
                            cfg.splitChildren[groupKey].label = e.target.value;
                        };
                        labelTd.appendChild(labelInputChild);
                        childRow.appendChild(labelTd);

                        const typeTd = document.createElement('td');
                        typeTd.style.padding = '8px'; typeTd.style.borderBottom = '1px solid #444';
                        const typeSelectChild = document.createElement('select');
                        ['Categorical - Nominal', 'Categorical - Ordinal', 'Numerical - Discrete', 'Numerical - Continuous'].forEach(opt => {
                            const o = document.createElement('option');
                            o.value = opt;
                            o.text = opt;
                            if (opt === childType) o.selected = true;
                            typeSelectChild.appendChild(o);
                        });
                        typeSelectChild.className = 'variable-type-select-child';
                        typeSelectChild.style.width = '100%';
                        setVariableTypeSelectColor(typeSelectChild, childType);
                        typeSelectChild.onchange = (e) => {
                            cfg.splitChildren[groupKey] = cfg.splitChildren[groupKey] || {};
                            cfg.splitChildren[groupKey].type = e.target.value;
                            setVariableTypeSelectColor(typeSelectChild, e.target.value);
                            updateColorModeOptions();
                        };
                        typeTd.appendChild(typeSelectChild);
                        childRow.appendChild(typeTd);

                        const splitChildSlot = document.createElement('td');
                        splitChildSlot.style.padding = '8px';
                        splitChildSlot.style.borderBottom = '1px solid #444';
                        splitChildSlot.textContent = '';

                        const hideChildTd = document.createElement('td');
                        hideChildTd.style.padding = '8px';
                        hideChildTd.style.borderBottom = '1px solid #444';
                        const hideChildBtn = document.createElement('button');
                        hideChildBtn.textContent = storedChild.hidden ? 'Unhide' : 'Hide';
                        hideChildBtn.style.padding = '4px 6px';
                        hideChildBtn.style.background = storedChild.hidden ? '#555' : '#cc4444';
                        hideChildBtn.style.border = 'none';
                        hideChildBtn.style.color = 'white';
                        hideChildBtn.style.borderRadius = '6px';
                        hideChildBtn.onclick = () => {
                            cfg.splitChildren[groupKey] = cfg.splitChildren[groupKey] || {};
                            cfg.splitChildren[groupKey].hidden = !cfg.splitChildren[groupKey].hidden;
                            renderVariableTable();
                            updateColorModeOptions();
                        };
                        hideChildTd.appendChild(hideChildBtn);

                        if (storedChild.hidden) {
                            childRow.style.opacity = '0.4';
                            childRow.style.filter = 'grayscale(0.7)';
                        }

                        childRow.appendChild(splitChildSlot);
                        childRow.appendChild(hideChildTd);

                        table.appendChild(childRow);
                    });
                }
            }
        });

        container.appendChild(table);
        updateColorModeOptions();
    }

    function parseAccessoryFile(fileName, text) {
        console.log("function parseAccessoryFile(fileName, text)")
        const delim = text.includes('\t') ? '\t' : ',';
        const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return;
        const headers = lines[0].split(delim).map(h => h.trim());
        const rows = lines.slice(1).map(line => {
            const cols = line.split(delim);
            const row = {};
            headers.forEach((h,i) => row[h] = (cols[i] || '').trim());
            return row;
        });
        accessoryDataFiles[fileName] = { headers, rows, text };

        // build map of nodes for variable values
        accessoryVariableValues[fileName] = {};
        const idHeader = headers.find(h => h.toLowerCase() === '#string_protein_id');
        rows.forEach(r => {
            const nodeId = idHeader ? r[idHeader] : null;
            if (!nodeId) return;
            headers.forEach(h => {
                if (h.toLowerCase() === '#string_protein_id') return;
                accessoryVariableValues[fileName][h] = accessoryVariableValues[fileName][h] || new Map();
                accessoryVariableValues[fileName][h].set(nodeId, r[h]);
            });
        });

        buildVariableConfigs();

        const autoSplitMatch = fileName.match(/^\d+\.protein\.enrichment\.terms\.v[\d\.]+\.txt$/i);
        if (autoSplitMatch) {
            const descCfg = variableConfigs.find(c => c.fileName === fileName && c.variable.toLowerCase() === 'description');
            const catCfg = variableConfigs.find(c => c.fileName === fileName && c.variable.toLowerCase() === 'category');
            if (descCfg && catCfg) {
                const fileData = accessoryDataFiles[fileName];
                const splitCol = fileData.headers.find(h => h.toLowerCase() === 'category') || 'Category';
                descCfg.split = true;
                descCfg.splitBase = splitCol;
                descCfg.splitChildren = {};
                descCfg.hidden = false;
                const categories = Array.from(new Set(fileData.rows.map(r => r[splitCol] || r['category'] || r['Category']).filter(v => v !== undefined && v !== null && String(v).trim() !== '')));
                categories.forEach(cat => { descCfg.splitChildren[cat] = { label: cat, type: descCfg.type, hidden: false }; });
            }
        }

        updateColorModeOptions();
    }

    function parseDelimitedRows(text, forcedDelim = null, fileName = '') {
        const trimmed = (text || '').trim();
        if (!trimmed) return { headers: [], rows: [], delimiter: forcedDelim || '' };
        const delim = forcedDelim || detectDefaultSeparator(trimmed, fileName);
        if (delim === 'none') return { headers: [], rows: [], delimiter: delim };
        const lines = trimmed.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return { headers: [], rows: [], delimiter: delim };
        const splitRow = (line) => {
            if (delim === '__WS__') return line.trim().split(/\s+/);
            return line.split(delim);
        };
        const headers = splitRow(lines[0]).map(h => h.trim());
        const rows = lines.slice(1).map(line => {
            const cols = splitRow(line);
            const row = {};
            headers.forEach((h, i) => row[h] = (cols[i] || '').trim());
            return row;
        });
        return { headers, rows, delimiter: delim };
    }

    function parseFastaRecords(text) {
        const records = [];
        let currentHeader = null;
        let currentSeq = [];
        (text || '').split(/\r?\n/).forEach(line => {
            if (!line) return;
            if (line.startsWith('>')) {
                if (currentHeader) {
                    records.push({ header: currentHeader, sequence: currentSeq.join('').replace(/\s+/g, '') });
                }
                currentHeader = line.slice(1).trim();
                currentSeq = [];
            } else if (currentHeader) {
                currentSeq.push(line.trim());
            }
        });
        if (currentHeader) {
            records.push({ header: currentHeader, sequence: currentSeq.join('').replace(/\s+/g, '') });
        }
        return records;
    }

    function extractGenomeProteinAndGene(header) {
        const rawHeader = (header || '').trim();
        if (!rawHeader) return { proteinId: '', geneId: '' };

        const geneMatch = rawHeader.match(/(?:^|\s)GN=([^=]+?)(?=\s[A-Za-z_][A-Za-z0-9_]*=|$)/i);
        const geneId = (geneMatch?.[1] || '').trim();

        const metaStart = rawHeader.search(/\s[A-Za-z_][A-Za-z0-9_]*=/);
        const proteinId = (metaStart > -1 ? rawHeader.slice(0, metaStart) : rawHeader).trim();

        return {
            proteinId: proteinId || rawHeader,
            geneId: geneId || proteinId || rawHeader
        };
    }

    function normalizeGenomeEntityId(value) {
        return String(value || '').trim().replace(/\s+/g, '_');
    }

    function csvEscape(value) {
        const s = value === undefined || value === null ? '' : String(value);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
        return s;
    }

    function buildGenomeDerivedCsvs(filesWithText) {
        const genomeLinksRows = [];
        const geneProteinRows = [];
        const geneSequenceRows = [];

        filesWithText.forEach(({ text }) => {
            const records = parseFastaRecords(text);
            const mapped = records.map(rec => {
                const info = extractGenomeProteinAndGene(rec.header);
                return {
                    geneId: normalizeGenomeEntityId(info.geneId),
                    proteinId: normalizeGenomeEntityId(info.proteinId),
                    sequence: rec.sequence || ''
                };
            }).filter(r => r.geneId && r.proteinId);

            for (let i = 0; i < mapped.length - 1; i++) {
                genomeLinksRows.push([mapped[i].geneId, mapped[i + 1].geneId, 1000]);
            }
            mapped.forEach(r => {
                geneProteinRows.push([r.geneId, r.proteinId, 1000]);
                geneSequenceRows.push([r.geneId, r.sequence]);
            });
        });

        const toCsv = (headers, rows) => [
            headers.join(','),
            ...rows.map(row => row.map(csvEscape).join(','))
        ].join('\n') + '\n';

        return {
            'Genome_links.csv': toCsv(['Gene 1', 'Gene 2', 'Score'], genomeLinksRows),
            'Gene-Protein.links.csv': toCsv(['Gene ID', 'Protein ID', 'Score'], geneProteinRows),
            'Gene_sequences.csv': toCsv(['Gene ID', 'Protein Sequence'], geneSequenceRows)
        };
    }

    async function processGenomeFastaFiles(files) {
        const targetFiles = Array.from(files || []);
        if (!targetFiles.length) return;

        const parsed = [];
        for (const file of targetFiles) {
            const text = await file.text();
            parsed.push({ name: file.name, text });
            uploadedFileViewerData[file.name] = { text };
        }

        const generated = buildGenomeDerivedCsvs(parsed);

        Object.entries(generated).forEach(([name, text]) => {
            uploadedFileViewerData[name] = { text };
        });

        uploadedInteractionFiles['Genome_links.csv'] = generated['Genome_links.csv'];
        uploadedInteractionFiles['Gene-Protein.links.csv'] = generated['Gene-Protein.links.csv'];

        uploadedAccessoryFiles['Gene_sequences.csv'] = generated['Gene_sequences.csv'];

        rebuildInteractionDataFromUploads();
        rebuildAccessoryDataFromUploads();
    }

    function resolveProteinIdFromHeader(header) {
        const firstToken = (header || '').split(/\s+/)[0] || '';
        const candidates = Array.from(new Set([
            firstToken,
            ...firstToken.split('|')
        ].map(x => x.trim()).filter(Boolean)));
        for (const id of candidates) {
            if (fullAdjacency.has(id) || nodeMap.has(id) || proteinMetadata.has(id) || allIDs.includes(id)) return id;
        }
        return candidates[candidates.length - 1] || firstToken || header;
    }

    function parseFastaAccessoryFile(fileName, text) {
        const records = parseFastaRecords(text);
        records.forEach(rec => {
            const id = resolveProteinIdFromHeader(rec.header);
            if (!id) return;
            const existing = proteinMetadata.get(id) || { size: 0, annotation: 'Unknown', localization: 'Unknown', aliases: [], geneId: '', sequence: '' };
            existing.sequence = rec.sequence || existing.sequence || '';
            proteinMetadata.set(id, existing);
        });

        accessoryDataFiles[fileName] = {
            headers: ['#string_protein_id', 'sequence'],
            rows: records.map(r => ({ '#string_protein_id': resolveProteinIdFromHeader(r.header), sequence: r.sequence })),
            text
        };
    }

    function ingestProteinMetadataFromAccessory(fileName, text) {
        const { headers, rows } = parseDelimitedRows(text, null, fileName);
        if (!headers.length || !rows.length) return;

        const indexByHeader = new Map(headers.map(h => [h.toLowerCase().trim(), h]));
        const idHeader = indexByHeader.get('#string_protein_id') || indexByHeader.get('string_protein_id') || indexByHeader.get('protein_id') || indexByHeader.get('protein');
        if (!idHeader) return;

        const sizeHeader = indexByHeader.get('protein_size') || indexByHeader.get('size');
        const annotationHeader = indexByHeader.get('annotation');
        const localizationHeader = indexByHeader.get('description') || indexByHeader.get('localisation') || indexByHeader.get('localization');
        const aliasHeader = indexByHeader.get('alias') || indexByHeader.get('aliases');
        const geneHeader = indexByHeader.get('gene_id') || indexByHeader.get('geneid') || indexByHeader.get('preferred_name') || indexByHeader.get('gene');
        const sequenceHeader = indexByHeader.get('sequence');

        rows.forEach(row => {
            const id = (row[idHeader] || '').replace(/^#/, '').trim();
            if (!id) return;

            const existing = proteinMetadata.get(id) || { size: 0, annotation: 'Unknown', localization: 'Unknown', aliases: [], geneId: '', sequence: '' };

            if (sizeHeader) existing.size = +row[sizeHeader] || existing.size || 0;
            if (annotationHeader) existing.annotation = row[annotationHeader]?.trim() || existing.annotation || 'Unknown';
            if (localizationHeader) existing.localization = row[localizationHeader]?.trim() || existing.localization || 'Unknown';
            if (geneHeader) {
                const preferredName = row[geneHeader]?.trim() || '';
                if (preferredName) {
                    existing.preferred_name = existing.preferred_name || preferredName;
                    if (!existing.geneId) existing.geneId = preferredName;
                }
            }
            if (fileName && /\.protein\.enrichment\.terms\./i.test(fileName) && indexByHeader.get('description')) {
                existing.description = row[indexByHeader.get('description')]?.trim() || existing.description || '';
            }
            if (sequenceHeader && !existing.sequence) existing.sequence = row[sequenceHeader]?.trim() || '';

            if (aliasHeader) {
                const aliasVal = row[aliasHeader]?.trim();
                if (aliasVal) {
                    const existingAliases = Array.isArray(existing.aliases) ? existing.aliases : [];
                    if (!existingAliases.includes(aliasVal)) existingAliases.push(aliasVal);
                    existing.aliases = existingAliases;
                }
            }

            proteinMetadata.set(id, existing);
        });
    }

    function getNodeInfoExtraColumns() {
        const columns = [];
        const excluded = new Set(['description', 'preferredname', 'preferred_name', 'proteinsize', 'protein_size', 'alias', 'source', 'category', 'term', 'annotation']);
        Object.entries(accessoryVariableValues).forEach(([fileName, vars]) => {
            Object.keys(vars || {}).forEach(variable => {
                if (variable.toLowerCase() === '#string_protein_id') return;
                if (excluded.has(normalizeVariableKey(variable))) return;
                columns.push({ key: `${fileName}::${variable}`, fileName, variable, label: `${variable} (${fileName})` });
            });
        });
        return columns;
    }

    function getSelectedNodeInfoRows() {
        const selectedIds = Array.from(getEffectiveSelectedNodesSet());
        const extraColumns = getNodeInfoExtraColumns();
        const sizeSource = resolveProteinSizeSource(selectedIds.map(id => getNodeForInfo(id)).filter(Boolean));
        const rows = selectedIds.map(id => {
            const node = getNodeForInfo(id);
            const meta = proteinMetadata.get(id) || {};
            const linkData = getNodeInfoLinkData(id);
            const row = {
                'Protein ID': id,
                'Preferred Name': getPreferredProteinName(id) || '',
                'Gene ID': meta.geneId || '',
                'Description': getProteinInfoDescription(id) || '',
                'Annotation': getProteinInfoAnnotation(id) || '',
                'KEGG Product': getKeggProductText(id) || '',
                'Protein Size': getProteinSizeValue(id, sizeSource) || '',
                'UniProt': linkData.uniprotUrl || '',
                'NCBI': [linkData.ncbiProteinUrl, linkData.ncbiGeneUrl].filter(Boolean).join(' '),
                'Pubmed': linkData.pubmedUrl || '',
                'IntAct': linkData.intactUrl || '',
                'STRING': linkData.stringUrl || '',
                'Protein Data Bank': linkData.pdbLinks.map(link => link.url).join(' '),
                'Aliases': Array.isArray(meta.aliases) ? meta.aliases.join('; ') : (meta.alias || ''),
                'Layer': node.layer === 99 ? 'Disconnected' : (node.layer !== undefined ? node.layer : ''),
                'Centrality': node.centrality ?? '',
                'Eigen': (typeof node.eigen === 'number' ? node.eigen.toFixed(4) : ''),
                'Localisation': meta.localization || '',
                'Sequence': meta.sequence || '',
                __linkData: linkData
            };
            extraColumns.forEach(col => {
                const value = accessoryVariableValues[col.fileName]?.[col.variable]?.get(id);
                row[col.label] = value ?? '';
            });
            return row;
        });
        return { rows, extraColumns };
    }

    function createProteinMetadataRecord() {
        return { size: 0, annotation: 'Unknown', description: '', preferred_name: '', localization: 'Unknown', aliases: [], geneId: '', sequence: '', uniprotAc: '', ncbiProteinId: '', ncbiGeneId: '', pubmedGeneId: '', pdbIds: [] };
    }

    function ensureProteinMetadataRecord(id) {
        const existing = proteinMetadata.get(id);
        if (existing) {
            existing.aliases = Array.isArray(existing.aliases) ? existing.aliases : [];
            existing.pdbIds = Array.isArray(existing.pdbIds) ? existing.pdbIds : [];
            return existing;
        }
        const record = createProteinMetadataRecord();
        proteinMetadata.set(id, record);
        return record;
    }

    function appendUniqueValue(targetArray, value) {
        const text = String(value ?? '').trim();
        if (!text) return;
        if (!targetArray.includes(text)) targetArray.push(text);
    }

    function ingestProteinAliasLinksFromAccessory(fileName, text) {
        const { headers, rows, delimiter } = parseDelimitedRows(text, null, fileName);
        if (!headers.length || !rows.length) {
            console.warn('[PDB DEBUG] Alias ingest skipped: file parsed with no tabular rows', { fileName, delimiter, textLength: String(text || '').length });
            return;
        }

        const indexByHeader = new Map(headers.map(h => [h.toLowerCase().trim(), h]));
        const normalizedHeaders = headers.map(h => ({
            raw: h,
            norm: h.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_')
        }));
        const findByNorm = (candidates) => {
            for (const candidate of candidates) {
                const hit = normalizedHeaders.find(h => h.norm === candidate);
                if (hit) return hit.raw;
            }
            return null;
        };
        const findByPattern = (pattern) => {
            const hit = normalizedHeaders.find(h => pattern.test(h.norm));
            return hit ? hit.raw : null;
        };

        const idHeader = findByNorm(['_string_protein_id', 'string_protein_id', 'protein_id', 'protein'])
            || findByPattern(/(?:^|_)string(?:_|)protein(?:_|)id(?:_|$)|(?:^|_)protein(?:_|)id(?:_|$)/);
        const aliasHeader = findByNorm(['alias', 'aliases'])
            || findByPattern(/alias/);
        const sourceHeader = findByNorm(['source', 'sources', 'database', 'db'])
            || findByPattern(/source|database|xref|cross_reference|crossref|db/);

        if (!idHeader || !aliasHeader || !sourceHeader) {
            console.warn('[PDB DEBUG] Alias ingest skipped: required headers missing', {
                fileName,
                delimiter,
                idHeader,
                aliasHeader,
                sourceHeader,
                headers
            });
            return;
        }

        const pdbDebug = {
            totalRows: rows.length,
            validRows: 0,
            exactPdbRows: 0,
            loosePdbRows: 0,
            pdbIdsAdded: 0,
            sampleNearMissRows: [],
            sampleExactRows: [],
            sourceHistogram: new Map()
        };

        rows.forEach(row => {
            const id = String(row[idHeader] || '').replace(/^#/, '').trim();
            const alias = String(row[aliasHeader] || '').trim();
            const source = String(row[sourceHeader] || '').trim();
            if (!id || !alias || !source) return;
            pdbDebug.validRows += 1;

            const normalizedSource = source.toLowerCase().replace(/[\s-]+/g, '_');
            pdbDebug.sourceHistogram.set(source, (pdbDebug.sourceHistogram.get(source) || 0) + 1);
            const isExactPdbSource = source === 'UniProt_DR_PDB' || source === 'Ensembl_PDB';
            const isLoosePdbSource = normalizedSource.includes('pdb');
            const looksLikePdbId = /^[0-9][a-z0-9]{3}$/i.test(alias);
            if (isLoosePdbSource) pdbDebug.loosePdbRows += 1;
            if (isExactPdbSource) {
                pdbDebug.exactPdbRows += 1;
                if (pdbDebug.sampleExactRows.length < 5) {
                    pdbDebug.sampleExactRows.push({ id, source, alias });
                }
            } else if (isLoosePdbSource && pdbDebug.sampleNearMissRows.length < 10) {
                pdbDebug.sampleNearMissRows.push({ id, source, normalizedSource, alias });
            }

            const existing = ensureProteinMetadataRecord(id);
            if (source === 'UniProt_AC' && !existing.uniprotAc) existing.uniprotAc = alias;
            if (source === 'UniProt_DR_RefSeq' && !existing.ncbiProteinId) existing.ncbiProteinId = alias;
            if (source === 'UniProt_DR_GeneID') {
                if (!existing.ncbiGeneId) existing.ncbiGeneId = alias;
                if (!existing.pubmedGeneId) existing.pubmedGeneId = alias;
                if (!existing.geneId) existing.geneId = alias;
            }
            const beforePdbCount = existing.pdbIds.length;
            const shouldTreatAsPdb = isExactPdbSource || (isLoosePdbSource && looksLikePdbId);
            if (shouldTreatAsPdb) appendUniqueValue(existing.pdbIds, alias);
            if (existing.pdbIds.length > beforePdbCount) pdbDebug.pdbIdsAdded += 1;
            complexPdbColorStateDirty = true;
            
            // Also populate aliasData for cross-reference queries
            if (!aliasData.has(id)) {
                aliasData.set(id, []);
            }
            aliasData.get(id).push({ source, alias });
        });

        const topSources = Array.from(pdbDebug.sourceHistogram.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([source, count]) => ({ source, count }));
        console.groupCollapsed(`[PDB DEBUG] Alias ingest summary for ${fileName}`);
        console.log({
            totalRows: pdbDebug.totalRows,
            validRows: pdbDebug.validRows,
            exactPdbRows: pdbDebug.exactPdbRows,
            loosePdbRows: pdbDebug.loosePdbRows,
            pdbIdsAdded: pdbDebug.pdbIdsAdded,
            nearMissCount: pdbDebug.sampleNearMissRows.length
        });
        if (topSources.length) console.table(topSources);
        if (pdbDebug.sampleExactRows.length) console.table(pdbDebug.sampleExactRows);
        if (pdbDebug.sampleNearMissRows.length) {
            console.warn('[PDB DEBUG] PDB-like source values that did not exact-match expected keys', pdbDebug.sampleNearMissRows);
        }
        console.groupEnd();

        return fileName;
    }

    function getNodeInfoLinkData(nodeId) {
        const meta = proteinMetadata.get(nodeId) || {};
        const uniprotAc = getPreferredUniProtAliasForProtein(nodeId);
        const ncbiProteinId = String(meta.ncbiProteinId || '').trim();
        const geneId = String(meta.ncbiGeneId || meta.pubmedGeneId || '').trim();
        const pdbIds = Array.isArray(meta.pdbIds) ? meta.pdbIds.map(id => String(id || '').trim()).filter(Boolean) : [];
        return {
            uniprotAc,
            uniprotUrl: uniprotAc ? `https://www.uniprot.org/uniprotkb/${encodeURIComponent(uniprotAc)}/entry` : '',
            ncbiProteinId,
            ncbiProteinUrl: ncbiProteinId ? `https://www.ncbi.nlm.nih.gov/protein/${encodeURIComponent(ncbiProteinId)}` : '',
            geneId,
            ncbiGeneUrl: geneId ? `https://www.ncbi.nlm.nih.gov/gene/${encodeURIComponent(geneId)}` : '',
            pubmedUrl: geneId ? `https://pubmed.ncbi.nlm.nih.gov/?from_uid=${encodeURIComponent(geneId)}&linkname=gene_pubmed` : '',
            intactUrl: uniprotAc ? `https://www.ebi.ac.uk/intact/search?query=id:${encodeURIComponent(uniprotAc)}` : '',
            stringUrl: nodeId ? `https://string-db.org/network/${encodeURIComponent(nodeId)}` : '',
            pdbLinks: pdbIds.map(pdbId => ({ id: pdbId, url: `https://www.rcsb.org/structure/${encodeURIComponent(pdbId)}` }))
        };
    }

    function getPreferredUniProtAliasForProtein(nodeId) {
        const aliases = aliasData.get(nodeId) || [];
        const swissProtAlias = aliases.find(entry => {
            const alias = String(entry?.alias || '').trim();
            const source = String(entry?.source || '').toLowerCase();
            return alias && source.includes('swiss_prot');
        });
        if (swissProtAlias) return String(swissProtAlias.alias).trim();

        const uniProtAcAlias = aliases.find(entry => {
            const alias = String(entry?.alias || '').trim();
            const source = String(entry?.source || '').toLowerCase();
            return alias && source === 'uniprot_ac';
        });
        if (uniProtAcAlias) return String(uniProtAcAlias.alias).trim();

        const meta = proteinMetadata.get(nodeId) || {};
        return String(meta.uniprotAc || '').trim();
    }

    function parseCssColorToHex(colorText) {
        const text = String(colorText || '').trim();
        if (!text) return 0x0f1115;
        const rgbMatch = text.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (rgbMatch) {
            const r = Math.max(0, Math.min(255, +rgbMatch[1] || 0));
            const g = Math.max(0, Math.min(255, +rgbMatch[2] || 0));
            const b = Math.max(0, Math.min(255, +rgbMatch[3] || 0));
            return (r << 16) | (g << 8) | b;
        }
        if (/^#([0-9a-f]{6})$/i.test(text)) return parseInt(text.slice(1), 16);
        return 0x0f1115;
    }

    function disposeProteinInfoMolstarViewer() {
        if (proteinInfoMolstarBackgroundObserver) {
            proteinInfoMolstarBackgroundObserver.disconnect();
            proteinInfoMolstarBackgroundObserver = null;
        }
        if (proteinInfoMolstarViewer?.plugin?.dispose) {
            proteinInfoMolstarViewer.plugin.dispose();
        }
        proteinInfoMolstarViewer = null;
    }

    async function ensureMolstarLoadedForProteinInfo() {
        if (window.molstar?.Viewer) return;
        if (proteinInfoMolstarLoadPromise) {
            await proteinInfoMolstarLoadPromise;
            return;
        }

        proteinInfoMolstarLoadPromise = (async () => {
            const cssHref = 'https://unpkg.com/molstar/build/viewer/molstar.css';
            const scriptSrc = 'https://unpkg.com/molstar/build/viewer/molstar.js';

            if (!document.querySelector(`link[href="${cssHref}"]`)) {
                const css = document.createElement('link');
                css.rel = 'stylesheet';
                css.href = cssHref;
                document.head.appendChild(css);
            }

            const existingScript = Array.from(document.querySelectorAll('script')).find(s => s.src === scriptSrc);
            if (existingScript) {
                if (!window.molstar?.Viewer) {
                    await new Promise((resolve, reject) => {
                        existingScript.addEventListener('load', resolve, { once: true });
                        existingScript.addEventListener('error', () => reject(new Error('Failed to load Mol* script.')), { once: true });
                    });
                }
                return;
            }

            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = scriptSrc;
                script.async = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load Mol* script.'));
                document.head.appendChild(script);
            });
        })();

        try {
            await proteinInfoMolstarLoadPromise;
        } finally {
            proteinInfoMolstarLoadPromise = null;
        }
    }

    async function getAlphaFoldModelInfo(uniprotAc) {
        const safeUniprot = String(uniprotAc || '').trim();
        if (!safeUniprot) return { notAvailable: true, reason: 'missing-id' };

        const endpoint = `https://alphafold.ebi.ac.uk/api/prediction/${encodeURIComponent(safeUniprot)}`;
        const response = await fetch(endpoint);

        if (response.status === 404) return { notAvailable: true, reason: 'not-found' };
        if (!response.ok) throw new Error(`AlphaFold API error ${response.status}`);

        const payload = await response.json();
        const first = Array.isArray(payload) ? payload[0] : null;
        const modelUrl = first?.pdbUrl || first?.cifUrl || first?.bcifUrl || '';
        if (!modelUrl) return { notAvailable: true, reason: 'no-url' };

        const lowerUrl = String(modelUrl).toLowerCase();
        const format = lowerUrl.includes('.pdb') ? 'pdb' : 'mmcif';
        return { notAvailable: false, modelUrl, format };
    }

    const proteinComplexThreeToOne = {
        ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
        LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
        SEC: 'U', PYL: 'O', ASX: 'B', GLX: 'Z', UNK: 'X'
    };
    let ammoLoadPromise = null;

    function disposeProteinComplexStructureDetailViewer() {
        if (proteinComplexStructureDetailBackgroundObserver) {
            proteinComplexStructureDetailBackgroundObserver.disconnect();
            proteinComplexStructureDetailBackgroundObserver = null;
        }
        if (proteinComplexStructureDetailViewer?.plugin?.dispose) {
            proteinComplexStructureDetailViewer.plugin.dispose();
        }
        proteinComplexStructureDetailViewer = null;
    }

    function closeProteinComplexStructureDetailOverlay() {
        openProteinComplexStructuresDashboard();
    }

    function setProteinComplexStructureDetailProgress(percent, message) {
        const container = document.getElementById('protein-complex-structure-detail-view');
        if (!container) return;
        const bar = container.querySelector('#protein-complex-detail-progress-bar');
        const status = container.querySelector('#protein-complex-detail-status');
        if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        if (status && typeof message === 'string') status.textContent = message;
    }

    function tokenizeProteinComplexMmCif(text) {
        const tokens = [];
        const source = String(text || '');
        let index = 0;
        while (index < source.length) {
            const char = source[index];
            if (/\s/.test(char)) {
                index += 1;
                continue;
            }
            if (char === '#') {
                while (index < source.length && source[index] !== '\n') index += 1;
                continue;
            }
            if (char === ';' && (index === 0 || source[index - 1] === '\n')) {
                index += 1;
                const start = index;
                while (index < source.length) {
                    if (source[index] === '\n' && source[index + 1] === ';') {
                        tokens.push(source.slice(start, index));
                        index += 2;
                        break;
                    }
                    index += 1;
                }
                if (index >= source.length) tokens.push(source.slice(start));
                continue;
            }
            if (char === '"' || char === "'") {
                const quote = char;
                index += 1;
                let value = '';
                while (index < source.length) {
                    const current = source[index];
                    if (current === quote) {
                        index += 1;
                        break;
                    }
                    if (current === '\\' && index + 1 < source.length) {
                        value += source[index + 1];
                        index += 2;
                        continue;
                    }
                    value += current;
                    index += 1;
                }
                tokens.push(value);
                continue;
            }
            let end = index;
            while (end < source.length && !/\s/.test(source[end])) end += 1;
            tokens.push(source.slice(index, end));
            index = end;
        }
        return tokens;
    }

    function parseProteinComplexMmCifChains(cifText) {
        const tokens = tokenizeProteinComplexMmCif(cifText);
        const tables = new Map();
        let index = 0;
        while (index < tokens.length) {
            if (tokens[index] !== 'loop_') {
                index += 1;
                continue;
            }
            index += 1;
            const columns = [];
            while (index < tokens.length && tokens[index].startsWith('_')) {
                columns.push(tokens[index]);
                index += 1;
            }
            if (!columns.length) continue;
            const tableName = columns[0].split('.')[0];
            const rows = [];
            while (index < tokens.length && tokens[index] !== 'loop_' && tokens[index] !== 'stop_' && !tokens[index].startsWith('_')) {
                const row = {};
                columns.forEach((column, columnIndex) => {
                    row[column] = tokens[index + columnIndex] ?? '?';
                });
                rows.push(row);
                index += columns.length;
            }
            tables.set(tableName, { columns, rows });
        }

        const entityPolyRows = tables.get('_entity_poly')?.rows || [];
        const asymRows = tables.get('_struct_asym')?.rows || [];
        const chainRows = [];

        const entitySequenceById = new Map();
        entityPolyRows.forEach(row => {
            const entityId = String(row['_entity_poly.entity_id'] || '').trim();
            const sequence = String(row['_entity_poly.pdbx_seq_one_letter_code_can'] || row['_entity_poly.pdbx_seq_one_letter_code'] || '').replace(/\s+/g, '').replace(/\./g, 'X').trim();
            if (entityId && sequence) entitySequenceById.set(entityId, sequence);
        });

        asymRows.forEach(row => {
            const asymId = String(row['_struct_asym.id'] || '').trim();
            const entityId = String(row['_struct_asym.entity_id'] || '').trim();
            const sequence = entitySequenceById.get(entityId) || '';
            if (!asymId || !sequence) return;
            chainRows.push({ chainId: asymId, sequence });
        });

        return chainRows.length ? chainRows : Array.from(entitySequenceById.entries()).map(([entityId, sequence]) => ({ chainId: entityId, sequence }));
    }

    function proteinComplexStructureResidueLabel(residue) {
        const seq = String(residue?.sequence || '').trim();
        if (seq) return seq;
        const name = String(residue?.resName || '').trim().toUpperCase();
        return proteinComplexThreeToOne[name] || 'X';
    }

    function parseProteinComplexPdbAtomChains(pdbText) {
        const chains = new Map();
        const lines = String(pdbText || '').split(/\r?\n/);
        lines.forEach(line => {
            if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) return;
            const atomName = line.slice(12, 16).trim();
            if (atomName !== 'CA') return;
            const chainId = line.slice(21, 22).trim() || 'A';
            const resSeq = Number.parseInt(line.slice(22, 26).trim(), 10);
            if (!Number.isFinite(resSeq)) return;
            const insCode = line.slice(26, 27).trim();
            const key = `${resSeq}${insCode}`;
            const resName = line.slice(17, 20).trim().toUpperCase();
            const x = Number.parseFloat(line.slice(30, 38));
            const y = Number.parseFloat(line.slice(38, 46));
            const z = Number.parseFloat(line.slice(46, 54));
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
            if (!chains.has(chainId)) chains.set(chainId, { chainId, residues: [] });
            const chain = chains.get(chainId);
            if (chain.residues.some(residue => residue.key === key)) return;
            chain.residues.push({ key, resSeq, resName, x, y, z, sequence: proteinComplexStructureResidueLabel({ resName }) });
        });
        return Array.from(chains.values()).map(chain => ({
            ...chain,
            sequence: chain.residues.map(residue => residue.sequence).join('')
        }));
    }

    function parseProteinComplexMmCifAtomChains(cifText) {
        const tokens = tokenizeProteinComplexMmCif(cifText);
        const tables = new Map();
        let index = 0;
        while (index < tokens.length) {
            if (tokens[index] !== 'loop_') {
                index += 1;
                continue;
            }
            index += 1;
            const columns = [];
            while (index < tokens.length && tokens[index].startsWith('_')) {
                columns.push(tokens[index]);
                index += 1;
            }
            if (!columns.length) continue;
            const rows = [];
            while (index < tokens.length && tokens[index] !== 'loop_' && tokens[index] !== 'stop_' && !tokens[index].startsWith('_')) {
                const row = {};
                columns.forEach((column, columnIndex) => {
                    row[column] = tokens[index + columnIndex] ?? '?';
                });
                rows.push(row);
                index += columns.length;
            }
            tables.set(columns[0].split('.')[0], { columns, rows });
        }

        const atomRows = tables.get('_atom_site')?.rows || [];
        const chains = new Map();
        atomRows.forEach(row => {
            const atomName = String(row['_atom_site.label_atom_id'] || row['_atom_site.auth_atom_id'] || '').trim();
            if (atomName !== 'CA') return;
            const chainId = String(row['_atom_site.label_asym_id'] || row['_atom_site.auth_asym_id'] || 'A').trim() || 'A';
            const resSeq = Number.parseInt(String(row['_atom_site.label_seq_id'] || row['_atom_site.auth_seq_id'] || '').trim(), 10);
            if (!Number.isFinite(resSeq)) return;
            const resName = String(row['_atom_site.label_comp_id'] || row['_atom_site.auth_comp_id'] || 'UNK').trim().toUpperCase();
            const x = Number.parseFloat(String(row['_atom_site.Cartn_x'] || '').trim());
            const y = Number.parseFloat(String(row['_atom_site.Cartn_y'] || '').trim());
            const z = Number.parseFloat(String(row['_atom_site.Cartn_z'] || '').trim());
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
            if (!chains.has(chainId)) chains.set(chainId, { chainId, residues: [] });
            const chain = chains.get(chainId);
            const key = `${resSeq}`;
            if (chain.residues.some(residue => residue.key === key)) return;
            chain.residues.push({ key, resSeq, resName, x, y, z, sequence: proteinComplexStructureResidueLabel({ resName }) });
        });

        return Array.from(chains.values()).map(chain => ({
            ...chain,
            sequence: chain.residues.map(residue => residue.sequence).join('')
        }));
    }

    function parseProteinComplexAtomChains(text, format) {
        const lower = String(format || '').toLowerCase();
        return lower === 'mmcif' ? parseProteinComplexMmCifAtomChains(text) : parseProteinComplexPdbAtomChains(text);
    }

    function buildProteinComplexPdbFromChains(chainModels) {
        const lines = [];
        let atomSerial = 1;
        const chainIds = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        chainModels.forEach((chainModel, chainIndex) => {
            const chainId = chainIds[chainIndex % chainIds.length];
            (chainModel.residues || []).forEach(residue => {
                const x = Number(residue.x || 0).toFixed(3).padStart(8, ' ');
                const y = Number(residue.y || 0).toFixed(3).padStart(8, ' ');
                const z = Number(residue.z || 0).toFixed(3).padStart(8, ' ');
                const resSeq = String(Number(residue.resSeq || 0)).padStart(4, ' ');
                const resName = String(residue.resName || 'UNK').padEnd(3, ' ');
                lines.push(`ATOM  ${String(atomSerial).padStart(5, ' ')}  CA  ${resName} ${chainId}${resSeq}    ${x}${y}${z}  1.00 50.00           C`);
                atomSerial += 1;
            });
            lines.push('TER');
        });
        lines.push('END');
        return lines.join('\n');
    }

    function kabschFit(sourcePoints, targetPoints) {
        const count = Math.min(Array.isArray(sourcePoints) ? sourcePoints.length : 0, Array.isArray(targetPoints) ? targetPoints.length : 0);
        if (!count) {
            return { rotation: [[1,0,0],[0,1,0],[0,0,1]], translation: [0, 0, 0] };
        }
        const sourceCentroid = [0, 0, 0];
        const targetCentroid = [0, 0, 0];
        for (let index = 0; index < count; index += 1) {
            sourceCentroid[0] += sourcePoints[index][0];
            sourceCentroid[1] += sourcePoints[index][1];
            sourceCentroid[2] += sourcePoints[index][2];
            targetCentroid[0] += targetPoints[index][0];
            targetCentroid[1] += targetPoints[index][1];
            targetCentroid[2] += targetPoints[index][2];
        }
        sourceCentroid[0] /= count; sourceCentroid[1] /= count; sourceCentroid[2] /= count;
        targetCentroid[0] /= count; targetCentroid[1] /= count; targetCentroid[2] /= count;

        const covariance = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ];
        for (let index = 0; index < count; index += 1) {
            const source = [
                sourcePoints[index][0] - sourceCentroid[0],
                sourcePoints[index][1] - sourceCentroid[1],
                sourcePoints[index][2] - sourceCentroid[2]
            ];
            const target = [
                targetPoints[index][0] - targetCentroid[0],
                targetPoints[index][1] - targetCentroid[1],
                targetPoints[index][2] - targetCentroid[2]
            ];
            covariance[0][0] += source[0] * target[0];
            covariance[0][1] += source[0] * target[1];
            covariance[0][2] += source[0] * target[2];
            covariance[1][0] += source[1] * target[0];
            covariance[1][1] += source[1] * target[1];
            covariance[1][2] += source[1] * target[2];
            covariance[2][0] += source[2] * target[0];
            covariance[2][1] += source[2] * target[1];
            covariance[2][2] += source[2] * target[2];
        }

        const sxx = covariance[0][0];
        const sxy = covariance[0][1];
        const sxz = covariance[0][2];
        const syx = covariance[1][0];
        const syy = covariance[1][1];
        const syz = covariance[1][2];
        const szx = covariance[2][0];
        const szy = covariance[2][1];
        const szz = covariance[2][2];
        const trace = sxx + syy + szz;
        const symmetric4x4 = [
            [trace, syz - szy, szx - sxz, sxy - syx],
            [syz - szy, sxx - syy - szz, sxy + syx, szx + sxz],
            [szx - sxz, sxy + syx, -sxx + syy - szz, syz + szy],
            [sxy - syx, szx + sxz, syz + szy, -sxx - syy + szz]
        ];

        let quaternion = [1, 0, 0, 0];
        for (let iteration = 0; iteration < 32; iteration += 1) {
            const next = [0, 0, 0, 0];
            for (let row = 0; row < 4; row += 1) {
                for (let col = 0; col < 4; col += 1) {
                    next[row] += symmetric4x4[row][col] * quaternion[col];
                }
            }
            const magnitude = Math.hypot(next[0], next[1], next[2], next[3]) || 1;
            quaternion = next.map(value => value / magnitude);
        }

        const [w, x, y, z] = quaternion;
        const xx = x * x;
        const yy = y * y;
        const zz = z * z;
        const xy = x * y;
        const xz = x * z;
        const yz = y * z;
        const wx = w * x;
        const wy = w * y;
        const wz = w * z;
        const rotation = [
            [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
            [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
            [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)]
        ];

        const transformedSourceCentroid = [
            rotation[0][0] * sourceCentroid[0] + rotation[0][1] * sourceCentroid[1] + rotation[0][2] * sourceCentroid[2],
            rotation[1][0] * sourceCentroid[0] + rotation[1][1] * sourceCentroid[1] + rotation[1][2] * sourceCentroid[2],
            rotation[2][0] * sourceCentroid[0] + rotation[2][1] * sourceCentroid[1] + rotation[2][2] * sourceCentroid[2]
        ];
        return {
            rotation,
            translation: [
                targetCentroid[0] - transformedSourceCentroid[0],
                targetCentroid[1] - transformedSourceCentroid[1],
                targetCentroid[2] - transformedSourceCentroid[2]
            ]
        };
    }

    function applyRigidTransform(point, transform) {
        const rotation = transform?.rotation || [[1,0,0],[0,1,0],[0,0,1]];
        const translation = transform?.translation || [0, 0, 0];
        return [
            rotation[0][0] * point[0] + rotation[0][1] * point[1] + rotation[0][2] * point[2] + translation[0],
            rotation[1][0] * point[0] + rotation[1][1] * point[1] + rotation[1][2] * point[2] + translation[1],
            rotation[2][0] * point[0] + rotation[2][1] * point[1] + rotation[2][2] * point[2] + translation[2]
        ];
    }

    async function ensureAmmoLoaded() {
        if (window.Ammo && typeof window.Ammo !== 'function') return window.Ammo;
        if (ammoLoadPromise) return ammoLoadPromise;
        ammoLoadPromise = (async () => {
            const ammo = window.Ammo;
            if (typeof ammo === 'function') {
                const loaded = await ammo();
                window.Ammo = loaded;
                return loaded;
            }
            if (ammo) return ammo;
            throw new Error('Ammo.js failed to initialize');
        })();
        try {
            return await ammoLoadPromise;
        } finally {
            ammoLoadPromise = null;
        }
    }

    async function refineProteinComplexWithAmmo(referenceChains, matchedChains) {
        const AmmoLib = await ensureAmmoLoaded();
        const collisionConfiguration = new AmmoLib.btDefaultCollisionConfiguration();
        const dispatcher = new AmmoLib.btCollisionDispatcher(collisionConfiguration);
        const broadphase = new AmmoLib.btDbvtBroadphase();
        const solver = new AmmoLib.btSequentialImpulseConstraintSolver();
        const world = new AmmoLib.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
        world.setGravity(new AmmoLib.btVector3(0, 0, 0));

        const bodies = [];
        const constraints = [];
        const anchorBodies = [];
        const cleanup = () => {
            constraints.forEach(item => world.removeConstraint(item));
            bodies.forEach(item => world.removeRigidBody(item.body));
            anchorBodies.forEach(item => world.removeRigidBody(item.body));
        };

        try {
            matchedChains.forEach(chain => {
                const referenceChain = chain.referenceChain;
                const modelResidues = chain.modelResidues || [];
                const matchedPairs = chain.matchedPairs || [];
                const referenceResidueByModelIndex = new Map(matchedPairs.map(pair => [pair.modelIndex, pair.referenceIndex]));
                const sourcePoints = matchedPairs.map(pair => {
                    const residue = modelResidues[pair.modelIndex - 1];
                    return residue ? [residue.x, residue.y, residue.z] : null;
                }).filter(Boolean);
                const targetPoints = matchedPairs.map(pair => {
                    const residue = referenceChain.residues[pair.referenceIndex - 1];
                    return residue ? [residue.x, residue.y, residue.z] : null;
                }).filter(Boolean);
                const initialTransform = kabschFit(sourcePoints, targetPoints);

                let previousBody = null;
                const chainBodies = modelResidues.map((residue, residueIndex) => {
                    const initialResiduePosition = applyRigidTransform([residue.x, residue.y, residue.z], initialTransform);
                    const transform = new AmmoLib.btTransform();
                    transform.setIdentity();
                    transform.setOrigin(new AmmoLib.btVector3(initialResiduePosition[0], initialResiduePosition[1], initialResiduePosition[2]));
                    const shape = new AmmoLib.btSphereShape(2.0);
                    const mass = 0.8;
                    const localInertia = new AmmoLib.btVector3(0, 0, 0);
                    shape.calculateLocalInertia(mass, localInertia);
                    const motionState = new AmmoLib.btDefaultMotionState(transform);
                    const bodyInfo = new AmmoLib.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
                    const body = new AmmoLib.btRigidBody(bodyInfo);
                    body.setActivationState(4);
                    world.addRigidBody(body);
                    const referenceResidueIndex = referenceResidueByModelIndex.get(residueIndex + 1);
                    const target = (referenceResidueIndex ? referenceChain.residues[referenceResidueIndex - 1] : null)
                        || referenceChain.residues[residueIndex]
                        || referenceChain.residues[referenceChain.residues.length - 1]
                        || residue;
                    const anchorTransform = new AmmoLib.btTransform();
                    anchorTransform.setIdentity();
                    anchorTransform.setOrigin(new AmmoLib.btVector3(target.x, target.y, target.z));
                    const anchorShape = new AmmoLib.btSphereShape(0.01);
                    const anchorMotionState = new AmmoLib.btDefaultMotionState(anchorTransform);
                    const anchorInfo = new AmmoLib.btRigidBodyConstructionInfo(0, anchorMotionState, anchorShape, new AmmoLib.btVector3(0, 0, 0));
                    const anchorBody = new AmmoLib.btRigidBody(anchorInfo);
                    world.addRigidBody(anchorBody);
                    anchorBodies.push({ body: anchorBody });

                    if (previousBody) {
                        try {
                            const frameA = new AmmoLib.btTransform();
                            frameA.setIdentity();
                            const frameB = new AmmoLib.btTransform();
                            frameB.setIdentity();
                            const bond = new AmmoLib.btSliderConstraint(previousBody, body, frameA, frameB, true);
                            bond.setLowerLinLimit(3.8);
                            bond.setUpperLinLimit(3.8);
                            bond.setLowerAngLimit(0);
                            bond.setUpperAngLimit(0);
                            world.addConstraint(bond, true);
                            constraints.push(bond);
                        } catch {}
                    }
                    previousBody = body;

                    bodies.push({
                        body,
                        target: [target.x, target.y, target.z],
                        residue,
                        chainId: chain.referenceChain.chainId,
                        initialResiduePosition
                    });
                    return { body, target, residue, initialResiduePosition };
                });

                for (let step = 0; step < 90; step += 1) {
                    chainBodies.forEach(entry => {
                        const body = entry.body;
                        const motionState = body.getMotionState();
                        if (!motionState) return;
                        const transform = new AmmoLib.btTransform();
                        motionState.getWorldTransform(transform);
                        const origin = transform.getOrigin();
                        const velocity = body.getLinearVelocity ? body.getLinearVelocity() : null;
                        const force = new AmmoLib.btVector3(
                            (entry.target[0] - origin.x()) * 5.5 - (velocity ? velocity.x() * 0.2 : 0),
                            (entry.target[1] - origin.y()) * 5.5 - (velocity ? velocity.y() * 0.2 : 0),
                            (entry.target[2] - origin.z()) * 5.5 - (velocity ? velocity.z() * 0.2 : 0)
                        );
                        body.applyCentralForce(force);
                        AmmoLib.destroy?.(force);
                    });
                    world.stepSimulation(1 / 30, 6);
                }

                const refinedResidues = chainBodies.map(entry => {
                    const motionState = entry.body.getMotionState();
                    const transform = new AmmoLib.btTransform();
                    motionState.getWorldTransform(transform);
                    const origin = transform.getOrigin();
                    return {
                        ...entry.residue,
                        x: origin.x(),
                        y: origin.y(),
                        z: origin.z()
                    };
                });

                const hasValidSpread = refinedResidues.length > 1 && (() => {
                    let minX = Infinity;
                    let minY = Infinity;
                    let minZ = Infinity;
                    let maxX = -Infinity;
                    let maxY = -Infinity;
                    let maxZ = -Infinity;
                    for (const residue of refinedResidues) {
                        if (!Number.isFinite(residue.x) || !Number.isFinite(residue.y) || !Number.isFinite(residue.z)) return false;
                        minX = Math.min(minX, residue.x);
                        minY = Math.min(minY, residue.y);
                        minZ = Math.min(minZ, residue.z);
                        maxX = Math.max(maxX, residue.x);
                        maxY = Math.max(maxY, residue.y);
                        maxZ = Math.max(maxZ, residue.z);
                    }
                    const dx = maxX - minX;
                    const dy = maxY - minY;
                    const dz = maxZ - minZ;
                    return Math.sqrt(dx * dx + dy * dy + dz * dz) > 1e-3;
                })();

                chain.finalResidues = hasValidSpread
                    ? refinedResidues
                    : chainBodies.map(entry => ({
                        ...entry.residue,
                        x: entry.initialResiduePosition[0],
                        y: entry.initialResiduePosition[1],
                        z: entry.initialResiduePosition[2]
                    }));
            });

            return matchedChains.map(chain => ({
                chainId: chain.referenceChain.chainId,
                residues: chain.finalResidues || []
            }));
        } finally {
            cleanup();
        }
    }

    function alignProteinComplexSequences(referenceSequence, modelSequence) {
        const reference = String(referenceSequence || '').toUpperCase().replace(/[^A-Z]/g, '');
        const model = String(modelSequence || '').toUpperCase().replace(/[^A-Z]/g, '');
        const rows = reference.length + 1;
        const cols = model.length + 1;
        const scores = Array.from({ length: rows }, () => new Int32Array(cols));
        const trace = Array.from({ length: rows }, () => new Uint8Array(cols));
        const gapPenalty = -1;
        const matchScore = 2;
        const mismatchScore = -1;

        for (let row = 1; row < rows; row += 1) {
            scores[row][0] = row * gapPenalty;
            trace[row][0] = 1;
        }
        for (let col = 1; col < cols; col += 1) {
            scores[0][col] = col * gapPenalty;
            trace[0][col] = 2;
        }

        for (let row = 1; row < rows; row += 1) {
            for (let col = 1; col < cols; col += 1) {
                const diag = scores[row - 1][col - 1] + (reference[row - 1] === model[col - 1] ? matchScore : mismatchScore);
                const up = scores[row - 1][col] + gapPenalty;
                const left = scores[row][col - 1] + gapPenalty;
                if (diag >= up && diag >= left) {
                    scores[row][col] = diag;
                    trace[row][col] = 0;
                } else if (up >= left) {
                    scores[row][col] = up;
                    trace[row][col] = 1;
                } else {
                    scores[row][col] = left;
                    trace[row][col] = 2;
                }
            }
        }

        const alignedReference = [];
        const alignedModel = [];
        const matchedPairs = [];
        let row = reference.length;
        let col = model.length;
        while (row > 0 || col > 0) {
            const direction = trace[row][col];
            if (row > 0 && col > 0 && direction === 0) {
                alignedReference.push(reference[row - 1]);
                alignedModel.push(model[col - 1]);
                if (reference[row - 1] === model[col - 1]) {
                    matchedPairs.push({ referenceIndex: row, modelIndex: col, residue: reference[row - 1] });
                }
                row -= 1;
                col -= 1;
            } else if (row > 0 && (col === 0 || direction === 1)) {
                alignedReference.push(reference[row - 1]);
                alignedModel.push('-');
                row -= 1;
            } else {
                alignedReference.push('-');
                alignedModel.push(model[col - 1]);
                col -= 1;
            }
        }

        alignedReference.reverse();
        alignedModel.reverse();
        matchedPairs.reverse();
        const alignedPairs = matchedPairs.length + alignedReference.filter((residue, index) => residue !== '-' && alignedModel[index] !== '-' && residue !== alignedModel[index]).length;
        const comparedPairs = alignedReference.reduce((count, residue, index) => count + (residue !== '-' && alignedModel[index] !== '-' ? 1 : 0), 0);
        const identity = comparedPairs ? matchedPairs.length / comparedPairs : 0;

        return {
            identity,
            matchedPairs,
            alignedReference: alignedReference.join(''),
            alignedModel: alignedModel.join(''),
            comparedPairs,
            alignedPairs
        };
    }

    async function openProteinComplexStructureDetail(entry) {
        proteinComplexStructuresDetailEntry = entry;
        if (currentViewId === 'Protein Complex Structures') {
            renderProteinComplexStructuresView();
        }
    }

    function openProteinComplexStructuresDashboard() {
        proteinComplexStructureDetailRenderToken += 1;
        disposeProteinComplexStructureDetailViewer();
        proteinComplexStructuresDetailEntry = null;
        if (currentViewId === 'Protein Complex Structures') {
            renderProteinComplexStructuresView();
        }
    }

    function getProteinComplexSearchCandidates() {
        return Array.from(proteinMetadata.entries())
            .map(([nodeId, meta]) => ({
                nodeId,
                label: String(meta?.preferred_name || nodeId || '').trim(),
                sequence: String(meta?.sequence || '').trim(),
                uniprotAc: String(meta?.uniprotAc || getPreferredUniProtAliasForProtein(nodeId) || '').trim()
            }))
            .filter(candidate => candidate.sequence);
    }

    // Configurable matching parameters for complex matching prefilter
    // Exposed on window for quick tuning in the console: window.complexMatchingKmerSize, window.complexMatchingMinSharedKmers
    window.complexMatchingKmerSize = window.complexMatchingKmerSize || 7;
    window.complexMatchingMinSharedKmers = window.complexMatchingMinSharedKmers || 5;
    window.complexMatchingMaxFallbackCandidates = window.complexMatchingMaxFallbackCandidates || 200;

    function buildProteinComplexSequenceIndex(candidates) {
        const k = Math.max(1, Math.floor(Number(window.complexMatchingKmerSize) || 7));
        const byKmer = new Map();
        const candidateList = Array.isArray(candidates) ? candidates : [];

        candidateList.forEach(candidate => {
            const sequence = String(candidate?.sequence || '').toUpperCase().replace(/[^A-Z]/g, '');
            if (!sequence) return;

            const kmers = new Set();
            if (sequence.length < k) {
                kmers.add(sequence);
            } else {
                for (let index = 0; index <= sequence.length - k; index += 1) {
                    kmers.add(sequence.slice(index, index + k));
                }
            }

            candidate._indexedSequence = sequence;
            candidate._indexedKmers = kmers;
            kmers.forEach(kmer => {
                if (!byKmer.has(kmer)) byKmer.set(kmer, []);
                byKmer.get(kmer).push(candidate);
            });
        });

        return { byKmer, candidates: candidateList, k };
    }

    function getProteinComplexIndexedCandidates(referenceSequence, sequenceIndex) {
        const k = sequenceIndex?.k || Math.max(1, Math.floor(Number(window.complexMatchingKmerSize) || 7));
        const minShared = Math.max(1, Math.floor(Number(window.complexMatchingMinSharedKmers) || 3));
        const maxFallback = Math.max(1, Math.floor(Number(window.complexMatchingMaxFallbackCandidates) || 200));

        const sequence = String(referenceSequence || '').toUpperCase().replace(/[^A-Z]/g, '');
        const candidates = Array.isArray(sequenceIndex?.candidates) ? sequenceIndex.candidates : [];
        const byKmer = sequenceIndex?.byKmer instanceof Map ? sequenceIndex.byKmer : new Map();

        if (!sequence) return [];
        if (sequence.length < k) return candidates;

        const hits = new Map();
        for (let index = 0; index <= sequence.length - k; index += 1) {
            const kmer = sequence.slice(index, index + k);
            const matchedCandidates = byKmer.get(kmer) || [];
            matchedCandidates.forEach(candidate => {
                const count = hits.get(candidate.nodeId) || 0;
                hits.set(candidate.nodeId, count + 1);
            });
        }

        const rankedCandidates = Array.from(hits.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([nodeId, count]) => ({ nodeId, count, candidate: candidates.find(c => c.nodeId === nodeId) }))
            .filter(item => item.candidate)
            .map(item => item.candidate);

        // Return only candidates that meet the minShared cutoff; if none meet, return a bounded fallback set.
        const filteredByMin = rankedCandidates.filter(node => (hits.get(node.nodeId) || 0) >= minShared);
        if (filteredByMin.length) return filteredByMin;

        // Fallback: return top-N ranked candidates, or all if fewer than N
        if (rankedCandidates.length) return rankedCandidates.slice(0, maxFallback);
        return candidates.slice(0, maxFallback);
    }

    function getProteinComplexUniProtCandidates(nodeId) {
        const meta = proteinMetadata.get(nodeId) || {};
        const aliases = aliasData.get(nodeId) || [];
        return Array.from(new Set([
            getPreferredUniProtAliasForProtein(nodeId),
            meta.uniprotAc,
            ...aliases
                .filter(entry => {
                    const source = String(entry?.source || '').toLowerCase();
                    return source.includes('swiss_prot') || source === 'uniprot_ac';
                })
                .map(entry => entry?.alias)
        ].map(value => String(value || '').trim()).filter(Boolean)));
    }

    async function fetchProteinComplexReferenceStructure(pdbId) {
        const cleanId = String(pdbId || '').trim().toUpperCase();
        if (!cleanId) throw new Error('Missing PDB ID');
        const candidates = [
            { url: `https://files.rcsb.org/download/${encodeURIComponent(cleanId)}.cif`, format: 'mmcif' },
            { url: `https://files.rcsb.org/download/${encodeURIComponent(cleanId)}.pdb`, format: 'pdb' }
        ];

        let lastError = null;
        for (const candidate of candidates) {
            const candidateStart = performance.now();
            console.log(`[complex timing] ${cleanId}: fetching reference ${candidate.format} from ${candidate.url}`);
            try {
                const response = await fetch(candidate.url, { cache: 'no-store' });
                console.log(`[complex timing] ${cleanId}: reference ${candidate.format} response ${response.status} in ${(performance.now() - candidateStart).toFixed(1)} ms`);
                if (!response.ok) {
                    lastError = new Error(`Reference structure request failed with status ${response.status}`);
                    continue;
                }
                const text = await response.text();
                if (text && text.trim()) {
                    console.log(`[complex timing] ${cleanId}: reference ${candidate.format} body read in ${(performance.now() - candidateStart).toFixed(1)} ms`);
                    return { text, format: candidate.format, url: candidate.url };
                }
            } catch (error) {
                console.warn(`[complex timing] ${cleanId}: reference ${candidate.format} failed after ${(performance.now() - candidateStart).toFixed(1)} ms`, error);
                lastError = error;
            }
        }

        throw lastError || new Error('No reference structure was available');
    }

    function renderProteinComplexStructureDetailView(view, entry) {
        const shell = document.createElement('div');
        shell.id = 'protein-complex-structure-detail-view';
        shell.className = 'structures-shell protein-complex-detail-shell';
        shell.style.position = 'relative';

        const header = document.createElement('div');
        header.className = 'structures-hero protein-complex-detail-hero';
        const headerCopy = document.createElement('div');
        headerCopy.className = 'structures-hero-copy';
        const title = document.createElement('h1');
        title.className = 'structures-title';
        title.textContent = entry.title || entry.pdbId || 'Protein complex';
        const subtitle = document.createElement('div');
        subtitle.className = 'structures-status';
        subtitle.textContent = `${entry.pdbId} • hidden reference used for matching`;
        headerCopy.appendChild(title);
        headerCopy.appendChild(subtitle);

        const toolbar = document.createElement('div');
        toolbar.className = 'structures-toolbar';
        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'btn-secondary';
        backBtn.textContent = 'Back to dashboard';
        backBtn.addEventListener('click', () => openProteinComplexStructuresDashboard());
        toolbar.appendChild(backBtn);

        header.appendChild(headerCopy);
        header.appendChild(toolbar);

        const progressWrap = document.createElement('div');
        progressWrap.id = 'protein-complex-detail-progress-wrap';
        const progressBar = document.createElement('div');
        progressBar.id = 'protein-complex-detail-progress-bar';
        progressWrap.appendChild(progressBar);

        const status = document.createElement('div');
        status.id = 'protein-complex-detail-status';
        status.className = 'protein-complex-detail-muted';
        status.textContent = 'Preparing complex viewer...';

        const viewer = document.createElement('div');
        viewer.id = 'protein-complex-detail-viewer';
        viewer.className = 'protein-complex-detail-viewer-shell';
        const viewerHost = document.createElement('div');
        viewerHost.id = 'protein-complex-detail-viewer-host';
        viewerHost.className = 'protein-complex-detail-viewer-host';
        viewer.appendChild(viewerHost);

        shell.appendChild(header);
        shell.appendChild(progressWrap);
        shell.appendChild(status);
        shell.appendChild(viewer);
        view.appendChild(shell);
    }

    async function loadProteinComplexStructureDetail(entry, renderToken) {
        const view = document.getElementById('protein-complex-structures-view');
        if (!view) return;

        const complexTimingStart = performance.now();
        const complexTiming = (label) => {
            console.log(`[complex timing] ${entry.pdbId}: ${label} at ${(performance.now() - complexTimingStart).toFixed(1)} ms`);
        };

        const title = document.querySelector('#protein-complex-structures-view .protein-complex-detail-hero .structures-title');
        const status = document.getElementById('protein-complex-detail-status');
        const viewerHost = document.getElementById('protein-complex-detail-viewer-host');
        if (title) title.textContent = entry.title || entry.pdbId || 'Protein complex';
        if (status) status.textContent = 'Fetching hidden reference structure and matching chains...';
        if (viewerHost) viewerHost.innerHTML = '';
        setProteinComplexStructureDetailProgress(5, 'Opening the complex detail view...');
        disposeProteinComplexStructureDetailViewer();

        let referenceChains = [];
        let matches = [];
        let refinedChains = [];

        try {
            complexTiming('start');
            setProteinComplexStructureDetailProgress(12, 'Fetching the hidden reference structure...');
            complexTiming('before reference fetch');
            const reference = await fetchProteinComplexReferenceStructure(entry.pdbId);
            complexTiming(`reference fetched (${reference.format})`);
            referenceChains = parseProteinComplexAtomChains(reference.text, reference.format);
            complexTiming(`reference parsed (${referenceChains.length} chains)`);

            setProteinComplexStructureDetailProgress(28, 'Matching reference chains to STRING proteins...');
            const proteinCandidates = getProteinComplexSearchCandidates();
            if (!proteinCandidates.length) {
                setProteinComplexStructureDetailProgress(100, 'No STRING protein sequences were available to match against this complex.');
                return;
            }

            const proteinSequenceIndex = buildProteinComplexSequenceIndex(proteinCandidates);
            console.log(`[complex debug] ${entry.pdbId}: indexed ${proteinSequenceIndex.candidates.length} STRING protein sequences into ${proteinSequenceIndex.byKmer.size} 3-mers`);

            const usedNodeIds = new Set();
            matches = referenceChains.map(referenceChain => {
                console.log(`[complex debug] ${entry.pdbId}: reference chain ${referenceChain.chainId} sequence=${referenceChain.sequence}`);
                const indexedCandidates = getProteinComplexIndexedCandidates(referenceChain.sequence, proteinSequenceIndex);
                console.log(`[complex debug] ${entry.pdbId}: reference chain ${referenceChain.chainId} indexed candidate count=${indexedCandidates.length}`);
                let bestMatch = null;
                indexedCandidates.forEach(candidate => {
                    if (usedNodeIds.has(candidate.nodeId)) return;
                    const alignment = alignProteinComplexSequences(referenceChain.sequence, candidate.sequence);
                    if (!bestMatch || alignment.identity > bestMatch.identity) {
                        bestMatch = {
                            referenceChainId: referenceChain.chainId,
                            proteinLabel: candidate.label || candidate.nodeId,
                            nodeId: candidate.nodeId,
                            sequence: candidate.sequence,
                            uniprotAc: candidate.uniprotAc,
                            identity: alignment.identity,
                            matchedPairs: alignment.matchedPairs,
                            referenceChain,
                            candidate
                        };
                    }
                });
                if (!bestMatch || bestMatch.identity < 0.25) {
                    console.log(`[complex debug] ${entry.pdbId}: reference chain ${referenceChain.chainId} no match above threshold`);
                    return null;
                }
                usedNodeIds.add(bestMatch.nodeId);
                console.log(`[complex debug] ${entry.pdbId}: reference chain ${referenceChain.chainId} best match ${bestMatch.nodeId} identity=${(bestMatch.identity * 100).toFixed(1)}%`);
                return bestMatch;
            }).filter(Boolean);
            complexTiming(`chain matching complete (${matches.length} matches)`);

            if (!matches.length) {
                setProteinComplexStructureDetailProgress(100, 'No STRING proteins matched the reference chains in this complex.');
                return;
            }

            setProteinComplexStructureDetailProgress(38, 'Fetching AlphaFold models for the matched proteins...');
            const modelChainsByNodeId = new Map();
            await Promise.all(matches.map(async match => {
                const candidate = match.candidate;
                try {
                    const modelStart = performance.now();
                    const accessionCandidates = getProteinComplexUniProtCandidates(candidate.nodeId);
                    console.log(`[complex timing] ${entry.pdbId}: ${candidate.nodeId} AlphaFold candidates = ${accessionCandidates.join(', ') || '(none)'}`);
                    for (const accession of accessionCandidates) {
                        const modelInfo = await getAlphaFoldModelInfo(accession);
                        if (modelInfo.notAvailable) continue;
                        const response = await fetch(modelInfo.modelUrl);
                        if (!response.ok) throw new Error(`AlphaFold model request failed with status ${response.status}`);
                        const text = await response.text();
                        const modelChains = parseProteinComplexAtomChains(text, modelInfo.format);
                        if (modelChains.length) {
                            modelChainsByNodeId.set(candidate.nodeId, { candidate, modelChains, modelInfo, accession });
                            console.log(`[complex timing] ${entry.pdbId}: ${candidate.nodeId} AlphaFold loaded via ${accession} in ${(performance.now() - modelStart).toFixed(1)} ms`);
                            break;
                        }
                    }
                } catch (error) {
                    console.warn('Skipping AlphaFold model during complex load', candidate.nodeId, error);
                }
            }));
            complexTiming(`AlphaFold fetch complete (${modelChainsByNodeId.size} models)`);

            const matchedChains = matches.map(match => {
                const modelEntry = modelChainsByNodeId.get(match.nodeId);
                const modelChain = modelEntry?.modelChains?.[0];
                if (!modelChain) return null;
                return {
                    ...match,
                    modelResidues: modelChain.residues || []
                };
            }).filter(Boolean);

            if (!matchedChains.length) {
                setProteinComplexStructureDetailProgress(100, 'No AlphaFold models were available for the proteins matched to this complex.');
                return;
            }

            if (renderToken !== proteinComplexStructureDetailRenderToken) return;
            setProteinComplexStructureDetailProgress(45, 'Refining the CA chain relaxation with Ammo.js...');
            complexTiming('before Ammo refinement');
            refinedChains = await refineProteinComplexWithAmmo(referenceChains, matchedChains);
            complexTiming(`Ammo refinement complete (${refinedChains.length} chains)`);

            const assemblyChains = refinedChains.length
                ? refinedChains
                : matchedChains.map(match => ({ chainId: match.referenceChain.chainId, residues: match.modelResidues || [] }));
            const assemblyPdb = buildProteinComplexPdbFromChains(assemblyChains);
            if (!assemblyPdb || !assemblyPdb.includes('ATOM')) {
                setProteinComplexStructureDetailProgress(100, 'The refined assembly was empty, so Mol* was not loaded.');
                return;
            }

            if (renderToken !== proteinComplexStructureDetailRenderToken) return;
            setProteinComplexStructureDetailProgress(75, 'Loading the refined predicted complex into Mol*...');
            complexTiming('before Mol* load');
            await ensureMolstarLoadedForProteinInfo();

            if (renderToken !== proteinComplexStructureDetailRenderToken) return;
            if (!viewerHost) throw new Error('Viewer host is unavailable');

            const canvasBg = getComputedStyle(canvas).backgroundColor || '#0f1115';
            proteinComplexStructureDetailViewer = await window.molstar.Viewer.create(viewerHost, {
                layoutShowControls: false,
                layoutIsExpanded: false,
                collapseLeftPanel: true,
                layoutShowRemoteState: false,
                layoutShowSequence: false,
                layoutShowLog: false,
                viewportShowExpand: false,
                viewportShowSelectionMode: false
            });

            const plugin = proteinComplexStructureDetailViewer?.plugin;
            const Color = window.molstar?.Color;
            if (plugin?.canvas3d?.setProps && Color) {
                try {
                    plugin.canvas3d.setProps({ renderer: { backgroundColor: Color(parseCssColorToHex(canvasBg)) } });
                } catch {}
            }

            proteinComplexStructureDetailBackgroundObserver = new MutationObserver(() => {
                viewerHost.querySelectorAll('canvas').forEach(canvasEl => {
                    canvasEl.style.backgroundColor = canvasBg;
                    canvasEl.style.background = canvasBg;
                });
            });
            proteinComplexStructureDetailBackgroundObserver.observe(viewerHost, { childList: true, subtree: true });

            setProteinComplexStructureDetailProgress(90, 'Rendering the refined predicted complex...');
            await proteinComplexStructureDetailViewer.loadStructureFromData(assemblyPdb, 'pdb', {
                dataLabel: `${entry.pdbId} refined complex`
            });
            proteinComplexStructureDetailViewer.plugin?.canvas3d?.requestResize?.();
            proteinComplexStructureDetailViewer.plugin?.canvas3d?.requestCameraReset?.({ durationMs: 0 });
            complexTiming('Mol* load complete');

            if (renderToken !== proteinComplexStructureDetailRenderToken) return;
            setProteinComplexStructureDetailProgress(100, 'Complex structure loaded.');
            console.log(`[complex timing] ${entry.pdbId}: total ${(performance.now() - complexTimingStart).toFixed(1)} ms`);
        } catch (error) {
            if (renderToken !== proteinComplexStructureDetailRenderToken) return;
            setProteinComplexStructureDetailProgress(100, `Could not load the complex structure: ${error?.message || 'Unknown error'}`);
            console.warn(`[complex timing] ${entry.pdbId}: failed after ${(performance.now() - complexTimingStart).toFixed(1)} ms`, error);
        }
    }

    function renderProteinInfoLinksView(body, nodeId) {
        const linkData = getNodeInfoLinkData(nodeId);
        const links = [
            { label: 'UniProt', url: linkData.uniprotUrl },
            { label: 'NCBI protein', url: linkData.ncbiProteinUrl },
            { label: 'NCBI Gene', url: linkData.ncbiGeneUrl },
            { label: 'PubMed', url: linkData.pubmedUrl },
            {
                label: 'PDB',
                onclick: () => {
                    const row = {
                        'Protein ID': nodeId,
                        __linkData: linkData
                    };
                    nodeInfoTableState.filteredRows = [row];
                    openNodeInfoPdbOverlay(0);
                },
                disabled: !Array.isArray(linkData.pdbLinks) || linkData.pdbLinks.length === 0
            },
            { label: 'IntAct', url: linkData.intactUrl },
            { label: 'STRING', url: linkData.stringUrl }
        ];

        const wrap = document.createElement('div');
        wrap.id = 'protein-info-links-grid';

        links.forEach(link => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-secondary';
            btn.textContent = link.label;
            const hasUrl = !!link.url;
            const hasOnclick = typeof link.onclick === 'function';
            const disabled = (typeof link.disabled === 'boolean')
                ? link.disabled
                : (!hasUrl && !hasOnclick);
            btn.disabled = disabled;
            btn.style.opacity = disabled ? '0.45' : '1';
            btn.addEventListener('click', () => {
                if (disabled) return;
                if (hasOnclick) {
                    link.onclick();
                    return;
                }
                if (hasUrl) window.open(link.url, '_blank', 'noopener');
            });
            wrap.appendChild(btn);
        });

        body.innerHTML = '';
        body.appendChild(wrap);
    }

    async function renderProteinInfoStructureView(body, nodeId) {
        const renderToken = ++proteinInfoStructureRenderToken;
        const uniprotAc = getPreferredUniProtAliasForProtein(nodeId);

        body.innerHTML = '';
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.style.gap = '8px';
        const status = document.createElement('div');
        status.className = 'protein-structure-status';
        status.textContent = 'Fetching AlphaFold Model...';
        body.appendChild(status);

        if (!uniprotAc) {
            status.textContent = 'No UniProt_AC found for this protein.';
            return;
        }

        let modelInfo;
        try {
            modelInfo = await getAlphaFoldModelInfo(uniprotAc);
        } catch (err) {
            if (renderToken !== proteinInfoStructureRenderToken) return;
            status.textContent = `Could not fetch AlphaFold model: ${err?.message || 'Unknown error'}`;
            return;
        }

        if (renderToken !== proteinInfoStructureRenderToken) return;

        if (modelInfo.notAvailable) {
            status.textContent = 'Structure not available in AlphaFold DB for this ID';
            return;
        }

        try {
            await ensureMolstarLoadedForProteinInfo();
        } catch (err) {
            if (renderToken !== proteinInfoStructureRenderToken) return;
            status.textContent = `Could not initialize Mol*: ${err?.message || 'Unknown error'}`;
            return;
        }

        if (renderToken !== proteinInfoStructureRenderToken) return;

        const host = document.createElement('div');
        host.id = 'protein-structure-viewer-host';
        const canvasBg = getComputedStyle(canvas).backgroundColor || '#0f1115';
        host.style.background = canvasBg;
        body.innerHTML = '';
        body.appendChild(host);

        const applyViewerBackground = () => {
            host.querySelectorAll('canvas').forEach(canvasEl => {
                canvasEl.style.backgroundColor = canvasBg;
                canvasEl.style.background = canvasBg;
            });
            host.querySelectorAll('.msp-layout, .msp-plugin, .msp-plugin > div').forEach(el => {
                el.style.backgroundColor = canvasBg;
                el.style.background = canvasBg;
            });
        };

        proteinInfoMolstarBackgroundObserver = new MutationObserver(() => applyViewerBackground());
        proteinInfoMolstarBackgroundObserver.observe(host, { childList: true, subtree: true });

        disposeProteinInfoMolstarViewer();

        try {
            proteinInfoMolstarViewer = await window.molstar.Viewer.create(host, {
                layoutShowControls: false,
                layoutIsExpanded: false,
                collapseLeftPanel: true,
                layoutShowRemoteState: false,
                layoutShowSequence: false,
                layoutShowLog: false,
                viewportShowExpand: false,
                viewportShowSelectionMode: false
            });

            const colorHex = parseCssColorToHex(canvasBg);
            const plugin = proteinInfoMolstarViewer?.plugin;
            const setCanvasProps = plugin?.canvas3d?.setProps;
            const Color = window.molstar?.Color;
            if (setCanvasProps && Color) {
                try {
                    plugin.canvas3d.setProps({ renderer: { backgroundColor: Color(colorHex) } });
                } catch {}
            }
            applyViewerBackground();

            try {
                await proteinInfoMolstarViewer.loadStructureFromUrl(modelInfo.modelUrl, modelInfo.format, false, {
                    representationParams: {
                        type: 'cartoon',
                        theme: { globalName: 'plddt-confidence' }
                    }
                });
            } catch {
                // Fallback for Mol* builds with different representation option signatures.
                await proteinInfoMolstarViewer.loadStructureFromUrl(modelInfo.modelUrl, modelInfo.format, false);
            }
            proteinInfoMolstarViewer.plugin?.canvas3d?.requestResize?.();
            proteinInfoMolstarViewer.plugin?.canvas3d?.requestCameraReset?.({ durationMs: 0 });
            applyViewerBackground();
        } catch (err) {
            if (renderToken !== proteinInfoStructureRenderToken) return;
            body.innerHTML = '';
            const fail = document.createElement('div');
            fail.className = 'protein-structure-status';
            fail.textContent = `Could not render structure: ${err?.message || 'Unknown error'}`;
            body.appendChild(fail);
        }
    }

    function getNodeForInfo(id) {
        if (currentViewId === 'Mind Map') {
            const layout = mindMapLayoutState || buildMindMapLayout();
            const mindNode = layout?.nodes?.get(id);
            if (mindNode) {
                return { id: mindNode.id, label: mindNode.label, parents: mindNode.parents, children: mindNode.children, layer: '', centrality: '', eigen: '' };
            }
        }
        if (currentViewId !== 'base' && activeSubData?.nodes?.length) {
            const subNode = activeSubData.nodes.find(n => n.id === id);
            if (subNode) return subNode;
        }
        return nodeMap.get(id) || nodes.find(n => n.id === id) || { id, layer: '', centrality: '', eigen: '' };
    }

    function escapeCSV(value) {
        const str = value === undefined || value === null ? '' : String(value);
        if (str.includes('"') || str.includes(',') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    function renderSearchSummaryText(searchSummary) {
        if (!searchSummary) return '';
        if (searchSummary.mode === 'boolean') {
            const queryLabel = searchSummary.query ? `Search: ${escapeHtml(searchSummary.query).replace(/&quot;/g, '"')}` : 'Search';
            return `${queryLabel}\n${searchSummary.total} total nodes selected`;
        }
        if (!Array.isArray(searchSummary.terms) || searchSummary.terms.length === 0) {
            const queryLabel = searchSummary.query ? `Search: ${escapeHtml(searchSummary.query).replace(/&quot;/g, '"')}` : '';
            return queryLabel ? `${queryLabel}\n${searchSummary.total} total nodes selected` : `${searchSummary.total} total nodes selected`;
        }
        const lines = searchSummary.terms.map(termInfo => {
            const termLabel = termInfo.exact ? `"${termInfo.term}"` : termInfo.term;
            return `Search: ${escapeHtml(termLabel).replace(/&quot;/g, '"')} | ${termInfo.count} nodes`;
        });
        lines.push(`${searchSummary.total} total nodes selected`);
        return lines.join('\n');
    }

    function getProteinInfoDefaultHeightPx() {
        const viewportHeight = Math.max(480, window.innerHeight || 0);
        return Math.round(viewportHeight * (proteinInfoMode === 'structure' ? 0.48 : 0.34));
    }

    function applyProteinInfoPanelHeight(heightPx = null) {
        const box = document.getElementById('protein-info-box');
        const body = document.getElementById('protein-info-body');
        if (!box || !body) return;
        const targetHeight = Number.isFinite(heightPx) ? Math.max(160, Math.round(heightPx)) : getProteinInfoDefaultHeightPx();
        box.style.height = `${targetHeight}px`;
        body.style.maxHeight = 'none';
    }

    // Keep info-panel rendering on textContent so search terms and file-derived labels cannot become executable HTML.
    function setSafeInfoContentText(el, value) {
        if (!el) return;
        el.textContent = String(value ?? '');
        el.style.whiteSpace = 'pre-line';
    }

    function getProteinInfoSelectedId() {
        const selectedIds = Array.from(getEffectiveSelectedNodesSet());
        return selectedIds.length === 1 ? selectedIds[0] : null;
    }

    function getPreferredProteinName(nodeId) {
        const fromInfoFile = getAccessoryVariableValueByPattern(
            nodeId,
            'preferred_name',
            /^\d+\.protein\.info\.v[\d.]+\.txt$/i
        );
        if (fromInfoFile) return fromInfoFile;

        const meta = proteinMetadata.get(nodeId) || {};
        const direct = (
            meta.preferred_name
            || meta.preferredName
            || ''
        );
        const trimmedDirect = String(direct || '').trim();
        if (trimmedDirect) return trimmedDirect;

        let fallbackPreferred = '';
        Object.entries(accessoryVariableValues || {}).forEach(([, vars]) => {
            Object.entries(vars || {}).forEach(([variable, valueMap]) => {
                if (fallbackPreferred || !(valueMap instanceof Map)) return;
                const normalized = normalizeVariableKey(variable);
                if (normalized !== 'preferredname' && normalized !== 'preferred_name') return;
                const raw = valueMap.get(nodeId);
                if (raw === undefined || raw === null) return;
                const trimmed = String(raw).trim();
                if (trimmed) fallbackPreferred = trimmed;
            });
        });
        if (fallbackPreferred) return fallbackPreferred;

        if (meta.geneId) return meta.geneId;
        if (meta.gene) return meta.gene;
        if (Array.isArray(meta.aliases) && meta.aliases[0]) return meta.aliases[0];

        return nodeId || 'Unknown';
    }

    function getAccessoryVariableValueByPattern(nodeId, variableName, filePatternRegex) {
        const wantedVariable = normalizeVariableKey(variableName);
        let bestMatch = null;

        Object.entries(accessoryVariableValues || {}).forEach(([fileName, vars]) => {
            if (!filePatternRegex.test(String(fileName || ''))) return;
            Object.entries(vars || {}).forEach(([variable, valueMap]) => {
                if (!(valueMap instanceof Map)) return;
                if (normalizeVariableKey(variable) !== wantedVariable) return;
                const raw = valueMap.get(nodeId);
                if (raw === undefined || raw === null) return;
                const trimmed = String(raw).trim();
                if (!trimmed) return;
                if (!bestMatch || String(fileName).localeCompare(bestMatch.fileName) > 0) {
                    bestMatch = { fileName: String(fileName), value: trimmed };
                }
            });
        });

        return bestMatch ? bestMatch.value : '';
    }

    function getProteinInfoAnnotation(nodeId) {
        const fromInfoFile = getAccessoryVariableValueByPattern(
            nodeId,
            'annotation',
            /^\d+\.protein\.info\.v[\d.]+\.txt$/i
        );
        if (fromInfoFile) return fromInfoFile;
        const meta = proteinMetadata.get(nodeId) || {};
        return meta.annotation || 'Unknown';
    }

    function getProteinInfoDescription(nodeId) {
        const fromEnrichmentFile = getAccessoryVariableValueByPattern(
            nodeId,
            'description',
            /^\d+\.protein\.enrichment\.terms\.v[\d.]+\.txt$/i
        );
        if (fromEnrichmentFile) return fromEnrichmentFile;
        const meta = proteinMetadata.get(nodeId) || {};
        return meta.description || meta.annotation || 'Unknown';
    }

    function getProteinInfoText(nodeId, mode) {
        const meta = proteinMetadata.get(nodeId) || {};
        if (mode === 'description') return getProteinInfoDescription(nodeId);
        if (mode === 'sequence') return meta.sequence || 'Unknown';
        if (mode === 'links') return '';
        if (mode === 'structure') return '';
        if (mode === 'guide') return 'Feature coming soon!';
        return getProteinInfoAnnotation(nodeId);
    }

    function clearProteinInfoHistory() {
        proteinInfoNavigationHistory = [];
        proteinInfoPreviousButtonSide = null;
    }

    function getProteinInfoCandidates(currentNodeId, sortDirection = 'next') {
        const threshold = +document.getElementById('thresholdInput')?.value || 0;
        const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
        const activeNodeIds = new Set(activeNodes.map(node => node.id));
        const historySet = new Set(proteinInfoNavigationHistory);
        const connectedIds = new Set();

        // Get current node position for distance calculation
        const sourceNode = activeNodes.find(n => n.id === currentNodeId);

        (fullAdjacency.get(currentNodeId) || []).forEach(edge => {
            if (edge.score >= threshold && nodeMap.has(edge.target) && edge.target !== currentNodeId) {
                connectedIds.add(edge.target);
            }
        });

        const candidates = Array.from(connectedIds)
            .filter(id => activeNodeIds.has(id))
            .map(id => {
                const annotation = getProteinInfoAnnotation(id) || '';
                const targetNode = activeNodes.find(n => n.id === id);
                
                // Calculate Euclidean distance
                const dist = (sourceNode && targetNode && typeof sourceNode.x === 'number' && typeof sourceNode.y === 'number' && typeof targetNode.x === 'number' && typeof targetNode.y === 'number')
                    ? Math.sqrt(Math.pow(targetNode.x - sourceNode.x, 2) + Math.pow(targetNode.y - sourceNode.y, 2))
                    : Infinity;

                return {
                    id,
                    isCharacterized: !annotation.toLowerCase().includes('uncharacterized'),
                    inHistory: historySet.has(id),
                    distance: dist
                };
            });

        candidates.sort((a, b) => {
            // 1. Novelty First (not in history < in history)
            if (a.inHistory !== b.inHistory) return a.inHistory ? 1 : -1;

            // 2. Characterized over Uncharacterized
            if (a.isCharacterized !== b.isCharacterized) return a.isCharacterized ? -1 : 1;

            // 3. Closest Euclidean Distance
            if (a.distance !== b.distance) return a.distance - b.distance;

            // 4. Alphabetical Tie-break
            return a.id.localeCompare(b.id);
        });

        return candidates;
    }

    function updateProteinInfoPanelControls(selectedId = getProteinInfoSelectedId()) {
        const toggleBtn = document.getElementById('protein-info-toggle-btn');
        const box = document.getElementById('protein-info-box');
        const prevBtn = document.getElementById('protein-info-prev-btn');
        const nextBtn = document.getElementById('protein-info-next-btn');
        const hasSingleSelection = selectedId !== null && selectedId !== undefined;
        const isGuideMode = proteinInfoMode === 'guide' && currentGuide && currentGuide.pages;
        
        if (toggleBtn) toggleBtn.classList.toggle('hidden', !hasSingleSelection || proteinInfoBoxOpen);
        if (box) box.classList.toggle('nav-disabled', !hasSingleSelection && !isGuideMode);
        
        if (isGuideMode) {
            if (prevBtn) prevBtn.title = 'Previous page';
            if (nextBtn) nextBtn.title = 'Next page';
        } else {
            if (prevBtn) prevBtn.title = proteinInfoPreviousButtonSide === 'left' ? 'Previous protein' : 'Next protein';
            if (nextBtn) nextBtn.title = proteinInfoPreviousButtonSide === 'right' ? 'Previous protein' : 'Next protein';
        }
    }

    function refreshProteinInfoPanel() {
        const box = document.getElementById('protein-info-box');
        const heading = document.getElementById('protein-info-heading');
        const body = document.getElementById('protein-info-body');
        const modeButtons = Array.from(document.querySelectorAll('.protein-info-mode-btn'));
        const selectedId = getProteinInfoSelectedId();

        updateProteinInfoPanelControls(selectedId);
        if (!box || !heading || !body) return;

        box.classList.toggle('open', proteinInfoBoxOpen);
        box.style.display = proteinInfoBoxOpen ? 'flex' : 'none';

        if (proteinInfoBoxOpen) {
            applyProteinInfoPanelHeight(proteinInfoCustomHeightPx);
        }

        modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.proteinMode === proteinInfoMode));

        if (!proteinInfoBoxOpen) {
            proteinInfoStructureRenderToken++;
            disposeProteinInfoMolstarViewer();
            return;
        }

        // Handle guide mode
        if (proteinInfoMode === 'guide') {
            if (currentGuide && currentGuide.pages) {
                const page = currentGuide.pages.find(p => p.pageNumber === currentGuidePage);
                if (page) {
                    heading.textContent = `${currentGuide.title}.`;
                    const totalPages = currentGuide.pages.length;
                    applyMarkdownLatexContent(body, `Page ${currentGuidePage}/${totalPages}.\n${page.text}`);
                } else {
                    heading.textContent = 'Guide';
                    applyMarkdownLatexContent(body, 'Page not found.');
                }
            } else {
                heading.textContent = 'Guide';
                applyMarkdownLatexContent(body, 'No Guide to display. Use AI agent on the right to create guides.');
            }
            return;
        }

        if (selectedId !== null && selectedId !== undefined) {
            heading.textContent = `${getPreferredProteinName(selectedId)} (${selectedId})`;
            if (proteinInfoMode === 'links') {
                proteinInfoStructureRenderToken++;
                disposeProteinInfoMolstarViewer();
                renderProteinInfoLinksView(body, selectedId);
            } else if (proteinInfoMode === 'structure') {
                renderProteinInfoStructureView(body, selectedId);
            } else {
                proteinInfoStructureRenderToken++;
                disposeProteinInfoMolstarViewer();
                applyMarkdownLatexContent(body, getProteinInfoText(selectedId, proteinInfoMode));
            }
        } else {
            proteinInfoStructureRenderToken++;
            disposeProteinInfoMolstarViewer();
            const label = proteinInfoMode === 'description'
                ? 'Description'
                : (proteinInfoMode === 'sequence'
                    ? 'Sequence'
                    : (proteinInfoMode === 'structure'
                        ? 'Structure'
                        : (proteinInfoMode === 'links' ? 'Links' : 'Annotation')));
            heading.textContent = 'Protein Info';
            applyMarkdownLatexContent(body, `Select only one node to view the proteins ${label}.`);
        }

        updateProteinInfoPanelControls(selectedId);
    }

    function openProteinInfoBox() {
        proteinInfoBoxOpen = true;
        refreshProteinInfoPanel();
        const selectedId = getProteinInfoSelectedId();
        if (selectedId !== null && selectedId !== undefined) {
            zoomToProteinNode(selectedId);
        }
    }

    function closeProteinInfoBox() {
        proteinInfoBoxOpen = false;
        proteinInfoCustomHeightPx = null;
        // Reset custom height when closing
        const proteinInfoBox = document.getElementById('protein-info-box');
        const proteinInfoBody = document.getElementById('protein-info-body');
        if (proteinInfoBox) {
            proteinInfoBox.style.height = '';
        }
        if (proteinInfoBody) {
            proteinInfoBody.style.maxHeight = '';
        }
        refreshProteinInfoPanel();
    }

    function setProteinInfoMode(mode) {
        proteinInfoMode = mode;
        refreshProteinInfoPanel();
    }

    function openAiChatWithProteinPrompt(promptText) {
        toggleAiPanel(true);
        const input = document.getElementById('ai-user-input');
        if (!input) return;
        input.value = promptText;
        aiAutoExpand(input);
        if (aiConnected) {
            sendAiMessage();
        }
    }

    function explainProteinInSimpleEnglish() {
        const selectedId = getProteinInfoSelectedId();
        if (selectedId === null || selectedId === undefined) return;
        const text = getProteinInfoText(selectedId, proteinInfoMode);
        openAiChatWithProteinPrompt(`Explain this protein ${proteinInfoMode} in simple English: ${text}`);
    }

    function getProteinInfoZoomNode(nodeId) {
        if (currentViewId === 'Scatter Plot') return null;

        if (currentViewId !== 'base' && activeSubData?.nodes?.length) {
            const subNode = activeSubData.nodes.find(n => n.id === nodeId);
            if (subNode) return subNode;
        }

        return nodeMap.get(nodeId) || nodes.find(n => n.id === nodeId);
    }

    function zoomToProteinNode(nodeId) {
        if (proteinInfoZoomHotkeyState) {
            proteinInfoZoomHotkeyState.invalidated = true;
        }
        const node = getProteinInfoZoomNode(nodeId);
        if (!node) return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        const nodeRadius = Math.max(6, node.r || 6);
        const zoomByRadius = Math.min(8, Math.max(3.2, Math.min(width, height) / (nodeRadius * 10)));
        const currentK = transform?.k || 1;
        const targetScale = Math.max(zoomByRadius, currentK);
        const focusTransform = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(targetScale)
            .translate(-node.x, -node.y);
        d3.select(canvas).transition().duration(800).call(zoomBehavior.transform, focusTransform);
        return focusTransform;
    }

    function toggleProteinZoomHotkey() {
        const selectedIds = Array.from(getEffectiveSelectedNodesSet() || new Set());
        if (!selectedIds.length) return;

        if (proteinInfoZoomHotkeyState && !proteinInfoZoomHotkeyState.invalidated) {
            const previousTransform = proteinInfoZoomHotkeyState.previousTransform;
            proteinInfoZoomHotkeyState = null;
            if (previousTransform) {
                d3.select(canvas).interrupt().transition().duration(500).call(zoomBehavior.transform, previousTransform);
            }
            return;
        }

        const previousTransform = d3.zoomIdentity
            .translate(transform?.x || 0, transform?.y || 0)
            .scale(transform?.k || 1);

        const nodesToZoom = selectedIds.map(id => {
            // Prefer the global nodeMap entry (full-network coordinates)
            if (nodeMap.has(id)) return nodeMap.get(id);
            // Fallback to nodes array
            const globalNode = nodes.find(n => n.id === id);
            if (globalNode) return globalNode;
            // Last resort: use activeSubData nodes (subnetwork coordinates)
            if (activeSubData?.nodes) return activeSubData.nodes.find(n => n.id === id);
            return null;
        }).filter(Boolean);
        if (!nodesToZoom.length) return;

        const targetTransform = fitNodesInView(nodesToZoom, 50);
        if (!targetTransform) return;

        d3.select(canvas).transition().duration(600).call(zoomBehavior.transform, targetTransform);

        proteinInfoZoomHotkeyState = {
            previousTransform,
            targetTransform,
            invalidated: false
        };
    }

    function selectProteinInfoNode(nodeId, clickedSide = null, preservePreviousSide = false) {
        const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
        const targetNode = activeNodes.find(node => node.id === nodeId) || nodeMap.get(nodeId) || nodes.find(node => node.id === nodeId);
        if (!targetNode) return;
        selectNodes([targetNode], false, 'Protein Info Navigation', null, true);
        if (!preservePreviousSide && (clickedSide === 'left' || clickedSide === 'right')) {
            proteinInfoPreviousButtonSide = clickedSide === 'left' ? 'right' : 'left';
        }
        zoomToProteinNode(targetNode.id);
    }

    function navigateProteinInfo(side) {
        // If in guide mode, navigate between pages instead of proteins
        if (proteinInfoMode === 'guide' && currentGuide && currentGuide.pages) {
            const totalPages = currentGuide.pages.length;
            let nextPage = currentGuidePage;
            
            if (side === 'left') {
                nextPage = Math.max(1, currentGuidePage - 1);
            } else {
                nextPage = Math.min(totalPages, currentGuidePage + 1);
            }
            
            if (nextPage !== currentGuidePage) {
                aiApplyGuidePage(nextPage);
            }
            return;
        }
        
        // Normal protein info navigation
        const selectedId = getProteinInfoSelectedId();
        if (selectedId === null || selectedId === undefined) return;

        const clickedIsPrevious = proteinInfoNavigationHistory.length > 0 && proteinInfoPreviousButtonSide === side;
        if (clickedIsPrevious) {
            const previousId = proteinInfoNavigationHistory.pop();
            if (!proteinInfoNavigationHistory.length) {
                proteinInfoPreviousButtonSide = null;
            }
            if (previousId) selectProteinInfoNode(previousId, side, true);
            refreshProteinInfoPanel();
            return;
        }

        const sortDirection = side === 'left' ? 'previous' : 'next';
        const candidates = getProteinInfoCandidates(selectedId, sortDirection);
        if (!candidates.length) return;

        proteinInfoNavigationHistory.push(selectedId);
        proteinInfoPreviousButtonSide = side === 'left' ? 'right' : 'left';
        selectProteinInfoNode(candidates[0].id, side);
        refreshProteinInfoPanel();
    }

    function refreshInfoBoxFromSelection(query = '', searchSummary = null) {
        const infoId = document.getElementById('info-id');
        const infoContent = document.getElementById('info-content');
        const infoControls = document.getElementById('info-controls');
        const nodeInfoBtn = document.getElementById('node-info-table-btn');
        refreshProteinInfoPanel();

        if (currentViewId === 'Embeddings') {
            const selectedPointIds = Array.from(getActiveEmbeddingSelectionSet());
            const mappedSelectedIds = Array.from(getEffectiveSelectedNodesSet());
            const hasMappedSelection = mappedSelectedIds.length > 0;
            if (infoControls) infoControls.style.display = hasMappedSelection ? 'flex' : 'none';
            if (nodeInfoBtn) nodeInfoBtn.style.display = hasMappedSelection ? 'inline-flex' : 'none';
            if (!hasMappedSelection) d3.select("#coll-add-btn-container").html("");

            if (!selectedPointIds.length) {
                infoId.innerText = 'No Nodes Selected';
                setSafeInfoContentText(infoContent, 'Select Nodes to View Information');
                return;
            }

            if (selectedPointIds.length === 1) {
                const pointId = selectedPointIds[0];
                const mappedNode = resolveEmbeddingIdToNode(pointId);
                infoId.innerText = pointId;
                setSafeInfoContentText(infoContent, mappedNode
                    ? `Mapped Node: ${mappedNode.id}`
                    : 'Mapped Node: Not found');
                return;
            }

            infoId.innerText = 'UMAP Selection';
            setSafeInfoContentText(infoContent, `Matches: ${selectedPointIds.length} points`);
            return;
        }

        const selectedIds = Array.from(getEffectiveSelectedNodesSet());
        const hasSelection = selectedIds.length > 0;
        const hasSearchSummary = !!searchSummary && (searchSummary.mode === 'boolean' || (Array.isArray(searchSummary.terms) && searchSummary.terms.length > 0));

        if (infoControls) infoControls.style.display = hasSelection ? 'flex' : 'none';
        
        // Show/hide Parent and Child buttons based on view
        const parentBtn = document.getElementById('mind-map-parent-btn');
        const childBtn = document.getElementById('mind-map-child-btn');
        const growBtn = document.getElementById('mind-map-grow-btn');
        const shrinkBtn = document.getElementById('mind-map-shrink-btn');
        const isMindMap = currentViewId === 'Mind Map';
        if (parentBtn && childBtn) {
            parentBtn.style.display = isMindMap && hasSelection ? 'inline-flex' : 'none';
            childBtn.style.display = isMindMap && hasSelection ? 'inline-flex' : 'none';
        }
        // Hide Grow/Shrink when in Mind Map view; otherwise show according to selection
        if (growBtn) growBtn.style.display = isMindMap ? 'none' : (hasSelection ? 'inline-block' : 'none');
        if (shrinkBtn) shrinkBtn.style.display = isMindMap ? 'none' : (hasSelection ? 'inline-block' : 'none');
        
        if (nodeInfoBtn) {
            if (currentViewId === 'Mind Map') {
                nodeInfoBtn.textContent = 'Mind Map Node Info Table';
                nodeInfoBtn.onclick = () => openMindMapNodeInfoTable();
                nodeInfoBtn.style.display = 'inline-flex';
            } else {
                nodeInfoBtn.textContent = 'Node Info Table';
                nodeInfoBtn.onclick = () => openNodeInfoTable();
                nodeInfoBtn.style.display = hasSelection ? 'inline-flex' : 'none';
            }
        }

        updateShortestPathControlVisibility();

        if (!selectedIds.length) {
            d3.select("#coll-add-btn-container").html("");
            if (hasSearchSummary) {
                infoId.innerText = 'Group Selection';
                setSafeInfoContentText(infoContent, renderSearchSummaryText(searchSummary));
            } else {
                infoId.innerText = 'No Nodes Selected'; //Heading
                setSafeInfoContentText(infoContent, query ? `Search: ${query}\nMatches: 0 nodes` : 'Select Nodes to View Information');
            }
            return;
        }

        if (hasSearchSummary) {
            infoId.innerText = 'Group Selection';
            setSafeInfoContentText(infoContent, renderSearchSummaryText(searchSummary));
            return;
        }

        if (currentViewId === 'Mind Map') {
            const layout = mindMapLayoutState || buildMindMapLayout();
            if (selectedIds.length === 1) {
                const node = layout?.nodes?.get(selectedIds[0]);
                if (node) {
                    infoId.innerText = node.label || node.id;
                    setSafeInfoContentText(infoContent, [
                        `Node ID: ${node.id}`,
                        `Label: ${node.label || node.id}`,
                        `Parents: ${Array.from(node.parents || []).join(', ') || 'None'}`,
                        `Children: ${Array.from(node.children || []).join(', ') || 'None'}`
                    ].join('\n'));
                } else {
                    infoId.innerText = 'Mind Map Selection';
                    setSafeInfoContentText(infoContent, `Matches: ${selectedIds.length} node(s)`);
                }
            } else {
                infoId.innerText = 'Mind Map Selection';
                setSafeInfoContentText(infoContent, `Matches: ${selectedIds.length} node(s)`);
            }
            d3.select("#coll-add-btn-container").html("");
            return;
        }

        if (selectedIds.length === 1) {
            const first = getNodeForInfo(selectedIds[0]);
            const m = proteinMetadata.get(selectedIds[0]) || {};
            if (first && (first.eigen === undefined || first.eigen === null)) {
                calculateEigenvectorCentrality();
            }
            infoId.innerText = getPreferredProteinName(selectedIds[0]);
            setSafeInfoContentText(infoContent, [
                `Node ID: ${selectedIds[0]}`,
                `Preferred Name: ${getPreferredProteinName(selectedIds[0])}`
            ].join('\n'));
            return;
        }

        infoId.innerText = 'Group Selection';
        setSafeInfoContentText(infoContent, `Matches: ${selectedIds.length} nodes`);
    }

    function openNodeInfoTable() {
        if (currentViewId === 'Mind Map') return openMindMapNodeInfoTable();
        isBrushMode = false;
        isLassoMode = false;
        document.getElementById('brushBtn')?.classList.remove('active');
        document.getElementById('lassoBtn')?.classList.remove('active');
        updateCanvasCursor();
        updateNodeInfoTableModalChrome('Node Info Table', false);
        calculateEigenvectorCentrality();
        const { rows, extraColumns } = getSelectedNodeInfoRows();
        const baseColumns = ['Protein ID', 'Preferred Name', 'Gene ID', 'Description', 'Annotation', 'KEGG Product', 'Localisation', 'Protein Size', 'UniProt', 'NCBI', 'Pubmed', 'IntAct', 'STRING', 'Protein Data Bank', 'Aliases',  'Layer', 'Centrality', 'Eigen', 'Sequence'];
        const columns = [...baseColumns, ...extraColumns.map(c => c.label)];
        nodeInfoTableState = { columns, rows, filteredRows: rows, searchQuery: '', mode: 'protein' };
        renderNodeInfoTable();
        openModal('nodeInfoTableModal');
    }

    function openMindMapNodeInfoTable() {
        // Build a Mind Map Node -> proteins table plus any columns from the selected Node Info File
        isBrushMode = false;
        isLassoMode = false;
        document.getElementById('brushBtn')?.classList.remove('active');
        document.getElementById('lassoBtn')?.classList.remove('active');
        updateCanvasCursor();
        updateNodeInfoTableModalChrome('Mind Map Node Info Table', true);

        // Which proteins file (if any) lists proteins per cluster
        const proteinsFile = Object.keys(accessoryDataFiles).find(f => /^\d+\.clusters\.proteins\.v[\d.]+\.txt$/i.test(f));
        const proteinsRows = proteinsFile ? (accessoryDataFiles[proteinsFile].rows || []) : [];
        const proteinsHeaders = proteinsFile ? (accessoryDataFiles[proteinsFile].headers || []) : [];
        const clusterHeader = proteinsHeaders.find(h => /cluster/i.test(h) && /id/i.test(h)) || proteinsHeaders.find(h => /cluster/i.test(h)) || 'cluster_id';
        const proteinHeader = proteinsHeaders.find(h => /protein/i.test(h)) || 'protein_id';

        // Map cluster id -> array of proteins
        const clusterToProteins = new Map();
        proteinsRows.forEach(r => {
            const cid = String(r[clusterHeader] || '').trim();
            const pid = String(r[proteinHeader] || '').trim();
            if (!cid) return;
            if (!clusterToProteins.has(cid)) clusterToProteins.set(cid, []);
            if (pid) clusterToProteins.get(cid).push(pid);
        });

        const layout = buildMindMapLayout();
        const nodesIter = layout?.nodes instanceof Map ? Array.from(layout.nodes.values()) : [];
        const selectedIds = mindMapSelectedNodes && mindMapSelectedNodes.size ? Array.from(mindMapSelectedNodes) : nodesIter.map(n => n.id);

        // Prepare extra info columns from mindMapInfoFile
        const infoFile = mindMapInfoFile && accessoryDataFiles[mindMapInfoFile] ? accessoryDataFiles[mindMapInfoFile] : null;
        const infoHeaders = infoFile ? infoFile.headers.filter(h => !(h.toLowerCase().includes('#string_taxon_id') || /id/i.test(h) && h.toLowerCase().includes('cluster'))) : [];

        const columns = ['Mind Map Node', 'Proteins associated with this node', ...infoHeaders];
        const rows = [];

        selectedIds.forEach(nodeId => {
            const proteins = clusterToProteins.get(nodeId) || [];
            const infoRow = {};
            if (infoFile) {
                // find matching row by id column (prefer cluster_id or id)
                const idHeader = getMindMapIdHeader(mindMapInfoFile, Array.from(layout?.nodes?.keys() || []));
                const match = infoFile.rows.find(r => String((r[idHeader] || '')).trim() === String(nodeId).trim());
                if (match) {
                    infoHeaders.forEach(h => infoRow[h] = match[h] ?? '');
                } else {
                    infoHeaders.forEach(h => infoRow[h] = '');
                }
            } else {
                infoHeaders.forEach(h => infoRow[h] = '');
            }

            rows.push(Object.assign({
                'Mind Map Node': nodeId,
                'Proteins associated with this node': proteins.join('; ')
            }, infoRow));
        });

        nodeInfoTableState = { columns, rows, filteredRows: rows, searchQuery: '', mode: 'mindMap' };
        renderNodeInfoTable();
        openModal('nodeInfoTableModal');
    }

    function updateNodeInfoTableModalChrome(titleText, hideFastaJson) {
        const heading = document.querySelector('#nodeInfoTableModal h3');
        if (heading) heading.textContent = titleText;

        const fastaBtn = document.getElementById('node-info-table-download-fasta-btn');
        const jsonBtn = document.getElementById('node-info-table-download-json-btn');
        const displayStyle = hideFastaJson ? 'none' : 'inline-flex';

        if (fastaBtn) {
            fastaBtn.style.display = displayStyle;
            if (!hideFastaJson) {
                fastaBtn.style.justifyContent = 'center';
                fastaBtn.style.alignItems = 'center';
            }
        }
        if (jsonBtn) {
            jsonBtn.style.display = displayStyle;
            if (!hideFastaJson) {
                jsonBtn.style.justifyContent = 'center';
                jsonBtn.style.alignItems = 'center';
            }
        }
    }

    function getNodeInfoTableRowSearchText(row, columns) {
        return columns.map(column => {
            const value = row[column];
            if (column === 'UniProt') return row.__linkData?.uniprotAc || value || '';
            if (column === 'NCBI') return [row.__linkData?.ncbiProteinId, row.__linkData?.geneId, value].filter(Boolean).join(' ');
            if (column === 'Pubmed') return row.__linkData?.geneId || value || '';
            if (column === 'IntAct') return row.__linkData?.intactUrl || value || '';
            if (column === 'STRING') return row.__linkData?.stringUrl || value || '';
            if (column === 'Protein Data Bank') return [row.__linkData?.pdbLinks?.map(link => link.id).join(' '), value].filter(Boolean).join(' ');
            return value ?? '';
        }).join(' ').toLowerCase();
    }

    function getNodeInfoTableVisibleRows() {
        const rows = Array.isArray(nodeInfoTableState.rows) ? nodeInfoTableState.rows : [];
        const query = String(nodeInfoTableState.searchQuery || '').trim().toLowerCase();
        if (!query) return rows;
        return rows.filter(row => getNodeInfoTableRowSearchText(row, nodeInfoTableState.columns || []).includes(query));
    }

    function renderNodeInfoTable() {
        const summary = document.getElementById('node-info-table-summary');
        const wrap = document.getElementById('node-info-table-wrap');
        const searchInput = document.getElementById('node-info-table-search');
        if (!summary || !wrap) return;

        const rows = getNodeInfoTableVisibleRows();
        nodeInfoTableState.filteredRows = rows;
        if (searchInput && searchInput.value !== (nodeInfoTableState.searchQuery || '')) {
            searchInput.value = nodeInfoTableState.searchQuery || '';
        }

        const totalRows = Array.isArray(nodeInfoTableState.rows) ? nodeInfoTableState.rows.length : 0;
        const searchSuffix = nodeInfoTableState.searchQuery ? ` Search matches: ${rows.length} of ${totalRows}.` : '';
        summary.textContent = totalRows ?    `Showing ${rows.length} of ${totalRows} row(s). Double click any column heading to expand the column. Shift + scroll to scroll horizontally.${searchSuffix}` : 'No rows available.';

        if (!totalRows) {
            wrap.innerHTML = `<div style="padding:12px; color:#aaa;">${nodeInfoTableState.mode === 'mindMap' ? 'No Mind Map nodes available.' : 'Select one or more nodes to populate this table.'}</div>`;
            enableNodeInfoTableColumnResize();
            return;
        }

        const columns = nodeInfoTableState.columns || [];
        const visibleRows = rows;
        if (!visibleRows.length) {
            wrap.innerHTML = '<div style="padding:12px; color:#aaa;">No rows match the current search.</div>';
            enableNodeInfoTableColumnResize();
            return;
        }

        const tableHtml = [
            '<table><thead><tr>',
            ...columns.map(column => `<th>${escapeHtml(column)}</th>`),
            '</tr></thead><tbody>',
            ...visibleRows.map((row, rowIndex) => `<tr>${columns.map(column => `<td>${renderNodeInfoTableCell(row, column, rowIndex)}</td>`).join('')}</tr>`),
            '</tbody></table>'
        ].join('');
        wrap.innerHTML = tableHtml;
        enableNodeInfoTableColumnResize();
    }

    function handleNodeInfoTableSearch(value) {
        nodeInfoTableState.searchQuery = String(value || '');
        renderNodeInfoTable();
    }

    function clearNodeInfoTableSearch() {
        nodeInfoTableState.searchQuery = '';
        const searchInput = document.getElementById('node-info-table-search');
        if (searchInput) searchInput.value = '';
        renderNodeInfoTable();
    }

    function renderNodeInfoTableCell(row, column, rowIndex) {
        const textValue = (row[column] ?? '').toString();
        if (column === 'UniProt') {
            const url = row.__linkData?.uniprotUrl || '';
            return url ? `<div class="node-info-link-group">${renderNodeInfoTableButton('UniProt', url)}</div>` : '<span style="color:#888;">-</span>';
        }
        if (column === 'NCBI') {
            const proteinUrl = row.__linkData?.ncbiProteinUrl || '';
            const geneUrl = row.__linkData?.ncbiGeneUrl || '';
            const buttons = [renderNodeInfoTableButton('Protein', proteinUrl), renderNodeInfoTableButton('Gene', geneUrl)].filter(Boolean);
            return buttons.length ? `<div class="node-info-link-group">${buttons.join('')}</div>` : '<span style="color:#888;">-</span>';
        }
        if (column === 'Pubmed') {
            const url = row.__linkData?.pubmedUrl || '';
            return url ? `<div class="node-info-link-group">${renderNodeInfoTableButton('PubMed', url)}</div>` : '<span style="color:#888;">-</span>';
        }
        if (column === 'IntAct') {
            const url = row.__linkData?.intactUrl || '';
            return url ? `<div class="node-info-link-group">${renderNodeInfoTableButton('IntAct', url)}</div>` : '<span style="color:#888;">-</span>';
        }
        if (column === 'STRING') {
            const url = row.__linkData?.stringUrl || '';
            return url ? `<div class="node-info-link-group">${renderNodeInfoTableButton('STRING', url)}</div>` : '<span style="color:#888;">-</span>';
        }
        if (column === 'Protein Data Bank') {
            const pdbLinks = Array.isArray(row.__linkData?.pdbLinks) ? row.__linkData.pdbLinks : [];
            return pdbLinks.length
                ? `<div class="node-info-link-group">${renderNodeInfoTableButton('PDB links', '', `class="btn-secondary node-info-pdb-btn" data-node-info-pdb-row="${rowIndex}"`)}</div>`
                : '<span style="color:#888;">-</span>';
        }
        return escapeHtml(textValue);
    }

    function renderNodeInfoTableButton(label, url, extraAttributes = '') {
        if (!url && !extraAttributes) return '';
        if (extraAttributes) {
            return `<button type="button" ${extraAttributes}>${escapeHtml(label)}</button>`;
        }
        return `<button type="button" class="btn-secondary node-info-url-btn" data-node-info-url="${escapeHtml(url)}">${escapeHtml(label)}</button>`;
    }

    function openNodeInfoUrl(url) {
        if (!url) return;
        window.open(url, '_blank', 'noopener');
    }

    function openNodeInfoPdbOverlay(rowIndex) {
        const row = nodeInfoTableState.filteredRows?.[rowIndex];
        const links = Array.isArray(row?.__linkData?.pdbLinks) ? row.__linkData.pdbLinks : [];
        const overlay = document.getElementById('node-info-pdb-overlay');
        const title = document.getElementById('node-info-pdb-title');
        const subtitle = document.getElementById('node-info-pdb-subtitle');
        const linksWrap = document.getElementById('node-info-pdb-links');
        const empty = document.getElementById('node-info-pdb-empty');
        if (!overlay || !linksWrap || !title || !subtitle || !empty) return;

        title.textContent = 'Protein Data Bank links';
        subtitle.textContent = row?.['Protein ID'] ? `Protein ${row['Protein ID']}` : '';
        linksWrap.innerHTML = links.length
            ? links.map(link => `<button type="button" class="btn-secondary node-info-url-btn" data-node-info-url="${escapeHtml(link.url)}">${escapeHtml(link.id)}</button>`).join('')
            : '';
        empty.style.display = links.length ? 'none' : 'block';
        overlay.style.display = 'flex';
    }

    function closeNodeInfoPdbOverlay() {
        const overlay = document.getElementById('node-info-pdb-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    function enableNodeInfoTableColumnResize() {
        const tableWrap = document.getElementById('node-info-table-wrap');
        const table = tableWrap?.querySelector('table');
        if (!table) return;

        const ths = Array.from(table.querySelectorAll('thead th'));
        const defaultWidths = {
            'Protein ID': 120,
            'Preferred Name': 120,
            'Protein Size': 75,
            'Description': 180,
            'UniProt': 100,
            'NCBI': 170,
            'Pubmed': 100,
            'IntAct': 95,
            'STRING': 95,
            'Protein Data Bank': 130,
            'Annotation': 420,
            'KEGG Product': 220,
            'Aliases': 350,
            'Gene ID': 100,
            'Layer': 60,
            'Centrality': 80,
            'Eigen': 60,
            'Localisation': 160,
            'Sequence': 460
        };

        // Helper function to set width for a column
        const setColumnWidth = (colIndex, width) => {
            const allCells = table.querySelectorAll(`th:nth-child(${colIndex + 1}), td:nth-child(${colIndex + 1})`);
            allCells.forEach(cell => cell.style.width = `${width}px`);
        };

        // Helper function to calculate max content width
        const getMaxContentWidth = (colIndex) => {
            const allCells = table.querySelectorAll(`th:nth-child(${colIndex + 1}), td:nth-child(${colIndex + 1})`);
            let maxWidth = 70; // minimum width
            allCells.forEach(cell => {
                const tempSpan = document.createElement('span');
                tempSpan.style.visibility = 'hidden';
                tempSpan.style.whiteSpace = 'nowrap';
                tempSpan.textContent = cell.textContent;
                document.body.appendChild(tempSpan);
                const width = tempSpan.getBoundingClientRect().width + 16; // +16 for padding
                maxWidth = Math.max(maxWidth, width);
                document.body.removeChild(tempSpan);
            });
            return maxWidth;
        };

        ths.forEach((th, colIndex) => {
            const header = th.textContent?.trim() || '';
            const width = defaultWidths[header] || 190;
            setColumnWidth(colIndex, width);

            const existingHandle = th.querySelector('.col-resizer');
            if (existingHandle) existingHandle.remove();

            const resizer = document.createElement('div');
            resizer.className = 'col-resizer';
            th.appendChild(resizer);

            // Mousedown handler for dragging from header or any cell
            resizer.addEventListener('mousedown', (event) => {
                event.preventDefault();
                event.stopPropagation();

                const startX = event.clientX;
                const currentWidth = th.getBoundingClientRect().width;

                const onMouseMove = (moveEvent) => {
                    const nextWidth = Math.max(70, currentWidth + (moveEvent.clientX - startX));
                    setColumnWidth(colIndex, nextWidth);
                };

                const onMouseUp = () => {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            });

            resizer.addEventListener('dblclick', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const contentWidth = getMaxContentWidth(colIndex);
                setColumnWidth(colIndex, contentWidth);
            });

            // Double-click handler to auto-fit column width to content
            th.addEventListener('dblclick', (event) => {
                if (event.target.closest('.col-resizer')) return; // ignore if clicking resizer
                const contentWidth = getMaxContentWidth(colIndex);
                setColumnWidth(colIndex, contentWidth);
            });
        });

        // Add resizers to all cells (not just header) to enable dragging from any row
        const allTds = Array.from(table.querySelectorAll('tbody td'));
        allTds.forEach((td, cellIndex) => {
            const colIndex = td.cellIndex;
            
            // Add right-edge resizer for easy column resizing from any row
            const rightEdgeResizer = document.createElement('div');
            rightEdgeResizer.style.position = 'absolute';
            rightEdgeResizer.style.top = '0';
            rightEdgeResizer.style.right = '-2px';
            rightEdgeResizer.style.width = '5px';
            rightEdgeResizer.style.height = '100%';
            rightEdgeResizer.style.cursor = 'col-resize';
            rightEdgeResizer.style.userSelect = 'none';
            rightEdgeResizer.style.zIndex = '3';
            rightEdgeResizer.style.display = 'none';
            
            td.style.position = 'relative';
            td.appendChild(rightEdgeResizer);
            
            // Show resizer on hover, attach mousedown
            td.addEventListener('mouseenter', () => {
                rightEdgeResizer.style.display = 'block';
            });
            td.addEventListener('mouseleave', () => {
                rightEdgeResizer.style.display = 'none';
            });
            
            rightEdgeResizer.addEventListener('mousedown', (event) => {
                event.preventDefault();
                event.stopPropagation();
                
                const startX = event.clientX;
                const th = table.querySelectorAll('thead th')[colIndex];
                const currentWidth = th.getBoundingClientRect().width;

                const onMouseMove = (moveEvent) => {
                    const nextWidth = Math.max(70, currentWidth + (moveEvent.clientX - startX));
                    setColumnWidth(colIndex, nextWidth);
                };

                const onMouseUp = () => {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            });

            rightEdgeResizer.addEventListener('dblclick', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const contentWidth = getMaxContentWidth(colIndex);
                setColumnWidth(colIndex, contentWidth);
            });
        });
    }

    function buildDelimitedNodeInfo(delim = ',') {
        const { columns } = nodeInfoTableState;
        const rows = Array.isArray(nodeInfoTableState.filteredRows) && nodeInfoTableState.searchQuery ? nodeInfoTableState.filteredRows : nodeInfoTableState.rows;
        if (!rows.length) return '';
        if (delim === ',') {
            return [
                columns.map(escapeCSV).join(','),
                ...rows.map(row => columns.map(c => escapeCSV(formatNodeInfoTableExportValue(row, c))).join(','))
            ].join('\n');
        }
        return [
            columns.join('\t'),
            ...rows.map(row => columns.map(c => String(formatNodeInfoTableExportValue(row, c) ?? '').replace(/\t/g, ' ')).join('\t'))
        ].join('\n');
    }

    function formatNodeInfoTableExportValue(row, column) {
        if (column === 'UniProt') return row.__linkData?.uniprotUrl || '';
        if (column === 'NCBI') return [row.__linkData?.ncbiProteinUrl, row.__linkData?.ncbiGeneUrl].filter(Boolean).join(' ');
        if (column === 'Pubmed') return row.__linkData?.pubmedUrl || '';
        if (column === 'IntAct') return row.__linkData?.intactUrl || '';
        if (column === 'STRING') return row.__linkData?.stringUrl || '';
        if (column === 'Protein Data Bank') return Array.isArray(row.__linkData?.pdbLinks) ? row.__linkData.pdbLinks.map(link => link.url).join(' ') : '';
        return row[column] ?? '';
    }

    function downloadNodeInfoTableCSV() {
        if (!nodeInfoTableState.rows.length) {
            alert('No selected nodes to export.');
            return;
        }
        const csv = buildDelimitedNodeInfo(',');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'node_info_table.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    }

    async function copyNodeInfoTableTSV() {
        if (!nodeInfoTableState.rows.length) {
            alert('No selected nodes to copy.');
            return;
        }
        const tsv = buildDelimitedNodeInfo('\t');
        try {
            await navigator.clipboard.writeText(tsv);
        } catch {
            alert('Could not copy to clipboard in this browser context.');
        }
    }

    function downloadSelectedFasta() {
        if (!nodeInfoTableState.rows.length) {
            alert('No selected nodes to export.');
            return;
        }
        const fastaLines = [];
        nodeInfoTableState.rows.forEach(row => {
            const seq = (row['Sequence'] || '').toString().trim();
            if (!seq) return;
            const alias = (row['Alias'] || '').toString().trim();
            fastaLines.push(`>${row['Protein ID']}${alias ? ' ' + alias : ''}`);
            fastaLines.push(seq);
        });
        if (!fastaLines.length) {
            alert('No sequences found for selected nodes. Upload a FASTA file or sequence-containing accessory file first.');
            return;
        }
        const blob = new Blob([fastaLines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'selected_nodes.fasta';
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function downloadSelectedNodesJSON() {
        if (!nodeInfoTableState.rows.length) {
            alert('No selected nodes to export.');
            return;
        }
        const payload = nodeInfoTableState.rows
            .filter(row => (row['Sequence'] || '').toString().trim() !== '')
            .map(row => ({
                name: row['Protein ID'],
                modelSeeds: [],
                sequences: [
                    {
                        proteinChain: {
                            sequence: row['Sequence'],
                            count: 1
                        }
                    }
                ],
                dialect: 'alphafoldserver',
                version: 1
            }));
        if (!payload.length) {
            alert('No sequences found for selected nodes.');
            return;
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'selected_nodes.json';
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function showFileViewerProgress(percent) {
        console.log("function showFileViewerProgress(percent)")
        const wrapper = document.getElementById('file-viewer-loading');
        const bar = document.getElementById('file-viewer-loading-bar');
        if (!wrapper || !bar) return;
        wrapper.style.display = 'block';
        bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
    }

    function hideFileViewerProgress() {
        console.log("function hideFileViewerProgress()")
        const wrapper = document.getElementById('file-viewer-loading');
        if (!wrapper) return;
        wrapper.style.display = 'none';
    }

    function detectDefaultSeparator(text, fileName = '') {
        console.log("function detectDefaultSeparator(text)")
        if (!text || !text.trim()) return '\t';
        
        // Check for plain text files that should not be parsed as tables (case-insensitive)
        const lowerFileName = fileName.toLowerCase();
        if (lowerFileName.includes('selected_nodes.txt') || lowerFileName.includes('how_to_create_guides.txt') || lowerFileName.includes('How_to_use_code_tools.txt')) {
            return 'none'; // Return 'none' to indicate no separator (plain text)
        }
        
        // Force TSV for specific file names
        if (lowerFileName.includes('protein.enrichment.terms')) {
            return '\t';
        }
        if (lowerFileName.includes('protein.info')) {
            return '\t';
        }
        if (lowerFileName.includes('clusters.info')) {
            return '\t';
        }
        
        const sampleRows = text.trim().split(/\r?\n/).slice(0, 20);
        const candidates = ['\t', ',', '|', ';', '__WS__'];

        const scores = candidates.map(sep => {
            const colCounts = sampleRows.map(row => {
                if (sep === '__WS__') return row.trim().split(/\s+/).length;
                return row.split(sep).length;
            });
            const meanCols = colCounts.reduce((a,b) => a+b, 0) / colCounts.length;
            const validCols = colCounts.filter(c => c > 1).length;
            const consistency = new Set(colCounts.filter(c => c > 1)).size;
            return { sep, meanCols, validCols, consistency };
        });

        scores.sort((a,b) => {
            if (b.validCols !== a.validCols) return b.validCols - a.validCols;
            if (b.meanCols !== a.meanCols) return b.meanCols - a.meanCols;
            return a.consistency - b.consistency;
        });

        return scores[0].validCols > 0 ? scores[0].sep : '\t';
    }

    function openFileViewer(fileName) {
        console.log("function openFileViewer(fileName)")
        const fileData = accessoryDataFiles[fileName] || uploadedFileViewerData[fileName];
        if (!fileData) return;
        openModal('fileViewerModal');

        const text = fileData.text || '';
        const isFastaFile = fileName.endsWith('.fasta') || fileName.endsWith('.fa');
        const defaultSep = isFastaFile ? null : detectDefaultSeparator(text, fileName);
        currentFileViewer = { fileName, separator: defaultSep, isFasta: isFastaFile };
        document.getElementById('file-viewer-title').textContent = `${fileName}`;
        const countEl = document.getElementById('file-viewer-debug-count');
        if (countEl) {
            countEl.textContent = '';
        }
        showFileViewerProgress(5);

        setTimeout(() => { showFileViewerProgress(40); }, 50);
        setTimeout(() => {
            renderFileViewer();
            showFileViewerProgress(100);
            setTimeout(() => hideFileViewerProgress(), 250);
        }, 180);
    }

    let currentFileViewer = { fileName: null, separator: '\t', isFasta: false, embeddedItem: null };

    function setFileViewerSeparator(sep) {
        console.log("function setFileViewerSeparator(sep)")
        if (!currentFileViewer.fileName) return;
        currentFileViewer.separator = sep;
        renderFileViewer();
    }

    function renderFileViewer() {
        console.log("function renderFileViewer()")
        const target = document.getElementById('file-viewer-content');
        const fileName = currentFileViewer.fileName;
        const embeddedItem = currentFileViewer.embeddedItem;
        const data = fileName ? (accessoryDataFiles[fileName] || uploadedFileViewerData[fileName]) : null;
        if (!fileName && !embeddedItem) { target.textContent = 'No file selected.'; return; }

        if (embeddedItem) {
            const ctrl = document.getElementById('file-viewer-controls');
            ctrl.innerHTML = '';
            target.innerHTML = '';

            if (embeddedItem.type === 'image') {
                const img = document.createElement('img');
                img.src = embeddedItem.data;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '75vh';
                img.style.display = 'block';
                img.style.margin = '0 auto';
                img.style.borderRadius = '10px';
                target.appendChild(img);
                return;
            }

            const text = embeddedItem.data || '';
            const isFasta = embeddedItem.name && (embeddedItem.name.endsWith('.fasta') || embeddedItem.name.endsWith('.fa'));
            const detected = isFasta ? null : detectDefaultSeparator(text, embeddedItem.name);
            const separator = detected ?? currentFileViewer.separator ?? '\t';

            const note = document.createElement('div');
            note.style.color = '#9ad0ff';
            note.style.marginBottom = '8px';
            note.style.fontSize = '12px';
            note.textContent = embeddedItem.name;
            target.appendChild(note);

            // Add separator buttons for embedded items
            if (!isFasta) {
                const ctrl = document.getElementById('file-viewer-controls');
                if (ctrl) {
                    [['none','None'], ['\t','TSV'], [',','CSV'], ['|','Pipe (|)'], [';','SemiColon (;)'], ['__WS__','Space']].forEach(([sep, label]) => {
                        const btn = document.createElement('button');
                        btn.textContent = label;
                        btn.className = separator === sep ? 'active' : '';
                        btn.style.borderRadius = '9px';
                        btn.style.padding = '4px 10px';
                        btn.style.border = '1px solid #888';
                        btn.style.background = separator === sep ? '#3498db' : '#222';
                        btn.style.color = 'white';
                        btn.style.cursor = 'pointer';
                        btn.onclick = () => {
                            currentFileViewer.separator = sep;
                            renderFileViewer();
                        };
                        ctrl.appendChild(btn);
                    });
                }
            }

            if (separator && separator !== 'none') {
                const lines = text.trim().split(/\r?\n/).filter(Boolean);
                if (lines.length > 0) {
                    const splitRow = (row) => separator === '__WS__' ? row.trim().split(/\s+/) : row.split(separator);
                    const headers = splitRow(lines[0]).map(h => h.trim());
                    const rows = lines.slice(1, 101).map(line => splitRow(line));
                    const table = document.createElement('table');
                    table.style.width = '100%';
                    table.style.borderCollapse = 'collapse';
                    const headerRow = document.createElement('tr');
                    headers.forEach(headerText => {
                        const th = document.createElement('th');
                        th.textContent = headerText;
                        th.style.border = '1px solid #444';
                        th.style.padding = '6px';
                        th.style.background = '#222';
                        th.style.color = '#4db8ff';
                        th.style.textAlign = 'left';
                        headerRow.appendChild(th);
                    });
                    table.appendChild(headerRow);
                    rows.forEach((row, idx) => {
                        const tr = document.createElement('tr');
                        tr.style.background = idx % 2 ? '#121212' : '#1a1a1a';
                        headers.forEach((_, colIdx) => {
                            const td = document.createElement('td');
                            td.textContent = row[colIdx] || '';
                            td.style.border = '1px solid #333';
                            td.style.padding = '5px';
                            td.style.wordBreak = 'break-word';
                            tr.appendChild(td);
                        });
                        table.appendChild(tr);
                    });
                    target.appendChild(table);
                    return;
                }
            }

            const pre = document.createElement('pre');
            pre.style.margin = '0';
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.wordBreak = 'break-word';
            pre.textContent = text;
            target.appendChild(pre);
            return;
        }

        if (!fileName || !data) { target.textContent = 'No file selected.'; return; }

        const ctrl = document.getElementById('file-viewer-controls');
        ctrl.innerHTML = '';
        
        // Handle FASTA file display
        if (currentFileViewer.isFasta) {
            const text = data.text || '';
            const records = parseFastaRecords(text);
            
            target.innerHTML = '';
            
            if (!records.length) {
                target.textContent = 'No FASTA records found.';
                return;
            }
            
            const maxRecords = 100;
            const recordsToRender = records.slice(0, maxRecords);
            
            if (records.length > maxRecords) {
                const note = document.createElement('div');
                note.style.color = '#4db8ff';
                note.style.padding = '4px 0 12px 0';
                note.textContent = `Showing first ${maxRecords} of ${records.length} sequences (large file).`;
                target.appendChild(note);
            }
            
            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            
            const headerRow = document.createElement('tr');
            ['Header', 'Sequence Length', 'Sequence (first 100 chars)'].forEach(text => {
                const th = document.createElement('th');
                th.textContent = text;
                th.style.border = '1px solid #444';
                th.style.padding = '6px';
                th.style.background = '#222';
                th.style.color = '#4db8ff';
                th.style.textAlign = 'left';
                headerRow.appendChild(th);
            });
            table.appendChild(headerRow);
            
            recordsToRender.forEach((record, idx) => {
                const tr = document.createElement('tr');
                tr.style.background = idx % 2 ? '#121212' : '#1a1a1a';
                
                const headerCell = document.createElement('td');
                headerCell.textContent = record.header;
                headerCell.style.border = '1px solid #333';
                headerCell.style.padding = '5px';
                headerCell.style.wordBreak = 'break-word';
                tr.appendChild(headerCell);
                
                const lengthCell = document.createElement('td');
                lengthCell.textContent = record.sequence.length;
                lengthCell.style.border = '1px solid #333';
                lengthCell.style.padding = '5px';
                lengthCell.style.textAlign = 'right';
                tr.appendChild(lengthCell);
                
                const seqCell = document.createElement('td');
                seqCell.textContent = record.sequence.substring(0, 100) + (record.sequence.length > 100 ? '...' : '');
                seqCell.style.border = '1px solid #333';
                seqCell.style.padding = '5px';
                seqCell.style.fontFamily = 'monospace';
                seqCell.style.fontSize = '12px';
                seqCell.style.wordBreak = 'break-all';
                tr.appendChild(seqCell);
                
                table.appendChild(tr);
            });
            
            target.appendChild(table);
            return;
        }
        
        // Handle delimited file display
        [['none','None'], ['\t','TSV'], [',','CSV'], ['|','Pipe (|)'], [';','SemiColon (;)'], ['__WS__','Space']].forEach(([sep, label]) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.className = currentFileViewer.separator === sep ? 'active' : '';
            btn.style.borderRadius = '9px';
            btn.style.padding = '4px 10px';
            btn.style.border = '1px solid #888';
            btn.style.background = currentFileViewer.separator === sep ? '#3498db' : '#222';
            btn.style.color = 'white';
            btn.style.cursor = 'pointer';
            btn.onclick = () => setFileViewerSeparator(sep);
            ctrl.appendChild(btn);
        });

        const spacer = document.createElement('div');
        spacer.style.flex = '1';
        ctrl.appendChild(spacer);

        const parsedCount = interactionParsedEdgeCounts[fileName];
        if (Number.isFinite(parsedCount)) {
            const debugCount = document.createElement('div');
            debugCount.textContent = `Parsed edges: ${parsedCount}`;
            debugCount.style.fontSize = '12px';
            debugCount.style.color = '#9ad0ff';
            debugCount.style.whiteSpace = 'nowrap';
            debugCount.style.alignSelf = 'center';
            ctrl.appendChild(debugCount);
        }

        if (!currentFileViewer.separator || currentFileViewer.separator === 'none') {
            target.textContent = data.text || '';
            return;
        }

        const delim = currentFileViewer.separator;
        const text = data.text || '';
        if (!delim || delim === 'none') {
            target.textContent = text || '';
            return;
        }
        const splitRow = (row) => {
            if (delim === '__WS__') return row.trim().split(/\s+/);
            return row.split(delim);
        };
        const rawRows = text.trim().split(/\r?\n/).filter(r => r.trim());
        if (!rawRows.length) {
            target.textContent = 'No rows to display.';
            return;
        }

        const headers = splitRow(rawRows[0]).map(h => h.trim());
        const bodyRows = rawRows.slice(1).map(line => {
            const cols = splitRow(line);
            const rowObj = {};
            headers.forEach((h, idx) => { rowObj[h] = (cols[idx] || '').trim(); });
            return rowObj;
        });

        const maxRows = 800;
        const rowCount = bodyRows.length;
        const rowsToRender = bodyRows.slice(0, maxRows);

        target.innerHTML = '';

        if (rowCount > maxRows) {
            const note = document.createElement('div');
            note.style.color = '#4db8ff';
            note.style.padding = '4px 0';
            note.textContent = `Showing first ${maxRows} of ${rowCount} rows (large file).`;
            target.appendChild(note);
        }

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        const headerRow = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            th.style.border = '1px solid #444';
            th.style.padding = '6px';
            th.style.background = '#222';
            th.style.color = '#4db8ff';
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        rowsToRender.forEach(row => {
            const tr = document.createElement('tr');
            tr.style.background = '#121212';
            headers.forEach(h => {
                const td = document.createElement('td');
                td.textContent = row[h];
                td.style.border = '1px solid #333';
                td.style.padding = '5px';
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });

        target.appendChild(table);
    }

    function closeVariableSettings() {
        console.log("function closeVariableSettings()");
        closeModal('variablesModal');
    }

    function updateVariableSettingsFromInput(files) {
        console.log("function updateVariableSettingsFromInput(files)");
        for (let file of files) {
            parseAccessoryFile(file.name, file.text ? file.text() : '');
        }
    }

    async function updateVariableSettingsFromInfoInput(e) {
        console.log("function updateVariableSettingsFromInfoInput(e)");
        for (let file of e.target.files) {
            const text = await file.text();
            parseAccessoryFile(file.name, text);
        }
    }

    function closeCollectionMenu() {
        console.log("function closeCollectionMenu()");
        const menu = document.getElementById('collection-context-menu');
        if (menu) menu.style.display = 'none';
    }

    function getEffectiveSelectedNodesSet() {
        if (currentViewId === 'Venn Diagram') return vennSelectedNodes;
        if (currentViewId === 'Mind Map') return mindMapSelectedNodes;
        if (currentViewId === 'selected' && selectedNodesDraft instanceof Set) return selectedNodesDraft;
        return selectedNodes;
    }

    function ensureChartCollectionMenu() {
        let menu = document.getElementById('chart-collection-menu');
        if (menu) return menu;

        menu = document.createElement('div');
        menu.id = 'chart-collection-menu';
        menu.innerHTML = '<div id="chart-collection-menu-grid"></div>';
        document.body.appendChild(menu);

        menu.addEventListener('mouseenter', () => {
            chartCollectionMenuHover = true;
            if (chartCollectionMenuHideTimer) {
                clearTimeout(chartCollectionMenuHideTimer);
                chartCollectionMenuHideTimer = null;
            }
        });

        menu.addEventListener('mouseleave', () => {
            chartCollectionMenuHover = false;
            scheduleHideChartCollectionMenu();
        });

        return menu;
    }

    function hideChartCollectionMenu() {
        const menu = document.getElementById('chart-collection-menu');
        if (menu) {
            menu.classList.remove('open');
            setTimeout(() => {
                if (!menu.classList.contains('open')) menu.style.display = 'none';
            }, 190);
        }
        collectionMenuOpen = false;
        chartCollectionMenuView = null;
        chartCollectionMenuHover = false;
    }

    function scheduleHideChartCollectionMenu() {
        if (chartCollectionMenuHideTimer) clearTimeout(chartCollectionMenuHideTimer);
        chartCollectionMenuHideTimer = setTimeout(() => {
            if (!chartCollectionMenuHover) hideChartCollectionMenu();
        }, 120);
    }

    function openChartCollectionMenu(viewId, buttonRect) {
        const menu = ensureChartCollectionMenu();
        const grid = document.getElementById('chart-collection-menu-grid');
        if (!grid) return;

        grid.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'view-menu-header';
        header.textContent = 'Collections';
        grid.appendChild(header);

        collections.forEach((val, name) => {
            const item = document.createElement('div');
            const active = (viewId === 'pie_chart')
                ? pieDataSource === `collection_${name}`
                : histogramDataSource === `collection_${name}`;
            item.className = `view-option-item ${active ? 'active-view' : ''}`;
            item.textContent = name;
            item.onclick = (e) => {
                e.stopPropagation();
                if (viewId === 'pie_chart') {
                    pieDataSource = `collection_${name}`;
                    selectedWedges.clear();
                } else {
                    histogramDataSource = `collection_${name}`;
                    selectedHistogramBins.clear();
                }
                hideChartCollectionMenu();
                draw();
            };
            grid.appendChild(item);
        });

        if (collections.size === 0) {
            const none = document.createElement('div');
            none.className = 'view-option-item item-disabled';
            none.textContent = 'No collections available';
            grid.appendChild(none);
        }

        const rect = canvas.getBoundingClientRect();
        menu.style.left = `${rect.left + buttonRect.x}px`;
        menu.style.minWidth = `${Math.max(buttonRect.width, 260)}px`;
        menu.style.display = 'block';
        const menuHeight = menu.offsetHeight || 0;
        const targetTop = rect.top + buttonRect.y + buttonRect.height - menuHeight;
        menu.style.top = `${targetTop}px`;
        requestAnimationFrame(() => menu.classList.add('open'));
        collectionMenuOpen = true;
        chartCollectionMenuView = viewId;
    }

    function openCollectionMenu(clientX, clientY) {
        console.log("function openCollectionMenu(clientX, clientY)");
        const effectiveSelection = getEffectiveSelectedNodesSet();
        if (!effectiveSelection || effectiveSelection.size === 0) return;
        const menuId = 'collection-context-menu';
        let menu = document.getElementById(menuId);
        const selector = document.getElementById('view-selector-box');
        if (!clientX || !clientY) {
            const rect = selector ? selector.getBoundingClientRect() : { x: window.innerWidth / 2, y: window.innerHeight / 2, width: 0, height: 0 };
            clientX = rect.x + rect.width / 2;
            clientY = rect.y + rect.height;
        }
        if (!menu) {
            menu = document.createElement('div');
            menu.id = menuId;
            menu.style.position = 'absolute';
            menu.style.background = 'rgba(35,35,35,0.95)';
            menu.style.border = '1px solid #444';
            menu.style.borderRadius = '12px';
            menu.style.padding = '8px';
            menu.style.zIndex = '205';
            menu.style.boxShadow = '0 0 15px rgba(0,0,0,0.6)';
            menu.style.maxHeight = '300px';
            menu.style.overflowY = 'auto';
            menu.style.minWidth = '220px';
            document.body.appendChild(menu);
        }

        menu.innerHTML = '<div style="color:#ccc; font-size:12px; margin-bottom:6px;">Add Selection to a collection:</div>';

        let hasCollections = collections && collections.size > 0;
        if (!hasCollections) {
            const info = document.createElement('div');
            info.style.color = '#aaa';
            info.style.fontSize = '12px';
            info.style.marginBottom = '6px';
            info.textContent = 'No collections yet';
            menu.appendChild(info);
        } else {
            collections.forEach((val, name) => {
                const btn = document.createElement('button');
                btn.className = 'view-option-item';
                btn.style.textAlign = 'left';
                btn.textContent = name;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const coll = collections.get(name);
                    if (!coll) return;
                    effectiveSelection.forEach(id => coll.nodeIds.add(id));
                    refreshLegendIfCollectionMode();
                    updateViewMenu();
                    closeCollectionMenu();
                };
                menu.appendChild(btn);
            });
        }

        const newBtn = document.createElement('button');
        newBtn.className = 'view-option-item';
        newBtn.textContent = '+ New Collection';
        newBtn.style.marginTop = '6px';
        newBtn.onclick = (e) => {
            e.stopPropagation();
            if (menu.querySelector('#new-collection-entry')) return;
            newBtn.style.display = 'none';

            const entry = document.createElement('div');
            entry.id = 'new-collection-entry';
            entry.style.display = 'flex';
            entry.style.flexDirection = 'column';
            entry.style.gap = '6px';
            entry.style.marginTop = '6px';

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Collection name...';
            input.style.width = '100%';
            input.style.padding = '6px';
            input.style.border = '1px solid #666';
            input.style.borderRadius = '8px';
            input.style.background = 'rgba(45,45,45,0.95)';
            input.style.color = 'white';

            const controlRow = document.createElement('div');
            controlRow.style.display = 'flex';
            controlRow.style.gap = '6px';

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.border = '1px solid #666';
            cancelBtn.style.borderRadius = '12px';
            cancelBtn.style.padding = '6px';
            cancelBtn.style.background = 'rgba(100, 80, 80, 0.95)';
            cancelBtn.style.color = 'white';
            cancelBtn.onclick = (ev) => {
                ev.stopPropagation();
                entry.remove();
                newBtn.style.display = 'flex';
            };

            const addBtn = document.createElement('button');
            addBtn.textContent = 'Add';
            addBtn.style.border = '1px solid #666';
            addBtn.style.borderRadius = '12px';
            addBtn.style.padding = '6px';
            addBtn.style.background = 'rgba(90, 180, 80, 0.95)';
            addBtn.style.color = 'white';
            addBtn.onclick = () => {
                const name = input.value.trim();
                if (!name) return;
                if (!collections) collections = new Map();
                if (collections.has(name)) {
                    alert('Collection already exists');
                    return;
                }
                collections.set(name, { nodeIds: new Set(), nodes: [], links: [] });
                selectedNodes.forEach(id => collections.get(name).nodeIds.add(id));
                refreshLegendIfCollectionMode();
                updateViewMenu();
                closeCollectionMenu();
            };

            controlRow.appendChild(cancelBtn);
            controlRow.appendChild(addBtn);
            entry.appendChild(input);
            entry.appendChild(controlRow);
            menu.appendChild(entry);
            input.focus();
        };

        menu.appendChild(newBtn);

        menu.style.left = Math.min(window.innerWidth - 240, clientX) + 'px';
        menu.style.top = Math.min(window.innerHeight - 260, clientY) + 'px';
        menu.style.display = 'block';
    }

    function renderMiniPieChart(container, counts, mode, catScale) {
        console.log("function renderMiniPieChart(container, counts, mode, catScale)")
        const width = 160;
        const height = 120;
        const radius = Math.min(width, height) / 2 - 10;
        
        const svg = d3.select(container).append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('overflow', 'visible');
        
        const g = svg.append('g')
            .attr('transform', `translate(${width/2},${height/2})`);
        
        const data = Array.from(counts.entries()).map(([label, count]) => ({label, count}));
        const pie = d3.pie().value(d => d.count);
        const arc = d3.arc().innerRadius(0).outerRadius(radius);
        
        g.selectAll('path')
            .data(pie(data))
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', (d, i) => {
                // Use the same color scale as the legend
                if (mode === 'layer') {
                    return d.data.label === 'Disconnected' ? '#888' : d3.interpolateViridis(1 - ((parseInt(d.data.label.split(' ')[1]) - 1) / 10));
                } else if (catScale) {
                    return catScale(d.data.label);
                } else {
                    const color = d3.scaleOrdinal(d3.schemeTableau10);
                    return color(i);
                }
            })
            .attr('stroke', '#222')
            .attr('stroke-width', 1);
    }

    function getMiniChartNavigationTarget(viewId) {
        if (currentViewId === viewId) {
            let target = previousViewId || 'base';
            if (target === viewId) target = 'base';
            return target;
        }
        return viewId;
    }

    function renderMiniHistogram(container, numericValues, range, mode, selectedRange) {
        console.log("function renderMiniHistogram(container, numericValues, range, mode, selectedRange)")
        // Match the width of the gradient bar below
        const containerWidth = d3.select("#legend-content").node().clientWidth - 20; // Account for padding
        const width = Math.min(containerWidth, 280); // Cap at reasonable size
        const height = 80;
        const bins = 20;
            // Create explicit thresholds for better control over binning
            const thresholds = d3.ticks(range[0], range[1], bins);
            const histogram = d3.histogram()
                .value(d => d)
                .domain([range[0], range[1]])
                .thresholds(thresholds);
        const binData = histogram(numericValues || []);
        const maxCount = d3.max(binData, d => d.length) || 0;
        
        // Clear any existing content
        d3.select(container).selectAll('*').remove();
        
        const svg = d3.select(container).append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', 'transparent')
            .style('border-radius', '4px')
            .style('overflow', 'visible');
    
        
        if (maxCount === 0) {
            // Add a visible message if all bins are empty
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', '#fff')
                .style('font-size', '10px')
                .text('No values in range');
            return;
        }
        
        const xScale = d3.scaleLinear()
            .domain([range[0], range[1]])
            .range([0, width]);
        
        const yScale = d3.scaleLinear()
            .domain([0, maxCount || 1])
            .range([height, 0]);
        
        svg.selectAll('rect')
            .data(binData)
            .enter()
            .append('rect')
            .attr('x', (d, i) => xScale(d.x0))
            .attr('y', d => yScale(d.length))
            .attr('width', d => Math.max(1, xScale(d.x1) - xScale(d.x0) - 1))
            .attr('height', d => height - yScale(d.length))
            .attr('fill', d => {
                // Use the same color scale as the gradient bar
                const binCenter = (d.x0 + d.x1) / 2;
                const normalizedValue = (binCenter - range[0]) / (range[1] - range[0]);
                const interp = mode === 'annotation'
                    ? (t => d3.interpolatePlasma(clamp01(t)))
                    : (mode === 'centrality' || mode === 'eigen' ? (t => d3.interpolateInferno(0.3 + 0.8 * t)) : d3.interpolateCool);
                const baseColor = interp(Math.max(0, Math.min(1, normalizedValue)));
                
                // Grey out if outside selected range
                if (selectedRange && (binCenter < selectedRange[0] || binCenter > selectedRange[1])) {
                    return 'rgba(80, 80, 80, 0.4)';
                }
                return baseColor;
            })
            .attr('stroke', d => {
                const binCenter = (d.x0 + d.x1) / 2;
                const normalizedValue = (binCenter - range[0]) / (range[1] - range[0]);
                const interp = mode === 'annotation'
                    ? (t => d3.interpolatePlasma(clamp01(t)))
                    : (mode === 'centrality' || mode === 'eigen' ? (t => d3.interpolateInferno(0.3 + 0.8 * t)) : d3.interpolateCool);
                const baseColor = d3.color(interp(Math.max(0, Math.min(1, normalizedValue)))).darker(0.5);
                
                // Grey out if outside selected range
                if (selectedRange && (binCenter < selectedRange[0] || binCenter > selectedRange[1])) {
                    return 'rgba(80, 80, 80, 0.6)';
                }
                return baseColor;
            })
            .attr('stroke-width', 0.5);
    }

    function checkVariableConfiguration() {
        console.log("function checkVariableConfiguration()");
        // place for applying to color logic later.
    }

    function normalizeProteinComplexSpeciesName(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getProteinComplexStructureEntries() {
        const pdbToNodeIds = new Map();
        proteinMetadata.forEach((meta, nodeId) => {
            const pdbIds = Array.from(new Set((Array.isArray(meta?.pdbIds) ? meta.pdbIds : [])
                .map(pdbId => String(pdbId || '').trim().toUpperCase())
                .filter(Boolean)));
            pdbIds.forEach(pdbId => {
                if (!pdbToNodeIds.has(pdbId)) pdbToNodeIds.set(pdbId, new Set());
                pdbToNodeIds.get(pdbId).add(nodeId);
            });
        });

        return Array.from(pdbToNodeIds.entries())
            .filter(([, nodeIds]) => nodeIds.size > 1)
            .map(([pdbId, nodeIds]) => ({ pdbId, nodeIds: Array.from(nodeIds) }))
            .sort((a, b) => {
                const countDiff = b.nodeIds.length - a.nodeIds.length;
                if (countDiff) return countDiff;
                return a.pdbId.localeCompare(b.pdbId);
            });
    }

    function chunkArray(values, size) {
        const chunks = [];
        for (let index = 0; index < values.length; index += size) {
            chunks.push(values.slice(index, index + size));
        }
        return chunks;
    }

    async function fetchProteinComplexStructuresMetadata(pdbIds) {
        const cleanIds = Array.from(new Set((pdbIds || []).map(id => String(id || '').trim().toUpperCase()).filter(Boolean)));
        const missingIds = cleanIds.filter(id => !proteinComplexStructuresMetadataById.has(id));
        if (!missingIds.length) return proteinComplexStructuresMetadataById;
        if (proteinComplexStructuresLoadPromise) return proteinComplexStructuresLoadPromise;

        proteinComplexStructuresLoadPromise = (async () => {
            try {
                const batches = chunkArray(missingIds, 80);
                for (const batch of batches) {
                    const response = await fetch('https://data.rcsb.org/graphql', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: 'query($ids: [String!]!) { entries(entry_ids: $ids) { rcsb_id struct { title } polymer_entities { rcsb_entity_source_organism { scientific_name } } } }',
                            variables: { ids: batch }
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`RCSB metadata request failed with status ${response.status}`);
                    }

                    const payload = await response.json();
                    const entries = Array.isArray(payload?.data?.entries) ? payload.data.entries : [];
                    entries.forEach(entry => {
                        const pdbId = String(entry?.rcsb_id || '').trim().toUpperCase();
                        if (!pdbId) return;
                        const species = [];
                        (Array.isArray(entry?.polymer_entities) ? entry.polymer_entities : []).forEach(entity => {
                            (Array.isArray(entity?.rcsb_entity_source_organism) ? entity.rcsb_entity_source_organism : []).forEach(org => {
                                const scientificName = String(org?.scientific_name || '').trim();
                                if (scientificName && !species.includes(scientificName)) species.push(scientificName);
                            });
                        });
                        proteinComplexStructuresMetadataById.set(pdbId, {
                            pdbId,
                            title: String(entry?.struct?.title || '').trim(),
                            species
                        });
                    });
                }

                return proteinComplexStructuresMetadataById;
            } finally {
                proteinComplexStructuresLoadPromise = null;
            }
        })();

        return proteinComplexStructuresLoadPromise;
    }

    function ensureProteinComplexStructuresView() {
        let view = document.getElementById('protein-complex-structures-view');
        if (!view) {
            view = document.createElement('div');
            view.id = 'protein-complex-structures-view';
            document.body.appendChild(view);
        }
        return view;
    }

    function setProteinComplexStructuresVisibility(isVisible) {
        document.body.classList.toggle('structures-view-active', !!isVisible);
        const view = ensureProteinComplexStructuresView();
        view.style.display = isVisible ? 'block' : 'none';
    }

    function setRightPanelMinimized(isMinimized) {
        document.getElementById('right-panel')?.classList.toggle('minimized', !!isMinimized);
    }

    function buildProteinComplexStructureCard(entry, speciesLabel, isPinned, onTogglePin) {
        const card = document.createElement('article');
        card.className = 'protein-complex-card';
        card.dataset.pdbId = entry.pdbId;
        card.style.cursor = 'pointer';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Open protein complex ${entry.pdbId}`);

        const pinButton = document.createElement('button');
        pinButton.type = 'button';
        pinButton.className = 'protein-complex-pin-btn';
        pinButton.textContent = '📌';
        pinButton.title = isPinned ? 'Unpin structure' : 'Pin structure';
        pinButton.setAttribute('aria-label', isPinned ? 'Unpin structure' : 'Pin structure');
        pinButton.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
        pinButton.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            onTogglePin?.(entry.pdbId);
        });

        const preview = document.createElement('img');
        preview.className = 'protein-complex-preview';
        preview.alt = `${entry.title || entry.pdbId} preview`;
        preview.loading = 'eager';
        preview.decoding = 'async';
        preview.src = proteinComplexStructuresPlaceholderSrc;
        preview.dataset.pdbId = entry.pdbId;
        preview.dataset.src = `https://cdn.rcsb.org/images/structures/${String(entry.pdbId || '').toLowerCase()}_assembly-1.jpeg`;
        preview.addEventListener('error', () => {
            if (preview.dataset.fallbackApplied === 'true') return;
            preview.dataset.fallbackApplied = 'true';
            preview.src = proteinComplexStructuresPlaceholderSrc;
        });

        const body = document.createElement('div');
        body.className = 'protein-complex-body';

        const title = document.createElement('div');
        title.className = 'protein-complex-name';
        title.textContent = entry.title || `Protein complex ${entry.pdbId}`;

        const speciesMeta = document.createElement('div');
        speciesMeta.className = 'protein-complex-meta';
        const speciesLabelEl = document.createElement('div');
        speciesLabelEl.className = 'protein-complex-meta-label';
        speciesLabelEl.textContent = 'Species of origin';
        const speciesValue = document.createElement('div');
        speciesValue.textContent = speciesLabel;
        speciesMeta.appendChild(speciesLabelEl);
        speciesMeta.appendChild(speciesValue);

        const pdbMeta = document.createElement('div');
        pdbMeta.className = 'protein-complex-meta';
        const pdbLabel = document.createElement('div');
        pdbLabel.className = 'protein-complex-meta-label';
        pdbLabel.textContent = 'PDB ID(s)';
        const pdbList = document.createElement('div');
        pdbList.className = 'protein-complex-pdb-list';
        const pdbChip = document.createElement('a');
        pdbChip.className = 'protein-complex-pill';
        pdbChip.href = `https://www.rcsb.org/structure/${encodeURIComponent(entry.pdbId)}`;
        pdbChip.target = '_blank';
        pdbChip.rel = 'noreferrer noopener';
        pdbChip.textContent = entry.pdbId;
        pdbList.appendChild(pdbChip);
        pdbMeta.appendChild(pdbLabel);
        pdbMeta.appendChild(pdbList);

        const proteinsMeta = document.createElement('div');
        proteinsMeta.className = 'protein-complex-meta';
        const proteinsLabel = document.createElement('div');
        proteinsLabel.className = 'protein-complex-meta-label';
        proteinsLabel.textContent = 'Proteins in complex';
        const proteinsList = document.createElement('div');
        proteinsList.className = 'protein-complex-protein-list';
        const proteinNames = Array.from(new Set((Array.isArray(entry.nodeIds) ? entry.nodeIds : [])
            .map(nodeId => {
                const meta = proteinMetadata.get(nodeId) || {};
                return String(meta.preferred_name || nodeId || '').trim();
            })
            .filter(Boolean)));
        proteinNames.forEach(name => {
            const chip = document.createElement('span');
            chip.className = 'protein-complex-pill';
            chip.textContent = name;
            proteinsList.appendChild(chip);
        });
        proteinsMeta.appendChild(proteinsLabel);
        proteinsMeta.appendChild(proteinsList);

        body.appendChild(title);
        body.appendChild(speciesMeta);
        body.appendChild(pdbMeta);
        body.appendChild(proteinsMeta);

        card.appendChild(preview);
        card.appendChild(body);
        card.appendChild(pinButton);
        card.addEventListener('click', () => openProteinComplexStructureDetail(entry));
        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openProteinComplexStructureDetail(entry);
            }
        });
        return card;
    }

    function clearProteinComplexStructuresLoadingState(view) {
        const loadingOverlay = view?.querySelector('.structures-loading-overlay');
        if (loadingOverlay) loadingOverlay.remove();
        view?.querySelectorAll('.protein-complex-card.skeleton').forEach(card => card.remove());
        proteinComplexStructuresLoading = false;
    }

    function applyProteinComplexStructuresSearchFilter() {
        const view = document.getElementById('protein-complex-structures-view');
        if (!view) return;
        const query = String(proteinComplexStructuresSearchQuery || '').trim().toLowerCase();
        const cards = view.querySelectorAll('.protein-complex-card:not(.skeleton)');
        cards.forEach(card => {
            const text = String(card.dataset.searchText || '').toLowerCase();
            card.style.display = !query || text.includes(query) ? '' : 'none';
        });

        view.querySelectorAll('.structures-section').forEach(section => {
            const cardsVisible = Array.from(section.querySelectorAll('.protein-complex-card:not(.skeleton)'))
                .some(card => card.style.display !== 'none');
            const empty = section.querySelector('.structures-section-empty');
            if (empty) empty.style.display = cardsVisible ? 'none' : '';
        });
    }

    function buildProteinComplexStructureSkeletonCard() {
        const card = document.createElement('article');
        card.className = 'protein-complex-card skeleton';

        const preview = document.createElement('div');
        preview.className = 'protein-complex-preview';

        const body = document.createElement('div');
        body.className = 'protein-complex-body skeleton-body';
        body.innerHTML = `
            <div class="skeleton-line" style="width: 72%; height: 18px;"></div>
            <div class="skeleton-line" style="width: 48%;"></div>
            <div class="skeleton-line" style="width: 62%;"></div>
            <div class="skeleton-line" style="width: 40%;"></div>
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:2px;">
                <div class="skeleton-pill" style="width: 78px;"></div>
                <div class="skeleton-pill" style="width: 92px;"></div>
                <div class="skeleton-pill" style="width: 72px;"></div>
            </div>
        `;

        card.appendChild(preview);
        card.appendChild(body);
        return card;
    }

    function ensureProteinComplexStructuresObserver() {
        if (proteinComplexStructuresObserver) return proteinComplexStructuresObserver;
        proteinComplexStructuresObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const img = entry.target;
                const src = img.dataset?.src || '';
                if (src && img.getAttribute('src') !== src) img.src = src;
                proteinComplexStructuresObserver?.unobserve(img);
            });
        }, {
            root: document.getElementById('protein-complex-structures-view') || null,
            rootMargin: '220px 0px',
            threshold: 0.05
        });
        return proteinComplexStructuresObserver;
    }

    async function renderProteinComplexStructuresView() {
        const renderToken = ++proteinComplexStructuresRenderToken;
        const view = ensureProteinComplexStructuresView();
        setProteinComplexStructuresVisibility(true);
        view.innerHTML = '';
        proteinComplexStructuresLoading = true;

        if (proteinComplexStructuresDetailEntry) {
            renderProteinComplexStructureDetailView(view, proteinComplexStructuresDetailEntry);
            proteinComplexStructuresLoading = false;
            const detailRenderToken = ++proteinComplexStructureDetailRenderToken;
            await loadProteinComplexStructureDetail(proteinComplexStructuresDetailEntry, detailRenderToken);
            return;
        }

        const query = String(proteinComplexStructuresSearchQuery || '').trim().toLowerCase();

        const shell = document.createElement('div');
        shell.className = 'structures-shell';
        shell.style.position = 'relative';

        const hero = document.createElement('div');
        hero.className = 'structures-hero';
        const heroCopy = document.createElement('div');
        heroCopy.className = 'structures-hero-copy';
        const title = document.createElement('h1');
        title.className = 'structures-title';
        title.textContent = 'Protein Complex Structures';
        const status = document.createElement('div');
        status.className = 'structures-status';
        status.textContent = 'Loading protein complex metadata from RCSB PDB...';
        heroCopy.appendChild(title);
        heroCopy.appendChild(status);

        const toolbar = document.createElement('div');
        toolbar.className = 'structures-toolbar';
        const searchWrap = document.createElement('label');
        searchWrap.className = 'structures-search';
        const searchLabel = document.createElement('span');
        searchLabel.textContent = 'Search';
        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.placeholder = 'Filter by name, species, PDB ID, or protein';
        searchInput.value = proteinComplexStructuresSearchQuery;
        searchInput.addEventListener('input', () => {
            proteinComplexStructuresSearchQuery = searchInput.value;
            applyProteinComplexStructuresSearchFilter();
        });
        searchWrap.appendChild(searchLabel);
        searchWrap.appendChild(searchInput);
        toolbar.appendChild(searchWrap);

        hero.appendChild(heroCopy);
        hero.appendChild(toolbar);

        const thisSection = document.createElement('section');
        thisSection.className = 'structures-section';
        const thisHeading = document.createElement('h2');
        thisHeading.className = 'structures-section-title';
        thisHeading.textContent = 'Protein complex structures from this species';
        const pinnedSection = document.createElement('section');
        pinnedSection.className = 'structures-section';
        const pinnedHeading = document.createElement('h2');
        pinnedHeading.className = 'structures-section-title';
        pinnedHeading.textContent = 'Pinned structures';
        const pinnedGrid = document.createElement('div');
        pinnedGrid.className = 'protein-complex-card-grid';
        pinnedSection.appendChild(pinnedHeading);
        pinnedSection.appendChild(pinnedGrid);
        const thisGrid = document.createElement('div');
        thisGrid.className = 'protein-complex-card-grid';
        thisSection.appendChild(thisHeading);
        thisSection.appendChild(thisGrid);

        const otherSection = document.createElement('section');
        otherSection.className = 'structures-section';
        const otherHeading = document.createElement('h2');
        otherHeading.className = 'structures-section-title';
        otherHeading.textContent = 'Other Protein Complex Structures';
        const otherGrid = document.createElement('div');
        otherGrid.className = 'protein-complex-card-grid';
        otherSection.appendChild(otherHeading);
        otherSection.appendChild(otherGrid);

        shell.appendChild(hero);
        shell.appendChild(pinnedSection);
        shell.appendChild(thisSection);
        shell.appendChild(otherSection);
        view.appendChild(shell);

        const structureEntries = getProteinComplexStructureEntries();
        const renderLoadingSkeletons = () => {
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'structures-loading-overlay';
            loadingOverlay.innerHTML = '<span>Loading dashboard...</span>';
            shell.appendChild(loadingOverlay);

            const skeletonCount = Math.max(4, Math.min(8, Math.ceil((structureEntries.length || 6) / 2)));
            for (let index = 0; index < skeletonCount; index += 1) {
                const target = index < Math.ceil(skeletonCount / 2) ? thisGrid : otherGrid;
                target.appendChild(buildProteinComplexStructureSkeletonCard());
            }
        };

        if (!structureEntries.length) {
            proteinComplexStructuresLoading = false;
            status.textContent = 'No protein complexes are available for the current dataset yet.';
            const pinnedEmpty = document.createElement('div');
            pinnedEmpty.className = 'structures-section-empty';
            pinnedEmpty.textContent = 'Pin structures to keep them here.';
            const empty = document.createElement('div');
            empty.className = 'structures-section-empty';
            empty.textContent = 'Load accessory data with PDB annotations to see protein complex cards here.';
            pinnedGrid.appendChild(pinnedEmpty);
            thisGrid.appendChild(empty);
            otherGrid.appendChild(empty.cloneNode(true));
            return;
        }

        renderLoadingSkeletons();

        try {
            await fetchProteinComplexStructuresMetadata(structureEntries.map(entry => entry.pdbId));
        } catch (error) {
            if (renderToken !== proteinComplexStructuresRenderToken) return;
            status.textContent = `Unable to load RCSB metadata: ${error?.message || 'Unknown error'}`;
        }

        if (renderToken !== proteinComplexStructuresRenderToken || currentViewId !== 'Protein Complex Structures') return;
        proteinComplexStructuresLoading = false;

        const records = structureEntries.map(entry => ({
            ...entry,
            meta: proteinComplexStructuresMetadataById.get(entry.pdbId) || { title: '', species: [] }
        }));

        const speciesCounts = new Map();
        records.forEach(record => {
            const uniqueSpecies = Array.from(new Set(Array.isArray(record.meta?.species) ? record.meta.species : []));
            uniqueSpecies.forEach(species => {
                const speciesKey = normalizeProteinComplexSpeciesName(species);
                if (!speciesKey) return;
                const current = speciesCounts.get(speciesKey) || { count: 0, label: String(species).trim() };
                speciesCounts.set(speciesKey, {
                    count: current.count + 1,
                    label: current.label || String(species).trim()
                });
            });
        });
        const dominantSpeciesEntry = Array.from(speciesCounts.entries()).sort((a, b) => b[1].count - a[1].count)[0];
        const dominantSpeciesKey = dominantSpeciesEntry?.[0] || '';
        const dominantSpeciesLabel = dominantSpeciesEntry?.[1]?.label || '';

        const pinnedCards = [];
        const thisSpeciesCards = [];
        const otherSpeciesCards = [];
        let firstRealCardRendered = false;
        records.forEach(record => {
            const titleText = String(record.meta?.title || '').trim() || record.pdbId;
            const speciesList = Array.from(new Set(Array.isArray(record.meta?.species) ? record.meta.species : []));
            const speciesLabel = speciesList.length ? speciesList.join(', ') : 'Unknown';
            let isThisSpecies;
            if (dominantSpeciesKey) {
                isThisSpecies = speciesList.some(s => normalizeProteinComplexSpeciesName(s) === dominantSpeciesKey);
            } else {
                isThisSpecies = speciesList.length === 1;
            }
            const searchText = [titleText, speciesLabel, record.pdbId, ...record.nodeIds.map(nodeId => {
                const meta = proteinMetadata.get(nodeId) || {};
                return [nodeId, meta.preferred_name, meta.annotation, meta.description].filter(Boolean).join(' ');
            })].join(' ').toLowerCase();
            if (query && !searchText.includes(query)) return;
            const isPinned = proteinComplexStructuresPinnedPdbIds.has(record.pdbId);
            const card = buildProteinComplexStructureCard({ ...record, title: titleText }, speciesLabel, isPinned, pdbId => {
                if (proteinComplexStructuresPinnedPdbIds.has(pdbId)) {
                    proteinComplexStructuresPinnedPdbIds.delete(pdbId);
                } else {
                    proteinComplexStructuresPinnedPdbIds.add(pdbId);
                }
                if (currentViewId === 'Protein Complex Structures') {
                    renderProteinComplexStructuresView();
                }
            });
            card.dataset.searchText = searchText;
            if (!firstRealCardRendered) {
                clearProteinComplexStructuresLoadingState(view);
                firstRealCardRendered = true;
            }
            if (isPinned) pinnedCards.push(card);
            else if (isThisSpecies) thisSpeciesCards.push(card);
            else otherSpeciesCards.push(card);
        });

        status.textContent = `${records.length} protein complex structure${records.length === 1 ? '' : 's'} loaded from RCSB PDB${dominantSpeciesLabel ? ` for ${dominantSpeciesLabel}` : ''}.`;

        if (!pinnedCards.length) {
            const empty = document.createElement('div');
            empty.className = 'structures-section-empty';
            empty.textContent = 'Pin structures to keep them here.';
            pinnedGrid.appendChild(empty);
        } else {
            pinnedCards.forEach(card => pinnedGrid.appendChild(card));
        }

        if (!thisSpeciesCards.length) {
            const empty = document.createElement('div');
            empty.className = 'structures-section-empty';
            empty.textContent = 'No single-species structures matched the dominant species in this dataset.';
            thisGrid.appendChild(empty);
        } else {
            thisSpeciesCards.forEach(card => thisGrid.appendChild(card));
        }

        if (!otherSpeciesCards.length) {
            const empty = document.createElement('div');
            empty.className = 'structures-section-empty';
            empty.textContent = 'No structures were found for this dataset.';
            otherGrid.appendChild(empty);
        } else {
            otherSpeciesCards.forEach(card => otherGrid.appendChild(card));
        }

        const observer = ensureProteinComplexStructuresObserver();
        view.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
        applyProteinComplexStructuresSearchFilter();

        if (!firstRealCardRendered) {
            clearProteinComplexStructuresLoadingState(view);
        }
    }

    function refreshProteinComplexStructuresViewIfOpen() {
        if (currentViewId === 'Protein Complex Structures') {
            renderProteinComplexStructuresView();
        }
    }

    function updateViewMenu() {
        console.log("function updateViewMenu()");
        const container = d3.select("#view-options").html("");
        const box = d3.select("#view-selector-box");

        // --- NEW: RENAME UI (Similar to Create UI) ---
        if (isRenamingColl) {
            // 1. Enter Form Mode & Clear container
            box.classed('form-mode', true);
            container.html("");

            const row = container.append("div").attr("class", "inline-create-row").on("click", e => e.stopPropagation());
            
            // Add Input with current name pre-filled
            const input = row.append("input")
                .attr("type", "text")
                .attr("class", "collection-input")
                .attr("id", "rename-input")
                .property("value", isRenamingColl);

            // Add Button Group
            const btns = row.append("div").attr("class", "inline-btn-group");

            btns.append("button").text("Cancel").style("background", "#444").on("click", (e) => {
                e.stopPropagation(); 
                isRenamingColl = null; 
                box.classed('form-mode', false); // Leave Form Mode
                box.classed('locked-open', false); 
                updateViewMenu();
            });

            btns.append("button").text("Rename").on("click", (e) => {
                e.stopPropagation();
                const newName = document.getElementById('rename-input').value.trim();
                if (newName && newName !== isRenamingColl && !collections.has(newName)) {
                    const data = collections.get(isRenamingColl);
                    collections.set(newName, data);
                    collections.delete(isRenamingColl);
                    if (currentViewId === `coll_${isRenamingColl}`) currentViewId = `coll_${newName}`;
                    
                    refreshLegendIfCollectionMode();
                    isRenamingColl = null;
                    box.classed('form-mode', false); // Leave Form Mode
                    box.classed('locked-open', false);
                    updateViewMenu();
                }
            });

            setTimeout(() => document.getElementById('rename-input')?.focus(), 50);
            return;
        }

        // --- EXISTING CREATE UI ---
        if (isCreatingInline) {
            // 1. Enter Form Mode
            box.classed('form-mode', true);
            container.html("");

            const row = container.append("div").attr("class", "inline-create-row");
            
            // Add Input
            const input = row.append("input")
                .attr("type", "text")
                .attr("placeholder", "Collection Name...")
                .attr("id", "inline-name-input");

            // Add Button Group
            const btns = row.append("div").attr("class", "inline-btn-group");
            
            btns.append("button").text("Cancel").style("background", "#444").on("click", (e) => {
                e.stopPropagation(); 
                isCreatingInline = false; 
                box.classed('form-mode', false); // Leave Form Mode
                updateViewMenu();
            });

            btns.append("button").text("Create").on("click", (e) => {
                e.stopPropagation();
                const val = document.getElementById('inline-name-input').value.trim();
                if (val && !collections.has(val)) {
                    collections.set(val, { nodeIds: new Set(), nodes: [], links: [] });
                    refreshLegendIfCollectionMode();
                    isCreatingInline = false; 
                    box.classed('form-mode', false); // Leave Form Mode
                    updateViewMenu();
                }
            });

            setTimeout(() => document.getElementById('inline-name-input')?.focus(), 50);
            return;
        }

        // --- MAIN MENU RENDER ---
            box.style("min-width", null).style("width", null);
            // 1. Clear the container
            container.html("");

            container.style("display", null); 
            container.style("padding", "10px");

            // Helper function to build buttons within the new grid
            const createBtn = (opt) => {
                // Check if the button should be disabled
                const isBtnDisabled = opt.disabled === true;

                const item = container.append("div")
                    // Add the 'item-disabled' class if necessary
                    .attr("class", `view-option-item ${currentViewId === opt.id ? 'active-view' : ''} ${isBtnDisabled ? 'item-disabled' : ''}`)
                    .on("click", (e) => {
                        e.stopPropagation();
                        // Block clicks if disabled
                        if (isBtnDisabled) return; 

                        if (opt.isAction) { isCreatingInline = true; updateViewMenu(); } 
                        else { switchView(opt.id); }
                    });

                if (pendingDelete === opt.name) {
                    const delRow = item.append("div").attr("class", "delete-confirm-row");
                    const btnGroup = delRow.append("div").attr("class", "delete-btn-group");
                    btnGroup.append("button").attr("class", "btn-cancel-delete").text("Cancel").on("click", (e) => {
                        e.stopPropagation(); pendingDelete = null; updateViewMenu();
                    });
                    btnGroup.append("button").attr("class", "btn-delete-final").text("Delete").on("click", (e) => {
                        e.stopPropagation();
                        collections.delete(opt.name);
                        if (currentViewId === `coll_${opt.name}`) switchView('base');
                        refreshLegendIfCollectionMode();
                        pendingDelete = null; updateViewMenu();
                    });
                } else {
                    item.append("span").text(opt.name);
                    if (opt.isCustom) {
                        item.append("span").attr("class", "rename-coll-btn").text("✎").on("click", (e) => {
                            e.stopPropagation(); isRenamingColl = opt.name; updateViewMenu();
                        });
                        item.append("span").attr("class", "delete-coll-btn").text("✕").on("click", (e) => {
                            e.stopPropagation(); pendingDelete = opt.name; updateViewMenu();
                        });
                    }
                }
                return item;
            };

            // 1. View Menu Section
            container.append("div").attr("class", "view-menu-header").style("font-size", "18px").style("color", "white").text("View Menu");
            createBtn({ id: 'base', name: 'Full Network (F)' });
            const hasSelection = selectedNodes && selectedNodes.size > 0;

            createBtn({ 
                id: 'selected', 
                name: 'Selected Nodes (S)', 
                disabled: !hasSelection // Add a disabled flag
            });

            // 2. Graphs Section
            container.append("div").attr("class", "view-menu-header").style("font-size", "14px").text("Graphs");
            const graphs = [
                { id: 'Scatter Plot', name: 'Scatter Plot' },
                { id: 'Venn Diagram', name: 'Venn Diagram' },
                { id: 'histogram', name: 'Histogram' },
                { id: 'pie_chart', name: 'Pie Chart' },
                { id: 'Mind Map', name: 'Mind Map' },
                { id: 'Embeddings', name: 'Embeddings' }
            ];
            graphs.forEach(g => createBtn(g));

            // 3. Structures Section
            container.append("div").attr("class", "view-menu-header").style("font-size", "14px").text("Structures");
            createBtn({ id: 'Protein Complex Structures', name: 'Protein Complex Structures' }).classed('structures-full-width-btn', true);

            // 4. Collections Section
            container.append("div").attr("class", "view-menu-header").style("font-size", "14px").text("Collections");
            const useThreeCols = collections.size > 10;
            container.classed('three-col-grid', useThreeCols);
            collections.forEach((val, name) => {
                createBtn({ id: `coll_${name}`, name: name, isCustom: true });
            });

            // 5. New Collection (Centered)
            const newBtn = createBtn({ id: 'new_action', name: '+ New Collection', isAction: true });
            newBtn.classed('new-coll-btn-full', true);

                updateVennControls();
    }

    function switchView(viewId) {
        console.log("function switchView(viewId)");
        const fromViewId = currentViewId;
        if (viewId !== fromViewId) {
            previousViewId = fromViewId;
        }

        if (currentViewId === 'Embeddings' && viewId !== 'Embeddings') {
            applyEmbeddingsSelectionToGraphNodes(true);
        }

        const currentIsGraph = currentViewId === 'pie_chart' || currentViewId === 'histogram' || currentViewId === 'Venn Diagram' || currentViewId === 'Scatter Plot' || currentViewId === 'Mind Map' || currentViewId === 'Embeddings';
        const targetIsGraph = viewId === 'pie_chart' || viewId === 'histogram' || viewId === 'Venn Diagram' || viewId === 'Scatter Plot' || viewId === 'Mind Map' || viewId === 'Embeddings';
        const targetIsStructures = viewId === 'Protein Complex Structures';

        if (currentViewId === 'Venn Diagram' && viewId !== 'Venn Diagram') {
            commitGraphSelectionsToNodes();
        } else if (currentIsGraph && !targetIsGraph) {
            commitGraphSelectionsToNodes();
        }

        if (currentViewId === 'selected' && viewId !== 'selected' && selectedNodesDraft instanceof Set) {
            selectedNodes = new Set(selectedNodesDraft);
            selectedNodesDraft = null;
        }

        hideChartCollectionMenu();

        if (targetIsStructures) {
            currentViewId = viewId;
            selectedWedges.clear();
            selectedHistogramBins.clear();
            hoveredNode = null;
            hideNodeHoverTooltip();
            setRightPanelMinimized(true);
            setProteinComplexStructuresVisibility(true);
            d3.select("#current-view-label").text('Protein Complex Structures');
            updateViewMenu();
            renderProteinComplexStructuresView();
            return;
        }

        setRightPanelMinimized(false);
        setProteinComplexStructuresVisibility(false);

        if (viewId === 'pie_chart' || viewId === 'histogram' || viewId === 'Venn Diagram' || viewId === 'Scatter Plot' || viewId === 'Mind Map' || viewId === 'Embeddings') {
            currentViewId = viewId;
            selectedWedges.clear();
            selectedHistogramBins.clear();
            hoveredNode = null;
            hideNodeHoverTooltip();
            if (viewId === 'Venn Diagram') {
                const defaults = getDefaultVennSources();
                vennCollectionA = defaults.a;
                vennCollectionB = defaults.b;
                vennPinnedSelectedNodes = new Set(selectedNodes);
                vennSelectedNodes.clear();
                d3.select(canvas).call(zoomBehavior.transform, vennTransform);
            }
            if (viewId === 'Scatter Plot') {
                ensureScatterEigenCentrality();
                d3.select(canvas).call(zoomBehavior.transform, scatterTransform);
                startScatterPlotAsyncLoading();
            }
            if (viewId === 'histogram') {
                histogramScope = selectedNodes.size > 0 ? 'selected' : 'full';
            }
            if (viewId === 'Mind Map') {
                updateMindMapControls();
                centerMindMapView();
            }
            if (viewId === 'Embeddings') {
                syncEmbeddingSelectionFromGraphNodes();
                markEmbeddingsDirty(true);
                refreshEmbeddingsView();
            }
            const labelText = viewId === 'pie_chart'
                ? 'Pie Chart'
                : (viewId === 'histogram' ? 'Histogram' : (viewId === 'Venn Diagram' ? 'Venn Diagram' : 'Scatter Plot'));
            const finalLabelText = viewId === 'Mind Map' ? 'Mind Map' : (viewId === 'Embeddings' ? 'Embeddings' : labelText);
            d3.select("#current-view-label").text(finalLabelText);
            updateViewMenu();
            updateVennControls();
            updateScatterControls();
            updateMindMapControls();
            updateEmbeddingsControls();
            // Ensure color mode is initialised before drawing chart views
            if (viewId === 'Embeddings') {
                refreshLegendForCurrentViewOnly();
                draw();
            } else if (!currentColorMode || !currentColorRange) {
                updateSizesAndColors();
            } else {
                draw();
            }
            return;
        }
        // Switch off selection tools
        isLassoMode = false;
        isBrushMode = false;
        document.getElementById('lassoBtn').classList.remove('active');
        document.getElementById('brushBtn').classList.remove('active');
        updateCanvasCursor();

        const sim = currentViewId === 'base' ? simulation : activeSubData?.simulation;
        if (sim) sim.stop();

        if (activeSubData) {
            if (currentViewId === 'selected') {
                selectedViewState.nodes = activeSubData.nodes.map(n => ({...n}));
            } else if (currentViewId.startsWith('coll_')) {
                const name = currentViewId.replace('coll_', '');
                if (collections.has(name)) {
                    collections.get(name).nodes = activeSubData.nodes.map(n => ({...n}));
                }
            }
        }

        if (viewId === 'base' && physicsAutoPlayFromPause) {
            const subSim = activeSubData?.simulation;
            if (subSim) subSim.stop();
            physicsAutoPlayFromPause = false;
            isSettling = false;
            physicsEnabled = false;
            updatePhysicsControlButtons();
            updatePhysicsRuntimeLabel();
        }

        currentViewId = viewId;
        const labelText = viewId === 'base' ? 'Full Network' : (viewId === 'selected' ? 'Selected Nodes' : viewId.replace('coll_', ''));
        d3.select("#current-view-label").text(labelText);

        if (viewId === 'base') {
            d3.select(canvas).call(zoomBehavior.transform, transform);
            initWebGPU();
            restartActivePhysics();
            updateSizesAndColors();
        } else if (viewId === 'selected') {
            d3.select(canvas).call(zoomBehavior.transform, transform);
            selectedNodesDraft = new Set(selectedNodes);
            initSubNetworkView('selected', Array.from(selectedNodes));
        } else if (viewId === 'Mind Map') {
            d3.select(canvas).call(zoomBehavior.transform, mindMapTransform);
            updateMindMapControls();
        } else if (viewId.startsWith('coll_')) {
            d3.select(canvas).call(zoomBehavior.transform, transform);
            const name = viewId.replace('coll_', '');
            initSubNetworkView(viewId, Array.from(collections.get(name).nodeIds));
        }
        
        updateViewMenu();
        updateVennControls();
        updateScatterControls();
        updateMindMapControls();
        updateEmbeddingsControls();
        draw();
    }

    function fitNodesInView(nodes, margin = 50) {
        if (!nodes || nodes.length === 0) return d3.zoomIdentity;
        
        // Find bounding box of all nodes
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            const r = n.r || 5;
            minX = Math.min(minX, n.x - r);
            maxX = Math.max(maxX, n.x + r);
            minY = Math.min(minY, n.y - r);
            maxY = Math.max(maxY, n.y + r);
        });
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        const nodeWidth = maxX - minX;
        const nodeHeight = maxY - minY;
        
        // Calculate scale to fit all nodes with margin
        const availableWidth = width - 2 * margin;
        const availableHeight = height - 2 * margin;
        const scale = Math.min(availableWidth / nodeWidth, availableHeight / nodeHeight, 2);
        
        // Calculate center of nodes
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Create transform: translate to center screen, scale, then translate to node center
        return d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(scale)
            .translate(-centerX, -centerY);
    }

    function initSubNetworkView(id, nodeIdList) {
        console.log("function initSubNetworkView(id, nodeIdList)")
        let prevNodes = [];
        if (id === 'selected') prevNodes = selectedViewState.nodes;
        else prevNodes = collections.get(id.replace('coll_', '')).nodes || [];

        const prevNodeMap = new Map(prevNodes.map(n => [n.id, n]));
        const nodeIdSet = new Set(nodeIdList);

        const subNodes = nodes.filter(n => nodeIdSet.has(n.id)).map(n => {
            const prev = prevNodeMap.get(n.id);
            return prev ? {...prev, fx: null, fy: null} : {...n, fx: null, fy: null};
        });

        const subNodeMap = new Map(subNodes.map(n => [n.id, n]));
        const threshold = +document.getElementById('thresholdInput').value;
        const subLinks = links
            .filter(l => nodeIdSet.has(l.source.id) && nodeIdSet.has(l.target.id) && l.value >= threshold)
            .map(l => ({
                ...l,
                source: subNodeMap.get(l.source.id),
                target: subNodeMap.get(l.target.id)
            }));

        const subSim = d3.forceSimulation(subNodes)
            .force("link", d3.forceLink(subLinks).id(d => d.id).distance(70))
            .force("charge", d3.forceManyBody().strength(-150))
            .force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
            .on("tick", () => {
                const limit = +document.getElementById('driftSlider').value;
                const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
                subNodes.forEach(n => {
                    if (Math.abs(n.x - cx) > limit) { n.x = n.x > cx ? cx + limit : cx - limit; n.vx = 0; }
                    if (Math.abs(n.y - cy) > limit) { n.y = n.y > cy ? cy + limit : cy - limit; n.vy = 0; }
                });
                if (physicsAutoPlayFromPause && subSim.alpha() < 0.005) {
                    subSim.stop();
                    physicsAutoPlayFromPause = false;
                    isSettling = false;
                    physicsEnabled = false;
                    updatePhysicsControlButtons();
                    updatePhysicsRuntimeLabel();
                }
                draw();
            });

        if (isPhysicsStopped) {
            subSim.stop();
        } else if (!physicsEnabled) {
            physicsAutoPlayFromPause = true;
            isSettling = true;
            physicsEnabled = true;
            updatePhysicsControlButtons();
            updatePhysicsRuntimeLabel();
            subSim.alpha(+document.getElementById('alphaSlider').value || 0.5).restart();
        }
        
        activeSubData = { nodes: subNodes, links: subLinks, simulation: subSim };
        updateSizesAndColors();
        updatePhysicsForce();

        // Let the subnetwork settle briefly before fitting so framing reflects the post-entry layout.
        setTimeout(() => {
            if (currentViewId !== id || !activeSubData || activeSubData.nodes !== subNodes) return;
            const fitTransform = fitNodesInView(subNodes, 50);
            d3.select(canvas).transition().duration(800).call(zoomBehavior.transform, fitTransform);
        }, 70);
    }

    function toggleSearchMore() {
        console.log("function toggleSearchMore()");
        const content = document.getElementById('search-more-drop'), btn = document.getElementById('moreToggle');
        const isOpen = content.style.display === 'block';
        content.style.display = isOpen ? 'none' : 'block';
        btn.innerHTML = isOpen ? 'Selection Tools ▾' : 'Selection Tools ▾'; 
    }

    function canPhysicsRun() {
        return physicsEnabled && !isPhysicsStopped;
    }

    function clearFullNetworkPostBuildCooldown() {
        if (fullNetworkPostBuildAutoPauseTimer) {
            clearTimeout(fullNetworkPostBuildAutoPauseTimer);
            fullNetworkPostBuildAutoPauseTimer = null;
        }
        if (fullNetworkAlphaDriftTimer) {
            clearInterval(fullNetworkAlphaDriftTimer);
            fullNetworkAlphaDriftTimer = null;
        }
        fullNetworkPostBuildAlphaStart = null;
    }

    // This function gradually reduces the alpha value after building in the full network view, and eventually auto-pauses physics to help users explore the new layout without overshooting. It is cancelled if the user manually toggles physics or switches views.
    function scheduleFullNetworkPostBuildCooldown() {
        clearFullNetworkPostBuildCooldown();
        if (currentViewId !== 'base') return;
        if (!physicsEnabled || isPhysicsStopped) return;

        const alphaSlider = document.getElementById('alphaSlider');
        if (!alphaSlider) return;

        const durationMs = 60000;
        fullNetworkPostBuildAlphaStart = +alphaSlider.value;
        const startTs = Date.now();

        fullNetworkAlphaDriftTimer = setInterval(() => {
            if (currentViewId !== 'base' || isBuilding || !physicsEnabled || isPhysicsStopped) {
                clearFullNetworkPostBuildCooldown();
                return;
            }
            const elapsed = Date.now() - startTs;
            const t = Math.max(0, Math.min(1, elapsed / durationMs));
            const nextAlpha = Math.max(0.001, fullNetworkPostBuildAlphaStart * (1 - t));
            alphaSlider.value = String(nextAlpha);
            updatePhysicsForce();
            if (t >= 1) {
                clearFullNetworkPostBuildCooldown();
            }
        }, 250);

        fullNetworkPostBuildAutoPauseTimer = setTimeout(() => {
            if (currentViewId !== 'base' || isBuilding || !physicsEnabled || isPhysicsStopped) {
                clearFullNetworkPostBuildCooldown();
                return;
            }
            togglePhysics(false, 'auto-post-build');
            clearFullNetworkPostBuildCooldown();
        }, durationMs);
    }

    function updatePhysicsControlButtons() {
        const physBtn = document.getElementById('physBtn');
        if (physBtn) {
            physBtn.innerText = physicsEnabled ? 'Pause Physics (spacebar)' : 'Resume Physics (spacebar)';
            physBtn.style.background = physicsEnabled ? '#3498db' : '#666';
        }

        const stopBtn = document.getElementById('stopPhysBtn');
        if (stopBtn) {
            stopBtn.innerText = isPhysicsStopped ? 'Enable Physics' : 'Stop Physics';
            stopBtn.style.background = isPhysicsStopped ? '#f39c12' : '#3498db';
        }
    }

    function togglePhysics(state, reason = 'manual') {
        console.log("function togglePhysics(state)");
        if (isPhysicsStopped && state) {
            physicsEnabled = false;
            const simForcedOff = currentViewId === 'base' ? simulation : activeSubData?.simulation;
            if (simForcedOff) simForcedOff.stop();
            updatePhysicsControlButtons();
            updatePhysicsRuntimeLabel();
            return;
        }

        physicsEnabled = state;
        if (!state) {
            physicsAutoPlayFromPause = false;
            clearFullNetworkPostBuildCooldown();
        }
        updatePhysicsControlButtons();
        updatePhysicsRuntimeLabel();
        const sim = currentViewId === 'base' ? simulation : activeSubData?.simulation;
        if (canPhysicsRun() && sim) { restartActivePhysics((isBuilding || isSettling) ? 0.5 : +document.getElementById('alphaSlider').value); }
        else if (sim) sim.stop();
    }

    function updatePhysicsRuntimeLabel() {
        const label = document.getElementById('physics-runtime-label');
        if (!label) return;
        if (isPhysicsStopped) {
            label.textContent = 'Physics stopped by user';
            return;
        }
        const usingGpu = currentViewId === 'base' && !!gpuState.ready && !!gpuState.device && !!gpuState.context;
        label.textContent = usingGpu ? 'Physics run on local GPU' : 'Physics run on local CPU';
    }

    function isPointerOverNode(clientX, clientY, node) {
        if (!node) return false;
        const rect = canvas.getBoundingClientRect();
        const px = clientX - rect.left;
        const py = clientY - rect.top;
        const [nx, ny] = transform.apply([node.x, node.y]);
        const dx = px - nx;
        const dy = py - ny;
        const baseRadius = node.r || 5;
        const zoomK = Math.max(transform.k || 1, 1e-6);
        // Larger radius when zoomed out (small zoom), smaller when zoomed in (large zoom)
        // Scaled: 0.15→5×, 1→3×, 2+→1×
        const zoomAdjustedMultiplier = Math.max(1, 5 - 2 * zoomK);
        const hoverRadius = baseRadius * zoomAdjustedMultiplier;
        return (dx*dx + dy*dy) <= (hoverRadius * hoverRadius);
    }

    function showNodeHoverTooltip(node) {
        if (!node) return;
        const tooltip = document.getElementById('node-hover-tooltip');
        if (!tooltip) return;
        if (nodeHoverTooltipTimer) {
            clearTimeout(nodeHoverTooltipTimer);
            nodeHoverTooltipTimer = null;
        }
        pendingNodeHoverTooltipId = null;

        const m = proteinMetadata.get(node.id) || {};
        const locationSource = resolveBuiltInColorSource('localization', [node]);
        const locationText = escapeHtml(getBuiltInColorValueFromSource(node.id, 'localization', locationSource) || 'Unknown');
        
        // Retrieve and truncate the annotation to 30 words
        let annotation = getProteinInfoAnnotation(node.id) || 'Unknown';
        const words = annotation.split(/\s+/);
        if (words.length > 30) {
            annotation = words.slice(0, 30).join(' ') + '...';
        }
        const annotationText = escapeHtml(annotation);

        tooltip.innerHTML = `
            <div style="font-size:14px; font-weight:700; margin-bottom:10px; line-height:1.2;">${escapeHtml(node.id)}</div>
            <div style="line-height:1.3;">Localization: ${locationText}</div>
            <div style="line-height:1.3;">Annotation: ${annotationText}</div>
        `;

        const [x, y] = transform.apply([node.x, node.y]);
        const offsetX = 14;
        const offsetY = -25;
        tooltip.style.transform = `translate(${x + offsetX}px, ${y + offsetY}px)`;
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
        tooltip.style.pointerEvents = 'auto';
    }

    function hideNodeHoverTooltip() {
        const tooltip = document.getElementById('node-hover-tooltip');
        if (!tooltip) return;
        if (nodeHoverTooltipTimer) {
            clearTimeout(nodeHoverTooltipTimer);
            nodeHoverTooltipTimer = null;
        }
        pendingNodeHoverTooltipId = null;
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
        tooltip.style.pointerEvents = 'none';
    }

    function scheduleNodeHoverTooltip(node, delayMs = 250) {
        if (!node) return;
        if (pendingNodeHoverTooltipId === node.id && nodeHoverTooltipTimer) return;
        if (nodeHoverTooltipTimer) {
            clearTimeout(nodeHoverTooltipTimer);
            nodeHoverTooltipTimer = null;
        }
        pendingNodeHoverTooltipId = node.id;
        nodeHoverTooltipTimer = setTimeout(() => {
            nodeHoverTooltipTimer = null;
            if (hoveredNode && hoveredNode.id === node.id && !isTooltipHovered) {
                showNodeHoverTooltip(node);
            }
        }, delayMs);
    }

    function isNodeHoverTooltipVisible() {
        const tooltip = document.getElementById('node-hover-tooltip');
        if (!tooltip) return false;
        return tooltip.style.visibility === 'visible' && tooltip.style.opacity !== '0';
    }

    function refreshSelectionModeState() {
        isAdditiveMode = additiveKeyHeld || additiveModeLocked;
        isSubtractMode = subtractKeyHeld || subtractModeLocked;
        isIntersectMode = intersectKeyHeld || intersectModeLocked;
        document.getElementById('additiveBtn')?.classList.toggle('active', isAdditiveMode);
        document.getElementById('subtractBtn')?.classList.toggle('active', isSubtractMode);
        document.getElementById('intersectBtn')?.classList.toggle('active', isIntersectMode);
    }

    window.addEventListener('keydown', (e) => {
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        if (!isPointerOverMainCanvas && currentViewId !== 'Embeddings') return;
        if (isVariableSettingsOpen) return;
        const key = e.key.toLowerCase();

        if (key === 'a' || (e.ctrlKey && key === 'a')) {
            e.preventDefault();
            if (currentViewId === 'histogram') {
                selectedHistogramBins = new Set((window.histogramBins || []).map(b => b.x0));
                draw();
                return;
            }
            if (currentViewId === 'pie_chart') {
                selectedWedges = new Set((window.pieChartWedges || []).map(w => w.label));
                draw();
                return;
            }
            if (currentViewId === 'Venn Diagram') {
                const ids = getVennActiveNodeIds();
                applyVennSelectionIds(ids);
                draw();
                return;
            }
            if (currentViewId === 'Embeddings') {
                const activeEmbedData = getActiveEmbeddingData();
                if (activeEmbedData?.ids) {
                    const ids = activeEmbedData.ids.map(v => String(v || '').trim()).filter(Boolean);
                    setActiveEmbeddingSelection(new Set(ids));
                    const plotEl = document.getElementById('embeddings-plot');
                    if (plotEl) applyEmbeddingSelectionStyling(plotEl, activeEmbedData.ids);
                    applyEmbeddingsSelectionToGraphNodes(true);
                    drawEmbeddingsSelectionOverlay();
                    draw();
                }
                return;
            }
            const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
            selectNodes(activeNodes, false, "Select All");
            draw();
            return;
        }
        if (key === 'i') {
            e.preventDefault();
            if (currentViewId === 'Venn Diagram') {
                const ids = getVennActiveNodeIds();
                const inverted = new Set();
                ids.forEach(id => { if (!vennSelectedNodes.has(id)) inverted.add(id); });
                vennSelectedNodes = inverted;
                draw();
                return;
            }
            const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
            const inverted = activeNodes.filter(n => !selectedNodes.has(n.id));
            selectNodes(inverted, false, "Invert Selection");
            draw();
            return;
        }
        if (key === 's') {
            if (currentViewId === 'selected') {
                let target = previousViewId || 'base';
                if (target.startsWith('coll_')) {
                    const name = target.replace('coll_', '');
                    if (!collections.has(name)) target = 'base';
                }
                if (target === 'selected') target = 'base';
                switchView(target);
            } else {
                switchView('selected');
            }
            return;
        }
        if (key === 'f') {
            if (currentViewId === 'base') {
                let target = previousViewId || 'base';
                if (target === 'base' || target === currentViewId) return;
                if (target.startsWith('coll_')) {
                    const name = target.replace('coll_', '');
                    if (!collections.has(name)) return;
                }
                switchView(target);
            } else {
                switchView('base');
            }
            return;
        }
        if (e.key === 'Escape') { switchView('base'); deselectNodes(); closeCollectionMenu(); return; }
        if (key === 'm') {
            const effectiveSelection = getEffectiveSelectedNodesSet();
            if (effectiveSelection && effectiveSelection.size > 0) {
                e.preventDefault();
                openCollectionMenu(lastMousePosition.x, lastMousePosition.y);
            }
            return;
        }
        if (e.code === 'Space' || key === ' ') {
            e.preventDefault();
            togglePhysics(!physicsEnabled, 'spacebar');
            return;
        }
        if (key === 'z') {
            e.preventDefault();
            toggleProteinZoomHotkey();
            return;
        }
        if (key === 'b') { toggleBrush(); return; }
        if (key === 'l') { toggleLasso(); return; }

        const wasAddHeld = additiveKeyHeld;
        const wasSubtractHeld = subtractKeyHeld;
        const wasIntersectHeld = intersectKeyHeld;

        if (e.shiftKey) additiveKeyHeld = true;
        if (e.ctrlKey) subtractKeyHeld = true;
        if (e.altKey) {
            e.preventDefault();
            intersectKeyHeld = true;
        }

        if (additiveKeyHeld !== wasAddHeld || subtractKeyHeld !== wasSubtractHeld || intersectKeyHeld !== wasIntersectHeld) {
            refreshSelectionModeState();
            // Do not auto-pause physics on modifier keys; this was stopping GPU physics unexpectedly in base view.
        }
        if (key === '+' || key === '=') modifySelection(1);
        if (key === '-') modifySelection(-1);
        if (e.ctrlKey && key === 'd') {
            e.preventDefault();
            deselectNodes();
            draw();
            return;
        }
    });

    // Handle the Rename option click
    document.getElementById('rename-option').onclick = function(e) {
        e.stopPropagation(); // Prevents the mousedown listener from firing immediately
        
        // 1. Set the state to the name of the collection we want to change
        isRenamingColl = window.targetCollectionToRename;
        
        // 2. Hide the floating context menu
        document.getElementById('custom-context-menu').style.display = 'none';
        
        // 3. Refresh the menu to show the Rename UI
        updateViewMenu();
    };

    window.addEventListener('mousedown', (e) => {
        const menu = document.getElementById('custom-context-menu');
        const box = document.getElementById('view-selector-box');
        const [mx, my] = d3.pointer(e, canvas);
        const activeTransform = currentViewId === 'Venn Diagram'
            ? vennTransform
            : (currentViewId === 'Scatter Plot'
                ? scatterTransform
                : (currentViewId === 'Mind Map' ? mindMapTransform : transform));
        const pt = activeTransform.invert([mx, my]);

        const isUiTarget = !!e.target.closest('#ui-layer, #right-panel, #view-selector-container, #view-selector-box, #view-options, #custom-context-menu, #collection-context-menu, #variables-settings-modal, #variables-settings-modal-overlay, #embeddings-controls, #scatter-controls, #chart-collection-menu, #protein-complex-structures-view');

        // Keep an existing export frame intact when interacting with UI controls (e.g. frame download buttons).
        if (isFrameMode && isUiTarget) {
            return;
        }

        if (!isUiTarget && currentViewId === 'Embeddings' && e.button === 0 && (isLassoMode || isBrushMode)) {
            const embPt = [mx, my];
            if (isLassoMode) lassoPoints = [embPt];
            if (isBrushMode) brushPoints = [embPt];
            draw();
            return;
        }
        
        if (isFrameMode && e.button === 0) {
            // CRITICAL: Stop the event here so D3 doesn't try to pan
            e.stopImmediatePropagation();
            
            isDrawingFrame = true;
            exportFrame = { x: pt[0], y: pt[1], w: 0, h: 0 };
            draw();
            return;
        }
        // If we click anywhere that isn't the context menu
        if (menu && menu.style.display === 'block') {
            if (!menu.contains(e.target)) {
                console.log("❌ Closing menu: Click detected outside.");
                menu.style.display = 'none';
                if (!isRenamingColl) {
                    box.classList.remove('locked-open');
                }
            } else {
                console.log("Keep menu open: Click detected inside.");
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        if (!isPointerOverMainCanvas) return;
        const wasAddHeld = additiveKeyHeld;
        const wasSubtractHeld = subtractKeyHeld;
        const wasIntersectHeld = intersectKeyHeld;

        if (!e.shiftKey) additiveKeyHeld = false;
        if (!e.ctrlKey) subtractKeyHeld = false;
        if (!e.altKey) intersectKeyHeld = false;

        if (additiveKeyHeld !== wasAddHeld || subtractKeyHeld !== wasSubtractHeld || intersectKeyHeld !== wasIntersectHeld) {
            refreshSelectionModeState();
        }
    });

    window.addEventListener('click', (e) => {
        const menu = document.getElementById('collection-context-menu');
        if (menu && menu.style.display === 'block' && !menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });

    // Exponential Brush Size Change (reversed direction, stronger sensitivity)
    window.addEventListener('wheel', (e) => {
        if (isBrushMode) {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 0.8 : 1.2;
            brushRadius = Math.max(5, Math.min(500, brushRadius * factor));
            draw();
        }
    }, { passive: false });

    function setSelectionMode(mode) {
        additiveModeLocked = mode === 'add';
        subtractModeLocked = mode === 'remove';
        intersectModeLocked = mode === 'and';
        refreshSelectionModeState();
    }

    function toggleSelectionMode(mode) {
        const isAlreadyLocked = (mode === 'add' && additiveModeLocked)
            || (mode === 'remove' && subtractModeLocked)
            || (mode === 'and' && intersectModeLocked);
        setSelectionMode(isAlreadyLocked ? null : mode);
    }

    function toggleLasso() {
        console.log("function toggleLasso()");
        if (isVariableSettingsOpen) return;
        isLassoMode = !isLassoMode;
        document.getElementById('lassoBtn').classList.toggle('active', isLassoMode);
        const sim = currentViewId === 'base' ? simulation : activeSubData?.simulation;
        if (isLassoMode) { isBrushMode = false; document.getElementById('brushBtn').classList.remove('active'); if(sim) sim.stop(); } 
        else if (!isBrushMode && physicsEnabled && sim) { restartActivePhysics((isBuilding || isSettling) ? 0.5 : +document.getElementById('alphaSlider').value); }
        updateCanvasCursor(); draw();
    }

    function toggleBrush() {
        console.log("function toggleBrush()");
        if (isVariableSettingsOpen) return;
        isBrushMode = !isBrushMode;
        document.getElementById('brushBtn').classList.toggle('active', isBrushMode);
        const sim = currentViewId === 'base' ? simulation : activeSubData?.simulation;
        if (isBrushMode) { isLassoMode = false; document.getElementById('lassoBtn').classList.remove('active'); if(sim) sim.stop(); }
        else if (!isLassoMode && physicsEnabled && sim) { restartActivePhysics((isBuilding || isSettling) ? 0.5 : +document.getElementById('alphaSlider').value); }
        updateCanvasCursor(); draw();
    }

    function disableBrushAndLassoSelection(shouldRedraw = true) {
        if (!isLassoMode && !isBrushMode) return;
        isLassoMode = false;
        isBrushMode = false;
        lassoPoints = [];
        brushPoints = [];
        document.getElementById('lassoBtn')?.classList.remove('active');
        document.getElementById('brushBtn')?.classList.remove('active');
        updateCanvasCursor();
        if (shouldRedraw) draw();
    }

    function updateCanvasCursor(pt) {
        console.log("function updateCanvasCursor(pt)");
        const canvasEl = canvas;
        if (!canvasEl) return;
        
        if (isFrameMode) {
            const hover = getFrameHoverState(pt);
            if (hover === 'move') {
                canvasEl.style.setProperty('cursor', 'move', 'important');
            } else if (hover === 'resize') {
                canvasEl.style.setProperty('cursor', 'nwse-resize', 'important');
            } else {
                canvasEl.style.setProperty('cursor', 'crosshair', 'important');
            }
            return;
        }
        
        // Your existing lasso/brush/grab logic...
        const mode = (isLassoMode || isBrushMode) ? 'crosshair' : 'grab';
        canvasEl.style.setProperty('cursor', mode, 'important');
    }
    d3.select(canvas).on("mousedown", (e) => {
        const [mx, my] = d3.pointer(e); 
        const activeTransform = currentViewId === 'Venn Diagram' ? vennTransform : (currentViewId === 'Scatter Plot' ? scatterTransform : (currentViewId === 'Mind Map' ? mindMapTransform : transform));
        const pt = activeTransform.invert([mx, my]); 

        if (e.button === 0 && (currentViewId === 'pie_chart' || currentViewId === 'histogram')) {
            const onPieButton = currentViewId === 'pie_chart' && window.pieChartButtons?.some(b => mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height);
            const onHistButton = currentViewId === 'histogram' && window.histogramButtons?.some(b => mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height);

            if (!onPieButton && !onHistButton) {
                isChartDragSelecting = true;
                chartDragType = currentViewId === 'pie_chart' ? 'pie' : 'histogram';

                const additiveDrag = e.shiftKey;
                if (!additiveDrag) {
                    selectedWedges.clear();
                    selectedHistogramBins.clear();
                }

                if (chartDragType === 'pie') {
                    const wedge = getPieWedgeAtPoint(mx, my);
                    if (wedge) {
                        const labels = new Set(selectedWedges);
                        labels.add(wedge.label);
                        applyPieSelectionsFromSet(labels);
                    }
                } else {
                    const bin = window.histogramBins?.find(b => mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height);
                    if (bin) {
                        const starts = new Set(selectedHistogramBins);
                        starts.add(bin.x0);
                        applyHistogramSelectionsFromSet(starts);
                    }
                }
                suppressNextChartClick = true;
                draw();
                return;
            }
        }

        if (isFrameMode && e.button === 0) {
            e.stopImmediatePropagation();
            
            // ONLY check for handles if a frame already exists and has a size
            const hover = (exportFrame && Math.abs(exportFrame.w) > 5) ? getFrameHoverState(pt) : null;

            if (hover && hover !== 'move') {
                isResizingFrame = true;
                activeHandle = hover;
            } else if (hover === 'move') {
                isMovingFrame = true;
                frameDragOffset = { x: pt[0] - exportFrame.x, y: pt[1] - exportFrame.y };
            } else {
                // Default: Start a brand new frame
                isDrawingFrame = true;
                exportFrame = { x: pt[0], y: pt[1], w: 0, h: 0 };
            }
            
            draw();
            return;
        }

        // 2. Existing Lasso/Brush Logic
        // Embeddings gesture start is handled by the window mousedown handler in screen space.
        if (currentViewId === 'Embeddings') return;
        if (!isLassoMode && !isBrushMode || e.button === 2) return;
        if (isLassoMode) lassoPoints = [pt]; else if (isBrushMode) brushPoints = [pt];
        draw();
    });

    canvas.addEventListener('contextmenu', (e) => {
        if (isLassoMode || isBrushMode) {
            e.preventDefault();
            isLassoMode = false; isBrushMode = false;
            document.getElementById('lassoBtn').classList.remove('active');
            document.getElementById('brushBtn').classList.remove('active');
            const sim = currentViewId === 'base' ? simulation : activeSubData?.simulation;
            if (physicsEnabled && sim) { restartActivePhysics((isBuilding || isSettling) ? 0.5 : +document.getElementById('alphaSlider').value); }
            updateCanvasCursor(); draw();
        }
    });

    // Handle right-click on embeddings plot to dismiss brush/lasso and prevent context menu
    const plotEl = document.getElementById('embeddings-plot');
    if (plotEl) {
        plotEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (currentViewId === 'Embeddings' && (isLassoMode || isBrushMode)) {
                isLassoMode = false;
                isBrushMode = false;
                document.getElementById('lassoBtn').classList.remove('active');
                document.getElementById('brushBtn').classList.remove('active');
                updateCanvasCursor();
                draw();
            }
        });
    }

    d3.select(window).on("mousemove", (e) => {
        lastMousePosition = { x: e.clientX, y: e.clientY };
        const [mx, my] = d3.pointer(e, canvas); 
        const activeTransform = currentViewId === 'Venn Diagram' ? vennTransform : (currentViewId === 'Scatter Plot' ? scatterTransform : (currentViewId === 'Mind Map' ? mindMapTransform : transform));
        const pt = activeTransform.invert([mx, my]); 
        currentMousePos = currentViewId === 'Embeddings' ? [mx, my] : pt;

        if (isChartDragSelecting) {
            if (chartDragType === 'pie') {
                const wedge = getPieWedgeAtPoint(mx, my);
                if (wedge && !selectedWedges.has(wedge.label)) {
                    const labels = new Set(selectedWedges);
                    labels.add(wedge.label);
                    applyPieSelectionsFromSet(labels);
                    draw();
                }
            } else if (chartDragType === 'histogram' && window.histogramBins) {
                const bin = window.histogramBins.find(b => mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height);
                if (bin && !selectedHistogramBins.has(bin.x0)) {
                    const starts = new Set(selectedHistogramBins);
                    starts.add(bin.x0);
                    applyHistogramSelectionsFromSet(starts);
                    draw();
                }
            }
            return;
        }

        if (currentViewId === 'Embeddings') {
            if (isLassoMode && lassoPoints.length > 0) {
                lassoPoints.push([mx, my]);
                draw();
                return;
            }
            if (isBrushMode && brushPoints.length > 0) {
                brushPoints.push([mx, my]);
                draw();
                return;
            }
            if (isBrushMode || isLassoMode) {
                draw();
            }
            return;
        }

        if (currentViewId === 'Venn Diagram') {
            if (isLassoMode && lassoPoints.length > 0) {
                lassoPoints.push(pt);
                draw();
            } else if (isBrushMode && brushPoints.length > 0) {
                brushPoints.push(pt);
                draw();
            } else if (isBrushMode) {
                draw();
            }
            return;
        }

        if (currentViewId === 'Mind Map') {
            const hit = getMindMapHitTarget(mx, my);
            const newCursor = hit ? 'pointer' : 'grab';
            if (canvas.style.cursor !== newCursor) {
                canvas.style.cursor = newCursor;
            }
            return;
        }

        if (currentViewId === 'Scatter Plot' && scatterLayoutState?.points) {
            if (isLassoMode && lassoPoints.length > 0) {
                lassoPoints.push(pt);
                draw();
                return;
            }
            if (isBrushMode && brushPoints.length > 0) {
                brushPoints.push(pt);
                draw();
                return;
            }
            if (isBrushMode || isLassoMode) {
                draw();
                return;
            }

            const zoomK = Math.max(scatterTransform?.k || 1, 1e-6);
            const hovered = scatterLayoutState.points.find(p => {
                const dx = pt[0] - p.x;
                const dy = pt[1] - p.y;
                const hitR = p.r + (2 / zoomK);
                return (dx * dx + dy * dy) <= (hitR * hitR);
            });
            canvas.style.cursor = hovered ? 'pointer' : 'grab';
            return;
        }

        // --- 1. NEW HISTOGRAM OPTIMIZATION ---
        if (currentViewId === 'histogram') {
            // Assuming you have a function to find the bin/bar under the mouse
            const currentBar = findBarAtCoords(mx, my); 

            if (currentBar !== lastHoveredBar) {
                lastHoveredBar = currentBar;
                draw(); // Only redraws when we cross into a NEW bar
            }
            return; // Stop the rest of the function from running
        }

        // --- 2. EXISTING FRAME LOGIC ---
        if (isFrameMode) {
            if (isDrawingFrame) {
                exportFrame.w = pt[0] - exportFrame.x;
                exportFrame.h = (selectedRatio !== 'custom') ? 
                                (exportFrame.w / eval(selectedRatio)) : 
                                (pt[1] - exportFrame.y);
                draw();
                return;
            }
            
            if (isResizingFrame && activeHandle) {

                // Advanced "Resize" logic: Anchor the opposite side
                if (activeHandle.includes('w')) {
                    const rightEdge = exportFrame.x + exportFrame.w;
                    exportFrame.x = pt[0];
                    exportFrame.w = rightEdge - pt[0];
                } else if (activeHandle.includes('e')) {
                    exportFrame.w = pt[0] - exportFrame.x;
                }

                if (activeHandle.includes('n')) {
                    const bottomEdge = exportFrame.y + exportFrame.h;
                    exportFrame.y = pt[1];
                    exportFrame.h = bottomEdge - pt[1];
                } else if (activeHandle.includes('s')) {
                    exportFrame.h = pt[1] - exportFrame.y;
                }

                if (selectedRatio !== 'custom') {
                    exportFrame.h = exportFrame.w / eval(selectedRatio);
                }
                draw();
                return;
            }

            if (isMovingFrame) {
                exportFrame.x = pt[0] - frameDragOffset.x;
                exportFrame.y = pt[1] - frameDragOffset.y;
                draw();
                return;
            }

            // Update cursor hover icons
            const hover = (exportFrame && Math.abs(exportFrame.w) > 5) ? getFrameHoverState(pt) : null;
            const cursorMap = { nw:'nwse-resize', se:'nwse-resize', ne:'nesw-resize', sw:'nesw-resize', move:'move' };
            canvas.style.setProperty('cursor', cursorMap[hover] || 'crosshair', 'important');
            return;
        }

        // --- 3. EXISTING NODE/DRAG LOGIC ---
        const drawNodes = currentViewId === 'base' ? nodes : activeSubData?.nodes || [];
        if (draggedNode) { 
            hasDragged = true; 
            draggedNode.x = pt[0]; 
            draggedNode.y = pt[1]; 
            draggedNode.fx = pt[0]; 
            draggedNode.fy = pt[1]; 
            if (!physicsEnabled) draw(); 
        }

        // Only draw for hover/cursor changes if something actually changes
        if (!isLassoMode && !isBrushMode && !draggedNode) {
            const found = drawNodes.find(n => { 
                const dx = n.x - pt[0], dy = n.y - pt[1]; 
                return Math.sqrt(dx*dx + dy*dy) < (n.r || 5); 
            });
            
            const newCursor = found ? 'pointer' : (isDragMode ? 'crosshair' : 'grab');
            const cursorChanged = canvas.style.cursor !== newCursor;
            if (cursorChanged) {
                canvas.style.cursor = newCursor;
            }

            const shouldRedrawForSelectionProximity = getEffectiveSelectedNodesSet().size > 0;
            if (cursorChanged || shouldRedrawForSelectionProximity) {
                draw();
            }
        }

        if (isLassoMode && lassoPoints.length > 0) {
            lassoPoints.push(pt);
            draw();
        } else if (isBrushMode && brushPoints.length > 0) {
            brushPoints.push(pt);
            draw();
        } else if (isBrushMode) {
            draw();
        }
    });

    d3.select(window).on("mouseup", () => {
        if (isChartDragSelecting) {
            isChartDragSelecting = false;
            chartDragType = null;
            return;
        }

        isDrawingFrame = false;
        isResizingFrame = false;
        isMovingFrame = false;
        activeHandle = null;
        if (isFrameMode) {
            // Clear frame if it's too small (accidental click)
            if (Math.abs(exportFrame.w) < 5 || Math.abs(exportFrame.h) < 5) {
                exportFrame = null;
            }
            draw();
            return;
        }
        const sim = currentViewId === 'base' ? simulation : activeSubData?.simulation;
        if (draggedNode) { if (physicsEnabled && sim) sim.alphaTarget(0); draggedNode.fx = null; draggedNode.fy = null; draggedNode = null; }
        const drawNodes = currentViewId === 'base' ? nodes : activeSubData?.nodes || [];
        if (currentViewId === 'Embeddings') {
            if (isLassoMode && lassoPoints.length >= 3) {
                applyEmbeddingGestureSelection(true);
            } else if (isBrushMode && brushPoints.length > 0) {
                applyEmbeddingGestureSelection(false);
            }
        } else if (isLassoMode && lassoPoints.length >= 3) {
            const poly = lassoPoints;
            if (currentViewId === 'Venn Diagram' && window.vennDiagramState?.nodeBasePos) {
                const ids = new Set();
                window.vennDiagramState.nodeBasePos.forEach((pos, id) => {
                    if (d3.polygonContains(poly, [pos.x, pos.y])) ids.add(id);
                });
                if (ids.size > 0) applyVennSelectionIds(ids);
            } else if (currentViewId === 'Scatter Plot' && scatterLayoutState?.points) {
                const matches = scatterLayoutState.points
                    .filter(p => d3.polygonContains(poly, [p.x, p.y]))
                    .map(p => p.node)
                    .filter(Boolean);
                if (matches.length > 0) applySearchLogic(matches, "Lasso Selection");
            } else {
                const matches = drawNodes.filter(n => d3.polygonContains(poly, [n.x, n.y]));
                if (matches.length > 0) applySearchLogic(matches, "Lasso Selection");
            }
        } else if (isBrushMode && brushPoints.length > 0) {
            if (currentViewId === 'Venn Diagram' && window.vennDiagramState?.nodeBasePos) {
                const ids = new Set();
                window.vennDiagramState.nodeBasePos.forEach((pos, id) => {
                    const hit = brushPoints.some(pt => {
                        const dx = pos.x - pt[0], dy = pos.y - pt[1];
                        return Math.sqrt(dx*dx + dy*dy) <= brushRadius;
                    });
                    if (hit) ids.add(id);
                });
                if (ids.size > 0) applyVennSelectionIds(ids);
            } else if (currentViewId === 'Scatter Plot' && scatterLayoutState?.points) {
                const matches = scatterLayoutState.points
                    .filter(p => brushPoints.some(pt => {
                        const dx = p.x - pt[0], dy = p.y - pt[1];
                        return Math.sqrt(dx * dx + dy * dy) <= brushRadius;
                    }))
                    .map(p => p.node)
                    .filter(Boolean);
                if (matches.length > 0) applySearchLogic(matches, "Brush Selection");
            } else {
                const matches = drawNodes.filter(n => brushPoints.some(pt => { const dx = n.x - pt[0], dy = n.y - pt[1]; return Math.sqrt(dx*dx + dy*dy) <= brushRadius; }));
                if (matches.length > 0) applySearchLogic(matches, "Brush Selection");
            }
        }
        if (lassoPoints.length > 0 || brushPoints.length > 0) {
            lassoPoints = []; brushPoints = [];
            if (!isLassoMode && !isBrushMode && physicsEnabled && sim) { restartActivePhysics((isBuilding || isSettling) ? 0.5 : +document.getElementById('alphaSlider').value); }
            draw();
        }
    });

    canvas.addEventListener("click", (e) => {
        if (suppressNextChartClick) {
            suppressNextChartClick = false;
            return;
        }

        if (isLassoMode || isBrushMode || hasDragged) { hasDragged = false; return; }

        if (currentViewId === 'Venn Diagram' && window.vennDiagramState) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const state = window.vennDiagramState;

            const clickedNode = state.nodes.find(n => {
                const dx = mx - n.x;
                const dy = my - n.y;
                return (dx * dx + dy * dy) <= ((n.r + 2) * (n.r + 2));
            });

            if (clickedNode) {
                const nodeObj = nodeMap.get(clickedNode.id);
                if (nodeObj) {
                    applyVennSelectionIds(new Set([nodeObj.id]));
                }
                draw();
                return;
            }

            const section = state.classify(mx, my);
            if (section) {
                const idSet = state.nodeSets[section] || new Set();
                if (idSet.size > 0) {
                    applyVennSelectionIds(idSet);
                }
                draw();
                return;
            }

            vennSelectedNodes.clear();
            refreshInfoBoxFromSelection();
            draw();
            return;
        }

        if (currentViewId === 'Mind Map') {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const hit = getMindMapHitTarget(mx, my);
            if (hit && hit.type === 'node') {
                selectMindMapNodes([hit.id], e.shiftKey || e.ctrlKey || e.metaKey);
            } else if (hit && hit.type === 'toggle') {
                toggleMindMapNode(hit.id);
                draw();
            } else {
                // Clicking on background deselects all nodes
                mindMapSelectedNodes.clear();
                refreshInfoBoxFromSelection();
                draw();
            }
            return;
        }

        if (currentViewId === 'Scatter Plot' && scatterLayoutState?.points) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const ux = scatterTransform.invertX(mx);
            const uy = scatterTransform.invertY(my);
            const zoomK = Math.max(scatterTransform?.k || 1, 1e-6);
            const clicked = scatterLayoutState.points.find(p => {
                const dx = ux - p.x;
                const dy = uy - p.y;
                const hitR = p.r + (2 / zoomK);
                return (dx * dx + dy * dy) <= (hitR * hitR);
            });
            if (clicked) {
                if (isAdditiveMode || isSubtractMode || isIntersectMode) {
                    applySearchLogic([clicked.node], `Scatter Node: ${clicked.id}`);
                } else {
                    selectNodes([clicked.node], false, `Scatter Node: ${clicked.id}`);
                }
            } else {
                deselectNodes();
            }
            draw();
            return;
        }
        
        // Handle pie chart button clicks
        if (currentViewId === 'pie_chart' && window.pieChartButtons) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            
            const clickedButton = window.pieChartButtons.find(btn => {
                return mx >= btn.x && mx <= btn.x + btn.width && my >= btn.y && my <= btn.y + btn.height;
            });
            
            if (clickedButton) {
                if (clickedButton.action === 'network') {
                    pieDataSource = 'network';
                    selectedWedges.clear();
                    collectionMenuOpen = false;
                        hideChartCollectionMenu();
                    draw();
                } else if (clickedButton.action === 'selected') {
                    pieDataSource = 'selected';
                    selectedWedges.clear();
                    collectionMenuOpen = false;
                        hideChartCollectionMenu();
                    draw();
                } else if (clickedButton.action === 'collection') {
                        openChartCollectionMenu('pie_chart', clickedButton);
                }
                return;
            }
        }
        
        // Handle pie chart wedge clicks
        if (currentViewId === 'pie_chart' && window.pieChartWedges) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = Math.min(canvas.width, canvas.height) / 3.5;
            
            // Check if click is within pie chart area
            const dx = mx - centerX;
            const dy = my - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= radius) {
                const angle = Math.atan2(dy, dx);
                // Find which wedge was clicked
                const clickedWedge = window.pieChartWedges.find(wedge => {
                    let normalizedAngle = angle;
                    if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
                    return normalizedAngle >= wedge.startAngle && normalizedAngle <= wedge.endAngle;
                });
                
                if (clickedWedge) {
                    // Handle wedge selection
                    if (isAdditiveMode || isSubtractMode || isIntersectMode) {
                        if (selectedWedges.has(clickedWedge.label)) {
                            selectedWedges.delete(clickedWedge.label);
                        } else {
                            selectedWedges.add(clickedWedge.label);
                        }
                    } else {
                        selectedWedges.clear();
                        selectedWedges.add(clickedWedge.label);
                    }
                    draw();
                }
            }
            return;
        } else if (currentViewId === 'histogram' && window.histogramBins) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            
            // Check if clicked on buttons
            if (window.histogramButtons) {
                const clickedButton = window.histogramButtons.find(btn => {
                    return mx >= btn.x && mx <= btn.x + btn.width && my >= btn.y && my <= btn.y + btn.height;
                });
                
                if (clickedButton) {
                    if (clickedButton.action === 'full') {
                        histogramScope = 'full';
                        histogramDataSource = 'network';
                        collectionMenuOpen = false;
                        hideChartCollectionMenu();
                        drawHistogramView();
                    } else if (clickedButton.action === 'selected') {
                        histogramScope = 'selected';
                        histogramDataSource = 'selected';
                        collectionMenuOpen = false;
                        hideChartCollectionMenu();
                        drawHistogramView();
                    } else if (clickedButton.action === 'collection') {
                        openChartCollectionMenu('histogram', clickedButton);
                    }
                    return;
                }
            }
            
            // Find which bin was clicked
            const clickedBin = window.histogramBins.find(bin => {
                return mx >= bin.x && mx <= bin.x + bin.width && my >= bin.y && my <= bin.y + bin.height;
            });
            
            if (clickedBin) {
                // Handle bin selection
                if (isAdditiveMode || isSubtractMode || isIntersectMode) {
                    if (selectedHistogramBins.has(clickedBin.x0)) {
                        selectedHistogramBins.delete(clickedBin.x0);
                    } else {
                        selectedHistogramBins.add(clickedBin.x0);
                    }
                } else {
                    selectedHistogramBins.clear();
                    selectedHistogramBins.add(clickedBin.x0);
                }
                draw();
            } else {
                // Click outside histogram bars - deselect all
                selectedHistogramBins.clear();
                draw();
            }
            return;
        }
        
        const rect = canvas.getBoundingClientRect(); const [mx, my] = transform.invert([e.clientX - rect.left, e.clientY - rect.top]);
        const drawNodes = currentViewId === 'base' ? nodes : activeSubData?.nodes || [];
        const zoomK = Math.max(transform.k || 1, 1e-6);
        const zoomAdjustedMultiplier = Math.max(1, 5 - 2 * zoomK);
        const found = drawNodes.find(n => { const dx = n.x - mx, dy = n.y - my; const baseRadius = n.r || 5; const hoverRadius = baseRadius * zoomAdjustedMultiplier; return Math.sqrt(dx*dx + dy*dy) < hoverRadius; });
        if (found) { if (isAdditiveMode || isSubtractMode || isIntersectMode) applySearchLogic([found], "Custom Selection"); else selectNodes([found], false); } else deselectNodes();
        draw();
    });

    canvas.addEventListener("mousemove", (e) => {
        isPointerOverMainCanvas = true;
        if ((currentViewId === 'histogram' && window.histogramBins) || currentViewId === 'pie_chart') {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            let changed = false;

            const hoveredBin = currentViewId === 'histogram'
                ? window.histogramBins.find(bin => mx >= bin.x && mx <= bin.x + bin.width && my >= bin.y && my <= bin.y + bin.height)
                : null;
            if (hoveredBin !== hoverBin) {
                hoverBin = hoveredBin;
                changed = true;
            }

            const activeButtons = currentViewId === 'pie_chart' ? window.pieChartButtons : window.histogramButtons;
            const hoveredCollectionButton = activeButtons?.find(btn => btn.action === 'collection' && mx >= btn.x && mx <= btn.x + btn.width && my >= btn.y && my <= btn.y + btn.height);

            if (hoveredCollectionButton) {
                openChartCollectionMenu(currentViewId, hoveredCollectionButton);
            } else if (!chartCollectionMenuHover) {
                scheduleHideChartCollectionMenu();
            }

            if (changed) draw();
            return;
        } else if (currentViewId === 'Venn Diagram' && window.vennDiagramState) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const state = window.vennDiagramState;
            hoveredNode = null;
            hideNodeHoverTooltip();

            const node = state.nodes.find(n => {
                const dx = mx - n.x;
                const dy = my - n.y;
                return (dx * dx + dy * dy) <= ((n.r + 2) * (n.r + 2));
            });
            const section = (node || isLassoMode || isBrushMode) ? null : state.classify(mx, my);

            const nextNodeId = node ? node.id : null;
            const nextSection = section || null;
            if (hoverVennNodeId !== nextNodeId || hoverVennSection !== nextSection) {
                hoverVennNodeId = nextNodeId;
                hoverVennSection = nextSection;
                draw();
            }
            if (isLassoMode || isBrushMode) {
                canvas.style.cursor = 'crosshair';
            } else {
                canvas.style.cursor = (node || section) ? 'pointer' : 'grab';
            }
            return;
        } else if (currentViewId === 'Scatter Plot' && scatterLayoutState?.points) {
            if (isLassoMode || isBrushMode) {
                canvas.style.cursor = 'crosshair';
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const ux = scatterTransform.invertX(mx);
            const uy = scatterTransform.invertY(my);
            const zoomK = Math.max(scatterTransform?.k || 1, 1e-6);
            const hovered = scatterLayoutState.points.find(p => {
                const dx = ux - p.x;
                const dy = uy - p.y;
                const hitR = p.r + (2 / zoomK);
                return (dx * dx + dy * dy) <= (hitR * hitR);
            });
            canvas.style.cursor = hovered ? 'pointer' : 'grab';
            return;
        } else if (hoverBin) {
            hoverBin = null;
            scheduleHideChartCollectionMenu();
            draw();
        }

        if (draggedNode) { 
            hoveredNode = null;
            hideNodeHoverTooltip();
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const [mx, my] = transform.invert([e.clientX - rect.left, e.clientY - rect.top]);
        const drawNodes = currentViewId === 'base' ? nodes : activeSubData?.nodes || [];
        const zoomK = Math.max(transform.k || 1, 1e-6);
        const zoomAdjustedMultiplier = Math.max(1, 5 - 2 * zoomK);
        const found = drawNodes.find(n => {
            const dx = n.x - mx, dy = n.y - my;
            const baseRadius = n.r || 5;
            const hoverRadius = baseRadius * zoomAdjustedMultiplier;
            return Math.sqrt(dx*dx + dy*dy) < hoverRadius;
        });

        if (found) {
            if (!hoveredNode || hoveredNode.id !== found.id) {
                hoveredNode = found;
                scheduleNodeHoverTooltip(found);
            }
        } else if (!isTooltipHovered) {
            hoveredNode = null;
            hideNodeHoverTooltip();
        }
    });

    canvas.addEventListener("mouseleave", (e) => {
        isPointerOverMainCanvas = false;
        scheduleHideChartCollectionMenu();
        histogramButtonHovered = null;
        hoverBin = null;
        hoverVennNodeId = null;
        hoverVennSection = null;

        const leaveTimeout = setTimeout(() => {
            if (!isTooltipHovered) {
                hoveredNode = null;
                hideNodeHoverTooltip();
            }
        }, 25);

        // if the tooltip receives the pointer in the next 25ms, it should stay
        const tooltip = document.getElementById('node-hover-tooltip');
        if (tooltip) {
            const onTooltipEnter = () => {
                clearTimeout(leaveTimeout);
                tooltip.removeEventListener('mouseenter', onTooltipEnter);
            };
            tooltip.addEventListener('mouseenter', onTooltipEnter);
        }
        //draw();
    });

    function drawPieChartView() {
        console.log("function drawPieChartView()")
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Parse current color mode to get data
        if (!currentColorMode) return;
        
        const activeNodes = getPieChartActiveNodes();
        
        // Determine what data to display
        let displayMode = currentColorMode;
        let isSupportedMode = displayMode === 'layer' || displayMode === 'collection' || displayMode === 'complex_pdbs' || ['annotation', 'localization'].includes(displayMode);
        if (currentColorMode.startsWith('var::')) {
            const parts = currentColorMode.split('::');
            const file = parts[1], variable = parts[2];
            const cfg = variableConfigs.find(c => c.fileName === file && c.variable === variable);
            isSupportedMode = !!cfg && (cfg.type === 'Categorical - Nominal' || cfg.type === 'Categorical - Ordinal');
        }
        
        let dataCounts = new Map();
        const builtInColorSource = (displayMode === 'annotation' || displayMode === 'localization')
            ? resolveBuiltInColorSource(displayMode, activeNodes)
            : null;
        
        if (isSupportedMode && displayMode === 'layer') {
            activeNodes.forEach(d => {
                const key = d.layer === 99 ? 'Disconnected' : `Layer ${d.layer}`;
                dataCounts.set(key, (dataCounts.get(key) || 0) + 1);
            });
        } else if (isSupportedMode && displayMode === 'collection') {
            activeNodes.forEach(d => {
                const memberships = getNodeCollectionMemberships(d.id);
                if (!memberships.length) {
                    dataCounts.set('No Collection', (dataCounts.get('No Collection') || 0) + 1);
                    return;
                }
                memberships.forEach(name => {
                    dataCounts.set(name, (dataCounts.get(name) || 0) + 1);
                });
            });
        } else if (isSupportedMode && displayMode === 'complex_pdbs') {
            activeNodes.forEach(d => {
                getComplexPdbMemberships(d.id).forEach(pdbId => {
                    dataCounts.set(pdbId, (dataCounts.get(pdbId) || 0) + 1);
                });
            });
        } else if (isSupportedMode && ['annotation', 'localization'].includes(displayMode)) {
            activeNodes.forEach(d => {
                const key = getBuiltInColorValueFromSource(d.id, displayMode, builtInColorSource);
                dataCounts.set(key, (dataCounts.get(key) || 0) + 1);
            });
        } else if (isSupportedMode && displayMode.startsWith('var::')) {
            const displayParts = String(displayMode).split('::');
            const file = displayParts[1], variable = displayParts[2];
            activeNodes.forEach(d => {
                const val = accessoryVariableValues[file]?.[variable]?.get(d.id) || 'Unknown';
                dataCounts.set(val, (dataCounts.get(val) || 0) + 1);
            });
        }
        
        // Draw pie chart using canvas
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2
        const radius = Math.min(canvas.width, canvas.height) / 3.5;
        
        const data = Array.from(dataCounts.entries())
            .sort((a, b) => b[1] - a[1]); // Sort by count descending
        const total = Array.from(dataCounts.values()).reduce((a, b) => a + b, 0);
        const totalCategories = dataCounts.size;
        
        // Draw heading and category count
        const modeLabel = displayMode === 'layer' ? 'Layer' 
            : displayMode === 'collection' ? 'Collection'
            : displayMode === 'complex_pdbs' ? 'Complex PDBs'
            : displayMode === 'annotation' ? 'Annotation'
            : displayMode === 'localization' ? 'Localization'
            : displayMode.startsWith('var::') ? displayMode.split('::')[2] : displayMode;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`Pie chart of ${modeLabel}`, canvas.width / 2, 40);
        ctx.font = '14px Arial';
        ctx.fillText(`Total categories: ${totalCategories}`, canvas.width / 2, 70);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        
        let currentAngle = -Math.PI / 2;
        let currentCatScale;
        if (displayMode === 'layer') {
            currentCatScale = (label) => label === 'Disconnected' ? '#888' : d3.interpolateViridis(1 - ((parseInt(label.split(' ')[1]) - 1) / 10));
        } else if (displayMode === 'collection') {
            currentCatScale = (label) => label === 'No Collection' ? '#444' : getCollectionColorByName(label);
        } else if (displayMode === 'complex_pdbs') {
            currentCatScale = ensureComplexPdbColorState().colorScale;
        } else {
            currentCatScale = d3.scaleOrdinal(d3.schemeTableau10);
        }
        
        // Store wedge data for click handling
        window.pieChartWedges = [];

        if (isSupportedMode && total > 0) {
            data.forEach((entry, i) => {
                const [label, count] = entry;
                const sliceAngle = (count / total) * 2 * Math.PI;
                const isSelectedWedge = selectedWedges.has(label);
                const hasSelection = selectedWedges.size > 0;
                
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
                ctx.lineTo(centerX, centerY);
                let wedgeColor = currentCatScale(label);
                // Darken unselected wedges when selection exists
                if (hasSelection && !isSelectedWedge) {
                    wedgeColor = d3.color(wedgeColor).darker(1.5).toString();
                }
                ctx.fillStyle = wedgeColor;
                ctx.fill();
                ctx.strokeStyle = isSelectedWedge ? '#fff' : '#222';
                ctx.lineWidth = isSelectedWedge ? 4 : 2;
                ctx.stroke();
                
                // Draw label only if wedge is >= 10% of pie
                const slicePercentage = (sliceAngle / (2 * Math.PI)) * 100;
                if (slicePercentage >= 5) {
                    const labelAngle = currentAngle + sliceAngle / 2;
                    const labelX = centerX + Math.cos(labelAngle) * (radius / 1.5);
                    const labelY = centerY + Math.sin(labelAngle) * (radius / 1.5);
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${label}: ${count}`, labelX, labelY);
                }
                
                // Store wedge data
                window.pieChartWedges.push({
                    label: label,
                    startAngle: currentAngle,
                    endAngle: currentAngle + sliceAngle
                });
                
                currentAngle += sliceAngle;
            });
        } else if (!isSupportedMode) {
            ctx.fillStyle = '#888';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Set Node Colouring to a Categorical Variable', centerX, centerY + 47);
            ctx.textBaseline = 'alphabetic';
        }
        
        // Draw buttons below the pie chart
        const buttonY = centerY + radius + 58;
        const buttonHeight = 32;
        const buttonSpacing = 16;
        
        ctx.font = 'bold 13px Arial';
        const pad = 28;
        const w1 = ctx.measureText('Plot Full Network').width + pad * 2;
        const w2 = ctx.measureText('Plot Selected Nodes').width + pad * 2;
        const w3 = ctx.measureText('Plot Collection').width + pad * 2;
        const totalWidth = w1 + w2 + w3 + buttonSpacing * 2;
        const buttonX1 = centerX - totalWidth / 2;
        const buttonX2 = buttonX1 + w1 + buttonSpacing;
        const buttonX3 = buttonX2 + w2 + buttonSpacing;
        
        function drawPieButton(x, y, w, h, label, isActive) {
            const r = h / 2;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.lineTo(x + w, y + h - r);
            ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
            ctx.lineTo(x + r, y + h);
            ctx.arcTo(x, y + h, x, y + h - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
            ctx.fillStyle = isActive ? '#4caf50' : 'rgba(40, 40, 40, 0.9)';
            ctx.fill();
            ctx.strokeStyle = isActive ? '#53bd57' : '#555';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x + w / 2, y + h / 2);
            ctx.textBaseline = 'alphabetic';
        }
        
        drawPieButton(buttonX1, buttonY, w1, buttonHeight, 'Plot Full Network', pieDataSource === 'network');
        drawPieButton(buttonX2, buttonY, w2, buttonHeight, 'Plot Selected Nodes', pieDataSource === 'selected');
        drawPieButton(buttonX3, buttonY, w3, buttonHeight, 'Plot Collection', pieDataSource.startsWith('collection_'));
        
        window.pieChartButtons = [
            { x: buttonX1, y: buttonY, width: w1, height: buttonHeight, action: 'network' },
            { x: buttonX2, y: buttonY, width: w2, height: buttonHeight, action: 'selected' },
            { x: buttonX3, y: buttonY, width: w3, height: buttonHeight, action: 'collection' }
        ];
    }

    function findBarAtCoords(mx, my) {
            // 1. Safety check: ensure the scale and bins exist
            if (typeof xScale === 'undefined' || !currentHistogramBins) return null;

            // 2. Convert mouse X pixel to a data value (e.g., 0.5)
            const xValue = xScale.invert(mx);

            // 3. Find which bin contains this value
            // x0 is the start of the bar, x1 is the end
            return currentHistogramBins.find(b => xValue >= b.x0 && xValue <= b.x1);
        }

    function drawHistogramView() {
        console.log("function drawHistogramView()");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (!currentColorMode || !currentColorRange) return;
        
        // Calculate statistics for display
        let statisticsText = "";
        let variableName = currentColorMode;
        
        const activeNodes = getHistogramActiveNodes();
        
        const effectiveScope = getHistogramEffectiveScope();
        // Determine what data to display
        let displayMode = currentColorMode;
        let isCategoricalOverride = false;

        if (currentColorMode.startsWith('var::')) {
            const modeParts = String(currentColorMode).split('::');
            const file = modeParts[1], variable = modeParts[2];
            const cfg = variableConfigs.find(c => c.fileName === file && c.variable === variable);
            if (cfg && (cfg.type === 'Categorical - Nominal' || cfg.type === 'Categorical - Ordinal')) {
                displayMode = 'centrality';
                isCategoricalOverride = true;
            }
        }

        const isSupportedMode = displayMode === 'centrality' || displayMode === 'eigen' || displayMode === 'size' || displayMode === 'annotation' || displayMode.startsWith('var::');
        const histogramSizeSource = displayMode === 'size' ? resolveProteinSizeSource(nodes) : null;

        let numericValues = [];

        if (displayMode === 'centrality') {
            numericValues = activeNodes.map(n => n.centrality || 0);
            variableName = 'Centrality';
        } else if (displayMode === 'eigen') {
            numericValues = activeNodes.map(n => Number.isFinite(n.eigen) ? n.eigen : 0);
            variableName = 'Eigenvector';
        } else if (displayMode === 'size') {
            numericValues = activeNodes.map(n => getProteinSizeValue(n.id, histogramSizeSource));
            variableName = 'Size';
        } else if (displayMode === 'annotation') {
            numericValues = activeNodes.map(n => getAnnotationLengthFromSource(n.id, resolveBuiltInColorSource('annotation', activeNodes))).filter(v => Number.isFinite(v));
            variableName = 'Annotation';
        } else if (displayMode.startsWith('var::')) {
            const displayParts = String(displayMode).split('::');
            const file = displayParts[1], variable = displayParts[2];
            numericValues = activeNodes
                .map(d => accessoryVariableValues[file]?.[variable]?.get(d.id))
                .filter(v => v !== undefined && v !== null)
                .map(v => +v)
                .filter(v => !isNaN(v));
            variableName = variable;
        }

        let fullNetworkNumericValues = [];
        if (displayMode === 'centrality') {
            fullNetworkNumericValues = nodes.map(n => n.centrality || 0);
        } else if (displayMode === 'eigen') {
            fullNetworkNumericValues = nodes.map(n => Number.isFinite(n.eigen) ? n.eigen : 0);
        } else if (displayMode === 'size') {
            fullNetworkNumericValues = nodes.map(n => getProteinSizeValue(n.id, histogramSizeSource));
        } else if (displayMode === 'annotation') {
            fullNetworkNumericValues = nodes.map(n => getAnnotationLengthFromSource(n.id, resolveBuiltInColorSource('annotation', nodes))).filter(v => Number.isFinite(v));
        } else if (displayMode.startsWith('var::')) {
            const displayParts = String(displayMode).split('::');
            const file = displayParts[1], variable = displayParts[2];
            fullNetworkNumericValues = nodes
                .map(d => accessoryVariableValues[file]?.[variable]?.get(d.id))
                .filter(v => v !== undefined && v !== null)
                .map(v => +v)
                .filter(v => !isNaN(v));
        }

        const noNumericData = numericValues.length === 0;
        
        // Calculate statistics
        if (!noNumericData && numericValues.length > 0) {
            const sorted = [...numericValues].sort((a, b) => a - b);
            const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
            const median = sorted.length % 2 === 0 
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)];
            
            // Calculate mode
            const freq = new Map();
            sorted.forEach(v => freq.set(v, (freq.get(v) || 0) + 1));
            let mode = sorted[0];
            let maxFreq = 0;
            freq.forEach((count, val) => {
                if (count > maxFreq) {
                    maxFreq = count;
                    mode = val;
                }
            });
            
            statisticsText = `Mean: ${mean.toFixed(3)}   Median: ${median.toFixed(3)}   Mode: ${mode.toFixed(3)}`;
        }
        
        if (noNumericData) {
            ctx.fillStyle = '#888';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('No data available for the current view.', canvas.width / 2, canvas.height / 2);
            ctx.textBaseline = 'alphabetic';
        } else {
            // Draw heading and statistics
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`Histogram of ${variableName}`, canvas.width / 2, 40);
            ctx.font = '14px Arial';
            ctx.fillText(statisticsText, canvas.width / 2, 70);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
        }
        
        // Draw histogram with greyed-out areas for out-of-range
        const padding = 60;
        const width = (canvas.width - 2 * padding) * 0.5; // Half the current size
        const height = (canvas.height - 2 * padding) * 0.5; // Half the current size
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const leftOffset = centerX - width / 2;
        const topOffset = centerY - height / 2;
        const bins = 30;
        
        const fallbackRange = Array.isArray(currentColorRange?.[0]) ? currentColorRange[0] : [0, 1];
        const fullRangeMissing = fullNetworkNumericValues.length === 0;
        const dataMin = fullRangeMissing ? undefined : d3.min(fullNetworkNumericValues);
        const dataMax = fullRangeMissing ? undefined : d3.max(fullNetworkNumericValues);
        const minVal = Number.isFinite(dataMin) ? dataMin : (fallbackRange[0] ?? 0);
        const maxVal = Number.isFinite(dataMax) ? dataMax : (fallbackRange[1] ?? 1);
        let range = [minVal, maxVal];
        if (Array.isArray(currentColorRange?.[0]) && !fullRangeMissing) {
            range = [
                Math.max(minVal, currentColorRange[0][0] ?? minVal),
                Math.min(maxVal, currentColorRange[0][1] ?? maxVal)
            ];
            if (!Number.isFinite(range[0]) || !Number.isFinite(range[1]) || range[0] >= range[1]) {
                range = [minVal, maxVal];
            }
        }
        
        // Create explicit thresholds for better control over binning
        const thresholds = d3.ticks(minVal, maxVal, bins);
        const histogram = d3.histogram()
            .domain([minVal, maxVal])
            .thresholds(thresholds);

        const binData = noNumericData ? [] : histogram(numericValues); 
        currentHistogramBins = binData; 
        const maxCount = d3.max(binData, d => d.length);
        
        const xScale = d3.scaleLinear()
            .domain([minVal, maxVal])
            .range([leftOffset, leftOffset + width]);
        
        const yScale = d3.scaleLinear()
            .domain([0, maxCount || 1])
            .range([topOffset + height, topOffset]);
        
        // Draw all bars (greyed out if outside range)
        // Draw all bars (greyed out if outside range)
        window.histogramBins = [];
                
        if (!isSupportedMode) {
            ctx.fillStyle = '#888';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom'; 
            ctx.fillText('Set Node Colouring to a Continuous Variable', centerX, centerY + 47); //move this text lower to avoid overlap with other text
            ctx.textBaseline = 'alphabetic';
        } else {
            // SINGLE loop through binData
            const hasSelection = selectedHistogramBins.size > 0;
            binData.forEach(bin => {
                if (bin.length > 0) {
                    const x = xScale(bin.x0);
                    const y = yScale(bin.length);
                    const barWidth = Math.max(1, xScale(bin.x1) - xScale(bin.x0) - 1);
                    const barHeight = (topOffset + height) - y;
                    
                    const isSelected = selectedHistogramBins.has(bin.x0);
                    const isHovered = hoverBin && hoverBin.x0 === bin.x0;
                    const binCenter = (bin.x0 + bin.x1) / 2;
                    
                    // Logic for range highlighting
                    const inRange = !range || (binCenter >= range[0] && binCenter <= range[1]);
                    const normalizedValue = (binCenter - minVal) / (maxVal - minVal || 1);
                    const interp = displayMode === 'annotation' 
                        ? (t => d3.interpolatePlasma(clamp01(t)))
                        : (displayMode === 'centrality' || displayMode === 'eigen' ? (t => d3.interpolateInferno(0.3 + 0.8 * t)) : d3.interpolateCool);
                    
                    let baseColor = interp(Math.max(0, Math.min(1, normalizedValue)));
                    
                    if (inRange) {
                        if (isSelected) { baseColor = d3.color(baseColor).darker(0.5).toString(); }
                        else if (isHovered) { baseColor = d3.color(baseColor).brighter(0.5).toString(); }
                        else if (hasSelection) { baseColor = d3.color(baseColor).darker(1.5).toString(); }
                        ctx.fillStyle = baseColor;
                        ctx.strokeStyle = d3.color(baseColor).darker(0.5).toString();
                    } else {
                        ctx.fillStyle = 'rgba(80, 80, 80, 0.4)';
                        ctx.strokeStyle = 'rgba(80, 80, 80, 0.6)';
                    }
                    
                    ctx.lineWidth = inRange ? 1 : 0.5;
                    ctx.fillRect(x, y, barWidth, barHeight);
                    ctx.strokeRect(x, y, barWidth, barHeight);
                    
                    window.histogramBins.push({ x, y, width: barWidth, height: barHeight, x0: bin.x0, x1: bin.x1 });
                }
            });
        }
        
        // Draw range selection handles
        const handleX1 = xScale(range[0]);
        const handleX2 = xScale(range[1]);
        
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(handleX1, topOffset);
        ctx.lineTo(handleX1, topOffset + height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(handleX2, topOffset);
        ctx.lineTo(handleX2, topOffset + height);
        ctx.stroke();
        
        // Draw axes
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftOffset, topOffset + height);
        ctx.lineTo(leftOffset + width, topOffset + height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(leftOffset, topOffset);
        ctx.lineTo(leftOffset, topOffset + height);
        ctx.stroke();
        
        // Draw axis labels
        ctx.fillStyle = '#ccc';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        // Label each bar edge
        for (let i = 0; i <= bins; i++) {
            const val = minVal + (maxVal - minVal) * i / bins;
            const x = xScale(val);
            ctx.fillText(Math.round(val), x, topOffset + height + 20);
        }
        
        // Draw buttons below the histogram
        const buttonY = topOffset + height + 60;
        const buttonHeight = 32;
        const buttonSpacing = 16;
        const radius = buttonHeight / 2; // Pill shape

        // Measure text to fit button width
        ctx.font = 'bold 13px Arial';
        const pad = 28; // horizontal padding each side
        const w1 = ctx.measureText('Plot Full Network').width + pad * 2;
        const w2 = ctx.measureText('Plot Selected Nodes').width + pad * 2;
        const w3 = ctx.measureText('Plot Collection').width + pad * 2;
        const totalWidth = w1 + w2 + w3 + buttonSpacing * 2;
        const buttonX1 = centerX - totalWidth / 2;
        const buttonX2 = buttonX1 + w1 + buttonSpacing;
        const buttonX3 = buttonX2 + w2 + buttonSpacing;

        function drawPillButton(x, y, w, h, label, isActive) {
            console.log("function drawPillButton(x, y, w, h, label, isActive)")
            const r = h / 2;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.lineTo(x + w, y + h - r);
            ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
            ctx.lineTo(x + r, y + h);
            ctx.arcTo(x, y + h, x, y + h - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
            ctx.fillStyle = isActive ? '#4caf50' : 'rgba(40, 40, 40, 0.9)';
            ctx.fill();
            ctx.strokeStyle = isActive ? '#53bd57' : '#555';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x + w / 2, y + h / 2);
            ctx.textBaseline = 'alphabetic';
        }

        drawPillButton(buttonX1, buttonY, w1, buttonHeight, 'Plot Full Network', histogramDataSource === 'network');
        drawPillButton(buttonX2, buttonY, w2, buttonHeight, 'Plot Selected Nodes', histogramDataSource === 'selected');
        
        // Add "Plot Collection" button with hover menu
        drawPillButton(buttonX3, buttonY, w3, buttonHeight, 'Plot Collection', histogramDataSource.startsWith('collection_'));

        window.histogramButtons = [
            { x: buttonX1, y: buttonY, width: w1, height: buttonHeight, action: 'full' },
            { x: buttonX2, y: buttonY, width: w2, height: buttonHeight, action: 'selected' },
            { x: buttonX3, y: buttonY, width: w3, height: buttonHeight, action: 'collection' }
        ];
    }

    function drawVennDiagramView() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        syncVennSourcesWithOptions();
        updateVennControls();

        const leftIds = getNodeIdSetFromVennSource(vennCollectionA);
        const rightIds = getNodeIdSetFromVennSource(vennCollectionB);

        const leftOnly = [];
        const rightOnly = [];
        const both = [];

        leftIds.forEach(id => {
            if (rightIds.has(id)) both.push(id);
            else leftOnly.push(id);
        });
        rightIds.forEach(id => {
            if (!leftIds.has(id)) rightOnly.push(id);
        });

        const nLeft = leftOnly.length + both.length;
        const nRight = rightOnly.length + both.length;
        const nBoth = both.length;
        const minRadius = 120;
        const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;
        const nodeAreaBudget = 105;
        const leftTargetR = Math.sqrt((Math.max(1, nLeft) * nodeAreaBudget) / Math.PI) + 64;
        const rightTargetR = Math.sqrt((Math.max(1, nRight) * nodeAreaBudget) / Math.PI) + 64;
        const rLeft = Math.max(minRadius, Math.min(maxRadius, leftTargetR));
        const rRight = Math.max(minRadius, Math.min(maxRadius, rightTargetR));

        let d;
        if (nLeft === 0 && nRight === 0) {
            d = rLeft + rRight - Math.min(rLeft, rRight) * 0.22;
        } else if (nBoth === 0) {
            d = rLeft + rRight + 8;
        } else {
            const unitArea = 120;
            const targetOverlapArea = nBoth * unitArea;
            d = solveCircleDistanceForOverlap(rLeft, rRight, targetOverlapArea);
        }

        const centerY = canvas.height * 0.43;
        const centerX = canvas.width * 0.5;
        const c1 = { x: centerX - d / 2, y: centerY, r: rLeft };
        const c2 = { x: centerX + d / 2, y: centerY, r: rRight };

        const controlY = Math.max(58, canvas.height - 192);
        vennLayoutCache = {
            controlX: canvas.width / 2,
            controlY
        };

        const inLeft = (x, y) => ((x - c1.x) ** 2 + (y - c1.y) ** 2) <= c1.r ** 2;
        const inRight = (x, y) => ((x - c2.x) ** 2 + (y - c2.y) ** 2) <= c2.r ** 2;
        const inLeftOnly = (x, y) => inLeft(x, y) && !inRight(x, y);
        const inRightOnly = (x, y) => inRight(x, y) && !inLeft(x, y);
        const inBoth = (x, y) => inLeft(x, y) && inRight(x, y);

        const hashSeed = (str) => {
            let h = 2166136261;
            for (let i = 0; i < str.length; i++) {
                h ^= str.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return h >>> 0;
        };

        const layoutIds = (ids, predicate, biasPoint, spread = 0.92) => {
            const placed = [];
            const dotR = 4;
            const minDist = Math.max(5.5, 9 - Math.min(3.2, ids.length / 80));
            ids.forEach((id, idx) => {
                const seed = hashSeed(`${id}:${idx}`);
                let placedPt = null;
                for (let t = 0; t < 620; t++) {
                    const ang = ((seed + t * 977) % 360) * Math.PI / 180;
                    const frac = (((seed >>> 8) + t * 131) % 1000) / 1000;
                    const radius = frac * Math.max(c1.r, c2.r) * spread;
                    const x = biasPoint.x + Math.cos(ang) * radius;
                    const y = biasPoint.y + Math.sin(ang) * radius;
                    if (!predicate(x, y)) continue;
                    let ok = true;
                    for (const p of placed) {
                        const dx = p.x - x;
                        const dy = p.y - y;
                        if ((dx * dx + dy * dy) < (minDist * minDist)) {
                            ok = false;
                            break;
                        }
                    }
                    if (ok) {
                        placedPt = { id, x, y, r: dotR };
                        break;
                    }
                }

                if (!placedPt) {
                    for (let t = 0; t < 220 && !placedPt; t++) {
                        const ang = ((idx * 137.5 + t * 17) % 360) * Math.PI / 180;
                        const radius = 10 + t * 1.7;
                        const x = biasPoint.x + Math.cos(ang) * radius;
                        const y = biasPoint.y + Math.sin(ang) * radius;
                        if (predicate(x, y)) {
                            placedPt = { id, x, y, r: dotR };
                        }
                    }
                }

                if (!placedPt) {
                    const ang = ((seed % 360) * Math.PI) / 180;
                    placedPt = { id, x: biasPoint.x + Math.cos(ang) * 5, y: biasPoint.y + Math.sin(ang) * 5, r: dotR };
                }
                placed.push(placedPt);
            });
            return placed;
        };

        const leftNodes = layoutIds(leftOnly, inLeftOnly, { x: c1.x - c1.r * 0.24, y: c1.y });
        const bothNodes = layoutIds(both, inBoth, { x: (c1.x + c2.x) / 2, y: c1.y }, 0.62);
        const rightNodes = layoutIds(rightOnly, inRightOnly, { x: c2.x + c2.r * 0.24, y: c2.y });
        const vennNodes = [...leftNodes, ...bothNodes, ...rightNodes];
        const nodeBasePos = new Map(vennNodes.map(n => [n.id, { x: n.x, y: n.y }]));

        const toScreen = (x, y) => ({ x: vennTransform.applyX(x), y: vennTransform.applyY(y) });
        const scale = vennTransform.k || 1;
        const c1s = toScreen(c1.x, c1.y);
        const c2s = toScreen(c2.x, c2.y);
        const r1s = c1.r * scale;
        const r2s = c2.r * scale;

        ctx.globalAlpha = 0.46;
        ctx.fillStyle = '#37d7c7';
        ctx.beginPath();
        ctx.arc(c1s.x, c1s.y, r1s, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#37a8ff';
        ctx.beginPath();
        ctx.arc(c2s.x, c2s.y, r2s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.strokeStyle = '#1aa58f';
        ctx.beginPath();
        ctx.arc(c1s.x, c1s.y, r1s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#2f7fd1';
        ctx.beginPath();
        ctx.arc(c2s.x, c2s.y, r2s, 0, Math.PI * 2);
        ctx.stroke();

        const sectionFill = (key, color) => {
            if (hoverVennSection !== key) return;
            ctx.save();
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = color;
            if (key === 'left') {
                const s = toScreen(c1.x, c1.y);
                ctx.beginPath();
                ctx.arc(s.x, s.y, c1.r * scale, 0, Math.PI * 2);
                ctx.fill();
            } else if (key === 'right') {
                const s = toScreen(c2.x, c2.y);
                ctx.beginPath();
                ctx.arc(s.x, s.y, c2.r * scale, 0, Math.PI * 2);
                ctx.fill();
            } else if (key === 'both') {
                const clipPath = new Path2D();
                clipPath.arc(c1s.x, c1s.y, c1.r * scale, 0, Math.PI * 2);
                ctx.save();
                ctx.clip(clipPath);
                ctx.beginPath();
                ctx.arc(c2s.x, c2s.y, c2.r * scale, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();
        };
        sectionFill('left', '#66efe1');
        sectionFill('right', '#76c6ff');
        sectionFill('both', '#58e6ff');

        const options = new Map(getVennCollectionOptions().map(o => [o.value, o.label.replace(/\s*\(\d+\)$/, '')]));
        const labelA = options.get(vennCollectionA) || 'Collection A';
        const labelB = options.get(vennCollectionB) || 'Collection B';

        const hasSelection = vennSelectedNodes.size > 0;
        const nowMs = Date.now();
        const currentNodeColorMode = document.getElementById('colorMode')?.value || 'layer';
        vennNodes.forEach(n => {
            const node = nodeMap.get(n.id);
            if (!node) return;
            const screen = toScreen(n.x, n.y);
            const radius = Math.max(1.2, (node.r || n.r || 4) * scale);
            const isHover = hoverVennNodeId === n.id;
            const isSelected = vennSelectedNodes.has(n.id);

            let alpha = 1;
            if (hasSelection && !isSelected) alpha = 0.08;
            ctx.globalAlpha = alpha;

            const nodeColor = currentNodeColorMode === 'collection'
                ? getCollectionColorForNode(node.id, nowMs)
                : (currentNodeColorMode === 'complex_pdbs' ? getComplexPdbColorForNode(node.id, nowMs) : (node.col || '#4caf50'));

            ctx.beginPath();
            ctx.arc(screen.x, screen.y, isHover ? radius * 1.06 : radius, 0, Math.PI * 2);
            ctx.fillStyle = nodeColor;
            ctx.fill();
            ctx.strokeStyle = d3.color(nodeColor).brighter(1).toString();
            ctx.lineWidth = isHover ? Math.max(1.6, 1.6 * scale) : Math.max(1, scale);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;

        if (nodeLabelToggle === 'show') {
            const zoomStart = 2.35;
            const zoomEnd = 3.0;
            const zoomAlpha = vennTransform.k <= zoomStart ? 0 : vennTransform.k >= zoomEnd ? 1 : (vennTransform.k - zoomStart) / (zoomEnd - zoomStart);
            if (zoomAlpha > 0) {
                ctx.save();
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#1a1a1a';
                ctx.shadowBlur = 8;
                vennNodes.forEach(n => {
                    const node = nodeMap.get(n.id);
                    if (!node) return;
                    const label = getNodeLabelText(node);
                    if (!label) return;
                    const s = toScreen(n.x, n.y);
                    const nodeAlpha = hasSelection && !vennSelectedNodes.has(n.id) ? 0.08 : 1;
                    ctx.globalAlpha = nodeAlpha * zoomAlpha;
                    ctx.fillText(label, s.x, s.y);
                });
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
                ctx.restore();
            }
        }

        const drawShadowText = (text, x, y, font, fill = '#fff') => {
            ctx.save();
            ctx.font = font;
            ctx.fillStyle = fill;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
            ctx.fillText(text, x, y);
            ctx.restore();
        };

        drawShadowText(labelA, c1s.x, c1s.y - r1s - 18, `bold ${Math.max(18, 24 * scale)}px Arial`);
        drawShadowText(labelB, c2s.x, c2s.y - r2s - 18, `bold ${Math.max(18, 24 * scale)}px Arial`);
        drawShadowText(String(leftOnly.length), c1s.x - r1s * 0.38, c1s.y, `bold ${Math.max(16, 20 * scale)}px Arial`);
        drawShadowText(String(nBoth), (c1s.x + c2s.x) / 2, c1s.y, `bold ${Math.max(16, 20 * scale)}px Arial`);
        drawShadowText(String(rightOnly.length), c2s.x + r2s * 0.38, c2s.y, `bold ${Math.max(16, 20 * scale)}px Arial`);
        drawShadowText('A only', c1s.x - r1s * 0.38, c1s.y + Math.max(16, 20 * scale), `${Math.max(11, 12 * scale)}px Arial`, '#e8e8e8');
        drawShadowText('A and B', (c1s.x + c2s.x) / 2, c1s.y + Math.max(16, 20 * scale), `${Math.max(11, 12 * scale)}px Arial`, '#e8e8e8');
        drawShadowText('B only', c2s.x + r2s * 0.38, c2s.y + Math.max(16, 20 * scale), `${Math.max(11, 12 * scale)}px Arial`, '#e8e8e8');

        const leftNodeIds = new Set(leftOnly);
        const bothNodeIds = new Set(both);
        const rightNodeIds = new Set(rightOnly);
        window.vennDiagramState = {
            circles: { c1, c2 },
            nodes: vennNodes.map(n => {
                const s = toScreen(n.x, n.y);
                const node = nodeMap.get(n.id);
                const radius = Math.max(1.2, ((node?.r || n.r || 4) * scale));
                return { id: n.id, x: s.x, y: s.y, r: radius };
            }),
            nodeBasePos,
            nodeSets: {
                left: leftNodeIds,
                both: bothNodeIds,
                right: rightNodeIds
            },
            classify: (x, y) => {
                const wx = vennTransform.invertX(x);
                const wy = vennTransform.invertY(y);
                const l = inLeft(wx, wy);
                const r = inRight(wx, wy);
                if (l && r) return 'both';
                if (l) return 'left';
                if (r) return 'right';
                return null;
            }
        };

        if (isLassoMode && lassoPoints.length > 1) {
            ctx.beginPath();
            const p0 = toScreen(lassoPoints[0][0], lassoPoints[0][1]);
            ctx.moveTo(p0.x, p0.y);
            lassoPoints.forEach(p => {
                const s = toScreen(p[0], p[1]);
                ctx.lineTo(s.x, s.y);
            });
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255, 152, 0, 0.18)';
            ctx.fill();
        }

        if (isBrushMode) {
            if (brushPoints.length > 1) {
                ctx.beginPath();
                const p0 = toScreen(brushPoints[0][0], brushPoints[0][1]);
                ctx.moveTo(p0.x, p0.y);
                brushPoints.forEach(p => {
                    const s = toScreen(p[0], p[1]);
                    ctx.lineTo(s.x, s.y);
                });
                ctx.strokeStyle = 'rgba(255, 152, 0, 0.25)';
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.lineWidth = brushRadius * scale * 2;
                ctx.stroke();
            }
            const s = toScreen(currentMousePos[0], currentMousePos[1]);
            ctx.beginPath();
            ctx.arc(s.x, s.y, brushRadius * scale, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 152, 0, 0.07)';
            ctx.fill();
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        updateVennControls();
    }

    function drawScatterPlotView() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const margins = { left: 300, right: 220, top: 145, bottom: 220 };
        const availableW = Math.max(220, canvas.width - margins.left - margins.right);
        const availableH = Math.max(160, canvas.height - margins.top - margins.bottom);
        const targetW = Math.max(220, availableW * 0.82);
        const targetH = Math.max(160, availableH * 0.8);
        const plot = {
            x: margins.left + (availableW - targetW) / 2,
            y: margins.top + (availableH - targetH) / 2,
            w: targetW,
            h: targetH
        };

        const controlLayout = {
            controlX: canvas.width / 2,
            controlY: Math.max(40, plot.y + plot.h + 92) 
        };
        updateScatterControls(controlLayout);

        const xScale = d3.scaleLinear().range([plot.x, plot.x + plot.w]);
        const yScale = d3.scaleLinear().range([plot.y + plot.h, plot.y]);

        // --- 1. RESOLVE SOURCES ONCE (PRE-LOOP) ---
        const currentSizeSource = (scatterXVariable === 'size' || scatterYVariable === 'size') 
            ? resolveProteinSizeSource(nodes) 
            : null;

        const currentAnnotationSource = (scatterXVariable === 'annotation' || scatterYVariable === 'annotation')
            ? resolveBuiltInColorSource('annotation', nodes)
            : null;

        // --- 2. OPTIMIZED MAPPING ---
        let filteredCount = 0;
        console.time("ScatterDataMapping");

        let pointData = scatterPointsLoadingInProgress && scatterPointsToRender.length > 0
            ? scatterPointsToRender
            : nodes.map(node => {
                // Pass the resolved sources into the function
                const xv = getScatterValueForNode(node, scatterXVariable, currentSizeSource, currentAnnotationSource);
                const yv = getScatterValueForNode(node, scatterYVariable, currentSizeSource, currentAnnotationSource);
                
                if (!Number.isFinite(xv) || !Number.isFinite(yv)) {
                    filteredCount++;
                    return null;
                }
                return { node, xVal: xv, yVal: yv };
            }).filter(Boolean);

        console.timeEnd("ScatterDataMapping");

        if (filteredCount > 0) {
            console.log(`Filtered out ${filteredCount} nodes due to missing or invalid numeric data.`);
        }
        if (pointData.length === 0) {
            ctx.fillStyle = '#b0b0b0';
            ctx.font = '18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No numeric data for selected scatter variables', canvas.width / 2, canvas.height / 2);
            scatterLayoutState = null;
            return;
        }

        console.time("ScatterExtents");
        const xExtent = d3.extent(pointData, d => d.xVal);
        const yExtent = d3.extent(pointData, d => d.yVal);
        console.timeEnd("ScatterExtents");

        const xMin = xExtent[0] === xExtent[1] ? xExtent[0] - 1 : xExtent[0];
        const xMax = xExtent[0] === xExtent[1] ? xExtent[1] + 1 : xExtent[1];
        const yMin = yExtent[0] === yExtent[1] ? yExtent[0] - 1 : yExtent[0];
        const yMax = yExtent[0] === yExtent[1] ? yExtent[1] + 1 : yExtent[1];
        xScale.domain([xMin, xMax]);
        yScale.domain([yMin, yMax]);

        const tx = (x) => scatterTransform.applyX(x);
        const ty = (y) => scatterTransform.applyY(y);
        const tk = Math.max(scatterTransform?.k || 1, 1e-6);

        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx(plot.x), ty(plot.y + plot.h));
        ctx.lineTo(tx(plot.x + plot.w), ty(plot.y + plot.h));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tx(plot.x), ty(plot.y));
        ctx.lineTo(tx(plot.x), ty(plot.y + plot.h));
        ctx.stroke();

        ctx.fillStyle = '#cfcfcf';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        const xTicks = xScale.ticks(8);
        xTicks.forEach(t => {
            const x = tx(xScale(t));
            const axisY = ty(plot.y + plot.h);
            ctx.beginPath();
            ctx.moveTo(x, axisY);
            ctx.lineTo(x, axisY + 6);
            ctx.strokeStyle = '#666';
            ctx.stroke();
            ctx.fillText(Number.isInteger(t) ? String(t) : t.toFixed(2), x, axisY + 20);
        });

        ctx.textAlign = 'right';
        const yTicks = yScale.ticks(7);
        yTicks.forEach(t => {
            const y = ty(yScale(t));
            const axisX = tx(plot.x);
            ctx.beginPath();
            ctx.moveTo(axisX - 6, y);
            ctx.lineTo(axisX, y);
            ctx.strokeStyle = '#666';
            ctx.stroke();
            ctx.fillText(Number.isInteger(t) ? String(t) : t.toFixed(2), axisX - 10, y + 4);
        });

        const optionsMap = new Map(getScatterVariableOptions().map(o => [o.value, o.label]));
        const xLabel = optionsMap.get(scatterXVariable) || scatterXVariable;
        const yLabel = optionsMap.get(scatterYVariable) || scatterYVariable;

        // Calculate correlation coefficient
        let correlationCoeff = 0;
        if (pointData.length > 1) {
            const xValues = pointData.map(d => d.xVal);
            const yValues = pointData.map(d => d.yVal);
            const n = xValues.length;
            const meanX = xValues.reduce((a, b) => a + b, 0) / n;
            const meanY = yValues.reduce((a, b) => a + b, 0) / n;
            let numerator = 0, denomX = 0, denomY = 0;
            for (let i = 0; i < n; i++) {
                const dx = xValues[i] - meanX;
                const dy = yValues[i] - meanY;
                numerator += dx * dy;
                denomX += dx * dx;
                denomY += dy * dy;
            }
            const denom = Math.sqrt(denomX * denomY);
            correlationCoeff = denom > 0 ? numerator / denom : 0;
        }

        // Draw main heading
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`Scatter plot of ${xLabel} vs ${yLabel}`, canvas.width / 2, 40);
        ctx.font = '14px Arial';
        ctx.fillText(`Correlation coefficient (r): ${correlationCoeff.toFixed(3)}`, canvas.width / 2, 70);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';

        // Draw axis labels
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(xLabel, tx(plot.x + plot.w / 2), ty(plot.y + plot.h) + 48);
        ctx.save();
        ctx.translate(tx(plot.x) - 56, ty(plot.y + plot.h / 2));
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();

        const hasSelection = selectedNodes.size > 0;
        const nowMs = Date.now();
        const currentNodeColorMode = document.getElementById('colorMode')?.value || 'layer';
        const plottedPoints = [];

        // Render only loaded points if async loading is in progress
        const pointsToRender = scatterPointsLoadingInProgress && scatterPointsToRender.length > 0
            ? scatterPointsToRender.slice(0, scatterPointsRendered)
            : pointData;

        pointsToRender.forEach(d => {
            const xBase = xScale(d.xVal);
            const yBase = yScale(d.yVal);
            const x = tx(xBase);
            const y = ty(yBase);
            const node = d.node;
            const isSelected = selectedNodes.has(node.id);
            const isDim = hasSelection && !isSelected;

            const nodeColor = currentNodeColorMode === 'collection'
                ? getCollectionColorForNode(node.id, nowMs)
                : (currentNodeColorMode === 'complex_pdbs' ? getComplexPdbColorForNode(node.id, nowMs) : (node.col || '#4caf50'));

            const rBase = Math.max(1.5, node.r || 4);
            const r = Math.max(1.25, rBase * tk);
            ctx.globalAlpha = isDim ? 0.08 : 1;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = nodeColor;
            ctx.fill();
            ctx.strokeStyle = d3.color(nodeColor).brighter(1).toString();
            ctx.lineWidth = 1;
            ctx.stroke();

            plottedPoints.push({ id: node.id, x: xBase, y: yBase, r: rBase, node });
        });
        ctx.globalAlpha = 1;

        // Show "Loading..." text if still loading
        if (scatterPointsLoadingInProgress && scatterPointsToRender.length > 0) {
            const percentLoaded = Math.round((scatterPointsRendered / scatterPointsToRender.length) * 100);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Loading… ${percentLoaded}%`, canvas.width / 2, canvas.height / 2 - 20);
            ctx.font = '14px Arial';
            ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
            ctx.fillText(`${scatterPointsRendered} / ${scatterPointsToRender.length} points`, canvas.width / 2, canvas.height / 2 + 20);
        }

        if (isLassoMode && lassoPoints.length > 1) {
            ctx.beginPath();
            ctx.moveTo(tx(lassoPoints[0][0]), ty(lassoPoints[0][1]));
            lassoPoints.forEach(p => {
                ctx.lineTo(tx(p[0]), ty(p[1]));
            });
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255, 152, 0, 0.18)';
            ctx.fill();
        }

        if (isBrushMode) {
            if (brushPoints.length > 1) {
                ctx.beginPath();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.moveTo(tx(brushPoints[0][0]), ty(brushPoints[0][1]));
                brushPoints.forEach(p => {
                    ctx.lineTo(tx(p[0]), ty(p[1]));
                });
                ctx.strokeStyle = 'rgba(255, 152, 0, 0.25)';
                ctx.lineWidth = brushRadius * tk * 2;
                ctx.stroke();
            }

            if (currentMousePos) {
                ctx.beginPath();
                ctx.arc(tx(currentMousePos[0]), ty(currentMousePos[1]), brushRadius * tk, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255, 152, 0, 0.07)';
                ctx.fill();
                ctx.strokeStyle = '#ff9800';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        scatterLayoutState = { plot, points: plottedPoints };
    }

    function draw() {
        //console.log("function draw()");
        updatePhysicsRuntimeLabel();
        // Handle special chart views
        if (currentViewId === 'pie_chart') {
            drawPieChartView();
            return;
        } else if (currentViewId === 'histogram') {
            drawHistogramView();
            return;
        } else if (currentViewId === 'Venn Diagram') {
            drawVennDiagramView();
            return;
        } else if (currentViewId === 'Scatter Plot') {
            drawScatterPlotView();
            return;
        } else if (currentViewId === 'Mind Map') {
            drawMindMapView();
            return;
        } else if (currentViewId === 'Embeddings') {
            refreshEmbeddingsView();
            drawEmbeddingsSelectionOverlay();
            return;
        }

        if (currentViewId === 'selected' && (activeSubData?.nodes?.length || 0) === 0) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ccc';
            ctx.font = '28px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('No Nodes Selected', canvas.width / 2, canvas.height / 2);
            ctx.textBaseline = 'alphabetic';
            return;
        }

        const useGpuBasePhysics = currentViewId === 'base' && gpuState.ready && gpuState.device && gpuState.context;

        // Self-heal: if base view is GPU-eligible but loop is not running, restart it.
        if (useGpuBasePhysics && physicsEnabled && !gpuAnimationRunning) {
            ensureGpuAnimationLoop();
        }

        let drawNodes = nodes, drawLinks = links;
        if (currentViewId !== 'base' && activeSubData) { drawNodes = activeSubData.nodes; drawLinks = activeSubData.links; }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = document.getElementById('bgColor')?.value || '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const bgNodeColorMode = document.getElementById('colorMode')?.value || 'layer';
        const bgNowMs = Date.now();
        if (backgroundMode === 'voronoi') {
            const voronoiLayer = ensureVoronoiBackground(drawNodes, bgNodeColorMode, bgNowMs);
            if (voronoiLayer) {
                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, bgVoronoiOpacity));
                ctx.filter = bgVoronoiBlur > 0 ? `blur(${bgVoronoiBlur}px)` : 'none';
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(voronoiLayer, 0, 0, canvas.width, canvas.height);
                ctx.filter = 'none';
                ctx.globalAlpha = 1;
                ctx.restore();
            }
        }

        ctx.save();
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);

        const effectiveSelection = getEffectiveSelectedNodesSet();

        const linkMode = document.getElementById('linkMode').value, linkBaseCol = document.getElementById('linkColor').value;
        const visibilityMode = document.getElementById('linkVisibilityMode').value, glowVal = +document.getElementById('glowSlider').value, threshold = +document.getElementById('thresholdInput').value;
        const linkWidthMultiplier = +document.getElementById('linkWidthSlider')?.value || 1;
        const isSearching = effectiveSelection.size > 0;
        if (linkOpacity > 0) {
            let activeLinks = drawLinks.filter(l => l.value >= threshold);
            const linkLabelsToDraw = [];
            if (isSearching && visibilityMode !== 'all') {
                if (visibilityMode === 'from_selected') activeLinks = activeLinks.filter(l => {
                    const edgeKey = getUndirectedEdgeKey(l.source.id, l.target.id);
                    return (effectiveSelection.has(l.source.id) || effectiveSelection.has(l.target.id)) || pathEdges.has(edgeKey);
                });
                else if (visibilityMode === 'between_selected') activeLinks = activeLinks.filter(l => {
                    const edgeKey = getUndirectedEdgeKey(l.source.id, l.target.id);
                    return (effectiveSelection.has(l.source.id) && effectiveSelection.has(l.target.id)) || pathEdges.has(edgeKey);
                });
            }

            activeLinks.forEach(l => {
                const isPath = pathEdges.has(getUndirectedEdgeKey(l.source.id, l.target.id));
                const isHigh = isSearching && (effectiveSelection.has(l.source.id) || effectiveSelection.has(l.target.id));
                let linkStrokeColor = "#ff4444";
                let linkStrokeWidth = 4;
                ctx.beginPath(); ctx.moveTo(l.source.x, l.source.y); ctx.lineTo(l.target.x, l.target.y);
                if (isPath) { ctx.globalAlpha = 1.0; linkStrokeColor = "#ff4444"; linkStrokeWidth = 4; }
                else {
                    let alpha = (isHigh || visibilityMode === 'all') ? linkOpacity : (isSearching ? linkOpacity * 0.05 : linkOpacity);
                    if (isGeneGeneLink(l)) alpha *= geneLinkOpacity;
                    ctx.globalAlpha = alpha;
                    if (linkMode === 'score') { linkStrokeColor = getScoreLinkGreyColor(l.value); linkStrokeWidth = (Math.sqrt(l.value) / 8) * (isHigh ? 2 : 1); }
                    else { linkStrokeColor = d3.color(linkBaseCol).brighter(1.5); linkStrokeWidth = 1 * (isHigh ? 2 : 1); }
                }
                ctx.strokeStyle = linkStrokeColor;
                const scaledLinkWidth = linkStrokeWidth * linkWidthMultiplier;
                ctx.lineWidth = scaledLinkWidth;
                ctx.stroke();
                drawLinkDirectionArrow(ctx, l.source, l.target, linkStrokeColor, scaledLinkWidth);

                if (linkLabelToggle === 'show' && ctx.globalAlpha > 0) {
                    const label = getLinkLabelForLink(l);
                    if (label) {
                        linkLabelsToDraw.push({
                            x: (l.source.x + l.target.x) * 0.5,
                            y: (l.source.y + l.target.y) * 0.5,
                            text: label,
                            alpha: ctx.globalAlpha
                        });
                    }
                }
            });

            if (linkLabelsToDraw.length) {
                const zoomStart = 1.0;
                const zoomEnd = 1.3;
                const zoomAlpha = transform.k <= zoomStart ? 0 : transform.k >= zoomEnd ? 1 : (transform.k - zoomStart) / (zoomEnd - zoomStart);
                if (zoomAlpha > 0) {
                    const zoomKLabels = Math.max(transform.k || 1, 1e-6);
                    ctx.save();
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = `${Math.max(7, 11 / zoomKLabels)}px Arial`;
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
                    ctx.shadowBlur = 4 / zoomKLabels;
                    linkLabelsToDraw.forEach(item => {
                        ctx.globalAlpha = Math.min(1, Math.max(0.2, item.alpha)) * zoomAlpha;
                        ctx.fillText(item.text, item.x, item.y);
                    });
                    ctx.globalAlpha = 1;
                    ctx.restore();
                }
            }
        }

        const hoverRadiusPx = 150;
        const zoomK = Math.max(transform.k || 1, 1e-6);
        const hoverRadiusWorld = hoverRadiusPx / zoomK;
        const hoverRadiusWorldSq = hoverRadiusWorld * hoverRadiusWorld;
        const baseDimAlpha = 0.08;

        const currentNodeColorMode = document.getElementById('colorMode')?.value || 'layer';
        const nowMs = Date.now();
        drawNodes.forEach(n => {
            const isPath = pathNodes.has(n.id), isHigh = isSearching && effectiveSelection.has(n.id);
            let nodeAlpha = 1;
            if (isHigh || isPath) {
                nodeAlpha = 1;
            } else if (isSearching) {
                const dx = n.x - currentMousePos[0];
                const dy = n.y - currentMousePos[1];
                const distSq = dx * dx + dy * dy;
                if (distSq >= hoverRadiusWorldSq) {
                    nodeAlpha = baseDimAlpha;
                } else {
                    const proximity = 1 - (distSq / hoverRadiusWorldSq);
                    const proximityBonus = 0.45 * proximity * proximity;
                    nodeAlpha = Math.min(0.75, baseDimAlpha + proximityBonus);
                }
            }
            n.renderAlpha = nodeAlpha;
            n.gpuIsPath = isPath;
            n.gpuIsHigh = isHigh;
            if (nodeVisibilityToggle !== 'show') return;
            const nodeColor = currentNodeColorMode === 'collection'
                ? getCollectionColorForNode(n.id, nowMs)
                : (currentNodeColorMode === 'complex_pdbs' ? getComplexPdbColorForNode(n.id, nowMs) : (n.col || "#4caf50"));
            ctx.globalAlpha = nodeAlpha;
            ctx.beginPath(); ctx.arc(n.x, n.y, n.r || 5, 0, 2 * Math.PI); ctx.fillStyle = nodeColor;
            if (glowVal > 0 && nodeAlpha > 0.3 && (!isSearching || isHigh || isPath)) { ctx.shadowBlur = glowVal * 0.4; ctx.shadowColor = d3.color(nodeColor).brighter(glowVal / 250); } else ctx.shadowBlur = 0;
            ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = isPath ? "#ff4444" : (d3.color(nodeColor).brighter(1)); ctx.lineWidth = isPath ? 4 : 1; ctx.stroke();
            if (isEmbeddingReferenceNode(n.id)) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, (n.r || 5) + 4, 0, 2 * Math.PI);
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        // Reset opacity for tools
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        // Draw guide circles
        if (guideCircleOverlays && guideCircleOverlays.size > 0) {
            guideCircleOverlays.forEach((circleData, nodeId) => {
                const node = drawNodes.find(n => n.id === nodeId);
                if (!node) return;
                
                const radius = (node.r || 5);
                const circleRadius = radius + 8;
                const color = circleData.color || '#FFD700';
                
                ctx.beginPath();
                ctx.arc(node.x, node.y, circleRadius, 0, 2 * Math.PI);
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.stroke();
            });
        }

        if (nodeVisibilityToggle === 'show' && nodeLabelToggle === 'show') {
            const screenBg = document.getElementById('bgColor')?.value || '#1a1a1a';
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = screenBg;
            ctx.shadowBlur = 8;

            const zoomStart = 1.0;
            const zoomEnd = 1.3;
            const zoomAlpha = transform.k <= zoomStart ? 0 : transform.k >= zoomEnd ? 1 : (transform.k - zoomStart) / (zoomEnd - zoomStart);

            if (zoomAlpha > 0) {
                drawNodes.forEach(n => {
                    const label = getNodeLabelText(n);
                    if (!label) return;
                    const [x, y] = transform.apply([n.x, n.y]);
                    ctx.globalAlpha = (n.renderAlpha ?? 1) * zoomAlpha;
                    ctx.fillText(label, x, y);
                });
            }

            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        if (lassoPoints.length > 1) {
            ctx.beginPath(); ctx.moveTo(lassoPoints[0][0], lassoPoints[0][1]); lassoPoints.forEach(p => ctx.lineTo(p[0], p[1]));
            ctx.strokeStyle = "#ff9800"; ctx.lineWidth = 4 / transform.k; ctx.setLineDash([5 / transform.k, 5 / transform.k]); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "rgba(255, 152, 0, 0.25)"; ctx.fill();
        }
        if (isBrushMode) {
            if (brushPoints.length > 1) { ctx.beginPath(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.moveTo(brushPoints[0][0], brushPoints[0][1]); brushPoints.forEach(p => ctx.lineTo(p[0], p[1])); ctx.strokeStyle = "rgba(255, 152, 0, 0.25)"; ctx.lineWidth = brushRadius * 2; ctx.stroke(); }
            ctx.beginPath(); ctx.arc(currentMousePos[0], currentMousePos[1], brushRadius, 0, 2 * Math.PI); ctx.fillStyle = "rgba(255, 152, 0, 0.05)"; ctx.fill(); ctx.strokeStyle = "#ff9800"; ctx.lineWidth = 2 / transform.k; ctx.setLineDash([4 / transform.k, 4 / transform.k]); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.restore();

        if (isFrameMode) {
            drawFrameOverlay();
        }

        if (hoveredNode) {
            if (isNodeHoverTooltipVisible()) {
                showNodeHoverTooltip(hoveredNode);
            }
        } else if (!isTooltipHovered) {
            hideNodeHoverTooltip();
        }

        checkOffscreenNodes();
    }

    function checkOffscreenNodes() {
        //console.log("function checkOffscreenNodes()");
        const indicator = document.getElementById('offscreen-indicator');
        if (!indicator) return;

        const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
        if (activeNodes.length === 0) {
            indicator.style.display = 'none';
            return;
        }

        // Check if ANY node is visible on screen
        const pad = 40;
        const anyOnScreen = activeNodes.some(n => {
            const screenPt = transform.apply([n.x, n.y]);
            return screenPt[0] >= pad && screenPt[0] <= window.innerWidth - pad &&
                screenPt[1] >= pad && screenPt[1] <= window.innerHeight - pad;
        });

        if (!anyOnScreen) {
            // Point toward the average position of all nodes
            const avgX = activeNodes.reduce((sum, n) => sum + n.x, 0) / activeNodes.length;
            const avgY = activeNodes.reduce((sum, n) => sum + n.y, 0) / activeNodes.length;
            const screenPt = transform.apply([avgX, avgY]);
            const dx = screenPt[0] - window.innerWidth / 2;
            const dy = screenPt[1] - window.innerHeight / 2;
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            indicator.style.display = 'block';
            if (dx < 0) {
                indicator.innerHTML = `<span style="display:inline-block; transform:rotate(${angle}deg); font-size:32px;">➔</span> Nodes this way`;
            } else {
                indicator.innerHTML = `Nodes this way <span style="display:inline-block; transform:rotate(${angle}deg); font-size:32px;">➔</span>`;
            }
        } else {
            indicator.style.display = 'none';
        }
    }

    // This function determines if the mouse is hovering over the export frame and returns which part (corner or move area) is being hovered. 
    function getFrameHoverState(pt) {
        console.log("function getFrameHoverState(pt)");
        if (!exportFrame) return null;
        
        const x = exportFrame.x, y = exportFrame.y;
        const w = exportFrame.w, h = exportFrame.h;
        const margin = 12 / transform.k; // Hit area adjusted for zoom

        // Define corner points
        const corners = {
            nw: [x, y],
            ne: [x + w, y],
            sw: [x, y + h],
            se: [x + w, y + h]
        };

        // Check corners first
        for (const [key, pos] of Object.entries(corners)) {
            if (Math.abs(pt[0] - pos[0]) < margin && Math.abs(pt[1] - pos[1]) < margin) {
                return key;
            }
        }

        // Check inside (move)
        const minX = Math.min(x, x + w), maxX = Math.max(x, x + w);
        const minY = Math.min(y, y + h), maxY = Math.max(y, y + h);
        if (pt[0] > minX && pt[0] < maxX && pt[1] > minY && pt[1] < maxY) return 'move';
        
        return null;
    }

    // This function exports the current canvas view as a PNG or SVG file, applying current visual settings and filters. It handles large canvases by using an offscreen canvas for PNG export and ensures that only visible nodes/links are included based on the current threshold and visibility settings.
    async function exportCanvas(type) {
        console.log("async function exportCanvas(type)");
        const threshold = +document.getElementById('thresholdInput').value;
        const linkMode = document.getElementById('linkMode').value;
        const visibilityMode = document.getElementById('linkVisibilityMode').value;
        const linkWidthMultiplier = +document.getElementById('linkWidthSlider')?.value || 1;
        const isSearching = selectedNodes.size > 0;
        let drawNodes = nodes, drawLinks = links;
        if (currentViewId !== 'base' && activeSubData) { drawNodes = activeSubData.nodes; drawLinks = activeSubData.links; }

        if (type === 'png') {
            const offscreen = document.createElement('canvas'), size = 8000; 
            offscreen.width = size; offscreen.height = size; 
            const octx = offscreen.getContext('2d');
            
            octx.fillStyle = document.getElementById('bgColor').value; 
            octx.fillRect(0, 0, size, size); 

            const b = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
            drawNodes.forEach(n => { 
                b.x1 = Math.min(b.x1, n.x); b.y1 = Math.min(b.y1, n.y); 
                b.x2 = Math.max(b.x2, n.x); b.y2 = Math.max(b.y2, n.y); 
            });
            const w = b.x2 - b.x1, h = b.y2 - b.y1, scale = (size * 0.95) / Math.max(w, h);
            octx.translate(size / 2, size / 2); 
            octx.scale(scale, scale); 
            octx.translate(-(b.x1 + w / 2), -(b.y1 + h / 2));

            let activeLinks = drawLinks.filter(l => l.value >= threshold);
            if (isSearching && visibilityMode !== 'all' && currentViewId === 'base') {
                if (visibilityMode === 'from_selected') activeLinks = activeLinks.filter(l => {
                    const edgeKey = getUndirectedEdgeKey(l.source.id, l.target.id);
                    return (selectedNodes.has(l.source.id) || selectedNodes.has(l.target.id)) || pathEdges.has(edgeKey);
                });
                else if (visibilityMode === 'between_selected') activeLinks = activeLinks.filter(l => {
                    const edgeKey = getUndirectedEdgeKey(l.source.id, l.target.id);
                    return (selectedNodes.has(l.source.id) && selectedNodes.has(l.target.id)) || pathEdges.has(edgeKey);
                });
            }

            activeLinks.forEach(l => {
                const isPath = pathEdges.has(getUndirectedEdgeKey(l.source.id, l.target.id));
                const isHigh = isSearching && (selectedNodes.has(l.source.id) || selectedNodes.has(l.target.id));
                let linkStrokeColor = "#ff4444";
                let linkStrokeWidth = 4;
                octx.beginPath(); octx.moveTo(l.source.x, l.source.y); octx.lineTo(l.target.x, l.target.y);
                if (isPath) { octx.globalAlpha = 1.0; linkStrokeColor = "#ff4444"; linkStrokeWidth = 4; } else {
                    let alpha = (isHigh || visibilityMode === 'all') ? linkOpacity : (isSearching ? linkOpacity * 0.05 : linkOpacity);
                    octx.globalAlpha = alpha;
                    if (linkMode === 'score') { linkStrokeColor = getScoreLinkGreyColor(l.value); linkStrokeWidth = (Math.sqrt(l.value) / 8) * (isHigh ? 2 : 1); } 
                    else { linkStrokeColor = d3.color(document.getElementById('linkColor').value).brighter(1.5); linkStrokeWidth = 1 * (isHigh ? 2 : 1); }
                }
                octx.strokeStyle = linkStrokeColor;
                const scaledLinkWidth = linkStrokeWidth * linkWidthMultiplier;
                octx.lineWidth = scaledLinkWidth;
                octx.stroke();
                drawLinkDirectionArrow(octx, l.source, l.target, linkStrokeColor, scaledLinkWidth);
            });

            if (nodeVisibilityToggle === 'show') {
                const currentNodeColorMode = document.getElementById('colorMode')?.value || 'layer';
                const nowMs = Date.now();
                drawNodes.forEach(n => {
                    const isPath = pathNodes.has(n.id), isHigh = isSearching && selectedNodes.has(n.id);
                    const nodeColor = currentNodeColorMode === 'collection'
                        ? getCollectionColorForNode(n.id, nowMs)
                        : (currentNodeColorMode === 'complex_pdbs' ? getComplexPdbColorForNode(n.id, nowMs) : n.col);
                    octx.globalAlpha = (isHigh || isPath) ? 1 : (isSearching ? 0.08 : 1);
                    octx.beginPath(); octx.arc(n.x, n.y, n.r, 0, 2 * Math.PI); octx.fillStyle = nodeColor; octx.fill();
                    octx.strokeStyle = isPath ? "#ff4444" : (d3.color(nodeColor).brighter(1)); octx.lineWidth = isPath ? 4 : 1; octx.stroke();
                    if (isEmbeddingReferenceNode(n.id)) {
                        octx.beginPath();
                        octx.arc(n.x, n.y, (n.r || 5) + 4, 0, 2 * Math.PI);
                        octx.strokeStyle = '#ff0000';
                        octx.lineWidth = 2;
                        octx.stroke();
                    }
                });

                const labelZoomAlpha = getCurrentNodeLabelZoomAlpha();

            drawStringScapeLogoOnCanvas(octx, size, size);
                if (labelZoomAlpha > 0) {
                    const screenBg = document.getElementById('bgColor')?.value || '#1a1a1a';
                    octx.save();
                    octx.font = 'bold 5px Arial';
                    octx.textAlign = 'center';
                    octx.textBaseline = 'middle';
                    octx.fillStyle = '#ffffff';
                    octx.shadowColor = screenBg;
                    octx.shadowBlur = 8;
                    drawNodes.forEach(n => {
                        const label = getNodeLabelText(n);
                        if (!label) return;
                        const isPath = pathNodes.has(n.id);
                        const isHigh = isSearching && selectedNodes.has(n.id);
                        const nodeAlpha = (isHigh || isPath) ? 1 : (isSearching ? 0.08 : 1);
                        octx.globalAlpha = nodeAlpha * labelZoomAlpha;
                        octx.fillText(label, n.x, n.y);
                    });
                    octx.globalAlpha = 1;
                    octx.shadowBlur = 0;
                    octx.restore();
                }
            }

            const link = document.createElement('a'); 
            link.download = `network_export_${isSearching ? 'selection' : 'full'}.png`; 
            link.href = offscreen.toDataURL('image/png', 1.0); 
            link.click();
        } else {
            let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" style="background:${document.getElementById('bgColor').value}">`;
            drawLinks.forEach(l => { if (l.value >= threshold) svg += `<line x1="${l.source.x}" y1="${l.source.y}" x2="${l.target.x}" y2="${l.target.y}" stroke="white" stroke-opacity="0.2" />`; });
            if (nodeVisibilityToggle === 'show') {
                const currentNodeColorMode = document.getElementById('colorMode')?.value || 'layer';
                const nowMs = Date.now();
                drawNodes.forEach(n => {
                    const nodeColor = currentNodeColorMode === 'collection'
                        ? getCollectionColorForNode(n.id, nowMs)
                        : (currentNodeColorMode === 'complex_pdbs' ? getComplexPdbColorForNode(n.id, nowMs) : n.col);
                    svg += `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${nodeColor}" />`;
                    if (isEmbeddingReferenceNode(n.id)) {
                        svg += `<circle cx="${n.x}" cy="${n.y}" r="${(n.r || 5) + 4}" fill="none" stroke="#ff0000" stroke-width="2" />`;
                    }
                });
            }
            svg += getStringScapeLogoSvg(1000, 1000);
            svg += `</svg>`; const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'})); link.download = 'network.svg'; link.click();
        }
    }

    // This function takes an array of target nodes and updates the current selection state. It also manages the selection history for undo functionality, updates the info box with details about the selected nodes, and shows buttons for creating or modifying collections based on the selection. The function can be triggered by various user actions, such as clicking on nodes, using the legend, or performing a search.
    function selectNodes(targets, isLegendClick = false, query = "", searchSummary = null, preserveProteinInfoHistory = false) {
        console.log(`function selectNodes(targets: [not displaying to save console space], isLegendClick: ${isLegendClick}, query: ${query})`);
        const nextSelection = new Set(targets.map(n => n.id));
        const useDraft = currentViewId === 'selected';

        if (useDraft) {
            selectedNodesDraft = new Set(nextSelection);
        } else {
            selectedNodes = new Set(nextSelection);
        }

        const effectiveSelection = useDraft ? selectedNodesDraft : selectedNodes;
        selectionHistory.push({ ids: new Set(effectiveSelection), query: query, summary: searchSummary });
        if (selectionHistory.length > 15) selectionHistory.shift();

        if (!preserveProteinInfoHistory) {
            clearProteinInfoHistory();
        }

        syncShortestPathVisualization();
        if (!effectiveSelection.size && subtractModeLocked && !subtractKeyHeld) {
            subtractModeLocked = false;
            refreshSelectionModeState();
        }
        refreshInfoBoxFromSelection(query, searchSummary);
        aiSyncSelectedNodesAttachment();
        if (isLegendClick) return;
        
        const btnCont = d3.select("#coll-add-btn-container").html("");
        if (effectiveSelection.size > 0) {
            btnCont.append("button")
                .attr("class", "action-btn")
                .style("width", "100%")
                .style("justify-content", "center")
                .text(collections.size === 0 ? "Create Collection" : "Add to Collection")
                .on("click", function() {
                d3.select(this).style("display", "none");
                const ui = btnCont.append("div").attr("id", "inline-add-ui");
                
                const hasCollections = collections.size > 0;
                const sel = ui.append("select")
                    .attr("id", "inline-coll-dropdown")
                    .style("display", hasCollections ? "block" : "none");
                    
                if (hasCollections) {
                    collections.forEach((val, name) => sel.append("option").attr("value", name).text(name));
                    sel.append("option").attr("value", "NEW").text("+ Create Collection");
                }
                sel.on("change", function() {
                    const isNew = this.value === 'NEW';
                    nameInput.style("display", isNew ? 'block' : 'none');
                    
                    if (isNew) {
                        // Use node().focus() for D3 selections to put the cursor in the box
                        setTimeout(() => nameInput.node().focus(), 10); 
                    }
                });
                const nameInput = ui.append("input")
                    .attr("type", "text")
                    .attr("placeholder", "Collection Name...")
                    .style("display", hasCollections ? "none" : "block");

                if (!hasCollections) nameInput.node().focus();

                const row = ui.append("div").attr("class", "btn-row");
                row.append("button").attr("class", "btn-secondary").text("Cancel").on("click", () => selectNodes(targets, false, query));
                row.append("button").attr("class", "btn-primary").text("Add").on("click", () => {
                    let target = hasCollections ? sel.property("value") : 'NEW';
                    if (target === 'NEW') {
                        target = nameInput.property("value").trim();
                        if (!target || collections.has(target)) return;
                        collections.set(target, { nodeIds: new Set(), nodes: [], links: [] });
                        refreshLegendIfCollectionMode();
                    }
                    effectiveSelection.forEach(id => collections.get(target).nodeIds.add(id));
                    updateViewMenu(); selectNodes(targets, false, query);
                });
            });

            if (currentViewId === 'selected' || currentViewId.startsWith('coll_')) {
                btnCont.append("button")
                    .attr("class", "action-btn")
                    .style("width", "100%")
                    .style("justify-content", "center")
                    .style("margin-top", "8px")
                    .style("background", "#666")
                    .text(currentViewId === 'selected' ? "Remove from Selected Nodes" : "Remove From Collection")
                    .on("click", () => {
                        const removeIds = new Set(effectiveSelection);

                        if (currentViewId === 'selected') {
                            const currentIds = (activeSubData?.nodes || []).map(n => n.id);
                            const remaining = currentIds.filter(id => !removeIds.has(id));
                            deselectNodes();
                            initSubNetworkView('selected', remaining);
                            draw();
                            return;
                        }

                        if (currentViewId.startsWith('coll_')) {
                            const name = currentViewId.replace('coll_', '');
                            const coll = collections.get(name);
                            if (!coll) return;
                            removeIds.forEach(id => coll.nodeIds.delete(id));
                            const remaining = Array.from(coll.nodeIds);
                            deselectNodes();
                            initSubNetworkView(currentViewId, remaining);
                            updateViewMenu();
                            draw();
                        }
                    });
            }
        }
        if (document.getElementById('colorMode').value === 'layer') updateLegend('layer', null, null, null);
        updateViewMenu();
        updateVennControls();
        updateVennControls();
    }

    // This function implements a breadth-first search to find the shortest path between two nodes in the graph, considering only edges that meet the current score threshold and exist in the node map. It returns an array of node IDs representing the path from id1 to id2, or an empty array if no path is found. The function is used as part of the shortest path visualization and analysis features in the application.
    function findShortestPath(id1, id2) {
        console.log(`function findShortestPath(id1: ${id1}, id2: ${id2})`);
        if (!id1 || !id2) return []; const queue = [[id1]], visited = new Set([id1]), threshold = +document.getElementById('thresholdInput').value;
        while (queue.length > 0) {
            const path = queue.shift(), node = path[path.length - 1]; if (node === id2) return path;
            (fullAdjacency.get(node) || []).forEach(edge => { if (edge.score >= threshold && !visited.has(edge.target) && nodeMap.has(edge.target)) { visited.add(edge.target); queue.push([...path, edge.target]); } });
        }
        return [];
    }

    function getShortestPathData(id1, id2) {
        const path = findShortestPath(id1, id2);
        if (!path.length) return { path: [], length: null };
        return { path, length: Math.max(0, path.length - 1) };
    }

    function getShortestPathSelectionIds() {
        const selection = Array.from(getEffectiveSelectedNodesSet());
        return selection.length === 2 ? selection : [];
    }

    function buildShortestPathOverlayData(id1, id2) {
        if (!id1 || !id2) return { paths: [], nodes: new Set(), edges: new Set() };

        const threshold = +document.getElementById('thresholdInput').value;
        const distances = new Map([[id1, 0]]);
        const parents = new Map();
        const queue = [id1];
        let shortestDistance = Infinity;

        while (queue.length) {
            const node = queue.shift();
            const nodeDistance = distances.get(node);
            if (nodeDistance >= shortestDistance) continue;

            (fullAdjacency.get(node) || []).forEach(edge => {
                if (edge.score < threshold || !nodeMap.has(edge.target)) return;
                const nextDistance = nodeDistance + 1;
                if (nextDistance > shortestDistance) return;

                if (!distances.has(edge.target)) {
                    distances.set(edge.target, nextDistance);
                    queue.push(edge.target);
                    parents.set(edge.target, new Set([node]));
                } else if (nextDistance < distances.get(edge.target)) {
                    distances.set(edge.target, nextDistance);
                    parents.set(edge.target, new Set([node]));
                } else if (nextDistance === distances.get(edge.target)) {
                    if (!parents.has(edge.target)) parents.set(edge.target, new Set());
                    parents.get(edge.target).add(node);
                }

                if (edge.target === id2) shortestDistance = nextDistance;
            });
        }

        if (!distances.has(id2)) return { paths: [], nodes: new Set(), edges: new Set() };

        const cache = new Map();
        function collectPaths(nodeId) {
            if (cache.has(nodeId)) return cache.get(nodeId);
            if (nodeId === id1) return [[id1]];

            const prevNodes = Array.from(parents.get(nodeId) || []);
            const paths = [];
            prevNodes.forEach(prevNode => {
                collectPaths(prevNode).forEach(path => {
                    paths.push([...path, nodeId]);
                });
            });
            cache.set(nodeId, paths);
            return paths;
        }

        const paths = collectPaths(id2).filter(path => path[0] === id1);
        const nodes = new Set();
        const edges = new Set();
        paths.forEach(path => {
            path.forEach(id => nodes.add(id));
            for (let i = 0; i < path.length - 1; i++) {
                edges.add(getUndirectedEdgeKey(path[i], path[i + 1]));
            }
        });

        return { paths, nodes, edges };
    }

    function buildShortestPathOverlayDataBetweenGroups(group1Ids, group2Ids) {
        const group1 = Array.from(new Set((group1Ids instanceof Set ? Array.from(group1Ids) : group1Ids || []).filter(Boolean)));
        const group2 = Array.from(new Set((group2Ids instanceof Set ? Array.from(group2Ids) : group2Ids || []).filter(Boolean)));
        const nodes = new Set();
        const edges = new Set();
        const paths = [];

        group1.forEach(id1 => {
            group2.forEach(id2 => {
                const data = buildShortestPathOverlayData(id1, id2);
                data.paths.forEach(path => paths.push(path));
                data.nodes.forEach(id => nodes.add(id));
                data.edges.forEach(edgeKey => edges.add(edgeKey));
            });
        });

        return { paths, nodes, edges };
    }

    function setShortestPathGroup(groupNumber) {
        const selection = Array.from(getEffectiveSelectedNodesSet());
        if (!selection.length) return;

        if (groupNumber === 1) {
            shortestPathGroup1Ids = new Set(selection);
        } else {
            shortestPathGroup2Ids = new Set(selection);
        }

        shortestPathGroupsToolOpen = true;
        shortestPathDisplayMode = 'groups';
        syncShortestPathGroupVisualization();
        updateShortestPathControlVisibility();
        draw();
    }

    function updateShortestPathGroupsBox() {
        const box = document.getElementById('shortest-path-groups-box');
        if (!box) return;

        const group1Count = shortestPathGroup1Ids.size;
        const group2Count = shortestPathGroup2Ids.size;
        const status1 = document.getElementById('shortest-path-group1-count');
        const status2 = document.getElementById('shortest-path-group2-count');
        if (status1) status1.textContent = `Group 1: ${group1Count} node${group1Count === 1 ? '' : 's'}`;
        if (status2) status2.textContent = `Group 2: ${group2Count} node${group2Count === 1 ? '' : 's'}`;

        const hasOverlay = shortestPathDisplayMode === 'groups' && group1Count > 0 && group2Count > 0 && pathEdges.size > 0;
        const overlayState = document.getElementById('shortest-path-groups-overlay-state');
        if (overlayState) {
            overlayState.textContent = hasOverlay
                ? `Overlay active: ${pathNodes.size} nodes on ${pathEdges.size} path edge${pathEdges.size === 1 ? '' : 's'}.`
                : 'Select nodes and then click below to set them as a group.';
        }

        const selectBtn = document.getElementById('shortest-path-groups-select-btn');
        if (selectBtn) selectBtn.disabled = pathNodes.size === 0;
    }

    function closeShortestPathGroupsBox() {
        shortestPathGroupsToolOpen = false;
        shortestPathGroup1Ids.clear();
        shortestPathGroup2Ids.clear();
        shortestPathDisplayMode = 'none';
        pathNodes.clear();
        pathEdges.clear();
        const box = document.getElementById('shortest-path-groups-box');
        if (box) box.style.display = 'none';
        updateShortestPathGroupsBox();
        updateShortestPathControlVisibility();
        draw();
    }

    function openShortestPathGroupsBox(event) {
        if (event) event.stopPropagation();
        shortestPathGroupsToolOpen = true;
        shortestPathDisplayMode = 'groups';
        pathNodes.clear();
        pathEdges.clear();
        const menu = document.getElementById('shortest-path-menu');
        if (menu) menu.classList.remove('open', 'open-above', 'open-below');
        document.removeEventListener('click', closeShortestPathMenuOnClickOutside);
        const box = document.getElementById('shortest-path-groups-box');
        if (box) box.style.display = 'block';
        updateShortestPathGroupsBox();
        updateShortestPathControlVisibility();
    }

    function syncShortestPathGroupVisualization() {
        if (!shortestPathGroupsToolOpen) return;

        if (shortestPathGroup1Ids.size > 0 && shortestPathGroup2Ids.size > 0) {
            const data = buildShortestPathOverlayDataBetweenGroups(shortestPathGroup1Ids, shortestPathGroup2Ids);
            shortestPathDisplayMode = 'groups';
            pathNodes.clear();
            pathEdges.clear();
            data.nodes.forEach(id => pathNodes.add(id));
            data.edges.forEach(edgeKey => pathEdges.add(edgeKey));
        } else {
            shortestPathDisplayMode = 'groups';
            pathNodes.clear();
            pathEdges.clear();
        }

        updateShortestPathGroupsBox();
    }

    function updateShortestPathLengthDisplay() {
        const display = document.getElementById('shortest-path-length-display');
        if (!display) return;
        const selection = getShortestPathSelectionIds();
        if (selection.length !== 2) {
            display.textContent = 'Shortest path length: -';
            return;
        }

        const data = getShortestPathData(selection[0], selection[1]);
        display.textContent = data.length === null ? 'Shortest path length: not found' : `Shortest path length: ${data.length}`;
    }

    function syncShortestPathVisualization() {
        if (shortestPathGroupsToolOpen) {
            syncShortestPathGroupVisualization();
            updateShortestPathOverlayButton();
            updateAllShortestPathsButton();
            return;
        }

        const selection = getShortestPathSelectionIds();
        if (selection.length !== 2) {
            pathNodes.clear();
            pathEdges.clear();
            shortestPathDisplayMode = 'none';
            updateShortestPathOverlayButton();
            return;
        }

        if (shortestPathDisplayMode === 'none') {
            pathNodes.clear();
            pathEdges.clear();
            updateShortestPathOverlayButton();
            updateAllShortestPathsButton();
            return;
        }

        const data = shortestPathDisplayMode === 'single'
            ? (() => {
                const shortestPathData = getShortestPathData(selection[0], selection[1]);
                const nodes = new Set(shortestPathData.path);
                const edges = new Set();
                shortestPathData.path.forEach((id, index) => {
                    if (index < shortestPathData.path.length - 1) {
                        edges.add(getUndirectedEdgeKey(id, shortestPathData.path[index + 1]));
                    }
                });
                return { nodes, edges };
            })()
            : buildShortestPathOverlayData(selection[0], selection[1]);
        pathNodes.clear();
        pathEdges.clear();
        data.nodes.forEach(id => pathNodes.add(id));
        data.edges.forEach(edgeKey => pathEdges.add(edgeKey));
        updateShortestPathOverlayButton();
        updateAllShortestPathsButton();
    }

    function updateShortestPathOverlayButton() {
        const btn = document.getElementById('shortest-path-overlay-btn');
        if (!btn) return;
        btn.textContent = shortestPathDisplayMode === 'single' ? 'Hide shortest path overlay' : 'Show shortest path overlay';
    }

    function updateAllShortestPathsButton() {
        const btn = document.getElementById('all-shortest-paths-btn');
        if (!btn) return;
        btn.textContent = shortestPathDisplayMode === 'all' ? 'Hide all shortest paths' : 'Show all shortest paths';
    }

    function toggleShortestPathMenu(event) {
        if (event) event.stopPropagation();
        const control = document.getElementById('shortest-path-control');
        const menu = document.getElementById('shortest-path-menu');
        if (!control || !menu || control.style.display === 'none') return;

        const isOpen = menu.classList.contains('open');
        if (isOpen) {
            menu.classList.remove('open', 'open-above', 'open-below');
            document.removeEventListener('click', closeShortestPathMenuOnClickOutside);
            return;
        }

        const rect = control.getBoundingClientRect();
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        menu.classList.remove('open-above', 'open-below');
        if (spaceBelow >= 220 || spaceBelow >= spaceAbove) menu.classList.add('open-below');
        else menu.classList.add('open-above');
        menu.classList.add('open');
        setTimeout(() => document.addEventListener('click', closeShortestPathMenuOnClickOutside), 50);
    }

    function closeShortestPathMenuOnClickOutside(e) {
        const control = document.getElementById('shortest-path-control');
        const menu = document.getElementById('shortest-path-menu');
        if (!control || !menu) return;
        if (control.contains(e.target)) return;
        menu.classList.remove('open', 'open-above', 'open-below');
        document.removeEventListener('click', closeShortestPathMenuOnClickOutside);
    }

    function toggleShortestPathOverlay(event) {
        if (event) event.stopPropagation();
        const selection = getShortestPathSelectionIds();
        if (selection.length !== 2) return;

        shortestPathDisplayMode = shortestPathDisplayMode === 'single' ? 'none' : 'single';
        syncShortestPathVisualization();
        draw();
    }

    function toggleAllShortestPaths(event) {
        if (event) event.stopPropagation();
        const selection = getShortestPathSelectionIds();
        if (selection.length !== 2) return;

        shortestPathDisplayMode = shortestPathDisplayMode === 'all' ? 'none' : 'all';
        const data = shortestPathDisplayMode === 'all'
            ? buildShortestPathOverlayData(selection[0], selection[1])
            : { nodes: new Set(), edges: new Set() };
        pathNodes.clear();
        pathEdges.clear();
        data.nodes.forEach(id => pathNodes.add(id));
        data.edges.forEach(edgeKey => pathEdges.add(edgeKey));
        updateShortestPathOverlayButton();
        updateAllShortestPathsButton();
        draw();
    }

    function selectNodesAlongShortestPaths(event) {
        if (event) event.stopPropagation();
        const selection = getShortestPathSelectionIds();
        if (selection.length !== 2) return;

        const data = shortestPathDisplayMode === 'single'
            ? (() => {
                const shortestPathData = getShortestPathData(selection[0], selection[1]);
                return { nodes: new Set(shortestPathData.path) };
            })()
            : buildShortestPathOverlayData(selection[0], selection[1]);
        const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
        const nodeSet = data.nodes;

        shortestPathDisplayMode = 'none';
        pathNodes.clear();
        pathEdges.clear();
        updateShortestPathOverlayButton();
        updateAllShortestPathsButton();

        selectNodes(activeNodes.filter(n => nodeSet.has(n.id)), false, 'Shortest Path(s)');
    }

    function selectShortestPathGroupsNodes(event) {
        if (event) event.stopPropagation();
        if (!shortestPathGroupsToolOpen || pathNodes.size === 0) return;

        const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
        selectNodes(activeNodes.filter(n => pathNodes.has(n.id)), false, 'Shortest Path Groups');
    }

    function updateShortestPathControlVisibility() {
        const selectedIds = Array.from(getEffectiveSelectedNodesSet());
        const shortestPathControl = document.getElementById('shortest-path-control');
        const shortestPathMenu = document.getElementById('shortest-path-menu');
        const shouldShow = (selectedIds.length === 2 && currentViewId !== 'Mind Map') || shortestPathGroupsToolOpen;

        if (shortestPathControl) {
            shortestPathControl.style.display = shouldShow ? 'block' : 'none';
        }

        if (shouldShow) {
            updateShortestPathOverlayButton();
            updateAllShortestPathsButton();
            updateShortestPathLengthDisplay();
            const groupsBox = document.getElementById('shortest-path-groups-box');
            if (groupsBox) groupsBox.style.display = shortestPathGroupsToolOpen ? 'block' : 'none';
        } else {
            if (shortestPathMenu) shortestPathMenu.classList.remove('open', 'open-above', 'open-below');
            document.removeEventListener('click', closeShortestPathMenuOnClickOutside);
            if (shortestPathDisplayMode !== 'groups') {
                shortestPathDisplayMode = 'none';
                pathNodes.clear();
                pathEdges.clear();
            }
            updateShortestPathOverlayButton();
            updateAllShortestPathsButton();
            updateShortestPathLengthDisplay();
            const groupsBox = document.getElementById('shortest-path-groups-box');
            if (groupsBox && !shortestPathGroupsToolOpen) groupsBox.style.display = 'none';
        }

        if (shouldShow || shortestPathGroupsToolOpen) updateShortestPathGroupsBox();
    }

    function calculateEigenvectorCentrality() {
        console.log("function calculateEigenvectorCentrality()");
        nodes.forEach(n => n.eigen = 1); const threshold = +document.getElementById('thresholdInput').value;
        for (let i = 0; i < 20; i++) {
            let nextScores = new Map();
            nodes.forEach(n => { let sum = 0; (fullAdjacency.get(n.id) || []).forEach(edge => { if (edge.score >= threshold && nodeMap.has(edge.target)) sum += nodeMap.get(edge.target).eigen; }); nextScores.set(n.id, sum); });
            let max = Math.max(...Array.from(nextScores.values())) || 1; nodes.forEach(n => n.eigen = nextScores.get(n.id) / max);
        }
    }

    function modifySelection(dir) {
        console.log(`function modifySelection(dir: ${dir})`);
        const effectiveSelection = getEffectiveSelectedNodesSet();
        if (dir === 1) {
            if (effectiveSelection.size === 0) {
                draw();
                return new Set();
            }
            let newSet = new Set(effectiveSelection);
            const threshold = +document.getElementById('thresholdInput').value;
            effectiveSelection.forEach(id => {
                (fullAdjacency.get(id) || []).forEach(edge => {
                    if (edge.score >= threshold && nodeMap.has(edge.target)) newSet.add(edge.target);
                });
            });
            const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
            selectNodes(activeNodes.filter(n => newSet.has(n.id)), false, "Expanded Selection");
            draw();
            return newSet;
        } else {
            if (selectionHistory.length > 1) {
                selectionHistory.pop();
                const prevState = selectionHistory.pop();
                const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
                selectNodes(activeNodes.filter(n => prevState.ids.has(n.id)), false, prevState.query, prevState.summary || null);
                draw();
                return new Set(prevState.ids);
            } else {
                deselectNodes();
                draw();
                return new Set();
            }
        }
    }

    function toggleDropdown(id) { 
        console.log(`function toggleDropdown(id: ${id})`);
        const div = document.getElementById(id); 
        div.style.display = div.style.display === 'block' ? 'none' : 'block'; 
    }

    function setLinkBrightness(val) { 
        console.log(`function setLinkBrightness(val: ${val})`);
        document.getElementById('val-bri').innerText = val; 
        linkOpacity = val === 0 ? 0 : Math.pow(2, (val - 1) / 0.1); draw(); 
    }
    setLinkBrightness(0.6);

    function updatePhysicsForce() {
        console.log("function updatePhysicsForce()");
        const rep = +document.getElementById('repulsionSlider').value, att = +document.getElementById('attractionSlider').value, alp = +document.getElementById('alphaSlider').value, drift = +document.getElementById('driftSlider').value;
        const clusterByVariable = +document.getElementById('clusterVariableSlider')?.value || 0;
        const mode = document.getElementById('colorMode')?.value || 'layer';
        document.getElementById('val-rep').innerText = rep; document.getElementById('val-att').innerText = att; document.getElementById('val-alp').innerText = alp; document.getElementById('val-drift').innerText = drift;
        const clusterValEl = document.getElementById('val-cluster-var');
        if (clusterValEl) clusterValEl.innerText = Number(clusterByVariable.toFixed(2)).toString();
        const sim = currentViewId === 'base' ? simulation : activeSubData?.simulation;
        if (sim) {
            const targetNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
            const clusterSupported = mode === 'collection'
                || mode === 'layer'
                || mode === 'annotation'
                || mode === 'localization'
                || (mode.startsWith('var::') && !!targetNodes.find(n => getClusterVariableKey(n, mode) !== null));
            const linkBlend = Math.max(0, Math.min(1, clusterByVariable));
            const clusterBlend = clusterSupported ? linkBlend : 0;

            sim.force("charge").strength(-rep);
            const linkForce = sim.force("link");
            if (linkForce) {
                if (!linkForce.__baseStrengthAccessor) {
                    linkForce.__baseStrengthAccessor = linkForce.strength();
                }
                const baseStrengthAccessor = linkForce.__baseStrengthAccessor;
                linkForce.distance(att);
                if (linkBlend <= 0) {
                    linkForce.strength(baseStrengthAccessor);
                } else {
                    linkForce.strength(link => {
                        const base = (typeof baseStrengthAccessor === 'function')
                            ? baseStrengthAccessor(link)
                            : (+baseStrengthAccessor || 0);
                        return base * (1 - linkBlend);
                    });
                }
            }

            if (clusterBlend <= 0) {
                sim.force("cluster-x", null);
                sim.force("cluster-y", null);
            } else {
                const clusterCenters = getClusterCentersForNodes(targetNodes, mode);
                sim.force("cluster-x", d3.forceX(d => clusterCenters.get(d.id)?.x ?? (window.innerWidth / 2)).strength(clusterBlend));
                sim.force("cluster-y", d3.forceY(d => clusterCenters.get(d.id)?.y ?? (window.innerHeight / 2)).strength(clusterBlend));
            }

            if (canPhysicsRun()) { restartActivePhysics((isBuilding || isSettling) ? 0.5 : alp); }
        }
    }

    function updateSizesAndColors() {
        console.log("function updateSizesAndColors()");
        const mode = document.getElementById('colorMode').value, monoCol = document.getElementById('nodeMonoColor').value, cVal = +document.getElementById('sizeSlider').value, eVal = +document.getElementById('eigenSlider').value;
        const pVal = +document.getElementById('proteinSizeSlider').value, nSizeBase = +document.getElementById('nodeSizeSlider').value, threshold = +document.getElementById('thresholdInput').value;
        const nowMs = Date.now();
        document.getElementById('val-nsiz').innerText = nSizeBase; document.getElementById('val-siz').innerText = cVal; document.getElementById('val-esiz').innerText = eVal; document.getElementById('val-psiz').innerText = pVal;
        updatePhysicsRuntimeLabel();

        const legendContent = document.getElementById('legend-content');
        if (legendContent) {
            legendContent.innerHTML = '<div style="color:#aaa; font-size:12px; margin-bottom:6px;">Updating key ...</div>';
        }
        const useGlobalNodesForStyle = currentViewId === 'base' || currentViewId === 'Venn Diagram' || currentViewId === 'Scatter Plot' || currentViewId === 'Embeddings';
        const targetNodes = useGlobalNodesForStyle ? nodes : (activeSubData?.nodes || []);
        const targetLinks = useGlobalNodesForStyle ? links : (activeSubData?.links || []);
        
        if (mode === 'collection' || mode === 'complex_pdbs') {
            updateCollectionColorCycleTimer();
        }

        if (mode === 'eigen' || eVal > 0) {
            calculateEigenvectorCentrality();
            const useLocalEigen = currentViewId !== 'base' && eigenScope === 'local';
            const localScores = useLocalEigen ? calculateLocalEigenvectorCentrality(targetNodes, targetLinks, threshold) : null;
            targetNodes.forEach(n => {
                if (useLocalEigen) {
                    n.eigen = localScores.get(n.id) || 0;
                } else {
                    const baseNode = nodeMap.get(n.id);
                    if (baseNode && Number.isFinite(baseNode.eigen)) {
                        n.eigen = baseNode.eigen;
                    } else if (!Number.isFinite(n.eigen)) {
                        n.eigen = 0;
                    }
                }
            });
        }

        // Centrality calculation
        const effectiveCentralityScope = currentViewId === 'Embeddings' ? 'global' : centralityScope;
        targetNodes.forEach(n => {
            if (effectiveCentralityScope === 'global' || currentViewId === 'base') {
                n.centrality = (fullAdjacency.get(n.id) || []).filter(e => e.score >= threshold && nodeMap.has(e.target)).length;
            } else {
                n.centrality = targetLinks.filter(l => l.source.id === n.id || l.target.id === n.id).length;
            }
        });

        // Determine ranges for node scaling
        const proteinSizeSource = resolveProteinSizeSource(targetNodes);
        const cRange = d3.extent(targetNodes, d => d.centrality), sRange = d3.extent(targetNodes, d => getProteinSizeValue(d.id, proteinSizeSource)), eRange = d3.extent(targetNodes, d => (Number.isFinite(d.eigen) ? d.eigen : 0)), catScale = d3.scaleOrdinal(d3.schemeTableau10);
        const embeddingSimilarityState = mode === 'embeddings' ? computeEmbeddingSimilarityState(targetNodes) : null;
        const embeddingVectorsByNode = mode === 'embeddings' ? getEmbeddingVectorsByNodeForType(embeddingColorSimilarityType) : null;
        const embMin = embeddingSimilarityState?.min ?? -1;
        const embMax = embeddingSimilarityState?.max ?? 1;
        const embSpanRaw = embMax - embMin;
        const embSpan = embSpanRaw || 1;
        const embIsFallbackNoReference = !!embeddingSimilarityState?.isFallbackNoReference;
        const builtInColorSource = (mode === 'annotation' || mode === 'localization')
            ? resolveBuiltInColorSource(mode, targetNodes)
            : null;
        const localizationScale = mode === 'localization'
            ? getLocalizationColorScale(targetNodes, builtInColorSource)
            : null;
        const annotationLengthRange = mode === 'annotation'
            ? d3.extent(targetNodes, n => getAnnotationLengthFromSource(n.id, builtInColorSource))
            : null;
        const pdbCounts = mode === 'pdb_structure_count'
            ? targetNodes.map(node => getPdbStructureCount(node.id))
            : null;
        const minPdb = pdbCounts?.length ? Math.min(...pdbCounts) : 0;
        const maxPdb = pdbCounts?.length ? Math.max(...pdbCounts) : 1;
        const pdbRange = (maxPdb - minPdb) || 1;
        const complexPdbState = mode === 'complex_pdbs' ? ensureComplexPdbColorState() : null;
        const complexPdbScale = complexPdbState?.colorScale || d3.scaleOrdinal(d3.schemeTableau10);
        
        // Apply styles to nodes
        const applyStyle = (n) => {
            const m = proteinMetadata.get(n.id) || { size: 0, annotation: 'Unknown', localization: 'Unknown' };
            const centralityVal = Number.isFinite(n.centrality) ? n.centrality : 0;
            const eigenVal = Number.isFinite(n.eigen) ? n.eigen : 0;
            const proteinSizeVal = getProteinSizeValue(n.id, proteinSizeSource);
            n.r = (6 * nSizeBase)
                + (centralityVal * 0.5 * cVal)
                + (eigenVal * 60 * eVal)
                + ((proteinSizeVal / 500) * 4 * pVal);
            if (mode === 'layer') n.col = (n.layer === 99) ? "#888" : d3.interpolateViridis(1 - (n.layer / 10));
            else if (mode === 'centrality') n.col = d3.interpolateInferno(0.3 + (0.8 * ((n.centrality - (cRange[0]||0)) / ((cRange[1]-cRange[0]) || 1))));
            else if (mode === 'eigen') n.col = d3.interpolateInferno(0.3 + (0.8 * ((eigenVal - (eRange[0]||0)) / ((eRange[1]-eRange[0]) || 1))));
            else if (mode === 'embeddings') {
                const hasEmbedding = !!embeddingVectorsByNode?.has(n.id);
                
                if (!hasEmbedding) {
                    n.col = '#333';  // Dark grey (#333) for no embedding available. AI, make this a darker grey
                    n.embeddingSimilarity = null;
                    n.embeddingSimilarityNorm = 0;
                } else {
                    const sim = embeddingSimilarityState?.scores?.get(n.id);
                    if (Number.isFinite(sim)) {
                        // Check if within range
                        if (sim >= embeddingRangeMin && sim <= embeddingRangeMax) {
                            if (embIsFallbackNoReference) {
                                n.col = getEmbeddingSimilarityColor(sim);
                            } else {
                                n.col = getEmbeddingSimilarityColorByRange(sim, embMin, embMax);
                            }
                        } else {
                            n.col = '#333';  // Very dark grey for outside range
                        }
                        n.embeddingSimilarity = sim;
                        if (embIsFallbackNoReference) {
                            n.embeddingSimilarityNorm = clamp01((clampCosine(sim) + 1) / 2);
                        } else {
                            n.embeddingSimilarityNorm = embSpanRaw > 1e-12 ? clamp01((sim - embMin) / embSpanRaw) : 1;
                        }
                    } else {
                        n.col = '#333';
                        n.embeddingSimilarity = null;
                        n.embeddingSimilarityNorm = 0.5;
                    }
                }
            }
            else if (mode === 'collection') n.col = getCollectionColorForNode(n.id);
            else if (mode === 'size') n.col = d3.interpolateCool((proteinSizeVal - (sRange[0]||0)) / ((sRange[1]-sRange[0]) || 1));
            else if (mode === 'annotation') {
                const annLen = getAnnotationLengthFromSource(n.id, builtInColorSource);
                const aMin = annotationLengthRange?.[0] || 0;
                const aMax = annotationLengthRange?.[1] || 1;
                n.col = d3.interpolatePlasma((annLen - aMin) / ((aMax - aMin) || 1));
            }
            else if (mode === 'localization') {
                const builtInVal = getBuiltInColorValueFromSource(n.id, mode, builtInColorSource);
                n.col = localizationScale(builtInVal);
            }
            else if (mode && mode.startsWith('var::')) {
                const modeParts = String(mode).split('::');
                const file = modeParts[1], variable = modeParts[2];
                const childMode = modeParts[3] === 'child' ? modeParts[4] : null;
                const cfg = variableConfigs.find(c => c.fileName === file && c.variable === variable);
                const valueField = childMode && cfg?.splitBase ? cfg.splitBase : variable;
                const rawValue = accessoryVariableValues[file]?.[valueField]?.get(n.id);

                if (!cfg || rawValue === undefined || rawValue === null) {
                    n.col = monoCol;
                } else {
                    const type = cfg.type || 'Categorical - Nominal';
                    const childCfg = childMode ? (cfg.splitChildren?.[childMode] || {}) : null;
                    const effectiveType = childCfg?.type || type;

                    const allValues = targetNodes.map(node => accessoryVariableValues[file]?.[valueField]?.get(node.id)).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
                    const numericValues = allValues.map(v => +v).filter(v => !isNaN(v));
                    const uniqueValues = Array.from(new Set(allValues));
                    const sortedValues = [...uniqueValues].sort((a,b) => {
                        const na = +a, nb = +b;
                        if (!isNaN(na) && !isNaN(nb)) return na - nb;
                        return String(a).localeCompare(String(b), undefined, {numeric: true});
                    });
                    const valueScale = d3.scaleOrdinal(d3.schemeTableau10).domain(sortedValues);

                    const matches = !childMode || rawValue === childMode;
                    if (!matches) {
                        n.col = monoCol;
                    } else if (effectiveType === 'Numerical - Continuous') {
                        const minv = d3.min(numericValues) || 0;
                        const maxv = d3.max(numericValues) || 1;
                        const num = +rawValue;
                        n.col = isNaN(num) ? '#999' : d3.interpolateInferno((num - minv) / (maxv - minv || 1));
                    } else if (effectiveType === 'Numerical - Discrete' || effectiveType === 'Categorical - Ordinal') {
                        n.col = valueScale(rawValue);
                    } else {
                        n.col = catScale(rawValue || 'Unknown');
                    }
                }
            }
            else if (mode === 'pdb_structure_count') {
                const pdbCount = getPdbStructureCount(n.id);
                n.col = d3.interpolateCool((pdbCount - minPdb) / pdbRange);
            } else if (mode === 'complex_pdbs') {
                const memberships = getComplexPdbMemberships(n.id);
                if (!memberships.length) {
                    n.col = '#444';
                } else {
                    const activePdbId = memberships[Math.floor(nowMs / 500) % memberships.length];
                    n.col = complexPdbScale(activePdbId);
                }
            }
            else if (mode === 'random') n.col = n.randColor || "#fff";
            else n.col = monoCol;
        };

        targetNodes.forEach(applyStyle);
        uploadNodeGpuStyles(targetNodes, mode, cRange, sRange, eRange, monoCol);
        gpuState.needsUpload = true;
        updateLegend(mode, cRange, sRange, catScale, eRange, embeddingSimilarityState);
        refreshInfoBoxFromSelection();
        draw();
    }

    // This function determines the appropriate data to use for legend calculations based on the current view, then calls updateLegend with that data
    function refreshLegendForCurrentViewOnly() {
        const mode = document.getElementById('colorMode')?.value || currentColorMode || 'layer';
        const useGlobalNodesForLegend = currentViewId === 'base' || currentViewId === 'Venn Diagram' || currentViewId === 'Scatter Plot' || currentViewId === 'Embeddings';
        const targetNodes = useGlobalNodesForLegend ? nodes : (activeSubData?.nodes || []);
        const sizeSource = resolveProteinSizeSource(targetNodes);
        const cRange = d3.extent(targetNodes, d => Number.isFinite(d.centrality) ? d.centrality : 0);
        const sRange = d3.extent(targetNodes, d => getProteinSizeValue(d.id, sizeSource));
        const eRange = d3.extent(targetNodes, d => (Number.isFinite(d.eigen) ? d.eigen : 0));
        const catScale = d3.scaleOrdinal(d3.schemeTableau10);
        const embeddingSimilarityState = mode === 'embeddings' ? computeEmbeddingSimilarityState(targetNodes) : null;
        updateLegend(mode, cRange, sRange, catScale, eRange, embeddingSimilarityState);
    }

    function updateLegend(mode, cRange, sRange, catScale, eRange = null, embeddingSimilarityState = null) {
        console.log(`function updateLegend(mode: ${mode}, cRange: ${cRange}, sRange: ${sRange}, catScale: ${catScale}, eRange: ${eRange})`);
        const legend = d3.select("#legend-content");
        const rangeUINode = document.getElementById('range-ui');
        const wasRangeOpen = rangeUINode ? rangeUINode.style.display === 'block' : false;

        legend.html("");
        const activeNodes = (currentViewId === 'base' || currentViewId === 'Venn Diagram' || currentViewId === 'Scatter Plot' || currentViewId === 'Embeddings')
            ? nodes
            : (activeSubData?.nodes || []);
        const legendSizeSource = resolveProteinSizeSource(activeNodes);
        const builtInColorSource = (mode === 'annotation' || mode === 'localization')
            ? resolveBuiltInColorSource(mode, activeNodes)
            : null;
        const localizationScale = mode === 'localization'
            ? getLocalizationColorScale(activeNodes, builtInColorSource)
            : null;

        // Store current color mode for pie/histogram views
        currentColorMode = mode;
        currentColorRange = [cRange, sRange, eRange];

        const keyColorWrap = legend.append("div").style("margin-bottom", "10px");
        keyColorWrap.append("label")
            .style("display", "block")
            .style("margin-bottom", "4px")
            .style("font-size", "12px")
            .style("color", "#ddd")
            .text("Colour nodes by");
        keyColorWrap.append("select").attr("id", "keyColorMode");
        syncColorModeSelects(mode);
        const keyColorSelect = document.getElementById('keyColorMode');
        if (keyColorSelect) {
            keyColorSelect.onchange = function() {
                handleColorModeChange(this.value);
            };
        }

        // Helper function to create pie chart toggle button
        const createPieChartToggle = (counts, mode, label) => {
            const toggleContainer = legend.append("div").style("margin-bottom", "8px");
            const toggle = toggleContainer.append("div")
                .style("cursor", "pointer")
                .style("color", "#fff")
                .style("font-size", "13px")
                .style("padding", "6px")
                .style("background", "rgba(255,255,255,0.08)")
                .style("border-radius", "4px")
                .text(`Pie Chart ${chartToggleOpen.pie ? '▲' : '▼'}`)
                .on("click", () => {
                    chartToggleOpen.pie = !chartToggleOpen.pie;
                    updateLegend(mode, cRange, sRange, catScale, eRange);
                });

            if (chartToggleOpen.pie) {
                const chartDiv = toggleContainer.append("div").style("margin-top", "8px");
                renderMiniPieChart(chartDiv.node(), counts, mode, catScale);
                chartDiv.style("cursor", "pointer").on("click", () => {
                    switchView(getMiniChartNavigationTarget(`pie_chart`));
                });
            }
        };

        // Helper function to create histogram toggle button
        const createHistogramToggle = (numericValues, range, mode) => {
            const toggleContainer = legend.append("div").style("margin-bottom", "8px");
            const toggle = toggleContainer.append("div")
                .style("cursor", "pointer")
                .style("color", "#fff")
                .style("font-size", "13px")
                .style("padding", "6px")
                .style("background", "rgba(255,255,255,0.08)")
                .style("border-radius", "4px")
                .text(`Histogram ${chartToggleOpen.histogram ? '▲' : '▼'}`)
                .on("click", () => {
                    chartToggleOpen.histogram = !chartToggleOpen.histogram;
                    updateLegend(mode, cRange, sRange, catScale, eRange);
                });

            if (chartToggleOpen.histogram) {
                const chartDiv = toggleContainer.append("div").style("margin-top", "8px");
                
                // Ensure inputs exist or fallback to range
                const selectedMin = (typeof minIn !== 'undefined' && minIn) ? +minIn.property("value") : range[0];
                const selectedMax = (typeof maxIn !== 'undefined' && maxIn) ? +maxIn.property("value") : range[1];

                // RENDER
                renderMiniHistogram(chartDiv.node(), numericValues, range, mode, [selectedMin, selectedMax]);

                chartDiv.style("cursor", "pointer").on("click", () => {
                    switchView(getMiniChartNavigationTarget(`histogram`));
                });
            }
        };


        if (mode === 'embeddings') {
            const simState = embeddingSimilarityState || computeEmbeddingSimilarityState(activeNodes);
            const range = [simState.min, simState.max];
            const hasReference = getActiveEmbeddingReferenceSet().size > 0;
            const hasUploadedEmbeddingFiles = Object.keys(uploadedEmbeddingFiles || {}).length > 0;

            if (!hasUploadedEmbeddingFiles) {
                legend.append('div')
                    .style('font-size', '12px')
                    .style('font-weight', '700')
                    .style('color', '#fff')
                    .style('line-height', '1.35')
                    .style('margin', '0 0 10px 0')
                    .style('padding', '8px 10px')
                    .style('border-radius', '10px')
                    .style('background', '#b45309')
                    .text('No embedding (.h5) files uploaded. Note that STRING does not have .h5 files for prokaryotes.');
            }
            
            // Gradient bar and labels
            const gradient = d3.range(0, 1.01, 0.1).map(t => getEmbeddingSimilarityColor((t * 2) - 1)).join(', ');
            const container = legend.append('div').attr('class', 'gradient-container');
            container.append('div').attr('class', 'gradient-bar').style('background', `linear-gradient(to right, ${gradient})`);

            const labels = legend.append('div').attr('class', 'grad-labels');
            labels.append('span').text(Number(range[0]).toFixed(3));
            labels.append('span').text(Number(range[1]).toFixed(3));

            // Add range overlays to grey out areas outside selected range
            container.append('div').attr('class', 'range-overlay').style('left', '0').style('width', '0%');
            container.append('div').attr('class', 'range-overlay').style('right', '0').style('width', '0%');

            if (hasReference) {
                const rangeToggle = legend.append("div").attr("class", "select-range-toggle").style("color", "white").text("Select range ▾");
                const rangeUI = legend.append("div").attr("id", "range-ui-embeddings").style("display", "none");
                const inputs = rangeUI.append("div").attr("class", "range-inputs");
                const minBox = inputs.append("div");
                minBox.append("label").text("Min");
                const minIn = minBox.append("input")
                    .attr("id", "embedding-range-min-box")
                    .attr("type", "number")
                    .attr("step", 0.001)
                    .attr("value", Number(embeddingRangeMin).toFixed(3));

                const maxBox = inputs.append("div");
                maxBox.append("label").text("Max");
                const maxIn = maxBox.append("input")
                    .attr("id", "embedding-range-max-box")
                    .attr("type", "number")
                    .attr("step", 0.001)
                    .attr("value", Number(embeddingRangeMax).toFixed(3));

                const hMin = container.append("div").attr("class", "range-handle").style("left", "0%");
                const hMax = container.append("div").attr("class", "range-handle").style("right", "0%");

                let draggedHandle = null;
                const drag = d3.drag()
                    .on("start", function() { draggedHandle = d3.select(this); })
                    .on("drag", function(e) {
                        const rect = container.select(".gradient-bar").node().getBoundingClientRect();
                        let pos = Math.max(0, Math.min(100, (e.x / rect.width) * 100));
                        const currentMin = parseFloat(hMin.style("left")) || 0;
                        const currentMax = 100 - (parseFloat(hMax.style("right")) || 0);

                        if (draggedHandle.node() === hMin.node()) {
                            pos = Math.min(pos, currentMax);
                            hMin.style("left", pos + "%");
                        } else {
                            pos = Math.max(pos, currentMin);
                            hMax.style("right", (100 - pos) + "%");
                        }

                        const minPos = parseFloat(hMin.style("left")) || 0;
                        const maxPos = 100 - (parseFloat(hMax.style("right")) || 0);
                        const minVal = range[0] + (minPos / 100) * (range[1] - range[0]);
                        const maxVal = range[0] + (maxPos / 100) * (range[1] - range[0]);
                        minIn.property("value", Number(minVal).toFixed(3));
                        maxIn.property("value", Number(maxVal).toFixed(3));
                        updateEmbeddingRangeFromInputs(range, false);
                    })
                    .on("end", () => { draggedHandle = null; });

                hMin.call(drag);
                hMax.call(drag);
                rangeUI.append("button").text("Select").style("background", "#666").on("click", () => updateEmbeddingRangeFromInputs(range, true));
                minIn.on("input", () => updateEmbeddingRangeFromInputs(range, false));
                maxIn.on("input", () => updateEmbeddingRangeFromInputs(range, false));
                rangeToggle.on("click", () => { rangeUI.style("display", rangeUI.style("display") === "none" ? "block" : "none"); });
                updateEmbeddingRangeFromInputs(range, false);
            }

            legend.append('div')
                .style('font-size', '12px')
                .style('color', '#bbb')
                .style('line-height', '1.35')
                .style('margin', '8px 0 8px 0')
                .text('Select one or more nodes to set as the reference');

            legend.append('button')
                .style('width', '100%')
                .style('background', '#666')
                .style('margin-bottom', '8px')
                .text('Set Selection as Reference')
                .on('click', () => {
                    setEmbeddingReferenceFromCurrentSelection();
                });

            const toggleWrap = legend.append('div').style('margin-bottom', '8px');
            toggleWrap.append('label')
                .style('display', 'block')
                .style('margin-bottom', '4px')
                .style('font-size', '12px')
                .style('color', '#ddd')
                .text('Embedding type');

            const toggle = toggleWrap.append('div')
                .attr('class', 'link-direction-toggle')
                .style('margin-bottom', '6px');

            toggle.append('button')
                .attr('type', 'button')
                .attr('class', `link-direction-option${embeddingColorSimilarityType === 'sequence' ? ' active' : ''}`)
                .text('Sequence')
                .on('click', () => {
                    if (embeddingColorSimilarityType === 'sequence') return;
                    embeddingColorSimilarityType = 'sequence';
                    embeddingRangeMin = -1;
                    embeddingRangeMax = 1;
                    updateSizesAndColors();
                });

            toggle.append('button')
                .attr('type', 'button')
                .attr('class', `link-direction-option${embeddingColorSimilarityType === 'network' ? ' active' : ''}`)
                .text('Network')
                .on('click', () => {
                    if (embeddingColorSimilarityType === 'network') return;
                    embeddingColorSimilarityType = 'network';
                    embeddingRangeMin = -1;
                    embeddingRangeMax = 1;
                    updateSizesAndColors();
                });

            const description = embeddingColorSimilarityType === 'network'
                ? 'Proteins with more similar colouring to the reference node(s) tend to have similar functional context or be part of the same biological pathways as the reference node(s). Coloured based on cosine similarity to the reference node(s). '
                : 'Proteins with more similar colouring to the reference node(s) tend to have a similar structure to the reference node(s). Coloured based on cosine similarity to the reference node(s). ';

            legend.append('div')
                .style('font-size', '11px')
                .style('color', '#bbb')
                .style('line-height', '1.35')
                .style('margin', '8px 0 8px 0')
                .text(description);

            const refCount = getActiveEmbeddingReferenceSet().size;
            const refsWithVectors = simState.refWithVectors?.size || 0;
            legend.append('div')
                .style('font-size', '11px')
                .style('color', '#aaa')
                .style('margin-bottom', '8px')
                .text(`Reference nodes (circled in red): ${refCount} (${refsWithVectors} with embeddings)`);

            legend.append('button')
                .attr('type', 'button')
                .style('display', 'inline-block')
                .style('padding', '5px 12px')
                .style('border-radius', '999px')
                .style('border', '1px solid #6b7280')
                .style('background', '#4b5563')
                .style('color', '#f3f4f6')
                .style('font-size', '11px')
                .style('margin-bottom', '8px')
                .style('cursor', 'pointer')
                .text('Select Reference Nodes')
                .on('click', () => {
                    const refs = getActiveEmbeddingReferenceSet();
                    if (!refs || !refs.size) return;
                    const activeForSelection = (currentViewId === 'base' || currentViewId === 'Embeddings')
                        ? nodes
                        : (activeSubData?.nodes || []);
                    const matches = activeForSelection.filter(n => refs.has(n.id));
                    if (matches.length) {
                        selectNodes(matches, false, 'Select Reference Nodes');
                        draw();
                    }
                });

            // Legend items for no embedding and available embedding
            const legendItems = legend.append('div').style('margin-top', '8px');
            
            // "No embedding available" item (always shown)
            const noEmbItem = legendItems.append('div').attr('class', 'legend-item');
            noEmbItem.append('div')
                .style('width', '12px')
                .style('height', '12px')
                .style('background', '#333')
                .style('border', '1px solid #6b7280')
                .style('border-radius', '2px')
                .style('margin-right', '8px')
                .style('flex-shrink', '0');
            noEmbItem.append('span')
                .style('font-size', '11px')
                .style('color', '#999')
                .text('No embedding available to calculate cosine similarity');

        } else if (['centrality', 'size', 'eigen', 'annotation', 'pdb_structure_count'].includes(mode)) {
            const annotationSource = mode === 'annotation' ? resolveBuiltInColorSource('annotation', activeNodes) : null;
            const annotationLengths = mode === 'annotation'
                ? activeNodes.map(n => getAnnotationLengthFromSource(n.id, annotationSource))
                : null;
            const pdbCounts = mode === 'pdb_structure_count'
                ? activeNodes.map(node => getPdbStructureCount(node.id))
                : null;
            const range = mode === 'centrality'
                ? cRange
                : (mode === 'size'
                    ? sRange
                    : (mode === 'eigen'
                        ? eRange
                        : (mode === 'annotation' ? d3.extent(annotationLengths) : d3.extent(pdbCounts))));
            const interp = mode === 'annotation'
                ? (t => d3.interpolatePlasma(clamp01(t)))
                : (mode === 'centrality' || mode === 'eigen'
                    ? (t => d3.interpolateInferno(0.3 + 0.8 * t))
                    : d3.interpolateCool);
            
            // Logic for handling small ranges (eigen) vs large ranges (centrality/size)
            const isSmallRange = mode !== 'pdb_structure_count' && ((range[1] - range[0]) <= 1);
            const stepValue = mode === 'pdb_structure_count' ? 1 : (isSmallRange ? 0.001 : 1);
            const formatVal = (v) => mode === 'pdb_structure_count' ? Math.round(v) : (isSmallRange ? parseFloat(v.toFixed(3)) : Math.round(v));

            createHistogramToggle(
                activeNodes.map(n => {
                    if (mode === 'centrality') return n.centrality || 0;
                    if (mode === 'size') return getProteinSizeValue(n.id, legendSizeSource);
                    if (mode === 'annotation') return getAnnotationLengthFromSource(n.id, annotationSource);
                    if (mode === 'pdb_structure_count') return getPdbStructureCount(n.id);
                    return Number.isFinite(n.eigen) ? n.eigen : 0;
                }),
                range,
                mode
            );

            const container = legend.append("div").attr("class", "gradient-container");
            const bar = container.append("div")
                .attr("class", "gradient-bar")
                .style("background", `linear-gradient(to right, ${d3.range(0, 1.1, 0.1).map(t => interp(clamp01(t))).join(', ')})`);
            
            container.append("div").attr("class", "range-overlay").style("left", "0").style("width", "0%");
            container.append("div").attr("class", "range-overlay").style("right", "0").style("width", "0%");
            const labels = legend.append("div").attr("class", "grad-labels");
            // FIX 1: Use formatVal for the text labels
            labels.append("span").text(formatVal(range[0] || 0)); 
            labels.append("span").text(formatVal(range[1] || 0));
            
            const toggle = legend.append("div").attr("class", "select-range-toggle").style("color", "white").text("Select range ▾");
            const rangeUI = legend.append("div").attr("id", "range-ui").style("display", wasRangeOpen ? "block" : "none");
            const inputs = rangeUI.append("div").attr("class", "range-inputs");
            const minBox = inputs.append("div"); 
            minBox.append("label").text("Min"); 
            const minIn = minBox.append("input")
                .attr("id", "range-min-box")
                .attr("type", "number")
                .attr("step", stepValue)
                .attr("value", formatVal(range[0]));

            const maxBox = inputs.append("div"); 
            maxBox.append("label").text("Max"); 
            const maxIn = maxBox.append("input")
                .attr("id", "range-max-box")
                .attr("type", "number")
                .attr("step", stepValue)
                .attr("value", formatVal(range[1]));
            
            const hMin = container.append("div").attr("class", "range-handle").style("left", "0%");
            const hMax = container.append("div").attr("class", "range-handle").style("right", "0%");
            
            let draggedHandle = null;
            const drag = d3.drag()
                .on("start", function(e) { draggedHandle = d3.select(this); })
                .on("drag", function(e) {
                    const rect = bar.node().getBoundingClientRect(); 
                    let pos = Math.max(0, Math.min(100, (e.x / rect.width) * 100));
                    
                    // Calculate the raw value based on position
                    const rawVal = range[0] + (pos/100)*(range[1]-range[0]);

                    if (draggedHandle.node() === hMin.node()) {
                        const maxPos = 100 - (parseFloat(hMax.style("right")) || 0);
                        pos = Math.min(pos, maxPos);
                        draggedHandle.style("left", pos + "%");
                        // FIX 2: Use formatVal instead of Math.round
                        minIn.property("value", formatVal(rawVal));
                    } else {
                        const minPos = parseFloat(hMin.style("left")) || 0;
                        pos = Math.max(pos, minPos);
                        draggedHandle.style("right", (100 - pos) + "%");
                        // FIX 3: Use formatVal instead of Math.round
                        maxIn.property("value", formatVal(rawVal));
                    }
                    updateRangeFromInputs(range, mode, false);
                })
                .on("end", () => { draggedHandle = null; });

            hMin.call(drag); hMax.call(drag);
            
            rangeUI.append("button").text("Select").style("background", "#666").on("click", () => updateRangeFromInputs(range, mode, true));
            minIn.on("input", () => updateRangeFromInputs(range, mode, false));
            maxIn.on("input", () => updateRangeFromInputs(range, mode, false));
            toggle.on("click", () => { rangeUI.style("display", rangeUI.style("display") === "none" ? "block" : "none"); });

            if (mode === 'centrality') {
                legend.append("div")
                    .style("font-size", "11px")
                    .style("color", "#bbb")
                    .style("line-height", "1.35")
                    .style("margin", "6px 0 10px 0")
                    .text("Centrality is a count of how many links are connected to each node");
            }
            if (mode === 'eigen') {
                legend.append("div")
                    .style("font-size", "11px")
                    .style("color", "#bbb")
                    .style("line-height", "1.35")
                    .style("margin", "6px 0 10px 0")
                    .text("Eigenvector centrality is a measure of a node's importance based on the centrality of the nodes it is connected to.");
            };
            if (mode === 'annotation') {
                legend.append("div")
                    .style("font-size", "11px")
                    .style("color", "#bbb")
                    .style("line-height", "1.35")
                    .style("margin", "6px 0 10px 0")
                    .text("Nodes coloured by their annotation character count. This can be used as a proxy of how well researched/known the proteins are.");
            }
            if (mode === 'pdb_structure_count') {
                legend.append("div")
                    .style("font-size", "11px")
                    .style("color", "#bbb")
                    .style("line-height", "1.35")
                    .style("margin", "6px 0 10px 0")
                    .text("PDB structure count is the number of PDB-linked aliases available for each protein.");
            }
            
            if ((mode === 'centrality' || mode === 'eigen') && (currentViewId === 'selected' || currentViewId.startsWith('coll_'))) {
                const scopeRow = legend.append("div")
                    .attr("class", "link-direction-toggle")
                    .style("margin", "6px 0 8px 0");
                const localActive = mode === 'centrality' ? (centralityScope === 'local') : (eigenScope === 'local');
                const globalActive = mode === 'centrality' ? (centralityScope === 'global') : (eigenScope === 'global');
                scopeRow.append("button")
                    .attr("type", "button")
                    .attr("class", `link-direction-option${localActive ? ' active' : ''}`)
                    .text("Local")
                    .on("click", (e) => {
                    e.stopPropagation();
                    if (mode === 'centrality') centralityScope = 'local'; else eigenScope = 'local';
                    updateSizesAndColors();
                });
                scopeRow.append("button")
                    .attr("type", "button")
                    .attr("class", `link-direction-option${globalActive ? ' active' : ''}`)
                    .text("Global")
                    .on("click", (e) => {
                    e.stopPropagation();
                    if (mode === 'centrality') centralityScope = 'global'; else eigenScope = 'global';
                    updateSizesAndColors();
                });
                if (mode === 'centrality') {
                    const centralityScopeText = centralityScope === 'global'
                        ? 'Global calculates centrality using only the nodes and links in the Full Network.'
                        : 'Local calculates centrality using the nodes and links in the current view.';
                    legend.append("div")
                        .style("font-size", "11px")
                        .style("color", "#bbb")
                        .style("line-height", "1.35")
                        .style("margin", "6px 0 10px 0")
                        .text(centralityScopeText);
                }
                if (mode === 'eigen') {
                    legend.append("div")
                        .style("font-size", "11px")
                        .style("color", "#bbb")
                        .style("line-height", "1.35")
                        .style("margin", "6px 0 10px 0")
                        .text("Local calculates eigenvector centrality using only the nodes and links in the current view, which can be more meaningful for sub-networks.");
                }
            }
        } else if (mode.startsWith('var::')) {
            const modeParts = String(mode).split('::');
            const file = modeParts[1], variable = modeParts[2];
            const childMode = modeParts[3] === 'child' ? modeParts[4] : null;
            const cfg = variableConfigs.find(c => c.fileName === file && c.variable === variable);
            if (!cfg) return;
            const valueField = childMode && cfg.splitBase ? cfg.splitBase : variable;

            const allValues = activeNodes.map(d => accessoryVariableValues[file]?.[valueField]?.get(d.id)).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
            const numericValues = allValues.map(v => +v).filter(v => !isNaN(v));
            const uniqueValues = Array.from(new Set(allValues));
            const sortedValues = [...uniqueValues].sort((a,b) => {
                const na = +a, nb = +b;
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return String(a).localeCompare(String(b), undefined, {numeric:true});
            });

            const baseType = cfg.type || 'Categorical - Nominal';
            const childCfg = childMode ? cfg.splitChildren?.[childMode] : null;
            const effectiveType = childCfg?.type || baseType;

            if (childMode) {
                const selectedLabel = childMode;
                const counts = new Map();
                activeNodes.forEach(d => {
                    const v = accessoryVariableValues[file]?.[valueField]?.get(d.id) || 'Unknown';
                    if (v === selectedLabel) counts.set('Selected', (counts.get('Selected') || 0) + 1);
                    else counts.set('Others', (counts.get('Others') || 0) + 1);
                });
                Array.from(counts.entries()).forEach(([lbl,cnt]) => {
                    const item = legend.append('div').attr('class', 'legend-item');
                    let color;
                    if (lbl === 'Selected') {
                        if (effectiveType === 'Numerical - Continuous') color = d3.interpolateInferno(0.7);
                        else color = d3.scaleOrdinal(d3.schemeTableau10).domain(sortedValues)(selectedLabel);
                    } else {
                        color = '#777';
                    }
                    item.append('div').attr('class', 'color-box').style('background', color);
                    item.append('span').text(`${lbl} (${cnt})`);
                });
            } else if (effectiveType === 'Numerical - Continuous') {
                const minv = d3.min(numericValues) || 0;
                const maxv = d3.max(numericValues) || 1;
                createHistogramToggle(numericValues, [minv, maxv], mode);
                const container = legend.append('div').attr('class', 'gradient-container');
                container.append('div').attr('class', 'gradient-bar').style('background', `linear-gradient(to right, ${d3.range(0, 1.1, 0.1).map(t => d3.interpolateInferno(t)).join(', ')})`);
                const labels = legend.append('div').attr('class', 'grad-labels');
                labels.append('span').text(Math.round(minv)); labels.append('span').text(Math.round(maxv));
                legend.append('div').attr('style', 'color:#ccc; font-size:11px; margin-top:6px;').text(`Continuous values: ${numericValues.length} nodes`);
                
                // Add range selection UI for continuous variables in embeddings view
                if (currentViewId === 'Embeddings') {
                    const rangeToggle = legend.append("div").attr("class", "select-range-toggle").style("color", "white").text("Select range ▾");
                    const rangeUI = legend.append("div").attr("id", `embedding-range-ui-${file}-${variable}`).style("display", "none");
                    const inputs = rangeUI.append("div").attr("class", "range-inputs");
                    
                    const minBox = inputs.append("div");
                    minBox.append("label").text("Min");
                    const minIn = minBox.append("input")
                        .attr("type", "number")
                        .attr("step", 0.001)
                        .attr("value", Number(minv).toFixed(3));

                    const maxBox = inputs.append("div");
                    maxBox.append("label").text("Max");
                    const maxIn = maxBox.append("input")
                        .attr("type", "number")
                        .attr("step", 0.001)
                        .attr("value", Number(maxv).toFixed(3));

                    const container = legend.append('div').attr('class', 'gradient-container-var');
                    const bar = container.append('div').attr('class', 'gradient-bar').style('background', `linear-gradient(to right, ${d3.range(0, 1.1, 0.1).map(t => d3.interpolateInferno(t)).join(', ')})`);
                    const hMin = container.append("div").attr("class", "range-handle").style("left", "0%");
                    const hMax = container.append("div").attr("class", "range-handle").style("right", "0%");

                    let draggedHandle = null;
                    const drag = d3.drag()
                        .on("start", function() { draggedHandle = d3.select(this); })
                        .on("drag", function(e) {
                            const rect = bar.node().getBoundingClientRect();
                            let pos = Math.max(0, Math.min(100, (e.x / rect.width) * 100));
                            const currentMin = parseFloat(hMin.style("left")) || 0;
                            const currentMax = 100 - (parseFloat(hMax.style("right")) || 0);

                            if (draggedHandle.node() === hMin.node()) {
                                pos = Math.min(pos, currentMax);
                                hMin.style("left", pos + "%");
                            } else {
                                pos = Math.max(pos, currentMin);
                                hMax.style("right", (100 - pos) + "%");
                            }

                            const minPos = parseFloat(hMin.style("left")) || 0;
                            const maxPos = 100 - (parseFloat(hMax.style("right")) || 0);
                            const minVal = minv + (minPos / 100) * (maxv - minv);
                            const maxVal = minv + (maxPos / 100) * (maxv - minv);
                            minIn.property("value", Number(minVal).toFixed(3));
                            maxIn.property("value", Number(maxVal).toFixed(3));
                        })
                        .on("end", () => { draggedHandle = null; });

                    hMin.call(drag);
                    hMax.call(drag);
                    
                    rangeUI.append("button").text("Select").style("background", "#666").on("click", () => {
                        const minVal = +minIn.property("value");
                        const maxVal = +maxIn.property("value");
                        handleEmbeddingVariableRangeSelection(mode, minVal, maxVal);
                    });
                    
                    minIn.on("input", () => {
                        const minVal = +minIn.property("value");
                        const maxVal = +maxIn.property("value");
                        const minPos = ((minVal - minv) / (maxv - minv)) * 100;
                        hMin.style("left", Math.max(0, Math.min(100, minPos)) + "%");
                    });
                    
                    maxIn.on("input", () => {
                        const minVal = +minIn.property("value");
                        const maxVal = +maxIn.property("value");
                        const maxPos = ((maxVal - minv) / (maxv - minv)) * 100;
                        hMax.style("right", Math.max(0, Math.min(100, 100 - maxPos)) + "%");
                    });
                    
                    rangeToggle.on("click", () => { rangeUI.style("display", rangeUI.style("display") === "none" ? "block" : "none"); });
                }
            } else {
                const counts = new Map();
                activeNodes.forEach(d => {
                    const k = accessoryVariableValues[file]?.[variable]?.get(d.id) || 'Unknown';
                    counts.set(k, (counts.get(k) || 0) + 1);
                });
                const orderVals = (effectiveType === 'Categorical - Ordinal' || effectiveType === 'Numerical - Discrete')
                    ? sortedValues
                    : Array.from(counts.entries()).sort((a,b) => b[1]-a[1]).map(([v]) => v);
                createPieChartToggle(counts, mode, variable);
                const valueScale = d3.scaleOrdinal(d3.schemeTableau10).domain(orderVals);
                orderVals.slice(0,50).forEach(lbl => {
                    const cnt = counts.get(lbl) || 0;
                    const item = legend.append('div').attr('class', 'legend-item').on('click', () => {
                        handleLegendHighlight(mode, lbl);
                        if (currentViewId === 'Embeddings') {
                            handleEmbeddingLegendHighlight(mode, lbl);
                        }
                    });
                    const color = (effectiveType === 'Categorical - Nominal') ? catScale(lbl) : valueScale(lbl);
                    item.append('div').attr('class', 'color-box').style('background', color);
                    item.append('span').text(`${lbl} (${cnt})`);
                });
            }

        } else if (['localization', 'biological_process', 'layer', 'collection', 'complex_pdbs'].includes(mode)) {
            const builtInSource = (mode === 'annotation' || mode === 'localization')
                ? resolveBuiltInColorSource(mode, activeNodes)
                : null;
            const counts = new Map();
            activeNodes.forEach(d => {
                let key = mode === 'layer'
                    ? (d.layer === 99 ? "Disconnected" : `Layer ${d.layer}`)
                    : (mode === 'annotation' || mode === 'localization'
                        ? getBuiltInColorValueFromSource(d.id, mode, builtInSource)
                        : (mode === 'biological_process'
                            ? getBiologicalProcessKey(d.id)
                            : (mode === 'complex_pdbs'
                                ? getComplexPdbMemberships(d.id)
                                : (proteinMetadata.get(d.id)?.[mode] || 'Unknown'))));
                counts.set(key, (counts.get(key) || 0) + 1);
            });
            if (mode === 'collection') {
                counts.clear();
                const noCollectionCount = activeNodes.filter(n => getNodeCollectionMemberships(n.id).length === 0).length;
                if (noCollectionCount > 0) counts.set('No Collection', noCollectionCount);
                collections.forEach((coll, name) => {
                    const count = activeNodes.filter(n => coll?.nodeIds?.has(n.id)).length;
                    if (count > 0) counts.set(name, count);
                });
            } else if (mode === 'complex_pdbs') {
                counts.clear();
                activeNodes.forEach(node => {
                    getComplexPdbMemberships(node.id).forEach(pdbId => {
                        counts.set(pdbId, (counts.get(pdbId) || 0) + 1);
                    });
                });
            }
            createPieChartToggle(counts, mode, mode === 'complex_pdbs' ? 'Complex PDBs' : mode);
            const sortedCounts = Array.from(counts.entries()).sort((a,b) => { if (a[0] === "Disconnected") return 1; if (b[0] === "Disconnected") return -1; if (mode === 'layer') return parseInt(a[0].split(' ')[1]) - parseInt(b[0].split(' ')[1]); return b[1] - a[1]; });
            const visibleCounts = mode === 'complex_pdbs' ? sortedCounts : sortedCounts.slice(0, 30);
            visibleCounts.forEach(([lbl, cnt]) => {
                const item = legend.append("div").attr("class", "legend-item").on("click", () => {
                    handleLegendHighlight(mode, lbl);
                    if (currentViewId === 'Embeddings') {
                        handleEmbeddingLegendHighlight(mode, lbl);
                    }
                });
                const color = mode === 'layer'
                    ? (lbl === "Disconnected" ? "#888" : d3.interpolateViridis(1 - ((parseInt(lbl.split(' ')[1])-1)/10)))
                    //make the grey darker for 'No Collection' to differentiate from the collections 
                    : (mode === 'collection' ? (lbl === 'No Collection' ? '#444' : getCollectionColorByName(lbl)) : (mode === 'complex_pdbs' ? ensureComplexPdbColorState().colorScale(lbl) : (mode === 'localization' ? localizationScale(lbl) : catScale(lbl))));
                item.append("div").attr("class", "color-box").style("background", color); item.append("span").text(`${lbl} (${cnt})`);
            });
            if (mode === 'collection') {
                legend.append('div').attr('style', 'color:#aaa; font-size:11px; margin-top:6px;').text('Nodes in multiple collections cycle every 0.5s.');
            } else if (mode === 'complex_pdbs') {
                legend.append('div').attr('style', 'color:#aaa; font-size:11px; margin-top:6px;').text('Nodes with multiple complex PDBs cycle every 0.5s.');
            }
        }
        if (mode === 'layer' && selectedNodes.size > 0) {
            legend.append("button").text("Update Selection as Layer 1").style("background", "#444").on("click", () => { 
                const selectedIds = Array.from(getEffectiveSelectedNodesSet());
                if (!selectedIds.length) return;

                currentSeeds = selectedIds;
                const useGlobalLayerTargets = currentViewId === 'base' || currentViewId === 'Embeddings' || !activeSubData?.nodes?.length;
                const targetNodes = useGlobalLayerTargets ? nodes : activeSubData.nodes;
                const targetNodeMap = useGlobalLayerTargets ? nodeMap : new Map(targetNodes.map(n => [n.id, n]));
                const threshold = +document.getElementById('thresholdInput').value;

                targetNodes.forEach(n => n.layer = 99);

                const queue = [];
                selectedIds.forEach(id => {
                    const found = targetNodeMap.get(id);
                    if (found) {
                        found.layer = 0;
                        queue.push(id);
                    }
                });

                const visited = new Set(queue);
                while (queue.length > 0) {
                    const currId = queue.shift();
                    const currNode = targetNodeMap.get(currId);
                    if (!currNode) continue;
                    const currLayer = currNode.layer;

                    if (useGlobalLayerTargets) {
                        (fullAdjacency.get(currId) || []).forEach(edge => {
                            if (edge.score < threshold) return;
                            const targetNode = targetNodeMap.get(edge.target);
                            if (targetNode && !visited.has(edge.target)) {
                                visited.add(edge.target);
                                targetNode.layer = currLayer + 1;
                                queue.push(edge.target);
                            }
                        });
                    } else {
                        (activeSubData.links || []).forEach(l => {
                            if (l.source.id === currId || l.target.id === currId) {
                                const targetId = l.source.id === currId ? l.target.id : l.source.id;
                                const targetNode = targetNodeMap.get(targetId);
                                if (targetNode && !visited.has(targetId)) {
                                    visited.add(targetId);
                                    targetNode.layer = currLayer + 1;
                                    queue.push(targetId);
                                }
                            }
                        });
                    }
                }

                if (currentViewId === 'Embeddings') {
                    markEmbeddingsDirty(true);
                }
                updateSizesAndColors();
            });
        }

        if (currentViewId === 'Embeddings' && !isFullNetworkBuildComplete()) {
            const hint = legend.append('div').attr('class', 'legend-item').style('cursor', 'default');
            hint.append('div').attr('class', 'color-box').style('background', '#58b8ff');
            hint.append('span').text('Not yet built in Full Network');
        }
    }

    function updateRangeFromInputs(range, mode, shouldSelect = false) {
        console.log(`function updateRangeFromInputs(range: ${range}, mode: ${mode}, shouldSelect: ${shouldSelect})`);
        const minV = +d3.select("#range-min-box").property("value"), maxV = +d3.select("#range-max-box").property("value");
        const pMin = ((minV - range[0]) / (range[1] - range[0])) * 100, pMax = ((maxV - range[0]) / (range[1] - range[0])) * 100;
        const container = d3.select(".gradient-container");
        container.selectAll(".range-handle").each(function(d, i) {
            if (i === 0) d3.select(this).style("left", Math.max(0, Math.min(100, pMin)) + "%").style("right", null);
            if (i === 1) d3.select(this).style("right", Math.max(0, Math.min(100, 100 - pMax)) + "%").style("left", null);
        });
        container.selectAll(".range-overlay").each(function() {
            const el = d3.select(this);
            if (this.style.left === "0%" || this.style.left === "0px") el.style("width", Math.max(0, pMin) + "%");
            else if (this.style.right === "0%" || this.style.right === "0px") el.style("width", Math.max(0, 100 - pMax) + "%");
        });
        if (shouldSelect) {
            const activeNodes = (currentViewId === 'base' || currentViewId === 'Venn Diagram' || currentViewId === 'Scatter Plot' || currentViewId === 'Embeddings')
                ? nodes
                : (activeSubData?.nodes || []);
            const sizeSource = resolveProteinSizeSource(activeNodes);
            const annotationSource = mode === 'annotation' ? resolveBuiltInColorSource('annotation', activeNodes) : null;
            const matches = activeNodes.filter(n => {
                let v;
                if (mode === 'centrality') {
                    v = n.centrality;
                } else if (mode === 'eigen') {
                    v = Number.isFinite(n.eigen) ? n.eigen : 0;
                } else if (mode === 'size') {
                    v = getProteinSizeValue(n.id, sizeSource);
                } else if (mode === 'annotation') {
                    v = getAnnotationLengthFromSource(n.id, annotationSource);
                } else if (mode === 'pdb_structure_count') {
                    v = getPdbStructureCount(n.id);
                } else if (mode?.startsWith('var::')) {
                    const parts = mode.split('::');
                    const file = parts[1], variable = parts[2];
                    const raw = accessoryVariableValues[file]?.[variable]?.get(n.id);
                    const parsed = +raw;
                    if (!Number.isFinite(parsed)) return false;
                    v = parsed;
                } else {
                    return false;
                }
                return v >= minV && v <= maxV;
            });
            applySearchLogic(matches, `Range ${minV} - ${maxV}`); draw(); 
        }
    }

    function updateEmbeddingRangeFromInputs(range, shouldSelect = false) {
        console.log(`function updateEmbeddingRangeFromInputs(range: ${range}, shouldSelect: ${shouldSelect})`);
        const minV = +d3.select("#embedding-range-min-box").property("value"), maxV = +d3.select("#embedding-range-max-box").property("value");
        embeddingRangeMin = Math.max(range[0], Math.min(minV, maxV));
        embeddingRangeMax = Math.min(range[1], Math.max(minV, maxV));
        
        const pMin = ((embeddingRangeMin - range[0]) / (range[1] - range[0])) * 100, pMax = ((embeddingRangeMax - range[0]) / (range[1] - range[0])) * 100;
        const container = d3.select(".gradient-container");
        container.selectAll(".range-handle").each(function(d, i) {
            if (i === 0) d3.select(this).style("left", Math.max(0, Math.min(100, pMin)) + "%").style("right", null);
            if (i === 1) d3.select(this).style("right", Math.max(0, Math.min(100, 100 - pMax)) + "%").style("left", null);
        });
        
        if (shouldSelect) {
            const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
            const matches = activeNodes.filter(n => {
                const sim = n.embeddingSimilarity;
                return Number.isFinite(sim) && sim >= embeddingRangeMin && sim <= embeddingRangeMax;
            });
            applySearchLogic(matches, `Cosine similarity range ${embeddingRangeMin.toFixed(3)} - ${embeddingRangeMax.toFixed(3)}`); 
            draw();
        }
    }

    function handleLegendHighlight(mode, value) {
        console.log(`function handleLegendHighlight(mode: ${mode}, value: ${value})`);
        const activeNodes = (currentViewId === 'base' || currentViewId === 'Venn Diagram' || currentViewId === 'Scatter Plot' || currentViewId === 'Embeddings')
            ? nodes
            : (activeSubData?.nodes || []);
        const builtInSource = (mode === 'annotation' || mode === 'localization')
            ? resolveBuiltInColorSource(mode, activeNodes)
            : null;
        const matches = activeNodes.filter(n => {
            if (mode === 'layer') return value === "Disconnected" ? n.layer === 99 : `Layer ${n.layer}` === value;
            if (mode === 'collection') {
                if (value === 'No Collection') return getNodeCollectionMemberships(n.id).length === 0;
                return getNodeCollectionMemberships(n.id).includes(value);
            }
            if (mode === 'complex_pdbs') {
                return getComplexPdbMemberships(n.id).includes(value);
            }
            if (mode === 'annotation' || mode === 'localization') {
                return getBuiltInColorValueFromSource(n.id, mode, builtInSource) === value;
            }
            if (mode === 'biological_process') {
                return getBiologicalProcessKey(n.id) === value;
            }
            if (mode?.startsWith('var::')) {
                const parts = mode.split('::');
                const file = parts[1], variable = parts[2];
                const raw = accessoryVariableValues[file]?.[variable]?.get(n.id);
                const normalized = (raw === undefined || raw === null || String(raw).trim() === '') ? 'Unknown' : String(raw).trim();
                return normalized === value;
            }
            return proteinMetadata.get(n.id)?.[mode] === value;
        });
        if (matches.length > 0) applySearchLogic(matches, value);
        
        // Also update pie chart wedge selection if in pie chart view
        if (currentViewId === 'pie_chart') {
            if (isAdditiveMode || isSubtractMode || isIntersectMode) {
                if (selectedWedges.has(value)) {
                    selectedWedges.delete(value);
                } else {
                    selectedWedges.add(value);
                }
            } else {
                selectedWedges.clear();
                selectedWedges.add(value);
            }
        }
        
        draw();
    }

    function handleEmbeddingLegendHighlight(mode, value) {
        console.log(`function handleEmbeddingLegendHighlight(mode: ${mode}, value: ${value})`);
        if (currentViewId !== 'Embeddings') return;
        
        const active = getActiveEmbeddingData();
        if (!active || !active.ids) return;
        
        const lookup = buildEmbeddingNodeLookup();
        const lookup2 = nodes.length > 0 ? lookup : { suffixMap: new Map(), prefixHint: null };
        
        // Get all nodes that match the criteria
        const matchingNodes = nodes.filter(n => {
            if (mode === 'layer') return value === "Disconnected" ? n.layer === 99 : `Layer ${n.layer}` === value;
            if (mode === 'collection') {
                if (value === 'No Collection') return getNodeCollectionMemberships(n.id).length === 0;
                return getNodeCollectionMemberships(n.id).includes(value);
            }
            if (mode === 'complex_pdbs') {
                return getComplexPdbMemberships(n.id).includes(value);
            }
            if (mode === 'biological_process') {
                return getBiologicalProcessKey(n.id) === value;
            }
            if (mode?.startsWith('var::')) {
                const parts = mode.split('::');
                const file = parts[1], variable = parts[2];
                const raw = accessoryVariableValues[file]?.[variable]?.get(n.id);
                const normalized = (raw === undefined || raw === null || String(raw).trim() === '') ? 'Unknown' : String(raw).trim();
                return normalized === value;
            }
            return false;
        });
        
        // Map matching nodes to embedding point IDs
        const embeddingPointIds = new Set();
        matchingNodes.forEach(n => {
            active.ids.forEach((embId, idx) => {
                const embNode = resolveEmbeddingIdToNode(embId, lookup2);
                if (embNode && embNode.id === n.id) {
                    embeddingPointIds.add(embId);
                }
            });
        });
        
        // Apply selection with proper mode handling
        let finalSet = new Set(getActiveEmbeddingSelectionSet());
        if (isSubtractMode) {
            embeddingPointIds.forEach(id => finalSet.delete(id));
        } else if (isIntersectMode) {
            const inter = new Set();
            embeddingPointIds.forEach(id => { if (finalSet.has(id)) inter.add(id); });
            finalSet = inter;
        } else if (isAdditiveMode) {
            embeddingPointIds.forEach(id => finalSet.add(id));
        } else {
            finalSet = embeddingPointIds;
        }
        
        setActiveEmbeddingSelection(finalSet);
        const plotEl = document.getElementById('embeddings-plot');
        if (plotEl) {
            applyEmbeddingSelectionStyling(plotEl, active.ids).then(() => {
                applyEmbeddingsSelectionToGraphNodes();
            }).catch(e => console.error('Error applying embedding styling:', e));
        }
    }

    function handleEmbeddingVariableRangeSelection(mode, minV, maxV) {
        console.log(`function handleEmbeddingVariableRangeSelection(mode: ${mode}, minV: ${minV}, maxV: ${maxV})`);
        if (currentViewId !== 'Embeddings') return;
        
        const active = getActiveEmbeddingData();
        if (!active || !active.ids) return;
        
        const lookup = buildEmbeddingNodeLookup();
        const lookup2 = nodes.length > 0 ? lookup : { suffixMap: new Map(), prefixHint: null };
        
        // Filter nodes by range
        const matchingNodes = nodes.filter(n => {
            let v = null;
            if (mode?.startsWith('var::')) {
                const parts = mode.split('::');
                const file = parts[1], variable = parts[2];
                const raw = accessoryVariableValues[file]?.[variable]?.get(n.id);
                if (raw === undefined || raw === null) return false;
                const parsed = +raw;
                if (!Number.isFinite(parsed)) return false;
                v = parsed;
            } else {
                return false;
            }
            return v >= minV && v <= maxV;
        });
        
        // Map matching nodes to embedding point IDs
        const embeddingPointIds = new Set();
        matchingNodes.forEach(n => {
            active.ids.forEach((embId, idx) => {
                const embNode = resolveEmbeddingIdToNode(embId, lookup2);
                if (embNode && embNode.id === n.id) {
                    embeddingPointIds.add(embId);
                }
            });
        });
        
        // Apply selection with proper mode handling
        let finalSet = new Set(getActiveEmbeddingSelectionSet());
        if (isSubtractMode) {
            embeddingPointIds.forEach(id => finalSet.delete(id));
        } else if (isIntersectMode) {
            const inter = new Set();
            embeddingPointIds.forEach(id => { if (finalSet.has(id)) inter.add(id); });
            finalSet = inter;
        } else if (isAdditiveMode) {
            embeddingPointIds.forEach(id => finalSet.add(id));
        } else {
            finalSet = embeddingPointIds;
        }
        
        setActiveEmbeddingSelection(finalSet);
        const plotEl = document.getElementById('embeddings-plot');
        if (plotEl) {
            applyEmbeddingSelectionStyling(plotEl, active.ids).then(() => {
                applyEmbeddingsSelectionToGraphNodes();
            }).catch(e => console.error('Error applying embedding styling:', e));
        }
    }

    function applySearchLogic(matches, queryStr, searchSummary = null) {
        console.log(`function applySearchLogic(matches: ${matches.length}, queryStr: ${queryStr})`);
        const matchIds = new Set(matches.map(m => m.id)); let finalSet = new Set(getEffectiveSelectedNodesSet());
        if (isSubtractMode) matchIds.forEach(id => finalSet.delete(id)); else if (isIntersectMode) { const inter = new Set(); matchIds.forEach(id => { if (finalSet.has(id)) inter.add(id); }); finalSet = inter; } else if (isAdditiveMode) matchIds.forEach(id => finalSet.add(id)); else finalSet = matchIds;
        const useGlobalNodes = currentViewId === 'base' || currentViewId === 'Venn Diagram' || currentViewId === 'Scatter Plot';
        const activeNodes = useGlobalNodes ? nodes : (activeSubData?.nodes || []);
        const finalSummary = searchSummary ? { ...searchSummary, total: finalSet.size } : null;
        selectNodes(activeNodes.filter(n => finalSet.has(n.id)), false, queryStr, finalSummary);
    }

    function tokenizeSearchQuery(rawInput) {
        const tokens = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < rawInput.length; i++) {
            const char = rawInput[i];
            if (char === '"') {
                if (inQuotes) {
                    if (current.trim()) tokens.push({ value: current.trim(), quoted: true });
                    current = '';
                    inQuotes = false;
                } else {
                    if (current.trim()) tokens.push({ value: current.trim(), quoted: false });
                    current = '';
                    inQuotes = true;
                }
                continue;
            }
            if (!inQuotes && /\s/.test(char)) {
                if (current.trim()) tokens.push({ value: current.trim(), quoted: false });
                current = '';
                continue;
            }
            current += char;
        }

        if (current.trim()) tokens.push({ value: current.trim(), quoted: inQuotes });
        return tokens.filter(token => token.value);
    }

    function isBooleanOperatorToken(token) {
        return !token?.quoted && ['AND', 'OR', 'NOT', 'BUT'].includes(String(token?.value || '').toUpperCase());
    }

    function parseBooleanSearchQuery(tokens) {
        let index = 0;

        function parseExpression() {
            return parseOr();
        }

        function parseOr() {
            let left = parseAnd();
            while (index < tokens.length && !tokens[index].quoted && tokens[index].value.toUpperCase() === 'OR') {
                index++;
                const right = parseAnd();
                if (!right) break;
                left = { type: 'or', left, right };
            }
            return left;
        }

        function parseAnd() {
            let left = parseNot();
            while (index < tokens.length && !tokens[index].quoted && (tokens[index].value.toUpperCase() === 'AND' || tokens[index].value.toUpperCase() === 'BUT')) {
                index++;
                const right = parseNot();
                if (!right) break;
                left = { type: 'and', left, right };
            }
            return left;
        }

        function parseNot() {
            if (index < tokens.length && !tokens[index].quoted && tokens[index].value.toUpperCase() === 'NOT') {
                index++;
                const term = parseNot();
                return term ? { type: 'not', term } : null;
            }
            return parsePrimary();
        }

        function parsePrimary() {
            while (index < tokens.length && isBooleanOperatorToken(tokens[index])) index++;
            if (index >= tokens.length) return null;
            const token = tokens[index++];
            return { type: 'term', value: token.value, exact: !!token.quoted };
        }

        return parseExpression();
    }

    function evaluateBooleanExpression(expr, matchesTerm) {
        if (!expr) return true;
        if (expr.type === 'term') return matchesTerm(expr.value, !!expr.exact);
        if (expr.type === 'and') return evaluateBooleanExpression(expr.left, matchesTerm) && evaluateBooleanExpression(expr.right, matchesTerm);
        if (expr.type === 'or') return evaluateBooleanExpression(expr.left, matchesTerm) || evaluateBooleanExpression(expr.right, matchesTerm);
        if (expr.type === 'not') return !evaluateBooleanExpression(expr.term, matchesTerm);
        return true;
    }

    function getSearchTermMatcher(scope, term) {
        const lowerQuery = String(term || '').toLowerCase();
        return (node, metadata, exact = false) => matchesSearchQuery(node, metadata, lowerQuery, scope, exact);
    }

    function getMindMapNodeMatcher(layout) {
        const infoData = mindMapInfoFile ? accessoryDataFiles[mindMapInfoFile] : null;
        const infoIdHeader = infoData ? getMindMapIdHeader(mindMapInfoFile, Array.from(layout.nodes.keys())) : null;

        return (nodeId, mmNode, term) => {
            const lowerTerm = String(term || '').toLowerCase();
            if (String(nodeId || '').toLowerCase().includes(lowerTerm)) return true;
            if (String(mmNode?.label || '').toLowerCase().includes(lowerTerm)) return true;
            if (infoData && infoIdHeader) {
                const infoRow = infoData.rows.find(row => row[infoIdHeader] === nodeId);
                if (infoRow) {
                    for (const value of Object.values(infoRow)) {
                        if (String(value).toLowerCase().includes(lowerTerm)) return true;
                    }
                }
            }
            return false;
        };
    }

    function buildSearchSummary(rawInput, summaryTerms, totalMatches, mode) {
        if (mode === 'boolean') {
            return { mode: 'boolean', query: rawInput, total: totalMatches };
        }
        return {
            mode: 'terms',
            query: rawInput,
            terms: summaryTerms,
            total: totalMatches
        };
    }

    function triggerSearch() {
        console.log("function triggerSearch()");
        const rawInput = document.getElementById('searchInput').value.trim();
        if (!rawInput) return;
        const scope = document.getElementById('searchScope').value;
        const tokens = tokenizeSearchQuery(rawInput);
        const searchTerms = tokens.filter(token => !isBooleanOperatorToken(token));
        if (!searchTerms.length) return;
        const booleanMode = tokens.some(isBooleanOperatorToken);

        // Handle Mind Map search separately
        if (currentViewId === 'Mind Map') {
            const layout = buildMindMapLayout();
            if (!layout || !layout.nodes) return;
            const matchesTerm = getMindMapNodeMatcher(layout);
            const expression = booleanMode ? parseBooleanSearchQuery(tokens) : null;
            const matchedNodeIds = new Set();
            layout.nodes.forEach((mmNode, nodeId) => {
                const isMatch = booleanMode
                    ? evaluateBooleanExpression(expression, (term) => matchesTerm(nodeId, mmNode, term))
                    : searchTerms.some(term => matchesTerm(nodeId, mmNode, term.value));
                if (isMatch) matchedNodeIds.add(nodeId);
            });

            mindMapSelectedNodes = matchedNodeIds;
            const summaryTerms = booleanMode ? [] : searchTerms.map(term => ({
                term: term.value,
                exact: !!term.quoted,
                count: Array.from(layout.nodes.entries()).filter(([nodeId, mmNode]) => matchesTerm(nodeId, mmNode, term.value)).length
            }));
            const searchSummary = buildSearchSummary(rawInput, summaryTerms, matchedNodeIds.size, booleanMode ? 'boolean' : 'terms');
            refreshInfoBoxFromSelection(rawInput, searchSummary);
            draw();
            return;
        }

        const activeNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
        const boolExpr = booleanMode ? parseBooleanSearchQuery(tokens) : null;
        const matches = activeNodes.filter(node => {
            const metadata = proteinMetadata.get(node.id) || {};
            const matchesTerm = (term, exact = false) => getSearchTermMatcher(scope, term)(node, metadata, exact);
            return booleanMode
                ? evaluateBooleanExpression(boolExpr, matchesTerm)
                : searchTerms.some(term => matchesTerm(term.value, !!term.quoted));
        });

        const summaryTerms = booleanMode ? [] : searchTerms.map(term => ({
            term: term.value,
            exact: !!term.quoted,
            count: activeNodes.filter(node => {
                const metadata = proteinMetadata.get(node.id) || {};
                return getSearchTermMatcher(scope, term.value)(node, metadata, !!term.quoted);
            }).length
        }));
        const searchSummary = buildSearchSummary(rawInput, summaryTerms, matches.length, booleanMode ? 'boolean' : 'terms');
        applySearchLogic(matches, rawInput, searchSummary); 
        draw();
    }

    function matchesSearchAllFields(n, m, query, isExactPhrase = false) {
        if (n.id.toLowerCase().includes(query)) return true;

        const baseValues = [
            m.annotation,
            m.localization,
            m.description,
            m.geneId,
            m.sequence,
            m.size
        ];

        if (Array.isArray(m.aliases)) {
            for (const alias of m.aliases) {
                if (alias !== undefined && alias !== null && String(alias).toLowerCase().includes(query)) return true;
            }
        }

        for (const val of baseValues) {
            if (val !== undefined && val !== null && String(val).toLowerCase().includes(query)) return true;
        }

        for (const vars of Object.values(accessoryVariableValues || {})) {
            for (const valueMap of Object.values(vars || {})) {
                if (!(valueMap instanceof Map)) continue;
                const raw = valueMap.get(n.id);
                if (raw !== undefined && raw !== null && String(raw).toLowerCase().includes(query)) return true;
            }
        }

        return false;
    }

    function matchesSearchQuery(n, m, query, scope, isExactPhrase = false) {
        if (scope === 'all') return matchesSearchAllFields(n, m, query, isExactPhrase);
        if (scope === 'layer' || scope === 'centrality') return String(n[scope]) === query;
        if (scope === 'size') return String(m.size) === query;
        if (scope.startsWith('var::')) {
            const parts = scope.split('::');
            const fileName = parts[1];
            const variable = parts[2];
            const raw = accessoryVariableValues[fileName]?.[variable]?.get(n.id);
            if (raw === undefined || raw === null) return false;
            const rawStr = String(raw).toLowerCase();
            return isExactPhrase ? rawStr.includes(query) : rawStr.includes(query);
        }
        const fieldValue = String(m[scope] || '').toLowerCase();
        return isExactPhrase ? fieldValue.includes(query) : fieldValue.includes(query);
    }

    const searchBtnEl = document.getElementById('searchBtn');
    if (searchBtnEl) searchBtnEl.onclick = triggerSearch;
    const searchInputEl = document.getElementById('searchInput');
    if (searchInputEl) {
        searchInputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerSearch();
                searchInputEl.blur();
            }
        };
    }
    const additiveBtnEl = document.getElementById('additiveBtn');
    if (additiveBtnEl) additiveBtnEl.onclick = () => toggleSelectionMode('add');
    const subtractBtnEl = document.getElementById('subtractBtn');
    if (subtractBtnEl) subtractBtnEl.onclick = () => toggleSelectionMode('remove');
    const intersectBtnEl = document.getElementById('intersectBtn');
    if (intersectBtnEl) intersectBtnEl.onclick = () => toggleSelectionMode('and');
    setSelectionMode(null);
    const lassoBtnEl = document.getElementById('lassoBtn');
    if (lassoBtnEl) lassoBtnEl.onclick = toggleLasso;
    const brushBtnEl = document.getElementById('brushBtn');
    if (brushBtnEl) brushBtnEl.onclick = toggleBrush;

    const embeddingsControlsEl = document.getElementById('embeddings-controls');
    if (embeddingsControlsEl) {
        embeddingsControlsEl.addEventListener('mouseenter', (e) => {
            if (currentViewId !== 'Embeddings') return;
            if ((e.buttons || 0) !== 0) return;
            disableBrushAndLassoSelection(true);
        });
    }

    const viewSelectorHoverEl = document.getElementById('view-selector-container');
    if (viewSelectorHoverEl) {
        viewSelectorHoverEl.addEventListener('mouseenter', (e) => {
            if (currentViewId !== 'Embeddings') return;
            if ((e.buttons || 0) !== 0) return;
            disableBrushAndLassoSelection(true);
        });
    }

    const dragNodesBtnEl = document.getElementById('dragNodesBtn');
    if (dragNodesBtnEl) {
        dragNodesBtnEl.onclick = (e) => {
            isDragMode = !isDragMode;
            e.target.classList.toggle('active', isDragMode);
        };
    }

    let lastCount = 0;
    let lastTime = Date.now();
    let smoothedLps = 0;

    function updateBuildStats(count, total, start, isDone = false) {
        const now = Date.now();
        const elapsed = (Date.now() - start) / 1000, lps = Math.round(count / elapsed);
        
        // 1. Calculate Instantaneous Speed
        const timeDelta = (now - lastTime) / 1000;
        const countDelta = count - lastCount;
        const instantLps = timeDelta > 0 ? countDelta / timeDelta : 0;

        // 2. Exponential Moving Average (EMA)
        const alpha = 0.1; 
        if (smoothedLps === 0) smoothedLps = instantLps;
        else smoothedLps = (instantLps * alpha) + (smoothedLps * (1 - alpha));

        lastCount = count;
        lastTime = now;

        // 3. UI Calculations
        const percent = Math.min((count / total) * 100, 100);
        const displayLps = Math.round(smoothedLps);
        const remainingLinks = total - count;
        const etc = (displayLps > 0) ? Math.round(remainingLinks / displayLps) : 0;

        // 4. Update DOM
        const progressBar = document.getElementById('progress-bar');
        progressBar.style.display = 'block';
        progressBar.style.width = `${percent}%`;

        document.getElementById('stat-nodes-text').innerHTML = `Proteins: <b>${nodeMap.size.toLocaleString()} / ${fullAdjacency.size.toLocaleString()}</b>`;
        document.getElementById('stat-links-text').innerHTML = `Links: <b>${count.toLocaleString()} / ${total.toLocaleString()}</b>`;
        document.getElementById('stat-speed-text').innerHTML = `Speed: <b>${displayLps.toLocaleString()}</b> links/s`;
        document.getElementById('elapsed-display').innerText = `Elapsed: ${Math.round(elapsed)}s`;
        document.getElementById('etc-display').innerText = isDone ? "Remaining: 0s" : 
            (displayLps > 0 ? `Remaining: ${etc}s` : "Remaining: --s");

        if (isDone || percent >= 100) {
            setTimeout(() => { progressBar.style.display = 'none'; }, 200);
        }
    }

    function syncSimulation(shouldRestart = true, refreshViewState = true) {
        console.log(`function syncSimulation(shouldRestart: ${shouldRestart})`);
        const threshold = +document.getElementById('thresholdInput').value; 
        const targetNodes = currentViewId === 'base' ? nodes : (activeSubData?.nodes || []);
        const targetNodeMap = currentViewId === 'base' ? nodeMap : new Map(targetNodes.map(n => [n.id, n]));
        targetNodes.forEach(n => n.layer = 99); 
        
        let queue = []; currentSeeds.forEach(id => { const found = targetNodeMap.get(id); if(found) { found.layer = 0; queue.push(id); } });
        let visited = new Set(queue);
        while(queue.length > 0) {
            const currId = queue.shift(), currNode = targetNodeMap.get(currId);
            if (!currNode) continue;
            const currLayer = currNode.layer;
            (fullAdjacency.get(currId) || []).forEach(edge => { 
                if (edge.score >= threshold) {
                    const targetNode = targetNodeMap.get(edge.target);
                    if (targetNode && !visited.has(edge.target)) {
                        visited.add(edge.target);
                        targetNode.layer = currLayer + 1;
                        queue.push(edge.target);
                    }
                }
            });
        }
        if (document.getElementById('colorMode').value === 'eigen') {
            calculateEigenvectorCentrality();
        }
        if (refreshViewState) {
            updateSizesAndColors();
        }
        
        if (currentViewId === 'base') {
            simulation.nodes(nodes);
            const activeLinks = [], processedPairs = new Set();
            nodes.forEach(n => { (fullAdjacency.get(n.id) || []).forEach(edge => { if (edge.score >= threshold && nodeMap.has(edge.target)) { const key = [n.id, edge.target].sort().join('-'); if (!processedPairs.has(key)) { activeLinks.push({ source: nodeMap.get(n.id), target: nodeMap.get(edge.target), value: edge.score }); processedPairs.add(key); } } }); });
            links = activeLinks; simulation.force("link").links(activeLinks);
            gpuState.needsUpload = true;
            if (canPhysicsRun() && shouldRestart) { restartActivePhysics((isBuilding || isSettling) ? 0.5 : +document.getElementById('alphaSlider').value); }
        }
    }

    function removeInteractionUpload(fileName) {
        delete uploadedInteractionFiles[fileName];
        delete interactionParsedEdgeCounts[fileName];
        if (!uploadedAccessoryFiles[fileName]) delete uploadedFileViewerData[fileName];
        rebuildInteractionDataFromUploads();
    }

    function removeAccessoryUpload(fileName) {
        if (uploadedEmbeddingFiles[fileName]) {
            const kind = uploadedEmbeddingFiles[fileName].kind;
            delete uploadedEmbeddingFiles[fileName];
            if (kind === 'network' || kind === 'sequence') {
                embeddingDataByType[kind] = null;
                invalidateEmbeddingVectorCache(kind);
                embeddingReferenceNodeIdsByType[kind] = new Set();
                if (embeddingViewType === kind) {
                    markEmbeddingsDirty(true);
                    refreshEmbeddingsView(false);
                }
            }
            if (!uploadedInteractionFiles[fileName] && !uploadedAccessoryFiles[fileName]) delete uploadedFileViewerData[fileName];
            updateUploadedListsUI();
            markEmbeddingsDirty(true);
            refreshEmbeddingsView(false);
            return;
        }
        delete uploadedAccessoryFiles[fileName];
        if (!uploadedInteractionFiles[fileName]) delete uploadedFileViewerData[fileName];
        rebuildAccessoryDataFromUploads();
    }

    function rebuildInteractionDataFromUploads() {
        fullAdjacency.clear();
        allIDs = [];
        totalUniqueLinks = 0;
        const tempLinks = new Set();
        interactionLinkLabelHeaders = [];
        interactionLinkLabelValues = new Map();

        Object.keys(interactionParsedEdgeCounts).forEach(k => delete interactionParsedEdgeCounts[k]);

        Object.entries(uploadedInteractionFiles).forEach(([fileName, text]) => {
            const raw = (text || '').trim();
            if (!raw) return;
            let parsedCountForFile = 0;

            const lines = raw.split(/\r?\n/).filter(line => line.trim());
            if (!lines.length) return;

            const firstLine = lines[0] || '';
            const hasSimpleDelimitedHeader = /,|\t|\||;/.test(firstLine);
            const hasWhitespaceHeader = !hasSimpleDelimitedHeader && firstLine.trim().split(/\s+/).length >= 3;

            const edgeTypeForFile = fileName === 'Genome_links.csv'
                ? 'gene-gene'
                : (fileName === 'Gene-Protein.links.csv' ? 'gene-protein' : 'default');

            const addEdge = (p1, p2, scoreVal) => {
                if (!p1 || !p2) return;
                const score = Number.isFinite(+scoreVal) ? +scoreVal : 1;
                if (!fullAdjacency.has(p1)) { fullAdjacency.set(p1, []); allIDs.push(p1); }
                if (!fullAdjacency.has(p2)) { fullAdjacency.set(p2, []); allIDs.push(p2); }
                fullAdjacency.get(p1).push({ target: p2, score, edgeType: edgeTypeForFile });
                fullAdjacency.get(p2).push({ target: p1, score, edgeType: edgeTypeForFile });
                const linkKey = [p1, p2].sort().join('-');
                if (!tempLinks.has(linkKey)) { tempLinks.add(linkKey); totalUniqueLinks++; parsedCountForFile++; }
            };

            if (hasSimpleDelimitedHeader || hasWhitespaceHeader) {
                const delim = hasSimpleDelimitedHeader
                    ? (firstLine.includes('\t') ? '\t'
                        : firstLine.includes(',') ? ','
                        : firstLine.includes('|') ? '|'
                        : ';')
                    : '__WS__';

                const headers = (delim === '__WS__'
                    ? firstLine.trim().split(/\s+/)
                    : firstLine.split(delim).map(h => h.trim().replace(/^"|"$/g, '')));
                const normalizedHeaders = headers.map(h => String(h || '').toLowerCase().trim());
                let scoreIdx = normalizedHeaders.findIndex(h => h === 'combined_score' || h === 'combinedscore' || h === 'score');
                if (scoreIdx < 0) scoreIdx = normalizedHeaders.findIndex(h => h.includes('score'));
                if (scoreIdx < 0) scoreIdx = 2;
                const dataLines = lines.slice(1);

                dataLines.forEach(line => {
                    const cols = (delim === '__WS__'
                        ? line.trim().split(/\s+/)
                        : line.split(delim).map(c => c.trim().replace(/^"|"$/g, '')));
                    const p1 = cols[0] || '';
                    const p2 = cols[1] || '';
                    const score = cols[scoreIdx] || cols[2] || 1;
                    addEdge(p1, p2, score);

                    const edgeKey = getUndirectedEdgeKey(p1, p2);
                    if (edgeKey) {
                        const meta = interactionLinkLabelValues.get(edgeKey) || {};
                        for (let i = 2; i < headers.length; i++) {
                            const header = headers[i];
                            if (!header) continue;
                            if (!interactionLinkLabelHeaders.includes(header)) {
                                interactionLinkLabelHeaders.push(header);
                            }
                            const val = (cols[i] || '').trim();
                            if (val !== '' && (meta[header] === undefined || meta[header] === '')) {
                                meta[header] = val;
                            }
                        }
                        if (Object.keys(meta).length) {
                            interactionLinkLabelValues.set(edgeKey, meta);
                        }
                    }
                });
            } else {
                // Legacy whitespace-delimited fallback (e.g. STRING-style text tables)
                if (lines.length < 2) return;
                lines.slice(1).forEach(line => {
                    const cols = line.trim().split(/\s+/);
                    const p1 = cols[0] || '';
                    const p2 = cols[1] || '';
                    const score = cols[2] || 1;
                    addEdge(p1, p2, score);
                });
            }

            interactionParsedEdgeCounts[fileName] = parsedCountForFile;
        });

        const interactionCount = Object.keys(uploadedInteractionFiles).length;
        document.getElementById('startBtn').disabled = interactionCount === 0;
        updateLinkLabelFieldOptions();
        updateUploadedListsUI();
    }

    function rebuildAccessoryDataFromUploads() {
        Object.keys(accessoryDataFiles).forEach(k => delete accessoryDataFiles[k]);
        Object.keys(accessoryVariableValues).forEach(k => delete accessoryVariableValues[k]);
        aliasData.clear();
        variableConfigs = [];
        window.variableConfigs = variableConfigs;

        Object.entries(uploadedAccessoryFiles).forEach(([fileName, text]) => {
            const lowerName = fileName.toLowerCase();
            const isFasta = lowerName.endsWith('.fa') || lowerName.endsWith('.fasta') || lowerName.endsWith('.faa') || lowerName.endsWith('.fna');
            if (isFasta) {
                parseFastaAccessoryFile(fileName, text);
            } else {
                parseAccessoryFile(fileName, text);
                ingestProteinMetadataFromAccessory(fileName, text);
                ingestProteinAliasLinksFromAccessory(fileName, text);
            }
        });

        refreshVariableFileList();
        updateUploadedListsUI();
        updateNodeLabelFieldOptions();
        updateSearchScopeOptions();
        updateMindMapControls();
        refreshInfoBoxFromSelection();
        refreshProteinComplexStructuresViewIfOpen();
        if (currentViewId === 'Mind Map' && mindMapSourceFile) {
            centerMindMapView();
            draw();
        }
        updateSizesAndColors();
    }

    function isGzipName(fileName) {
        return /\.gz$/i.test(String(fileName || ''));
    }

    function stripGzipSuffix(fileName) {
        return String(fileName || '').replace(/\.gz$/i, '');
    }

    async function decompressGzipBuffer(arrayBuffer) {
        if (typeof DecompressionStream !== 'function') {
            throw new Error('This browser does not support gzip decompression (DecompressionStream unavailable).');
        }
        const sourceStream = new Blob([arrayBuffer]).stream();
        const decompressedStream = sourceStream.pipeThrough(new DecompressionStream('gzip'));
        return await new Response(decompressedStream).arrayBuffer();
    }

    async function normalizeUploadedFile(file) {
        if (!file || !file.name) return file;
        if (!isGzipName(file.name)) return file;

        const rawBuffer = await file.arrayBuffer();
        const decompressedBuffer = await decompressGzipBuffer(rawBuffer);
        const normalizedName = stripGzipSuffix(file.name);

        return new File([decompressedBuffer], normalizedName, {
            type: file.type || 'application/octet-stream',
            lastModified: Date.now()
        });
    }

    async function fetchExampleDatasetFiles() {
        const apiUrl = 'https://api.github.com/repos/JoelTre/StringScape/contents/examples/E.%20coli%20K-12';
        const response = await fetch(apiUrl, {
            headers: { Accept: 'application/vnd.github+json' }
        });
        if (!response.ok) {
            throw new Error(`Failed to list example dataset files (${response.status})`);
        }

        const entries = await response.json();
        if (!Array.isArray(entries)) return [];

        const fileEntries = entries.filter(entry => entry && entry.type === 'file' && entry.download_url);
        const downloadedFiles = [];
        for (const entry of fileEntries) {
            const fileResponse = await fetch(entry.download_url);
            if (!fileResponse.ok) {
                throw new Error(`Failed to download example file: ${entry.name}`);
            }
            const fileBuffer = await fileResponse.arrayBuffer();
            downloadedFiles.push(new File([fileBuffer], entry.name, { type: 'application/octet-stream' }));
        }

        return downloadedFiles;
    }

    async function processInteractionFiles(files) {
        const targetFiles = Array.from(files || []);
        if (!targetFiles.length) return;
        const progressWrapper = document.getElementById('fileInputProgress');
        const progressBar = document.getElementById('fileInputProgressBar');
        if (progressWrapper) progressWrapper.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        for (let i = 0; i < targetFiles.length; i++) {
            const file = await normalizeUploadedFile(targetFiles[i]);
            const text = await file.text();
            uploadedFileViewerData[file.name] = { text };
            uploadedInteractionFiles[file.name] = text;
            if (progressBar) progressBar.style.width = `${Math.round(((i + 1) / targetFiles.length) * 100)}%`;
        }

        rebuildInteractionDataFromUploads();
        if (progressBar) progressBar.style.width = '100%';
        setTimeout(() => { if (progressWrapper) progressWrapper.style.display = 'none'; }, 300);
    }

    async function processAccessoryFiles(files) {
        const targetFiles = Array.from(files || []);
        if (!targetFiles.length) return;
        const progressWrapper = document.getElementById('infoInputProgress');
        const progressBar = document.getElementById('infoInputProgressBar');
        if (progressWrapper) progressWrapper.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        let processed = 0;
        for (let file of targetFiles) {
            file = await normalizeUploadedFile(file);
            const embeddingKind = getEmbeddingKindFromFileName(file.name);
            if (embeddingKind) {
                const payload = await parseEmbeddingFileInWorker(file, embeddingKind);
                embeddingDataByType[embeddingKind] = payload;
                invalidateEmbeddingVectorCache(embeddingKind);
                uploadedEmbeddingFiles[file.name] = {
                    kind: embeddingKind,
                    summary: `${payload.sampledRows}/${payload.totalRows} rows from ${payload.matrixPath}`
                };
                uploadedFileViewerData[file.name] = {
                    text: [
                        `Embedding Type: ${embeddingKind}`,
                        `Source file: ${payload.fileName}`,
                        `HDF5 dataset: ${payload.matrixPath}`,
                        `Rows sampled for UMAP: ${payload.sampledRows} / ${payload.totalRows}`,
                        `Embedding dimensions: ${payload.dimensions}`
                    ].join('\n')
                };
            } else {
                const text = await file.text();
                uploadedFileViewerData[file.name] = { text };
                uploadedAccessoryFiles[file.name] = text;
            }

            processed++;
            const pct = Math.round((processed / targetFiles.length) * 100);
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (pct >= 99) {
                setTimeout(() => { if (progressWrapper) progressWrapper.style.display = 'none'; }, 300);
            }
        }
        rebuildAccessoryDataFromUploads();
        if (currentViewId === 'Embeddings') {
            markEmbeddingsDirty(true);
            refreshEmbeddingsView(true);
        }
        if (targetFiles.length === 0) {
            setTimeout(() => { if (progressWrapper) progressWrapper.style.display = 'none'; }, 300);
        }
    }

    window.processInteractionFiles = processInteractionFiles;
    window.processAccessoryFiles = processAccessoryFiles;

    window.handleInteractionUploadChange = async (e) => {
        try {
            const files = Array.from(e?.target?.files || []);
            await processInteractionFiles(files);
        } catch (error) {
        } finally {
            if (e?.target) e.target.value = '';
        }
    };

    window.handleAccessoryUploadChange = async (e) => {
        try {
            const files = Array.from(e?.target?.files || []);
            await processAccessoryFiles(files);
        } catch (error) {
        } finally {
            if (e?.target) e.target.value = '';
        }
    };

    // Load example files (add code below)
    const loadExampleBtnEl = document.getElementById('loadExampleBtn');
    if (loadExampleBtnEl) {
        loadExampleBtnEl.onclick = async () => {
            const originalLabel = loadExampleBtnEl.textContent;
            loadExampleBtnEl.disabled = true;
            loadExampleBtnEl.textContent = 'Loading example...';
            try {
                const exampleFiles = await fetchExampleDatasetFiles();
                const linkFiles = exampleFiles.filter(file => file.name.toLowerCase().includes('link'));
                const accessoryFiles = exampleFiles.filter(file => !file.name.toLowerCase().includes('link'));

                await new Promise(requestAnimationFrame);
                closeModal('guideModal');

                if (linkFiles.length > 0) {
                    await processInteractionFiles(linkFiles);
                }
                if (accessoryFiles.length > 0) {
                    await processAccessoryFiles(accessoryFiles);
                }

                await applyUploadedSessionFiles();
            } catch (error) {
                console.error('Failed to load example dataset', error);
                alert('Failed to load the example dataset. Please try again.');
            } finally {
                loadExampleBtnEl.textContent = originalLabel;
                loadExampleBtnEl.disabled = false;
            }
        };
    }

    const interactionInputEl = document.getElementById('fileInput');
    const accessoryInputEl = document.getElementById('infoInput');
    if (interactionInputEl) interactionInputEl.onchange = window.handleInteractionUploadChange;
    if (accessoryInputEl) accessoryInputEl.onchange = window.handleAccessoryUploadChange;

    //document.getElementById('genomeInputBtn').onclick = () => {
    //     document.getElementById('genomeInput').click();
    // };

    //document.getElementById('genomeInput').onchange = async (e) => {
    //    const files = Array.from(e.target.files || []);
    //    await processGenomeFastaFiles(files);
    //    e.target.value = '';
    //};

    document.getElementById('sessionFolderInput').onchange = async (e) => {
        const folderFiles = Array.from(e.target.files || []);
        if (!folderFiles.length) return;

        const linkFiles = folderFiles.filter(file => file.name.toLowerCase().includes('link'));
        const accessoryFiles = folderFiles.filter(file => !file.name.toLowerCase().includes('link'));

        if (linkFiles.length > 0) {
            await processInteractionFiles(linkFiles);
        }

        if (accessoryFiles.length > 0) {
            await processAccessoryFiles(accessoryFiles);
        }

        try { await applyUploadedSessionFiles(); } catch (e) { console.warn('applyUploadedSessionFiles failed', e); }

        if (linkFiles.length === 0) {
            alert('No files with "link" in the filename were found in this folder. Interaction data was not loaded.');
        }

        e.target.value = '';
    };

    document.getElementById('startBtn').onclick = async () => {
        try {
            closeWelcomeOverlay();
            clearFullNetworkPostBuildCooldown();
            if (currentViewId !== 'base') {
                switchView('base');
            }
            let seeds = document.getElementById('seedInput').value.trim().split(/[\s,]+/).filter(x => x); const threshold = +document.getElementById('thresholdInput').value; if (seeds.length === 0) seeds = [allIDs[0]]; currentSeeds = [...seeds];
            scatterEigenCacheKey = null;
            nodes = []; links = []; nodeMap.clear(); document.getElementById('startBtn').style.display = 'none'; document.getElementById('progress-wrapper').style.display = 'block'; document.getElementById('pauseBtn').style.display = 'block'; document.getElementById('physBtn').style.display = 'block';
            let processedLinks = new Set(), startTime = Date.now(); isBuilding = true; isSettling = false; updateViewMenu();
            let lastBuildRefreshAt = startTime;
            let lastBuildStyleRefreshAt = startTime;
            const buildFromQueue = async (initialQueue, startLayer) => {
                let queue = [...initialQueue], layer = startLayer;
                while (queue.length > 0 && layer < 15) {
                    let layerSize = queue.length;
                    for (let i = 0; i < layerSize; i++) {
                        while (isPaused) await new Promise(r => setTimeout(r, 100));
                        const currentId = queue.shift();
                        if (!nodeMap.has(currentId)) { nodes.push({ id: currentId, layer, x: window.innerWidth/2, y: window.innerHeight/2, centrality: 0, randColor: d3.interpolateRainbow(Math.random()) }); nodeMap.set(currentId, nodes[nodes.length-1]); }
                        const pN = nodeMap.get(currentId);
                        (fullAdjacency.get(currentId) || []).forEach(edge => {
                            if (edge.score < threshold) return; const linkKey = [currentId, edge.target].sort().join('-');
                            if (!processedLinks.has(linkKey)) { if (!nodeMap.has(edge.target)) { nodes.push({ id: edge.target, layer: layer + 1, x: pN.x + (Math.random()-0.5)*1050, y: pN.y + (Math.random()-0.5)*1050, centrality: 0, randColor: d3.interpolateRainbow(Math.random()) }); nodeMap.set(edge.target, nodes[nodes.length-1]); queue.push(edge.target); } links.push({ source: nodeMap.get(currentId), target: nodeMap.get(edge.target), value: edge.score }); nodeMap.get(currentId).centrality++; nodeMap.get(edge.target).centrality++; processedLinks.add(linkKey); }
                        });
                        const now = Date.now();
                        if (now - lastBuildRefreshAt >= 200) {
                            updateBuildStats(processedLinks.size, totalUniqueLinks, startTime);
                            syncSimulation(false, false);
                            if (now - lastBuildStyleRefreshAt >= 1000) {
                                updateSizesAndColors();
                                lastBuildStyleRefreshAt = now;
                            }
                            if (physicsEnabled) restartActivePhysics(0.5);
                            lastBuildRefreshAt = now;
                            await new Promise(r => setTimeout(r, 1));
                        }
                    }
                    layer++;
                }
            };
            await buildFromQueue(seeds, 0); let remaining = allIDs.filter(id => !nodeMap.has(id)); while (remaining.length > 0) { await buildFromQueue([remaining[0]], 0); remaining = allIDs.filter(id => !nodeMap.has(id)); }
            isBuilding = false; isSettling = true; updateBuildStats(processedLinks.size, totalUniqueLinks, startTime, true); syncSimulation();
            try { await applyUploadedSessionFiles(); } catch (e) { console.warn('applyUploadedSessionFiles after build failed', e); }
            const sBtn = document.getElementById('startBtn'); sBtn.innerText = "Build complete"; sBtn.disabled = true; sBtn.style.display = 'block'; document.getElementById('pauseBtn').style.display = 'none';
            scheduleFullNetworkPostBuildCooldown();
        } catch (error) {
            throw error;
        }
    };

    function deselectNodes() { 
        console.log("function deselectNodes()");
        if (currentViewId === 'Embeddings' && !embeddingSelectionClearIntent) return;
        if (currentViewId === 'selected') {
            selectedNodesDraft = new Set();
        } else {
            selectedNodes.clear();
        }
        if (!shortestPathGroupsToolOpen) {
            pathNodes.clear(); 
            pathEdges.clear();
            shortestPathDisplayMode = 'none';
        }
        selectionHistory = [];
        clearProteinInfoHistory();
        d3.select("#coll-add-btn-container").html("");
        refreshInfoBoxFromSelection();
        if (!getEffectiveSelectedNodesSet().size && subtractModeLocked && !subtractKeyHeld) {
            subtractModeLocked = false;
            refreshSelectionModeState();
        }
        aiSyncSelectedNodesAttachment();
        if (document.getElementById('colorMode').value === 'layer') updateLegend('layer', null, null, null); 
        updateVennControls();
        checkOffscreenNodes(); 
    }

    document.getElementById('colorMode').onchange = function() {
        handleColorModeChange(this.value);
    };
    document.getElementById('nodeSizeSlider').oninput = updateSizesAndColors;
    const nodeMonoColorEl = document.getElementById('nodeMonoColor');
    if (nodeMonoColorEl) {
        nodeMonoColorEl.oninput = () => {
            if ((document.getElementById('colorMode')?.value || '') === 'mono') {
                updateSizesAndColors();
                if (currentViewId === 'Embeddings') {
                    try { markEmbeddingsDirty(true); } catch (e) {}
                    try { refreshEmbeddingsView(false); } catch (e) {}
                }
            }
        };
    }

    const nodeLabelShowBtn = document.getElementById('nodeLabelShow');
    const nodeLabelHideBtn = document.getElementById('nodeLabelHide');
    const nodeLabelFieldEl = document.getElementById('nodeLabelField');
    const linkLabelShowBtn = document.getElementById('linkLabelShow');
    const linkLabelHideBtn = document.getElementById('linkLabelHide');
    const linkLabelFieldEl = document.getElementById('linkLabelField');
    const nodeShowBtn = document.getElementById('nodeShow');
    const nodeHideBtn = document.getElementById('nodeHide');

    const setNodeVisibilityMode = (mode) => {
        nodeVisibilityToggle = mode;
        if (nodeShowBtn && nodeHideBtn) {
            nodeShowBtn.classList.toggle('active', mode === 'show');
            nodeHideBtn.classList.toggle('active', mode === 'hide');
        }
        draw();
    };

    if (nodeShowBtn && nodeHideBtn) {
        nodeShowBtn.onclick = () => setNodeVisibilityMode('show');
        nodeHideBtn.onclick = () => setNodeVisibilityMode('hide');
    }

    const setNodeLabelMode = (mode) => {
        nodeLabelToggle = mode;
        if (nodeLabelShowBtn && nodeLabelHideBtn) {
            nodeLabelShowBtn.classList.toggle('active', mode === 'show');
            nodeLabelHideBtn.classList.toggle('active', mode === 'hide');
        }
        document.getElementById('nodeLabelFieldContainer').style.display = (mode === 'show') ? 'block' : 'none';
        draw();
    };

    if (nodeLabelShowBtn && nodeLabelHideBtn) {
        nodeLabelShowBtn.onclick = () => setNodeLabelMode('show');
        nodeLabelHideBtn.onclick = () => setNodeLabelMode('hide');
    }

    if (nodeLabelFieldEl) {
        nodeLabelFieldEl.onchange = (e) => {
            nodeLabelField = e.target.value;
            draw();
        };
        nodeLabelFieldEl.value = nodeLabelField;
    }

    const setLinkLabelMode = (mode) => {
        linkLabelToggle = mode;
        if (linkLabelShowBtn && linkLabelHideBtn) {
            linkLabelShowBtn.classList.toggle('active', mode === 'show');
            linkLabelHideBtn.classList.toggle('active', mode === 'hide');
        }
        const container = document.getElementById('linkLabelFieldContainer');
        if (container) container.style.display = (mode === 'show') ? 'block' : 'none';
        draw();
    };

    if (linkLabelShowBtn && linkLabelHideBtn) {
        linkLabelShowBtn.onclick = () => setLinkLabelMode('show');
        linkLabelHideBtn.onclick = () => setLinkLabelMode('hide');
    }

    if (linkLabelFieldEl) {
        linkLabelFieldEl.onchange = (e) => {
            linkLabelField = e.target.value;
            draw();
        };
    }
    updateLinkLabelFieldOptions();

    // Default: Show modes
    setNodeVisibilityMode('show');
    setNodeLabelMode('show');
    setLinkLabelMode('hide');
    updatePhysicsControlButtons();
    document.getElementById('glowSlider').oninput = (e) => { document.getElementById('val-glw').innerText = e.target.value; draw(); };
    document.getElementById('sizeSlider').oninput = updateSizesAndColors;
    document.getElementById('eigenSlider').oninput = updateSizesAndColors;
    document.getElementById('proteinSizeSlider').oninput = updateSizesAndColors;
    document.getElementById('linkWidthSlider').oninput = (e) => {
        document.getElementById('val-linkw').innerText = e.target.value;
        draw();
    };
    document.getElementById('brightnessSlider').oninput = e => setLinkBrightness(+e.target.value);
    document.getElementById('geneBrightnessSlider').oninput = e => setGeneLinkBrightness(+e.target.value);
    document.getElementById('linkVisibilityMode').onchange = () => draw();
    document.getElementById('linkDirectionOn').onclick = () => setLinkDirection(true);
    document.getElementById('linkDirectionOff').onclick = () => setLinkDirection(false);
    document.getElementById('alphaSlider').oninput = updatePhysicsForce;
    document.getElementById('repulsionSlider').oninput = updatePhysicsForce;
    document.getElementById('attractionSlider').oninput = updatePhysicsForce;
    document.getElementById('driftSlider').oninput = updatePhysicsForce;
    document.getElementById('clusterVariableSlider').oninput = () => {
        if (!physicsEnabled) togglePhysics(true);
        updatePhysicsForce();
    };
    document.getElementById('thresholdInput').onchange = () => {
        scatterEigenCacheKey = null;
        syncSimulation();
        if (currentViewId === 'Scatter Plot') {
            ensureScatterEigenCentrality();
        }
        draw();
    };
    document.getElementById('bgColor').oninput = e => {
        document.documentElement.style.setProperty('--bg-color', e.target.value);
        if (currentViewId === 'Embeddings') {
            markEmbeddingsDirty(true);
        }
        draw();
    };
    document.getElementById('bgMode').onchange = e => {
        backgroundMode = e.target.value;
        updateBackgroundControlsUI();
        invalidateVoronoiCache();
        draw();
    };
    document.getElementById('bgVoronoiOpacitySlider').oninput = e => {
        bgVoronoiOpacity = +e.target.value;
        document.getElementById('val-bg-voronoi-opacity').innerText = Number(bgVoronoiOpacity.toFixed(2)).toString();
        draw();
    };
    document.getElementById('bgVoronoiBlurSlider').oninput = e => {
        bgVoronoiBlur = +e.target.value;
        document.getElementById('val-bg-voronoi-blur').innerText = Number(bgVoronoiBlur.toFixed(1)).toString();
        draw();
    };
    updateBackgroundControlsUI();
    document.getElementById('physBtn').onclick = (e) => togglePhysics(!physicsEnabled, 'physBtn');
    document.getElementById('stopPhysBtn').onclick = (e) => {
        isPhysicsStopped = !isPhysicsStopped;
        if (isPhysicsStopped) {
            clearFullNetworkPostBuildCooldown();
            physicsAutoPlayFromPause = false;
            const sim = currentViewId === 'base' ? simulation : activeSubData?.simulation;
            if (sim) sim.stop();
            physicsEnabled = false;
        }
        updatePhysicsControlButtons();
        if (isPhysicsStopped) {
            togglePhysics(false, 'stop-physics');
        }
        updatePhysicsRuntimeLabel();
    };
    document.getElementById('pauseBtn').onclick = (e) => {
        isPaused = !isPaused;
        e.target.innerText = isPaused ? "Resume Build" : "Pause Build";
        e.target.style.background = isPaused ? '#666' : '#f39c12';
        // When resuming (isPaused becomes false), switch to full network view
        if (!isPaused && currentViewId !== 'base') {
            switchView('base');
        }
    };
    document.getElementById('drawFrameBtn').onclick = function() {
        isFrameMode = !isFrameMode; // Toggle mode
        this.classList.toggle('active', isFrameMode);
        // Toggle cross hair cursor
        document.body.classList.toggle('drawing-frame', isFrameMode);
        // Switch off other tools if active
        if (isFrameMode) {
            isLassoMode = false;
            isBrushMode = false;
            document.getElementById('lassoBtn').classList.remove('active');
            document.getElementById('brushBtn').classList.remove('active');
        }
        // Show/Hide the extra controls (ratios, resolutions, etc.)
        document.getElementById('frame-controls').style.display = isFrameMode ? 'block' : 'none';
        
        // Update the cursor
        updateCanvasCursor(); 
        draw(); // Redraw to show the overlay if mode is on
    };

    // Ratio Selection
    document.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedRatio = this.getAttribute('data-ratio');
        };
    });

    // Resolution Selection
    document.querySelectorAll('.res-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.res-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            targetResolution = parseInt(this.getAttribute('data-res'));
        };
    });

    // Action Buttons
    document.getElementById('copyFrameBtn').onclick = () => captureFrame('copy');
    document.getElementById('downloadFrameBtn').onclick = () => captureFrame('download');

    function bindStaticUiEventListeners() {
        const bindClick = (element, handler) => {
            if (element) element.addEventListener('click', handler);
        };

        document.querySelectorAll('.close-modal').forEach(button => {
            if (button.dataset.boundCloseModal === 'true') return;
            button.dataset.boundCloseModal = 'true';
            button.addEventListener('click', (event) => {
                const modal = event.target.closest('.modal');
                if (modal?.id) closeModal(modal.id);
            });
        });

        bindClick(document.getElementById('node-info-pdb-close-btn'), closeNodeInfoPdbOverlay);
        bindClick(document.getElementById('shortest-path-toggle-btn'), toggleShortestPathMenu);
        bindClick(document.getElementById('shortest-path-overlay-btn'), toggleShortestPathOverlay);
        bindClick(document.getElementById('all-shortest-paths-btn'), toggleAllShortestPaths);
        bindClick(document.getElementById('shortest-path-select-btn'), selectNodesAlongShortestPaths);
        bindClick(document.getElementById('shortest-path-groups-tool-btn'), openShortestPathGroupsBox);
        bindClick(document.getElementById('shortest-path-group1-btn'), () => setShortestPathGroup(1));
        bindClick(document.getElementById('shortest-path-group2-btn'), () => setShortestPathGroup(2));
        bindClick(document.getElementById('shortest-path-groups-select-btn'), selectShortestPathGroupsNodes);
        bindClick(document.getElementById('shortest-path-groups-close-btn'), closeShortestPathGroupsBox);

        bindClick(document.getElementById('ui-layer-toggle-tab'), () => {
            document.getElementById('ui-layer')?.classList.toggle('minimized');
        });

        bindClick(document.getElementById('right-panel-toggle-tab'), () => {
            document.getElementById('right-panel')?.classList.toggle('minimized');
        });

        document.querySelectorAll('#ui-content > button, #guideModal .modal-content > button').forEach(button => {
            const text = button.textContent.trim();
            if (text === 'Open Start Guide') {
                bindClick(button, () => openModal('guideModal'));
            } else if (text === 'Open Previous Session') {
                bindClick(button, () => {
                    closeWelcomeOverlay();
                    document.getElementById('sessionFolderInput')?.click();
                });
            } else if (text === 'About StringScape') {
                bindClick(button, () => openModal('aboutModal'));
            }
        });

        document.querySelectorAll('#ui-content .dropdown-toggle').forEach(toggle => {
            bindClick(toggle, () => {
                const targetId = toggle.nextElementSibling?.id;
                if (targetId) toggleDropdown(targetId);
            });
        });

        bindClick(document.querySelector('[data-download-action="session"]'), () => openDownloadSessionModal());

        const variableSettingsButton = document.querySelector('#variables-drop button');
        bindClick(variableSettingsButton, () => openVariableSettings());

        bindClick(document.getElementById('moreToggle'), () => toggleSearchMore());
        bindClick(document.getElementById('right-panel-key-toggle'), () => {
            const legendContent = document.getElementById('legend-content');
            if (!legendContent) return;
            legendContent.classList.toggle('hidden');
            const keyToggle = document.getElementById('right-panel-key-toggle');
            if (keyToggle) keyToggle.textContent = legendContent.classList.contains('hidden') ? 'Key ▾' : 'Key ▾';
        });

        bindClick(document.getElementById('ai-new-chat-btn'), () => aiNewChat());
        bindClick(document.getElementById('ai-header-title'), () => toggleAiModeDropdown());
        bindClick(document.getElementById('ai-mode-agent-option'), () => setAiPanelMode('agent'));
        bindClick(document.getElementById('ai-mode-python-option'), () => setAiPanelMode('python'));
        bindClick(document.getElementById('ai-menu-btn'), () => toggleAiMenu());
        bindClick(document.getElementById('ai-download-menu-btn'), () => {
            downloadAiChat();
            toggleAiMenu();
        });
        bindClick(document.getElementById('ai-close-panel-btn'), () => toggleAiPanel(false));
        bindClick(document.getElementById('ai-history-toggle-btn'), () => aiToggleHistoryPanel());
        bindClick(document.getElementById('ai-setup-toggle-btn'), () => toggleAiTopPanel('setup'));
        bindClick(document.getElementById('ai-prompts-toggle-btn'), () => toggleAiTopPanel('prompts'));
        bindClick(document.getElementById('ai-connect-btn'), () => checkAiConnection());
        const aiServerUrlInput = document.getElementById('ai-server-url');
        if (aiServerUrlInput) {
            aiServerUrlInput.addEventListener('input', () => aiToggleConnectColor(aiServerUrlInput));
        }
        bindClick(document.getElementById('ai-python-instructions-btn'), () => openPythonInstructionsBox());
        bindClick(document.getElementById('ai-run-script-btn'), () => runPythonConsoleScript());
        bindClick(document.getElementById('ai-copy-python-instructions'), () => copyPythonInstructions());
        bindClick(document.getElementById('ai-close-python-instructions'), () => closePythonInstructionsBox());
        bindClick(document.getElementById('ai-file-btn'), () => document.getElementById('ai-file-input')?.click());
        bindClick(document.getElementById('ai-send-btn'), () => sendAiMessage());
        const aiFileInput = document.getElementById('ai-file-input');
        if (aiFileInput) {
            aiFileInput.addEventListener('change', () => aiHandleFile(aiFileInput));
        }
        bindClick(document.getElementById('ask-ai-btn'), () => toggleAiPanel());
        bindClick(document.getElementById('ai-python-console-btn'), () => togglePythonConsoleMode());

        bindClick(document.getElementById('protein-info-toggle-btn'), () => openProteinInfoBox());
        bindClick(document.getElementById('protein-info-prev-btn'), () => navigateProteinInfo('left'));
        bindClick(document.getElementById('protein-info-next-btn'), () => navigateProteinInfo('right'));
        document.querySelectorAll('[data-protein-mode]').forEach(button => {
            bindClick(button, () => setProteinInfoMode(button.dataset.proteinMode));
        });
        bindClick(document.getElementById('protein-info-explain-btn'), () => explainProteinInSimpleEnglish());
        bindClick(document.getElementById('protein-info-close-btn'), () => closeProteinInfoBox());

        const proteinInfoBox = document.getElementById('protein-info-box');
        const resizeHandle = document.getElementById('protein-info-resize-handle');
        const proteinInfoBody = document.getElementById('protein-info-body');
        let isResizingProteinInfo = false;
        let startY = 0;

        if (resizeHandle && proteinInfoBox && proteinInfoBody) {
            resizeHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isResizingProteinInfo = true;
                startY = e.clientY;
                proteinInfoBox.classList.add('resizing');
                document.body.style.userSelect = 'none';

                const handleMouseMove = (moveEvent) => {
                    if (!isResizingProteinInfo) return;
                    const delta = moveEvent.clientY - startY;
                    const currentHeight = proteinInfoBox.getBoundingClientRect().height || getProteinInfoDefaultHeightPx();
                    const nextHeight = Math.max(160, currentHeight - delta);
                    proteinInfoCustomHeightPx = nextHeight;
                    applyProteinInfoPanelHeight(nextHeight);
                    startY = moveEvent.clientY;
                };

                const handleMouseUp = () => {
                    isResizingProteinInfo = false;
                    proteinInfoBox.classList.remove('resizing');
                    document.body.style.userSelect = '';
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
        }

        bindClick(document.getElementById('mind-map-parent-btn'), event => selectMindMapParents(event));
        const nodeInfoTableWrap = document.getElementById('node-info-table-wrap');
        if (nodeInfoTableWrap && nodeInfoTableWrap.dataset.boundNodeInfoClicks !== 'true') {
            nodeInfoTableWrap.dataset.boundNodeInfoClicks = 'true';
            nodeInfoTableWrap.addEventListener('click', (event) => {
                const urlButton = event.target.closest('[data-node-info-url]');
                if (urlButton) {
                    openNodeInfoUrl(urlButton.dataset.nodeInfoUrl);
                    return;
                }
                const pdbButton = event.target.closest('[data-node-info-pdb-row]');
                if (pdbButton) {
                    openNodeInfoPdbOverlay(+pdbButton.dataset.nodeInfoPdbRow);
                }
            });
        }

        const nodeInfoPdbLinks = document.getElementById('node-info-pdb-links');
        if (nodeInfoPdbLinks && nodeInfoPdbLinks.dataset.boundPdbClicks !== 'true') {
            nodeInfoPdbLinks.dataset.boundPdbClicks = 'true';
            nodeInfoPdbLinks.addEventListener('click', (event) => {
                const urlButton = event.target.closest('[data-node-info-url]');
                if (urlButton) openNodeInfoUrl(urlButton.dataset.nodeInfoUrl);
            });
        }

        const downloadSessionModal = document.getElementById('downloadSessionModal');
        if (downloadSessionModal && downloadSessionModal.dataset.boundBackdrop !== 'true') {
            downloadSessionModal.dataset.boundBackdrop = 'true';
            downloadSessionModal.addEventListener('click', (event) => {
                if (event.target === downloadSessionModal) closeDownloadSessionModal();
            });
        }

        const nodeInfoPdbOverlay = document.getElementById('node-info-pdb-overlay');
        if (nodeInfoPdbOverlay && nodeInfoPdbOverlay.dataset.boundBackdrop !== 'true') {
            nodeInfoPdbOverlay.dataset.boundBackdrop = 'true';
            nodeInfoPdbOverlay.addEventListener('click', (event) => {
                if (event.target === nodeInfoPdbOverlay) closeNodeInfoPdbOverlay();
            });
        }
    }

    bindStaticUiEventListeners();

    const hoverTooltip = document.getElementById('node-hover-tooltip');
    if (hoverTooltip) {
        hoverTooltip.addEventListener('mouseenter', (e) => {
            isTooltipHovered = true;

            // stay visible if still over the last hovered node (or if node is set)
            if (hoveredNode && isPointerOverNode(e.clientX, e.clientY, hoveredNode)) {
                showNodeHoverTooltip(hoveredNode);
            }
        });

        hoverTooltip.addEventListener('mousemove', (e) => {
            if (hoveredNode && isPointerOverNode(e.clientX, e.clientY, hoveredNode)) {
                isTooltipHovered = true;
                return;
            }
            isTooltipHovered = false;
            hoveredNode = null;
            hideNodeHoverTooltip();
        });

        hoverTooltip.addEventListener('mouseleave', (e) => {
            if (hoveredNode && isPointerOverNode(e.clientX, e.clientY, hoveredNode)) {
                isTooltipHovered = true;
                return;
            }
            isTooltipHovered = false;
            hoveredNode = null;
            hideNodeHoverTooltip();
        });
    }
    initAiPanel();
    initWebGPU();
    updateUploadedListsUI();
    refreshInfoBoxFromSelection();
