extends CharacterBody3D

signal melee_contact(origin: Vector3, facing: Vector3)
signal health_changed(value: int)
signal knocked_out

const AVATAR = preload("res://assets/character/character-m.glb")
const AXE = preload("res://assets/survival/tool-axe.glb")
const SOFT_STEP = preload("res://assets/audio/footstep02.ogg")
const HARD_STEP = preload("res://assets/audio/footstep05.ogg")
const SWING = preload("res://assets/audio/knifeSlice.ogg")
const BLOCK = preload("res://assets/audio/metalLatch.ogg")
const IMPACT = preload("res://assets/combat-audio/impactGeneric_light_003.ogg")
const MAX_HEALTH := 100
const SWING_LENGTH := 0.52
const SWING_IMPACT := 0.17
const ACTION_KEYS := {
	&"walk_left": [KEY_A, KEY_LEFT],
	&"walk_right": [KEY_D, KEY_RIGHT],
	&"walk_forward": [KEY_W, KEY_UP],
	&"walk_back": [KEY_S, KEY_DOWN],
	&"turn_left": [KEY_Q],
	&"turn_right": [KEY_E],
	&"sprint": [KEY_SHIFT],
	&"change_view": [KEY_V],
	&"interact": [KEY_F],
	&"melee": [KEY_J],
	&"guard": [KEY_R],
	&"dodge": [KEY_SPACE],
	&"save_camp": [KEY_F5],
	&"load_camp": [KEY_F9],
	&"show_help": [KEY_F1],
}

@onready var appearance: Node3D = $Appearance
@onready var orbit: Node3D = $Orbit
@onready var pitch: Node3D = $Orbit/Pitch
@onready var camera: Camera3D = $Orbit/Pitch/Camera
@onready var footsteps: AudioStreamPlayer3D = $Footsteps

var animations: AnimationPlayer
var first_person := false
var input_locked := false
var health := MAX_HEALTH
var guarding := false
var _combat_audio: AudioStreamPlayer3D
var _view_axe: Node3D
var _swing_elapsed := SWING_LENGTH
var _dodge_time := 0.0
var _dodge_cooldown := 0.0
var _stagger_time := 0.0
var _dodge_direction := Vector3.ZERO
var _queued_aim := Vector3.ZERO
var _dodge_requested := false
var on_stone := false
var zoom := 13.5
var zoom_limit := 18.0
var _camera_distance := 13.5
var _indoors := false
var _look_pitch := 0.0
var _step_distance := 0.0
var _orbit_dragging := false


func _ready() -> void:
	for action in ACTION_KEYS:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action)
		for key in ACTION_KEYS[action]:
			var event := InputEventKey.new()
			event.physical_keycode = key
			InputMap.action_add_event(action, event)

	var model := AVATAR.instantiate() as Node3D
	var bounds := _mesh_bounds(model, Transform3D.IDENTITY)
	var factor := 1.75 / bounds.size.y
	model.scale = Vector3(factor * 0.89, factor, factor * 0.89)
	model.position.y = -bounds.position.y * factor
	model.rotation.y = PI
	appearance.add_child(model)
	animations = model.find_child("AnimationPlayer", true, false) as AnimationPlayer
	for clip in [&"idle", &"walk", &"sprint"]:
		animations.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
	_play(&"idle")
	var hand := model.find_child("arm-right", true, false) as Node3D
	var axe := AXE.instantiate() as Node3D
	axe.position = Vector3(-0.20, -0.87, 0.17)
	axe.rotation_degrees = Vector3(86.0, 0.0, -12.0)
	axe.scale = Vector3.ONE * 9.0
	hand.add_child(axe)
	_view_axe = AXE.instantiate() as Node3D
	_view_axe.scale = Vector3.ONE * 1.25
	camera.add_child(_view_axe)
	for mesh in _view_axe.find_children("*", "MeshInstance3D", true, false):
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_view_axe.hide()
	_combat_audio = AudioStreamPlayer3D.new()
	_combat_audio.position.y = 1.0
	_combat_audio.volume_db = -9.0
	add_child(_combat_audio)
	pitch.rotation.x = deg_to_rad(-44.0)
	camera.position.z = _camera_distance


func _unhandled_input(event: InputEvent) -> void:
	if input_locked:
		return
	if event.is_action_pressed(&"change_view") and not event.is_echo():
		set_first_person(not first_person)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed(&"melee") and not event.is_echo():
		_queued_aim = _forward()
	elif event.is_action_pressed(&"dodge") and not event.is_echo():
		_dodge_requested = true


