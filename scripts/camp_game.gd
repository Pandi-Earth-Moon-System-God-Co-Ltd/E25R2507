extends Node3D

const PLAYER := preload("res://scenes/player.tscn")
const HUD := preload("res://scripts/camp_hud.gd")
const STORE := preload("res://scripts/camp_store.gd")
const MELEE_REACH := 2.25
const MELEE_DAMAGE := 24
const PICKUP_SOUND := preload("res://assets/audio/cloth1.ogg")
const DOOR_SOUND := preload("res://assets/audio/doorOpen_1.ogg")
const SCENES := {
	"clearing": preload("res://scenes/clearing.tscn"),
	"cabin": preload("res://scenes/cabin.tscn"),
	"cave": preload("res://scenes/cave.tscn"),
}
const AREA_NAMES := {"clearing": "废弃营地", "cabin": "林间小屋", "cave": "石隙洞穴"}
const EXITS := {
	&"enter_cabin": ["cabin", &"start", "进入小屋"],
	&"leave_cabin": ["clearing", &"cabin", "返回营地"],
	&"enter_cave": ["cave", &"start", "进入洞穴"],
	&"leave_cave": ["clearing", &"cave", "返回林地"],
}
const RANGE := 1.8

var store := STORE.new()
var player: CharacterBody3D
var region: Node3D
var region_id := ""
var state: Dictionary

var _hud: CanvasLayer
var _audio: AudioStreamPlayer
var _help_open := false
var _respawning := false


func _ready() -> void:
	_hud = HUD.new()
	add_child(_hud)
	_audio = AudioStreamPlayer.new()
	_audio.volume_db = -10.0
	add_child(_audio)
	player = PLAYER.instantiate()
	add_child(player)
	player.melee_contact.connect(_resolve_melee)
	player.health_changed.connect(_hud.show_health)
	player.knocked_out.connect(_fall_in_battle)
	restore_progress(true)


func _process(_delta: float) -> void:
	if not is_instance_valid(region):
		return
	if player.position.y < -5.0:
		player.place_at(region.entry_points[&"start"], region_id != "clearing")
		_hud.notify("已返回当前区域的安全入口")
	if region_id == "cave":
		region.show_ceiling(player.first_person)
	_hud.update_view(player.first_person, _help_open)
	_hud.show_interaction("" if _help_open else _interaction_text(_nearest_interaction()))


func _unhandled_input(event: InputEvent) -> void:
	if event.is_echo() or _respawning:
		return
	if event.is_action_pressed(&"show_help") or (_help_open and event.is_action_pressed(&"ui_cancel")):
		_help_open = not _help_open
		player.set_input_locked(_help_open)
		if region_id == "cave" and region.creature.health > 0:
			var animation: AnimationPlayer = region.creature.animations
			if _help_open:
				animation.pause()
			else:
				animation.play()
		get_viewport().set_input_as_handled()
		return
	if _help_open:
		return
	if event.is_action_pressed(&"interact"):
		interact_nearby()
	elif event.is_action_pressed(&"save_camp"):
		if save_progress():
			_hud.notify("已保存当前位置和营地进度")
	elif event.is_action_pressed(&"load_camp"):
		restore_progress()


func switch_region(destination: String, entry: StringName, saved_point: Variant = null) -> bool:
	if not SCENES.has(destination):
		return false
	if destination == region_id and is_instance_valid(region):
		if not region.entry_points.has(entry):
			return false
		player.place_at(saved_point if saved_point is Vector3 else region.entry_points[entry], destination != "clearing")
		return true

	var next: Node3D = SCENES[destination].instantiate()
	if next == null:
		return false
	var previous := region
	if is_instance_valid(previous):
		remove_child(previous)
	add_child(next)
	if not next.entry_points.has(entry):
		remove_child(next)
		next.queue_free()
		if is_instance_valid(previous):
			add_child(previous)
		return false
	if is_instance_valid(previous):
		previous.queue_free()
	region = next
	region_id = destination
	player.place_at(saved_point if saved_point is Vector3 else next.entry_points[entry], destination != "clearing")
	return true


func save_progress() -> bool:
	var point := player.position
	var snapshot := state.duplicate(true)
	snapshot.region = region_id
	snapshot.position = [point.x, point.y, point.z]
	snapshot.health = player.health
	var result := store.write_state(snapshot)
	if result != OK:
		_hud.notify("保存失败（%s）" % error_string(result), 4.8)
		return false
	state = snapshot
	return true


