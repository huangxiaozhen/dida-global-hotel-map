(function () {
  'use strict';

  const DATA = window.__DIDA_HOTEL_MAP__;
  const MAP = window.__WORLD_MAP_PATHS__;
  const numberFormat = new Intl.NumberFormat('zh-CN');
  const percentFormat = new Intl.NumberFormat('zh-CN', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const svgNamespace = 'http://www.w3.org/2000/svg';

  function byId(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing element #${id}`);
    return element;
  }

  function showLoadError(message) {
    const box = byId('load-error');
    box.textContent = message;
    box.hidden = false;
  }

  if (!DATA || !MAP || !Array.isArray(MAP.paths)) {
    showLoadError(
      '页面数据没有完整载入。请确认 index.html、hotel-map-data.js、map-paths.js 和 app.js 位于同一个文件夹。',
    );
    return;
  }

  const countryMap = new Map(DATA.countries.map((country) => [country.code, country]));
  const pathNodes = new Map();
  const maximumCountryCount = DATA.countries[0]?.count || 1;
  let selectedCountryCode = countryMap.has('CN') ? 'CN' : DATA.countries[0]?.code;
  let selectedDestinationId = '6046792';
  let destinationQuery = '';
  let visibleLimit = 40;

  const countrySelect = byId('country-select');
  const destinationSearch = byId('destination-search');
  const destinationList = byId('destination-list');
  const showMoreWrap = byId('show-more-wrap');
  const showMoreButton = byId('show-more');
  const listEmpty = byId('list-empty');
  const mapWrap = byId('map-wrap');
  const worldMap = byId('world-map');
  const tooltip = byId('map-tooltip');

  function formatCompactCount(value) {
    if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(2)} 亿`;
    if (value >= 10_000) {
      const precision = value >= 1_000_000 ? 1 : 2;
      return `${(value / 10_000).toFixed(precision)} 万`;
    }
    return numberFormat.format(value);
  }

  function mapFill(count, selected) {
    if (selected) return 'var(--map-selected)';
    if (!count) return 'var(--map-empty)';
    const ratio = Math.log1p(count) / Math.log1p(maximumCountryCount);
    if (ratio > 0.92) return 'var(--map-5)';
    if (ratio > 0.78) return 'var(--map-4)';
    if (ratio > 0.62) return 'var(--map-3)';
    if (ratio > 0.44) return 'var(--map-2)';
    return 'var(--map-1)';
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function countryDestinations() {
    return DATA.destinationsByCountry[selectedCountryCode] || [];
  }

  function selectedCountry() {
    return countryMap.get(selectedCountryCode);
  }

  function filteredDestinations() {
    const destinations = countryDestinations();
    const query = destinationQuery.trim().toLocaleLowerCase('zh-CN');
    if (!query) return destinations;
    return destinations.filter((destination) =>
      `${destination.nameCn} ${destination.nameEn} ${destination.id}`
        .toLocaleLowerCase('zh-CN')
        .includes(query),
    );
  }

  function ensureSelectedDestination() {
    const destinations = countryDestinations();
    if (destinations.some((destination) => destination.id === selectedDestinationId)) return;
    const preferred =
      selectedCountryCode === 'CN'
        ? destinations.find((destination) => destination.id === '6046792')
        : undefined;
    selectedDestinationId = (preferred || destinations[0] || {}).id || '';
  }

  function updateMapSelection() {
    pathNodes.forEach((path, code) => {
      const country = countryMap.get(code);
      const selected = code === selectedCountryCode;
      path.setAttribute('fill', mapFill(country?.count, selected));
      path.setAttribute(
        'stroke',
        selected ? 'var(--map-selected-stroke)' : 'var(--map-stroke)',
      );
      path.setAttribute('stroke-width', selected ? '1.8' : '0.6');
    });
  }

  function positionTooltip(event) {
    const bounds = mapWrap.getBoundingClientRect();
    const tooltipWidth = 174;
    let x = event.clientX - bounds.left + 14;
    let y = event.clientY - bounds.top + 14;
    if (x + tooltipWidth > bounds.width) x -= tooltipWidth + 28;
    if (y + 90 > bounds.height) y -= 96;
    tooltip.style.left = `${Math.max(8, x)}px`;
    tooltip.style.top = `${Math.max(8, y)}px`;
  }

  function showTooltip(code, event) {
    const country = countryMap.get(code);
    if (!country) return;
    byId('tooltip-name').textContent = country.nameCn;
    byId('tooltip-value').textContent = `${formatCompactCount(country.count)} 家`;
    byId('tooltip-exact').textContent = `精确值 ${numberFormat.format(country.count)}`;
    if (event) positionTooltip(event);
    tooltip.hidden = false;
  }

  function buildMap() {
    worldMap.replaceChildren();
    const ocean = document.createElementNS(svgNamespace, 'rect');
    ocean.setAttribute('width', String(MAP.width));
    ocean.setAttribute('height', String(MAP.height));
    ocean.setAttribute('fill', 'var(--map-ocean)');
    worldMap.appendChild(ocean);

    MAP.paths.forEach((countryPath) => {
      const path = document.createElementNS(svgNamespace, 'path');
      const country = countryMap.get(countryPath.code);
      const enabled = Boolean(country);
      path.setAttribute('d', countryPath.path);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      path.setAttribute('fill', mapFill(country?.count, countryPath.code === selectedCountryCode));
      path.setAttribute(
        'stroke',
        countryPath.code === selectedCountryCode
          ? 'var(--map-selected-stroke)'
          : 'var(--map-stroke)',
      );
      path.setAttribute('stroke-width', countryPath.code === selectedCountryCode ? '1.8' : '0.6');
      pathNodes.set(countryPath.code, path);

      if (enabled) {
        path.classList.add('map-country');
        path.setAttribute('role', 'button');
        path.setAttribute('tabindex', '0');
        path.setAttribute(
          'aria-label',
          `${country.nameCn}，${numberFormat.format(country.count)} 家酒店`,
        );
        path.addEventListener('mouseenter', (event) => showTooltip(countryPath.code, event));
        path.addEventListener('mousemove', (event) => showTooltip(countryPath.code, event));
        path.addEventListener('mouseleave', () => {
          tooltip.hidden = true;
        });
        path.addEventListener('focus', () => {
          tooltip.style.left = '14px';
          tooltip.style.top = '14px';
          showTooltip(countryPath.code);
        });
        path.addEventListener('blur', () => {
          tooltip.hidden = true;
        });
        path.addEventListener('click', () => selectCountry(countryPath.code));
        path.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectCountry(countryPath.code);
          }
        });
      }
      worldMap.appendChild(path);
    });
  }

  function populateCountrySelect() {
    const fragment = document.createDocumentFragment();
    DATA.countries.forEach((country) => {
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = `${country.nameCn} · ${numberFormat.format(country.count)}`;
      fragment.appendChild(option);
    });
    countrySelect.replaceChildren(fragment);
    countrySelect.value = selectedCountryCode;
  }

  function renderTopCountries() {
    const container = byId('top-countries');
    const fragment = document.createDocumentFragment();
    DATA.countries.slice(0, 10).forEach((country, index) => {
      const button = createElement('button', 'top-row');
      button.type = 'button';
      button.addEventListener('click', () => selectCountry(country.code));
      button.append(
        createElement('span', 'top-rank', String(index + 1)),
        createElement('span', 'top-name', country.nameCn),
        createElement('span', 'top-count', formatCompactCount(country.count)),
      );
      fragment.appendChild(button);
    });
    container.replaceChildren(fragment);
  }

  function renderCountryCard() {
    const country = selectedCountry();
    const destinations = countryDestinations();
    if (!country) return;
    byId('country-name').textContent = country.nameCn;
    byId('country-count-compact').textContent = formatCompactCount(country.count);
    byId('country-count-exact').textContent = `${numberFormat.format(country.count)} 家静态酒店记录`;
    byId('country-destination-count').textContent = numberFormat.format(destinations.length);
    byId('country-global-share').textContent = percentFormat.format(
      country.count / DATA.meta.uniqueHotels,
    );
    byId('destination-country-name').textContent = country.nameCn;
    byId('list-country-name').textContent = country.nameCn;
  }

  function renderSelectedDestination() {
    ensureSelectedDestination();
    const country = selectedCountry();
    const destinations = countryDestinations();
    const destination = destinations.find((item) => item.id === selectedDestinationId);
    if (!country || !destination) {
      byId('selected-destination-name').textContent = '请选择目的地';
      byId('selected-destination-count').textContent = '—';
      byId('selected-destination-id').textContent = '—';
      byId('selected-destination-rank').textContent = '—';
      byId('selected-destination-share').textContent = '—';
      byId('selected-destination-en').textContent = '—';
      return;
    }

    const rank = destinations.findIndex((item) => item.id === destination.id) + 1;
    byId('selected-destination-name').textContent = destination.nameCn;
    byId('selected-destination-count').textContent = numberFormat.format(destination.count);
    byId('selected-destination-id').textContent = destination.id;
    byId('selected-destination-rank').textContent = `第 ${rank} 名`;
    byId('selected-destination-share').textContent = percentFormat.format(
      destination.count / country.count,
    );
    byId('selected-destination-en').textContent = destination.nameEn;
  }

  function renderDestinationList() {
    const allDestinations = countryDestinations();
    const filtered = filteredDestinations();
    const visible = filtered.slice(0, visibleLimit);
    const rankMap = new Map(allDestinations.map((destination, index) => [destination.id, index + 1]));
    const maximum = allDestinations[0]?.count || 1;
    const fragment = document.createDocumentFragment();

    visible.forEach((destination) => {
      const button = createElement(
        'button',
        `destination-row${destination.id === selectedDestinationId ? ' active' : ''}`,
      );
      button.type = 'button';
      button.setAttribute('aria-label', `${destination.nameCn}，${numberFormat.format(destination.count)} 家酒店`);
      button.addEventListener('click', () => {
        selectedDestinationId = destination.id;
        renderSelectedDestination();
        renderDestinationList();
      });

      const rank = createElement('span', 'destination-rank', String(rankMap.get(destination.id) || '—'));
      const main = createElement('span', 'destination-main');
      const titleLine = createElement('span', 'destination-title-line');
      titleLine.append(
        createElement('span', 'destination-title', destination.nameCn),
        createElement('span', 'destination-id', `ID ${destination.id}`),
      );
      const track = createElement('span', 'bar-track');
      const fill = createElement('span', 'bar-fill');
      fill.style.width = `${Math.max((destination.count / maximum) * 100, 0.35)}%`;
      track.appendChild(fill);
      main.append(titleLine, track);

      const count = createElement('span', 'destination-count');
      count.append(
        createElement('strong', '', numberFormat.format(destination.count)),
        createElement('span', '', '家'),
      );
      button.append(rank, main, count);
      fragment.appendChild(button);
    });

    destinationList.replaceChildren(fragment);
    listEmpty.hidden = visible.length !== 0;
    showMoreWrap.hidden = visible.length >= filtered.length;
    byId('results-summary').textContent = `找到 ${numberFormat.format(filtered.length)} 个结果，按酒店数降序`;
  }

  function renderAll() {
    ensureSelectedDestination();
    countrySelect.value = selectedCountryCode;
    renderCountryCard();
    renderSelectedDestination();
    renderDestinationList();
    updateMapSelection();
  }

  function selectCountry(code) {
    if (!countryMap.has(code)) return;
    selectedCountryCode = code;
    destinationQuery = '';
    destinationSearch.value = '';
    visibleLimit = 40;
    const destinations = DATA.destinationsByCountry[code] || [];
    const preferred =
      code === 'CN'
        ? destinations.find((destination) => destination.id === '6046792')
        : undefined;
    selectedDestinationId = (preferred || destinations[0] || {}).id || '';
    renderAll();
  }

  byId('kpi-hotels').textContent = numberFormat.format(DATA.meta.uniqueHotels);
  byId('kpi-countries').textContent = numberFormat.format(DATA.meta.countryCount);
  byId('kpi-destinations').textContent = numberFormat.format(DATA.meta.destinationGroupCount);
  byId('kpi-duplicates').textContent = numberFormat.format(DATA.meta.duplicateRows);

  countrySelect.addEventListener('change', () => selectCountry(countrySelect.value));
  destinationSearch.addEventListener('input', () => {
    destinationQuery = destinationSearch.value;
    visibleLimit = 40;
    renderDestinationList();
  });
  showMoreButton.addEventListener('click', () => {
    visibleLimit += 60;
    renderDestinationList();
  });

  populateCountrySelect();
  renderTopCountries();
  buildMap();
  renderAll();
})();