func _input(event: InputEvent) -> void:
	if input_locked:
		return
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			_queued_aim = _pointer_aim(event.position)
		if event.button_index == MOUSE_BUTTON_RIGHT:
			_orbit_dragging = event.pressed
		if not first_person and event.pressed:
			if event.button_index == MOUSE_BUTTON_WHEEL_UP:
				zoom = maxf(4.0, zoom - 1.3)
			elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
				zoom = minf(zoom_limit, zoom + 1.3)
	elif event is InputEventMouseMotion and (first_person or _orbit_dragging):
		orbit.rotation.y -= event.relative.x * 0.0035
		if first_person:
			_look_pitch = clampf(_look_pitch - event.relative.y * 0.0029, -1.18, 1.18)


func _physics_process(delta: float) -> void:
	var direction := Vector3.ZERO
	var sprinting := false
	if not input_locked and health > 0:
		var movement := Input.get_vector(&"walk_left", &"walk_right", &"walk_forward", &"walk_back")
		direction = orbit.basis * Vector3(movement.x, 0.0, movement.y)
		sprinting = Input.is_action_pressed(&"sprint")
		orbit.rotation.y += Input.get_axis(&"turn_right", &"turn_left") * delta * 1.85
	_step_combat(delta, direction)
	var speed := 6.8 if sprinting else 4.5
	if _dodge_time > 0.0:
		direction = _dodge_direction
		speed = 8.7
	elif guarding or _swing_elapsed < SWING_LENGTH or _stagger_time > 0.0:
		speed = 1.4 if guarding else 0.65
	velocity.x = move_toward(velocity.x, direction.x * speed, delta * 29.0)
	velocity.z = move_toward(velocity.z, direction.z * speed, delta * 29.0)
	velocity.y -= delta * 20.0
	move_and_slide()

	if direction.length_squared() > 0.001 and _swing_elapsed >= SWING_LENGTH and not guarding:
		var heading := atan2(-direction.x, -direction.z)
		appearance.rotation.y = lerp_angle(appearance.rotation.y, heading, 1.0 - exp(-delta * 15.0))
	var moved := get_position_delta().slide(Vector3.UP).length()
	if health <= 0:
		_update_camera(delta)
		return
	if _swing_elapsed < SWING_LENGTH:
		_update_camera(delta)
		return
	if guarding:
		_play(&"holding-right")
	elif _dodge_time > 0.0:
		_play(&"sprint")
	elif is_on_floor() and moved > 0.005:
		_play(&"sprint" if sprinting else &"walk")
		_step_distance += moved
		if _step_distance > (1.38 if sprinting else 0.94):
			_step_distance = 0.0
			footsteps.stream = HARD_STEP if on_stone else SOFT_STEP
			footsteps.pitch_scale = randf_range(0.93, 1.09)
			footsteps.play()
	else:
		_play(&"idle")
	_update_camera(delta)


func _step_combat(delta: float, movement: Vector3) -> void:
	if input_locked or health <= 0:
		return
	_dodge_time = maxf(0.0, _dodge_time - delta)
	_dodge_cooldown = maxf(0.0, _dodge_cooldown - delta)
	_stagger_time = maxf(0.0, _stagger_time - delta)
	if _dodge_requested and _dodge_cooldown <= 0.0 and _stagger_time <= 0.0:
		_dodge_direction = movement.normalized() if movement.length_squared() > 0.01 else _forward()
		_dodge_time = 0.28
		_dodge_cooldown = 0.78
		_swing_elapsed = SWING_LENGTH
	_dodge_requested = false
	guarding = Input.is_action_pressed(&"guard") and _dodge_time <= 0.0 and _swing_elapsed >= SWING_LENGTH and _stagger_time <= 0.0
	if guarding and first_person:
		_face(_forward())
	if not _queued_aim.is_zero_approx() and not guarding and _dodge_time <= 0.0 and _stagger_time <= 0.0 and _swing_elapsed >= SWING_LENGTH:
		_face(_queued_aim)
		_swing_elapsed = 0.0
		var clip := &"attack-melee-right"
		animations.play(clip, 0.05, animations.get_animation(clip).length / SWING_LENGTH)
		_sound(SWING)
	_queued_aim = Vector3.ZERO
	var before := _swing_elapsed
	_swing_elapsed = minf(SWING_LENGTH, _swing_elapsed + delta)
	if before < SWING_IMPACT and _swing_elapsed >= SWING_IMPACT:
		melee_contact.emit(global_position, -appearance.global_basis.z.normalized())


func receive_damage(amount: int, source: Vector3) -> int:
	if _dodge_time > 0.0 or input_locked or health == 0:
		return 0
	var incoming := (source - global_position).slide(Vector3.UP).normalized()
	var blocked := guarding and _forward().dot(incoming) > 0.25
	var applied := maxi(1, roundi(amount * 0.25)) if blocked else amount
	if not blocked:
		_swing_elapsed = SWING_LENGTH
		_stagger_time = 0.2
	_sound(BLOCK if blocked else IMPACT)
	health = maxi(0, health - applied)
	health_changed.emit(health)
	if health == 0:
		_play(&"die")
		knocked_out.emit()
	return applied


