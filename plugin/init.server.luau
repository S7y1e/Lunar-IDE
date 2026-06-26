--!strict
local HttpService        = game:GetService("HttpService")
local LogService         = game:GetService("LogService")
local RunService         = game:GetService("RunService")
local ReplicatedStorage  = game:GetService("ReplicatedStorage")
local Selection          = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

local RELAY_NAME = "_LunarLogRelay"
local ENDPOINT   = "http://127.0.0.1:34900"

local context = if RunService:IsEdit() then "edit"
	elseif RunService:IsClient() then "client"
	else "server"

local LEVEL: { [Enum.MessageType]: string } = {
	[Enum.MessageType.MessageOutput]  = "output",
	[Enum.MessageType.MessageInfo]    = "info",
	[Enum.MessageType.MessageWarning] = "warning",
	[Enum.MessageType.MessageError]   = "error",
}

-- ── toolbar ────────────────────────────────────────────────────────────────
local toolbar    = plugin:CreateToolbar("Lunar")
local toolsBtn   = toolbar:CreateButton("Tools",  "Open Lunar Tools",  "")
local bridgeBtn  = toolbar:CreateButton("Bridge", "Toggle bridge info", "")

-- ── bridge ─────────────────────────────────────────────────────────────────
local handleCommand: (raw: string) -> ()

local postOk = true
local function post(body: { [string]: any })
	local ok, response = pcall(function()
		return HttpService:PostAsync(ENDPOINT, HttpService:JSONEncode(body), Enum.HttpContentType.ApplicationJson)
	end)
	if ok ~= postOk then
		postOk = ok
		if not ok then warn(`[Lunar] POST failed ({context}): {response}`) end
	end
	if ok and response and response ~= "[]" then
		local decoded, cmds = pcall(function() return HttpService:JSONDecode(response) end)
		if decoded and type(cmds) == "table" then
			for _, raw in cmds do pcall(handleCommand, raw) end
		end
	end
end

local ROOTS: { [string]: any } = { game = game, workspace = workspace, Enum = Enum, plugin = plugin }

