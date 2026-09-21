# 项目介绍

## 展示名称

百度网盘批量转存与换链助手｜Excel 导入 · 油猴脚本

英文名称：Baidu Netdisk Batch Transfer & Share Link Generator

仓库地址保持 `Sylvia-qiu/baidu-pan-excel-transfer`，便于沿用已有安装和更新入口。

## GitHub 仓库简介

百度网盘批量转存与换链油猴脚本：Excel / 文本导入、每行独立目录、自动建文件夹、365 天分享、随机提取码、失败重试与 Excel 导出。Baidu Netdisk batch transfer & share links.

## 完整介绍

把一份表格或多条百度分享文案，转换成由自己网盘生成的新分享链接。每行可设置独立的目标目录，助手自动创建缺少的多级目录，转存后核验内容，再生成有效期为 365 天、带随机提取码的分享。

内置四列 Excel 模板下载：序号、原始链接、转存路径、备注。导出时在原始链接右侧新增独立“转存链接”列，失败或未完成留空。支持文本批量输入、点击复制、失败项重试和本地进度恢复。

这是运行在百度网盘网页中的 Tampermonkey 用户脚本。Excel 在浏览器中解析，无需搭建服务器。使用 MIT 许可证开放源码，欢迎通过 Issue 反馈问题、通过 Pull Request 贡献改进。

参考转存流程来自 aitippro/baidu-pan-batch-transfer，Excel 处理使用 ExcelJS，保留相应许可证。本项目不是百度官方产品。

## 建议仓库标签

baidu-netdisk, baidupan, baidu-pan, tampermonkey, userscript, excel, batch-transfer, file-sharing, javascript

## 仓库 About 设置

在 GitHub 仓库首页右侧 About 的齿轮中，将上方“GitHub 仓库简介”填入 Description，按上面的列表添加 Topics。这里的文档内容不会自动同步到仓库 About 设置。

Topics 的设置方法见 [GitHub 官方说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)。

## 内容维护约定

新增功能时同步更新 README 的使用场景和操作手册；每次版本发布补充 CHANGELOG。标题和简介以实际功能为准，中文覆盖“百度网盘、批量转存、Excel、换链、油猴脚本”，英文使用 Baidu Netdisk、batch transfer、Tampermonkey 等对应名称。
