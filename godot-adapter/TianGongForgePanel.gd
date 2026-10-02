class_name TianGongForgePanel
extends PanelContainer

## 游戏内天工锻造所。
## 守恒规则试用面板，使用游戏内固定的“长剑”目标；
## 目标类型由游戏上下文决定，不作为玩家额外输入。

signal closed

const EquipmentFactoryScript = preload("res://scripts/equipment/equipment_factory.gd")

const EFFECT_TO_AFFIX := {
	"damage": "pierce",
	"burn": "burn",
	"freeze": "stun",
	"slow": "focus",
	"life_steal": "lifesteal",
	"projectile": "multihit",
	"attack_speed": "swift",
	"explosion": "chain",
}

var adapter
## 由宿主游戏适配器传入的原生材料描述，不由天工面板创建。
var native_materials: Array = []
var _material_buttons: Dictionary = {}
var _selected_materials: Array[String] = []
var _preview: Dictionary = {}
var _last_prompt: String = ""

var _status_label: Label
var _preview_label: Label
var _result_label: Label
var _prompt_edit: TextEdit
var _preview_button: Button
var _commit_button: Button

func _ready() -> void:
	custom_minimum_size = Vector2(940, 600)
	if adapter != null:
		adapter.preview_completed.connect(_on_preview_completed)
		adapter.craft_completed.connect(_on_craft_completed)
		adapter.request_failed.connect(_on_request_failed)
	_build_ui()

func _build_ui() -> void:
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_top", 20)
	margin.add_theme_constant_override("margin_bottom", 20)
	add_child(margin)

	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 10)
	margin.add_child(content)

	var header := HBoxContainer.new()
	content.add_child(header)
	var title := Label.new()
	title.text = "游戏锻造界面 · 天工 Runtime 试用"
	title.add_theme_font_size_override("font_size", 26)
	header.add_child(title)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(spacer)
	var close_button := Button.new()
	close_button.text = "关闭（Esc）"
	close_button.pressed.connect(func(): closed.emit())
	header.add_child(close_button)

	var guide := Label.new()
	guide.text = "玩家只需选材料并表达目标；天工可补全基础工艺，再由守恒规则引擎核算物质、能量、属性、价值和复杂度。重复使用相同提示词不会衰减。"
	guide.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	content.add_child(guide)

	var target := Label.new()
	target.text = "目标原型：长剑（由当前游戏场景固定提供）"
	target.add_theme_color_override("font_color", Color("#f4c454"))
	content.add_child(target)

	var material_title := Label.new()
	material_title.text = "选择宿主游戏提供的原生材料（至少 1 种）"
	content.add_child(material_title)

	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	content.add_child(grid)
	for i in range(mini(2, native_materials.size())):
		_selected_materials.append(str(native_materials[i].get("id", "")))
	if native_materials.is_empty():
		var empty_label := Label.new()
		empty_label.text = "宿主游戏尚未传入原生材料。请先调用 set_native_materials()。"
		grid.add_child(empty_label)
	for material in native_materials:
		var id := str(material.get("id", ""))
		var button := Button.new()
		button.text = "%s\n[%s]" % [str(material.get("name", "原生材料")), str(material.get("tag", "原生"))]
		button.tooltip_text = "游戏原生材料 ID：" + id
		button.custom_minimum_size = Vector2(210, 48)
		button.toggle_mode = true
		button.button_pressed = _selected_materials.has(id)
		button.toggled.connect(_on_material_toggled.bind(id, button))
		grid.add_child(button)
		_material_buttons[id] = button

	var prompt_title := Label.new()
	prompt_title.text = "炼制提示词"
	content.add_child(prompt_title)
	_prompt_edit = TextEdit.new()
	_prompt_edit.custom_minimum_size = Vector2(0, 92)
	_prompt_edit.placeholder_text = "例如：以选中的原生装备为核心，用封装手法稳定效果，追求持续命中而不是一次爆发。"
	_prompt_edit.text = "以选中的原生装备为核心，用封装手法稳定效果，牺牲爆发换取持续命中。"
	content.add_child(_prompt_edit)
	_prompt_edit.text_changed.connect(_on_prompt_changed)

	var actions := HBoxContainer.new()
	content.add_child(actions)
	_preview_button = Button.new()
	_preview_button.text = "1. 预览评定"
	_preview_button.custom_minimum_size = Vector2(180, 42)
	_preview_button.pressed.connect(_request_preview)
	actions.add_child(_preview_button)
	_commit_button = Button.new()
	_commit_button.text = "2. 确认炼制"
	_commit_button.custom_minimum_size = Vector2(180, 42)
	_commit_button.disabled = true
	_commit_button.pressed.connect(_request_commit)
	actions.add_child(_commit_button)
	_status_label = Label.new()
	_status_label.text = "状态：等待输入"
	_status_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_child(_status_label)

	_preview_label = Label.new()
	_preview_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_preview_label.custom_minimum_size = Vector2(0, 150)
	_preview_label.text = "预览结果会显示在这里。"
	content.add_child(_preview_label)

	_result_label = Label.new()
	_result_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_result_label.custom_minimum_size = Vector2(0, 72)
	content.add_child(_result_label)

