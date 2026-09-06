/* Load-aware camera for MapLibre. Only the next Esri destination is warmed in
 * the browser's normal HTTP cache; no persistent/offline tile storage. */
(function (root) {
  'use strict';
  const MAX_PREFETCH_TILES = 80;

  function destinationTiles(source, camera, width = 1024) {
    if (!source || !Array.isArray(source.tiles) || !source.tiles.length) return [];
    const [lng, latitude] = camera.center;
    const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
    const offset = Math.log2(512 / (source.tileSize || 512));
    const levels = [...new Set([9, 13, 15, camera.zoom].filter(z => z <= camera.zoom)
      .map(z => Math.max(source.minzoom || 0, Math.min(source.maxzoom || 22, Math.round(z + offset)))))];
    const urls = new Set();
    for (const z of levels) {
      const n = 2 ** z;
      const x = Math.floor(((lng + 180) / 360) * n);
      const sin = Math.sin(lat * Math.PI / 180);
      const y = Math.floor((0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n);
      const radius = z === levels[levels.length - 1] ? Math.min(3, Math.max(1, Math.ceil(width / 512))) : 1;
      // Centre first: a bounded budget must never discard the destination itself.
      for (let ring = 0; ring <= radius; ring++) {
        for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring || y + dy < 0 || y + dy >= n) continue;
          const tx = ((x + dx) % n + n) % n;
          const ty = source.scheme === 'tms' ? n - 1 - (y + dy) : y + dy;
          const template = source.tiles[(tx + y + dy) % source.tiles.length];
          urls.add(template.replace('{z}', z).replace('{x}', tx).replace('{y}', ty));
          if (urls.size >= MAX_PREFETCH_TILES) return [...urls];
        }
      }
    }
    return [...urls];
  }

  function distanceMeters(a, b) {
    const rad = Math.PI / 180;
    const dlat = (b[1] - a[1]) * rad, dlng = (b[0] - a[0]) * rad;
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dlng / 2) ** 2;
    return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function createTourCamera(map, options = {}) {
    const fetchTile = options.fetch || root.fetch.bind(root);
    const readyTimeout = options.readyTimeout ?? 12000;
    const warmupBudget = options.warmupBudget ?? 1500;
    let flight = null, warm = null;

    function prepare(camera) {
      // The topographic provider is deliberately excluded from speculative loads.
      const source = map.getStyle()?.sources?.esri;
      if (!source || source.type !== 'raster' || root.navigator?.connection?.saveData) return Promise.resolve();
      const key = JSON.stringify([source.tiles, camera.center, camera.zoom]);
      if (warm?.key === key) return warm.promise;
      warm?.controller.abort();
      const controller = new AbortController();
      const urls = destinationTiles(source, camera, map.getCanvas().clientWidth);
      let cursor = 0, failed = false;
      const timer = setTimeout(() => controller.abort(), 6500);
      // Three low priority requests at a time leave room for the visible map.
      const workers = Array.from({length: Math.min(3, urls.length)}, async () => {
        while (cursor < urls.length && !controller.signal.aborted) {
          const url = urls[cursor++];
          try {
            const response = await fetchTile(url, {signal: controller.signal, credentials: 'same-origin', priority: 'low'});
            if (response.ok) await response.arrayBuffer();
            else { failed = true; controller.abort(); }
          } catch (_) { failed = true; controller.abort(); /* Render readiness decides arrival. */ }
        }
      });
      const promise = Promise.all(workers).finally(() => {
        clearTimeout(timer);
        if ((failed || controller.signal.aborted) && warm?.controller === controller) warm = null;
      });
      warm = {key, controller, promise};
      return promise;
    }

    function cancel() {
      const previous = flight;
      flight = null;
      previous?.abort();
      warm?.controller.abort();
      warm = null;
      if (previous) map.stop();
    }

    function warmBeforeMove(camera, signal) {
      return new Promise(resolve => {
        let timer;
        const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
        signal.addEventListener('abort', finish, {once: true});
        timer = setTimeout(finish, warmupBudget);
        prepare(camera).then(finish);
      });
    }

    function moveAndWait(camera, method, signal, onPhase) {
      return new Promise(resolve => {
        let ended = false, painted = false, tileError = false, settled = false;
        const finish = status => {
          if (settled) return;
          settled = true;
          if (status === 'timeout' || status === 'error') {
            root.console?.warn('[tour-map] Destination loading paused', {
              status, ended, painted, tileError, moving:map.isMoving(),
              zoom:map.getZoom(), targetZoom:camera.zoom,
              styleLoaded:map.isStyleLoaded(), tilesLoaded:map.areTilesLoaded(),
            });
          }
          clearTimeout(timer);
          map.off('moveend', onEnd); map.off('render', onRender); map.off('error', onError);
          signal.removeEventListener('abort', onAbort);
          resolve(status);
        };
        const onAbort = () => finish('cancelled');
        const onEnd = () => {
          const center = map.getCenter();
          if (distanceMeters([center.lng, center.lat], camera.center) > 5 || Math.abs(map.getZoom() - camera.zoom) > 0.05) {
            finish('cancelled'); return;
          }
          ended = true; painted = false; onPhase?.('loading'); map.triggerRepaint();
        };
        const onError = event => { if (event.sourceId) tileError = true; };
        const onRender = () => {
          if (!ended || map.isMoving()) return;
          // Source coverage is updated during rendering. Never accept the old
          // viewport's areTilesLoaded() value synchronously from moveend.
          if (!painted) { painted = true; map.triggerRepaint(); return; }
          if (map.isStyleLoaded() && map.areTilesLoaded()) finish(tileError ? 'error' : 'ready');
        };
        const timer = setTimeout(() => finish('timeout'), (camera.duration || 0) + readyTimeout);
        map.on('moveend', onEnd); map.on('render', onRender); map.on('error', onError);
        signal.addEventListener('abort', onAbort, {once: true});
        if (signal.aborted) { finish('cancelled'); return; }
        onPhase?.('moving');
        map[method]({...camera, essential: false});
      });
    }

    async function navigate(camera, onPhase) {
      // Keep an existing preparation of this destination, but retire old flight callbacks.
      flight?.abort();
      const controller = new AbortController();
      flight = controller;
      map.stop();
      const signal = controller.signal;
      onPhase?.('preparing');
      await warmBeforeMove(camera, signal);
      if (signal.aborted) return 'cancelled';
      const center = map.getCenter();
      const distance = distanceMeters([center.lng, center.lat], camera.center);
      const stages = [];
      if (distance > 1500 || map.getZoom() < 13) {
        stages.push({method: 'flyTo', camera: {...camera, zoom: Math.min(13, camera.zoom), pitch: 0,
          duration: Math.min(4600, 2400 + distance / 150)}});
        if (camera.zoom > 15) stages.push({method: 'easeTo', camera: {...camera, zoom: 15, pitch: 0, duration: 1100}});
      }
      stages.push({method: 'easeTo', camera: {...camera, duration: 1500}});
      let status = 'ready';
      for (const stage of stages) {
        status = await moveAndWait(stage.camera, stage.method, signal, onPhase);
        if (status !== 'ready' || signal.aborted) break;
      }
      if (flight === controller) { flight = null; if (status !== 'ready') map.stop(); }
      return signal.aborted ? 'cancelled' : status;
    }

    return {prepare, navigate, cancel, isNavigating: () => !!flight};
  }
  root.TourMap = {createTourCamera, destinationTiles, distanceMeters};
})(typeof window === 'undefined' ? globalThis : window);
