class FlowchartApp {
  constructor() {
    this.canvas = document.getElementById("canvas")
    this.ctx = this.canvas.getContext("2d")
    this.nodes = []
    this.connectors = []
    this.selectedNodes = []
    this.history = []
    this.historyIndex = -1
    this.zoom = 1
    this.pan = { x: 0, y: 0 }
    this.gridSize = 20
    this.showGrid = true
    this.snapToGrid = true
    this.isDragging = false
    this.isPanning = false
    this.isConnecting = false
    this.isSelecting = false
    this.dragStart = null
    this.connectStart = null
    this.selectionStart = null
    this.nodeIdCounter = 0
    this.connectorIdCounter = 0
    this.savedFlowcharts = this.loadSavedFlowcharts()

    this.init()
  }

  init() {
    this.resizeCanvas()
    window.addEventListener("resize", () => this.resizeCanvas())
    this.setupEventListeners()
    this.loadFromLocalStorage()
    this.render()
    this.startAutoSave()
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = rect.width
    this.canvas.height = rect.height
    this.render()
  }

  setupEventListeners() {
    document.querySelectorAll(".toolbar-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => this.handleToolbarDragStart(e))
      item.addEventListener("click", (e) => this.handleToolbarClick(e))
    })

    this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e))
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e))
    this.canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e))
    this.canvas.addEventListener("wheel", (e) => this.handleWheel(e))
    this.canvas.addEventListener("dblclick", (e) => this.handleDoubleClick(e))
    this.canvas.addEventListener("dragover", (e) => e.preventDefault())
    this.canvas.addEventListener("drop", (e) => this.handleDrop(e))
    this.canvas.addEventListener("contextmenu", (e) => this.handleContextMenu(e))

    document.addEventListener("keydown", (e) => this.handleKeyDown(e))
    document.addEventListener("click", (e) => this.handleDocumentClick(e))

    document.getElementById("undoBtn").addEventListener("click", () => this.undo())
    document.getElementById("redoBtn").addEventListener("click", () => this.redo())
    document.getElementById("historyBtn").addEventListener("click", () => this.showHistoryModal())
    document.getElementById("saveBtn").addEventListener("click", () => this.showSaveModal())
    document.getElementById("loadBtn").addEventListener("click", () => this.showLoadModal())
    document.getElementById("exportPngBtn").addEventListener("click", () => this.exportPNG())
    document.getElementById("exportSvgBtn").addEventListener("click", () => this.exportSVG())
    document.getElementById("helpBtn").addEventListener("click", () => this.showHelpModal())
    document.getElementById("themeToggle").addEventListener("click", () => this.toggleTheme())
    document.getElementById("zoomInBtn").addEventListener("click", () => this.zoomIn())
    document.getElementById("zoomOutBtn").addEventListener("click", () => this.zoomOut())
    document.getElementById("resetZoomBtn").addEventListener("click", () => this.resetZoom())
    document.getElementById("fitToScreenBtn").addEventListener("click", () => this.fitToScreen())
    document.getElementById("toggleGridBtn").addEventListener("click", () => this.toggleGrid())
    document.getElementById("toggleSnapBtn").addEventListener("click", () => this.toggleSnap())

    document.getElementById("closeHelp").addEventListener("click", () => this.closeModal("helpModal"))
    document.getElementById("closeSave").addEventListener("click", () => this.closeModal("saveModal"))
    document.getElementById("closeLoad").addEventListener("click", () => this.closeModal("loadModal"))
    document.getElementById("closeHistory").addEventListener("click", () => this.closeModal("historyModal"))
    document.getElementById("downloadJson").addEventListener("click", () => this.downloadJSON())
    document.getElementById("loadFile").addEventListener("change", (e) => this.loadFromFile(e))
    document.getElementById("loadFromStorage").addEventListener("click", () => this.loadFromLocalStorage())
    document.getElementById("clearHistoryBtn").addEventListener("click", () => this.clearHistory())
    document.getElementById("historySearch").addEventListener("input", (e) => this.filterHistory(e.target.value))

    document.getElementById("toggleToolbar").addEventListener("click", () => {
      document.getElementById("toolbar").classList.toggle("collapsed")
    })

    document.getElementById("toggleInspector").addEventListener("click", () => {
      document.getElementById("inspector").classList.toggle("collapsed")
    })
  }

  handleToolbarDragStart(e) {
    e.dataTransfer.setData("nodeType", e.currentTarget.dataset.nodeType)
  }

  handleToolbarClick(e) {
    const nodeType = e.currentTarget.dataset.nodeType
    const centerX = (this.canvas.width / 2 - this.pan.x) / this.zoom
    const centerY = (this.canvas.height / 2 - this.pan.y) / this.zoom
    this.addNode(nodeType, centerX, centerY)
  }

  handleDrop(e) {
    e.preventDefault()
    const nodeType = e.dataTransfer.getData("nodeType")
    const rect = this.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom
    this.addNode(nodeType, x, y)
  }

  addNode(type, x, y) {
    const finalX = this.snapToGrid ? Math.round(x / this.gridSize) * this.gridSize : x
    const finalY = this.snapToGrid ? Math.round(y / this.gridSize) * this.gridSize : y

    const node = {
      id: this.nodeIdCounter++,
      type: type,
      x: finalX,
      y: finalY,
      width: 120,
      height: 60,
      text: this.getDefaultText(type),
      fillColor: "#ffffff",
      borderColor: "#000000",
      borderRadius: this.getDefaultBorderRadius(type),
      fontSize: 14,
    }
    this.nodes.push(node)
    this.saveState()
    this.render()
  }

  getDefaultText(type) {
    const texts = {
      start: "Start",
      process: "Process",
      decision: "Decision?",
      io: "Input/Output",
      connector: "",
      custom: "Custom",
    }
    return texts[type] || "Node"
  }

  getDefaultBorderRadius(type) {
    const radii = {
      start: 30,
      process: 5,
      decision: 0,
      io: 5,
      connector: 30,
      custom: 5,
    }
    return radii[type] || 5
  }

  handleMouseDown(e) {
    if (e.button === 2) {
      this.isPanning = true
      this.canvas.classList.add("panning")
      this.dragStart = { x: e.clientX, y: e.clientY, panX: this.pan.x, panY: this.pan.y }
      return
    }

    const rect = this.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom

    const clickedNode = this.getNodeAt(x, y)

    if (e.shiftKey && clickedNode) {
      if (this.selectedNodes.includes(clickedNode)) {
        this.selectedNodes = this.selectedNodes.filter((n) => n !== clickedNode)
      } else {
        this.selectedNodes.push(clickedNode)
      }
      this.updateInspector()
      this.render()
      return
    }

    if (clickedNode) {
      const handle = this.getResizeHandle(clickedNode, x, y)
      if (handle) {
        this.isResizing = true
        this.resizingNode = clickedNode
        this.resizeHandle = handle
        this.dragStart = {
          x,
          y,
          nodeX: clickedNode.x,
          nodeY: clickedNode.y,
          nodeWidth: clickedNode.width,
          nodeHeight: clickedNode.height,
        }
        return
      }

      const connectionHandle = this.getConnectionHandle(clickedNode, x, y)
      if (connectionHandle) {
        this.isConnecting = true
        this.connectStart = { node: clickedNode, x, y }
        this.canvas.classList.add("connecting")
        return
      }

      if (!this.selectedNodes.includes(clickedNode)) {
        this.selectedNodes = [clickedNode]
        this.updateInspector()
      }
      this.isDragging = true
      this.dragStart = { x, y, nodes: this.selectedNodes.map((n) => ({ node: n, startX: n.x, startY: n.y })) }
    } else {
      this.selectedNodes = []
      this.updateInspector()
      this.isSelecting = true
      this.selectionStart = { x, y }
    }

    this.render()
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom

    if (this.isPanning && this.dragStart) {
      this.pan.x = this.dragStart.panX + (e.clientX - this.dragStart.x)
      this.pan.y = this.dragStart.panY + (e.clientY - this.dragStart.y)
      this.render()
      return
    }

    if (this.isResizing && this.resizingNode && this.dragStart) {
      const dx = x - this.dragStart.x
      const dy = y - this.dragStart.y

      if (this.resizeHandle.includes("e")) {
        this.resizingNode.width = Math.max(60, this.dragStart.nodeWidth + dx)
      }
      if (this.resizeHandle.includes("w")) {
        const newWidth = Math.max(60, this.dragStart.nodeWidth - dx)
        this.resizingNode.x = this.dragStart.nodeX + (this.dragStart.nodeWidth - newWidth)
        this.resizingNode.width = newWidth
      }
      if (this.resizeHandle.includes("s")) {
        this.resizingNode.height = Math.max(40, this.dragStart.nodeHeight + dy)
      }
      if (this.resizeHandle.includes("n")) {
        const newHeight = Math.max(40, this.dragStart.nodeHeight - dy)
        this.resizingNode.y = this.dragStart.nodeY + (this.dragStart.nodeHeight - newHeight)
        this.resizingNode.height = newHeight
      }

      this.render()
      return
    }

    if (this.isDragging && this.dragStart) {
      const dx = x - this.dragStart.x
      const dy = y - this.dragStart.y

      this.dragStart.nodes.forEach(({ node, startX, startY }) => {
        const newX = startX + dx
        const newY = startY + dy
        node.x = this.snapToGrid ? Math.round(newX / this.gridSize) * this.gridSize : newX
        node.y = this.snapToGrid ? Math.round(newY / this.gridSize) * this.gridSize : newY
      })

      this.render()
      return
    }

    if (this.isConnecting && this.connectStart) {
      this.currentConnectorEnd = { x, y }
      this.render()
      return
    }

    if (this.isSelecting && this.selectionStart) {
      const selectionBox = document.getElementById("selectionBox")
      const left = Math.min(this.selectionStart.x, x) * this.zoom + this.pan.x
      const top = Math.min(this.selectionStart.y, y) * this.zoom + this.pan.y
      const width = Math.abs(x - this.selectionStart.x) * this.zoom
      const height = Math.abs(y - this.selectionStart.y) * this.zoom

      selectionBox.style.left = left + "px"
      selectionBox.style.top = top + "px"
      selectionBox.style.width = width + "px"
      selectionBox.style.height = height + "px"
      selectionBox.style.display = "block"
      return
    }
  }

  handleMouseUp(e) {
    const rect = this.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom

    if (this.isConnecting && this.connectStart) {
      const targetNode = this.getNodeAt(x, y)
      if (targetNode && targetNode !== this.connectStart.node) {
        this.addConnector(this.connectStart.node, targetNode)
      }
      this.isConnecting = false
      this.connectStart = null
      this.currentConnectorEnd = null
      this.canvas.classList.remove("connecting")
    }

    if (this.isSelecting && this.selectionStart) {
      const x1 = Math.min(this.selectionStart.x, x)
      const y1 = Math.min(this.selectionStart.y, y)
      const x2 = Math.max(this.selectionStart.x, x)
      const y2 = Math.max(this.selectionStart.y, y)

      this.selectedNodes = this.nodes.filter((node) => {
        return node.x + node.width > x1 && node.x < x2 && node.y + node.height > y1 && node.y < y2
      })

      this.updateInspector()
      document.getElementById("selectionBox").style.display = "none"
      this.isSelecting = false
      this.selectionStart = null
    }

    if (this.isDragging || this.isResizing) {
      this.saveState()
    }

    this.isDragging = false
    this.isPanning = false
    this.isResizing = false
    this.resizingNode = null
    this.dragStart = null
    this.canvas.classList.remove("panning")
    this.render()
  }

  handleWheel(e) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.1, Math.min(3, this.zoom * delta))

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    this.pan.x = mouseX - (mouseX - this.pan.x) * (newZoom / this.zoom)
    this.pan.y = mouseY - (mouseY - this.pan.y) * (newZoom / this.zoom)

    this.zoom = newZoom
    this.updateZoomDisplay()
    this.render()
  }

  handleDoubleClick(e) {
    const rect = this.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom

    const clickedNode = this.getNodeAt(x, y)
    if (clickedNode) {
      this.editNodeText(clickedNode)
    }
  }

  handleContextMenu(e) {
    e.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom

    const clickedNode = this.getNodeAt(x, y)
    this.showContextMenu(e.clientX, e.clientY, clickedNode)
  }

  handleDocumentClick(e) {
    const contextMenu = document.getElementById("contextMenu")
    if (!contextMenu.contains(e.target)) {
      contextMenu.style.display = "none"
    }
  }

  showContextMenu(x, y, node) {
    const contextMenu = document.getElementById("contextMenu")
    contextMenu.innerHTML = ""

    if (node) {
      const menuItems = [
        { label: "Edit Text", action: () => this.editNodeText(node) },
        {
          label: "Duplicate",
          action: () => {
            this.selectedNodes = [node]
            this.duplicateSelected()
          },
        },
        {
          label: "Delete",
          action: () => {
            this.selectedNodes = [node]
            this.deleteSelected()
          },
        },
        { label: "Bring to Front", action: () => this.bringToFront(node) },
        { label: "Send to Back", action: () => this.sendToBack(node) },
      ]

      menuItems.forEach((item) => {
        const menuItem = document.createElement("div")
        menuItem.className = "context-menu-item"
        menuItem.textContent = item.label
        menuItem.addEventListener("click", () => {
          item.action()
          contextMenu.style.display = "none"
        })
        contextMenu.appendChild(menuItem)
      })
    } else {
      const menuItems = [
        { label: "Select All", action: () => this.selectAll() },
        { label: "Clear Canvas", action: () => this.clearCanvas() },
        { label: "Fit to Screen", action: () => this.fitToScreen() },
      ]

      menuItems.forEach((item) => {
        const menuItem = document.createElement("div")
        menuItem.className = "context-menu-item"
        menuItem.textContent = item.label
        menuItem.addEventListener("click", () => {
          item.action()
          contextMenu.style.display = "none"
        })
        contextMenu.appendChild(menuItem)
      })
    }

    contextMenu.style.left = x + "px"
    contextMenu.style.top = y + "px"
    contextMenu.style.display = "block"
  }

  bringToFront(node) {
    const index = this.nodes.indexOf(node)
    if (index > -1) {
      this.nodes.splice(index, 1)
      this.nodes.push(node)
      this.saveState()
      this.render()
    }
  }

  sendToBack(node) {
    const index = this.nodes.indexOf(node)
    if (index > -1) {
      this.nodes.splice(index, 1)
      this.nodes.unshift(node)
      this.saveState()
      this.render()
    }
  }

  selectAll() {
    this.selectedNodes = [...this.nodes]
    this.updateInspector()
    this.render()
  }

  clearCanvas() {
    if (confirm("Are you sure you want to clear the canvas? This cannot be undone.")) {
      this.nodes = []
      this.connectors = []
      this.selectedNodes = []
      this.saveState()
      this.updateInspector()
      this.render()
    }
  }

  handleKeyDown(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return

    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault()
      this.undo()
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
      e.preventDefault()
      this.redo()
    } else if ((e.ctrlKey || e.metaKey) && e.key === "d") {
      e.preventDefault()
      this.duplicateSelected()
    } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault()
      this.selectAll()
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      this.deleteSelected()
    }
  }

  getNodeAt(x, y) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i]
      if (node.type === "decision") {
        const centerX = node.x + node.width / 2
        const centerY = node.y + node.height / 2
        const dx = Math.abs(x - centerX)
        const dy = Math.abs(y - centerY)
        if (dx / (node.width / 2) + dy / (node.height / 2) <= 1) {
          return node
        }
      } else {
        if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
          return node
        }
      }
    }
    return null
  }

  getResizeHandle(node, x, y) {
    const handleSize = 8
    const handles = [
      { name: "nw", x: node.x, y: node.y },
      { name: "ne", x: node.x + node.width, y: node.y },
      { name: "sw", x: node.x, y: node.y + node.height },
      { name: "se", x: node.x + node.width, y: node.y + node.height },
    ]

    for (const handle of handles) {
      if (Math.abs(x - handle.x) < handleSize && Math.abs(y - handle.y) < handleSize) {
        return handle.name
      }
    }
    return null
  }

  getConnectionHandle(node, x, y) {
    const handleSize = 8
    const handles = [
      { x: node.x + node.width / 2, y: node.y },
      { x: node.x + node.width, y: node.y + node.height / 2 },
      { x: node.x + node.width / 2, y: node.y + node.height },
      { x: node.x, y: node.y + node.height / 2 },
    ]

    for (const handle of handles) {
      if (Math.abs(x - handle.x) < handleSize && Math.abs(y - handle.y) < handleSize) {
        return handle
      }
    }
    return null
  }

  addConnector(fromNode, toNode) {
    const connector = {
      id: this.connectorIdCounter++,
      from: fromNode.id,
      to: toNode.id,
    }
    this.connectors.push(connector)
    this.saveState()
    this.render()
  }

  editNodeText(node) {
    const editor = document.getElementById("textEditor")
    const rect = this.canvas.getBoundingClientRect()

    editor.value = node.text
    editor.style.left = node.x * this.zoom + this.pan.x + rect.left + "px"
    editor.style.top = node.y * this.zoom + this.pan.y + rect.top + "px"
    editor.style.width = node.width * this.zoom + "px"
    editor.style.fontSize = node.fontSize * this.zoom + "px"
    editor.style.display = "block"
    editor.focus()
    editor.select()

    const saveText = () => {
      node.text = editor.value
      editor.style.display = "none"
      this.saveState()
      this.render()
    }

    editor.onblur = saveText
    editor.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        saveText()
      } else if (e.key === "Escape") {
        editor.style.display = "none"
        this.render()
      }
    }
  }

  duplicateSelected() {
    if (this.selectedNodes.length === 0) return

    const newNodes = []
    this.selectedNodes.forEach((node) => {
      const newNode = {
        ...node,
        id: this.nodeIdCounter++,
        x: node.x + 20,
        y: node.y + 20,
      }
      newNodes.push(newNode)
      this.nodes.push(newNode)
    })

    this.selectedNodes = newNodes
    this.saveState()
    this.updateInspector()
    this.render()
  }

  deleteSelected() {
    if (this.selectedNodes.length === 0) return

    const selectedIds = this.selectedNodes.map((n) => n.id)
    this.nodes = this.nodes.filter((n) => !selectedIds.includes(n.id))
    this.connectors = this.connectors.filter((c) => !selectedIds.includes(c.from) && !selectedIds.includes(c.to))

    this.selectedNodes = []
    this.saveState()
    this.updateInspector()
    this.render()
  }

  updateInspector() {
    const content = document.getElementById("inspectorContent")

    if (this.selectedNodes.length === 0) {
      content.innerHTML = '<p class="no-selection">Select a node to edit properties</p>'
      return
    }

    if (this.selectedNodes.length === 1) {
      const node = this.selectedNodes[0]
      content.innerHTML = `
                <div class="property-group">
                    <h4>Content</h4>
                    <div class="property-item">
                        <label>Text</label>
                        <input type="text" class="input" id="nodeText" value="${node.text}">
                    </div>
                    <div class="property-item">
                        <label>Font Size</label>
                        <input type="number" class="input" id="nodeFontSize" value="${node.fontSize}" min="8" max="48">
                    </div>
                </div>
                <div class="property-group">
                    <h4>Style</h4>
                    <div class="property-item">
                        <label>Fill Color</label>
                        <input type="color" class="color-input" id="nodeFillColor" value="${node.fillColor}">
                    </div>
                    <div class="property-item">
                        <label>Border Color</label>
                        <input type="color" class="color-input" id="nodeBorderColor" value="${node.borderColor}">
                    </div>
                    <div class="property-item">
                        <label>Border Radius</label>
                        <input type="number" class="input" id="nodeBorderRadius" value="${node.borderRadius}" min="0" max="50">
                    </div>
                </div>
            `

      document.getElementById("nodeText").addEventListener("input", (e) => {
        node.text = e.target.value
        this.render()
      })

      document.getElementById("nodeFontSize").addEventListener("input", (e) => {
        node.fontSize = Number.parseInt(e.target.value)
        this.render()
      })

      document.getElementById("nodeFillColor").addEventListener("input", (e) => {
        node.fillColor = e.target.value
        this.render()
      })

      document.getElementById("nodeBorderColor").addEventListener("input", (e) => {
        node.borderColor = e.target.value
        this.render()
      })

      document.getElementById("nodeBorderRadius").addEventListener("input", (e) => {
        node.borderRadius = Number.parseInt(e.target.value)
        this.render()
      })
    } else {
      content.innerHTML = `<p class="no-selection">${this.selectedNodes.length} nodes selected</p>`
    }
  }

  toggleGrid() {
    this.showGrid = !this.showGrid
    this.render()
  }

  toggleSnap() {
    this.snapToGrid = !this.snapToGrid
    const btn = document.getElementById("toggleSnapBtn")
    btn.style.opacity = this.snapToGrid ? "1" : "0.5"
  }

  fitToScreen() {
    if (this.nodes.length === 0) return

    let minX = Number.POSITIVE_INFINITY,
      minY = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY,
      maxY = Number.NEGATIVE_INFINITY

    this.nodes.forEach((node) => {
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + node.width)
      maxY = Math.max(maxY, node.y + node.height)
    })

    const padding = 50
    const contentWidth = maxX - minX + padding * 2
    const contentHeight = maxY - minY + padding * 2

    const zoomX = this.canvas.width / contentWidth
    const zoomY = this.canvas.height / contentHeight
    this.zoom = Math.min(zoomX, zoomY, 1)

    this.pan.x = (this.canvas.width - (maxX + minX) * this.zoom) / 2
    this.pan.y = (this.canvas.height - (maxY + minY) * this.zoom) / 2

    this.updateZoomDisplay()
    this.render()
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.save()
    this.ctx.translate(this.pan.x, this.pan.y)
    this.ctx.scale(this.zoom, this.zoom)

    if (this.showGrid) {
      this.drawGrid()
    }
    this.drawConnectors()
    this.drawNodes()

    if (this.isConnecting && this.connectStart && this.currentConnectorEnd) {
      this.drawTemporaryConnector()
    }

    this.ctx.restore()
  }

  drawGrid() {
    const startX = Math.floor(-this.pan.x / this.zoom / this.gridSize) * this.gridSize
    const startY = Math.floor(-this.pan.y / this.zoom / this.gridSize) * this.gridSize
    const endX = startX + this.canvas.width / this.zoom + this.gridSize
    const endY = startY + this.canvas.height / this.zoom + this.gridSize

    this.ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid-color")
    this.ctx.lineWidth = 1 / this.zoom

    for (let x = startX; x < endX; x += this.gridSize) {
      this.ctx.beginPath()
      this.ctx.moveTo(x, startY)
      this.ctx.lineTo(x, endY)
      this.ctx.stroke()
    }

    for (let y = startY; y < endY; y += this.gridSize) {
      this.ctx.beginPath()
      this.ctx.moveTo(startX, y)
      this.ctx.lineTo(endX, y)
      this.ctx.stroke()
    }
  }

  drawNodes() {
    this.nodes.forEach((node) => {
      this.ctx.save()

      if (node.type === "decision") {
        this.ctx.translate(node.x + node.width / 2, node.y + node.height / 2)
        this.ctx.rotate(Math.PI / 4)
        this.ctx.fillStyle = node.fillColor
        this.ctx.fillRect(-node.width / 2, -node.height / 2, node.width, node.height)
        this.ctx.strokeStyle = node.borderColor
        this.ctx.lineWidth = 2
        this.ctx.strokeRect(-node.width / 2, -node.height / 2, node.width, node.height)
        this.ctx.rotate(-Math.PI / 4)
      } else {
        this.ctx.fillStyle = node.fillColor
        this.ctx.strokeStyle = node.borderColor
        this.ctx.lineWidth = 2

        if (node.type === "start" || node.type === "connector") {
          this.roundRect(node.x, node.y, node.width, node.height, node.borderRadius)
        } else if (node.type === "io") {
          this.ctx.beginPath()
          this.ctx.moveTo(node.x + node.width * 0.1, node.y)
          this.ctx.lineTo(node.x + node.width, node.y)
          this.ctx.lineTo(node.x + node.width * 0.9, node.y + node.height)
          this.ctx.lineTo(node.x, node.y + node.height)
          this.ctx.closePath()
          this.ctx.fill()
          this.ctx.stroke()
        } else {
          this.roundRect(node.x, node.y, node.width, node.height, node.borderRadius)
        }
      }

      if (this.selectedNodes.includes(node)) {
        this.ctx.strokeStyle = "#000000"
        this.ctx.lineWidth = 3
        this.ctx.setLineDash([5, 5])
        if (node.type === "decision") {
          this.ctx.strokeRect(-node.width / 2 - 5, -node.height / 2 - 5, node.width + 10, node.height + 10)
        } else {
          this.ctx.strokeRect(node.x - 5, node.y - 5, node.width + 10, node.height + 10)
        }
        this.ctx.setLineDash([])

        this.drawResizeHandles(node)
        this.drawConnectionHandles(node)
      }

      this.ctx.fillStyle = node.borderColor
      this.ctx.font = `${node.fontSize}px sans-serif`
      this.ctx.textAlign = "center"
      this.ctx.textBaseline = "middle"
      this.ctx.fillText(node.text, node.x + node.width / 2, node.y + node.height / 2)

      this.ctx.restore()
    })
  }

  roundRect(x, y, width, height, radius) {
    this.ctx.beginPath()
    this.ctx.moveTo(x + radius, y)
    this.ctx.lineTo(x + width - radius, y)
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    this.ctx.lineTo(x + width, y + height - radius)
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    this.ctx.lineTo(x + radius, y + height)
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    this.ctx.lineTo(x, y + radius)
    this.ctx.quadraticCurveTo(x, y, x + radius, y)
    this.ctx.closePath()
    this.ctx.fill()
    this.ctx.stroke()
  }

  drawResizeHandles(node) {
    const handleSize = 6
    this.ctx.fillStyle = "#000000"
    const handles = [
      { x: node.x, y: node.y },
      { x: node.x + node.width, y: node.y },
      { x: node.x, y: node.y + node.height },
      { x: node.x + node.width, y: node.y + node.height },
    ]

    handles.forEach((handle) => {
      this.ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
    })
  }

  drawConnectionHandles(node) {
    const handleSize = 8
    this.ctx.fillStyle = "#ffffff"
    this.ctx.strokeStyle = "#000000"
    this.ctx.lineWidth = 2

    const handles = [
      { x: node.x + node.width / 2, y: node.y },
      { x: node.x + node.width, y: node.y + node.height / 2 },
      { x: node.x + node.width / 2, y: node.y + node.height },
      { x: node.x, y: node.y + node.height / 2 },
    ]

    handles.forEach((handle) => {
      this.ctx.beginPath()
      this.ctx.arc(handle.x, handle.y, handleSize / 2, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.stroke()
    })
  }

  drawConnectors() {
    this.connectors.forEach((connector) => {
      const fromNode = this.nodes.find((n) => n.id === connector.from)
      const toNode = this.nodes.find((n) => n.id === connector.to)

      if (fromNode && toNode) {
        const fromX = fromNode.x + fromNode.width / 2
        const fromY = fromNode.y + fromNode.height / 2
        const toX = toNode.x + toNode.width / 2
        const toY = toNode.y + toNode.height / 2

        this.drawOrthogonalLine(fromX, fromY, toX, toY)
        this.drawArrow(toX, toY, fromX, fromY)
      }
    })
  }

  drawTemporaryConnector() {
    const fromX = this.connectStart.node.x + this.connectStart.node.width / 2
    const fromY = this.connectStart.node.y + this.connectStart.node.height / 2
    const toX = this.currentConnectorEnd.x
    const toY = this.currentConnectorEnd.y

    this.ctx.strokeStyle = "#000000"
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([5, 5])
    this.drawOrthogonalLine(fromX, fromY, toX, toY)
    this.ctx.setLineDash([])
  }

  drawOrthogonalLine(x1, y1, x2, y2) {
    this.ctx.strokeStyle = "#000000"
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)

    const midX = (x1 + x2) / 2
    this.ctx.lineTo(midX, y1)
    this.ctx.lineTo(midX, y2)
    this.ctx.lineTo(x2, y2)

    this.ctx.stroke()
  }

  drawArrow(x, y, fromX, fromY) {
    const angle = Math.atan2(y - fromY, x - fromX)
    const arrowSize = 10

    this.ctx.fillStyle = "#000000"
    this.ctx.beginPath()
    this.ctx.moveTo(x, y)
    this.ctx.lineTo(x - arrowSize * Math.cos(angle - Math.PI / 6), y - arrowSize * Math.sin(angle - Math.PI / 6))
    this.ctx.lineTo(x - arrowSize * Math.cos(angle + Math.PI / 6), y - arrowSize * Math.sin(angle + Math.PI / 6))
    this.ctx.closePath()
    this.ctx.fill()
  }

  zoomIn() {
    this.zoom = Math.min(3, this.zoom * 1.2)
    this.updateZoomDisplay()
    this.render()
  }

  zoomOut() {
    this.zoom = Math.max(0.1, this.zoom / 1.2)
    this.updateZoomDisplay()
    this.render()
  }

  resetZoom() {
    this.zoom = 1
    this.pan = { x: 0, y: 0 }
    this.updateZoomDisplay()
    this.render()
  }

  updateZoomDisplay() {
    document.getElementById("zoomLevel").textContent = Math.round(this.zoom * 100) + "%"
  }

  saveState() {
    const state = {
      nodes: JSON.parse(JSON.stringify(this.nodes)),
      connectors: JSON.parse(JSON.stringify(this.connectors)),
    }

    this.history = this.history.slice(0, this.historyIndex + 1)
    this.history.push(state)
    this.historyIndex++

    if (this.history.length > 50) {
      this.history.shift()
      this.historyIndex--
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--
      const state = this.history[this.historyIndex]
      this.nodes = JSON.parse(JSON.stringify(state.nodes))
      this.connectors = JSON.parse(JSON.stringify(state.connectors))
      this.selectedNodes = []
      this.updateInspector()
      this.render()
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++
      const state = this.history[this.historyIndex]
      this.nodes = JSON.parse(JSON.stringify(state.nodes))
      this.connectors = JSON.parse(JSON.stringify(state.connectors))
      this.selectedNodes = []
      this.updateInspector()
      this.render()
    }
  }

  showSaveModal() {
    document.getElementById("saveModal").classList.add("active")
  }

  showLoadModal() {
    document.getElementById("loadModal").classList.add("active")
  }

  showHelpModal() {
    document.getElementById("helpModal").classList.add("active")
  }

  showHistoryModal() {
    document.getElementById("historyModal").classList.add("active")
    this.renderHistoryList()
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active")
  }

  downloadJSON() {
    const filename = document.getElementById("saveFileName").value || "flowchart"
    const timestamp = new Date().toISOString()

    const data = {
      name: filename,
      timestamp: timestamp,
      nodes: this.nodes,
      connectors: this.connectors,
    }

    this.savedFlowcharts.push(data)
    this.saveSavedFlowcharts()

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename + ".json"
    a.click()
    URL.revokeObjectURL(url)

    this.closeModal("saveModal")
  }

  loadFromFile(e) {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)
        this.nodes = data.nodes || []
        this.connectors = data.connectors || []
        this.selectedNodes = []
        this.nodeIdCounter = Math.max(...this.nodes.map((n) => n.id), 0) + 1
        this.connectorIdCounter = Math.max(...this.connectors.map((c) => c.id), 0) + 1
        this.saveState()
        this.updateInspector()
        this.render()
        this.closeModal("loadModal")
      } catch (error) {
        alert("Error loading file")
      }
    }
    reader.readAsText(file)
  }

  saveToLocalStorage() {
    const data = {
      nodes: this.nodes,
      connectors: this.connectors,
    }
    localStorage.setItem("flowchart_autosave", JSON.stringify(data))
  }

  loadFromLocalStorage() {
    const saved = localStorage.getItem("flowchart_autosave")
    if (saved) {
      try {
        const data = JSON.parse(saved)
        this.nodes = data.nodes || []
        this.connectors = data.connectors || []
        this.selectedNodes = []
        this.nodeIdCounter = Math.max(...this.nodes.map((n) => n.id), 0) + 1
        this.connectorIdCounter = Math.max(...this.connectors.map((c) => c.id), 0) + 1
        this.saveState()
        this.updateInspector()
        this.render()
        this.closeModal("loadModal")
      } catch (error) {
        console.error("Error loading from localStorage")
      }
    }
  }

  loadSavedFlowcharts() {
    const saved = localStorage.getItem("flowchart_history")
    return saved ? JSON.parse(saved) : []
  }

  saveSavedFlowcharts() {
    localStorage.setItem("flowchart_history", JSON.stringify(this.savedFlowcharts))
  }

  renderHistoryList(filter = "") {
    const historyList = document.getElementById("historyList")
    historyList.innerHTML = ""

    const filtered = this.savedFlowcharts.filter((fc) => fc.name.toLowerCase().includes(filter.toLowerCase()))

    if (filtered.length === 0) {
      historyList.innerHTML = '<p class="no-selection">No saved flowcharts found</p>'
      return
    }

    filtered.reverse().forEach((flowchart, index) => {
      const item = document.createElement("div")
      item.className = "history-item"

      const date = new Date(flowchart.timestamp)
      const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString()

      item.innerHTML = `
        <div class="history-item-info">
          <h4>${flowchart.name}</h4>
          <p>${dateStr}</p>
          <p>${flowchart.nodes.length} nodes, ${flowchart.connectors.length} connectors</p>
        </div>
        <div class="history-item-actions">
          <button class="btn btn-sm" data-action="load" data-index="${this.savedFlowcharts.length - 1 - index}">Load</button>
          <button class="btn btn-sm" data-action="download" data-index="${this.savedFlowcharts.length - 1 - index}">PNG</button>
          <button class="btn btn-sm" data-action="delete" data-index="${this.savedFlowcharts.length - 1 - index}">Delete</button>
        </div>
      `

      historyList.appendChild(item)
    })

    historyList.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const action = e.target.dataset.action
        const index = Number.parseInt(e.target.dataset.index)

        if (action === "load") {
          this.loadFlowchartFromHistory(index)
        } else if (action === "download") {
          this.downloadFlowchartAsPNG(index)
        } else if (action === "delete") {
          this.deleteFlowchartFromHistory(index)
        }
      })
    })
  }

  filterHistory(query) {
    this.renderHistoryList(query)
  }

  loadFlowchartFromHistory(index) {
    const flowchart = this.savedFlowcharts[index]
    this.nodes = JSON.parse(JSON.stringify(flowchart.nodes))
    this.connectors = JSON.parse(JSON.stringify(flowchart.connectors))
    this.selectedNodes = []
    this.nodeIdCounter = Math.max(...this.nodes.map((n) => n.id), 0) + 1
    this.connectorIdCounter = Math.max(...this.connectors.map((c) => c.id), 0) + 1
    this.saveState()
    this.updateInspector()
    this.render()
    this.closeModal("historyModal")
  }

  downloadFlowchartAsPNG(index) {
    const flowchart = this.savedFlowcharts[index]
    const tempNodes = this.nodes
    const tempConnectors = this.connectors

    this.nodes = flowchart.nodes
    this.connectors = flowchart.connectors

    this.exportPNG(flowchart.name)

    this.nodes = tempNodes
    this.connectors = tempConnectors
  }

  deleteFlowchartFromHistory(index) {
    if (confirm("Are you sure you want to delete this flowchart?")) {
      this.savedFlowcharts.splice(index, 1)
      this.saveSavedFlowcharts()
      this.renderHistoryList()
    }
  }

  clearHistory() {
    if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
      this.savedFlowcharts = []
      this.saveSavedFlowcharts()
      this.renderHistoryList()
    }
  }

  startAutoSave() {
    setInterval(() => {
      this.saveToLocalStorage()
    }, 30000)
  }

  exportPNG(filename = "flowchart") {
    const tempCanvas = document.createElement("canvas")
    const tempCtx = tempCanvas.getContext("2d")

    let minX = Number.POSITIVE_INFINITY,
      minY = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY,
      maxY = Number.NEGATIVE_INFINITY
    this.nodes.forEach((node) => {
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + node.width)
      maxY = Math.max(maxY, node.y + node.height)
    })

    const padding = 50
    tempCanvas.width = (maxX - minX + padding * 2) * 2
    tempCanvas.height = (maxY - minY + padding * 2) * 2

    tempCtx.scale(2, 2)
    tempCtx.fillStyle = "#ffffff"
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
    tempCtx.translate(-minX + padding, -minY + padding)

    const originalCtx = this.ctx
    this.ctx = tempCtx
    this.drawConnectors()
    this.drawNodes()
    this.ctx = originalCtx

    tempCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename + ".png"
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  exportSVG() {
    let minX = Number.POSITIVE_INFINITY,
      minY = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY,
      maxY = Number.NEGATIVE_INFINITY
    this.nodes.forEach((node) => {
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + node.width)
      maxY = Math.max(maxY, node.y + node.height)
    })

    const padding = 50
    const width = maxX - minX + padding * 2
    const height = maxY - minY + padding * 2

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    svg += `<rect width="${width}" height="${height}" fill="white"/>`
    svg += `<g transform="translate(${-minX + padding}, ${-minY + padding})">`

    this.connectors.forEach((connector) => {
      const fromNode = this.nodes.find((n) => n.id === connector.from)
      const toNode = this.nodes.find((n) => n.id === connector.to)
      if (fromNode && toNode) {
        const fromX = fromNode.x + fromNode.width / 2
        const fromY = fromNode.y + fromNode.height / 2
        const toX = toNode.x + toNode.width / 2
        const toY = toNode.y + toNode.height / 2
        const midX = (fromX + toX) / 2

        svg += `<path d="M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}" stroke="black" stroke-width="2" fill="none"/>`
      }
    })

    this.nodes.forEach((node) => {
      if (node.type === "decision") {
        const cx = node.x + node.width / 2
        const cy = node.y + node.height / 2
        svg += `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="${node.fillColor}" stroke="${node.borderColor}" stroke-width="2" transform="rotate(45 ${cx} ${cy})"/>`
      } else {
        svg += `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${node.borderRadius}" fill="${node.fillColor}" stroke="${node.borderColor}" stroke-width="2"/>`
      }
      svg += `<text x="${node.x + node.width / 2}" y="${node.y + node.height / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${node.fontSize}" fill="${node.borderColor}">${node.text}</text>`
    })

    svg += `</g></svg>`

    const blob = new Blob([svg], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "flowchart.svg"
    a.click()
    URL.revokeObjectURL(url)
  }

  toggleTheme() {
    document.body.classList.toggle("dark-theme")
    localStorage.setItem("theme", document.body.classList.contains("dark-theme") ? "dark" : "light")
    this.render()
  }
}

const savedTheme = localStorage.getItem("theme")
if (savedTheme === "dark") {
  document.body.classList.add("dark-theme")
}

const app = new FlowchartApp()