func _on_material_toggled(pressed: bool, material_id: String, button: Button) -> void:
	if pressed:
		if not _selected_materials.has(material_id):
			_selected_materials.append(material_id)
	else:
		_selected_materials.erase(material_id)
	button.tooltip_text = "已选材料" if pressed else "点击选择材料"
	_preview = {}
	_commit_button.disabled = true
	_status_label.text = "状态：材料已变更，请重新预览"

func _on_prompt_changed() -> void:
	_preview = {}
	_commit_button.disabled = true
	_status_label.text = "状态：提示词已变更，请重新预览"
	_preview_label.text = "提示词已变更，点击“预览评定”重新计算。"
	_result_label.text = ""

func _request_preview() -> void:
	if _selected_materials.is_empty():
		_status_label.text = "状态：请至少选择一种材料"
		return
	_last_prompt = _prompt_edit.text.strip_edges()
	if _last_prompt == "":
		_status_label.text = "状态：请输入炼制提示词"
		return
	_preview_button.disabled = true
	_commit_button.disabled = true
	_status_label.text = "状态：正在请求天工规则引擎……"
	_preview_label.text = ""
	_result_label.text = ""
	adapter.preview({
		"gameId": "pixel_pathfinder_tiangong_demo",
		"playerId": "local_demo_player",
		"targetType": "sword",
		"materialIds": _selected_materials,
		"materials": _selected_material_descriptors(),
		"prompt": _last_prompt,
		"ruleVersion": "forge_conservation_v2",
		"knowledgeVersion": "pp_knowledge_v3",
		"sdkVersion": "godot_0.3.0",
		"inventoryRevision": "local_demo_v1",
	})

func set_native_materials(materials: Array) -> void:
	## 宿主游戏应在把面板加入场景前调用此方法。
	native_materials = materials.duplicate(true)

func _selected_material_descriptors() -> Array:
	var selected: Array = []
	for material in native_materials:
		if _selected_materials.has(str(material.get("id", ""))):
			selected.append(material)
	return selected

func _request_commit() -> void:
	if _preview.is_empty():
		return
	var expected_ids: Array = _preview.get("operationReport", {}).get("operatedMaterialIds", [])
	var validation_error := _validate_consumption(expected_ids.map(func(material_id): return {"materialId": material_id, "amount": 1}))
	if validation_error != "":
		_preview = {}
		_commit_button.disabled = true
		_status_label.text = "状态：材料状态已变化"
		_result_label.text = validation_error + "，请重新选择材料并预览。"
		return
	_preview_button.disabled = true
	_commit_button.disabled = true
	_status_label.text = "状态：正在结算炼制……"
	adapter.commit(str(_preview.get("requestId", "")))