local function pathEval(code: string): (boolean, string)
	local expr = code:gsub("^%s+", ""):gsub("%s+$", "")
	local wantLen = false
	if expr:sub(1,1) == "#" then wantLen = true; expr = expr:sub(2):gsub("^%s+", "") end
	local root, rest = expr:match("^([%a_][%w_]*)(.*)$")
	if not root or ROOTS[root] == nil then
		return false, "Lunar eval: only property paths; calls/math need a play-test"
	end
	local current: any = ROOTS[root]
	while rest ~= "" do
		local key, after = rest:match("^%.([%a_][%w_]*)(.*)$")
		if not key then
			local idx; idx, after = rest:match("^%[\"([^\"]*)\"%](.*)$")
			if not idx then
				local num; num, after = rest:match("^%[(%d+)%](.*)$")
				if num then idx = tonumber(num) end
			end
			if idx == nil then return false, "Lunar eval: only property paths; calls/math need a play-test" end
			key = idx
		end
		local ok, value = pcall(function() return (current :: any)[key] end)
		if not ok then return false, tostring(value) end
		current = value; rest = after
	end
	if wantLen then
		local ok, len = pcall(function() return #current end)
		if not ok then return false, tostring(len) end
		return true, tostring(len)
	end
	return true, tostring(current)
end

local function evalExpr(code: string): (boolean, string)
	local compiled, fn = pcall(function()
		return loadstring("return " .. code) or loadstring(code)
	end)
	if not compiled or not fn then return pathEval(code) end
	local results = table.pack(pcall(fn))
	if not results[1] then return false, tostring(results[2]) end
	local parts = {}
	for i = 2, results.n do table.insert(parts, tostring(results[i])) end
	return true, table.concat(parts, ", ")
end

local function resolveInstance(path: string): (Instance?, string?)
	local rest = path:gsub("^%s+", ""):gsub("%s+$", "")
	local root, after = rest:match("^([%a_][%w_]*)(.*)$")
	if not root or ROOTS[root] == nil then return nil, `Lunar tests: unknown root in "{path}"` end
	local current: any = ROOTS[root]
	rest = after
	while rest ~= "" do
		local key; key, after = rest:match("^%.([%a_][%w_]*)(.*)$")
		if not key then key, after = rest:match('^%["([^"]*)"%](.*)$') end
		if not key then return nil, `Lunar tests: bad segment in "{path}"` end
		local ok, value = pcall(function() return (current :: any)[key] end)
		if not ok or value == nil then return nil, `Lunar tests: "{path}" not found` end
		current = value; rest = after
	end
	if typeof(current) ~= "Instance" then return nil, `Lunar tests: "{path}" is not an Instance` end
	return current, nil
end

local function stringifyErrors(errors: any): { string }
	local out: { string } = {}
	if type(errors) == "table" then for _, e in errors do table.insert(out, tostring(e)) end end
	return out
end

local function serializeResult(node: any): any
	local plan = node.planNode
	local children: { any } = {}
	for _, child in node.children do table.insert(children, serializeResult(child)) end
	return { phrase=(plan and plan.phrase) or "", nodeType=(plan and tostring(plan.type)) or "",
		status=tostring(node.status), errors=stringifyErrors(node.errors), children=children }
end

local function runTests(cmd: any)
	if type(cmd.testez) ~= "string" then
		post({ testResults = { error = "No [test] testez path set in lunar.toml" } }); return
	end
	local testez, err = resolveInstance(cmd.testez)
	if not testez then post({ testResults = { error = err } }); return end
	local roots: { Instance } = {}
	if type(cmd.roots) == "table" then
		for _, p in cmd.roots do
			if type(p) == "string" then
				local inst, rerr = resolveInstance(p)
				if not inst then post({ testResults = { error = rerr } }); return end
				table.insert(roots, inst)
			end
		end
	end
	if #roots == 0 then post({ testResults = { error = "No [test] roots set in lunar.toml" } }); return end
	local reqOk, TestEZ = pcall(require, testez :: any)
	if not reqOk then
		post({ testResults = { error = `require(TestEZ) failed: {tostring(TestEZ)}` } }); return
	end
	local clones: { Instance } = {}
	for _, r in roots do
		local c = r:Clone(); c.Parent = r.Parent; table.insert(clones, c)
	end
	local runOk, results = pcall(function()
		return (TestEZ :: any).TestBootstrap:run(clones, { report = function() end })
	end)
	for _, c in clones do c:Destroy() end
	if not runOk then
		post({ testResults = { error = `TestEZ run failed: {tostring(results)}` } }); return
	end
	local children: { any } = {}
	for _, n in results.children do table.insert(children, serializeResult(n)) end
	post({ testResults = { successCount=results.successCount, failureCount=results.failureCount,
		skippedCount=results.skippedCount, errors=stringifyErrors(results.errors), children=children } })
end

local watches: { [string]: string } = {}

function handleCommand(raw: string)
	local ok, cmd = pcall(function() return HttpService:JSONDecode(raw) end)
	if not ok or type(cmd) ~= "table" then return end
	if cmd.type == "eval" and type(cmd.code) == "string" then
		local success, display = evalExpr(cmd.code)
		if not success then warn(`[Lunar] {display}`)
		elseif display ~= "" then print(`[Lunar] {display}`) end
	elseif cmd.type == "setWatches" and type(cmd.watches) == "table" then
		table.clear(watches)
		for _, w in cmd.watches do
			if type(w) == "table" and type(w.id) == "string" and type(w.expr) == "string" then
				watches[w.id] = w.expr
			end
		end
	elseif cmd.type == "runTests" then
		runTests(cmd)
	end
end

local relay: RemoteEvent? = nil
if context == "server" then
	relay = Instance.new("RemoteEvent")
	relay.Name = RELAY_NAME; relay.Parent = ReplicatedStorage
	relay.OnServerEvent:Connect(function(_player, batch)
		if type(batch) == "table" then post({ messages = batch }) end
	end)
elseif context == "client" then
	relay = ReplicatedStorage:FindFirstChild(RELAY_NAME) :: RemoteEvent?
		or ReplicatedStorage:WaitForChild(RELAY_NAME, 5) :: RemoteEvent?
end

local function ship(batch: { any })
	if context == "client" then
		if relay then relay:FireServer(batch) end
	else
		post({ messages = batch })
	end
end

local queue: { { text: string, type: string, time: number } } = {}
local sent = 0
if RunService:IsEdit() then
	local ok, history = pcall(function() return LogService:GetLogHistory() end)
	if ok and type(history) == "table" then sent = #history end
end

local function drainLog()
	local ok, history = pcall(function() return LogService:GetLogHistory() end)
	if not ok or type(history) ~= "table" then return end
	if #history < sent then sent = 0 end
	for i = sent + 1, #history do
		local entry = history[i]
		table.insert(queue, { text=entry.message, type=LEVEL[entry.messageType] or "output", time=entry.timestamp })
	end
	sent = #history
end

task.spawn(function()
	while true do
		task.wait(0.2); drainLog()
		if #queue > 0 then local batch = queue; queue = {}; ship(batch) end
	end
end)

if context ~= "client" then
	task.spawn(function()
		while true do post({ running = not RunService:IsEdit() }); task.wait(0.5) end
	end)
	task.spawn(function()
		while true do
			task.wait(0.5)
			local results: { { id: string, value: string, ok: boolean } } = {}
			for id, expr in watches do
				local ok, display = evalExpr(expr)
				table.insert(results, { id=id, value=display, ok=ok })
			end
			if #results > 0 then post({ evalWatches = results }) end
		end
	end)
end

-- ── Widget (edit-context only) ──────────────────────────────────────────────
if context ~= "edit" then
	print("[Lunar] bridge loaded")
	return
end
print("[Lunar] bridge loaded")

local widget = plugin:CreateDockWidgetPluginGui("LunarTools",
	DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, true, false, 240, 560, 240, 560))
