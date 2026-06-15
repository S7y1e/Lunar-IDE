--!strict
-- Lunar IDE runtime bridge.
-- Streams Studio output (edit + play-test) and play-test state to the Lunar editor.
--
-- Install: paste into a Script in Studio, then Plugins > Save as Local Plugin.
-- Requires Game Settings > Security > Allow HTTP Requests = ON.

local HttpService = game:GetService("HttpService")
local LogService = game:GetService("LogService")
local RunService = game:GetService("RunService")

local ENDPOINT = "http://127.0.0.1:34900/log"
local FLUSH_INTERVAL = 0.3

local TYPE_MAP = {
	[Enum.MessageType.MessageOutput] = "output",
	[Enum.MessageType.MessageInfo] = "info",
	[Enum.MessageType.MessageWarning] = "warning",
	[Enum.MessageType.MessageError] = "error",
}

local queue: { any } = {}

local function record(text: string, messageType: Enum.MessageType, time: number)
	table.insert(queue, {
		text = text,
		type = TYPE_MAP[messageType] or "output",
		time = time,
	})
end

-- Backfill recent output so messages logged before we connected aren't lost.
for _, entry in ipairs(LogService:GetLogHistory()) do
	record(entry.message, entry.messageType, entry.timestamp)
end

LogService.MessageOut:Connect(function(message, messageType)
	record(message, messageType, os.clock())
end)

local function post(body: { [string]: any })
	pcall(function()
		HttpService:RequestAsync({
			Url = ENDPOINT,
			Method = "POST",
			Headers = { ["Content-Type"] = "application/json" },
			Body = HttpService:JSONEncode(body),
		})
	end)
end

-- Flush queued output, and report play-test state whenever it flips. The plugin
-- follows the active DataModel, so IsRunning() reflects edit vs play-test.
local lastRunning: boolean? = nil
while true do
	task.wait(FLUSH_INTERVAL)
	local running = RunService:IsRunning()
	local changed = running ~= lastRunning
	lastRunning = running
	if #queue > 0 or changed then
		local batch = queue
		queue = {}
		post({ messages = batch, running = running })
	end
end