func _on_preview_completed(preview: Dictionary) -> void:
	_preview = preview
	_preview_button.disabled = false
	var feasible := bool(preview.get("feasible", false))
	_commit_button.disabled = not feasible
	_status_label.text = "状态：预览有效，可确认炼制" if feasible else "状态：方案违反守恒约束"
	var lines: Array[String] = []
	lines.append(str(preview.get("summary", "已完成预览")))
	lines.append("效果：" + _join_values(preview.get("effectNames", [])))
	lines.append("成功率：%.0f%%　预计品质：%s" % [
		float(preview.get("successRate", 0.0)) * 100.0,
		str(preview.get("quality", "未知"))
	])
	lines.append("提示词评分：%d / 100　材料匹配：%d / 100" % [
		int(preview.get("promptScore", 0)),
		int(preview.get("materialMatch", 0))
	])
	var agent: Dictionary = preview.get("agent", {})
	var retrieved: Array = agent.get("retrieved", [])
	lines.append("Agent：%s　RAG 知识命中：%d 条" % [str(agent.get("provider", "未知")), retrieved.size()])
	var operation_report: Dictionary = preview.get("operationReport", {})
	lines.append("材料操作：" + _format_material_operations(operation_report.get("steps", [])))
	var balance: Dictionary = preview.get("balanceSheet", {})
	var matter: Dictionary = balance.get("matter", {})
	var energy: Dictionary = balance.get("energy", {})
	lines.append("物质：%s MU 输入 → %s MU 成品 + %s MU 副产物" % [str(matter.get("input", 0)), str(matter.get("product", 0)), str(matter.get("byproducts", 0))])
	lines.append("能量：%s EU 输入 → %s EU 做功 + %s EU 储能 + %s EU 散热" % [str(energy.get("input", 0)), str(energy.get("usefulWork", 0)), str(energy.get("productStored", 0)), str(energy.get("heatLoss", 0))])
	for violation in preview.get("violations", []):
		lines.append("约束：" + str(violation))
	lines.append("结果分布：" + _format_outcomes(preview.get("outcomes", [])))
	_preview_label.text = "\n".join(lines)

func _on_craft_completed(result: Dictionary) -> void:
	_preview_button.disabled = false
	_commit_button.disabled = true
	var outcome := str(result.get("outcome", "未知结果"))
	var material_loss := str(result.get("materialLoss", "按规则处理"))
	var settlement: Dictionary = result.get("settlement", {})
	if str(result.get("status", "")) != "completed":
		var failed_transaction := _apply_inventory_settlement(settlement, {})
		if not bool(failed_transaction.get("ok", false)):
			_status_label.text = "状态：结算被拒绝"
			_result_label.text = str(failed_transaction.get("error", "材料事务失败"))
			return
		_status_label.text = "状态：炼制失败"
		_result_label.text = "结果：%s\n材料处理：%s\n%s" % [outcome, material_loss, str(settlement.get("conservation", ""))]
		return

	var weapon: Dictionary = result.get("weapon", {})
	var item := _to_game_item(weapon)
	var transaction := _apply_inventory_settlement(settlement, item)
	if not bool(transaction.get("ok", false)):
		_status_label.text = "状态：结算被拒绝，材料未消耗"
		_result_label.text = str(transaction.get("error", "材料事务失败")) + "\n请整理背包后重新预览。"
		return
	_status_label.text = "状态：炼制完成，装备已入包"
	_result_label.text = "结果：%s\n已获得「%s」，攻击力 %d，词条：%s\n%s" % [
		outcome,
		str(item.get("name", "天工武器")),
		int(item.get("stats", {}).get("atk", 0)),
		_join_values(item.get("tiangong_effect_names", [])),
		str(settlement.get("conservation", ""))
	]

func _settlement_entries(settlement: Dictionary) -> Array:
	var entries: Array = settlement.get("consumedMaterials", [])
	if not entries.is_empty():
		return entries
	var fallback: Array = []
	for material_id in settlement.get("consumedMaterialIds", []):
		fallback.append({"materialId": str(material_id), "amount": 1})
	return fallback

