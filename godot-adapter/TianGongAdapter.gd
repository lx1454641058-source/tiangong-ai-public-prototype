class_name TianGongAdapter
extends Node

## 天工 HTTP 适配器。
## HTTP 是游戏向本地或远程服务器发送 JSON 请求的通用协议。

signal preview_completed(preview: Dictionary)
signal craft_completed(result: Dictionary)
signal request_failed(message: String)

var base_url: String = "http://127.0.0.1:4173"
var _active_request: HTTPRequest
var _active_kind: String = ""

func preview(request_body: Dictionary) -> void:
	_post_json("/api/v1/craft/preview", request_body, "preview")

func commit(request_id: String) -> void:
	if request_id.strip_edges() == "":
		request_failed.emit("缺少炼制预览编号")
		return
	_post_json("/api/v1/craft/commit", { "requestId": request_id }, "commit")

func _post_json(path: String, body: Dictionary, kind: String) -> void:
	if _active_request != null:
		request_failed.emit("天工请求正在处理中，请稍候")
		return

	var request_node := HTTPRequest.new()
	request_node.timeout = 15.0
	add_child(request_node)
	_active_request = request_node
	_active_kind = kind
	request_node.request_completed.connect(_on_request_completed.bind(request_node, kind))

	var error := request_node.request(
		base_url.trim_suffix("/") + path,
		PackedStringArray(["Content-Type: application/json"]),
		HTTPClient.METHOD_POST,
		JSON.stringify(body)
	)
	if error != OK:
		_release_request(request_node)
		request_failed.emit("无法发送天工请求：" + str(error))

func _on_request_completed(
	result: int,
	response_code: int,
	_headers: PackedStringArray,
	body: PackedByteArray,
	request_node: HTTPRequest,
	kind: String
) -> void:
	_release_request(request_node)
	if result != HTTPRequest.RESULT_SUCCESS or response_code < 200 or response_code >= 300:
		var server_message := body.get_string_from_utf8()
		if server_message == "":
			server_message = "天工服务器未响应（HTTP %d）" % response_code
		request_failed.emit(server_message)
		return

	var decoded = JSON.parse_string(body.get_string_from_utf8())
	if typeof(decoded) != TYPE_DICTIONARY:
		request_failed.emit("天工返回的数据格式不正确")
		return

	if kind == "preview":
		preview_completed.emit(decoded)
	else:
		craft_completed.emit(decoded)

func _release_request(request_node: HTTPRequest) -> void:
	if _active_request == request_node:
		_active_request = null
		_active_kind = ""
	if is_instance_valid(request_node):
		request_node.queue_free()
