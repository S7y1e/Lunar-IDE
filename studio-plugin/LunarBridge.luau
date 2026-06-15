--!strict
-- Lunar IDE runtime bridge.
-- Streams Studio output (edit + play-test) to the Lunar editor.
--
-- Install: paste into a Script in Studio, then Plugins > Save as Local Plugin.
-- Requires Game Settings > Security > Allow HTTP Requests = ON.

local HttpService = game:GetService("HttpService")
local LogService = game:GetService("LogService")

local ENDPOINT = "http://127.0.0.1:34900/log"
local FLUSH_INTERVAL = 0.3

local TYPE_MAP = {
	[Enum.MessageType.MessageOutput] = "output",
	[Enum.MessageType.MessageInfo] = "info",
	[Enum.MessageType.MessageWarning] = "warning",
	[Enum.MessageType.MessageError] = "error",
}

local queue: { any } = {}

LogService.MessageOut:Connect(function(message, messageType)
	table.insert(queue, {
		text = message,
		type = TYPE_MAP[messageType] or "output",
		time = os.clock(),
	})
end)

local function flush()
	if #queue == 0 then
		return
	end
	local batch = queue
	queue = {}
	pcall(function()
		HttpService:RequestAsync({
			Url = ENDPOINT,
			Method = "POST",
			Headers = { ["Content-Type"] = "application/json" },
			Body = HttpService:JSONEncode({ messages = batch }),
		})
	end)
end

while true do
	task.wait(FLUSH_INTERVAL)
	flush()
end