func _validate_consumption(entries: Array) -> String:
	if entries.is_empty():
		return "结算没有提供需要消耗的原生材料"
	var seen: Dictionary = {}
	for entry in entries:
		if not (entry is Dictionary):
			return "材料结算格式错误"
		var material_id := str(entry.get("materialId", ""))
		var amount := maxi(1, int(entry.get("amount", 1)))
		if material_id == "" or seen.has(material_id):
			return "材料结算包含空 ID 或重复 ID"
		seen[material_id] = true
		if material_id.begins_with("native:equipment:"):
			var slot := material_id.trim_prefix("native:equipment:")
			if amount != 1 or not GameState.equipment.get(slot) is Dictionary:
				return "已装备材料不存在：" + material_id
		elif material_id.begins_with("native:bag:"):
			var bag_index := int(material_id.trim_prefix("native:bag:"))
			if amount != 1 or bag_index < 0 or bag_index >= GameState.bag.size():
				return "背包材料不存在：" + material_id
		elif material_id == "native:resource:refine_dust":
			if GameState.refine_dust < amount:
				return "精粹数量不足"
		elif material_id.begins_with("native:essence:"):
			var parts := material_id.split(":")
			var essence_index := int(parts[3]) if parts.size() >= 4 else -1
			if amount != 1 or essence_index < 0 or essence_index >= GameState.essences.size():
				return "词条精华不存在：" + material_id
			if str(GameState.essences[essence_index].get("affix", "")) != str(parts[2]):
				return "词条精华已经发生变化：" + material_id
		else:
			return "无法识别的游戏原生材料：" + material_id
	return ""

func _inventory_snapshot() -> Dictionary:
	return {
		"equipment": GameState.equipment.duplicate(true),
		"bag": GameState.bag.duplicate(true),
		"refine_dust": GameState.refine_dust,
		"essences": GameState.essences.duplicate(true),
		"hp": GameState.hp,
	}

func _restore_inventory_snapshot(snapshot: Dictionary) -> void:
	GameState.equipment = snapshot.get("equipment", {}).duplicate(true)
	GameState.bag = snapshot.get("bag", []).duplicate(true)
	GameState.refine_dust = int(snapshot.get("refine_dust", 0))
	GameState.essences = snapshot.get("essences", []).duplicate(true)
	GameState._recalc_stats()
	GameState.hp = mini(int(snapshot.get("hp", GameState.hp)), GameState.max_hp)

func _apply_inventory_settlement(settlement: Dictionary, result_item: Dictionary) -> Dictionary:
	var entries := _settlement_entries(settlement)
	var validation_error := _validate_consumption(entries)
	if validation_error != "":
		return {"ok": false, "error": validation_error + "；库存未发生变化"}
	var snapshot := _inventory_snapshot()
	var bag_indices: Array[int] = []
	var essence_indices: Array[int] = []
	var changed_slots: Array[String] = []
	for entry in entries:
		var material_id := str(entry.get("materialId", ""))
		var amount := maxi(1, int(entry.get("amount", 1)))
		if material_id.begins_with("native:equipment:"):
			var slot := material_id.trim_prefix("native:equipment:")
			GameState.equipment[slot] = null
			changed_slots.append(slot)
		elif material_id.begins_with("native:bag:"):
			bag_indices.append(int(material_id.trim_prefix("native:bag:")))
		elif material_id == "native:resource:refine_dust":
			GameState.refine_dust -= amount
		elif material_id.begins_with("native:essence:"):
			var parts := material_id.split(":")
			essence_indices.append(int(parts[3]))
	bag_indices.sort()
	bag_indices.reverse()
	for bag_index in bag_indices:
		GameState.bag.remove_at(bag_index)
	essence_indices.sort()
	essence_indices.reverse()
	for essence_index in essence_indices:
		GameState.essences.remove_at(essence_index)
	var fragment: Variant = settlement.get("fragment")
	if fragment is Dictionary:
		GameState.refine_dust += maxi(0, int(fragment.get("amount", 0)))
	if not result_item.is_empty():
		if GameState.bag.size() >= int(GameData.PLAYER_BASE["bag_capacity"]):
			_restore_inventory_snapshot(snapshot)
			return {"ok": false, "error": "背包已满，无法同时完成扣料和发放成品；库存已回滚"}
		GameState.bag.append(result_item)
	GameState._recalc_stats()
	GameState.hp = mini(GameState.hp, GameState.max_hp)
	for slot in changed_slots:
		var equipped = GameState.equipment.get(str(slot))
		SignalBus.equipment_changed.emit(str(slot), equipped if equipped is Dictionary else {})
	SignalBus.bag_changed.emit(GameState.bag.duplicate())
	SignalBus.hp_changed.emit(GameState.hp, GameState.max_hp)
	GameState.save_game(true)
	Sfx.play("upgrade")
	return {"ok": true}

