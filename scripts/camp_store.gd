extends RefCounted

const VERSION := 2
const SLOTS := ["camp-a.json", "camp-b.json"]
const REGIONS := {"clearing": Vector2(32.5, 32.5), "cabin": Vector2(3.0, 2.2), "cave": Vector2(4.2, 4.8)}
const RESOURCES := ["wood_path", "wood_stump", "stone_path", "stone_cave", "stone_chamber"]
const ITEMS := ["wood", "stone", "fire_kit"]

var directory := "user://saves"


func starting_state() -> Dictionary:
	return {
		"region": "clearing",
		"position": null,
		"items": {"wood": 0, "stone": 0, "fire_kit": 0},
		"gathered": {},
		"fire_lit": false,
		"health": 100,
		"beetle_defeated": false,
	}


func load_state() -> Dictionary:
	var records := _records()
	var newest := _newest_slot(records)
	var invalid := 0
	for index in SLOTS.size():
		if records[index].is_empty() and FileAccess.file_exists(directory.path_join(SLOTS[index])):
			invalid += 1
	return {"state": starting_state() if newest < 0 else records[newest].state, "found": newest >= 0, "recovered": invalid > 0}


func write_state(state: Dictionary) -> Error:
	if not _valid_state(state):
		return ERR_INVALID_DATA
	if FileAccess.file_exists(directory):
		return ERR_FILE_BAD_PATH
	if not DirAccess.dir_exists_absolute(directory):
		var create_error := DirAccess.make_dir_recursive_absolute(directory)
		if create_error != OK:
			return create_error

	var records := _records()
	var current := _newest_slot(records)
	var next := 1 - current if current >= 0 else 0
	var generation := int(records[current].generation) + 1 if current >= 0 else 1
	var payload := JSON.stringify({"version": VERSION, "generation": generation, "state": state})
	var target := directory.path_join(SLOTS[next])
	var staging := target + ".tmp"
	var file := FileAccess.open(staging, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_string(JSON.stringify({"payload": payload, "sha256": payload.sha256_text()}))
	file.flush()
	var write_error := file.get_error()
	file.close()
	if write_error != OK:
		return write_error
	if _read(staging).is_empty():
		return ERR_FILE_CORRUPT
	# Keep the newest verified slot intact until the other slot is fully committed.
	if FileAccess.file_exists(target):
		var remove_error := DirAccess.remove_absolute(target)
		if remove_error != OK:
			return remove_error
	return DirAccess.rename_absolute(staging, target)


func _records() -> Array[Dictionary]:
	return [_read(directory.path_join(SLOTS[0])), _read(directory.path_join(SLOTS[1]))]


func _newest_slot(records: Array[Dictionary]) -> int:
	if records[0].is_empty():
		return -1 if records[1].is_empty() else 1
	return 1 if not records[1].is_empty() and records[1].generation > records[0].generation else 0


func _read(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() > 16384:
		return {}
	var parser := JSON.new()
	if parser.parse(file.get_as_text()) != OK:
		return {}
	var envelope: Variant = parser.data
	if not envelope is Dictionary or not envelope.get("payload") is String:
		return {}
	var payload: String = envelope.payload
	if payload.sha256_text() != envelope.get("sha256"):
		return {}
	if parser.parse(payload) != OK:
		return {}
	var record: Variant = parser.data
	if not record is Dictionary:
		return {}
	var version: Variant = record.get("version")
	if version != 1 and version != VERSION:
		return {}
	if not _whole_between(record.get("generation"), 1, 1000000000):
		return {}
	if not record.get("state") is Dictionary:
		return {}
	if version == 1:
		record.state.health = 100
		record.state.beetle_defeated = false
	if not _valid_state(record.state):
		return {}
	return record


func _valid_state(state: Dictionary) -> bool:
	if not _whole_between(state.get("health"), 1, 100) or not state.get("beetle_defeated") is bool:
		return false
	if not state.get("region") is String or not REGIONS.has(state.region):
		return false
	var point: Variant = state.get("position")
	if not point is Array or point.size() != 3:
		return false
	for component in point:
		if not (component is int or component is float) or not is_finite(component):
			return false
	var bounds: Vector2 = REGIONS[state.region]
	if absf(point[0]) > bounds.x or point[1] < -0.15 or point[1] > 5.0 or absf(point[2]) > bounds.y:
		return false
	var items: Variant = state.get("items")
	if not items is Dictionary or items.size() != ITEMS.size():
		return false
	for item in ITEMS:
		if not _whole_between(items.get(item), 0, RESOURCES.size()):
			return false
	var gathered: Variant = state.get("gathered")
	if not gathered is Dictionary or not state.get("fire_lit") is bool:
		return false
	for id in gathered:
		if not id in RESOURCES or gathered[id] != true:
			return false
	return true


func _whole_between(value: Variant, low: int, high: int) -> bool:
	return (value is int or value is float) and value >= low and value <= high and floorf(value) == value
