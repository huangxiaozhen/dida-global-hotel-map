'use client';

import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldAtlas from 'world-atlas/countries-110m.json';
import worldCountries from 'world-countries';
import {
  Building2,
  ChevronDown,
  Database,
  Globe2,
  MapPinned,
  MousePointer2,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';

type CountryRow = {
  code: string;
  nameCn: string;
  nameEn: string;
  count: number;
};

type DestinationRow = {
  id: string;
  nameCn: string;
  nameEn: string;
  count: number;
};

type HotelMapData = {
  meta: {
    source: string;
    generatedAt: string;
    uniqueHotels: number;
    rawRows: number;
    duplicateRows: number;
    malformedRows: number;
    repairedRows: number;
    missingDestinationRows: number;
    countryCount: number;
    destinationGroupCount: number;
  };
  countries: CountryRow[];
  destinationsByCountry: Record<string, DestinationRow[]>;
};

declare global {
  interface Window {
    __DIDA_HOTEL_MAP__?: HotelMapData;
  }
}

type AtlasObjects = {
  countries: GeometryCollection;
};

type MapPath = {
  code: string;
  path: string;
};

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 500;
const numberFormat = new Intl.NumberFormat('zh-CN');
const percentFormat = new Intl.NumberFormat('zh-CN', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numericToAlpha2 = new Map(
  worldCountries
    .filter((country) => country.ccn3 && country.cca2)
    .map((country) => [country.ccn3, country.cca2] as const),
);

const atlas = worldAtlas as unknown as Topology<AtlasObjects>;
const worldFeatureCollection = feature(atlas, atlas.objects.countries);
const projection = geoNaturalEarth1().fitSize(
  [MAP_WIDTH, MAP_HEIGHT],
  worldFeatureCollection,
);
const pathGenerator = geoPath(projection);

const mapPaths: MapPath[] = worldFeatureCollection.features
  .map((countryFeature) => {
    const numericCode = String(countryFeature.id ?? '').padStart(3, '0');
    return {
      code: numericToAlpha2.get(numericCode) ?? '',
      path: pathGenerator(countryFeature) ?? '',
    };
  })
  .filter((country) => country.code && country.path);

function formatCompactCount(value: number) {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(2)} 亿`;
  }
  if (value >= 10_000) {
    const precision = value >= 100_000 ? 1 : 2;
    return `${(value / 10_000).toFixed(precision)} 万`;
  }
  return numberFormat.format(value);
}

function mapFill(count: number | undefined, maximum: number, selected: boolean) {
  if (selected) return 'var(--map-selected)';
  if (!count) return 'var(--map-empty)';
  const ratio = Math.log1p(count) / Math.log1p(maximum);
  if (ratio > 0.92) return 'var(--map-5)';
  if (ratio > 0.78) return 'var(--map-4)';
  if (ratio > 0.62) return 'var(--map-3)';
  if (ratio > 0.44) return 'var(--map-2)';
  return 'var(--map-1)';
}

export default function Home() {
  const [data, setData] = useState<HotelMapData | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState('CN');
  const [selectedDestinationId, setSelectedDestinationId] = useState('6046792');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(40);
  const [hoveredCountryCode, setHoveredCountryCode] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 22, y: 22 });

  useEffect(() => {
    let pollTimer: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      if (window.__DIDA_HOTEL_MAP__) {
        setData(window.__DIDA_HOTEL_MAP__);
        return;
      }

      let attempts = 0;
      pollTimer = window.setInterval(() => {
        attempts += 1;
        if (window.__DIDA_HOTEL_MAP__) {
          setData(window.__DIDA_HOTEL_MAP__);
          window.clearInterval(pollTimer);
        } else if (attempts >= 50) {
          window.clearInterval(pollTimer);
        }
      }, 100);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (pollTimer !== undefined) window.clearInterval(pollTimer);
    };
  }, []);

  const countryMap = useMemo(
    () => new Map(data?.countries.map((country) => [country.code, country]) ?? []),
    [data],
  );
  const maximumCountryCount = data?.countries[0]?.count ?? 1;
  const selectedCountry = countryMap.get(selectedCountryCode);
  const hoveredCountry = hoveredCountryCode
    ? countryMap.get(hoveredCountryCode)
    : undefined;
  const countryDestinations = useMemo(
    () => data?.destinationsByCountry[selectedCountryCode] ?? [],
    [data, selectedCountryCode],
  );

  const filteredDestinations = useMemo(() => {
    const query = destinationQuery.trim().toLocaleLowerCase('zh-CN');
    if (!query) return countryDestinations;
    return countryDestinations.filter((destination) =>
      `${destination.nameCn} ${destination.nameEn} ${destination.id}`
        .toLocaleLowerCase('zh-CN')
        .includes(query),
    );
  }, [countryDestinations, destinationQuery]);

  const visibleDestinations = filteredDestinations.slice(0, visibleLimit);
  const selectedDestination = countryDestinations.find(
    (destination) => destination.id === selectedDestinationId,
  );
  const selectedDestinationRank = selectedDestination
    ? countryDestinations.findIndex(
        (destination) => destination.id === selectedDestination.id,
      ) + 1
    : 0;
  const topCountries = data?.countries.slice(0, 10) ?? [];

  function selectCountry(code: string) {
    if (!countryMap.has(code)) return;
    const destinations = data?.destinationsByCountry[code] ?? [];
    const preferred =
      code === 'CN'
        ? destinations.find((destination) => destination.id === '6046792')
        : undefined;
    setSelectedCountryCode(code);
    setSelectedDestinationId((preferred ?? destinations[0])?.id ?? '');
    setDestinationQuery('');
    setVisibleLimit(40);
  }

  function updateTooltip(
    code: string,
    event: MouseEvent<SVGPathElement>,
  ) {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (bounds) {
      setTooltipPosition({
        x: event.clientX - bounds.left + 14,
        y: event.clientY - bounds.top + 14,
      });
    }
    setHoveredCountryCode(code);
  }

  function handleMapKeyDown(
    code: string,
    event: KeyboardEvent<SVGPathElement>,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectCountry(code);
    }
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="max-w-md text-center">
          <Globe2 className="mx-auto mb-4 size-10 animate-pulse text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">正在载入全球酒店地图</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            正在准备 246 万家酒店的国家和 Destination 聚合数据。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-card">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-5 py-7 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <Globe2 className="size-4" />
              Dida 全球酒店静态分布
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              全球酒店地图与 Destination 钻取
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              悬停查看国家酒店数，点击国家后按 DestinationID 查看目的地，并可搜索深圳及周边等区域。
            </p>
            <button
              type="button"
              onClick={() => window.location.assign('./hokkaido/index.html')}
              className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-primary/25 bg-primary/8 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              查看北海道 4,251 家酒店点位 →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="text-2xl font-semibold tabular-nums">
                {numberFormat.format(data.meta.uniqueHotels)}
              </div>
              <div className="text-xs text-muted-foreground">唯一 HotelID</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">
                {data.meta.countryCount}
              </div>
              <div className="text-xs text-muted-foreground">国家/地区</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">
                {numberFormat.format(data.meta.destinationGroupCount)}
              </div>
              <div className="text-xs text-muted-foreground">Destination 分组</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">0</div>
              <div className="text-xs text-muted-foreground">重复 HotelID</div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-5 py-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Card className="min-w-0">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPinned className="size-4 text-primary" />
                  国家酒店数量分布
                </CardTitle>
                <CardDescription className="mt-1">
                  颜色按酒店数量的对数区间显示，深色代表静态记录更多
                </CardDescription>
              </div>
              <label
                htmlFor="country-select"
                className="grid gap-1.5 text-xs font-medium text-muted-foreground"
              >
                直接选择国家/地区
                <NativeSelect
                  id="country-select"
                  value={selectedCountryCode}
                  onChange={(event) => selectCountry(event.target.value)}
                  className="w-full sm:w-[240px]"
                  aria-label="选择国家或地区"
                >
                  {data.countries.map((country) => (
                    <NativeSelectOption key={country.code} value={country.code}>
                      {country.nameCn} · {numberFormat.format(country.count)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="relative overflow-hidden rounded-xl border border-border bg-map-surface">
              <svg
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                className="block h-auto w-full"
                aria-label="全球各国家和地区的 Dida 酒店数量分布地图"
              >
                <title>全球各国家和地区的 Dida 酒店数量分布地图</title>
                <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="var(--map-ocean)" />
                <g>
                  {mapPaths.map((countryPath) => {
                    const country = countryMap.get(countryPath.code);
                    const selected = countryPath.code === selectedCountryCode;
                    const enabled = Boolean(country);
                    return (
                      <path
                        key={countryPath.code}
                        d={countryPath.path}
                        fill={mapFill(country?.count, maximumCountryCount, selected)}
                        stroke={selected ? 'var(--map-selected-stroke)' : 'var(--map-stroke)'}
                        strokeWidth={selected ? 1.8 : 0.6}
                        vectorEffect="non-scaling-stroke"
                        className={enabled ? 'map-country' : undefined}
                        role={enabled ? 'button' : undefined}
                        tabIndex={enabled ? 0 : -1}
                        aria-label={
                          country
                            ? `${country.nameCn}，${numberFormat.format(country.count)} 家酒店`
                            : undefined
                        }
                        onMouseEnter={(event) =>
                          enabled && updateTooltip(countryPath.code, event)
                        }
                        onMouseMove={(event) =>
                          enabled && updateTooltip(countryPath.code, event)
                        }
                        onMouseLeave={() => setHoveredCountryCode(null)}
                        onFocus={() => {
                          if (enabled) {
                            setHoveredCountryCode(countryPath.code);
                            setTooltipPosition({ x: 28, y: 24 });
                          }
                        }}
                        onBlur={() => setHoveredCountryCode(null)}
                        onClick={() => enabled && selectCountry(countryPath.code)}
                        onKeyDown={(event) =>
                          enabled && handleMapKeyDown(countryPath.code, event)
                        }
                      />
                    );
                  })}
                </g>
              </svg>

              {hoveredCountry ? (
                <output
                  className="pointer-events-none absolute z-20 min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg"
                  style={{ left: tooltipPosition.x, top: tooltipPosition.y }}
                >
                  <div className="text-sm font-medium">{hoveredCountry.nameCn}</div>
                  <div className="mt-0.5 text-lg font-semibold tabular-nums">
                    {formatCompactCount(hoveredCountry.count)} 家
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    精确值 {numberFormat.format(hoveredCountry.count)}
                  </div>
                </output>
              ) : null}

              <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card/95 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur-sm">
                <span>少</span>
                {[1, 2, 3, 4, 5].map((level) => (
                  <span
                    key={level}
                    className="size-3 rounded-sm"
                    style={{ background: `var(--map-${level})` }}
                  />
                ))}
                <span>多</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MousePointer2 className="size-3.5" />
                悬停显示数量；点击国家进入 Destination 明细
              </span>
              <span>统计口径：CountryCode + 唯一 HotelID</span>
            </div>
          </CardContent>
        </Card>

        <aside className="grid content-start gap-5">
          <Card className="border-primary/20 bg-primary/[0.035]">
            <CardHeader>
              <CardDescription>当前国家/地区</CardDescription>
              <CardTitle className="text-xl">
                {selectedCountry?.nameCn ?? selectedCountryCode}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-semibold tracking-tight tabular-nums text-primary">
                {selectedCountry ? formatCompactCount(selectedCountry.count) : '—'}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {selectedCountry ? numberFormat.format(selectedCountry.count) : '0'} 家静态酒店记录
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div>
                  <div className="font-medium tabular-nums">
                    {numberFormat.format(countryDestinations.length)}
                  </div>
                  <div className="text-xs text-muted-foreground">Destination 数</div>
                </div>
                <div>
                  <div className="font-medium tabular-nums">
                    {selectedCountry
                      ? percentFormat.format(
                          selectedCountry.count / data.meta.uniqueHotels,
                        )
                      : '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">占全球酒店</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>全球 Top 10 国家/地区</CardTitle>
              <CardDescription>点击可切换下面的 Destination 列表</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1">
              {topCountries.map((country, index) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => selectCountry(country.code)}
                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="w-5 text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {country.nameCn}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatCompactCount(country.count)}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>

      <section
        id="destination-panel"
        className="scroll-mt-4 border-t border-border bg-card/55"
      >
        <div className="mx-auto w-full max-w-[1500px] px-5 py-8 sm:px-8">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
                <Building2 className="size-4" />
                DestinationID 口径
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {selectedCountry?.nameCn ?? selectedCountryCode}的城市 / 目的地
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Destination 可能是城市、岛屿、区域或“及周边地区”，因此不与 CityCode 混用。
              </p>
            </div>
            <label
              htmlFor="destination-search"
              className="grid w-full max-w-md gap-1.5 text-xs font-medium text-muted-foreground"
            >
              搜索目的地名称或 DestinationID
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="destination-search"
                  value={destinationQuery}
                  onChange={(event) => {
                    setDestinationQuery(event.target.value);
                    setVisibleLimit(40);
                  }}
                  placeholder="例如：深圳、Shenzhen、6046792"
                  className="h-10 pl-9"
                />
              </div>
            </label>
          </div>

          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="h-fit border-primary/20">
              <CardHeader>
                <CardDescription>当前选择的 Destination</CardDescription>
                <CardTitle className="text-xl">
                  {selectedDestination?.nameCn ?? '请选择目的地'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDestination && selectedCountry ? (
                  <>
                    <div className="text-4xl font-semibold tracking-tight tabular-nums text-primary">
                      {numberFormat.format(selectedDestination.count)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">家酒店</div>
                    <dl className="mt-6 grid gap-3 border-t border-border pt-4 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">DestinationID</dt>
                        <dd className="font-mono tabular-nums">
                          {selectedDestination.id}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">国家内排名</dt>
                        <dd className="tabular-nums">第 {selectedDestinationRank} 名</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">占该国酒店</dt>
                        <dd className="tabular-nums">
                          {percentFormat.format(
                            selectedDestination.count / selectedCountry.count,
                          )}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-muted-foreground">英文名称</dt>
                        <dd className="max-w-[210px] text-right">
                          {selectedDestination.nameEn}
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">当前国家没有 Destination 数据。</p>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <CardTitle>Destination 排名</CardTitle>
                    <CardDescription className="mt-1">
                      找到 {numberFormat.format(filteredDestinations.length)} 个结果，按酒店数降序
                    </CardDescription>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    酒店数 / {selectedCountry?.nameCn}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {visibleDestinations.length ? (
                  <div className="divide-y divide-border">
                    {visibleDestinations.map((destination) => {
                      const rank = countryDestinations.findIndex(
                        (item) => item.id === destination.id,
                      ) + 1;
                      const width = countryDestinations[0]
                        ? (destination.count / countryDestinations[0].count) * 100
                        : 0;
                      const active = destination.id === selectedDestinationId;
                      return (
                        <button
                          key={destination.id}
                          type="button"
                          onClick={() => setSelectedDestinationId(destination.id)}
                          className={`relative grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 ${
                            active ? 'bg-primary/[0.06]' : 'hover:bg-muted/70'
                          }`}
                        >
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {rank}
                          </span>
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="truncate text-sm font-medium">
                                {destination.nameCn}
                              </span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                ID {destination.id}
                              </span>
                            </span>
                            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                              <span
                                className="block h-full rounded-full bg-chart-1"
                                style={{ width: `${Math.max(width, 0.35)}%` }}
                              />
                            </span>
                          </span>
                          <span className="text-right">
                            <span className="block text-sm font-semibold tabular-nums">
                              {numberFormat.format(destination.count)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">家</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-14 text-center">
                    <Search className="mx-auto mb-3 size-6 text-muted-foreground" />
                    <p className="font-medium">没有匹配的 Destination</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      可以尝试中文名、英文名或 DestinationID。
                    </p>
                  </div>
                )}

                {visibleDestinations.length < filteredDestinations.length ? (
                  <div className="flex justify-center border-t border-border p-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setVisibleLimit((limit) => limit + 60)}
                    >
                      显示更多
                      <ChevronDown data-icon="inline-end" />
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-5 py-6 text-xs leading-5 text-muted-foreground sm:px-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-3xl gap-2">
            <Database className="mt-0.5 size-4 shrink-0" />
            <p>
              数据来自 {data.meta.source}。国家按 CountryCode + 唯一 HotelID 聚合；城市/目的地按 CountryCode + DestinationID 聚合，同一 DestinationID 取出现频率最高的中英文名称。
            </p>
          </div>
          <p className="max-w-xl">
            这是 Dida 静态内容覆盖量，不代表当前营业、实时可售、持证住宿或房间数量。已修复 {data.meta.repairedRows} 条结构异常记录。
          </p>
        </div>
      </footer>
    </main>
  );
}