widget.Title = "Lunar"

toolsBtn.Click:Connect(function() widget.Enabled = not widget.Enabled end)
bridgeBtn.Click:Connect(function() end) -- kept for compat, no-op

-- palette
local C = {
	bg      = Color3.fromRGB(28,  28,  30),
	surface = Color3.fromRGB(44,  44,  46),
	raised  = Color3.fromRGB(58,  58,  60),
	accent  = Color3.fromRGB(80,  140, 255),
	text    = Color3.fromRGB(230, 230, 230),
	dim     = Color3.fromRGB(140, 140, 140),
	border  = Color3.fromRGB(66,  66,  68),
	red     = Color3.fromRGB(255, 80,  80),
	green   = Color3.fromRGB(80,  200, 120),
}

local function mk(cls: string, props: { [string]: any }, parent: Instance?): any
	local i = Instance.new(cls) :: any
	for k, v in props do i[k] = v end
	if parent then i.Parent = parent end
	return i
end

local function pad(inst: Instance, px: number)
	mk("UIPadding", {
		PaddingLeft=UDim.new(0,px), PaddingRight=UDim.new(0,px),
		PaddingTop=UDim.new(0,px), PaddingBottom=UDim.new(0,px),
	}, inst)
end

local function vlist(inst: Instance, gap: number)
	mk("UIListLayout", { SortOrder=Enum.SortOrder.LayoutOrder, Padding=UDim.new(0,gap), FillDirection=Enum.FillDirection.Vertical }, inst)
end

local function hlist(inst: Instance, gap: number)
	mk("UIListLayout", { SortOrder=Enum.SortOrder.LayoutOrder, Padding=UDim.new(0,gap), FillDirection=Enum.FillDirection.Horizontal }, inst)
end

local function corner(inst: Instance, r: number)
	mk("UICorner", { CornerRadius=UDim.new(0,r) }, inst)
end

local function label(parent: Instance, text: string, props: { [string]: any }?): TextLabel
	local p: { [string]: any } = {
		Text=text, TextColor3=C.text, BackgroundTransparency=1,
		Font=Enum.Font.Gotham, TextSize=11, RichText=true,
	}
	if props then for k,v in props do p[k] = v end end
	return mk("TextLabel", p, parent) :: TextLabel
end

local function btn(parent: Instance, text: string, props: { [string]: any }?): TextButton
	local p: { [string]: any } = {
		Text=text, TextColor3=C.text, Font=Enum.Font.Gotham, TextSize=11,
		BackgroundColor3=C.raised, BorderSizePixel=0, AutoButtonColor=true,
	}
	if props then for k,v in props do p[k] = v end end
	local b = mk("TextButton", p, parent) :: TextButton
	corner(b, 4)
	return b
end

