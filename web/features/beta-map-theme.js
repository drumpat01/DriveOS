(function () {
  "use strict";

  const style = "https://tiles.openfreemap.org/styles/dark";
  const openFreeMapGlyph = /^https:\/\/tiles\.openfreemap\.org\/fonts\/[^/]+\/(\d+-\d+\.pbf)(?:\?.*)?$/i;
  const protectedPrefixes = ["drive-route", "share-route", "share-song", "share-terminal", "collection-route"];

  function protectedLayer(layer) {
    return protectedPrefixes.some(prefix => String(layer?.id || "").startsWith(prefix)) ||
      layer?.source?.type === "geojson";
  }

  function set(map, id, property, value) {
    try { map.setPaintProperty(id, property, value); } catch {}
  }

  function apply(map) {
    if (!map?.getStyle) return;
    const layers = map.getStyle()?.layers || [];

    layers.forEach(layer => {
      if (!layer?.id || protectedLayer(layer)) return;
      const id = layer.id;
      const name = id.toLocaleLowerCase();

      if (layer.type === "background") {
        set(map, id, "background-color", "#010104");
        set(map, id, "background-opacity", 1);
        return;
      }

      if (layer.type === "fill") {
        const water = /water|ocean|river|lake/.test(name);
        const park = /park|grass|wood|forest|landcover|landuse/.test(name);
        set(map, id, "fill-color", water ? "#05091a" : park ? "#090711" : "#040309");
        set(map, id, "fill-outline-color", water ? "#15213e" : "#171020");
        set(map, id, "fill-opacity", water ? .9 : .96);
        return;
      }

      if (layer.type === "fill-extrusion") {
        set(map, id, "fill-extrusion-color", "#0d0a14");
        set(map, id, "fill-extrusion-opacity", .82);
        return;
      }

      if (layer.type === "line") {
        const boundary = /boundary|admin/.test(name);
        const transit = /rail|transit/.test(name);
        const major = /motorway|trunk|primary|highway/.test(name);
        const minor = /road|street|secondary|tertiary/.test(name);
        const water = /water|river/.test(name);
        const color = boundary ? "#371b54" : transit ? "#2b1642" : major ? "#3a1737" : minor ? "#221429" : water ? "#172849" : "#17101f";
        set(map, id, "line-color", color);
        set(map, id, "line-opacity", major ? .92 : .72);
        return;
      }

      if (layer.type === "symbol") {
        const road = /road|street|highway/.test(name);
        const poi = /poi|place|label/.test(name);
        set(map, id, "text-color", road ? "#a493ae" : poi ? "#d3c5d8" : "#9d8ba8");
        set(map, id, "text-halo-color", "#020105");
        set(map, id, "text-halo-width", 1.2);
        set(map, id, "icon-opacity", .72);
        return;
      }

      if (layer.type === "raster") {
        set(map, id, "raster-brightness-min", 0);
        set(map, id, "raster-brightness-max", .23);
        set(map, id, "raster-saturation", -.65);
        set(map, id, "raster-contrast", .22);
      }
    });

    map.getCanvas?.().style.setProperty("background", "#010104");
  }

  function attach(map) {
    if (!map?.on) return map;
    map.on("styleimagemissing", event => {
      const id = event?.id;
      if (!id || map.hasImage?.(id)) return;
      try {
        map.addImage(id, { width: 1, height: 1, data: new Uint8Array([7, 4, 12, 255]) });
      } catch {}
    });
    map.on("style.load", () => apply(map));
    if (map.isStyleLoaded?.()) apply(map);
    return map;
  }

  function transformRequest(url, resourceType) {
    const match = resourceType === "Glyphs" && String(url || "").match(openFreeMapGlyph);
    if (match) return { url: `https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/${match[1]}` };
    return { url };
  }

  function options(configuration) {
    return { ...configuration, transformRequest };
  }

  window.JourneyDeckMapTheme = Object.freeze({ style, apply, attach, transformRequest, options });
})();
