extends CharacterBody3D

signal defeated

const MODEL := preload("res://assets/creature/A02_spore_beetle.glb")
const IMPACT := preload("res://assets/combat-audio/impactGeneric_light_003.ogg")
const MAX_HEALTH := 72
const REACH := 1.94
const DETECT := 4.65
const ATTACK_DAMAGE := 22
const WAYPOINTS := [Vector3(-0.72, 0.0, -2.75), Vector3(1.45, 0.0, -2.05), Vector3(0.45, 0.0, -1.25)]

enum Phase { PATROL, CHASE, WINDUP, RECOVER, HIT, DEFEATED }

var target: CharacterBody3D
var health := MAX_HEALTH
var phase := Phase.PATROL
var animations: AnimationPlayer
var _time_left := 0.0
var _waypoint := 0
var _facing := Vector3.BACK
var _telegraph: MeshInstance3D
var _label: Label3D
var _audio: AudioStreamPlayer3D
var _collider: CollisionShape3D


func _ready() -> void:
	collision_layer = 4
	collision_mask = 3
	floor_snap_length = 0.27
	platform_floor_layers = 1
	_collider = CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.height = 1.22
	capsule.radius = 0.54
	_collider.shape = capsule
	_collider.position.y = 0.62
	add_child(_collider)
	var model := MODEL.instantiate() as Node3D
	model.scale = Vector3.ONE * 0.82
	add_child(model)
	animations = model.find_child("AnimationPlayer", true, false) as AnimationPlayer
	for clip in [&"idle", &"walk", &"run"]:
		animations.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
	_play(&"idle")
	var ring := TorusMesh.new()
	ring.inner_radius = REACH - 0.12
	ring.outer_radius = REACH
	var amber := StandardMaterial3D.new()
	amber.albedo_color = Color("ffad47")
	amber.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_telegraph = MeshInstance3D.new()
	_telegraph.mesh = ring
	_telegraph.material_override = amber
	_telegraph.position.y = 0.035
	_telegraph.scale.y = 0.24
	_telegraph.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_telegraph)
	_telegraph.hide()
	_label = Label3D.new()
	_label.position.y = 1.75
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.font_size = 34
	_label.pixel_size = 0.0048
	_label.modulate = Color("ffe0a4")
	add_child(_label)
	_label.hide()
	_audio = AudioStreamPlayer3D.new()
	_audio.stream = IMPACT
	_audio.position.y = 0.65
	_audio.volume_db = -8.0
	add_child(_audio)


func reset_encounter(already_defeated: bool) -> void:
	var spawn: Vector3 = WAYPOINTS[0]
	if is_instance_valid(target) and target.global_position.distance_to(spawn) < 1.6:
		spawn = Vector3(2.9, 0.0, -3.8)
	position = spawn + Vector3.UP * 0.12
	rotation.y = 0.0
	_facing = Vector3.BACK
	_waypoint = 1
	velocity = Vector3.ZERO
	_time_left = 0.0
	health = 0 if already_defeated else MAX_HEALTH
	phase = Phase.DEFEATED if already_defeated else Phase.PATROL
	_telegraph.hide()
	_label.hide()
	_collider.set_deferred("disabled", already_defeated)
	set_physics_process(not already_defeated)
	visible = not already_defeated
	_play(&"idle")


func _physics_process(delta: float) -> void:
	if not is_instance_valid(target) or target.input_locked:
		return
	if phase == Phase.DEFEATED:
		_time_left -= delta
		if _time_left <= 0.0:
			hide()
			set_physics_process(false)
		return
	var to_target := (target.global_position - global_position).slide(Vector3.UP)
	var distance := to_target.length()
	_label.visible = distance < 7.0
	_label.text = "孢甲虫  %d/%d" % [health, MAX_HEALTH]
	var motion := Vector3.ZERO
	match phase:
		Phase.WINDUP:
			_time_left -= delta
			if _time_left <= 0.0:
				_telegraph.hide()
				if distance <= REACH and absf(target.global_position.y - global_position.y) <= 1.0 and _facing.dot(to_target.normalized()) >= 0.46 and sees(target.global_position):
					target.receive_damage(ATTACK_DAMAGE, global_position)
				phase = Phase.RECOVER
				_time_left = 0.72
		Phase.RECOVER, Phase.HIT:
			_time_left -= delta
			if _time_left <= 0.0:
				phase = Phase.CHASE if distance <= DETECT else Phase.PATROL
		_:
			phase = Phase.CHASE if distance <= DETECT and sees(target.global_position) else Phase.PATROL
			if phase == Phase.CHASE and distance <= REACH - 0.30:
				_face(to_target)
				phase = Phase.WINDUP
				_time_left = 0.52
				_telegraph.show()
				_play(&"attack_light")
			elif phase == Phase.CHASE:
				motion = _steer(to_target.normalized()) * 2.45
				_play(&"run")
			else:
				var to_waypoint: Vector3 = (WAYPOINTS[_waypoint] - position).slide(Vector3.UP)
				if to_waypoint.length() < 0.45:
					_waypoint = (_waypoint + 1) % WAYPOINTS.size()
				motion = _steer(to_waypoint.normalized()) * 0.8
				_play(&"walk")
	if not motion.is_zero_approx():
		_face(motion)
	velocity.x = motion.x
	velocity.z = motion.z
	velocity.y -= delta * 20.0
	move_and_slide()


func receive_strike(damage: int) -> void:
	if health <= 0:
		return
	health = maxi(0, health - damage)
	_telegraph.hide()
	_audio.play()
	if health > 0:
		phase = Phase.HIT
		_time_left = 0.42
		_play(&"hit")
		return
	phase = Phase.DEFEATED
	_time_left = 2.0
	_label.hide()
	_collider.set_deferred("disabled", true)
	_play(&"defeated")
	defeated.emit()


func sees(point: Vector3) -> bool:
	var offset := Vector3.UP * 0.72
	var ray := PhysicsRayQueryParameters3D.create(global_position + offset, point + offset, 1)
	return get_world_3d().direct_space_state.intersect_ray(ray).is_empty()


func _steer(direction: Vector3) -> Vector3:
	for angle in [0.0, PI / 3.0, -PI / 3.0]:
		var heading := direction.rotated(Vector3.UP, angle)
		if sees(global_position + heading * 1.08):
			return heading
	return Vector3.ZERO


func _face(direction: Vector3) -> void:
	if not direction.is_zero_approx():
		_facing = direction.normalized()
		rotation.y = atan2(_facing.x, _facing.z)


func _play(clip: StringName) -> void:
	if animations.current_animation != clip or not animations.is_playing():
		animations.play(clip, 0.08)