local function sectionHeader(parent: Instance, text: string, order: number): Frame
	local f: Frame = mk("Frame", {
		Size=UDim2.new(1,0,0,0), AutomaticSize=Enum.AutomaticSize.Y,
		BackgroundTransparency=1, LayoutOrder=order,
	}, parent)
	vlist(f, 4)
	label(f, text, { Size=UDim2.new(1,0,0,13), TextColor3=C.dim, TextSize=10,
		Font=Enum.Font.GothamBold, TextXAlignment=Enum.TextXAlignment.Left })
	return f
end

-- root scroll
local rootFrame: Frame = mk("Frame", { Size=UDim2.fromScale(1,1), BackgroundColor3=C.bg, BorderSizePixel=0 }, widget)
local scroll: ScrollingFrame = mk("ScrollingFrame", {
	Size=UDim2.fromScale(1,1), BackgroundTransparency=1, BorderSizePixel=0,
	ScrollBarThickness=4, ScrollBarImageColor3=C.border,
	CanvasSize=UDim2.new(0,0,0,0), AutomaticCanvasSize=Enum.AutomaticSize.Y,
}, rootFrame)
pad(scroll, 8)
vlist(scroll, 10)

-- ── 1. Container ────────────────────────────────────────────────────────────
local containerSection = sectionHeader(scroll, "CONTAINER", 1)
local containerBtnEl = btn(containerSection, "Pick from selection",
	{ Size=UDim2.new(1,0,0,28), TextColor3=C.dim })

local container: GuiObject? = nil

local function updateContainerLabel()
	if container then
		local s = (container :: any).AbsoluteSize :: Vector2
		containerBtnEl.Text = container.Name .. " (" .. math.round(s.X) .. "×" .. math.round(s.Y) .. ")"
		containerBtnEl.TextColor3 = C.text
	else
		containerBtnEl.Text = "Pick from selection"
		containerBtnEl.TextColor3 = C.dim
	end
end

containerBtnEl.MouseButton1Click:Connect(function()
	local sel = Selection:Get()
	for _, inst in sel do
		if inst:IsA("GuiObject") then
			container = inst :: GuiObject
			updateContainerLabel()
			return
		end
	end
end)

-- ── 2. Anchor Position ──────────────────────────────────────────────────────
local anchorSection = sectionHeader(scroll, "ANCHOR POSITION", 2)
local anchorCard: Frame = mk("Frame", {
	Size=UDim2.new(1,0,0,84), BackgroundColor3=C.surface, BorderSizePixel=0,
}, anchorSection)
corner(anchorCard, 6)

local anchorGrid: Frame = mk("Frame", {
	Size=UDim2.new(0,72,0,72),
	Position=UDim2.new(0.5,0,0.5,0), AnchorPoint=Vector2.new(0.5,0.5),
	BackgroundTransparency=1,
}, anchorCard)
mk("UIGridLayout", { CellSize=UDim2.new(0,20,0,20), CellPaddingSize=UDim2.new(0,6,0,6) }, anchorGrid)

type AnchorDef = { number }
local ANCHOR_DEFS: { AnchorDef } = {
	{0,0},{0.5,0},{1,0},
	{0,0.5},{0.5,0.5},{1,0.5},
	{0,1},{0.5,1},{1,1},
}
local anchorBtns: { TextButton } = {}
local activeAnchorBtn: TextButton? = nil

for _, a in ANCHOR_DEFS do
	local ab: TextButton = mk("TextButton", {
		Size=UDim2.new(0,20,0,20), Text="",
		BackgroundColor3=C.border, BorderSizePixel=0, AutoButtonColor=false,
	}, anchorGrid)
	corner(ab, 10)
	local dot: Frame = mk("Frame", {
		Size=UDim2.new(0,7,0,7),
		Position=UDim2.fromScale(0.5,0.5), AnchorPoint=Vector2.new(0.5,0.5),
		BackgroundColor3=C.dim, BorderSizePixel=0,
	}, ab)
	corner(dot, 4)
	table.insert(anchorBtns, ab)

	local ax, ay = a[1], a[2]
	ab.MouseButton1Click:Connect(function()
		ChangeHistoryService:SetWaypoint("LunarSetAnchor")
		for _, inst in Selection:Get() do
			if inst:IsA("GuiObject") then
				local go = inst :: GuiObject
				-- shift position so the element stays in place visually
				local sz = go.Size
				local oldA = go.AnchorPoint
				local newA = Vector2.new(ax, ay)
				local delta = (newA - oldA)
				local pos = go.Position
				go.Position = UDim2.new(
					pos.X.Scale + delta.X * sz.X.Scale,
					pos.X.Offset + delta.X * sz.X.Offset,
					pos.Y.Scale + delta.Y * sz.Y.Scale,
					pos.Y.Offset + delta.Y * sz.Y.Offset
				)
				go.AnchorPoint = newA
			end
		end
		ChangeHistoryService:SetWaypoint("LunarSetAnchor")
		if activeAnchorBtn then
			activeAnchorBtn.BackgroundColor3 = C.border
			local d = activeAnchorBtn:FindFirstChildWhichIsA("Frame") :: Frame?
			if d then d.BackgroundColor3 = C.dim end
		end
		ab.BackgroundColor3 = C.accent
		dot.BackgroundColor3 = Color3.fromRGB(255,255,255)
		activeAnchorBtn = ab
	end)
