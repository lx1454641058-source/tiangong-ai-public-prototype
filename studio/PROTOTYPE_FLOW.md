# 天工厂商客户端原型流程

入口：/studio/

## 用户完整流程

登录 / 注册
→ 首次使用导览
→ 工作台
→ 了解天工能力
→ 创建接入项目
→ 联系合作
→ 开发联调
→ 验收上线
→ 下载接入清单

## 页面和开发职责

| 页面 | 原型行为 | 后续正式实现 |
|---|---|---|
| 登录 / 注册 | 本地模拟账号和会话 | 接入身份认证、组织和权限 |
| 首次导览 | 3页能力说明 | 支持跳过、重新查看和按角色展示 |
| 工作台 | 显示项目、阶段和下一步 | 接入真实项目统计、告警和任务 |
| 了解天工 | 选择武器、宠物、炼丹或动态资产能力 | 根据选择生成接入模板 |
| 创建接入项目 | 保存游戏名、引擎、平台、目标能力 | 写入项目服务并生成 gameId |
| 联系合作 | 填写联系人、邮箱和需求，生成申请编号 | 接入CRM、邮件或工单系统 |
| 开发联调 | 调用预览API，展示RAG、Agent和规则轨迹 | 接入真实API Key、回调和环境管理 |
| 验收上线 | 检查项目、合作、Runtime、测试和版本 | 接入审批、发布、回滚和审计 |

## 本地演示状态

状态保存在浏览器的 localStorage，键名为 tiangong-studio-flow-v1。

主要字段：

    {
      "authenticated": true,
      "onboardingDone": true,
      "projectCreated": true,
      "partnershipSubmitted": true,
      "runtimeConnected": true,
      "testPassed": true,
      "versionLocked": true
    }

正式产品中，这些字段应由服务端返回，浏览器只保留短期会话信息。

## 与现有天工能力的连接点

开发联调页已经接入现有接口：

    POST /api/v1/craft/preview
    POST /api/v1/assets/generate
    POST /api/v1/craft/commit
    GET  /api/v1/config/manifest

厂商正式接入时，建议继续保持以下责任边界：

- 天工返回 CraftPlan、RuleDecision、AssetSpec 和审计信息。
- 游戏服务器掌握库存、材料扣除、成品发放和最终事务。
- 生成模型不能直接修改游戏库存。
- 接入项目必须绑定 gameId、知识库版本、规则版本和SDK版本。

## 联调到上线的验收条件

1. 能读取游戏原生材料。
2. 能解析玩家提示词并展示操作步骤。
3. 成功率由规则引擎计算，而不是由模型自由编造。
4. 成功、失败和重复提交都能正确处理。
5. 材料扣除和成品发放具备原子性。
6. 2D / 3D资产通过画风、相似度和技术规格审核。
7. 知识库、规则包、StylePack和SDK版本一致。