func _on_request_failed(message: String) -> void:
	_preview_button.disabled = false
	_commit_button.disabled = _preview.is_empty()
	_status_label.text = "状态：请求失败"
	_result_label.text = "请确认天工服务器已启动（npm.cmd start）。\n" + message

func _to_game_item(weapon: Dictionary) -> Dictionary:
	var rarity_map := {
		"rare": GameData.Rarity.RARE,
		"epic": GameData.Rarity.EPIC,
		"legendary": GameData.Rarity.LEGENDARY,
	}
	var rarity := int(rarity_map.get(str(weapon.get("quality", "rare")), GameData.Rarity.RARE))
	var item := EquipmentFactoryScript.generate_item(GameState.region, "weapon", rarity, "forge")
	item["key"] = "sword"
	item["base_name"] = "长剑"
	item["name"] = "天工·" + str(weapon.get("prototypeName", "长剑"))
	item["prefix"] = "天工·"
	item["stats"]["atk"] = maxi(int(item.get("stats", {}).get("atk", 0)), int(weapon.get("damage", 0)))
	var source_material_ids: Array = weapon.get("sourceMaterialIds", [])
	for source_material in native_materials:
		if not source_material_ids.has(str(source_material.get("id", ""))):
			continue
		for tag in source_material.get("tags", []):
			if GameData.ELEMENTS.has(str(tag)):
				item["element"] = str(tag)
				break
		break
	item["affixes"] = []

	var effect_names: Array = weapon.get("effectNames", [])
	for effect_id in weapon.get("effectIds", []):
		var affix_key := str(EFFECT_TO_AFFIX.get(str(effect_id), ""))
		if affix_key != "" and GameData.AFFIXES.has(affix_key) and not item["affixes"].has(affix_key):
			item["affixes"].append(affix_key)
	item["tiangong_effect_names"] = effect_names
	item["tiangong_recipe"] = weapon.get("visualRecipe", "")
	item["tiangong_prompt"] = _last_prompt
	item["tiangong_source_material_ids"] = source_material_ids
	item["tiangong_operations"] = weapon.get("materialOperations", [])
	item["lore"] = [
		"这件武器由天工 Agent 按玩家提示词逐步处理游戏原生材料。",
		"炼制提示词：" + _last_prompt,
		"材料工序：" + str(weapon.get("processSummary", "未记录")),
	]
	return item

func _join_values(values: Array) -> String:
	if values.is_empty():
		return "无"
	var parts: Array[String] = []
	for value in values:
		parts.append(str(value))
	return "、".join(parts)

func _format_outcomes(outcomes: Array) -> String:
	var parts: Array[String] = []
	for entry in outcomes:
		if entry is Dictionary:
			parts.append("%s %.0f%%" % [
				str(entry.get("label", "未知")),
				float(entry.get("probability", 0.0)) * 100.0
			])
	return "；".join(parts)

func _format_material_operations(operations: Array) -> String:
	if operations.is_empty():
		return "未识别到操作（本次成功率为 0%）"
	var parts: Array[String] = []
	for operation in operations:
		if operation is Dictionary:
			parts.append("%s(%s)" % [str(operation.get("actionName", operation.get("action", "操作"))), _join_values(operation.get("materialNames", []))])
	return " → ".join(parts)
