# 项目介绍

## GitHub 仓库简介

百度网盘 Excel / 文本批量转存与换链助手：自动建目录、生成 365 天分享、随机提取码、失败重试、结果导出。

## 完整介绍

把一份表格或多条百度分享文案，转换成由自己网盘生成的新分享链接。每行可设置独立的目标目录，助手自动创建缺少的多级目录，转存后核验内容，再生成有效期为 365 天、带随机提取码的分享。

内置四列 Excel 模板下载：序号、原始链接、转存路径、备注。导出时在原始链接右侧新增独立“转存链接”列，失败或未完成留空。支持文本批量输入、点击复制、失败项重试和本地进度恢复。

这是运行在百度网盘网页中的 Tampermonkey 用户脚本。Excel 在浏览器中解析，无需搭建服务器。使用 MIT 许可证开放源码，欢迎通过 Issue 反馈问题、通过 Pull Request 贡献改进。

参考转存流程来自 aitippro/baidu-pan-batch-transfer，Excel 处理使用 ExcelJS，保留相应许可证。本项目不是百度官方产品。

## 建议仓库标签

baidu-netdisk, tampermonkey, userscript, excel, batch-transfer, javascript
