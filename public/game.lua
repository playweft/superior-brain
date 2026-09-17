-- Superior Brain / 较强大脑 的房间权威状态机骨架。
-- 目前只维护大厅状态：题目、回合与计分规则在开始制作玩法后补充。

local function reject(code, message)
  return { accepted = false, error = { code = code, message = message } }
end

local function is_player(state, id)
  for _, player in ipairs(state.players) do
    if player.id == id then return true end
  end
  return false
end

function setup(context)
  return {
    state = {
      players = context.players,
      hostId = context.match.ownerId,
      phase = "lobby",
      round = 0,
    },
    events = {},
  }
end

function on_action(state, action, context)
  if not is_player(state, context.actor.id) then
    return reject("NOT_A_PLAYER", "Spectators cannot act")
  end

  return reject("NOT_IMPLEMENTED", "玩法尚未实现，房间只在大厅等待。")
end

function view(state, events, context)
  return {
    state = {
      players = state.players,
      hostId = state.hostId,
      phase = state.phase,
      round = state.round,
    },
    events = events,
  }
end

function on_return_to_room(state, context)
  return true
end