end

-- ── 3. Position & Size ───────────────────────────────────────────────────────
local posSection = sectionHeader(scroll, "POSITION & SIZE", 3)

local posInfoCard: Frame = mk("Frame", {
	Size=UDim2.new(1,0,0,80), BackgroundColor3=C.surface, BorderSizePixel=0,
}, posSection)
corner(posInfoCard, 6)
pad(posInfoCard, 8)

local posGrid: Frame = mk("Frame", {
	Size=UDim2.fromScale(1,1), BackgroundTransparency=1,
}, posInfoCard)
mk("UIGridLayout", {
	CellSize=UDim2.new(0.5,-4,0,28), CellPaddingSize=UDim2.new(0,8,0,4),
	FillDirectionMaxCells=2, SortOrder=Enum.SortOrder.LayoutOrder,
}, posGrid)

local posLabels: { TextLabel } = {}
for _, pair in { {"X","0"}, {"Y","0"}, {"W","0"}, {"H","0"} } do
	local cell: Frame = mk("Frame", { BackgroundColor3=C.raised, BorderSizePixel=0 }, posGrid)
	corner(cell, 4)
	label(cell, pair[1], {
		Size=UDim2.new(0,16,1,0), TextColor3=C.dim, TextSize=10,
		Font=Enum.Font.GothamBold, TextXAlignment=Enum.TextXAlignment.Center,
	})
	local v = label(cell, pair[2], {
		Size=UDim2.new(1,-16,1,0), Position=UDim2.new(0,16,0,0),
		TextXAlignment=Enum.TextXAlignment.Left, TextSize=11,
	})
	table.insert(posLabels, v)
end

-- nudge amount row
local nudgeRow: Frame = mk("Frame", {
	Size=UDim2.new(1,0,0,24), BackgroundTransparency=1,
}, posSection)
hlist(nudgeRow, 6)
label(nudgeRow, "Nudge px", { Size=UDim2.new(0,54,1,0), TextColor3=C.dim, TextSize=10 })
local nudgeBox: TextBox = mk("TextBox", {
	Size=UDim2.new(0,48,1,0), Text="1", TextColor3=C.text,
	Font=Enum.Font.Gotham, TextSize=11, ClearTextOnFocus=false,
	BackgroundColor3=C.raised, BorderSizePixel=0,
}, nudgeRow)
corner(nudgeBox, 4)
btn(nudgeRow, "Reset", { Size=UDim2.new(0,44,1,0) }).MouseButton1Click:Connect(function()
	nudgeBox.Text = "1"
end)

local function nudgeAmt(): number
	return tonumber(nudgeBox.Text) or 1
end

-- ── 4. Move / Resize ─────────────────────────────────────────────────────────
local moveSection = sectionHeader(scroll, "MOVE & RESIZE", 4)
local moveResize: Frame = mk("Frame", {
	Size=UDim2.new(1,0,0,0), AutomaticSize=Enum.AutomaticSize.Y,
	BackgroundTransparency=1,
}, moveSection)
hlist(moveResize, 8)

