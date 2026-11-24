extends CanvasLayer

const INK := Color("f6eed9")
const MUTED := Color("c9c6b5")
const ACCENT := Color("efc27d")

var _area: Label
var _inventory: Label
var _health: Label
var _hint: Label
var _notice: Label
var _hint_panel: PanelContainer
var _reticle: CenterContainer
var _help: CenterContainer
var _notice_left := 0.0


func _ready() -> void:
	var overlay := Control.new()
	add_child(overlay)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var identity := _panel(overlay, Control.PRESET_TOP_LEFT, Vector2(22, 23))
	var area_layout := VBoxContainer.new()
	area_layout.add_theme_constant_override("separation", 2)
	identity.add_child(area_layout)
	_area = _label("", 26, INK)
	area_layout.add_child(_area)
	area_layout.add_child(_label("秋季", 14, ACCENT))
	var stock := _panel(overlay, Control.PRESET_TOP_RIGHT, Vector2(-22, 23))
	var stock_layout := VBoxContainer.new()
	stock_layout.add_theme_constant_override("separation", 3)
	stock.add_child(stock_layout)
	_inventory = _label("", 17, INK)
	stock_layout.add_child(_inventory)
	_health = _label("", 15, ACCENT)
	stock_layout.add_child(_health)
	var shortcuts := _panel(overlay, Control.PRESET_BOTTOM_LEFT, Vector2(22, -22))
	shortcuts.add_child(_label("F1  操作指南    V  切换视角", 15, MUTED))
	var hints := VBoxContainer.new()
	hints.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hints.add_theme_constant_override("separation", 9)
	hints.alignment = BoxContainer.ALIGNMENT_END
	overlay.add_child(hints)
	hints.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	hints.offset_left = -260
	hints.offset_right = 260
	hints.offset_top = -150
	hints.offset_bottom = -34
	_notice = _label("", 18, INK)
	_notice.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hints.add_child(_notice)
	_hint_panel = PanelContainer.new()
	_hint_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hint_panel.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_hint_panel.add_theme_stylebox_override("panel", _style(Color("273029ed"), ACCENT, 13, 8))
	hints.add_child(_hint_panel)
	_hint = _label("", 19, INK)
	_hint_panel.add_child(_hint)
	_hint_panel.hide()

	_reticle = CenterContainer.new()
	_reticle.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.add_child(_reticle)
	_reticle.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_reticle.add_child(_label("·", 25, INK))
	_reticle.hide()

	_help = CenterContainer.new()
	_help.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.add_child(_help)
	_help.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var guide := PanelContainer.new()
	guide.add_theme_stylebox_override("panel", _style(Color("202824f5"), ACCENT, 27, 23))
	var guide_layout := VBoxContainer.new()
	guide_layout.add_theme_constant_override("separation", 12)
	guide.add_child(guide_layout)
	guide_layout.add_child(_label("操作指南", 27, ACCENT))
	guide_layout.add_child(_label("WASD / 方向键  移动     Shift  奔跑\nQ / E 或按住鼠标右键拖动  旋转镜头\n滚轮  缩放     V  第一人称 / 斜俯视\n鼠标左键 / J  挥斧     按住 R  格挡     空格  闪避\nF  拾取、制作、使用或进出场景\nF5  保存     F9  读取\n\n收集 2 份木材和 1 份石块，在工作台制作引火工具，\n再回到火塘点燃营火。石隙洞穴里有一只孢甲虫。", 18, INK))
	guide_layout.add_child(_label("F1 / Esc  返回游戏", 16, MUTED))
	_help.add_child(guide)
	_help.hide()


func _process(delta: float) -> void:
	if _notice_left > 0.0:
		_notice_left -= delta
		_notice.modulate.a = clampf(_notice_left * 2.0, 0.0, 1.0)


func update_state(area: String, items: Dictionary) -> void:
	_area.text = area
	_inventory.text = "木材  %d      石块  %d      引火工具  %d" % [items.wood, items.stone, items.fire_kit]


func show_health(value: int) -> void:
	_health.text = "生命  %d / 100" % value
	_health.add_theme_color_override("font_color", Color("ff8f77") if value <= 35 else ACCENT)


func notify(message: String, duration := 3.2) -> void:
	_notice.text = message
	_notice.modulate.a = 1.0
	_notice_left = duration


func show_interaction(message: String) -> void:
	_hint.text = "F   " + message
	_hint_panel.visible = not message.is_empty()


func update_view(first_person: bool, help_open: bool) -> void:
	_reticle.visible = first_person and not help_open
	_help.visible = help_open


func _panel(parent: Control, anchor: Control.LayoutPreset, spacing: Vector2) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_theme_stylebox_override("panel", _style(Color("232b25e9"), Color("6f735f"), 16, 9))
	parent.add_child(panel)
	panel.set_anchors_and_offsets_preset(anchor)
	if anchor == Control.PRESET_TOP_RIGHT:
		panel.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	if anchor == Control.PRESET_BOTTOM_LEFT:
		panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	panel.position += spacing
	return panel


func _label(value: String, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = value
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_shadow_color", Color("1b211db5"))
	label.add_theme_constant_override("shadow_offset_y", 1)
	return label


func _style(fill: Color, edge: Color, horizontal: int, vertical: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = edge
	style.set_border_width_all(1)
	style.set_corner_radius_all(5)
	style.content_margin_left = horizontal
	style.content_margin_right = horizontal
	style.content_margin_top = vertical
	style.content_margin_bottom = vertical
	return style
