(function () {
  'use strict';

  const DATA = window.__DIDA_HOKKAIDO_HOTELS__;
  const numberFormat = new Intl.NumberFormat('zh-CN');
  const HOKKAIDO_BOUNDS = [
    [41.25, 139.05],
    [45.72, 145.95],
  ];

  function byId(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing element #${id}`);
    return element;
  }

  function displayName(hotel) {
    return hotel.nameCn || hotel.name || `Hotel ${hotel.id}`;
  }

  function secondaryName(hotel) {
    if (!hotel.name || hotel.name === displayName(hotel)) return '';
    return hotel.name;
  }

  function destinationName(hotel) {
    return hotel.destinationCn || hotel.destination || '未标注目的地';
  }

  function cityName(hotel) {
    if (hotel.cityCn && hotel.city && hotel.cityCn !== hotel.city) {
      return `${hotel.cityCn} / ${hotel.city}`;
    }
    return hotel.cityCn || hotel.city || '—';
  }

  function addressText(hotel) {
    if (hotel.addressCn && hotel.address && hotel.addressCn !== hotel.address) {
      return `${hotel.addressCn}\n${hotel.address}`;
    }
    return hotel.addressCn || hotel.address || '—';
  }

  function hasCoordinates(hotel) {
    return (
      Number.isFinite(hotel.latitude) &&
      Number.isFinite(hotel.longitude) &&
      hotel.latitude >= 41 &&
      hotel.latitude <= 46 &&
      hotel.longitude >= 139 &&
      hotel.longitude <= 146
    );
  }

  if (!DATA || !Array.isArray(DATA.hotels)) {
    byId('visible-summary').textContent = '酒店数据载入失败。';
    return;
  }

  byId('total-hotels').textContent = numberFormat.format(DATA.meta.totalHotels);
  byId('mapped-hotels').textContent = numberFormat.format(DATA.meta.mappedHotels);
  byId('destination-count').textContent = numberFormat.format(DATA.meta.destinationCount);

  if (!window.L || typeof L.markerClusterGroup !== 'function') {
    byId('visible-summary').textContent = `${numberFormat.format(DATA.meta.totalHotels)} 家酒店可搜索，公开地图组件载入失败。`;
    byId('map-error').hidden = false;
    return;
  }

  const map = L.map('map', {
    preferCanvas: true,
    minZoom: 5,
    maxZoom: 19,
    zoomControl: true,
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  })
    .on('tileerror', function () {
      byId('map-error').hidden = false;
    })
    .addTo(map);

  map.fitBounds(HOKKAIDO_BOUNDS, { padding: [10, 10] });

  const clusterLayer = L.markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 100,
    chunkDelay: 25,
    maxClusterRadius: 48,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    removeOutsideVisibleBounds: true,
  });
  map.addLayer(clusterLayer);

  const markerByHotelId = new Map();
  const normalizedSearch = new Map();
  let activeDestinationId = '';

  for (const hotel of DATA.hotels) {
    normalizedSearch.set(
      hotel.id,
      [
        hotel.id,
        hotel.name,
        hotel.nameCn,
        hotel.address,
        hotel.addressCn,
        hotel.city,
        hotel.cityCn,
        hotel.destination,
        hotel.destinationCn,
        hotel.destinationId,
        hotel.zipCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('zh-CN'),
    );
  }

  function createMarker(hotel) {
    const marker = L.circleMarker([hotel.latitude, hotel.longitude], {
      radius: 5,
      className: 'hotel-dot',
      fillColor: '#0782a6',
      fillOpacity: 0.72,
      color: '#ffffff',
      weight: 1.4,
    });
    marker.bindTooltip(displayName(hotel), {
      direction: 'top',
      offset: [0, -4],
      opacity: 0.96,
    });
    marker.on('click', function () {
      selectHotel(hotel, false);
    });
    markerByHotelId.set(hotel.id, marker);
    return marker;
  }

  function hotelsForActiveDestination() {
    if (!activeDestinationId) return DATA.hotels;
    return DATA.hotels.filter((hotel) => hotel.destinationId === activeDestinationId);
  }

  function renderMarkers(fitFilteredBounds) {
    clusterLayer.clearLayers();
    markerByHotelId.clear();
    const visibleHotels = hotelsForActiveDestination();
    const mapped = visibleHotels.filter(hasCoordinates);
    const markers = mapped.map(createMarker);
    clusterLayer.addLayers(markers);

    const missing = visibleHotels.length - mapped.length;
    byId('visible-summary').textContent = `当前显示 ${numberFormat.format(mapped.length)} 个点位${missing ? `，另有 ${numberFormat.format(missing)} 家缺少坐标` : ''}`;

    if (fitFilteredBounds && mapped.length) {
      const bounds = L.latLngBounds(mapped.map((hotel) => [hotel.latitude, hotel.longitude]));
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
    }
  }

  function setText(id, value) {
    byId(id).textContent = value || '—';
  }

  function selectHotel(hotel, focusOnMap) {
    byId('detail-empty').hidden = true;
    byId('hotel-detail').hidden = false;
    setText('detail-destination', destinationName(hotel));
    setText('detail-name', displayName(hotel));
    setText('detail-name-en', secondaryName(hotel));
    setText('detail-id', hotel.id);
    setText('detail-city', cityName(hotel));
    setText('detail-address', addressText(hotel));
    byId('detail-address').style.whiteSpace = 'pre-line';
    setText('detail-zip', hotel.zipCode || '—');
    setText(
      'detail-star',
      hotel.starRating && hotel.starRating > 0 ? `${hotel.starRating} 星` : '未评级',
    );
    setText('detail-category', hotel.propertyCategory || '未标注');
    setText('detail-destination-id', hotel.destinationId);
    setText('detail-updated', hotel.updatedAt || '—');

    const osmLink = byId('osm-link');
    const coordinateNote = byId('coordinate-note');
    if (hasCoordinates(hotel)) {
      setText(
        'detail-coordinates',
        `${hotel.latitude.toFixed(6)}, ${hotel.longitude.toFixed(6)}`,
      );
      osmLink.href = `https://www.openstreetmap.org/?mlat=${hotel.latitude}&mlon=${hotel.longitude}#map=17/${hotel.latitude}/${hotel.longitude}`;
      osmLink.hidden = false;
      coordinateNote.hidden = true;
      if (focusOnMap) {
        const marker = markerByHotelId.get(hotel.id);
        if (marker) {
          clusterLayer.zoomToShowLayer(marker, function () {
            map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15));
            marker.openTooltip();
          });
        }
      }
    } else {
      setText('detail-coordinates', '源数据缺失');
      osmLink.hidden = true;
      coordinateNote.hidden = false;
    }

    if (window.matchMedia('(max-width: 760px)').matches) {
      byId('hotel-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const destinationSelect = byId('destination-select');
  for (const destination of DATA.destinations) {
    const option = document.createElement('option');
    option.value = destination.id;
    option.textContent = `${destination.nameCn || destination.name} · ${numberFormat.format(destination.count)}`;
    destinationSelect.appendChild(option);
  }

  destinationSelect.addEventListener('change', function () {
    activeDestinationId = destinationSelect.value;
    renderMarkers(true);
  });

  byId('reset-map').addEventListener('click', function () {
    activeDestinationId = '';
    destinationSelect.value = '';
    map.fitBounds(HOKKAIDO_BOUNDS, { padding: [10, 10] });
    renderMarkers(false);
  });

  const searchInput = byId('hotel-search');
  const searchResults = byId('search-results');
  const searchClear = byId('search-clear');

  function closeSearchResults() {
    searchResults.hidden = true;
  }

  function chooseSearchResult(hotel) {
    searchInput.value = displayName(hotel);
    searchClear.hidden = false;
    closeSearchResults();

    if (activeDestinationId && hotel.destinationId !== activeDestinationId) {
      activeDestinationId = hotel.destinationId;
      destinationSelect.value = hotel.destinationId;
      renderMarkers(true);
    }
    selectHotel(hotel, true);
  }

  function renderSearchResults() {
    const query = searchInput.value.trim().toLocaleLowerCase('zh-CN');
    searchClear.hidden = !query;
    searchResults.replaceChildren();
    if (!query) {
      closeSearchResults();
      return;
    }

    const matches = [];
    for (const hotel of DATA.hotels) {
      if (normalizedSearch.get(hotel.id).includes(query)) {
        matches.push(hotel);
        if (matches.length >= 10) break;
      }
    }

    searchResults.hidden = false;
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'search-empty';
      empty.textContent = '没有找到匹配的酒店。';
      searchResults.appendChild(empty);
      return;
    }

    for (const hotel of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-result';
      const name = document.createElement('strong');
      name.textContent = displayName(hotel);
      const meta = document.createElement('span');
      meta.textContent = `${cityName(hotel)} · ${destinationName(hotel)} · HotelID ${hotel.id}${hasCoordinates(hotel) ? '' : ' · 暂无坐标'}`;
      button.append(name, meta);
      button.addEventListener('click', function () {
        chooseSearchResult(hotel);
      });
      searchResults.appendChild(button);
    }
  }

  searchInput.addEventListener('input', renderSearchResults);
  searchInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      const firstResult = searchResults.querySelector('.search-result');
      if (firstResult) {
        event.preventDefault();
        firstResult.click();
      }
    }
    if (event.key === 'Escape') closeSearchResults();
  });

  searchClear.addEventListener('click', function () {
    searchInput.value = '';
    searchClear.hidden = true;
    closeSearchResults();
    searchInput.focus();
  });

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.search-field')) closeSearchResults();
  });

  renderMarkers(false);

  const firstMappedHotel = DATA.hotels.find(hasCoordinates);
  if (firstMappedHotel) selectHotel(firstMappedHotel, false);
})();
