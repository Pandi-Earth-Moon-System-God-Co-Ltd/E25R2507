extends "res://scripts/region.gd"

const WALL := preload("res://assets/town/wall.glb")
const WINDOW := preload("res://assets/town/wall-window-shutters.glb")
const DOOR := preload("res://assets/town/wall-doorway-square.glb")
const FLOOR := preload("res://assets/survival/floor.glb")
const DESK := preload("res://assets/survival/workbench.glb")
const BEDROLL := preload("res://assets/survival/bedroll.glb")
const CHEST := preload("res://assets/survival/chest.glb")
const LANTERN := preload("res://assets/town/lantern.glb")


func _ready() -> void:
	entry_points = {&"start": Vector3(0, 0.15, 1.55)}
	add_environment(Color("adb6c8"), 0.64, Color("252c2f"))
	for x in range(-3, 4):
		for z in range(-2, 3):
			place(FLOOR, Vector3(x * 0.99, -0.11, z * 0.995), 2.0)
	solid_box(Vector3(0, -0.15, 0), Vector3(6.95, 0.30, 5.02))
	for x in [-2.18, 0.0, 2.18]:
		place(WINDOW if x == 0.0 else WALL, Vector3(x, 0, -1.46), 2.18, PI * 0.5)
		place(DOOR if x == 0.0 else WALL, Vector3(x, 0, 1.48), 2.18, -PI * 0.5)
	for side in [-1.0, 1.0]:
		for z in [-1.1, 1.1]:
			place(WALL, Vector3(side * 2.3, 0, z), 2.18, 0.0 if side > 0.0 else PI)
		solid_box(Vector3(side * 3.29, 1.1, 0), Vector3(0.25, 2.2, 5.0))
		solid_box(Vector3(0, 1.1, side * 2.46), Vector3(6.68, 2.2, 0.24))
	place(DESK, Vector3(-2.15, 0, -1.27), 4.8)
	solid_box(Vector3(-2.15, 0.5, -1.27), Vector3(1.1, 1.0, 1.1))
	place(BEDROLL, Vector3(1.25, 0.0, -1.17), 3.65)
	place(CHEST, Vector3(2.52, 0.0, -1.65), 3.9, -PI * 0.5)
	solid_box(Vector3(2.52, 0.35, -1.65), Vector3(0.88, 0.68, 0.91))
	place(LANTERN, Vector3(-2.78, 0.0, -0.38), 1.1)
	lamp(Vector3(-1.9, 2.15, -0.4), Color("ffd38c"), 2.0, 7.0)
	lamp(Vector3(2.1, 1.8, -1.9), Color("b8d4ff"), 0.8, 6.0)
	interact_at(&"leave_cabin", Vector3(0, 0, 2.18))
