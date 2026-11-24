extends "res://scripts/region.gd"

const CHAMBER := preload("res://assets/cave/room-small.glb")
const MOUTH := preload("res://assets/cave/gate-rock.glb")
const WALL := preload("res://assets/cave/template-wall.glb")
const CEILING_TILE := preload("res://assets/cave/template-floor.glb")
const LANTERN := preload("res://assets/town/lantern.glb")
const ROCK := preload("res://assets/survival/rock-b.glb")
const STONE := preload("res://assets/survival/resource-stone.glb")
const MUSHROOMS := preload("res://assets/nature/mushroom_tanGroup.glb")
const BEETLE := preload("res://scripts/spore_beetle.gd")

var creature: CharacterBody3D
var _ceiling: Node3D


func _ready() -> void:
	entry_points = {&"start": Vector3(0, 0.15, 3.0)}
	add_environment(Color("9caec2"), 0.62, Color("22242b"))
	place(CHAMBER, Vector3.ZERO)
	place(MOUTH, Vector3(0, 0, 5.1), 0.88, PI)
	place(WALL, Vector3(0, 0, -4.9), 1.12)
	place(WALL, Vector3(-4.85, 0, 0), 1.12, PI * 0.5)
	place(WALL, Vector3(4.85, 0, 0), 1.12, -PI * 0.5)
	_ceiling = Node3D.new()
	_ceiling.name = "CaveCeiling"
	add_child(_ceiling)
	for x in [-4.0, 0.0, 4.0]:
		for z in [-4.0, 0.0, 4.0]:
			var tile := CEILING_TILE.instantiate() as Node3D
			tile.position = Vector3(x, 4.0, z)
			tile.rotation.x = PI
			_ceiling.add_child(tile)
	_ceiling.hide()
	place(LANTERN, Vector3(1.9, 0, 4.0), 0.9)
	place(ROCK, Vector3(-3.3, 0, -3.2), 2.9)
	place(ROCK, Vector3(3.6, 0, -0.8), 2.3, 1.4)
	place(MUSHROOMS, Vector3(-2.5, 0, -3.3), 2.4)
	place(MUSHROOMS, Vector3(3.8, 0, -2.5), 1.7)
	for side in [-1.0, 1.0]:
		solid_box(Vector3(side * 4.54, 1.7, 0), Vector3(0.45, 3.4, 10.05))
		solid_box(Vector3(0, 1.7, side * 5.1), Vector3(9.3, 3.4, 0.40))
	solid_box(Vector3(0, -0.2, 0), Vector3(9.5, 0.4, 10.7))
	solid_trunk(Vector3(-3.3, 0.42, -3.2), 0.84, 0.83)
	solid_trunk(Vector3(3.6, 0.35, -0.8), 0.7, 0.68)
	lamp(Vector3(1.45, 2.05, 3.7), Color("ffc479"), 2.15, 8.0)
	lamp(Vector3(-2.7, 2.3, -3.0), Color("86bac6"), 1.8, 8.0)
	interact_at(&"leave_cave", Vector3(0, 0, 4.65))
	gather_at(&"stone_chamber", STONE, Vector3(-2.5, 0, -2.6), 4.6, 2.0)
	creature = BEETLE.new()
	creature.name = "SporeBeetle"
	add_child(creature)


func show_ceiling(first_person: bool) -> void:
	_ceiling.visible = first_person
