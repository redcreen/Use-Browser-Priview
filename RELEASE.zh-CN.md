# 发布流程

[English](RELEASE.md) | [中文](RELEASE.zh-CN.md)

## 目的

这个仓库现在是一个独立的本地产品。一次发布至少要留下这些结果：

- 一个明确的 tag 版本
- repo 和 adapter 版本号一致
- 本地验证为绿
- 安装文档指向已发布 tag，而不是漂移到开发分支

## Patch 发布

1. 确认工作树是干净的。
2. 运行 `npm test`。
3. 运行 `python3 ~/.codex/skills/project-assistant/scripts/validate_gate_set.py "<repo>" --profile release`。
4. 同步更新：
   `VERSION`
   `package.json`
   `adapters/vscode/package.json`
   `install.sh`
   `README.md` 和 `README.zh-CN.md` 里的 release-tag 安装示例
5. 用 `chore: release vX.Y.Z` 提交。
6. 创建 `vX.Y.Z` tag。
7. 推送 commit 和 tag。

## 当前发布基线

- 当前版本文件：`0.0.2`
- 当前发布 tag 目标：`v0.0.2`
- 远程安装示例应使用 `https://raw.githubusercontent.com/redcreen/Use-Browser-Priview/v0.0.2/install.sh`

## 验证说明

- 本地 repo 安装仍然可以直接跑当前工作区
- 远程安装验证必须确认 tagged installer 不会再回退到 `master`
- Codex app patch 相关发布要继续保持 staged bundle swap 和 clean backup 路径