local function arrowBlock(parent: Instance, title: string): Frame
	local block: Frame = mk("Frame", {
		Size=UDim2.new(0.5,-4,0,0), AutomaticSize=Enum.AutomaticSize.Y,
		BackgroundTransparency=1,
	}, parent)
	vlist(block, 4)
	label(block, title, { Size=UDim2.new(1,0,0,14), TextColor3=C.dim, TextSize=10,
		TextXAlignment=Enum.TextXAlignment.Center })
	local grid: Frame = mk("Frame", { Size=UDim2.new(1,0,0,74), BackgroundTransparency=1 }, block)
	mk("UIGridLayout", { CellSize=UDim2.new(0,22,0,22), CellPaddingSize=UDim2.new(0,4,0,4),
		HorizontalAlignment=Enum.HorizontalAlignment.Center,
		VerticalAlignment=Enum.VerticalAlignment.Center,
	}, grid)
	return grid
end

local function arrowBtn(parent: Instance, text: string, action: () -> ()): TextButton
	local b = btn(parent, text, {
		Size=UDim2.new(0,22,0,22), Font=Enum.Font.GothamBold, TextSize=12,
		BackgroundColor3=C.raised,
	})
	b.MouseButton1Click:Connect(action)
	return b
end

local function applyMove(dx: number, dy: number)
	local amt = nudgeAmt()
	ChangeHistoryService:SetWaypoint("LunarMove")
	for _, inst in Selection:Get() do
		if inst:IsA("GuiObject") then
			local go = inst :: GuiObject
			go.Position = UDim2.new(go.Position.X.Scale, go.Position.X.Offset + dx*amt,
				go.Position.Y.Scale, go.Position.Y.Offset + dy*amt)
		end
	end
	ChangeHistoryService:SetWaypoint("LunarMove")
end

local function applyResize(dw: number, dh: number)
	local amt = nudgeAmt()
	ChangeHistoryService:SetWaypoint("LunarResize")
	for _, inst in Selection:Get() do
		if inst:IsA("GuiObject") then
			local go = inst :: GuiObject
			go.Size = UDim2.new(go.Size.X.Scale, go.Size.X.Offset + dw*amt,
				go.Size.Y.Scale, go.Size.Y.Offset + dh*amt)
		end
	end
	ChangeHistoryService:SetWaypoint("LunarResize")
end

local moveGrid  = arrowBlock(moveResize, "Move")
local resizeGrid = arrowBlock(moveResize, "Resize")

-- placeholder cells for grid alignment (top-left, top-right = empty)
local function spacer(parent: Instance)
	mk("Frame", { BackgroundTransparency=1, Size=UDim2.new(0,22,0,22) }, parent)
end

-- Move arrows (3×3 with diagonals suppressed via spacers)
spacer(moveGrid);  arrowBtn(moveGrid, "↑", function() applyMove(0,-1) end);  spacer(moveGrid)
arrowBtn(moveGrid, "←", function() applyMove(-1,0) end)
mk("Frame", { BackgroundTransparency=1, Size=UDim2.new(0,22,0,22) }, moveGrid) -- center
arrowBtn(moveGrid, "→", function() applyMove(1,0) end)
spacer(moveGrid);  arrowBtn(moveGrid, "↓", function() applyMove(0,1) end);   spacer(moveGrid)

-- Resize arrows
spacer(resizeGrid); arrowBtn(resizeGrid, "↑", function() applyResize(0,-1) end); spacer(resizeGrid)
arrowBtn(resizeGrid, "←", function() applyResize(-1,0) end)
spacer(resizeGrid)
arrowBtn(resizeGrid, "→", function() applyResize(1,0) end)
spacer(resizeGrid); arrowBtn(resizeGrid, "↓", function() applyResize(0,1) end);  spacer(resizeGrid)

-- Expand toggle
local expandRow: Frame = mk("Frame", { Size=UDim2.new(1,0,0,28), BackgroundTransparency=1 }, moveSection)
hlist(expandRow, 6)
label(expandRow, "Expand to parent", { Size=UDim2.new(1,-72,1,0), TextColor3=C.dim, TextSize=10 })
local expandBtn = btn(expandRow, "OFF", {
	Size=UDim2.new(0,60,1,0), BackgroundColor3=C.raised, TextColor3=C.dim,
})
expandBtn.MouseButton1Click:Connect(function()
	local active = expandBtn.Text == "ON"
	expandBtn.Text = if active then "OFF" else "ON"
	expandBtn.BackgroundColor3 = if active then C.raised else C.accent
	expandBtn.TextColor3 = if active then C.dim else C.text
	if not active then
		ChangeHistoryService:SetWaypoint("LunarExpand")
		for _, inst in Selection:Get() do
			if inst:IsA("GuiObject") then
				local go = inst :: GuiObject
				go.Size = UDim2.fromScale(1,1)
				go.Position = UDim2.fromScale(0,0)
				go.AnchorPoint = Vector2.new(0,0)
			end
		end
		ChangeHistoryService:SetWaypoint("LunarExpand")
	end
end)