func reset_combat(value: int) -> void:
	health = value
	guarding = false
	_dodge_time = 0.0
	_dodge_cooldown = 0.0
	_stagger_time = 0.0
	_swing_elapsed = SWING_LENGTH
	_queued_aim = Vector3.ZERO
	_dodge_requested = false
	_play(&"idle")


func _forward() -> Vector3:
	return -(orbit.global_basis.z if first_person else appearance.global_basis.z).normalized()


func _face(direction: Vector3) -> void:
	appearance.rotation.y = atan2(-direction.x, -direction.z)


func _pointer_aim(point: Vector2) -> Vector3:
	if first_person:
		return _forward()
	var ground := Plane(Vector3.UP, global_position.y)
	var hit: Variant = ground.intersects_ray(camera.project_ray_origin(point), camera.project_ray_normal(point))
	if hit is Vector3 and global_position.distance_squared_to(hit) > 0.025:
		return (hit - global_position).slide(Vector3.UP).normalized()
	return _forward()


func _sound(stream: AudioStream) -> void:
	_combat_audio.stream = stream
	_combat_audio.play()


func set_first_person(enabled: bool) -> void:
	first_person = enabled
	appearance.visible = not enabled
	_orbit_dragging = false
	_look_pitch = 0.0
	_apply_mouse_mode()


func set_input_locked(locked: bool) -> void:
	input_locked = locked
	if locked:
		guarding = false
		_dodge_time = 0.0
		_swing_elapsed = SWING_LENGTH
		_queued_aim = Vector3.ZERO
		_dodge_requested = false
	_orbit_dragging = false
	_apply_mouse_mode()


func place_at(point: Vector3, inside: bool) -> void:
	global_position = point
	velocity = Vector3.ZERO
	reset_physics_interpolation()
	_indoors = inside
	zoom_limit = 10.0 if inside else 18.0
	zoom = 8.1 if inside else 13.5
	_camera_distance = zoom
	on_stone = inside


func _apply_mouse_mode() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if first_person and not input_locked else Input.MOUSE_MODE_VISIBLE


func _update_camera(delta: float) -> void:
	if first_person:
		orbit.position = Vector3(0.0, 1.56, 0.0)
		pitch.rotation.x = _look_pitch
		camera.position = Vector3.ZERO
		camera.fov = 73.0
		var arc := sin(PI * _swing_elapsed / SWING_LENGTH) if _swing_elapsed < SWING_LENGTH else 0.0
		_view_axe.position = Vector3(0.33 - arc * 0.35, -0.47 + arc * 0.16, -0.62 - arc * 0.13)
		_view_axe.rotation_degrees = Vector3(20.0 + arc * 45.0, -18.0, 27.0 + arc * 68.0 + (40.0 if guarding else 0.0))
		_view_axe.visible = health > 0
		return
	_view_axe.hide()

	if _indoors:
		orbit.position = Vector3(-position.x * 0.28, 0.75, -position.z * 0.4)
		pitch.rotation.x = deg_to_rad(-70.0)
	else:
		orbit.position = Vector3.UP * 1.18 - orbit.basis.z * 1.9
		pitch.rotation.x = deg_to_rad(-44.0)
	camera.fov = 52.0
	var origin := pitch.global_position
	var backward := pitch.global_basis.z.normalized()
	var desired := minf(zoom, zoom_limit)
	if not _indoors:
		var ray := PhysicsRayQueryParameters3D.create(origin, origin + backward * desired, 1)
		var hit := get_world_3d().direct_space_state.intersect_ray(ray)
		if not hit.is_empty():
			desired = maxf(0.8, origin.distance_to(hit.position) - 0.2)
	_camera_distance = minf(desired, lerpf(_camera_distance, desired, 1.0 - exp(-delta * 12.0)))
	camera.position.z = _camera_distance
	appearance.visible = _camera_distance > 1.15


func _play(clip: StringName) -> void:
	if animations.current_animation != clip:
		animations.play(clip, 0.13)


func _mesh_bounds(node: Node3D, inherited: Transform3D) -> AABB:
	var bounds: AABB = inherited * node.get_aabb() if node is MeshInstance3D else AABB()
	for child in node.get_children():
		if child is Node3D:
			var part := _mesh_bounds(child, inherited * child.transform)
			if part.has_surface():
				bounds = bounds.merge(part) if bounds.has_surface() else part
	return bounds
