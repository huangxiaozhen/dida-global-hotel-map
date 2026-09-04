# Dida 全球酒店地图

一个可离线运行的交互式全球酒店分布页面。鼠标悬停国家可查看酒店数量，点击国家可切换下方 Destination 列表，并支持按名称或 DestinationID 搜索。

新增北海道酒店点位地图：使用酒店静态经纬度在 OpenStreetMap 底图上展示 4,246 个有效点位，并支持搜索和点击查看 4,251 家酒店的静态详情。5 家源记录缺少经纬度，可搜索查看但不生成点位。

## 当前数据范围

- 酒店静态记录：2,460,639 家
- 国家/地区：228 个
- Destination 分组：77,934 个
- 中国：729,686 家
- 澳大利亚：30,787 家
- 深圳及周边（DestinationID `6046792`）：11,388 家

数据来自 Dida 酒店静态信息。仓库不包含原始 CSV、房型、订单、价格、库存、账户凭据或个人信息。北海道页面包含该地区酒店的 HotelID、名称、地址、经纬度、星级、城市、Destination 和静态更新时间，用于点位展示和详情查询。页面展示的是静态覆盖量，不代表实时可售库存。

## 在线访问

[打开全球酒店地图](https://huangxiaozhen.github.io/dida-global-hotel-map/)

[打开北海道酒店点位地图](https://huangxiaozhen.github.io/dida-global-hotel-map/hokkaido/)

## 直接使用

打开 `standalone/index.html` 即可离线使用，不需要安装依赖或连接网络。

## 本地开发

需要 Node.js 22.13 或更高版本：

```bash
pnpm install
pnpm dev
```

## 数据与地图说明

Destination 按 `DestinationID` 聚合并显示中英文名称。部分微型国家或地区没有独立地图轮廓，但仍可通过国家下拉框访问。

世界地图轮廓由 `world-atlas`、Natural Earth、`topojson-client` 与 `d3-geo` 生成。Dida 衍生聚合数据的相关权利仍归其原始权利人所有；本仓库未附加开源数据许可。

北海道页面使用 Leaflet 与 Leaflet.markercluster 展示点位，底图与地名来自 OpenStreetMap。页面保留 OpenStreetMap 署名，不预取或离线下载地图瓦片。