-- ── 5. Class Converter ───────────────────────────────────────────────────────
local classSection = sectionHeader(scroll, "CLASS CONVERTER", 5)
local classInfo = label(classSection, "Select a GuiObject",
	{ Size=UDim2.new(1,0,0,16), TextColor3=C.dim, TextSize=10,
	  TextXAlignment=Enum.TextXAlignment.Left })

local CLASS_TARGETS = {
	{"Frame","Frame"}, {"ScrollingFrame","Scroll"},
	{"CanvasGroup","Canvas"}, {"TextLabel","TextLabel"},
	{"TextButton","TextButton"}, {"TextBox","TextBox"},
	{"ImageLabel","ImageLabel"}, {"ImageButton","ImageButton"},
	{"ViewportFrame","Viewport"}, {"BillboardGui","Billboard"},
}

local GUI_PROPS = {
	"Position","Size","AnchorPoint","Rotation","Visible","ZIndex","LayoutOrder",
	"BackgroundColor3","BackgroundTransparency","BorderSizePixel","ClipsDescendants",
	"Name","Active","AutoLocalize",
}
local TEXT_PROPS = {
	"Text","TextColor3","Font","FontFace","TextSize","TextScaled","TextWrapped",
	"TextXAlignment","TextYAlignment","LineHeight","RichText",
}
local IMAGE_PROPS = {
	"Image","ImageColor3","ImageTransparency","ImageRectOffset","ImageRectSize",
	"ResampleMode","ScaleType","SliceCenter","SliceScale",
}
local TEXT_CLASSES = { TextLabel=true, TextButton=true, TextBox=true }
local IMAGE_CLASSES = { ImageLabel=true, ImageButton=true }

local function copyProps(from: Instance, to: Instance, list: { string })
	for _, p in list do
		pcall(function() (to :: any)[p] = (from :: any)[p] end)
	end
end

local function convertInstance(inst: Instance, targetClass: string): Instance?
	if inst.ClassName == targetClass then return nil end
	local new: Instance = Instance.new(targetClass)
	copyProps(inst, new, GUI_PROPS)
	if TEXT_CLASSES[inst.ClassName] and TEXT_CLASSES[targetClass] then
		copyProps(inst, new, TEXT_PROPS)
	end
	if IMAGE_CLASSES[inst.ClassName] and IMAGE_CLASSES[targetClass] then
		copyProps(inst, new, IMAGE_PROPS)
	end
	-- move children (skip UICorner/UIStroke etc — they re-add themselves)
	local kids: { Instance } = inst:GetChildren()
	for _, k in kids do k.Parent = new end
	new.Parent = inst.Parent
	inst:Destroy()
	return new
end

local classGrid: Frame = mk("Frame", {
	Size=UDim2.new(1,0,0,0), AutomaticSize=Enum.AutomaticSize.Y, BackgroundTransparency=1,
}, classSection)
mk("UIGridLayout", {
	CellSize=UDim2.new(0.5,-4,0,28), CellPaddingSize=UDim2.new(0,4,0,4),
	FillDirectionMaxCells=2, SortOrder=Enum.SortOrder.LayoutOrder,
}, classGrid)

local classBtns: { { btn: TextButton, cls: string } } = {}
for i, entry in CLASS_TARGETS do
	local cls, lbl = entry[1], entry[2]
	local b = btn(classGrid, lbl, {
		Size=UDim2.new(0.5,-2,0,28), BackgroundColor3=C.surface,
		LayoutOrder=i,
	})
	b.MouseButton1Click:Connect(function()
		local sel = Selection:Get()
		if #sel == 0 then return end
		ChangeHistoryService:SetWaypoint("LunarConvert")
		local newSel: { Instance } = {}
		for _, inst in sel do
			local result = convertInstance(inst, cls)
			table.insert(newSel, result or inst)
		end
		ChangeHistoryService:SetWaypoint("LunarConvert")
		Selection:Set(newSel)
	end)
	table.insert(classBtns, { btn=b, cls=cls })
