# 影像校友会 H5

这是一个用于展示校友会每月活动、照片、文章和作品的 H5 网站。本项目当前按“两层”使用：

- 线上展示版：只放前台页面，给学员和校友浏览。
- 本地维护版：在本地打开后台，编辑文字、图片、月份内容和表格导入。

## 本地启动

优先使用 Node.js：

```powershell
npm start
```

如果 Node.js 暂时不可用，也可以使用 PowerShell 脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Site.ps1
```

启动后打开：

- 前台：http://localhost:3000/
- 本地后台：http://localhost:3000/admin.html
- 健康检测：http://localhost:3000/health

## 内容维护

本地后台可以修改：

- 首页标题、说明和入口
- 每个月的主图、介绍、影展照片、照片日记、精彩回顾
- 影像作品
- 文章/随笔
- Excel 或 CSV 批量导入

点击“保存修改”后，内容会写入：

```text
data/site-data.json
public/data/site-data.json
```

每次保存前会自动备份上一版数据，备份文件在 `data/` 目录下。

## 上线前检查

上线前先同步数据：

```powershell
npm run sync:data
```

如果需要把当前网站内容重新导出成后台可下载的表格：

```powershell
npm run export:content
```

再做公开版检查：

```powershell
npm run check:public
```

这个检查会确认：

- `public/` 公开目录里没有后台页面和后台脚本
- 前台页面没有后台入口
- 公开数据可以正常读取

## 发布原则

当前建议第一阶段只发布 `public/` 里的前台展示内容。后台文件已经放在 `admin/` 目录，仅供本地服务器读取，不建议直接发布到公网。

如果以后要把后台也放到公司服务器，需要先补齐：

- 登录权限
- 接口鉴权
- 图片上传权限
- 操作日志
- 内容审核流程

## 图片规范

建议每张图片上传前先压缩：

- 手机展示图：宽度 1200-1600px 通常够用
- 单张图片建议控制在 300KB-800KB
- 尽量使用 `.jpg` 或 `.webp`
- 图片按月份命名，例如 `2026-06-活动名称-01.jpg`

这样可以降低打开速度、流量和后续服务器成本。
