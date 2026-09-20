# 维护与发布

## 模块入口

- core.js：模板生成、导入导出、任务状态和内容核验。修改表格格式时，从 createTemplate / importTasks / exportResults 入手。
- api.js：百度接口和响应解析。接口变化优先在此修复。
- app.js：面板、按钮和交互。版本占位符由构建脚本替换。
- package.json：唯一发布版本号来源。
- build.cjs：生成可安装脚本，保留许可证与固定更新地址。
- make-template.cjs：生成仓库中的空白模板，与面板共用 core.js。
- docs/USER_GUIDE.md：操作手册；docs/INTRODUCTION.md：仓库简介与推广介绍。

不要直接修改生成的 baidu-pan-excel-transfer.user.js，修改源码后重新构建。

## 发布步骤

1. 修改相应源码；为有行为变化的场景补充测试。不要使用真实链接、提取码、Cookie 或个人表格作为公开测试数据。
2. 修改 package.json 的 version。修复使用补丁号，新增功能使用次版本号；不兼容变化在 CHANGELOG.md 和 README 中明确说明。
3. 更新 CHANGELOG.md、README 和操作手册中的版本及使用说明。
4. 运行 npm test、npm run test:integration、npm run template、npm run build。凭据模拟模式还需设置 PAN_TEST_SEKEY=1 再运行集成检查。
5. 检查生成脚本的版本、下载地址和面板版本一致；通过真实浏览器检查安装、模板下载和导出。模拟测试不能代替真实账号接口验证。
6. 提交源码、生成的 .user.js 和空白模板到 main。创建对应 v版本号 标签和 GitHub Release，填写更新说明；可附上脚本和模板。

GitHub Actions 已配置自动测试和构建一致性检查。当前没有配置自动推送或自动创建 Release，发布由维护者主动执行。

## 更新与进度兼容

脚本的 @downloadURL / @updateURL 指向本仓库 main 分支的固定原始文件地址。仓库公开且文件上线后，Tampermonkey 可按用户自己的更新设置检查版本；也可手动检查更新或重新打开安装入口。

保留 @name、@namespace 及进度存储键，避免无意丢失现有进度。发布版本号与进度数据格式版本是两个独立概念。未来修改状态结构时，应提供明确的数据迁移或升级说明，不要静默复用不兼容状态。

3.1.0 的表格格式是显式不兼容变更：用户应先导出旧任务结果，再换四列模板。转换后的文件哈希改变，不承诺恢复旧七列表的任务进度。

迁移仓库或分支时同步更新 build.cjs 中的安装、更新、首页和反馈地址，并在旧地址发布迁移说明。

## 反馈与扩展

问题反馈提供脚本版本、浏览器版本、可复现步骤、预期与实际行为以及脱敏错误日志。功能建议写明操作场景、输入和期望输出。

新增列或输入方式优先扩展 core.js 中的解析与导出，并保持 app.js 只负责交互；新增接口适配集中到 api.js。不要让任何新增入口绕过内容、账号及有效期核验。