end

-- ── 6. Log ───────────────────────────────────────────────────────────────────
local logSection = sectionHeader(scroll, "LOG", 6)
local logHeader: Frame = mk("Frame", { Size=UDim2.new(1,0,0,22), BackgroundTransparency=1 }, logSection)
hlist(logHeader, 0)
label(logHeader, "", { Size=UDim2.new(1,-48,1,0) })
local clearBtn = btn(logHeader, "Clear", { Size=UDim2.new(0,44,1,0), TextColor3=C.dim, BackgroundColor3=C.raised })

local logFrame: ScrollingFrame = mk("ScrollingFrame", {
	Size=UDim2.new(1,0,0,120), BackgroundColor3=C.surface, BorderSizePixel=0,
	ScrollBarThickness=3, ScrollBarImageColor3=C.border,
	CanvasSize=UDim2.new(0,0,0,0), AutomaticCanvasSize=Enum.AutomaticSize.Y,
}, logSection)
corner(logFrame, 4)
pad(logFrame, 4)
vlist(logFrame, 2)

local LOG_COLORS: { [string]: Color3 } = {
	output  = C.text,
	info    = C.text,
	warning = Color3.fromRGB(255, 200, 60),
	error   = C.red,
}
local MAX_LOG_LINES = 80
local logLines: { TextLabel } = {}

local function appendLog(text: string, kind: string)
	if #logLines >= MAX_LOG_LINES then
		logLines[1]:Destroy()
		table.remove(logLines, 1)
	end
	local ln = label(logFrame, text, {
		Size=UDim2.new(1,0,0,0), AutomaticSize=Enum.AutomaticSize.Y,
		TextColor3=LOG_COLORS[kind] or C.text, TextSize=10,
		TextXAlignment=Enum.TextXAlignment.Left, TextWrapped=true,
	})
	table.insert(logLines, ln)
	-- scroll to bottom
	task.defer(function()
		logFrame.CanvasPosition = Vector2.new(0, math.max(0, logFrame.AbsoluteCanvasSize.Y - logFrame.AbsoluteSize.Y))
	end)
end

clearBtn.MouseButton1Click:Connect(function()
	for _, ln in logLines do ln:Destroy() end
	table.clear(logLines)
end)

-- hook LogService to mirror into the widget log
LogService.MessageOut:Connect(function(msg, msgType)
	local kind = LEVEL[msgType] or "output"
	appendLog(msg, kind)
end)

-- ── Selection → update UI ───────────────────────────────────────────────────
local function updateSelection()
	local sel = Selection:Get()
	local guiSel: { GuiObject } = {}
	for _, inst in sel do
		if inst:IsA("GuiObject") then table.insert(guiSel, inst :: GuiObject) end
	end

	if #guiSel == 0 then
		classInfo.Text = "Select a GuiObject"
		for _, entry in classBtns do
			entry.btn.BackgroundColor3 = C.surface
			entry.btn.TextColor3 = C.dim
		end
		posLabels[1].Text = "—"; posLabels[2].Text = "—"
		posLabels[3].Text = "—"; posLabels[4].Text = "—"
		return
	end

	-- class info label
	local classes: { [string]: number } = {}
	for _, go in guiSel do
		classes[go.ClassName] = (classes[go.ClassName] or 0) + 1
	end
	local parts: { string } = {}
	for cls, n in classes do table.insert(parts, n .. " " .. cls) end
	classInfo.Text = table.concat(parts, ", ")

	-- highlight matching class buttons
	local firstClass = guiSel[1].ClassName
	for _, entry in classBtns do
		local active = entry.cls == firstClass
		entry.btn.BackgroundColor3 = if active then C.accent else C.surface
		entry.btn.TextColor3 = if active then Color3.fromRGB(255,255,255) else C.text
	end

	-- position/size of first selected
	local go = guiSel[1]
	local ap = go.AbsolutePosition
	local as = go.AbsoluteSize
	posLabels[1].Text = tostring(math.round(ap.X))
	posLabels[2].Text = tostring(math.round(ap.Y))
	posLabels[3].Text = tostring(math.round(as.X))
	posLabels[4].Text = tostring(math.round(as.Y))
end

Selection.SelectionChanged:Connect(updateSelection)
updateSelection()