func restore_progress(at_start := false) -> void:
	var saved := store.load_state()
	if not at_start and not saved.found:
		_hud.notify("没有可读取的营地存档")
		return
	var loaded: Dictionary = saved.state
	var point: Variant = null
	if loaded.position is Array:
		point = Vector3(loaded.position[0], loaded.position[1], loaded.position[2])
	if not switch_region(loaded.region, &"start", point):
		_hud.notify("无法进入存档中的区域，已保留当前位置")
		return
	state = loaded
	player.reset_combat(int(state.health))
	_bind_encounter()
	_refresh_state()
	if saved.recovered:
		_hud.notify("已读取可用备份" if saved.found else "存档损坏，已在废弃营地重新开始", 5.0)
	elif at_start and not saved.found:
		_hud.notify("沿小路收集木材和石块，在工作台制作引火工具。", 6.0)
	elif not at_start:
		_hud.notify("已读取营地进度")


func interact_nearby() -> void:
	var id := _nearest_interaction()
	if EXITS.has(id):
		var route: Array = EXITS[id]
		if switch_region(route[0], route[1]):
			player.reset_combat(player.health)
			_bind_encounter()
			_refresh_state()
			_hud.notify("")
			_play_sound(DOOR_SOUND)
			save_progress()
		else:
			_hud.notify("区域暂时无法进入，已保留当前位置")
		return
	if id.is_empty():
		return

	var before := state.duplicate(true)
	var result_message := ""
	if region.resources.has(id):
		var item := "wood" if String(id).begins_with("wood_") else "stone"
		state.items[item] += 1
		state.gathered[String(id)] = true
		result_message = "拾取了木材" if item == "wood" else "拾取了石块"
	elif id == &"campfire":
		if state.fire_lit:
			_hud.notify("营火已经点燃")
			return
		if state.items.fire_kit <= 0:
			_hud.notify("先在工作台制作引火工具")
			return
		state.items.fire_kit -= 1
		state.fire_lit = true
		result_message = "营火已点燃"
	elif id == &"workbench":
		if state.fire_lit or state.items.fire_kit > 0:
			_hud.notify("已有可用的火源")
			return
		if state.items.wood < 2 or state.items.stone < 1:
			_hud.notify("需要 2 份木材和 1 份石块")
			return
		state.items.wood -= 2
		state.items.stone -= 1
		state.items.fire_kit += 1
		result_message = "做成了引火工具，可以回火塘点火"
	else:
		return

	if not save_progress():
		state = before
		return
	_refresh_state()
	_play_sound(PICKUP_SOUND)
	_hud.notify(result_message)


func _nearest_interaction() -> StringName:
	var nearest := &""
	var distance := RANGE * RANGE
	for id in region.interactions:
		if state.gathered.has(String(id)):
			continue
		var marker: Marker3D = region.interactions[id]
		var squared := player.global_position.distance_squared_to(marker.global_position)
		if squared <= distance:
			nearest = id
			distance = squared
	return nearest


func _interaction_text(id: StringName) -> String:
	if EXITS.has(id):
		return EXITS[id][2]
	if id == &"workbench":
		return "工作台  ·  引火工具（木材 ×2，石块 ×1）"
	if id == &"campfire":
		return "查看营火" if state.fire_lit else "点燃营火"
	if id == &"":
		return ""
	return "拾取木材" if String(id).begins_with("wood_") else "拾取石块"


func _refresh_state() -> void:
	for id in region.resources:
		region.resources[id].visible = not state.gathered.has(String(id))
	if region_id == "clearing":
		region.set_fire_lit(state.fire_lit)
	_hud.update_state(AREA_NAMES[region_id], state.items)
	_hud.show_health(player.health)


func _bind_encounter() -> void:
	if region_id != "cave":
		return
	var creature: CharacterBody3D = region.creature
	creature.target = player
	if not creature.defeated.is_connected(_beetle_defeated):
		creature.defeated.connect(_beetle_defeated)
	creature.reset_encounter(state.beetle_defeated)


func _resolve_melee(origin: Vector3, facing: Vector3) -> void:
	if region_id != "cave" or _respawning:
		return
	var creature: CharacterBody3D = region.creature
	var offset := creature.global_position - origin
	var toward := offset.slide(Vector3.UP)
	if creature.health > 0 and absf(offset.y) <= 1.0 and toward.length_squared() <= MELEE_REACH * MELEE_REACH and facing.dot(toward.normalized()) >= 0.58 and creature.sees(origin):
		creature.receive_strike(MELEE_DAMAGE)


func _beetle_defeated() -> void:
	state.beetle_defeated = true
	if save_progress():
		_hud.notify("已击败孢甲虫，可以继续探索石室。")


func _fall_in_battle() -> void:
	_respawning = true
	player.set_input_locked(true)
	_hud.notify("你倒下了，正在返回营地。")
	await get_tree().create_timer(0.95).timeout
	if switch_region("clearing", &"start"):
		player.reset_combat(player.MAX_HEALTH)
		_refresh_state()
		if save_progress():
			_hud.notify("你在营地醒来，生命已恢复。")
	_respawning = false
	player.set_input_locked(_help_open)


func _play_sound(stream: AudioStream) -> void:
	_audio.stream = stream
	_audio.play()
